export function extractBusinessInfoFromText(content) {
    const extracted = {
      businessName: '',
      uniqueValueProposition: '',
      competitors: '',
      colorPalette: '',
      preferredFont: ''
    };
  
    // Extract Business Name
    const businessNamePatterns = [
      /Business Name:\s*([^\n\r*]+)/i,
      /Company Name:\s*([^\n\r*]+)/i,
      /Organization:\s*([^\n\r*]+)/i
    ];
    
    for (const pattern of businessNamePatterns) {
      const match = content.match(pattern);
      if (match) {
        extracted.businessName = match[1].trim();
        break;
      }
    }
  
    // Extract Unique Value Proposition
    const uniqueValuePatterns = [
      /What makes your company unique or different from your competitors\?\s*([^\n\r*]+)/i,
      /Unique Value Proposition:\s*([^\n\r*]+)/i,
      /What sets you apart:\s*([^\n\r*]+)/i
    ];
    
    for (const pattern of uniqueValuePatterns) {
      const match = content.match(pattern);
      if (match) {
        extracted.uniqueValueProposition = match[1].trim();
        break;
      }
    }
  
    // Extract Competitors
    const competitorsPatterns = [
      /Competitors and Their Websites:\s*([^\n\r*]+)/i,
      /Competitors:\s*([^\n\r*]+)/i,
      /Competition:\s*([^\n\r*]+)/i
    ];
    
    for (const pattern of competitorsPatterns) {
      const match = content.match(pattern);
      if (match) {
        extracted.competitors = match[1].trim();
        break;
      }
    }
  
    // Extract Color Palette
    const colorPalettePatterns = [
      /Color Palette Scheme:\s*([^\n\r*]+)/i,
      /Color Scheme:\s*([^\n\r*]+)/i,
      /Brand Colors:\s*([^\n\r*]+)/i
    ];
    
    for (const pattern of colorPalettePatterns) {
      const match = content.match(pattern);
      if (match) {
        extracted.colorPalette = match[1].trim();
        break;
      }
    }
  
    // Extract Preferred Font
    const fontPatterns = [
      /Preferred Font Style for Website:\s*([^\n\r*]+)/i,
      /Font Preference:\s*([^\n\r*]+)/i,
      /Typography:\s*([^\n\r*]+)/i
    ];
    
    for (const pattern of fontPatterns) {
      const match = content.match(pattern);
      if (match) {
        extracted.preferredFont = match[1].trim();
        break;
      }
    }
  
    return extracted;
  }
  
  export function generateDesignPromptFromExtracted(extractedInfo) {
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