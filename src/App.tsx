import { BookOpen, CalendarClock, Film, LayoutDashboard, ListOrdered, Loader2, Menu, Play, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeploymentGuide } from './components/DeploymentGuide.tsx';
import { MediaLibrary } from './components/MediaLibrary.tsx';
import { OverviewStudio } from './components/OverviewStudio.tsx';
import { ProverbQueue } from './components/ProverbQueue.tsx';
import { SchedulerSettings } from './components/SchedulerSettings.tsx';
import { MediaAsset, OverviewData, Proverb, RenderLog } from './types.ts';

type TabKey = 'overview' | 'proverbs' | 'media' | 'scheduler' | 'guide';

const NAV_ITEMS: Array<{ key: TabKey; label: string; breadcrumb: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Studio Overview', breadcrumb: 'Studio / Overview', icon: LayoutDashboard },
  { key: 'proverbs', label: 'Proverb Queue', breadcrumb: 'Studio / Proverb Queue', icon: ListOrdered },
  { key: 'media', label: 'Media Library', breadcrumb: 'Studio / Media Library', icon: Film },
  { key: 'scheduler', label: 'Scheduler & API', breadcrumb: 'Studio / Scheduler & API', icon: CalendarClock },
  { key: 'guide', label: 'Setup & Deploy', breadcrumb: 'Studio / Setup & Deploy', icon: BookOpen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [proverbs, setProverbs] = useState<Proverb[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [logs, setLogs] = useState<RenderLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRendering, setIsRendering] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineSuccess, setPipelineSuccess] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const [ovRes, provRes, mediaRes, logsRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/proverbs'),
        fetch('/api/media'),
        fetch('/api/logs'),
      ]);

      const [ovJson, provJson, mediaJson, logsJson] = await Promise.all([
        ovRes.json(),
        provRes.json(),
        mediaRes.json(),
        logsRes.json(),
      ]);

      setOverview(ovJson);
      setProverbs(provJson.proverbs || []);
      setMedia(mediaJson.assets || []);
      setLogs(logsJson.logs || []);
    } catch (err) {
      console.error('Failed loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const handleRenderPreview = async (params: {
    proverbId?: number;
    videoAssetId?: number;
    musicAssetId?: number;
  } = {}) => {
    setActiveTab('overview');
    setIsRendering(true);
    setPipelineError(null);
    setPipelineSuccess(null);

    try {
      const res = await fetch('/api/pipeline/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview render failed');

      if (data.previewUrl) {
        setActivePreviewUrl(`${data.previewUrl}?t=${Date.now()}`);
      }
      setPipelineSuccess(
        `Rendered 1080×1920 MP4 for “${data.proverb?.text_bn || 'proverb'}” in ${(data.durationMs / 1000).toFixed(1)}s.`
      );
      await loadAllData();
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Preview rendering failed.');
    } finally {
      setIsRendering(false);
    }
  };

  const handlePublishNow = async (proverbId?: number) => {
    setIsPublishing(true);
    setPipelineError(null);
    setPipelineSuccess(null);

    try {
      const res = await fetch('/api/pipeline/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proverbId ? { proverbId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Facebook publishing failed');

      setPipelineSuccess(
        `Published Reel (FB ID: ${data.fbReelId}) and marked proverb #${data.proverb?.id} as posted. Temporary MP4 deleted.`
      );
      await loadAllData();
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Publishing failed.');
    } finally {
      setIsPublishing(false);
    }
  };

  const currentNav = NAV_ITEMS.find((item) => item.key === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-zinc-50 text-zinc-950">
      {/* Desktop Sidebar (240px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-zinc-200">
        <div className="h-16 px-6 flex items-center border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Probad Studio
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-700' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-5 border-t border-zinc-200 text-xs text-zinc-500 space-y-1">
          <p className="font-medium text-zinc-700 font-bengali">বাংলা প্রবাদ-প্রবচন</p>
          <p className="font-mono-nums">1080×1920 · Node + FFmpeg</p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-zinc-200 flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-200">
              <span className="text-base font-bold text-zinc-950 whitespace-nowrap">Probad Studio</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-zinc-500 hover:text-zinc-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-600 hover:text-zinc-950"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-zinc-900 truncate">
              {currentNav.breadcrumb}
            </h1>
          </div>

          <button
            type="button"
            disabled={isRendering || isPublishing}
            onClick={() => void handleRenderPreview({})}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isRendering ? 'Rendering...' : 'Generate Test Reel'}
          </button>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-xs text-zinc-500">
              Loading Probad Studio workspace...
            </div>
          ) : activeTab === 'overview' ? (
            <OverviewStudio
              overview={overview}
              proverbs={proverbs}
              media={media}
              isRendering={isRendering}
              isPublishing={isPublishing}
              activePreviewUrl={activePreviewUrl}
              pipelineError={pipelineError}
              pipelineSuccess={pipelineSuccess}
              onRenderPreview={(params) => void handleRenderPreview(params)}
              onPublishNow={(proverbId) => void handlePublishNow(proverbId)}
              onNavigate={setActiveTab}
            />
          ) : activeTab === 'proverbs' ? (
            <ProverbQueue
              proverbs={proverbs}
              onRefresh={loadAllData}
              onRenderSingle={(id) => void handleRenderPreview({ proverbId: id })}
            />
          ) : activeTab === 'media' ? (
            <MediaLibrary media={media} onRefresh={loadAllData} />
          ) : activeTab === 'scheduler' ? (
            <SchedulerSettings logs={logs} onSettingsUpdated={loadAllData} />
          ) : (
            <DeploymentGuide />
          )}
        </main>
      </div>
    </div>
  );
}
