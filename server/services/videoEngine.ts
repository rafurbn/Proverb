import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { type AutomationSettings, db, DIRS, type MediaAssetRow, type ProverbRow } from '../db.ts';
import { ensureDefaultMediaAssets, probeDuration } from './seedMedia.ts';

const execFileAsync = promisify(execFile);

function hexToAssColor(hex: string, alphaHex = '00'): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return `&H${alphaHex}FFFFFF`;
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, ' ');
}

function wrapBengaliLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatAssTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function buildAssSubtitleContent(options: {
  proverb: ProverbRow;
  durationSec: number;
  textColor: string;
  meaningColor: string;
}): string {
  const { proverb, durationSec, textColor, meaningColor } = options;

  const proverbLines = wrapBengaliLines(`“${proverb.text_bn.trim()}”`, 22);
  const meaningLines = wrapBengaliLines(proverb.meaning_bn.trim(), 30);

  const proverbBlockHeight = proverbLines.length * 88;
  const meaningBlockHeight = meaningLines.length * 56;
  const totalHeight = proverbBlockHeight + 70 + meaningBlockHeight;

  // Center vertically inside upper-middle safe zone (around y=880 of 1920)
  const centerX = 520; // Slightly left of 540 to avoid Facebook Reels right-side action buttons
  const topStartY = Math.round(880 - totalHeight / 2);
  const proverbCenterY = Math.round(topStartY + proverbBlockHeight / 2);
  const dividerY = topStartY + proverbBlockHeight + 28;
  const meaningCenterY = Math.round(dividerY + 42 + meaningBlockHeight / 2);
  const kickerY = Math.max(380, topStartY - 76);

  const primaryAss = hexToAssColor(textColor);
  const meaningAss = hexToAssColor(meaningColor);
  const endTime = formatAssTime(durationSec);

  const proverbEscaped = proverbLines.map(escapeAssText).join('\\N');
  const meaningEscaped = meaningLines.map(escapeAssText).join('\\N');
  const categoryEscaped = escapeAssText(proverb.category || 'বাংলা প্রবাদ');

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kicker,Noto Sans Bengali,30,&H00D4D4D8,&H000000FF,&H80000000,&H00000000,1,0,0,0,100,100,2,0,1,2,1,5,80,120,80,1
Style: Proverb,Noto Sans Bengali,68,${primaryAss},&H000000FF,&HAA000000,&H64000000,1,0,0,0,100,100,0,0,1,3.5,2.5,5,80,120,80,1
Style: Meaning,Noto Sans Bengali,42,${meaningAss},&H000000FF,&HAA000000,&H64000000,0,0,0,0,100,100,0,0,1,2.8,2,5,80,120,80,1
Style: Brand,Noto Sans Bengali,28,&H33FFFFFF,&H000000FF,&H60000000,&H00000000,0,0,0,0,100,100,1,0,1,1.5,0,5,80,120,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.15,${endTime},Kicker,,0,0,0,,{\\an5\\pos(${centerX},${kickerY})\\fad(600,400)}${categoryEscaped}
Dialogue: 1,0:00:00.25,${endTime},Proverb,,0,0,0,,{\\an5\\pos(${centerX},${proverbCenterY})\\fad(800,400)}${proverbEscaped}
Dialogue: 2,0:00:00.90,${endTime},Meaning,,0,0,0,,{\\an5\\pos(${centerX},${meaningCenterY})\\fad(850,400)}${meaningEscaped}
Dialogue: 0,0:00:00.40,${endTime},Brand,,0,0,0,,{\\an5\\pos(${centerX},1560)\\fad(600,400)}বাংলা প্রবাদ-প্রবচন
`;
}

export function pickRandomAsset(type: 'video' | 'music', preferredId?: number): MediaAssetRow {
  if (preferredId) {
    const exact = db
      .prepare('SELECT * FROM media_assets WHERE id = ? AND type = ?')
      .get(preferredId, type) as MediaAssetRow | undefined;
    if (exact && fs.existsSync(exact.file_path)) return exact;
  }

  const all = db
    .prepare('SELECT * FROM media_assets WHERE type = ?')
    .all(type) as MediaAssetRow[];
  const existing = all.filter((a) => fs.existsSync(a.file_path));

  if (existing.length === 0) {
    throw new Error(`No ${type} assets available in library. Please upload at least one ${type} file.`);
  }

  return existing[Math.floor(Math.random() * existing.length)];
}

export async function renderReelVideo(options: {
  proverb: ProverbRow;
  voiceoverPath: string;
  settings: AutomationSettings;
  outputPath: string;
  videoAssetId?: number;
  musicAssetId?: number;
}): Promise<{
  outputPath: string;
  durationSec: number;
  videoAssetName: string;
  musicAssetName: string;
}> {
  await ensureDefaultMediaAssets();

  const videoAsset = pickRandomAsset('video', options.videoAssetId);
  const musicAsset = pickRandomAsset('music', options.musicAssetId);

  const voiceDur = await probeDuration(options.voiceoverPath);
  const targetDuration = Number(Math.max(10, Math.min(30, voiceDur + 2.4)).toFixed(2));

  const assFilename = `overlay_${options.proverb.id}_${Date.now()}.ass`;
  const assPath = path.join(DIRS.temp, assFilename);
  const assContent = buildAssSubtitleContent({
    proverb: options.proverb,
    durationSec: targetDuration,
    textColor: options.settings.text_color || '#FFFFFF',
    meaningColor: options.settings.meaning_color || '#FACC15',
  });
  fs.writeFileSync(assPath, assContent, 'utf-8');

  const musicVol = Math.max(0, Math.min(1, parseFloat(options.settings.music_volume) || 0.15));
  const overlayOpacity = Math.max(0, Math.min(0.85, parseFloat(options.settings.overlay_opacity) || 0.54));

  // Use relative path from cwd for FFmpeg libass filter so colons/paths stay clean
  const relAssPath = path.relative(process.cwd(), assPath).replace(/\\/g, '/').replace(/:/g, '\\:');

  const fadeOutStart = Math.max(1, Number((targetDuration - 1.8).toFixed(2)));
  const filterComplex = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=black@${overlayOpacity}:t=fill,ass='${relAssPath}'[vout]`,
    `[1:a]adelay=600|600,apad=whole_dur=${targetDuration},volume=1.0[voice]`,
    `[2:a]atrim=0:${targetDuration},asetpts=PTS-STARTPTS,volume=${musicVol},afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeOutStart}:d=1.8[bgm]`,
    `[voice][bgm]amix=inputs=2:duration=first:normalize=0[aout]`,
  ].join(';');

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-stream_loop',
        '-1',
        '-i',
        videoAsset.file_path,
        '-i',
        options.voiceoverPath,
        '-stream_loop',
        '-1',
        '-i',
        musicAsset.file_path,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-map',
        '[aout]',
        '-t',
        String(targetDuration),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ar',
        '44100',
        '-movflags',
        '+faststart',
        options.outputPath,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
  } finally {
    if (fs.existsSync(assPath)) {
      fs.unlinkSync(assPath);
    }
  }

  return {
    outputPath: options.outputPath,
    durationSec: targetDuration,
    videoAssetName: videoAsset.original_name,
    musicAssetName: musicAsset.original_name,
  };
}
