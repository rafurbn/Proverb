import fs from 'fs';

const GRAPH_API_VERSION = 'v21.0';

export interface PublishReelParams {
  pageId: string;
  pageAccessToken: string;
  videoFilePath: string;
  description: string;
}

export interface PublishReelResult {
  videoId: string;
  success: boolean;
}

/**
 * Publishes an MP4 vertical video as a Facebook Page Reel using the official
 * 3-phase Meta Graph API Reels Publishing Protocol:
 * 1. Initialize upload session -> GET video_id & upload_url
 * 2. Binary upload MP4 bytes to rupload.facebook.com
 * 3. Finalize & publish Reel with caption description
 */
export async function publishFacebookReel(params: PublishReelParams): Promise<PublishReelResult> {
  const { pageId, pageAccessToken, videoFilePath, description } = params;

  if (!pageId || pageId === 'YOUR_FACEBOOK_PAGE_ID') {
    throw new Error('Facebook PAGE_ID is not configured. Add it in Scheduler Settings or .env.');
  }
  if (!pageAccessToken || pageAccessToken === 'YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN') {
    throw new Error('Facebook PAGE_ACCESS_TOKEN is not configured. Add it in Scheduler Settings or .env.');
  }
  if (!fs.existsSync(videoFilePath)) {
    throw new Error(`Rendered video file not found at ${videoFilePath}`);
  }

  // Step 1: Start Upload Session
  const startUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/video_reels`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      access_token: pageAccessToken,
    }),
  });

  const startData = (await startRes.json()) as {
    video_id?: string;
    upload_url?: string;
    error?: { message?: string };
  };

  if (!startRes.ok || !startData.video_id || !startData.upload_url) {
    throw new Error(
      `Meta Graph API start phase failed: ${startData.error?.message || JSON.stringify(startData)}`
    );
  }

  const { video_id: videoId, upload_url: uploadUrl } = startData;

  // Step 2: Binary Video Upload
  const videoBuffer = fs.readFileSync(videoFilePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      offset: '0',
      file_size: String(videoBuffer.byteLength),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  });

  const uploadData = (await uploadRes.json()) as {
    success?: boolean;
    error?: { message?: string };
  };

  if (!uploadRes.ok || !uploadData.success) {
    throw new Error(
      `Meta Graph API binary upload failed: ${uploadData.error?.message || JSON.stringify(uploadData)}`
    );
  }

  // Step 3: Finish & Publish Reel
  const finishParams = new URLSearchParams({
    access_token: pageAccessToken,
    video_id: videoId,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description,
  });

  const finishRes = await fetch(`${startUrl}?${finishParams.toString()}`, {
    method: 'POST',
  });

  const finishData = (await finishRes.json()) as {
    success?: boolean;
    error?: { message?: string };
  };

  if (!finishRes.ok || !finishData.success) {
    throw new Error(
      `Meta Graph API finish phase failed: ${finishData.error?.message || JSON.stringify(finishData)}`
    );
  }

  return { videoId, success: true };
}
