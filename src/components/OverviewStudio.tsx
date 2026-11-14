import { Download, Film, Loader2, Play, Send, Volume2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MediaAsset, OverviewData, Proverb } from '../types.ts';

interface OverviewStudioProps {
  overview: OverviewData | null;
  proverbs: Proverb[];
  media: MediaAsset[];
  isRendering: boolean;
  isPublishing: boolean;
  activePreviewUrl: string | null;
  pipelineError: string | null;
  pipelineSuccess: string | null;
  onRenderPreview: (params: { proverbId?: number; videoAssetId?: number; musicAssetId?: number }) => void;
  onPublishNow: (proverbId?: number) => void;
  onNavigate: (tab: 'overview' | 'proverbs' | 'media' | 'scheduler' | 'guide') => void;
}

export const OverviewStudio: React.FC<OverviewStudioProps> = ({
  overview,
  proverbs,
  media,
  isRendering,
  isPublishing,
  activePreviewUrl,
  pipelineError,
  pipelineSuccess,
  onRenderPreview,
  onPublishNow,
  onNavigate,
}) => {
  const pendingProverbs = proverbs.filter((p) => p.status === 'pending');
  const videoAssets = media.filter((m) => m.type === 'video');
  const musicAssets = media.filter((m) => m.type === 'music');

  const [selectedProverbId, setSelectedProverbId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedMusicId, setSelectedMusicId] = useState<string>('');

  useEffect(() => {
    if (!selectedProverbId && overview?.nextPending) {
      setSelectedProverbId(String(overview.nextPending.id));
    }
  }, [overview?.nextPending, selectedProverbId]);

  const activeProverb =
    proverbs.find((p) => String(p.id) === selectedProverbId) || overview?.nextPending || null;

  const previewUrl = activePreviewUrl || overview?.latestPreview?.previewUrl || null;
  const fallbackPoster = '/src/assets/images/bg_bengal_river_dawn_1794630796392.jpg';

  const formatCronReadable = (expr: string) => {
    const parts = expr.trim().split(/\s+/);
    if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')} Daily`;
    }
    return expr;
  };

  return (
    <div className="space-y-8">
      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-zinc-200 bg-white rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Pending Queue</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 font-mono-nums">
            {overview?.counts.pending ?? 0}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            Out of <span className="font-mono-nums">{overview?.counts.total ?? 0}</span> total proverbs
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Published Reels</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700 font-mono-nums">
            {overview?.counts.posted ?? 0}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">Auto-cleaned temp files after post</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Media Assets</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 font-mono-nums">
            {overview?.mediaCounts.videos ?? 0} <span className="text-zinc-300 font-normal">/</span>{' '}
            {overview?.mediaCounts.music ?? 0}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">Vertical videos · Music tracks</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Daily Cron Schedule</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 font-mono-nums">
            {overview?.scheduler.active ? formatCronReadable(overview.scheduler.expression) : 'Paused'}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500 truncate">
            {overview?.scheduler.timezone || 'Asia/Dhaka'} ·{' '}
            {overview?.credentials.facebookConfigured ? 'Meta API Ready' : 'Meta Token Needed'}
          </p>
        </div>
      </div>

      {/* Main 2-Column Reel Studio & Live 9:16 Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Render Controls & Recent Run History */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">Reel Synthesis Workbench</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Compose a 1080×1920 vertical Reel with Bengali AI voiceover, 15% ambient music, and fade-in Unicode typography.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('proverbs')}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Manage Queue
              </button>
            </div>

            {activeProverb ? (
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Proverb #{activeProverb.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeProverb.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{activeProverb.status}</span>
                </div>
                <p className="font-bengali text-2xl font-bold text-zinc-950 leading-snug">
                  “{activeProverb.text_bn}”
                </p>
                <p className="font-bengali text-sm text-zinc-700 leading-relaxed">
                  অর্থ: {activeProverb.meaning_bn}
                </p>
              </div>
            ) : (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-center space-y-3">
                <p className="text-sm text-zinc-600">No pending proverbs left in your queue.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('proverbs')}
                  className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  Add or Upload Proverbs
                </button>
              </div>
            )}

            {/* Asset & Proverb Selection Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Target Proverb</label>
                <select
                  value={selectedProverbId}
                  onChange={(e) => setSelectedProverbId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
                >
                  {pendingProverbs.length === 0 && <option value="">No pending proverbs</option>}
                  {pendingProverbs.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} — {p.text_bn.slice(0, 28)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Background Video</label>
                <select
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
                >
                  <option value="">Random ({videoAssets.length} available)</option>
                  {videoAssets.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.original_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Background Music</label>
                <select
                  value={selectedMusicId}
                  onChange={(e) => setSelectedMusicId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
                >
                  <option value="">Random ({musicAssets.length} available)</option>
                  {musicAssets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.original_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {pipelineError && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <span className="font-semibold">Pipeline Error:</span> {pipelineError}
              </div>
            )}

            {pipelineSuccess && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                {pipelineSuccess}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isRendering || isPublishing || !activeProverb}
                onClick={() =>
                  onRenderPreview({
                    proverbId: selectedProverbId ? Number(selectedProverbId) : undefined,
                    videoAssetId: selectedVideoId ? Number(selectedVideoId) : undefined,
                    musicAssetId: selectedMusicId ? Number(selectedMusicId) : undefined,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isRendering ? 'Rendering 1080×1920 MP4...' : 'Render Test Preview'}
              </button>

              <button
                type="button"
                disabled={isRendering || isPublishing || !activeProverb}
                onClick={() =>
                  onPublishNow(selectedProverbId ? Number(selectedProverbId) : undefined)
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isPublishing ? 'Publishing to Facebook...' : 'Publish Reel Now'}
              </button>
            </div>
          </section>

          {/* Recent Automation Activity Table */}
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex-1">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-950">Recent Pipeline Runs</h3>
              <button
                type="button"
                onClick={() => onNavigate('scheduler')}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer"
              >
                View All Logs
              </button>
            </div>
            {overview && overview.recentLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-medium text-zinc-500">
                      <th className="py-2.5 px-6">Proverb</th>
                      <th className="py-2.5 px-4">Mode</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-6 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {overview.recentLogs.slice(0, 5).map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/70">
                        <td className="py-3 px-6 font-bengali font-medium text-zinc-900 max-w-[220px] truncate">
                          {log.proverb_text}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 capitalize">{log.mode}</td>
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
                            {log.status === 'published'
                              ? 'Published'
                              : log.status === 'rendered'
                                ? 'Rendered'
                                : log.status === 'failed'
                                  ? 'Failed'
                                  : 'Rendering'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-mono-nums text-zinc-500">
                          {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">
                No Reels rendered yet. Click “Render Test Preview” to generate your first 1080×1920 MP4.
              </div>
            )}
          </section>
        </div>

        {/* Right: 9:16 Vertical Reel Monitor */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">9:16 Reels Viewport</h3>
              <p className="text-xs text-zinc-500 font-mono-nums">1080 × 1920 px · 30 fps · AAC</p>
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download MP4
              </a>
            )}
          </div>

          <div className="relative w-full max-w-[300px] aspect-[9/16] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
            {previewUrl ? (
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={fallbackPoster}
                  alt="Bengal river dawn vertical backdrop preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/50 to-black/45 flex flex-col items-center justify-center px-6 text-center">
                  <span className="text-[11px] font-medium tracking-wide text-zinc-300 mb-3">
                    {activeProverb?.category || 'বাংলা প্রবাদ'}
                  </span>
                  <p className="font-bengali text-xl font-bold text-white leading-snug">
                    “{activeProverb?.text_bn || 'অল্প বিদ্যা ভয়ংকরী'}”
                  </p>
                  <p className="mt-4 font-bengali text-xs text-amber-300 leading-relaxed">
                    {activeProverb?.meaning_bn || 'আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।'}
                  </p>
                </div>
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-[11px] text-zinc-300/90">
                  <span className="inline-flex items-center gap-1">
                    <Film className="w-3 h-3" /> Mockup Frame
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> 15% BGM
                  </span>
                </div>
              </div>
            )}

            {isRendering && (
              <div className="absolute inset-0 bg-zinc-950/80 flex flex-col items-center justify-center px-6 text-center text-white">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-3" />
                <p className="text-sm font-medium">Synthesizing Bengali Voiceover & Rendering MP4</p>
                <p className="mt-1 text-xs text-zinc-400">FFmpeg libx264 · 1080×1920</p>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-zinc-500 text-center">
            {previewUrl
              ? 'Showing live FFmpeg-rendered MP4 with Bengali AI voiceover and 15% ambient music.'
              : 'Click “Render Test Preview” to synthesize real Bengali speech and burn Unicode subtitles.'}
          </p>
        </div>
      </div>
    </div>
  );
};
