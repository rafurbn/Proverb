import { Download, FileSpreadsheet, Play, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Proverb } from '../types.ts';

interface ProverbQueueProps {
  proverbs: Proverb[];
  onRefresh: () => Promise<void>;
  onRenderSingle: (proverbId: number) => void;
}

export const ProverbQueue: React.FC<ProverbQueueProps> = ({
  proverbs,
  onRefresh,
  onRenderSingle,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'posted'>('all');
  const [search, setSearch] = useState('');
  const [textBn, setTextBn] = useState('');
  const [meaningBn, setMeaningBn] = useState('');
  const [category, setCategory] = useState('জীবনদর্শন');
  const [submitting, setSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = proverbs.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.text_bn.toLowerCase().includes(q) ||
        p.meaning_bn.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddProverb = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!textBn.trim() || !meaningBn.trim()) {
      setErrorMsg('Please enter both the Bengali proverb and its 1-line meaning.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/proverbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_bn: textBn.trim(),
          meaning_bn: meaningBn.trim(),
          category: category.trim() || 'প্রজ্ঞা',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add proverb');
      setTextBn('');
      setMeaningBn('');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save proverb');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setBulkResult(null);

    const formData = new FormData();
    formData.append('file', file);

    setSubmitting(true);
    try {
      const res = await fetch('/api/proverbs/bulk', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');
      setBulkResult(
        `Imported ${data.inserted} new proverbs (${data.skippedDuplicates} duplicates skipped).`
      );
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload spreadsheet');
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleStatus = async (proverb: Proverb) => {
    const nextStatus = proverb.status === 'posted' ? 'pending' : 'posted';
    await fetch(`/api/proverbs/${proverb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    await onRefresh();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/proverbs/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      {/* Top 2-Column Input Section: Manual Form + Bulk CSV/Excel Import */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddProverb}
          className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-950">Add Single Bengali Proverb</h2>
            <span className="text-xs text-zinc-500">Queued as Pending</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Bengali Proverb (বাংলা প্রবাদ)
              </label>
              <input
                type="text"
                value={textBn}
                onChange={(e) => setTextBn(e.target.value)}
                placeholder="যেমন: নাচতে না জানলে উঠান বাঁকা"
                className="w-full h-10 px-3 text-sm font-bengali bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="জীবনদর্শন"
                className="w-full h-10 px-3 text-sm font-bengali bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              1-Line Simple Meaning (সহজ অর্থ)
            </label>
            <input
              type="text"
              value={meaningBn}
              onChange={(e) => setMeaningBn(e.target.value)}
              placeholder="নিজের অক্ষমতা ঢাকতে অন্যের বা পরিস্থিতির দোষ দেওয়া।"
              className="w-full h-10 px-3 text-sm font-bengali bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Queue
            </button>
          </div>
        </form>

        {/* Bulk Upload Panel */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-950">Bulk Import CSV / Excel</h2>
              <a
                href="/api/proverbs/sample-csv"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Sample CSV
              </a>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Upload hundreds of rows at once using <code className="font-mono-nums">.csv</code>,{' '}
              <code className="font-mono-nums">.xlsx</code>, or <code className="font-mono-nums">.xls</code>.
              Columns supported: <span className="font-medium text-zinc-700">text_bn / প্রবাদ</span> and{' '}
              <span className="font-medium text-zinc-700">meaning_bn / অর্থ</span>. Duplicates are skipped automatically.
            </p>
          </div>

          <label className="border border-dashed border-zinc-300 hover:border-emerald-600 rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-50/50">
            <FileSpreadsheet className="w-6 h-6 text-zinc-400 mb-2" />
            <span className="text-xs font-medium text-zinc-800">
              {submitting ? 'Processing file...' : 'Choose CSV or Excel spreadsheet'}
            </span>
            <span className="mt-1 text-[11px] text-zinc-500">UTF-8 Bengali Unicode supported</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleBulkUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}
      {bulkResult && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {bulkResult}
        </div>
      )}

      {/* Search, Filter Tabs, and High-Density Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {(['all', 'pending', 'posted'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap cursor-pointer ${
                  filter === tab
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Bengali proverbs..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Upload className="w-6 h-6 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-800">No matching proverbs found</p>
            <p className="text-xs text-zinc-500">Add a proverb above or switch your status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 bg-zinc-50/50">
                  <th className="py-3 px-4 w-14">ID</th>
                  <th className="py-3 px-4">Proverb (প্রবাদ)</th>
                  <th className="py-3 px-4">1-Line Meaning (অর্থ)</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono-nums text-zinc-500">#{p.id}</td>
                    <td className="py-3 px-4 font-bengali text-sm font-semibold text-zinc-950 min-w-[200px]">
                      {p.text_bn}
                    </td>
                    <td className="py-3 px-4 font-bengali text-zinc-700 max-w-md">{p.meaning_bn}</td>
                    <td className="py-3 px-4 text-zinc-600 font-bengali whitespace-nowrap">{p.category}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          p.status === 'posted'
                            ? 'text-emerald-700'
                            : p.status === 'failed'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {p.status === 'posted'
                          ? 'Posted'
                          : p.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                      </span>
                      {p.fb_post_id && (
                        <span className="ml-1.5 text-[11px] font-mono-nums text-zinc-400">
                          · {p.fb_post_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onRenderSingle(p.id)}
                          title="Render Preview Reel"
                          className="p-1.5 text-zinc-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === 'posted' ? 'Reset to Pending' : 'Mark as Posted'}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          title="Delete Proverb"
                          className="p-1.5 text-zinc-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
