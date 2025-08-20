// design-schema-utils.js (Complete)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let schemaCache = null;
let lastUsedSchemaId = null;

// Global tracking for used schemas - persists across sessions
let usedSchemaIds = new Set();

const DEFAULT_FILE_NAME = 'Growth-99-Design-Schema-Sheet.csv';

function resolveCsvPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Check multiple possible locations
  const candidates = [
    process.env.G99_SCHEMA_CSV_PATH,
    path.join(process.cwd(), 'config', DEFAULT_FILE_NAME),
    path.join(process.cwd(), 'src/config', DEFAULT_FILE_NAME),
    path.join(process.cwd(), 'app/config', DEFAULT_FILE_NAME),
    path.join(__dirname, '..', 'config', DEFAULT_FILE_NAME),
    path.join(__dirname, '../config', DEFAULT_FILE_NAME),
    path.join(process.cwd(), 'config', 'Growth99DesignSchemaSheet.csv'),
    path.join(process.cwd(), 'config', 'design-schema.csv'),
    path.join('/mnt/data', DEFAULT_FILE_NAME),
  ].filter(Boolean);

  console.log('[design-schema-utils] Checking CSV file locations:');
  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        const stats = fs.statSync(candidatePath);
        console.log(`[design-schema-utils] ✅ Found CSV at: ${candidatePath} (${stats.size} bytes)`);
        return candidatePath;
      }
    } catch (error) {
      console.log(`[design-schema-utils] ❌ Error checking ${candidatePath}: ${error.message}`);
    }
  }
  
  console.error('[design-schema-utils] ❌ CSV file not found in any location');
  return null;
}

export function parseDesignSchemas() {
  if (schemaCache) {
    console.log(`[design-schema-utils] Using cached schemas: ${schemaCache.length} entries`);
    return schemaCache;
  }

  const filePath = resolveCsvPath();
  if (!filePath) {
    console.error('[design-schema-utils] CSV file not found - check file location and permissions');
    schemaCache = [];
    return schemaCache;
  }

  console.log(`[design-schema-utils] Reading CSV from: ${filePath}`);

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('[design-schema-utils] Failed to read CSV file:', error);
    schemaCache = [];
    return schemaCache;
  }

  const headerRegex = /(?:^|\r?\n)(\d+),([^,\r\n]+),"```json\r?\n/g;
  const schemas = [];
  let match;
  
  console.log('[design-schema-utils] Starting CSV parsing...');
  
  while ((match = headerRegex.exec(content)) !== null) {
    const actualSchemaId = parseInt(match[1]);
    const url = match[2];
    
    const startPos = match.index + match[0].length;
    const jsonEndMatch = content.substring(startPos).match(/```\r?\n/);
    
    if (!jsonEndMatch) {
      console.warn(`[design-schema-utils] ⚠️ No JSON end marker found for entry with ID ${actualSchemaId}`);
      continue;
    }
    
    const jsonEndPos = startPos + jsonEndMatch.index;
    let jsonContent = content.substring(startPos, jsonEndPos);
    
    jsonContent = jsonContent.replace(/""/g, '"');
    
    try {
      const schema = JSON.parse(jsonContent);
      
      if (!schema.components || !schema.page_structure) {
        console.warn(`[design-schema-utils] ⚠️ Invalid schema structure for ID ${actualSchemaId}`);
        continue;
      }
      
      schemas.push({
        id: actualSchemaId,
        url: url.trim(),
        schema: schema
      });
      
    } catch (parseError) {
      console.error(`[design-schema-utils] ❌ JSON parse error for ID ${actualSchemaId}:`, parseError.message);
    }
  }
  
  console.log(`[design-schema-utils] ✅ Parsing complete: ${schemas.length} valid schemas found`);
  schemaCache = schemas;
  return schemas;
}


function _selectRandomSchemaFromPool(options = {}) {
  const { excludeLastUsed = false } = options;
  const schemas = parseDesignSchemas();
  
  if (!schemas || schemas.length === 0) {
    console.error('[design-schema-utils] ❌ No schemas available for random selection');
    return null;
  }

  let availableSchemas = schemas.filter(s => !usedSchemaIds.has(s.id));

  if (availableSchemas.length === 0) {
    console.log(`[design-schema-utils] 🔄 All ${schemas.length} schemas have been used. Resetting tracking.`);
    usedSchemaIds.clear();
    availableSchemas = schemas;
  }
  
  if (excludeLastUsed && lastUsedSchemaId !== null && availableSchemas.length > 1) {
      const filtered = availableSchemas.filter(s => s.id !== lastUsedSchemaId);
      if (filtered.length > 0) {
        availableSchemas = filtered;
      }
  }

  const randomIndex = Math.floor(Math.random() * availableSchemas.length);
  const selectedSchema = availableSchemas[randomIndex];

  if (!selectedSchema) {
    console.error(`[design-schema-utils] ❌ Critical error: Could not select a random schema.`);
    return null;
  }

  usedSchemaIds.add(selectedSchema.id);
  lastUsedSchemaId = selectedSchema.id;

  console.log(`[design-schema-utils] ✅ Randomly selected Schema ID: ${selectedSchema.id} (${selectedSchema.url})`);
  console.log(`[design-schema-utils]   Usage: ${usedSchemaIds.size} of ${schemas.length} used.`);
  
  return selectedSchema;
}

export function getRandomDesignSchema() {
  console.log("\n[design-schema-utils] --- Getting a new random design schema ---");
  return _selectRandomSchemaFromPool();
}

export function getDifferentRandomDesignSchema() {
    console.log("\n[design-schema-utils] --- Getting a DIFFERENT random design schema ---");
    return _selectRandomSchemaFromPool({ excludeLastUsed: true });
}

export function getDesignSchemaByUrl(url) {
  const schemas = parseDesignSchemas();
  return schemas.find(schema => schema.url === url) || null;
}

export function getSchemaCount() {
  const schemas = parseDesignSchemas();
  return schemas.length;
}

export function getSchemaUsageStats() {
  const schemas = parseDesignSchemas();
  return {
    total: schemas.length,
    used: usedSchemaIds.size,
    remaining: schemas.length - usedSchemaIds.size,
    usedIds: Array.from(usedSchemaIds),
    lastUsed: lastUsedSchemaId
  };
}

export function resetSchemaTracking() {
  usedSchemaIds.clear();
  lastUsedSchemaId = null;
  console.log('[design-schema-utils] Schema tracking reset');
}

export function testSchemaParsing() {
  console.log('[design-schema-utils] Testing schema parsing...');
  const schemas = parseDesignSchemas();
  console.log(`[design-schema-utils] Test result: ${schemas.length} schemas parsed`);
  return schemas.length > 0;
}

// Add the missing debugCsvStructure function
export function debugCsvStructure() {
  const filePath = resolveCsvPath();
  if (!filePath) {
    return {
      success: false,
      error: 'CSV file not found'
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Analyze CSV structure
    const analysis = {
      totalLines: lines.length,
      totalSize: content.length,
      firstFewLines: lines.slice(0, 5),
      schemaPatterns: [],
      jsonBlocks: 0
    };

    // Count JSON blocks
    const jsonBlockRegex = /```json\r?\n/g;
    let match;
    while ((match = jsonBlockRegex.exec(content)) !== null) {
      analysis.jsonBlocks++;
    }

    // Find schema patterns
    const headerRegex = /(?:^|\r?\n)(\d+),([^,\r\n]+),"```json\r?\n/g;
    while ((match = headerRegex.exec(content)) !== null) {
      analysis.schemaPatterns.push({
        id: parseInt(match[1]),
        url: match[2]
      });
    }

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

function extractUserRequest(prompt) {
  let userRequest = prompt;
  
  const prefixesToRemove = [
    'Create a modern, professional website based on this description:',
    'Generate a website based on the uploaded business document requirements:',
    'I want to recreate the',
    'Please create a complete React application',
    'Create a COMPLETE, working React application',
    'Use Tailwind CSS for all styling',
    'Make it responsive and modern'
  ];
  
  for (const prefix of prefixesToRemove) {
    userRequest = userRequest.replace(prefix, '').trim();
  }
  
  userRequest = userRequest.replace(/^["']|["']$/g, '').trim();
  
  if (userRequest.length > 200) {
    const firstSentence = userRequest.split(/[.!?]/)[0];
    if (firstSentence.length > 10) {
      userRequest = firstSentence.trim();
    }
  }
  
  return userRequest || 'website';
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