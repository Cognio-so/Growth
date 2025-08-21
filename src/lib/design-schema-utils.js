// Enhanced design-schema-utils.js with better random selection

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let schemaCache = null;
let lastUsedSchemaId = null;

// Enhanced tracking with separate regenerate tracking
let usedSchemaIds = new Set();
let regenerateUsedSchemaIds = new Set(); // Separate tracking for regenerate mode

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

  console.log('[design-schema-utils] Checking schema file locations:');
  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        const stats = fs.statSync(candidatePath);
        console.log(`[design-schema-utils] ✅ Found schema file at: ${candidatePath} (${stats.size} bytes)`);
        return candidatePath;
      }
    } catch (error) {
      console.log(`[design-schema-utils] ❌ Error checking ${candidatePath}: ${error.message}`);
    }
  }
  
  console.error('[design-schema-utils] ❌ Schema file not found in any location');
  return null;
}

export function parseDesignSchemas() {
  if (schemaCache) {
    console.log(`[design-schema-utils] Using cached schemas: ${schemaCache.length} entries`);
    return schemaCache;
  }

  const filePath = resolveSchemaPath();
  if (!filePath) {
    console.error('[design-schema-utils] Schema file not found - check file location and permissions');
    schemaCache = [];
    return schemaCache;
  }

  console.log(`[design-schema-utils] Reading schema from: ${filePath}`);

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('[design-schema-utils] Failed to read schema file:', error);
    schemaCache = [];
    return schemaCache;
  }

  const schemas = [];
  
  console.log('[design-schema-utils] Parsing Markdown format...');
  schemas.push(...parseMarkdownFormat(content));
  
  console.log(`[design-schema-utils] ✅ Parsing complete: ${schemas.length} valid schemas found`);
  schemaCache = schemas;
  return schemas;
}

function parseMarkdownFormat(content) {
  const schemas = [];
  
  // Improved regex that handles the fixed format better
  const schemaRegex = /(\d+)[-:]\s*(?:Url|URL):\s*\[([^\]]+)\]\([^)]+\)\s*\n(?:Schema|SCHEMA)\s*:\s*\n?(\{[\s\S]*?\})\s*(?=\n\d+[-:]\s*(?:Url|URL):|$)/g;
  
  let match;
  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaId = parseInt(match[1]);
    const url = match[2];
    let jsonContent = match[3];
    
    // Clean up the JSON content
    jsonContent = jsonContent.trim();
    
    try {
      // Parse the JSON (should work now with fixed formatting)
      const schema = JSON.parse(jsonContent);
      
      if (!schema.components) {
        console.warn(`[design-schema-utils] ⚠️ Invalid schema structure for ID ${schemaId} - missing components`);
        continue;
      }
      
      schemas.push({
        id: schemaId,
        url: url.trim(),
        schema: schema
      });
      
      console.log(`[design-schema-utils] ✅ Parsed schema ID ${schemaId}: ${url}`);
      
    } catch (parseError) {
      console.error(`[design-schema-utils] ❌ JSON parse error for ID ${schemaId}:`, parseError.message);
      console.error(`[design-schema-utils] JSON content preview:`, jsonContent.substring(0, 200));
    }
  }
  
  return schemas;
}

function _selectRandomSchemaFromPool(options = {}) {
  const { 
    excludeLastUsed = false, 
    excludeAllUsed = false,
    mode = 'normal', // 'normal', 'regenerate', 'redesign'
    userRequest = ''
  } = options;
  
  const schemas = parseDesignSchemas();
  
  if (!schemas || schemas.length === 0) {
    console.error('[design-schema-utils] ❌ No schemas available for random selection');
    return null;
  }

  let availableSchemas = schemas;
  let trackingSet = mode === 'regenerate' ? regenerateUsedSchemaIds : usedSchemaIds;

  console.log(`[design-schema-utils] 🎯 Schema selection mode: ${mode.toUpperCase()}`);
  console.log(`[design-schema-utils] 📊 Available schemas:`, schemas.map(s => `ID:${s.id} (${s.url})`));
  console.log(`[design-schema-utils] 📈 Tracking stats:`, {
    total: schemas.length,
    normalUsed: Array.from(usedSchemaIds),
    regenerateUsed: Array.from(regenerateUsedSchemaIds),
    lastUsed: lastUsedSchemaId
  });

  // Handle different selection modes
  if (mode === 'regenerate') {
    // For regenerate: exclude ALL previously used schemas in regenerate mode
    availableSchemas = schemas.filter(s => !regenerateUsedSchemaIds.has(s.id));
    if (availableSchemas.length === 0) {
      console.log(`[design-schema-utils] 🔄 All ${schemas.length} schemas used in regenerate mode. Resetting regenerate tracking.`);
      regenerateUsedSchemaIds.clear();
      availableSchemas = schemas;
    }
  } else if (mode === 'redesign') {
    // For redesign: exclude ALL previously used schemas (both normal and regenerate)
    const allUsedIds = new Set([...usedSchemaIds, ...regenerateUsedSchemaIds]);
    availableSchemas = schemas.filter(s => !allUsedIds.has(s.id));
    if (availableSchemas.length === 0) {
      console.log(`[design-schema-utils] 🔄 All ${schemas.length} schemas used. Resetting all tracking for redesign.`);
      usedSchemaIds.clear();
      regenerateUsedSchemaIds.clear();
      availableSchemas = schemas;
    }
  } else if (excludeAllUsed) {
    // Legacy: exclude all used schemas
    availableSchemas = schemas.filter(s => !usedSchemaIds.has(s.id));
    if (availableSchemas.length === 0) {
      console.log(`[design-schema-utils] 🔄 All ${schemas.length} schemas have been used. Resetting tracking.`);
      usedSchemaIds.clear();
      availableSchemas = schemas;
    }
  } else {
    // Normal mode: exclude used schemas but allow reuse if all are used
    availableSchemas = schemas.filter(s => !usedSchemaIds.has(s.id));
    if (availableSchemas.length === 0) {
      console.log(`[design-schema-utils] 🔄 All ${schemas.length} schemas have been used. Resetting tracking.`);
      usedSchemaIds.clear();
      availableSchemas = schemas;
    }
  }
  
  // Exclude last used schema if requested and we have options
  if (excludeLastUsed && lastUsedSchemaId !== null && availableSchemas.length > 1) {
    const filtered = availableSchemas.filter(s => s.id !== lastUsedSchemaId);
    if (filtered.length > 0) {
      availableSchemas = filtered;
      console.log(`[design-schema-utils] ⭐ Excluded last used schema ID: ${lastUsedSchemaId}`);
    }
  }

  console.log(`[design-schema-utils] 🎲 Available for selection:`, availableSchemas.map(s => `ID:${s.id}`));

  // Select random schema
  const randomIndex = Math.floor(Math.random() * availableSchemas.length);
  const selectedSchema = availableSchemas[randomIndex];

  if (!selectedSchema) {
    console.error(`[design-schema-utils] ❌ Critical error: Could not select a random schema.`);
    return null;
  }

  // Track the selected schema
  if (mode === 'regenerate') {
    regenerateUsedSchemaIds.add(selectedSchema.id);
  } else if (mode === 'redesign') {
    // For redesign, track in normal used schemas
    usedSchemaIds.add(selectedSchema.id);
  } else {
    usedSchemaIds.add(selectedSchema.id);
  }
  lastUsedSchemaId = selectedSchema.id;

  console.log(`[design-schema-utils] ✅ SELECTED Schema ID: ${selectedSchema.id}`);
  console.log(`[design-schema-utils] 🌐 URL: ${selectedSchema.url}`);
  console.log(`[design-schema-utils] 📋 Components: ${Object.keys(selectedSchema.schema.components || {}).length}`);
  console.log(`[design-schema-utils] 📈 Updated tracking:`, {
    mode,
    normalUsed: usedSchemaIds.size,
    regenerateUsed: regenerateUsedSchemaIds.size,
    totalAvailable: schemas.length
  });
  
  return selectedSchema;
}

// MAIN EXPORT FUNCTIONS

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
    excludeLastUsed: true,
    mode: 'redesign',
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

// Test function to verify random selection works
export function testRandomSelection(iterations = 5) {
  console.log(`\n[design-schema-utils] --- Testing random selection (${iterations} iterations) ---`);
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\n--- Test ${i + 1} ---`);
    const schema = getRandomDesignSchema(`test-${i + 1}`);
    
    if (schema) {
      results.push({
        iteration: i + 1,
        id: schema.id,
        url: schema.url,
        componentCount: Object.keys(schema.schema.components || {}).length
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
  
  return results;
}

export function getRedesignSchema(userRequest = '') {
  console.log("\n[design-schema-utils] --- Getting FRESH schema for REDESIGN (excluding ALL used schemas) ---");
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'redesign',
    userRequest 
  });
}
export function getSchemaForUrl(url, userRequest = '') {
  console.log(`\n[design-schema-utils] --- Getting schema optimized for URL: ${url} ---`);
  console.log(`[design-schema-utils] User request: "${userRequest}"`);
  
  // For now, we'll use random selection
  // TODO: Future enhancement could analyze URL content to match schema
  return _selectRandomSchemaFromPool({ 
    mode: 'url_based',
    userRequest,
    targetUrl: url 
  });
}

// ENHANCED: Get schema based on content type
export function getSchemaForContentType(contentType, userRequest = '') {
  const schemas = parseDesignSchemas();
  
  // Try to match schema based on content type
  // This is a simple implementation - could be enhanced with ML/AI matching
  const contentTypeKeywords = {
    'medical': ['clinic', 'medical', 'health', 'doctor', 'spa'],
    'business': ['business', 'corporate', 'professional', 'company'],
    'ecommerce': ['shop', 'store', 'product', 'buy', 'commerce'],
    'portfolio': ['portfolio', 'gallery', 'showcase', 'artist'],
    'blog': ['blog', 'news', 'article', 'content'],
    'landing': ['landing', 'marketing', 'promo', 'campaign']
  };
  
  console.log(`\n[design-schema-utils] --- Getting schema for content type: ${contentType} ---`);
  
  // For now, return random schema - but log the intent for future enhancement
  console.log(`[design-schema-utils] Content type matching not yet implemented, using random selection`);
  
  return _selectRandomSchemaFromPool({ 
    mode: 'content_based',
    userRequest,
    contentType 
  });
}

export function getDesignSchemaByUrl(url) {
  const schemas = parseDesignSchemas();
  const found = schemas.find(schema => schema.url === url);
  
  if (found) {
    console.log(`[design-schema-utils] ✅ Found schema by URL: ID ${found.id} - ${found.url}`);
  } else {
    console.log(`[design-schema-utils] ❌ No schema found for URL: ${url}`);
  }
  
  return found || null;
}

export function getSchemaCount() {
  const schemas = parseDesignSchemas();
  console.log(`[design-schema-utils] Total schemas available: ${schemas.length}`);
  return schemas.length;
}

export function getSchemaUsageStats() {
  const schemas = parseDesignSchemas();
  const stats = {
    total: schemas.length,
    normalUsed: usedSchemaIds.size,
    regenerateUsed: regenerateUsedSchemaIds.size,
    normalRemaining: schemas.length - usedSchemaIds.size,
    regenerateRemaining: schemas.length - regenerateUsedSchemaIds.size,
    normalUsedIds: Array.from(usedSchemaIds),
    regenerateUsedIds: Array.from(regenerateUsedSchemaIds),
    lastUsed: lastUsedSchemaId
  };
  
  console.log('[design-schema-utils] Usage Statistics:', stats);
  return stats;
}

export function resetSchemaTracking(mode = 'all') {
  if (mode === 'all' || mode === 'normal') {
    usedSchemaIds.clear();
    console.log('[design-schema-utils] Normal schema tracking reset');
  }
  
  if (mode === 'all' || mode === 'regenerate') {
    regenerateUsedSchemaIds.clear();
    console.log('[design-schema-utils] Regenerate schema tracking reset');
  }
  
  if (mode === 'all') {
    lastUsedSchemaId = null;
    console.log('[design-schema-utils] All schema tracking reset');
  }
}

export function testSchemaParsing() {
  console.log('[design-schema-utils] Testing schema parsing...');
  const schemas = parseDesignSchemas();
  const success = schemas.length > 0;
  
  console.log(`[design-schema-utils] Test result: ${schemas.length} schemas parsed`);
  
  if (success) {
    console.log('[design-schema-utils] Sample schemas:');
    schemas.slice(0, 3).forEach(s => {
      console.log(`  - ID ${s.id}: ${s.url} (${Object.keys(s.schema.components || {}).length} components)`);
    });
  }
  
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

export function debugSchemaStructure() {
  const filePath = resolveSchemaPath();
  if (!filePath) {
    return {
      success: false,
      error: 'Schema file not found'
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const analysis = {
      totalLines: lines.length,
      totalSize: content.length,
      firstFewLines: lines.slice(0, 5),
      schemaPatterns: [],
      fileType: 'Markdown'
    };

    const schemaRegex = /(\d+)[-:]\s*(?:Url|URL):\s*\[([^\]]+)\]\([^)]+\)\s*\n(?:Schema|SCHEMA)\s*:\s*\n?(\{[\s\S]*?\})\s*(?=\n\d+[-:]\s*(?:Url|URL):|$)/g;
    let match;
    while ((match = schemaRegex.exec(content)) !== null) {
      analysis.schemaPatterns.push({
        id: parseInt(match[1]),
        url: match[2]
      });
    }

    console.log('[design-schema-utils] Schema structure analysis:', analysis);

    return {
      success: true,
      filePath,
      analysis
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
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