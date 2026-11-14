export interface Proverb {
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

export interface MediaAsset {
  id: number;
  type: 'video' | 'music';
  filename: string;
  original_name: string;
  file_path: string;
  duration_sec: number;
  file_size: number;
  is_default: number;
  created_at: string;
  url: string;
}

export interface RenderLog {
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
  previewUrl?: string | null;
}

export interface OverviewData {
  counts: {
    total: number;
    pending: number;
    posted: number;
    failed: number;
  };
  mediaCounts: {
    videos: number;
    music: number;
  };
  nextPending: Proverb | null;
  latestPreview: (RenderLog & { previewUrl: string }) | null;
  recentLogs: RenderLog[];
  scheduler: {
    active: boolean;
    expression: string;
    timezone: string;
    lastRunAt: string | null;
    isBusy: boolean;
  };
  credentials: {
    elevenLabsConfigured: boolean;
    facebookConfigured: boolean;
    ttsProvider: string;
  };
}

export interface SettingsPayload {
  settings: {
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
    fb_page_access_token_masked: string;
    has_fb_token: boolean;
    reel_hashtags: string;
    last_run_at: string;
  };
  envStatus: {
    edgeTtsVoice?: string;
    elevenLabsConfigured: boolean;
    elevenLabsVoiceConfigured: boolean;
  };
  scheduler: {
    active: boolean;
    expression: string;
    timezone: string;
  };
}
