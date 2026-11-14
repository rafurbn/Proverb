import { CheckCircle2, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { RenderLog, SettingsPayload } from '../types.ts';

interface SchedulerSettingsProps {
  logs: RenderLog[];
  onSettingsUpdated: () => Promise<void>;
}

export const SchedulerSettings: React.FC<SchedulerSettingsProps> = ({
  logs,
  onSettingsUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cronEnabled, setCronEnabled] = useState(true);
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [cronTimezone, setCronTimezone] = useState('Asia/Dhaka');
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [overlayOpacity, setOverlayOpacity] = useState(0.54);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [meaningColor, setMeaningColor] = useState('#FACC15');
  const [fbPageId, setFbPageId] = useState('');
  const [fbTokenInput, setFbTokenInput] = useState('');
  const [fbTokenMasked, setFbTokenMasked] = useState('');
  const [reelHashtags, setReelHashtags] = useState('#বাংলাপ্রবাদ #BengaliProverbs #BanglaQuotes #Reels');
  const [envStatus, setEnvStatus] = useState<{
    edgeTtsVoice?: string;
    elevenLabsConfigured: boolean;
    elevenLabsVoiceConfigured: boolean;
  }>({
    edgeTtsVoice: 'bn-BD-NabanitaNeural',
    elevenLabsConfigured: false,
    elevenLabsVoiceConfigured: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = (await res.json()) as SettingsPayload;
        setCronEnabled(data.settings.cron_enabled === 'true');
        setCronExpression(data.settings.cron_expression || '0 9 * * *');
        setCronTimezone(data.settings.cron_timezone || 'Asia/Dhaka');
        setMusicVolume(parseFloat(data.settings.music_volume) || 0.15);
        setOverlayOpacity(parseFloat(data.settings.overlay_opacity) || 0.54);
        setTextColor(data.settings.text_color || '#FFFFFF');
        setMeaningColor(data.settings.meaning_color || '#FACC15');
        setFbPageId(data.settings.fb_page_id || '');
        setFbTokenMasked(data.settings.fb_page_access_token_masked || '');
        setReelHashtags(data.settings.reel_hashtags || '');
        setEnvStatus(data.envStatus);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);
    setErrorMsg(null);

    try {
      const payload: Record<string, string> = {
        cron_enabled: cronEnabled ? 'true' : 'false',
        cron_expression: cronExpression.trim(),
        cron_timezone: cronTimezone,
        music_volume: String(musicVolume),
        overlay_opacity: String(overlayOpacity),
        text_color: textColor,
        meaning_color: meaningColor,
        fb_page_id: fbPageId.trim(),
        reel_hashtags: reelHashtags.trim(),
      };
      if (fbTokenInput.trim()) {
        payload.fb_page_access_token = fbTokenInput.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      if (data.settings?.fb_page_access_token_masked) {
        setFbTokenMasked(data.settings.fb_page_access_token_masked);
      }
      setFbTokenInput('');
      setSavedNotice('Automation schedule, audio mix, and Meta API settings saved.');
      await onSettingsUpdated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-xs text-zinc-500">
        Loading automation settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cron Schedule & Audio/Video Rendering Mix */}
        <section className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-zinc-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Daily Cron & FFmpeg Render Mix</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Schedules automatic proverb picking, voice synthesis, rendering, and Reel cleanup.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={cronEnabled}
                onChange={(e) => setCronEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-700 rounded"
              />
              Auto-Run Active
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full h-10 px-3 text-xs font-mono-nums bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
              <p className="mt-1 text-[11px] text-zinc-500">Default: 0 9 * * * (Daily 9:00 AM)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Timezone</label>
              <select
                value={cronTimezone}
                onChange={(e) => setCronTimezone(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              >
                <option value="Asia/Dhaka">Asia/Dhaka (UTC+6)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-800">
                Primary Voiceover: Microsoft Edge TTS (
                <code className="font-mono-nums">{envStatus.edgeTtsVoice || 'bn-BD-NabanitaNeural'}</code>)
              </span>
              <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">
                Active (Free · bn-BD)
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Secondary Fallback: ElevenLabs (<code className="font-mono-nums">eleven_multilingual_v2</code>){' '}
              —{' '}
              {envStatus.elevenLabsConfigured && envStatus.elevenLabsVoiceConfigured ? (
                <span className="text-emerald-700 font-medium">fallback configured</span>
              ) : (
                <span>
                  optional (<code className="font-mono-nums">ELEVENLABS_API_KEY</code>{' '}
                  {envStatus.elevenLabsConfigured ? 'set' : 'not set'},{' '}
                  <code className="font-mono-nums">ELEVENLABS_VOICE_ID</code>{' '}
                  {envStatus.elevenLabsVoiceConfigured ? 'set' : 'not set'})
                </span>
              )}
              .
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-700">Background Music Volume</label>
                <span className="text-xs font-mono-nums text-zinc-600">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-700">Dark Contrast Overlay</label>
                <span className="text-xs font-mono-nums text-zinc-600">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.02"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Proverb Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                />
                <span className="text-xs font-mono-nums text-zinc-600">{textColor}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Meaning Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={meaningColor}
                  onChange={(e) => setMeaningColor(e.target.value)}
                  className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                />
                <span className="text-xs font-mono-nums text-zinc-600">{meaningColor}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Meta Facebook Page Reels API Credentials */}
        <section className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div className="border-b border-zinc-100 pb-4">
              <h2 className="text-base font-semibold text-zinc-950">
                Meta Graph API — Facebook Page Reels
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Credentials for automatic 3-step Reels publishing via Graph API v21.0.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Facebook Page ID (<code className="font-mono-nums">PAGE_ID</code>)
              </label>
              <input
                type="text"
                value={fbPageId}
                onChange={(e) => setFbPageId(e.target.value)}
                placeholder="e.g. 104928374650192"
                className="w-full h-10 px-3 text-xs font-mono-nums bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Long-Lived Page Access Token (<code className="font-mono-nums">PAGE_ACCESS_TOKEN</code>)
              </label>
              <input
                type="password"
                value={fbTokenInput}
                onChange={(e) => setFbTokenInput(e.target.value)}
                placeholder={
                  fbTokenMasked
                    ? `Saved: ${fbTokenMasked} (enter new token to replace)`
                    : 'Paste your EAA... Page Access Token'
                }
                className="w-full h-10 px-3 text-xs font-mono-nums bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Requires permissions: <span className="font-mono-nums">pages_show_list</span>,{' '}
                <span className="font-mono-nums">pages_manage_posts</span>, and{' '}
                <span className="font-mono-nums">publish_video</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Default Reel Caption Hashtags
              </label>
              <input
                type="text"
                value={reelHashtags}
                onChange={(e) => setReelHashtags(e.target.value)}
                className="w-full h-10 px-3 text-xs font-bengali bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {errorMsg}
              </div>
            )}
            {savedNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                {savedNotice}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </section>
      </form>

      {/* Full Pipeline Execution Logs */}
      <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-950">Automation Execution History</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No execution history recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 bg-zinc-50/50">
                  <th className="py-3 px-4">Run</th>
                  <th className="py-3 px-4">Proverb</th>
                  <th className="py-3 px-4">TTS Engine</th>
                  <th className="py-3 px-4">Assets Used</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/70">
                    <td className="py-3 px-4 font-mono-nums text-zinc-500">
                      #{log.id} · {log.mode}
                    </td>
                    <td className="py-3 px-4 font-bengali font-medium text-zinc-900 max-w-xs truncate">
                      {log.proverb_text}
                    </td>
                    <td className="py-3 px-4 font-mono-nums text-zinc-600">{log.tts_provider}</td>
                    <td className="py-3 px-4 text-zinc-600 max-w-xs truncate">
                      {log.video_asset || '—'} · {log.music_asset || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${
                          log.status === 'published' || log.status === 'rendered'
                            ? 'text-emerald-700'
                            : log.status === 'failed'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {log.status}
                      </span>
                      {log.fb_reel_id && (
                        <span className="ml-1.5 font-mono-nums text-[11px] text-zinc-400">
                          · FB {log.fb_reel_id}
                        </span>
                      )}
                      {log.error_message && (
                        <p className="mt-0.5 text-[11px] text-rose-700 max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-nums text-zinc-500">
                      {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
