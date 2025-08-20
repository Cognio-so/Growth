import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ 
        success: false,
        error: 'URL is required' 
      }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid URL format' 
      }, { status: 400 });
    }

    console.log('[scrape-screenshot] Capturing full page screenshot for:', url);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      console.error('[scrape-screenshot] FIRECRAWL_API_KEY not configured');
      return NextResponse.json({ 
        success: false,
        error: 'Screenshot service not configured' 
      }, { status: 500 });
    }

    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['screenshot'],
        waitFor: 5000, // Increased wait time for full page load
        timeout: 60000, // Increased timeout for full page capture
        blockAds: true,
        screenshotOptions: {
          fullPage: true, // Enable full page screenshot
          quality: 90, // High quality screenshot
          format: 'png'
        },
        actions: [
          {
            type: 'wait',
            milliseconds: 3000 // Wait for dynamic content
          },
          {
            type: 'scroll',
            direction: 'down',
            duration: 2000 // Scroll to capture full page
          },
          {
            type: 'wait',
            milliseconds: 2000 // Wait after scroll
          }
        ]
      })
    });

    if (!firecrawlResponse.ok) {
      const error = await firecrawlResponse.text();
      console.error('[scrape-screenshot] Firecrawl API error:', error);
      return NextResponse.json({ 
        success: false,
        error: `Screenshot capture failed: ${error}` 
      }, { status: 500 });
    }

    const data = await firecrawlResponse.json();

    if (!data.success || !data.data?.screenshot) {
      console.error('[scrape-screenshot] No screenshot in response:', data);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to capture screenshot - no image data received' 
      }, { status: 500 });
    }

    console.log('[scrape-screenshot] Successfully captured full page screenshot');

    return NextResponse.json({
      success: true,
      screenshot: data.data.screenshot,
      metadata: {
        url,
        timestamp: new Date().toISOString(),
        scraper: 'firecrawl-screenshot',
        cached: data.data.cached || false,
        ...data.data.metadata
      }
    });

  } catch (error) {
    console.error('[scrape-screenshot] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to capture screenshot'
    }, { status: 500 });
  }
}