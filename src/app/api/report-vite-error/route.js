import { NextResponse } from 'next/server';



// Initialize global viteErrors array if it doesn't exist
if (!global.viteErrors) {
  global.viteErrors = [];
}

export async function POST(request) {
  try {
    const { error, file, type = 'runtime-error' } = await request.json();

    if (!error) {
      return NextResponse.json({
        success: false,
        error: 'Error message is required'
      }, { status: 400 });
    }

    const errorObj = {
      type,
      message: error,
      file: file || 'unknown',
      timestamp: new Date().toISOString()
    };

    const importMatch = error.match(/Failed to resolve import ['"]([^'"]+)['"] from ['"]([^'"]+)['"]/);
    if (importMatch) {
      errorObj.type = 'import-error';
      errorObj.import = importMatch[1];
      errorObj.file = importMatch[2];
    }

    global.viteErrors.push(errorObj);

    if (global.viteErrors.length > 50) {
      global.viteErrors = global.viteErrors.slice(-50);
    }

    console.log('[report-vite-error] Error reported:', errorObj);

    return NextResponse.json({
      success: true,
      message: 'Error reported successfully',
      error: errorObj
    });

  } catch (error) {
    console.error('[report-vite-error] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}