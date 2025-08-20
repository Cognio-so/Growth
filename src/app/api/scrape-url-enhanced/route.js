import { NextResponse } from 'next/server';

function sanitizeQuotes(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u00AB\u00BB]/g, '"')
    .replace(/[\u2039\u203A]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function extractBusinessInfo(content) {
  const businessInfo = {
    businessName: '',
    uniqueValueProposition: '',
    competitors: '',
    colorPalette: '',
    preferredFont: ''
  };

  try {
    // Extract business name from title or headings
    const titleMatch = content.match(/Title:\s*(.+)/i);
    if (titleMatch) {
      businessInfo.businessName = sanitizeQuotes(titleMatch[1].trim());
    }

    // Extract description for value proposition
    const descMatch = content.match(/Description:\s*(.+)/i);
    if (descMatch) {
      businessInfo.uniqueValueProposition = sanitizeQuotes(descMatch[1].trim());
    }

    // Look for business name in headings
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && !businessInfo.businessName) {
      businessInfo.businessName = sanitizeQuotes(h1Match[1].trim());
    }

    // Look for services/offerings
    const servicesMatch = content.match(/(?:services|offerings|treatments?|products?)[:\s]+([^.]+)/i);
    if (servicesMatch) {
      businessInfo.uniqueValueProposition = sanitizeQuotes(servicesMatch[1].trim());
    }

    // Look for color-related content
    const colorMatches = content.match(/(?:color|background|bg-|text-)[a-zA-Z0-9-]*/gi);
    if (colorMatches) {
      businessInfo.colorPalette = colorMatches.slice(0, 5).join(', ');
    }

    // Look for font-related content
    const fontMatches = content.match(/(?:font|typography|serif|sans-serif)[a-zA-Z0-9-]*/gi);
    if (fontMatches) {
      businessInfo.preferredFont = fontMatches.slice(0, 3).join(', ');
    }

    // Look for location/address
    const addressMatch = content.match(/(?:address|location|contact)[:\s]+([^.]+)/i);
    if (addressMatch) {
      businessInfo.location = sanitizeQuotes(addressMatch[1].trim());
    }

  } catch (error) {
    console.warn('[scrape-url-enhanced] Error extracting business info:', error);
  }

  return businessInfo;
}

export async function POST(request) {
  try {
    const { url } = await request.json();

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

    console.log('[scrape-url-enhanced] Scraping with Firecrawl:', url);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      console.error('[scrape-url-enhanced] FIRECRAWL_API_KEY not configured');
      return NextResponse.json({
        success: false,
        error: 'Web scraping service not configured'
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
        formats: ['markdown', 'html'],
        waitFor: 3000,
        timeout: 30000,
        blockAds: true,
        maxAge: 3600000,
        actions: [
          {
            type: 'wait',
            milliseconds: 2000
          }
        ]
      })
    });

    if (!firecrawlResponse.ok) {
      const error = await firecrawlResponse.text();
      console.error('[scrape-url-enhanced] Firecrawl API error:', error);
      return NextResponse.json({
        success: false,
        error: `Web scraping failed: ${error}`
      }, { status: 500 });
    }

    const data = await firecrawlResponse.json();

    if (!data.success || !data.data) {
      console.error('[scrape-url-enhanced] No data in response:', data);
      return NextResponse.json({
        success: false,
        error: 'Failed to scrape content - no data received'
      }, { status: 500 });
    }

    const { markdown, html, metadata } = data.data;

    const sanitizedMarkdown = sanitizeQuotes(markdown || '');
    const title = sanitizeQuotes(metadata?.title || '');
    const description = sanitizeQuotes(metadata?.description || '');

    // Extract business information
    const businessInfo = extractBusinessInfo(sanitizedMarkdown);

    const formattedContent = `
Title: ${title}
Description: ${description}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();

    console.log('[scrape-url-enhanced] Successfully scraped content:', {
      contentLength: formattedContent.length,
      title: title.substring(0, 100),
      hasMarkdown: !!sanitizedMarkdown,
      businessInfo
    });

    return NextResponse.json({
      success: true,
      url,
      content: formattedContent,
      structured: {
        title,
        description,
        content: sanitizedMarkdown,
        url,
        businessInfo
      },
      metadata: {
        scraper: 'firecrawl-enhanced',
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        cached: data.data.cached || false,
        ...metadata
      },
      message: 'URL scraped successfully with Firecrawl (with caching for 500% faster performance)'
    });

  } catch (error) {
    console.error('[scrape-url-enhanced] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to scrape URL'
    }, { status: 500 });
  }
}