import { GoogleAuth } from 'google-auth-library';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getToken() {
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

// Читает A2:B2 → { topic, video_url }
export async function readNextRow() {
  const token = await getToken();
  const res = await fetch(
    `${BASE}/${SPREADSHEET_ID}/values/Лист1!A2:B2`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const row = data.values?.[0] ?? [];
  return { topic: row[0] ?? '', video_url: row[1] ?? '' };
}

// Читает всю колонку A начиная с A2 → string[]
export async function readQueue() {
  const token = await getToken();
  const res = await fetch(
    `${BASE}/${SPREADSHEET_ID}/values/Лист1!A2:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return (data.values ?? []).map((r: string[]) => r[0]).filter(Boolean);
}

// Удаляет строку 2 (индекс 1)
export async function deleteRow2() {
  const token = await getToken();
  await fetch(`${BASE}/${SPREADSHEET_ID}:batchUpdate`, {
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
}
