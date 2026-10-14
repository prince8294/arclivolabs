import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'arclivo-labs',
    timestamp: new Date().toISOString(),
  });
}
