import { NextResponse } from 'next/server';
import { parseDesignSchemas, getSchemaUsageStats } from '../../../lib/design-schema-utils';

export async function POST() {
  try {
    console.log('[test-csv-parsing] Starting CSV analysis...');
    
    // Debug schema structure
    const csvDebug = getSchemaUsageStats();
    
    // Parse schemas
    const schemas = parseDesignSchemas();
    
    // Get sample schema details
    const sampleSchemas = schemas.slice(0, 3).map(schema => ({
      id: schema.id,
      url: schema.url,
      hasComponents: !!schema.schema?.components,
      componentCount: Object.keys(schema.schema?.components || {}).length,
      hasPageStructure: !!schema.schema?.page_structure,
      pageStructureLength: schema.schema?.page_structure?.length || 0,
      hasDesignSystem: !!schema.schema?.design_system
    }));
    
    return NextResponse.json({
      success: true,
      csvDebug,
      totalSchemas: schemas.length,
      sampleSchemas,
      allSchemaIds: schemas.map(s => s.id).sort((a, b) => a - b)
    });
  } catch (error) {
    console.error('[test-csv-parsing] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}
