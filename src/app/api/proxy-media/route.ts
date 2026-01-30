
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return new NextResponse(`Failed to fetch resource: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        // Critical for COEP/COOP environment
        'Cross-Origin-Resource-Policy': 'cross-origin', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
