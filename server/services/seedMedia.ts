import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { db, DIRS } from '../db.ts';

const execFileAsync = promisify(execFile);

export async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const parsed = parseFloat(stdout.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  } catch {
    return 12;
  }
}

async function generateVerticalClipFromImage(
  imagePath: string,
  outputPath: string,
  durationSec = 12
): Promise<void> {
  const frames = durationSec * 30;
  // Subtle slow cinematic zoom-in (1.0 -> 1.08) at 1080x1920 30fps
  await execFileAsync('ffmpeg', [
    '-y',
    '-loop',
    '1',
    '-i',
    imagePath,
    '-vf',
    `scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='min(zoom+0.00025,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`,
    '-t',
    String(durationSec),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-an',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function generateAmbientTrack(
  outputPath: string,
  freqs: [number, number, number],
  durationSec = 18
): Promise<void> {
  const [f1, f2, f3] = freqs;
  const expr = `0.28*sin(2*PI*${f1}*t)+0.22*sin(2*PI*${f2}*t)+0.16*sin(2*PI*${f3}*t)+0.08*sin(2*PI*${f1 * 0.5}*t)*(0.5+0.5*sin(2*PI*0.18*t))`;
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='${expr}':s=44100:d=${durationSec}`,
    '-af',
    `lowpass=f=850,aecho=0.8:0.88:60:0.4,afade=t=in:st=0:d=1.5,afade=t=out:st=${durationSec - 2}:d=2`,
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

let seedingPromise: Promise<void> | null = null;

export function ensureDefaultMediaAssets(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const videoCount = (
        db.prepare("SELECT COUNT(*) as count FROM media_assets WHERE type = 'video'").get() as { count: number }
      ).count;

      const defaultVideos = [
        {
          image: path.resolve(process.cwd(), 'src/assets/images/bg_bengal_river_dawn_1794630796392.jpg'),
          filename: 'default_bengal_river_dawn.mp4',
          originalName: 'Bengal River Dawn (1080x1920 Nature Loop)',
        },
        {
          image: path.resolve(process.cwd(), 'src/assets/images/bg_monsoon_foliage_1794630797888.jpg'),
          filename: 'default_monsoon_foliage.mp4',
          originalName: 'Monsoon Bamboo Mist (1080x1920 Nature Loop)',
        },
      ];

      if (videoCount === 0) {
        const insertAsset = db.prepare(
          `INSERT OR IGNORE INTO media_assets (type, filename, original_name, file_path, duration_sec, file_size, is_default)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        );

        for (const v of defaultVideos) {
          if (!fs.existsSync(v.image)) continue;
          const outPath = path.join(DIRS.videos, v.filename);
          if (!fs.existsSync(outPath)) {
            await generateVerticalClipFromImage(v.image, outPath, 12);
          }
          const stat = fs.statSync(outPath);
          const dur = await probeDuration(outPath);
          insertAsset.run('video', v.filename, v.originalName, outPath, dur, stat.size);
        }
      }

      const musicCount = (
        db.prepare("SELECT COUNT(*) as count FROM media_assets WHERE type = 'music'").get() as { count: number }
      ).count;

      if (musicCount === 0) {
        const defaultMusic: Array<{
          filename: string;
          originalName: string;
          freqs: [number, number, number];
        }> = [
          {
            filename: 'default_tanpura_dawn.wav',
            originalName: 'Soft Morning Tanpura Pad (Ambient)',
            freqs: [146.83, 220.0, 293.66],
          },
          {
            filename: 'default_calm_bamboo_drone.wav',
            originalName: 'Gentle Flute & Rain Pad (Ambient)',
            freqs: [174.61, 261.63, 349.23],
          },
        ];

        const insertMusic = db.prepare(
          `INSERT OR IGNORE INTO media_assets (type, filename, original_name, file_path, duration_sec, file_size, is_default)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        );

        for (const m of defaultMusic) {
          const outPath = path.join(DIRS.music, m.filename);
          if (!fs.existsSync(outPath)) {
            await generateAmbientTrack(outPath, m.freqs, 18);
          }
          const stat = fs.statSync(outPath);
          const dur = await probeDuration(outPath);
          insertMusic.run('music', m.filename, m.originalName, outPath, dur, stat.size);
        }
      }
    } catch (err) {
      console.error('[seedMedia] Failed generating default media assets:', err);
    }
  })();

  return seedingPromise;
}
