import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export type TtsProvider = 'edge-tts' | 'elevenlabs';

export const EDGE_TTS_VOICE = 'bn-BD-NabanitaNeural';

function buildBengaliNarrationScript(proverbBn: string, meaningBn: string): string {
  const cleanProverb = proverbBn.trim().replace(/[।.]+$/, '');
  const cleanMeaning = meaningBn.trim().replace(/[।.]+$/, '');
  return `${cleanProverb}। এর অর্থ হলো: ${cleanMeaning}।`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Primary TTS: Generates natural Bangladeshi Bengali voiceover using free Microsoft Edge TTS
 * with the 'bn-BD-NabanitaNeural' neural voice.
 */
async function synthesizeWithEdgeTts(script: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 30000,
  });

  try {
    await tts.setMetadata(EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(script));

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on('error', (err: Error) => {
        reject(err);
      });
      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    if (audioBuffer.length === 0) {
      throw new Error('Edge TTS returned an empty audio stream.');
    }

    return audioBuffer;
  } finally {
    tts.close();
  }
}

/**
 * Secondary fallback TTS: Generates Bengali AI voiceover using the ElevenLabs API
 * with ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, and the 'eleven_multilingual_v2' model.
 */
async function synthesizeWithElevenLabs(script: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY is not configured. Add ELEVENLABS_API_KEY to your environment secrets.'
    );
  }
  if (!voiceId) {
    throw new Error(
      'ELEVENLABS_VOICE_ID is not configured. Add ELEVENLABS_VOICE_ID to your environment secrets.'
    );
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.78,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateBengaliVoiceover(options: {
  proverbBn: string;
  meaningBn: string;
  outputPathWithoutExt: string;
}): Promise<{ filePath: string; providerUsed: TtsProvider }> {
  const script = buildBengaliNarrationScript(options.proverbBn, options.meaningBn);
  const filePath = `${options.outputPathWithoutExt}.mp3`;

  try {
    const audioBuffer = await synthesizeWithEdgeTts(script);
    fs.writeFileSync(filePath, audioBuffer);
    return { filePath, providerUsed: 'edge-tts' };
  } catch (edgeErr) {
    const edgeMessage = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    console.warn(`[tts] Edge TTS (${EDGE_TTS_VOICE}) failed, checking ElevenLabs fallback:`, edgeMessage);

    const hasElevenLabs = Boolean(
      process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim()
    );
    if (!hasElevenLabs) {
      throw new Error(
        `Edge TTS (${EDGE_TTS_VOICE}) failed (${edgeMessage}), and ElevenLabs fallback is not configured.`
      );
    }

    try {
      const fallbackBuffer = await synthesizeWithElevenLabs(script);
      fs.writeFileSync(filePath, fallbackBuffer);
      return { filePath, providerUsed: 'elevenlabs' };
    } catch (fallbackErr) {
      const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(
        `Edge TTS failed (${edgeMessage}); ElevenLabs fallback also failed (${fallbackMessage}).`
      );
    }
  }
}
