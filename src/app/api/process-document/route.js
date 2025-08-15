import { NextResponse } from 'next/server';

// Function to extract text from PDF using pdfjs-dist (more reliable for Next.js)
async function extractTextFromPDF(buffer) {
  try {
    console.log('[process-document] Starting PDF parsing with pdfjs-dist...');
    
    // Import pdfjs-dist dynamically
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up the worker
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    
    console.log('[process-document] PDF loaded, pages:', pdf.numPages);
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
      
      console.log(`[process-document] Extracted text from page ${pageNum}, length: ${pageText.length}`);
    }
    
    console.log('[process-document] PDF parsing completed, total text length:', fullText.length);
    return fullText;
    
  } catch (error) {
    console.error('[process-document] PDF parsing error:', error);
    
    // Fallback: try pdf-parse as last resort
    try {
      console.log('[process-document] Trying pdf-parse as fallback...');
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      
      if (data && data.text) {
        console.log('[process-document] pdf-parse fallback succeeded');
        return data.text;
      }
    } catch (fallbackError) {
      console.error('[process-document] pdf-parse fallback also failed:', fallbackError);
    }
    
    throw new Error('Failed to parse PDF file. Please ensure the PDF is not corrupted or password-protected.');
  }
}

// Function to extract text from DOCX files
async function extractTextFromDOCX(buffer) {
  try {
    console.log('[process-document] Starting DOCX parsing...');
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer });
    
    if (result && result.value) {
      console.log('[process-document] DOCX parsed successfully, text length:', result.value.length);
      return result.value;
    } else {
      throw new Error('No text content extracted from DOCX');
    }
  } catch (error) {
    console.error('[process-document] DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

function extractBusinessInfo(content) {
  console.log('[process-document] Extracting business info from content length:', content.length);
  console.log('[process-document] Content preview:', content.substring(0, 200));
  
  const extracted = {
    businessName: '',
    uniqueValueProposition: '',
    competitors: '',
    colorPalette: '',
    preferredFont: ''
  };

  // More flexible patterns for Business Name
  const businessNamePatterns = [
    /Business Name:\s*([^\n\r*]+)/i,
    /Company Name:\s*([^\n\r*]+)/i,
    /Organization:\s*([^\n\r*]+)/i,
    /Business:\s*([^\n\r*]+)/i,
    /Company:\s*([^\n\r*]+)/i,
    /Organization Name:\s*([^\n\r*]+)/i
  ];
  
  for (const pattern of businessNamePatterns) {
    const match = content.match(pattern);
    if (match) {
      extracted.businessName = match[1].trim();
      console.log('[process-document] Found business name:', extracted.businessName);
      break;
    }
  }

  // More flexible patterns for Unique Value Proposition
  const uniqueValuePatterns = [
    /What makes your company unique or different from your competitors\?\s*([^\n\r*]+)/i,
    /Unique Value Proposition:\s*([^\n\r*]+)/i,
    /What sets you apart:\s*([^\n\r*]+)/i,
    /Unique Value:\s*([^\n\r*]+)/i,
    /Value Proposition:\s*([^\n\r*]+)/i,
    /What makes you unique:\s*([^\n\r*]+)/i,
    /Unique selling point:\s*([^\n\r*]+)/i,
    /USP:\s*([^\n\r*]+)/i
  ];
  
  for (const pattern of uniqueValuePatterns) {
    const match = content.match(pattern);
    if (match) {
      extracted.uniqueValueProposition = match[1].trim();
      console.log('[process-document] Found unique value proposition:', extracted.uniqueValueProposition);
      break;
    }
  }

  // More flexible patterns for Competitors
  const competitorsPatterns = [
    /Competitors and Their Websites:\s*([^\n\r*]+)/i,
    /Competitors:\s*([^\n\r*]+)/i,
    /Competition:\s*([^\n\r*]+)/i,
    /Competitor websites:\s*([^\n\r*]+)/i,
    /Competing businesses:\s*([^\n\r*]+)/i,
    /Rival companies:\s*([^\n\r*]+)/i
  ];
  
  for (const pattern of competitorsPatterns) {
    const match = content.match(pattern);
    if (match) {
      extracted.competitors = match[1].trim();
      console.log('[process-document] Found competitors:', extracted.competitors);
      break;
    }
  }

  // More flexible patterns for Color Palette
  const colorPalettePatterns = [
    /Color Palette Scheme:\s*([^\n\r*]+)/i,
    /Color Scheme:\s*([^\n\r*]+)/i,
    /Brand Colors:\s*([^\n\r*]+)/i,
    /Colors:\s*([^\n\r*]+)/i,
    /Color palette:\s*([^\n\r*]+)/i,
    /Brand colors:\s*([^\n\r*]+)/i,
    /Preferred colors:\s*([^\n\r*]+)/i
  ];
  
  for (const pattern of colorPalettePatterns) {
    const match = content.match(pattern);
    if (match) {
      extracted.colorPalette = match[1].trim();
      console.log('[process-document] Found color palette:', extracted.colorPalette);
      break;
    }
  }

  // More flexible patterns for Preferred Font
  const fontPatterns = [
    /Preferred Font Style for Website:\s*([^\n\r*]+)/i,
    /Font Preference:\s*([^\n\r*]+)/i,
    /Typography:\s*([^\n\r*]+)/i,
    /Font:\s*([^\n\r*]+)/i,
    /Font style:\s*([^\n\r*]+)/i,
    /Preferred font:\s*([^\n\r*]+)/i,
    /Website font:\s*([^\n\r*]+)/i
  ];
  
  for (const pattern of fontPatterns) {
    const match = content.match(pattern);
    if (match) {
      extracted.preferredFont = match[1].trim();
      console.log('[process-document] Found preferred font:', extracted.preferredFont);
      break;
    }
  }

  // If no business name found, try to extract from the first few lines
  if (!extracted.businessName) {
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('-') && trimmedLine.length > 3 && trimmedLine.length < 100) {
        // Check if it looks like a business name (not a question, not too long)
        if (!trimmedLine.includes('?') && !trimmedLine.includes('http') && !trimmedLine.includes('@')) {
          extracted.businessName = trimmedLine;
          console.log('[process-document] Extracted business name from first lines:', extracted.businessName);
          break;
        }
      }
    }
  }

  console.log('[process-document] Final extracted info:', extracted);
  return extracted;
}

function generateDesignPrompt(extractedInfo) {
  const { businessName, uniqueValueProposition, competitors, colorPalette, preferredFont } = extractedInfo;
  
  return `Create a modern, professional website for ${businessName || 'this business'} based on the following extracted information:

BUSINESS INFORMATION:
- Business Name: ${businessName || 'Not specified'}
- Unique Value Proposition: ${uniqueValueProposition || 'Not specified'}
- Competitors: ${competitors || 'Not specified'}

DESIGN REQUIREMENTS:
- Color Palette: ${colorPalette || 'Professional and modern colors'}
- Preferred Font: ${preferredFont || 'Clean, readable fonts'}

UI/UX DESIGN PRINCIPLES TO FOLLOW:
1. Layout & Grids: Use a simple 12-column grid system for balanced, responsive layouts
2. Typography: Use 1-2 font families with clear hierarchy (H1 for main titles, H2-H4 for structure, 16-18px body text)
3. Color: Follow 60-30-10 rule (60% neutral, 30% main color, 10% accent). Ensure high contrast for readability
4. Spacing: Use consistent spacing scale (8px, 16px, 24px, 64px) with proper white space
5. Visual Hierarchy: Guide user attention with size, color, and placement
6. Navigation: Simple, consistent navigation with 5-7 main items
7. Buttons & CTAs: Bold, contrasting colors with clear action-oriented labels
8. Icons & Images: Crisp vector icons and high-quality images
9. Motion: Subtle animations (200-500ms) with natural easing
10. Responsiveness: Mobile-first design that scales to all screen sizes

REQUIREMENTS:
- Create a complete React application with modern design
- Use Tailwind CSS for all styling
- Make it fully responsive
- Include hover effects and smooth transitions
- Create separate components for major sections (Header, Hero, About, Services, etc.)
- Use semantic HTML5 elements
- Ensure accessibility and performance
- Create a professional, trustworthy appearance that reflects the business's unique value proposition

Focus on creating a website that embodies the business's brand identity and effectively communicates their unique value proposition to potential customers.`;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('document');

    console.log('[process-document] Received request');
    console.log('[process-document] File:', file ? `${file.name} (${file.type})` : 'none');

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No document uploaded'
      }, { status: 400 });
    }

    // Only allow PDF, DOCX, and MD files
    const allowedTypes = [
      'text/plain', // .txt files
      'text/markdown', // .md files
      'application/pdf', // .pdf files
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file type. Please upload a .pdf, .docx, .md, or .txt file.'
      }, { status: 400 });
    }

    let content = '';

    try {
      if (file.type === 'application/pdf') {
        console.log('[process-document] Processing PDF file...');
        const buffer = await file.arrayBuffer();
        console.log('[process-document] PDF buffer size:', buffer.byteLength);
        
        // Convert ArrayBuffer to Uint8Array for pdfjs-dist
        const uint8Array = new Uint8Array(buffer);
        console.log('[process-document] Converted to Uint8Array, length:', uint8Array.length);
        
        content = await extractTextFromPDF(uint8Array);
        console.log('[process-document] PDF content extracted, length:', content.length);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log('[process-document] Processing DOCX file...');
        // Handle DOCX files
        const buffer = await file.arrayBuffer();
        content = await extractTextFromDOCX(Buffer.from(buffer));
        console.log('[process-document] DOCX content extracted, length:', content.length);
      } else {
        console.log('[process-document] Processing text file...');
        // Handle text-based files (.txt, .md)
        content = await file.text();
        console.log('[process-document] Text content extracted, length:', content.length);
      }
    } catch (error) {
      console.error('[process-document] File processing error:', error);
      return NextResponse.json({
        success: false,
        error: `Failed to process file: ${error.message}`
      }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No readable content found in the document'
      }, { status: 400 });
    }

    // Extract business information
    const extractedInfo = extractBusinessInfo(content);
    
    // Check if any information was extracted
    const hasExtractedInfo = Object.values(extractedInfo).some(value => value && value.trim() !== '');
    
    if (!hasExtractedInfo) {
      console.log('[process-document] No business information extracted, returning fallback');
      // Return a fallback response with the content for manual review
      return NextResponse.json({
        success: true,
        extractedInfo: {
          businessName: 'Business (from uploaded document)',
          uniqueValueProposition: 'Professional services and solutions',
          competitors: 'Industry competitors',
          colorPalette: 'Professional and modern colors',
          preferredFont: 'Clean, readable fonts'
        },
        designPrompt: generateDesignPrompt({
          businessName: 'Business (from uploaded document)',
          uniqueValueProposition: 'Professional services and solutions',
          competitors: 'Industry competitors',
          colorPalette: 'Professional and modern colors',
          preferredFont: 'Clean, readable fonts'
        }),
        content: content.substring(0, 500) + '...',
        message: 'Document processed successfully (using fallback values - please review the extracted content)',
        extractedCount: 0,
        totalFields: 5
      });
    }
    
    // Count how many fields were successfully extracted
    const extractedCount = Object.values(extractedInfo).filter(value => value && value.trim() !== '').length;
    
    // Generate design prompt
    const designPrompt = generateDesignPrompt(extractedInfo);

    return NextResponse.json({
      success: true,
      extractedInfo,
      designPrompt,
      content: content.substring(0, 500) + '...', // Return first 500 chars for preview
      message: `Document processed successfully! Extracted ${extractedCount} out of 5 business information fields.`,
      extractedCount,
      totalFields: 5
    });

  } catch (error) {
    console.error('[process-document] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process document'
    }, { status: 500 });
  }
}