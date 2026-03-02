import { GoogleAuth } from 'google-auth-library';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET = encodeURIComponent('Лист тем курс 4');

async function getToken() {
  console.log('[Sheets] Getting OAuth token...');
  const start = Date.now();
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  console.log(`[Sheets] Token obtained in ${Date.now() - start}ms`);
  return token.token!;
}

// Читает A2:B2 → { topic, video_url }
export async function readNextRow() {
  console.log('[Sheets] readNextRow start');
  const token = await getToken();
  const url = `${BASE}/${SPREADSHEET_ID}/values/${SHEET}!A2:B2`;
  console.log(`[Sheets] Fetching ${url}`);
  const start = Date.now();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`[Sheets] Fetch completed in ${Date.now() - start}ms, status: ${res.status}`);
  const data = await res.json();
  const row = data.values?.[0] ?? [];
  console.log(`[Sheets] Parsed row: ["${row[0]}", "${row[1]}"]`);
  return { topic: row[0] ?? '', video_url: row[1] ?? '' };
}

// Читает всю колонку A начиная с A2 → string[]
export async function readQueue() {
  console.log('[Sheets] readQueue start');
  const token = await getToken();
  const res = await fetch(
    `${BASE}/${SPREADSHEET_ID}/values/${SHEET}!A2:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const queue = (data.values ?? []).map((r: string[]) => r[0]).filter(Boolean);
  console.log(`[Sheets] readQueue done: ${queue.length} topics`);
  return queue;
}

// Удаляет строку 2 (индекс 1)
export async function deleteRow2() {
  console.log('[Sheets] deleteRow2 start');
  const token = await getToken();
  const start = Date.now();
  const res = await fetch(`${BASE}/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: 2,
          },
        },
      }],
    }),
  });
  console.log(`[Sheets] deleteRow2 done in ${Date.now() - start}ms, status: ${res.status}`);
  if (!res.ok) {
    const error = await res.text();
    console.error(`[Sheets] deleteRow2 error: ${error}`);
    throw new Error(`Sheets delete failed: ${res.status}`);
  }
}
