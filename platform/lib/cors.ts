import { NextResponse } from 'next/server';

// The assessment (quiz) app runs on a different origin and calls these routes
// from the browser, so we allow that specific origin.
function allowedOrigin(): string {
  return process.env.NEXT_PUBLIC_QUIZ_URL || 'http://localhost:3001';
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function corsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
