import { NextResponse } from 'next/server';
import { getRandomDesignSchema, getSchemaCount } from '../../../lib/design-schema-utils';

export async function GET() {
  try {
    const schema = getRandomDesignSchema();
    const totalSchemas = getSchemaCount();
    
    return NextResponse.json({
      success: true,
      selectedSchema: {
        id: schema?.id,
        url: schema?.url,
        hasComponents: !!schema?.schema?.components,
        componentCount: Object.keys(schema?.schema?.components || {}).length,
        hasPageStructure: !!schema?.schema?.page_structure,
        pageStructureLength: schema?.schema?.page_structure?.length || 0
      },
      totalSchemas,
      message: 'Redesign functionality is working correctly'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
