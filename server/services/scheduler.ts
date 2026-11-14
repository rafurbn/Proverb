import fs from 'fs';
import cron, { ScheduledTask } from 'node-cron';
import path from 'path';
import { db, DIRS, getSettings, ProverbRow, updateSettings } from '../db.ts';
import { publishFacebookReel } from './facebook.ts';
import { generateBengaliVoiceover } from './tts.ts';
import { renderReelVideo } from './videoEngine.ts';

let activeTask: ScheduledTask | null = null;
let isPipelineRunning = false;

export interface PipelineRunResult {
  logId: number;
  proverb: ProverbRow;
  mode: 'preview' | 'publish';
  status: 'rendered' | 'published';
  outputFilename: string | null;
  previewUrl: string | null;
  fbReelId: string | null;
  durationMs: number;
}

export function isAutomationBusy(): boolean {
  return isPipelineRunning;
}

export async function runReelPipeline(options: {
  mode: 'preview' | 'publish';
  proverbId?: number;
  videoAssetId?: number;
  musicAssetId?: number;
}): Promise<PipelineRunResult> {
  if (isPipelineRunning) {
    throw new Error('A video rendering job is already in progress. Please wait for it to finish.');
  }

  isPipelineRunning = true;
  const startedAt = Date.now();
  const settings = getSettings();

  let proverb: ProverbRow | undefined;
  if (options.proverbId) {
    proverb = db.prepare('SELECT * FROM proverbs WHERE id = ?').get(options.proverbId) as
      | ProverbRow
      | undefined;
  } else {
    proverb = db
      .prepare("SELECT * FROM proverbs WHERE status = 'pending' ORDER BY id ASC LIMIT 1")
      .get() as ProverbRow | undefined;
  }

  if (!proverb) {
    isPipelineRunning = false;
    throw new Error('No pending Bengali proverbs left in the queue. Upload or add more proverbs.');
  }

  const insertLog = db.prepare(
    `INSERT INTO render_logs (proverb_id, proverb_text, mode, status, tts_provider)
     VALUES (?, ?, ?, 'rendering', 'edge-tts')`
  );
  const logInfo = insertLog.run(proverb.id, proverb.text_bn, options.mode);
  const logId = Number(logInfo.lastInsertRowid);

  const timestamp = Date.now();
  const voiceBase = path.join(DIRS.temp, `voice_${proverb.id}_${timestamp}`);
  const outputFilename = `reel_${proverb.id}_${timestamp}.mp4`;
  const outputPath =
    options.mode === 'preview'
      ? path.join(DIRS.previews, outputFilename)
      : path.join(DIRS.temp, outputFilename);

  let voiceoverFilePath: string | null = null;

  try {
    // 1. Generate Bengali AI Voiceover via Edge TTS (bn-BD-NabanitaNeural) with ElevenLabs fallback
    const tts = await generateBengaliVoiceover({
      proverbBn: proverb.text_bn,
      meaningBn: proverb.meaning_bn,
      outputPathWithoutExt: voiceBase,
    });
    voiceoverFilePath = tts.filePath;

    // 2. Render 1080x1920 MP4 Reel via FFmpeg
    const rendered = await renderReelVideo({
      proverb,
      voiceoverPath: voiceoverFilePath,
      settings,
      outputPath,
      videoAssetId: options.videoAssetId,
      musicAssetId: options.musicAssetId,
    });

    // Clean up temporary voiceover file immediately
    if (voiceoverFilePath && fs.existsSync(voiceoverFilePath)) {
      fs.unlinkSync(voiceoverFilePath);
      voiceoverFilePath = null;
    }

    let fbReelId: string | null = null;
    let finalStatus: 'rendered' | 'published' = 'rendered';

    if (options.mode === 'publish') {
      // 3. Publish Reel to Facebook Page via Meta Graph API
      const caption = `${proverb.text_bn}\n\nঅর্থ: ${proverb.meaning_bn}\n\n${settings.reel_hashtags}`;
      const fbResult = await publishFacebookReel({
        pageId: settings.fb_page_id,
        pageAccessToken: settings.fb_page_access_token,
        videoFilePath: outputPath,
        description: caption,
      });

      fbReelId = fbResult.videoId;
      finalStatus = 'published';

      // 4. Mark proverb as posted & delete temporary MP4 to save storage
      db.prepare(
        `UPDATE proverbs SET status = 'posted', posted_at = datetime('now'), fb_post_id = ?, last_error = NULL WHERE id = ?`
      ).run(fbReelId, proverb.id);

      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      updateSettings({ last_run_at: new Date().toISOString() });
    }

    const durationMs = Date.now() - startedAt;

    db.prepare(
      `UPDATE render_logs
       SET status = ?, tts_provider = ?, video_asset = ?, music_asset = ?, output_filename = ?, fb_reel_id = ?, duration_ms = ?
       WHERE id = ?`
    ).run(
      finalStatus,
      tts.providerUsed,
      rendered.videoAssetName,
      rendered.musicAssetName,
      options.mode === 'preview' ? outputFilename : null,
      fbReelId,
      durationMs,
      logId
    );

    const updatedProverb = db.prepare('SELECT * FROM proverbs WHERE id = ?').get(proverb.id) as ProverbRow;

    return {
      logId,
      proverb: updatedProverb,
      mode: options.mode,
      status: finalStatus,
      outputFilename: options.mode === 'preview' ? outputFilename : null,
      previewUrl: options.mode === 'preview' ? `/api/previews/${outputFilename}` : null,
      fbReelId,
      durationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    if (voiceoverFilePath && fs.existsSync(voiceoverFilePath)) {
      fs.unlinkSync(voiceoverFilePath);
    }
    if (options.mode === 'publish' && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    db.prepare(`UPDATE render_logs SET status = 'failed', error_message = ?, duration_ms = ? WHERE id = ?`).run(
      message,
      durationMs,
      logId
    );

    if (options.mode === 'publish') {
      db.prepare(`UPDATE proverbs SET last_error = ? WHERE id = ?`).run(message, proverb.id);
    }

    throw err;
  } finally {
    isPipelineRunning = false;
  }
}

export function reloadCronScheduler(): { active: boolean; expression: string; timezone: string } {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }

  const settings = getSettings();
  const enabled = settings.cron_enabled === 'true';
  const expression = settings.cron_expression || '0 9 * * *';
  const timezone = settings.cron_timezone || 'Asia/Dhaka';

  if (!enabled) {
    return { active: false, expression, timezone };
  }

  if (!cron.validate(expression)) {
    console.warn(`[scheduler] Invalid cron expression "${expression}". Falling back to 0 9 * * *.`);
  }

  const validExpr = cron.validate(expression) ? expression : '0 9 * * *';

  activeTask = cron.schedule(
    validExpr,
    async () => {
      console.log(`[scheduler] Triggering daily Bengali Proverb Reel job (${validExpr} ${timezone})...`);
      try {
        const res = await runReelPipeline({ mode: 'publish' });
        console.log(`[scheduler] Published proverb #${res.proverb.id} -> FB Reel ID: ${res.fbReelId}`);
      } catch (err) {
        console.error('[scheduler] Daily Reel automation error:', err);
      }
    },
    { timezone }
  );

  return { active: true, expression: validExpr, timezone };
}
