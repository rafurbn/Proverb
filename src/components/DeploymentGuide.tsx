import React from 'react';

export const DeploymentGuide: React.FC = () => {
  return (
    <div className="max-w-4xl space-y-8">
      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-950">
          01. Architecture Overview & Local Setup
        </h2>
        <p className="text-sm text-zinc-600 leading-relaxed">
          Probad Studio runs as a unified Node.js + Express + SQLite application with FFmpeg and
          HarfBuzz-enabled <code className="font-mono-nums text-zinc-900">libass</code> Bengali
          subtitle rendering. Each scheduled run selects one pending proverb, synthesizes Bengali
          speech, composites a 1080×1920 MP4 with 15% background music, publishes it to your
          Facebook Page via Meta Graph API v21.0, and deletes the temporary MP4 file to keep disk
          usage near zero.
        </p>
        <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 text-xs font-mono-nums overflow-x-auto leading-relaxed">{`# 1. Install system FFmpeg + Bengali Noto fonts (Ubuntu / Debian)
sudo apt-get update && sudo apt-get install -y ffmpeg fonts-noto-core fonts-noto-extra

# 2. Install dependencies & configure environment
npm install
cp .env.example .env

# 3. Run in development or production
npm run dev
npm run build && NODE_ENV=production node server.ts`}</pre>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-950">
          02. Obtaining Facebook Page ID & Long-Lived Access Token
        </h2>
        <ol className="list-decimal pl-5 space-y-2.5 text-sm text-zinc-700 leading-relaxed">
          <li>
            Open <strong>developers.facebook.com</strong> and create a new <strong>Business</strong>{' '}
            app. Add the <strong>Facebook Login for Business</strong> product.
          </li>
          <li>
            Open the <strong>Graph API Explorer</strong>, select your app, and request a{' '}
            <strong>User Token</strong> with permissions:{' '}
            <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">pages_show_list</code>,{' '}
            <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">pages_read_engagement</code>,{' '}
            <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">pages_manage_posts</code>, and{' '}
            <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">publish_video</code>.
          </li>
          <li>
            Query <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">GET /me/accounts</code>{' '}
            to copy your Page’s <code className="font-mono-nums text-xs">id</code> (this is your{' '}
            <code className="font-mono-nums text-xs">FB_PAGE_ID</code>) and Page{' '}
            <code className="font-mono-nums text-xs">access_token</code>.
          </li>
          <li>
            Exchange your short-lived token for a <strong>never-expiring Page Access Token</strong>{' '}
            by first exchanging the User Token via{' '}
            <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">/oauth/access_token?grant_type=fb_exchange_token</code>{' '}
            and then fetching <code className="font-mono-nums text-xs bg-zinc-100 px-1.5 py-0.5 rounded">/me/accounts</code>{' '}
            using that long-lived user token. Paste the resulting Page ID and Token in the{' '}
            <strong>Scheduler & API</strong> tab.
          </li>
        </ol>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-950">
          03. Bengali Voiceover Engine (Microsoft Edge TTS · bn-BD-NabanitaNeural)
        </h2>
        <div className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <p>
            Probad Studio generates natural Bangladeshi Bengali speech using the free{' '}
            <strong>Microsoft Edge TTS</strong> engine (
            <code className="font-mono-nums text-xs">msedge-tts</code>) with the{' '}
            <code className="font-mono-nums text-xs">bn-BD-NabanitaNeural</code> female voice—no API
            key required.
          </p>
          <p>
            <strong>Optional Secondary Fallback:</strong> If Edge TTS is ever unreachable, the
            pipeline automatically falls back to the <strong>ElevenLabs API</strong> (
            <code className="font-mono-nums text-xs">eleven_multilingual_v2</code>) when{' '}
            <code className="font-mono-nums text-xs">ELEVENLABS_API_KEY</code> and{' '}
            <code className="font-mono-nums text-xs">ELEVENLABS_VOICE_ID</code> are set in your
            environment secrets or <code className="font-mono-nums text-xs">.env</code> file.
          </p>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-950">
          04. Deploying to AWS EC2 or Heroku
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-700 leading-relaxed">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-950">AWS EC2 (Recommended for Persistent SQLite & Cron)</h3>
            <pre className="p-3.5 rounded-lg bg-zinc-950 text-zinc-100 font-mono-nums overflow-x-auto">{`# Launch Ubuntu 22.04 t3.small instance
sudo apt update && sudo apt install -y ffmpeg fonts-noto-core nodejs npm
npm install -g pm2 tsx
git clone <your-repo> && cd <your-repo>
npm ci && npm run build
NODE_ENV=production pm2 start "tsx server.ts" --name probad-studio
pm2 save && pm2 startup`}</pre>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-950">Heroku Deployment</h3>
            <pre className="p-3.5 rounded-lg bg-zinc-950 text-zinc-100 font-mono-nums overflow-x-auto">{`heroku create probad-studio-reels
heroku buildpacks:add --index 1 https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
heroku buildpacks:add --index 2 heroku/nodejs
heroku config:set NODE_ENV=production FB_PAGE_ID=... FB_PAGE_ACCESS_TOKEN=...
git push heroku main`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
};
