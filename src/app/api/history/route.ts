import { getPostHistory } from '@/lib/neon';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await getPostHistory(50);
  return NextResponse.json(rows);
}
