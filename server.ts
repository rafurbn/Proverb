import { parse as parseCsv } from 'csv-parse/sync';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import * as XLSX from 'xlsx';
import { db, DIRS, getSettings, type MediaAssetRow, type ProverbRow, type RenderLogRow, updateSettings } from './server/db.ts';
import { isAutomationBusy, reloadCronScheduler, runReelPipeline } from './server/services/scheduler.ts';
import { ensureDefaultMediaAssets, probeDuration } from './server/services/seedMedia.ts';

const PORT = Number(process.env.PORT) || 8080;

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const mediaType = req.body?.type === 'music' || file.mimetype.startsWith('audio/') ? 'music' : 'video';
      cb(null, mediaType === 'music' ? DIRS.music : DIRS.videos);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext.toLowerCase()}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 120 * 1024 * 1024 },
});

function extractProverbColumns(row: Record<string, unknown>): {
  text_bn: string;
  meaning_bn: string;
  category: string;
} | null {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = String(val ?? '').trim();
  }

  const text_bn =
    normalized['text_bn'] ||
    normalized['proverb'] ||
    normalized['proverb_bn'] ||
    normalized['bangla_proverb'] ||
    normalized['প্রবাদ'] ||
    normalized['প্রবাদ-প্রবচন'] ||
    Object.values(normalized)[0] ||
    '';

  const meaning_bn =
    normalized['meaning_bn'] ||
    normalized['meaning'] ||
    normalized['explanation'] ||
    normalized['অর্থ'] ||
    normalized['সরল অর্থ'] ||
    Object.values(normalized)[1] ||
    '';

  const category =
    normalized['category'] ||
    normalized['tag'] ||
    normalized['topic'] ||
    normalized['ধরন'] ||
    normalized['বিষয়'] ||
    'প্রজ্ঞা';

  if (!text_bn || !meaning_bn) return null;
  return { text_bn, meaning_bn, category: category || 'প্রজ্ঞা' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Start generating default sample 9:16 nature videos & ambient tracks asynchronously
  void ensureDefaultMediaAssets();

  // Initialize daily cron scheduler
  let schedulerStatus = reloadCronScheduler();

  // --- Overview & Dashboard Summary ---
  app.get('/api/overview', async (_req, res) => {
    await ensureDefaultMediaAssets();
    const counts = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM proverbs`
      )
      .get() as { total: number; pending: number; posted: number; failed: number };

    const mediaCounts = db
      .prepare(
        `SELECT
          SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) as videos,
          SUM(CASE WHEN type = 'music' THEN 1 ELSE 0 END) as music
        FROM media_assets`
      )
      .get() as { videos: number; music: number };

    const nextPending = db
      .prepare("SELECT * FROM proverbs WHERE status = 'pending' ORDER BY id ASC LIMIT 1")
      .get() as ProverbRow | undefined;

    const latestPreview = db
      .prepare(
        "SELECT * FROM render_logs WHERE mode = 'preview' AND status = 'rendered' AND output_filename IS NOT NULL ORDER BY id DESC LIMIT 1"
      )
      .get() as RenderLogRow | undefined;

    const recentLogs = db.prepare('SELECT * FROM render_logs ORDER BY id DESC LIMIT 8').all() as RenderLogRow[];
    const settings = getSettings();

    res.json({
      counts: {
        total: counts.total || 0,
        pending: counts.pending || 0,
        posted: counts.posted || 0,
        failed: counts.failed || 0,
      },
      mediaCounts: {
        videos: mediaCounts.videos || 0,
        music: mediaCounts.music || 0,
      },
      nextPending: nextPending || null,
      latestPreview:
        latestPreview && latestPreview.output_filename && fs.existsSync(path.join(DIRS.previews, latestPreview.output_filename))
          ? {
              ...latestPreview,
              previewUrl: `/api/previews/${latestPreview.output_filename}`,
            }
          : null,
      recentLogs,
      scheduler: {
        ...schedulerStatus,
        lastRunAt: settings.last_run_at || null,
        isBusy: isAutomationBusy(),
      },
      credentials: {
        elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
        facebookConfigured: Boolean(settings.fb_page_id && settings.fb_page_access_token),
        ttsProvider: 'edge-tts',
      },
    });
  });

  // --- Proverbs CRUD & Bulk CSV/Excel Upload ---
  app.get('/api/proverbs', (req, res) => {
    const status = String(req.query.status || 'all');
    const search = String(req.query.q || '').trim();

    let sql = 'SELECT * FROM proverbs';
    const params: string[] = [];
    const clauses: string[] = [];

    if (status !== 'all' && ['pending', 'posted', 'failed'].includes(status)) {
      clauses.push('status = ?');
      params.push(status);
    }

    if (search) {
      clauses.push('(text_bn LIKE ? OR meaning_bn LIKE ? OR category LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (clauses.length > 0) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }
    sql += ' ORDER BY CASE WHEN status = "pending" THEN 0 ELSE 1 END, id ASC';

    const rows = db.prepare(sql).all(...params) as ProverbRow[];
    res.json({ proverbs: rows });
  });

  app.post('/api/proverbs', (req, res) => {
    const text_bn = String(req.body?.text_bn || '').trim();
    const meaning_bn = String(req.body?.meaning_bn || '').trim();
    const category = String(req.body?.category || 'প্রজ্ঞা').trim() || 'প্রজ্ঞা';

    if (!text_bn || !meaning_bn) {
      res.status(400).json({ error: 'Both Bengali proverb and 1-line meaning are required.' });
      return;
    }

    const info = db
      .prepare('INSERT INTO proverbs (text_bn, meaning_bn, category, status) VALUES (?, ?, ?, ?)')
      .run(text_bn, meaning_bn, category, 'pending');

    const created = db.prepare('SELECT * FROM proverbs WHERE id = ?').get(info.lastInsertRowid) as ProverbRow;
    res.status(201).json({ proverb: created });
  });

  app.post('/api/proverbs/bulk', uploadMemory.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Please upload a CSV or Excel (.xlsx/.xls) file.' });
      return;
    }

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      let rawRows: Array<Record<string, unknown>> = [];

      if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheet = workbook.SheetNames[0];
        if (firstSheet) {
          rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
            defval: '',
          });
        }
      } else {
        const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        rawRows = parseCsv(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, unknown>>;
      }

      const parsedItems = rawRows
        .map(extractProverbColumns)
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (parsedItems.length === 0) {
        res.status(400).json({
          error:
            'No valid rows found. Ensure your file has columns named "proverb" (or "text_bn") and "meaning" (or "meaning_bn").',
        });
        return;
      }

      const existingSet = new Set(
        (db.prepare('SELECT text_bn FROM proverbs').all() as Array<{ text_bn: string }>).map((r) =>
          r.text_bn.trim()
        )
      );

      const insertStmt = db.prepare(
        'INSERT INTO proverbs (text_bn, meaning_bn, category, status) VALUES (?, ?, ?, ?)'
      );

      let inserted = 0;
      let skippedDuplicates = 0;

      const tx = db.transaction(() => {
        for (const item of parsedItems) {
          if (existingSet.has(item.text_bn)) {
            skippedDuplicates++;
            continue;
          }
          existingSet.add(item.text_bn);
          insertStmt.run(item.text_bn, item.meaning_bn, item.category, 'pending');
          inserted++;
        }
      });
      tx();

      res.json({
        inserted,
        skippedDuplicates,
        totalProcessed: parsedItems.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse bulk upload file.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/proverbs/sample-csv', (_req, res) => {
    const csvRows = [
      'text_bn,meaning_bn,category',
      '"অতি চালাকের গলায় দড়ি","অতিরিক্ত চতুরতা করতে গেলে মানুষ নিজেই বিপদে পড়ে।","সতর্কতা"',
      '"আপন ভালো তো জগৎ ভালো","নিজে সৎ ও ভালো হলে চারপাশের পৃথিবীও সুন্দর মনে হয়।","জীবনদর্শন"',
      '"ঘর পোড়া গরু সিঁদুরে মেঘ দেখলে ভয় পায়","একবার বিপদে পড়লে মানুষ সামান্য লক্ষণ দেখেই আতঙ্কিত হয়।","অভিজ্ঞতা"',
    ];
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bengali-proverbs-template.csv"');
    res.send(bom + csvRows.join('\n'));
  });

  app.patch('/api/proverbs/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM proverbs WHERE id = ?').get(id) as ProverbRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Proverb not found.' });
      return;
    }

    const text_bn = req.body?.text_bn !== undefined ? String(req.body.text_bn).trim() : existing.text_bn;
    const meaning_bn =
      req.body?.meaning_bn !== undefined ? String(req.body.meaning_bn).trim() : existing.meaning_bn;
    const category = req.body?.category !== undefined ? String(req.body.category).trim() : existing.category;
    const status =
      req.body?.status && ['pending', 'posted', 'failed'].includes(req.body.status)
        ? req.body.status
        : existing.status;

    db.prepare(
      `UPDATE proverbs
       SET text_bn = ?, meaning_bn = ?, category = ?, status = ?,
           posted_at = CASE WHEN ? = 'pending' THEN NULL ELSE posted_at END,
           last_error = CASE WHEN ? = 'pending' THEN NULL ELSE last_error END
       WHERE id = ?`
    ).run(text_bn, meaning_bn, category, status, status, status, id);

    const updated = db.prepare('SELECT * FROM proverbs WHERE id = ?').get(id) as ProverbRow;
    res.json({ proverb: updated });
  });

  app.delete('/api/proverbs/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM proverbs WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // --- Media Assets Library (Background Videos & Music Tracks) ---
  app.get('/api/media', async (_req, res) => {
    await ensureDefaultMediaAssets();
    const assets = db.prepare('SELECT * FROM media_assets ORDER BY is_default ASC, id DESC').all() as MediaAssetRow[];
    res.json({
      assets: assets.map((a) => ({
        ...a,
        url: `/api/media/file/${a.type}/${encodeURIComponent(a.filename)}`,
      })),
    });
  });

  app.post('/api/media/upload', uploadMedia.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No media file received.' });
      return;
    }

    const mediaType: 'video' | 'music' =
      req.body?.type === 'music' || req.file.mimetype.startsWith('audio/') ? 'music' : 'video';
    const duration = await probeDuration(req.file.path);

    const info = db
      .prepare(
        `INSERT INTO media_assets (type, filename, original_name, file_path, duration_sec, file_size, is_default)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      )
      .run(mediaType, req.file.filename, req.file.originalname, req.file.path, duration, req.file.size);

    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(info.lastInsertRowid) as MediaAssetRow;
    res.status(201).json({
      asset: {
        ...asset,
        url: `/api/media/file/${asset.type}/${encodeURIComponent(asset.filename)}`,
      },
    });
  });

  app.get('/api/media/file/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const baseDir = type === 'music' ? DIRS.music : DIRS.videos;
    const safeFile = path.basename(filename);
    const fullPath = path.join(baseDir, safeFile);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Media not found');
      return;
    }
    res.sendFile(fullPath);
  });

  app.delete('/api/media/:id', (req, res) => {
    const id = Number(req.params.id);
    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as MediaAssetRow | undefined;
    if (!asset) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    if (fs.existsSync(asset.file_path)) {
      fs.unlinkSync(asset.file_path);
    }
    db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // --- Preview Video Streaming ---
  app.get('/api/previews/:filename', (req, res) => {
    const safeFile = path.basename(req.params.filename);
    const fullPath = path.join(DIRS.previews, safeFile);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Preview video not found');
      return;
    }
    res.sendFile(fullPath);
  });

  // --- Automation Settings & Scheduler ---
  app.get('/api/settings', (_req, res) => {
    const s = getSettings();
    res.json({
      settings: {
        ...s,
        fb_page_access_token_masked: s.fb_page_access_token
          ? `${s.fb_page_access_token.slice(0, 6)}••••••••${s.fb_page_access_token.slice(-4)}`
          : '',
        has_fb_token: Boolean(s.fb_page_access_token),
        fb_page_access_token: undefined,
      },
      envStatus: {
        edgeTtsVoice: 'bn-BD-NabanitaNeural',
        elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
        elevenLabsVoiceConfigured: Boolean(process.env.ELEVENLABS_VOICE_ID?.trim()),
      },
      scheduler: schedulerStatus,
    });
  });

  app.put('/api/settings', (req, res) => {
    const body = req.body || {};
    const updates: Record<string, string> = {};

    const allowedKeys = [
      'cron_expression',
      'cron_timezone',
      'cron_enabled',
      'music_volume',
      'overlay_opacity',
      'text_color',
      'meaning_color',
      'fb_page_id',
      'reel_hashtags',
    ];

    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        updates[k] = String(body[k]);
      }
    }

    if (typeof body.fb_page_access_token === 'string' && body.fb_page_access_token.trim()) {
      updates.fb_page_access_token = body.fb_page_access_token.trim();
    }

    const updated = updateSettings(updates);
    schedulerStatus = reloadCronScheduler();

    res.json({
      settings: {
        ...updated,
        fb_page_access_token_masked: updated.fb_page_access_token
          ? `${updated.fb_page_access_token.slice(0, 6)}••••••••${updated.fb_page_access_token.slice(-4)}`
          : '',
        has_fb_token: Boolean(updated.fb_page_access_token),
        fb_page_access_token: undefined,
      },
      scheduler: schedulerStatus,
    });
  });

  // --- Video Engine & Publishing Pipeline ---
  app.post('/api/pipeline/preview', async (req, res) => {
    try {
      const proverbId = req.body?.proverbId ? Number(req.body.proverbId) : undefined;
      const videoAssetId = req.body?.videoAssetId ? Number(req.body.videoAssetId) : undefined;
      const musicAssetId = req.body?.musicAssetId ? Number(req.body.musicAssetId) : undefined;

      const result = await runReelPipeline({
        mode: 'preview',
        proverbId,
        videoAssetId,
        musicAssetId,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preview rendering failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/pipeline/publish', async (req, res) => {
    try {
      const proverbId = req.body?.proverbId ? Number(req.body.proverbId) : undefined;
      const result = await runReelPipeline({
        mode: 'publish',
        proverbId,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Facebook Reels publishing failed.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/logs', (_req, res) => {
    const logs = db.prepare('SELECT * FROM render_logs ORDER BY id DESC LIMIT 30').all() as RenderLogRow[];
    res.json({
      logs: logs.map((l) => ({
        ...l,
        previewUrl:
          l.output_filename && fs.existsSync(path.join(DIRS.previews, l.output_filename))
            ? `/api/previews/${l.output_filename}`
            : null,
      })),
    });
  });

  // --- Vite Dev Middleware / Static Prod Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Probad Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
