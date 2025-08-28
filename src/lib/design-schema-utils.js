// Enhanced design-schema-utils.js with better random selection and tracking

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let schemaCache = null;
let lastUsedSchemaId = null;

// FIXED: Use persistent tracking that doesn't reset between requests
let usedSchemaIds = new Set();
let regenerateUsedSchemaIds = new Set();
let redesignUsedSchemaIds = new Set(); // Separate tracking for redesign mode

const DEFAULT_FILE_NAME = 'SCHEMA.md';

function resolveSchemaPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    process.env.G99_SCHEMA_PATH,
    path.join(process.cwd(), 'config', DEFAULT_FILE_NAME),
    path.join(process.cwd(), 'src/config', DEFAULT_FILE_NAME),
    path.join(process.cwd(), 'app/config', DEFAULT_FILE_NAME),
    path.join(__dirname, '..', 'config', DEFAULT_FILE_NAME),
    path.join(__dirname, '../config', DEFAULT_FILE_NAME),
    path.join('/mnt/data', DEFAULT_FILE_NAME),
  ].filter(Boolean);

  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    } catch (error) {
      console.log(`[design-schema-utils] Error checking ${candidatePath}: ${error.message}`);
    }
  }
  
  console.error('[design-schema-utils] Schema file not found in any location');
  return null;
}

export function parseDesignSchemas() {
  if (schemaCache) {
    console.log(`[design-schema-utils] Using cached schemas: ${schemaCache.length} entries`);
    return schemaCache;
  }

  const filePath = resolveSchemaPath();
  if (!filePath) {
    console.error('[design-schema-utils] Schema file not found');
    schemaCache = [];
    return schemaCache;
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('[design-schema-utils] Failed to read schema file:', error);
    schemaCache = [];
    return schemaCache;
  }

  const schemas = [];
  schemas.push(...parseMarkdownFormat(content));
  
  schemaCache = schemas;
  return schemas;
}

function parseMarkdownFormat(content) {
  const schemas = [];
  const schemaRegex = /(\d+)[-:]\s*(?:Url|URL):\s*\[([^\]]+)\]\([^)]+\)\s*\n(?:Schema|SCHEMA)\s*:\s*\n?(\{[\s\S]*?\})\s*(?=\n\d+[-:]\s*(?:Url|URL):|$)/g;
  
  let match;
  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaId = parseInt(match[1]);
    const url = match[2];
    let jsonContent = match[3].trim();
    
    try {
      const schema = JSON.parse(jsonContent);
      
      if (!schema.components) {
        console.warn(`[design-schema-utils] Invalid schema structure for ID ${schemaId} - missing components`);
        continue;
      }
      
      schemas.push({
        id: schemaId,
        url: url.trim(),
        schema: schema
      });
      
    } catch (parseError) {
      console.error(`[design-schema-utils] JSON parse error for ID ${schemaId}:`, parseError.message);
    }
  }
  
  return schemas;
}

// IMPROVED: Better random selection with guaranteed uniqueness
function _selectRandomSchemaFromPool(options = {}) {
  const { 
    mode = 'normal',
    userRequest = '',
    forceReset = false
  } = options;
  
  const schemas = parseDesignSchemas();
  
  if (!schemas || schemas.length === 0) {
    console.error('[design-schema-utils] No schemas available for random selection');
    return null;
  }

  // Choose the appropriate tracking set based on mode
  let trackingSet;
  switch (mode) {
    case 'regenerate':
      trackingSet = regenerateUsedSchemaIds;
      break;
    case 'redesign':
      trackingSet = redesignUsedSchemaIds;
      break;
    default:
      trackingSet = usedSchemaIds;
  }

  console.log(`[design-schema-utils] Schema selection mode: ${mode.toUpperCase()}`);
  console.log(`[design-schema-utils] Available schemas:`, schemas.map(s => `ID:${s.id} (${s.url})`));
  console.log(`[design-schema-utils] Tracking stats:`, {
    total: schemas.length,
    normalUsed: Array.from(usedSchemaIds),
    regenerateUsed: Array.from(regenerateUsedSchemaIds),
    redesignUsed: Array.from(redesignUsedSchemaIds),
    lastUsed: lastUsedSchemaId
  });

  // CRITICAL FIX: Get unused schemas
  let availableSchemas = schemas.filter(s => !trackingSet.has(s.id));
  
  // If all schemas are used in this mode, reset tracking for this mode only
  if (availableSchemas.length === 0 || forceReset) {
    console.log(`[design-schema-utils] All schemas used in ${mode} mode. Resetting ${mode} tracking.`);
    trackingSet.clear();
    availableSchemas = schemas;
    
    // Also exclude the last used schema to ensure we don't immediately repeat
    if (lastUsedSchemaId !== null && availableSchemas.length > 1) {
      const filtered = availableSchemas.filter(s => s.id !== lastUsedSchemaId);
      if (filtered.length > 0) {
        availableSchemas = filtered;
        console.log(`[design-schema-utils] Excluded last used schema ID: ${lastUsedSchemaId}`);
      }
    }
  }

  console.log(`[design-schema-utils] Available for selection:`, availableSchemas.map(s => `ID:${s.id}`));

  if (availableSchemas.length === 0) {
    console.error('[design-schema-utils] No available schemas after filtering');
    return null;
  }

  // IMPROVED: Better randomization
  const randomIndex = Math.floor(Math.random() * availableSchemas.length);
  const selectedSchema = availableSchemas[randomIndex];

  if (!selectedSchema) {
    console.error('[design-schema-utils] Could not select a random schema');
    return null;
  }

  // CRITICAL: Track the selected schema
  trackingSet.add(selectedSchema.id);
  lastUsedSchemaId = selectedSchema.id;

  console.log(`[design-schema-utils] SELECTED Schema ID: ${selectedSchema.id}`);
  console.log(`[design-schema-utils] URL: ${selectedSchema.url}`);
  console.log(`[design-schema-utils] Components: ${Object.keys(selectedSchema.schema.components || {}).length}`);
  console.log(`[design-schema-utils] Updated tracking:`, {
    mode,
    normalUsed: usedSchemaIds.size,
    regenerateUsed: regenerateUsedSchemaIds.size,
    redesignUsed: redesignUsedSchemaIds.size,
    totalAvailable: schemas.length
  });
  
  return selectedSchema;
}

// MAIN EXPORT FUNCTIONS - IMPROVED

export function getRandomDesignSchema(userRequest = '') {
  console.log("\n[design-schema-utils] --- Getting random design schema ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'normal',
    userRequest 
  });
}

export function getDifferentRandomDesignSchema(userRequest = '') {
  console.log("\n[design-schema-utils] --- Getting DIFFERENT random design schema ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'normal', // Use normal mode but exclude last used
    userRequest 
  });
}

export function getRegenerateDesignSchema(userRequest = '') {
  console.log("\n[design-schema-utils] --- Getting NEW schema for REGENERATE (excluding regenerate-used) ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'regenerate',
    userRequest 
  });
}

export function getRedesignSchema(userRequest = '') {
  console.log("\n[design-schema-utils] --- Getting FRESH schema for REDESIGN (excluding redesign-used) ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'redesign',
    userRequest 
  });
}

// ENHANCED: Force get a different schema than the last one used
export function getFreshDesignSchema(userRequest = '', excludeLastUsed = true) {
  console.log("\n[design-schema-utils] --- Getting FRESH design schema (guaranteed different) ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  console.log(`[design-schema-utils] Exclude last used: ${excludeLastUsed}`);
  
  const schemas = parseDesignSchemas();
  if (schemas.length <= 1) {
    return _selectRandomSchemaFromPool({ mode: 'normal', userRequest });
  }

  // If we want to exclude the last used and we have more than 1 schema
  if (excludeLastUsed && lastUsedSchemaId !== null) {
    const availableSchemas = schemas.filter(s => s.id !== lastUsedSchemaId);
    
    if (availableSchemas.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableSchemas.length);
      const selectedSchema = availableSchemas[randomIndex];
      
      // Track the selection
      usedSchemaIds.add(selectedSchema.id);
      lastUsedSchemaId = selectedSchema.id;
      
      console.log(`[design-schema-utils] SELECTED Fresh Schema ID: ${selectedSchema.id} (excluded last used: ${lastUsedSchemaId})`);
      return selectedSchema;
    }
  }

  return _selectRandomSchemaFromPool({ mode: 'normal', userRequest });
}

// TESTING AND DEBUG FUNCTIONS

export function testRandomSelection(iterations = 10) {
  console.log(`\n[design-schema-utils] --- Testing random selection (${iterations} iterations) ---`);
  
  // Reset all tracking for clean test
  resetSchemaTracking('all');
  
  const results = [];
  const seenIds = new Set();
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\n--- Test ${i + 1} ---`);
    const schema = getRandomDesignSchema(`test-${i + 1}`);
    
    if (schema) {
      const isRepeat = seenIds.has(schema.id);
      seenIds.add(schema.id);
      
      results.push({
        iteration: i + 1,
        id: schema.id,
        url: schema.url,
        componentCount: Object.keys(schema.schema.components || {}).length,
        isRepeat: isRepeat
      });
    } else {
      results.push({
        iteration: i + 1,
        error: 'No schema returned'
      });
    }
  }
  
  console.log('\n[design-schema-utils] TEST RESULTS:');
  console.table(results);
  
  // Count unique schemas
  const uniqueCount = seenIds.size;
  const totalSchemas = parseDesignSchemas().length;
  
  console.log(`\n[design-schema-utils] SUMMARY:`);
  console.log(`- Unique schemas selected: ${uniqueCount}/${totalSchemas}`);
  console.log(`- Repeats detected: ${results.filter(r => r.isRepeat).length}`);
  console.log(`- Success rate: ${((uniqueCount / Math.min(iterations, totalSchemas)) * 100).toFixed(1)}%`);
  
  return results;
}

export function getSchemaCount() {
  const schemas = parseDesignSchemas();
  return schemas.length;
}

export function getSchemaUsageStats() {
  const schemas = parseDesignSchemas();
  return {
    total: schemas.length,
    normalUsed: usedSchemaIds.size,
    regenerateUsed: regenerateUsedSchemaIds.size,
    redesignUsed: redesignUsedSchemaIds.size,
    normalRemaining: schemas.length - usedSchemaIds.size,
    regenerateRemaining: schemas.length - regenerateUsedSchemaIds.size,
    redesignRemaining: schemas.length - redesignUsedSchemaIds.size,
    normalUsedIds: Array.from(usedSchemaIds),
    regenerateUsedIds: Array.from(regenerateUsedSchemaIds),
    redesignUsedIds: Array.from(redesignUsedSchemaIds),
    lastUsed: lastUsedSchemaId
  };
}

export function resetSchemaTracking(mode = 'all') {
  console.log(`[design-schema-utils] Resetting schema tracking: ${mode}`);
  
  if (mode === 'all' || mode === 'normal') {
    const oldSize = usedSchemaIds.size;
    usedSchemaIds.clear();
    console.log(`[design-schema-utils] Normal schema tracking reset (was ${oldSize})`);
  }
  
  if (mode === 'all' || mode === 'regenerate') {
    const oldSize = regenerateUsedSchemaIds.size;
    regenerateUsedSchemaIds.clear();
    console.log(`[design-schema-utils] Regenerate schema tracking reset (was ${oldSize})`);
  }
  
  if (mode === 'all' || mode === 'redesign') {
    const oldSize = redesignUsedSchemaIds.size;
    redesignUsedSchemaIds.clear();
    console.log(`[design-schema-utils] Redesign schema tracking reset (was ${oldSize})`);
  }
  
  if (mode === 'all') {
    lastUsedSchemaId = null;
    console.log('[design-schema-utils] Last used schema reset');
  }
}

// Keep existing functions for compatibility
export function getDesignSchemaByUrl(url) {
  const schemas = parseDesignSchemas();
  return schemas.find(schema => schema.url === url) || null;
}

export function testSchemaParsing() {
  const schemas = parseDesignSchemas();
  const success = schemas.length > 0;
  
  return {
    success,
    totalSchemas: schemas.length,
    schemas: schemas.slice(0, 3).map(s => ({ 
      id: s.id, 
      url: s.url, 
      componentCount: Object.keys(s.schema.components || {}).length 
    }))
  };
}

export function extractDesignPatterns(designSchema) {
  if (!designSchema || !designSchema.schema) {
    return null;
  }

  const patterns = {
    colorPalette: {},
    typography: {},
    spacing: {}
  };

  try {
    const schema = designSchema.schema;

    if (schema.components) {
      for (const [componentName, component] of Object.entries(schema.components)) {
        if (component.colors) {
          patterns.colorPalette[componentName] = component.colors;
        }
        if (component.typography) {
          patterns.typography[componentName] = component.typography;
        }
        if (component.spacing) {
          patterns.spacing[componentName] = component.spacing;
        }
      }
    }

    return patterns;
  } catch (error) {
    console.error('[design-schema-utils] Error extracting design patterns:', error);
    return null;
  }
}

export function schemaToUIPrinciples(designSchema) {
  if (!designSchema || !designSchema.schema) {
    return '';
  }

  try {
    const schema = designSchema.schema;
    let principles = '';

    if (schema.design_system) {
      principles += `\n### Design System:\n${JSON.stringify(schema.design_system, null, 2)}\n`;
    }

    if (schema.layout_guidelines) {
      principles += `\n### Layout Guidelines:\n${JSON.stringify(schema.layout_guidelines, null, 2)}\n`;
    }

    if (schema.components) {
      principles += `\n### Component Guidelines:\n`;
      for (const [componentName, component] of Object.entries(schema.components)) {
        principles += `\n**${componentName}:**\n`;
        if (component.description) {
          principles += `- Description: ${component.description}\n`;
        }
        if (component.type) {
          principles += `- Type: ${component.type}\n`;
        }
      }
    }

    return principles;
  } catch (error) {
    console.error('[design-schema-utils] Error converting schema to UI principles:', error);
    return '';
  }
}

// ENHANCED: Comprehensive schema extraction for AI code generation
export function extractCompleteSchemaForAI(designSchema) {
  if (!designSchema || !designSchema.schema) {
    console.error('[design-schema-utils] No valid design schema provided for extraction');
    return null;
  }

  try {
    const schema = designSchema.schema;
    const extraction = {
      metadata: {
        schemaId: designSchema.id,
        sourceUrl: designSchema.url,
        extractionTimestamp: new Date().toISOString(),
        totalComponents: Object.keys(schema.components || {}).length
      },
      components: {},
      pageStructure: [],
      designSystem: {},
      colorPalette: {},
      typographySystem: {},
      spacingSystem: {},
      implementationGuide: '',
      cssVariables: {},
      componentHierarchy: []
    };

    // Extract detailed component information
    if (schema.components) {
      for (const [componentName, component] of Object.entries(schema.components)) {
        const componentExtraction = {
          name: componentName,
          type: component.type || 'unknown',
          description: component.description || '',
          implementation: {
            typography: {},
            colors: {},
            spacing: {},
            layout: {},
            images: {},
            interactions: {}
          },
          cssClasses: [],
          htmlStructure: '',
          reactComponent: '',
          styling: {}
        };

        // Extract typography
        if (component.typography) {
          for (const [element, typography] of Object.entries(component.typography)) {
            componentExtraction.implementation.typography[element] = {
              visualDescription: typography.visual_description || '',
              weight: typography.weight || 'normal',
              letterSpacing: typography.letter_spacing || 'normal',
              textTransform: typography.text_transform || 'none',
              fontSize: typography.font_size || 'inherit',
              fontFamily: typography.font_family || 'inherit',
              lineHeight: typography.line_height || 'inherit'
            };
          }
        }

        // Extract colors
        if (component.colors) {
          componentExtraction.implementation.colors = {
            background: component.colors.background || 'transparent',
            text: component.colors.text || 'inherit',
            accent: component.colors.accent || 'inherit',
            border: component.colors.border || 'inherit',
            hover: component.colors.hover || 'inherit'
          };
        }

        // Extract spacing
        if (component.spacing) {
          componentExtraction.implementation.spacing = {
            padding: component.spacing.padding || '0',
            margin: component.spacing.margin || '0',
            gap: component.spacing.gap || '0'
          };
        }

        // Extract layout information
        componentExtraction.implementation.layout = {
          display: component.type === 'nav' ? 'flex' : 
                   component.type === 'grid' ? 'grid' : 
                   component.type === 'hero' ? 'block' : 'block',
          position: component.type === 'nav' ? 'fixed' : 'relative',
          width: component.type === 'hero' ? '100%' : 'auto',
          height: component.type === 'hero' ? 'auto' : 'auto'
        };

        // Extract image styling
        if (component.image_style) {
          componentExtraction.implementation.images = {
            style: component.image_style,
            objectFit: component.image_style.includes('background') ? 'cover' : 'contain',
            borderRadius: component.image_style.includes('rounded') ? '8px' : '0'
          };
        }

        // Generate CSS classes
        componentExtraction.cssClasses = generateCSSClasses(componentName, component);

        // Generate HTML structure
        componentExtraction.htmlStructure = generateHTMLStructure(componentName, component);

        // Generate React component structure
        componentExtraction.reactComponent = generateReactComponent(componentName, component);

        // Generate styling object
        componentExtraction.styling = generateStylingObject(component);

        extraction.components[componentName] = componentExtraction;
      }
    }

    // Extract page structure
    if (schema.page_structure) {
      extraction.pageStructure = schema.page_structure.map((item, index) => ({
        order: index + 1,
        component: item.component,
        description: item.description || `Component ${index + 1}`,
        implementation: extraction.components[item.component] || {}
      }));
    }

    // Extract design system
    if (schema.design_system) {
      extraction.designSystem = schema.design_system;
    }

    // Generate comprehensive color palette
    extraction.colorPalette = generateColorPalette(schema);

    // Generate typography system
    extraction.typographySystem = generateTypographySystem(schema);

    // Generate spacing system
    extraction.spacingSystem = generateSpacingSystem(schema);

    // Generate CSS variables
    extraction.cssVariables = generateCSSVariables(schema);

    // Generate component hierarchy
    extraction.componentHierarchy = generateComponentHierarchy(schema);

    // Generate implementation guide
    extraction.implementationGuide = generateImplementationGuide(extraction);

    console.log(`[design-schema-utils] Complete schema extraction successful for ID: ${designSchema.id}`);
    console.log(`[design-schema-utils] Extracted ${Object.keys(extraction.components).length} components`);
    console.log(`[design-schema-utils] Page structure has ${extraction.pageStructure.length} items`);

    return extraction;

  } catch (error) {
    console.error('[design-schema-utils] Error in complete schema extraction:', error);
    return null;
  }
}

// Helper function to generate CSS classes
function generateCSSClasses(componentName, component) {
  const classes = [];
  
  // Base class
  classes.push(`${componentName.replace(/_/g, '-')}`);
  
  // Type-based classes
  if (component.type) {
    classes.push(`${component.type}-component`);
  }
  
  // Color-based classes
  if (component.colors) {
    if (component.colors.background && component.colors.background !== 'transparent') {
      classes.push(`bg-${component.colors.background.replace(/\s+/g, '-')}`);
    }
    if (component.colors.text && component.colors.text !== 'inherit') {
      classes.push(`text-${component.colors.text.replace(/\s+/g, '-')}`);
    }
  }
  
  // Typography classes
  if (component.typography) {
    for (const [element, typography] of Object.entries(component.typography)) {
      if (typography.text_transform === 'uppercase') {
        classes.push(`${element}-uppercase`);
      }
      if (typography.weight) {
        classes.push(`${element}-${typography.weight}`);
      }
    }
  }
  
  return classes;
}

// Helper function to generate HTML structure
function generateHTMLStructure(componentName, component) {
  let html = '';
  
  switch (component.type) {
    case 'nav':
      html = '<nav class="' + componentName.replace(/_/g, '-') + '">\n  <div class="nav-container">\n    <div class="nav-logo"></div>\n    <ul class="nav-links"></ul>\n    <div class="nav-actions"></div>\n  </div>\n</nav>';
      break;
    case 'hero':
      html = '<section class="' + componentName.replace(/_/g, '-') + '">\n  <div class="hero-content">\n    <h1 class="hero-title"></h1>\n    <p class="hero-description"></p>\n    <button class="hero-cta"></button>\n  </div>\n</section>';
      break;
    case 'grid':
      html = '<div class="' + componentName.replace(/_/g, '-') + '">\n  <div class="grid-container">\n    <div class="grid-item"></div>\n  </div>\n</div>';
      break;
    case 'card_grid':
      html = '<div class="' + componentName.replace(/_/g, '-') + '">\n  <div class="cards-container">\n    <div class="card"></div>\n  </div>\n</div>';
      break;
    case 'footer':
      html = '<footer class="' + componentName.replace(/_/g, '-') + '">\n  <div class="footer-content">\n    <div class="footer-section"></div>\n  </div>\n</footer>';
      break;
    default:
      html = '<div class="' + componentName.replace(/_/g, '-') + '">\n  <div class="' + componentName.replace(/_/g, '-') + '-content"></div>\n</div>';
  }
  
  return html;
}

// Helper function to generate React component structure
function generateReactComponent(componentName, component) {
  const componentNamePascal = componentName.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
  
  let jsx = '';
  
  switch (component.type) {
    case 'nav':
      jsx = 'const ' + componentNamePascal + ' = () => {\n  return (\n    <nav className="' + componentName.replace(/_/g, '-') + '">\n      <div className="nav-container">\n        <div className="nav-logo"></div>\n        <ul className="nav-links"></ul>\n        <div className="nav-actions"></div>\n      </div>\n    </nav>\n  );\n};';
      break;
    case 'hero':
      jsx = 'const ' + componentNamePascal + ' = () => {\n  return (\n    <section className="' + componentName.replace(/_/g, '-') + '">\n      <div className="hero-content">\n        <h1 className="hero-title"></h1>\n        <p className="hero-description"></p>\n        <button className="hero-cta"></button>\n      </div>\n    </section>\n  );\n};';
      break;
    default:
      jsx = 'const ' + componentNamePascal + ' = () => {\n  return (\n    <div className="' + componentName.replace(/_/g, '-') + '">\n      <div className="' + componentName.replace(/_/g, '-') + '-content"></div>\n    </div>\n  );\n};';
  }
  
  return jsx;
}

// Helper function to generate styling object
function generateStylingObject(component) {
  const styling = {};
  
  // Colors
  if (component.colors) {
    styling.backgroundColor = component.colors.background || 'transparent';
    styling.color = component.colors.text || 'inherit';
  }
  
  // Typography
  if (component.typography) {
    for (const [element, typography] of Object.entries(component.typography)) {
      styling[element] = {
        fontWeight: typography.weight || 'normal',
        letterSpacing: typography.letter_spacing || 'normal',
        textTransform: typography.text_transform || 'none'
      };
    }
  }
  
  // Spacing
  if (component.spacing) {
    styling.padding = component.spacing.padding || '0';
    styling.margin = component.spacing.margin || '0';
  }
  
  return styling;
}

// Helper function to generate color palette
function generateColorPalette(schema) {
  const palette = {
    primary: {},
    secondary: {},
    accent: {},
    neutral: {},
    semantic: {}
  };
  
  if (schema.components) {
    for (const component of Object.values(schema.components)) {
      if (component.colors) {
        if (component.colors.background) {
          palette.primary.background = component.colors.background;
        }
        if (component.colors.text) {
          palette.primary.text = component.colors.text;
        }
        if (component.colors.accent) {
          palette.accent.primary = component.colors.accent;
        }
      }
    }
  }
  
  return palette;
}

// Helper function to generate typography system
function generateTypographySystem(schema) {
  const typographySystem = {
    headings: {},
    body: {},
    links: {},
    buttons: {}
  };
  
  if (schema.components) {
    for (const component of Object.values(schema.components)) {
      if (component.typography) {
        for (const [element, typographyData] of Object.entries(component.typography)) {
          if (element.includes('heading')) {
            typographySystem.headings[element] = typographyData;
          } else if (element.includes('body')) {
            typographySystem.body[element] = typographyData;
          } else if (element.includes('link')) {
            typographySystem.links[element] = typographyData;
          } else if (element.includes('button')) {
            typographySystem.buttons[element] = typographyData;
          }
        }
      }
    }
  }
  
  return typographySystem;
}

// Helper function to generate spacing system
function generateSpacingSystem(schema) {
  const spacing = {
    small: '0.5rem',
    medium: '1rem',
    large: '2rem',
    extraLarge: '4rem'
  };
  
  if (schema.components) {
    for (const component of Object.values(schema.components)) {
      if (component.spacing) {
        if (component.spacing.padding) {
          spacing.padding = component.spacing.padding;
        }
        if (component.spacing.margin) {
          spacing.margin = component.spacing.margin;
        }
      }
    }
  }
  
  return spacing;
}

// Helper function to generate CSS variables
function generateCSSVariables(schema) {
  const variables = {
    '--primary-color': '#007bff',
    '--secondary-color': '#6c757d',
    '--accent-color': '#ffc107',
    '--text-color': '#212529',
    '--background-color': '#ffffff',
    '--spacing-small': '0.5rem',
    '--spacing-medium': '1rem',
    '--spacing-large': '2rem',
    '--font-family-primary': 'system-ui, sans-serif',
    '--font-weight-normal': '400',
    '--font-weight-bold': '700'
  };
  
  // Override with schema-specific values
  if (schema.components) {
    for (const component of Object.values(schema.components)) {
      if (component.colors) {
        if (component.colors.background) {
          variables['--background-color'] = component.colors.background;
        }
        if (component.colors.text) {
          variables['--text-color'] = component.colors.text;
        }
        if (component.colors.accent) {
          variables['--accent-color'] = component.colors.accent;
        }
      }
    }
  }
  
  return variables;
}

// Helper function to generate component hierarchy
function generateComponentHierarchy(schema) {
  const hierarchy = [];
  
  if (schema.page_structure) {
    schema.page_structure.forEach((item, index) => {
      hierarchy.push({
        level: index + 1,
        component: item.component,
        parent: index === 0 ? null : schema.page_structure[index - 1].component,
        children: schema.page_structure[index + 1] ? [schema.page_structure[index + 1].component] : []
      });
    });
  }
  
  return hierarchy;
}

// Helper function to generate implementation guide
function generateImplementationGuide(extraction) {
  let guide = '# Implementation Guide for Schema ' + extraction.metadata.schemaId + '\n\n';
  
  guide += '## Overview\n';
  guide += 'This guide provides step-by-step instructions for implementing the design schema.\n\n';
  
  guide += '## Component Implementation Order\n';
  extraction.pageStructure.forEach((item, index) => {
    guide += (index + 1) + '. **' + item.component + '** - ' + item.description + '\n';
  });
  
  guide += '\n## CSS Variables\n';
  guide += 'Add these CSS variables to your root styles:\n';
  for (const [variable, value] of Object.entries(extraction.cssVariables)) {
    guide += variable + ': ' + value + ';\n';
  }
  
  guide += '\n## Component Details\n';
  for (const [componentName, component] of Object.entries(extraction.components)) {
    guide += '\n### ' + componentName + '\n';
    guide += '- Type: ' + component.type + '\n';
    guide += '- Description: ' + component.description + '\n';
    guide += '- CSS Classes: ' + component.cssClasses.join(', ') + '\n';
  }
  
  return guide;
}

// ENHANCED: Get comprehensive schema information for AI prompt
export function getSchemaForAIPrompt(designSchema) {
  if (!designSchema || !designSchema.schema) {
    return null;
  }

  const completeExtraction = extractCompleteSchemaForAI(designSchema);
  if (!completeExtraction) {
    return null;
  }

  return {
    metadata: completeExtraction.metadata,
    components: completeExtraction.components,
    pageStructure: completeExtraction.pageStructure,
    designSystem: completeExtraction.designSystem,
    colorPalette: completeExtraction.colorPalette,
    typographySystem: completeExtraction.typographySystem,
    spacingSystem: completeExtraction.spacingSystem,
    cssVariables: completeExtraction.cssVariables,
    componentHierarchy: completeExtraction.componentHierarchy,
    implementationGuide: completeExtraction.implementationGuide,
    rawSchema: designSchema.schema // Keep original for fallback
  };
}

// ENHANCED: Get formatted schema instructions for AI
export function getFormattedSchemaInstructions(designSchema) {
  if (!designSchema || !designSchema.schema) {
    return '';
  }

  const aiSchema = getSchemaForAIPrompt(designSchema);
  if (!aiSchema) {
    return '';
  }

  let instructions = '\n## 🎯 COMPREHENSIVE DESIGN SCHEMA IMPLEMENTATION\n\n';
  instructions += '**Schema ID:** ' + aiSchema.metadata.schemaId + '\n';
  instructions += '**Source:** ' + aiSchema.metadata.sourceUrl + '\n';
  instructions += '**Components:** ' + aiSchema.metadata.totalComponents + '\n\n';

  // Page Structure
  instructions += '### 📄 PAGE STRUCTURE (IMPLEMENT IN EXACT ORDER):\n';
  aiSchema.pageStructure.forEach((item, index) => {
    instructions += (index + 1) + '. **' + item.component + '** - ' + item.description + '\n';
  });

  // Component Specifications
  instructions += '\n###  COMPONENT SPECIFICATIONS:\n';
  for (const [componentName, component] of Object.entries(aiSchema.components)) {
    instructions += '\n**' + componentName + ':**\n';
    instructions += '- **Type:** ' + component.type + '\n';
    instructions += '- **Description:** ' + component.description + '\n';
    
    if (component.implementation.typography && Object.keys(component.implementation.typography).length > 0) {
      instructions += '- **Typography:**\n';
      for (const [element, typography] of Object.entries(component.implementation.typography)) {
        instructions += '  - ' + element + ': ' + (typography.visualDescription || typography.weight) + '\n';
      }
    }
    
    if (component.implementation.colors) {
      instructions += '- **Colors:** Background: ' + component.implementation.colors.background + ', Text: ' + component.implementation.colors.text + ', Accent: ' + component.implementation.colors.accent + '\n';
    }
    
    if (component.implementation.spacing) {
      instructions += '- **Spacing:** Padding: ' + component.implementation.spacing.padding + ', Margin: ' + component.implementation.spacing.margin + '\n';
    }
    
    if (component.implementation.images.style) {
      instructions += '- **Images:** ' + component.implementation.images.style + '\n';
    }
  }

  // CSS Variables
  instructions += '\n### 🎨 CSS VARIABLES:\n';
  for (const [variable, value] of Object.entries(aiSchema.cssVariables)) {
    instructions += variable + ': ' + value + ';\n';
  }

  // Color Palette
  instructions += '\n### 🌈 COLOR PALETTE:\n';
  for (const [category, colors] of Object.entries(aiSchema.colorPalette)) {
    if (Object.keys(colors).length > 0) {
      instructions += '**' + category + ':**\n';
      for (const [colorName, colorValue] of Object.entries(colors)) {
        instructions += '- ' + colorName + ': ' + colorValue + '\n';
      }
    }
  }

  // Implementation Instructions
  instructions += '\n### 📋 IMPLEMENTATION INSTRUCTIONS:\n';
  instructions += '1. **Follow the page structure order exactly**\n';
  instructions += '2. **Use the provided CSS variables for consistency**\n';
  instructions += '3. **Implement each component according to its specifications**\n';
  instructions += '4. **Apply the color palette consistently**\n';
  instructions += '5. **Use the typography system for text styling**\n';
  instructions += '6. **Follow the spacing system for layout**\n';

  return instructions;
}