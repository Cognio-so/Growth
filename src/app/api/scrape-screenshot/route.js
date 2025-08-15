import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('[scrape-screenshot] Capturing full page screenshot for:', url);

    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
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
      throw new Error(`Firecrawl API error: ${error}`);
    }

    const data = await firecrawlResponse.json();

    if (!data.success || !data.data?.screenshot) {
      console.error('[scrape-screenshot] No screenshot in response:', data);
      throw new Error('Failed to capture full page screenshot');
    }

    console.log('[scrape-screenshot] Successfully captured full page screenshot');

    return NextResponse.json({
      success: true,
      screenshot: data.data.screenshot,
      metadata: data.data.metadata
    });

  } catch (error) {
    console.error('[scrape-screenshot] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to capture full page screenshot'
    }, { status: 500 });
  }
}