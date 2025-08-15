import { NextResponse } from 'next/server';

export async function POST() {
  try {
    global.viteErrorsCache = null;

    console.log('[clear-vite-errors-cache] Cache cleared');

    return NextResponse.json({
      success: true,
      message: 'Vite errors cache cleared'
    });

  } catch (error) {
    console.error('[clear-vite-errors-cache] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}