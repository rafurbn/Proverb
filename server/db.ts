import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface ProverbRow {
  id: number;
  text_bn: string;
  meaning_bn: string;
  category: string;
  status: 'pending' | 'posted' | 'failed';
  posted_at: string | null;
  fb_post_id: string | null;
  last_error: string | null;
  created_at: string;
}

export interface MediaAssetRow {
  id: number;
  type: 'video' | 'music';
  filename: string;
  original_name: string;
  file_path: string;
  duration_sec: number;
  file_size: number;
  is_default: number;
  created_at: string;
}

export interface RenderLogRow {
  id: number;
  proverb_id: number | null;
  proverb_text: string;
  mode: 'preview' | 'publish';
  status: 'rendering' | 'rendered' | 'published' | 'failed';
  tts_provider: string;
  video_asset: string | null;
  music_asset: string | null;
  output_filename: string | null;
  fb_reel_id: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface AutomationSettings {
  cron_expression: string;
  cron_timezone: string;
  cron_enabled: string;
  tts_provider: 'edge-tts' | 'elevenlabs';
  tts_voice: string;
  music_volume: string;
  overlay_opacity: string;
  text_color: string;
  meaning_color: string;
  fb_page_id: string;
  fb_page_access_token: string;
  reel_hashtags: string;
  last_run_at: string;
}

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const DIRS = {
  storage: STORAGE_DIR,
  videos: path.join(STORAGE_DIR, 'videos'),
  music: path.join(STORAGE_DIR, 'music'),
  previews: path.join(STORAGE_DIR, 'previews'),
  temp: path.join(STORAGE_DIR, 'temp'),
};

for (const dir of Object.values(DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const DB_PATH = path.join(STORAGE_DIR, 'probad.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS proverbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_bn TEXT NOT NULL,
    meaning_bn TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'প্রজ্ঞা',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'posted', 'failed')),
    posted_at TEXT,
    fb_post_id TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('video', 'music')),
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_sec REAL NOT NULL DEFAULT 12,
    file_size INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS render_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proverb_id INTEGER,
    proverb_text TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('preview', 'publish')),
    status TEXT NOT NULL CHECK(status IN ('rendering', 'rendered', 'published', 'failed')),
    tts_provider TEXT NOT NULL,
    video_asset TEXT,
    music_asset TEXT,
    output_filename TEXT,
    fb_reel_id TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const DEFAULT_SETTINGS: AutomationSettings = {
  cron_expression: process.env.DAILY_CRON_SCHEDULE || '0 9 * * *',
  cron_timezone: process.env.CRON_TIMEZONE || 'Asia/Dhaka',
  cron_enabled: 'true',
  tts_provider: 'edge-tts',
  tts_voice: 'bn-BD-NabanitaNeural',
  music_volume: '0.15',
  overlay_opacity: '0.54',
  text_color: '#FFFFFF',
  meaning_color: '#FACC15',
  fb_page_id: process.env.FB_PAGE_ID && process.env.FB_PAGE_ID !== 'YOUR_FACEBOOK_PAGE_ID' ? process.env.FB_PAGE_ID : '',
  fb_page_access_token:
    process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ACCESS_TOKEN !== 'YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN'
      ? process.env.FB_PAGE_ACCESS_TOKEN
      : '',
  reel_hashtags: '#বাংলাপ্রবাদ #BengaliProverbs #BanglaQuotes #Reels',
  last_run_at: '',
};

const insertSettingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  insertSettingStmt.run(k, v);
}
db.prepare("UPDATE settings SET value = 'edge-tts' WHERE key = 'tts_provider'").run();
db.prepare("UPDATE settings SET value = 'bn-BD-NabanitaNeural' WHERE key = 'tts_voice'").run();

const INITIAL_PROVERBS: Array<{ text_bn: string; meaning_bn: string; category: string }> = [
  {
    text_bn: 'অল্প বিদ্যা ভয়ংকরী',
    meaning_bn: 'আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।',
    category: 'জ্ঞান ও শিক্ষা',
  },
  {
    text_bn: 'দশে মিলে করি কাজ, হারি জিতি নাহি লাজ',
    meaning_bn: 'একসাথে মিলেমিশে কাজ করলে সাফল্য আসে এবং ব্যর্থতাতেও গ্লানি থাকে না।',
    category: 'একতা',
  },
  {
    text_bn: 'সময়ের এক ফোঁড়, অসময়ের দশ ফোঁড়',
    meaning_bn: 'সঠিক সময়ে ছোট উদ্যোগ নিলে ভবিষ্যতের বড় ঝামেলা এড়ানো যায়।',
    category: 'সময়ানুবর্তিতা',
  },
  {
    text_bn: 'যেমন কর্ম তেমন ফল',
    meaning_bn: 'মানুষ তার নিজের কাজের অনুরূপ ফলাফলই ভোগ করে।',
    category: 'কর্মফল',
  },
  {
    text_bn: 'যত গর্জে তত বর্ষে না',
    meaning_bn: 'যারা বেশি বড় বড় কথা বলে, তারা কাজের সময় তেমন কিছু করতে পারে না।',
    category: 'আচরণ',
  },
  {
    text_bn: 'নানা মুনির নানা মত',
    meaning_bn: 'ভিন্ন ভিন্ন মানুষের চিন্তাভাবনা ও মতামত আলাদা হয়ে থাকে।',
    category: 'জীবনদর্শন',
  },
  {
    text_bn: 'চকচক করলেই সোনা হয় না',
    meaning_bn: 'বাইরের চাকচিক্য দেখে সবসময় ভেতরের আসল গুণ বিচার করা যায় না।',
    category: 'বাস্তবতা',
  },
  {
    text_bn: 'অতি লোভে তাঁতি নষ্ট',
    meaning_bn: 'অতিরিক্ত লোভ করতে গেলে হাতের পাওয়া জিনিসও হারাতে হয়।',
    category: 'সতর্কতা',
  },
  {
    text_bn: 'এক হাতে তালি বাজে না',
    meaning_bn: 'কোনো বিবাদ বা সমস্যার জন্য সাধারণত দুই পক্ষেরই দায় থাকে।',
    category: 'সম্পর্ক',
  },
  {
    text_bn: 'সৎ সঙ্গে স্বর্গবাস, অসৎ সঙ্গে সর্বনাশ',
    meaning_bn: 'ভালো মানুষের সঙ্গ জীবনকে উন্নত করে, আর খারাপ সঙ্গ ধ্বংস ডেকে আনে।',
    category: 'নীতিবাক্য',
  },
  {
    text_bn: 'পরিশ্রমই সৌভাগ্যের প্রসূতি',
    meaning_bn: 'কঠোর পরিশ্রমের মাধ্যমেই জীবনে প্রকৃত সাফল্য ও সৌভাগ্য আসে।',
    category: 'উদ্যম',
  },
  {
    text_bn: 'বিপদে ধৈর্য ধারণ করাই প্রকৃত বীরত্ব',
    meaning_bn: 'কঠিন সময়ে শান্ত থেকে পরিস্থিতি সামাল দেওয়াই মানুষের বড় গুণ।',
    category: 'সাহস',
  },
];

const proverbCount = db.prepare('SELECT COUNT(*) as count FROM proverbs').get() as { count: number };
if (proverbCount.count === 0) {
  const insertProverb = db.prepare(
    'INSERT INTO proverbs (text_bn, meaning_bn, category, status) VALUES (?, ?, ?, ?)'
  );
  const seedMany = db.transaction((items: typeof INITIAL_PROVERBS) => {
    for (const item of items) {
      insertProverb.run(item.text_bn, item.meaning_bn, item.category, 'pending');
    }
  });
  seedMany(INITIAL_PROVERBS);
}

export function getSettings(): AutomationSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map as unknown as AutomationSettings;
}

export function updateSettings(partial: Partial<AutomationSettings>): AutomationSettings {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries: Array<[string, string]>) => {
    for (const [k, v] of entries) {
      upsert.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(partial).filter(([, v]) => v !== undefined) as Array<[string, string]>);
  return getSettings();
}
