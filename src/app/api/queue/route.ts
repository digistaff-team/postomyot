import { readQueue } from '@/lib/google-sheets';
import { NextResponse } from 'next/server';

export async function GET() {
  const queue = await readQueue();
  return NextResponse.json(queue);
}
