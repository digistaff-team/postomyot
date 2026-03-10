const KIE_BASE = 'https://api.kie.ai';
const API_KEY = process.env.KIE_API_KEY!;

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const MODEL = 'nano-banana-2';

async function createImageTask(prompt: string, aspectRatio: string = '4:3'): Promise<string> {
  console.log(`[KIE] Creating image generation task for prompt: ${prompt.slice(0, 50)}...`);
  const start = Date.now();

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      model: MODEL,
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: '1K',
        output_format: 'jpg',
        google_search: false,
        image_input: [],
      },
    }),
  });

  console.log(`[KIE] Task creation completed in ${Date.now() - start}ms, status: ${res.status}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[KIE] Task creation failed: ${error}`);
    throw new Error(`KIE task creation failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  const taskId = data.data?.taskId;

  if (!taskId) {
    throw new Error('KIE API returned no taskId');
  }

  console.log(`[KIE] Task created: ${taskId}`);
  return taskId;
}

async function getTaskDetails(taskId: string): Promise<{ status: string; imageUrl?: string }> {
  console.log(`[KIE] Getting task details for: ${taskId}`);
  const start = Date.now();

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: HEADERS,
  });

  console.log(`[KIE] Task details fetch completed in ${Date.now() - start}ms, status: ${res.status}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[KIE] Task details failed: ${error}`);
    throw new Error(`KIE task details failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  const rawState = data.data?.state;
  let imageUrl: string | undefined;

  const resultJsonRaw = data.data?.resultJson;
  if (typeof resultJsonRaw === 'string' && resultJsonRaw.trim() !== '') {
    try {
      const parsed = JSON.parse(resultJsonRaw);
      imageUrl = parsed?.resultUrls?.[0] || parsed?.images?.[0]?.url;
    } catch {
      console.warn('[KIE] Failed to parse resultJson, continuing without parsed URL');
    }
  }

  imageUrl = imageUrl || data.data?.output?.image_url || data.data?.output?.imageUrl;

  const normalizedStatus =
    rawState === 'success'
      ? 'SUCCESS'
      : rawState === 'fail'
        ? 'FAILED'
        : rawState === 'generating' || rawState === 'queuing' || rawState === 'waiting'
          ? 'PROCESSING'
          : rawState || data.data?.status;

  console.log(
    `[KIE] Task status: ${normalizedStatus}${imageUrl ? `, image_url: ${imageUrl.slice(0, 50)}...` : ''}`
  );

  return { status: normalizedStatus, imageUrl };
}

async function getDownloadUrl(imageUrl: string): Promise<string> {
  console.log(`[KIE] Getting download URL for: ${imageUrl.slice(0, 50)}...`);
  const start = Date.now();

  const res = await fetch(`${KIE_BASE}/api/v1/common/download-url`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ url: imageUrl }),
  });

  console.log(`[KIE] Download URL fetch completed in ${Date.now() - start}ms, status: ${res.status}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[KIE] Download URL failed: ${error}`);
    throw new Error(`KIE download URL failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  const downloadUrl = data.data;

  if (!downloadUrl) {
    throw new Error('KIE API returned no download URL');
  }

  console.log(`[KIE] Download URL obtained: ${downloadUrl.slice(0, 50)}...`);
  return downloadUrl;
}

export async function generateImage(
  prompt: string,
  aspectRatio: string = '4:3',
  maxWaitTime: number = 60000
): Promise<string> {
  console.log(`[KIE] Starting image generation: "${prompt.slice(0, 50)}..."`);
  const totalStart = Date.now();

  const taskId = await createImageTask(prompt, aspectRatio);

  const pollingInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));

    const { status, imageUrl } = await getTaskDetails(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      if (!imageUrl) {
        throw new Error('Task completed but no image URL returned');
      }

      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        console.log(`[KIE] Image generation completed in ${Date.now() - totalStart}ms`);
        return imageUrl;
      }

      const downloadUrl = await getDownloadUrl(imageUrl);
      console.log(`[KIE] Image generation completed in ${Date.now() - totalStart}ms`);
      return downloadUrl;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`KIE image generation failed with status: ${status}`);
    }

    console.log(`[KIE] Task still processing, status: ${status}`);
  }

  throw new Error(`KIE image generation timeout after ${maxWaitTime}ms`);
}
