import { Film, Music, Trash2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { MediaAsset } from '../types.ts';

interface MediaLibraryProps {
  media: MediaAsset[];
  onRefresh: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ media, onRefresh }) => {
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videos = media.filter((m) => m.type === 'video');
  const musicTracks = media.filter((m) => m.type === 'music');

  const handleUpload = async (file: File | undefined, type: 'video' | 'music') => {
    if (!file) return;
    setErrorMsg(null);
    const setBusy = type === 'video' ? setUploadingVideo : setUploadingMusic;
    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Media upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Section 1: Vertical Nature Background Videos */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              Vertical Nature Background Videos (9:16)
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Royalty-free 10–15 second MP4/MOV clips. FFmpeg automatically crops to 1080×1920 and loops to match voiceover length.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            {uploadingVideo ? 'Uploading Video...' : 'Upload Video (.mp4 / .mov)'}
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => {
                void handleUpload(e.target.files?.[0], 'video');
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>

        {videos.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-lg">
            No vertical background videos available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {videos.map((v) => (
              <div
                key={v.id}
                className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 flex flex-col"
              >
                <div className="aspect-[9/16] bg-zinc-950 relative">
                  <video
                    src={v.url}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 bg-white border-t border-zinc-200 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate" title={v.original_name}>
                      {v.original_name}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500 font-mono-nums">
                      {v.duration_sec.toFixed(1)}s · {formatBytes(v.file_size)}
                      {v.is_default ? ' · Starter' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    title="Remove video"
                    className="p-1.5 text-zinc-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Soft Background Music Tracks */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Soft Background Music Tracks</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Ambient tracks mixed at 15% volume beneath the Bengali voiceover with smooth fade-in and fade-out.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
            <Music className="w-3.5 h-3.5" />
            {uploadingMusic ? 'Uploading Audio...' : 'Upload Track (.mp3 / .wav)'}
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg"
              onChange={(e) => {
                void handleUpload(e.target.files?.[0], 'music');
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>

        {musicTracks.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-lg">
            No background music tracks uploaded yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
            {musicTracks.map((track) => (
              <div
                key={track.id}
                className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                    <Film className="w-4 h-4 hidden" />
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">
                      {track.original_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500 font-mono-nums">
                      {track.duration_sec.toFixed(1)}s · {formatBytes(track.file_size)}
                      {track.is_default ? ' · Starter' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <audio controls preload="metadata" src={track.url} className="h-8 w-56 sm:w-64" />
                  <button
                    type="button"
                    onClick={() => handleDelete(track.id)}
                    title="Delete audio track"
                    className="p-1.5 text-zinc-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
