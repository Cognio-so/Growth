import { NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { selectFilesForEdit, getFileContents, formatFilesForAI } from '../../../lib/context-selector';
import { executeSearchPlan, formatSearchResultsForAI, selectTargetFile } from '../../../lib/file-search-executor';
import { getUIPrinciplesPrompt } from '../../../lib/ui-principles';
import appConfig from '../../../../config/app.config';
import { getRandomDesignSchema, getDifferentRandomDesignSchema, getRedesignSchema, getRegenerateDesignSchema, getDesignSchemaByUrl, extractDesignPatterns, schemaToUIPrinciples, getSchemaCount, testSchemaParsing, getSchemaUsageStats } from '../../../lib/design-schema-utils';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function analyzeUserPreferences(messages) {
  const commonPatterns = [];
  const preferredEditStyle = 'targeted' | 'comprehensive';

  const userMessages = messages.filter(m => m.role === 'user');
  const patterns = [];

  let targetedEditCount = 0;
  let comprehensiveEditCount = 0;

  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase();

    if (content.match(/\b(update|change|fix|modify|edit|remove|delete)\s+(\w+\s+)?(\w+)\b/)) {
      targetedEditCount++;
    }

    if (content.match(/\b(rebuild|recreate|redesign|overhaul|refactor)\b/)) {
      comprehensiveEditCount++;
    }

    if (content.includes('hero')) patterns.push('hero section edits');
    if (content.includes('header')) patterns.push('header modifications');
    if (content.includes('color') || content.includes('style')) patterns.push('styling changes');
    if (content.includes('button')) patterns.push('button updates');
    if (content.includes('animation')) patterns.push('animation requests');
  });

  return {
    commonPatterns: [...new Set(patterns)].slice(0, 3),
    preferredEditStyle: targetedEditCount > comprehensiveEditCount ? 'targeted' : 'comprehensive'
  };
}

export async function POST(request) {
  try {
    const { prompt, model = 'openai/gpt-oss-20b', context, isEdit = false, url: userProvidedUrl } = await request.json();

    console.log('[generate-ai-code-stream] Received request:');
    console.log('[generate-ai-code-stream] - prompt:', prompt);
    console.log('[generate-ai-code-stream] - isEdit:', isEdit);
    console.log('[generate-ai-code-stream] - userProvidedUrl:', userProvidedUrl);
    console.log('[generate-ai-code-stream] - context.sandboxId:', context?.sandboxId);
    console.log('[generate-ai-code-stream] - context.currentFiles:', context?.currentFiles ? Object.keys(context.currentFiles) : 'none');
    console.log('[generate-ai-code-stream] - currentFiles count:', context?.currentFiles ? Object.keys(context.currentFiles).length : 0);

    // Check if this is a redesign request - FIXED: Remove isEdit requirement
    const isRedesign = prompt.toLowerCase().includes('redesign') || prompt.toLowerCase().includes('rebuild') || prompt.toLowerCase().includes('replace');
    // Check if this is a regenerate request
    const isRegenerate = prompt.toLowerCase().includes('regenerate') || prompt.toLowerCase().includes('generate again') || prompt.toLowerCase().includes('create again');
    console.log('[generate-ai-code-stream] - isRedesign:', isRedesign);
    console.log('[generate-ai-code-stream] - isRegenerate:', isRegenerate);

    // UPDATED LOGIC: Intelligently select the best design schema based on user query
    let targetUrl = null;
    let designSchema = null;
    let schemaData = null;
    let shouldScrape = false;

    // STEP 1: Intelligently select the best design schema from SCHEMA.md based on user query
    console.log('[generate-ai-code-stream] 🔍 Intelligently selecting best design schema from SCHEMA.md...');
    
    // Test schema parsing first
    const schemaTest = testSchemaParsing();
    console.log('[generate-ai-code-stream] Schema Test Result:', schemaTest);
    
    if (schemaTest.success && schemaTest.totalSchemas > 0) {
      const userRequest = extractUserRequest(prompt);
      console.log('[generate-ai-code-stream] Extracted user request:', userRequest);
      
      // Get schema usage statistics
      const usageStats = getSchemaUsageStats();
      console.log('[generate-ai-code-stream] Schema usage stats:', usageStats);
      
      // SCENARIO 1: User provided URL - choose schema and scrape content
      if (userProvidedUrl && userProvidedUrl.startsWith('http')) {
        console.log('[generate-ai-code-stream] 🎯 SCENARIO 1: User provided URL - choosing schema and scraping content');
        
        // Choose a random schema for design patterns
        designSchema = getRandomDesignSchema();
        
        if (designSchema && designSchema.schema) {
          schemaData = designSchema.schema;
          targetUrl = userProvidedUrl;
          shouldScrape = true;
          
          console.log('[generate-ai-code-stream] ✅ SCHEMA SELECTED FOR URL SCENARIO:');
          console.log('[generate-ai-code-stream] - Schema URL:', designSchema.url);
          console.log('[generate-ai-code-stream] - Schema ID:', designSchema.id);
          console.log('[generate-ai-code-stream] - Target URL to scrape:', targetUrl);
          console.log('[generate-ai-code-stream] - Will scrape content and use schema design patterns');
        }
      }
      // SCENARIO 2: Regenerate request - choose different schema and create new design
      else if (isRegenerate) {
        console.log('[generate-ai-code-stream] 🔄 SCENARIO 2: Regenerate request - choosing different schema for new design');
        
        // Get a completely new schema (excluding all previously used)
        designSchema = getRegenerateDesignSchema();
        
        if (designSchema && designSchema.schema) {
          schemaData = designSchema.schema;
          
          console.log('[generate-ai-code-stream] ✅ NEW SCHEMA SELECTED FOR REGENERATE:');
          console.log('[generate-ai-code-stream] - Schema URL:', designSchema.url);
          console.log('[generate-ai-code-stream] - Schema ID:', designSchema.id);
          console.log('[generate-ai-code-stream] - Total schemas available:', getSchemaCount());
          console.log('[generate-ai-code-stream] - Schemas used so far:', usageStats.used);
          console.log('[generate-ai-code-stream] - Will create new design using schema patterns only');
        }
      }
      // SCENARIO 3: Normal request (no URL, no regenerate) - choose random schema
      else {
        console.log('[generate-ai-code-stream] SCENARIO 3: Normal request - choosing random schema for design');
        
        // Use different schema selection for redesigns
        if (isRedesign) {
          console.log('[generate-ai-code-stream] 🎨 REDESIGN MODE: Selecting different schema to avoid repetition');
          designSchema = getRedesignSchema();
        } else {
          // Use intelligent schema selection for new generations
          designSchema = getRandomDesignSchema();
        }
        
        if (designSchema && designSchema.schema) {
          schemaData = designSchema.schema;
          
          console.log('[generate-ai-code-stream] ✅ SCHEMA SELECTED FOR NORMAL REQUEST:');
          console.log('[generate-ai-code-stream] - Schema URL:', designSchema.url);
          console.log('[generate-ai-code-stream] - Schema ID:', designSchema.id);
          console.log('[generate-ai-code-stream] - Total schemas available:', getSchemaCount());
          console.log('[generate-ai-code-stream] - Schemas used so far:', usageStats.used);
          console.log('[generate-ai-code-stream] - Will create design using schema patterns only');
        }
      }
      
      if (designSchema && designSchema.schema) {
        // Extract design patterns for better implementation guidance
        const designPatterns = extractDesignPatterns(designSchema);
        console.log('[generate-ai-code-stream] Extracted design patterns:', Object.keys(designPatterns || {}));
      } else {
        console.warn('[generate-ai-code-stream] No schema found from selection');
      }
    } else {
      console.warn('[generate-ai-code-stream] Schema parsing failed, proceeding without design schema');
    }

    // STEP 2: Scrape the target URL if user provided one
    let scrapedContent = null;
    let screenshot = null;
    let businessInfo = null;
    
    if (targetUrl && shouldScrape) {
      try {
        console.log('[generate-ai-code-stream] Scraping URL for content:', targetUrl);
        
        // Scrape the URL content
        const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scrape-url-enhanced`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          if (scrapeData.success) {
            scrapedContent = scrapeData.content;
            businessInfo = scrapeData.structured?.businessInfo;
            console.log('[generate-ai-code-stream] Successfully scraped content from:', targetUrl);
            console.log('[generate-ai-code-stream] Content length:', scrapedContent.length);
            
            if (businessInfo) {
              console.log('[generate-ai-code-stream] Business info extracted:', businessInfo);
            }
          } else {
            console.warn('[generate-ai-code-stream] Scraping failed:', scrapeData.error);
          }
        } else {
          console.warn('[generate-ai-code-stream] Scraping request failed:', scrapeResponse.status);
        }

        // Get screenshot
        const screenshotResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scrape-screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });

        if (screenshotResponse.ok) {
          const screenshotData = await screenshotResponse.json();
          if (screenshotData.success) {
            screenshot = screenshotData.screenshot;
            console.log('[generate-ai-code-stream] Successfully captured screenshot from:', targetUrl);
          } else {
            console.warn('[generate-ai-code-stream] Screenshot failed:', screenshotData.error);
          }
        } else {
          console.warn('[generate-ai-code-stream] Screenshot request failed:', screenshotResponse.status);
        }

      } catch (error) {
        console.warn('[generate-ai-code-stream] Failed to scrape URL:', error.message);
        // Continue without scraped content - we'll still use the design schema
      }
    } else {
      if (userProvidedUrl) {
        console.log('[generate-ai-code-stream] User provided URL but scraping not needed - using schema design patterns only');
      } else {
        console.log('[generate-ai-code-stream] No URL provided - using SCHEMA.md design schema only');
      }
    }

    if (!global.conversationState) {
      global.conversationState = {
        conversationId: `conv-${Date.now()}`,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
        context: {
          messages: [],
          edits: [],
          projectEvolution: { majorChanges: [] },
          userPreferences: {}
        }
      };
    }

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      metadata: {
        sandboxId: context?.sandboxId,
        targetUrl: targetUrl,
        designSchema: designSchema ? { 
          id: designSchema.id, 
          url: designSchema.url,
          scrapedContent: scrapedContent ? true : false,
          screenshot: screenshot ? true : false,
          schemaData: schemaData ? true : false,
          scenario: userProvidedUrl ? 'URL_PROVIDED' : isRegenerate ? 'REGENERATE' : 'NORMAL_REQUEST'
        } : null,
        businessInfo: businessInfo
      }
    };
    global.conversationState.context.messages.push(userMessage);

    if (global.conversationState.context.messages.length > 20) {
      global.conversationState.context.messages = global.conversationState.context.messages.slice(-15);
      console.log('[generate-ai-code-stream] Trimmed conversation history to prevent context overflow');
    }

    if (global.conversationState.context.edits.length > 10) {
      global.conversationState.context.edits = global.conversationState.context.edits.slice(-8);
    }

    if (context?.currentFiles && Object.keys(context.currentFiles).length > 0) {
      const firstFile = Object.entries(context.currentFiles)[0];
      console.log('[generate-ai-code-stream] - sample file:', firstFile[0]);
      console.log('[generate-ai-code-stream] - sample content preview:',
        typeof firstFile[1] === 'string' ? firstFile[1].substring(0, 100) + '...' : 'not a string');
    }

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: 'Prompt is required'
      }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendProgress = async (data) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    (async () => {
      try {
        await sendProgress({ type: 'status', message: 'Initializing AI...' });

        let editContext = null;
        let enhancedSystemPrompt = '';

        if (isEdit) {
          console.log('[generate-ai-code-stream] Edit mode detected - starting agentic search workflow');
          console.log('[generate-ai-code-stream] Has fileCache:', !!global.sandboxState?.fileCache);
          console.log('[generate-ai-code-stream] Has manifest:', !!global.sandboxState?.fileCache?.manifest);

          const manifest = global.sandboxState?.fileCache?.manifest;

          if (manifest) {
            await sendProgress({ type: 'status', message: '🔍 Creating search plan...' });

            const fileContents = global.sandboxState?.fileCache?.files ?? {};
            console.log(
              '[generate-ai-code-stream] Files available for search:',
              Object.keys(fileContents).length
            );

            try {
              const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-edit-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, manifest, model })
              });

              if (intentResponse.ok) {
                const { searchPlan } = await intentResponse.json();
                console.log('[generate-ai-code-stream] Search plan received:', searchPlan);

                await sendProgress({
                  type: 'status',
                  message: `�� Searching for: "${searchPlan.searchTerms.join('", "')}"`
                });

                const searchExecution = executeSearchPlan(searchPlan,
                  Object.fromEntries(
                    Object.entries(fileContents).map(([path, data]) => [
                      path.startsWith('/') ? path : `/home/user/app/${path}`,
                      data.content
                    ])
                  )
                );

                console.log('[generate-ai-code-stream] Search execution:', {
                  success: searchExecution.success,
                  resultsCount: searchExecution.results.length,
                  filesSearched: searchExecution.filesSearched,
                  time: searchExecution.executionTime + 'ms'
                });

                if (searchExecution.success && searchExecution.results.length > 0) {
                  const target = selectTargetFile(searchExecution.results, searchPlan.editType);

                  if (target) {
                    await sendProgress({
                      type: 'status',
                      message: `🔍 Found code in ${target.filePath.split('/').pop()} at line ${target.lineNumber}`
                    });

                    console.log('[generate-ai-code-stream] Target selected:', target);

                    const normalizedPath = target.filePath.replace('/home/user/app/', '');
                    const fileContent = fileContents[normalizedPath]?.content || '';

                    enhancedSystemPrompt = `
${formatSearchResultsForAI(searchExecution.results)}

SURGICAL EDIT INSTRUCTIONS:
You have been given the EXACT location of the code to edit.
- File: ${target.filePath}
- Line: ${target.lineNumber}
- Reason: ${target.reason}

Make ONLY the change requested by the user. Do not modify any other code.
User request: "${prompt}"`;

                    editContext = {
                      primaryFiles: [target.filePath],
                      contextFiles: [],
                      systemPrompt: enhancedSystemPrompt,
                      editIntent: {
                        type: searchPlan.editType,
                        description: searchPlan.reasoning,
                        targetFiles: [target.filePath],
                        confidence: 0.95,
                        searchTerms: searchPlan.searchTerms
                      }
                    };

                    console.log('[generate-ai-code-stream] Surgical edit context created');
                  }
                } else {
                  console.warn('[generate-ai-code-stream] Search found no results, falling back to broader context');
                  await sendProgress({
                    type: 'status',
                    message: '🚫 Could not find exact match, using broader search...'
                  });
                }
              } else {
                console.error('[generate-ai-code-stream] Failed to get search plan');
              }
            } catch (error) {
              console.error('[generate-ai-code-stream] Error in agentic search workflow:', error);
              await sendProgress({
                type: 'status',
                message: '🚫 Search workflow error, falling back to keyword method...'
              });
              if (manifest) {
                editContext = selectFilesForEdit(prompt, manifest);
              }
            }
          } else {
            console.warn('[generate-ai-code-stream] AI intent analysis failed, falling back to keyword method');
            if (manifest) {
              editContext = selectFilesForEdit(prompt, manifest);
            } else {
              console.log('[generate-ai-code-stream] No manifest available for fallback');
              await sendProgress({
                type: 'status',
                message: '🚫 No file manifest available, will use broad context'
              });
            }
          }

          if (editContext) {
            enhancedSystemPrompt = editContext.systemPrompt;

            await sendProgress({
              type: 'status',
              message: `Identified edit type: ${editContext.editIntent?.description || 'Code modification'}`
            });
          } else if (!manifest) {
            console.log('[generate-ai-code-stream] WARNING: No manifest available for edit mode!');

            if (global.activeSandbox) {
              await sendProgress({ type: 'status', message: 'Fetching current files from sandbox...' });

              try {
                const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/get-sandbox-files`, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' }
                });

                if (filesResponse.ok) {
                  const filesData = await filesResponse.json();

                  if (filesData.success && filesData.manifest) {
                    console.log('[generate-ai-code-stream] Successfully fetched manifest from sandbox');
                    const manifest = filesData.manifest;

                    // Now try to analyze edit intent with the fetched manifest
                    try {
                      const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-edit-intent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, manifest, model })
                      });

                      if (intentResponse.ok) {
                        const { searchPlan } = await intentResponse.json();
                        console.log('[generate-ai-code-stream] Search plan received (after fetch):', searchPlan);

                        let targetFiles = [];
                        if (!searchPlan || searchPlan.searchTerms.length === 0) {
                          console.warn('[generate-ai-code-stream] No target files after fetch, searching for relevant files');

                          const promptLower = prompt.toLowerCase();
                          const allFilePaths = Object.keys(manifest.files);

                          // Look for component names mentioned in the prompt
                          if (promptLower.includes('hero')) {
                            targetFiles = allFilePaths.filter(p => p.toLowerCase().includes('hero'));
                          } else if (promptLower.includes('header')) {
                            targetFiles = allFilePaths.filter(p => p.toLowerCase().includes('header'));
                          } else if (promptLower.includes('footer')) {
                            targetFiles = allFilePaths.filter(p => p.toLowerCase().includes('footer'));
                          } else if (promptLower.includes('nav')) {
                            targetFiles = allFilePaths.filter(p => p.toLowerCase().includes('nav'));
                          } else if (promptLower.includes('button')) {
                            targetFiles = allFilePaths.filter(p => p.toLowerCase().includes('button'));
                          }

                          if (targetFiles.length > 0) {
                            console.log('[generate-ai-code-stream] Found target files by keyword search after fetch:', targetFiles);
                          }
                        }

                        const allFiles = Object.keys(manifest.files)
                          .filter(path => !targetFiles.includes(path));

                        // Use context selector with design schema
                        const contextResult = selectFilesForEdit(
                          prompt,
                          manifest,
                          businessInfo,
                          null, // documentDesignPrompt
                          designSchema // Pass the design schema
                        );

                        editContext = {
                          ...editContext,
                          ...contextResult,
                          designSchema: designSchema // Ensure design schema is available
                        };

                        enhancedSystemPrompt = editContext.systemPrompt;

                        await sendProgress({
                          type: 'status',
                          message: `Identified edit type: ${editContext.editIntent.description}`
                        });
                      }
                    } catch (error) {
                      console.error('[generate-ai-code-stream] Error analyzing intent after fetch:', error);
                    }
                  } else {
                    console.error('[generate-ai-code-stream] Failed to get manifest from sandbox files');
                  }
                } else {
                  console.error('[generate-ai-code-stream] Failed to fetch sandbox files:', filesResponse.status);
                }
              } catch (error) {
                console.error('[generate-ai-code-stream] Error fetching sandbox files:', error);
                await sendProgress({
                  type: 'warning',
                  message: 'Could not analyze existing files for targeted edits. Proceeding with general edit mode.'
                });
              }
            } else {
              console.log('[generate-ai-code-stream] No active sandbox to fetch files from');
              await sendProgress({
                type: 'warning',
                message: 'No existing files found. Consider generating initial code first.'
              });
            }
          }
        }

        // Build conversation context for system prompt
        let conversationContext = '';
        if (global.conversationState && global.conversationState.context.messages.length > 1) {
          console.log('[generate-ai-code-stream] Building conversation context');
          console.log('[generate-ai-code-stream] Total messages:', global.conversationState.context.messages.length);
          console.log('[generate-ai-code-stream] Total edits:', global.conversationState.context.edits.length);

          conversationContext = `\n\n## Conversation History (Recent)\n`;

          // Include only the last 3 edits to save context
          const recentEdits = global.conversationState.context.edits.slice(-3);
          if (recentEdits.length > 0) {
            console.log('[generate-ai-code-stream] Including', recentEdits.length, 'recent edits in context');
            conversationContext += `\n### Recent Edits:\n`;
            recentEdits.forEach(edit => {
              conversationContext += `- "${edit.userRequest}" → ${edit.editType} (${edit.targetFiles.map(f => f.split('/').pop()).join(', ')})\n`;
            });
          }

          const recentMsgs = global.conversationState.context.messages.slice(-5);
          const recentlyCreatedFiles = [];
          recentMsgs.forEach(msg => {
            if (msg.metadata?.editedFiles) {
              recentlyCreatedFiles.push(...msg.metadata.editedFiles);
            }
          });

          if (recentlyCreatedFiles.length > 0) {
            const uniqueFiles = [...new Set(recentlyCreatedFiles)];
            conversationContext += `\n### 🚨 RECENTLY CREATED/EDITED FILES (DO NOT RECREATE THESE):\n`;
            uniqueFiles.forEach(file => {
              conversationContext += `- ${file}\n`;
            });
            conversationContext += `\nIf the user mentions any of these components, UPDATE the existing file!\n`;
          }

          const recentMessages = recentMsgs;
          if (recentMessages.length > 2) {
            conversationContext += `\n### Recent Messages:\n`;
            recentMessages.slice(0, -1).forEach(msg => {
              if (msg.role === 'user') {
                const truncatedContent = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
                conversationContext += `- "${truncatedContent}"\n`;
              }
            });
          }

          const majorChanges = global.conversationState.context.projectEvolution.majorChanges.slice(-2);
          if (majorChanges.length > 0) {
            conversationContext += `\n### Recent Changes:\n`;
            majorChanges.forEach(change => {
              conversationContext += `- ${change.description}\n`;
            });
          }

          const userPrefs = analyzeUserPreferences(global.conversationState.context.messages);
          if (userPrefs.commonPatterns.length > 0) {
            conversationContext += `\n### User Preferences:\n`;
            conversationContext += `- Edit style: ${userPrefs.preferredEditStyle}\n`;
          }

          if (conversationContext.length > 2000) {
            conversationContext = conversationContext.substring(0, 2000) + '\n[Context truncated to prevent length errors]';
          }
        }

        let documentContext = '';
        if (context?.extractedBusinessInfo && context?.documentDesignPrompt) {
          documentContext = `

## 📄 DOCUMENT-BASED BUSINESS REQUIREMENTS

### Extracted Business Information:
- **Business Name:** ${context.extractedBusinessInfo.businessName || 'Not specified'}
- **Unique Value Proposition:** ${context.extractedBusinessInfo.uniqueValueProposition || 'Not specified'}
- **Competitors:** ${context.extractedBusinessInfo.competitors || 'Not specified'}
- **Color Palette:** ${context.extractedBusinessInfo.colorPalette || 'Professional and modern colors'}
- **Preferred Font:** ${context.extractedBusinessInfo.preferredFont || 'Clean, readable fonts'}

### Design Requirements from Document:
${context.documentDesignPrompt}

**CRITICAL:** The website you create MUST reflect the business's unique value proposition and brand identity as specified above. Use the extracted color palette and font preferences when possible, while following the UI design principles below.`;
        }

        // UPDATED SYSTEM PROMPT: Always prioritize schema data, then scraped content
        let schemaContext = '';
        if (schemaData) {
          const designPatterns = extractDesignPatterns(designSchema);
          
          schemaContext = `

## 🎯 PRIMARY DESIGN GUIDE: SCHEMA DATA

**CRITICAL: This schema is your PRIMARY design blueprint. Follow it exactly for UI/UX design.**

### 🎨 Design Source: ${designSchema?.url || 'Random Schema'}
### 📊 Schema ID: ${designSchema?.id || 'N/A'}
### 📈 Total Schemas Available: ${getSchemaCount()}
### 🎯 Scenario: ${userProvidedUrl ? 'URL_PROVIDED - Using schema design + scraped content' : isRegenerate ? 'REGENERATE - New schema design only' : 'NORMAL_REQUEST - Schema design only'}

**IMPLEMENTATION PRIORITY:**
1. Schema Design Data (PRIMARY - USE THIS FIRST)
2. Scraped Content (SECONDARY - for content only, if URL provided)
3. UI Principles (FALLBACK - general guidelines)

${JSON.stringify(schemaData, null, 2)}

### 🧩 COMPONENT-BY-COMPONENT IMPLEMENTATION GUIDE:

${(() => {
  if (!schemaData) return '';
  
  let instructions = '';
  
  // Extract component specifications
  if (schemaData.components) {
    instructions += `\n### COMPONENT SPECIFICATIONS:\n`;
    for (const [componentName, component] of Object.entries(schemaData.components)) {
      instructions += `\n**${componentName} Component:**\n`;
      instructions += `- **Type:** ${component.type}\n`;
      instructions += `- **Description:** ${component.description}\n`;
      
      if (component.typography) {
        instructions += `- **Typography Requirements:**\n`;
        for (const [element, typography] of Object.entries(component.typography)) {
          instructions += `  - ${element}: ${typography.visual_description || typography.weight || 'default'}\n`;
        }
      }
      
      if (component.spacing) {
        instructions += `- **Spacing:** Padding: ${component.spacing.padding || 'default'}, Margin: ${component.spacing.margin || 'default'}\n`;
      }
      
      if (component.colors) {
        instructions += `- **Color Scheme:**\n`;
        instructions += `  - Background: ${component.colors.background}\n`;
        instructions += `  - Text: ${component.colors.text}\n`;
        instructions += `  - Accent: ${component.colors.accent}\n`;
      }
      
      if (component.image_style) {
        instructions += `- **Image Style:** ${component.image_style}\n`;
      }
      
      if (component.other_visual_notes) {
        instructions += `- **Visual Notes:** ${component.other_visual_notes}\n`;
      }
    }
  }
  
  // Extract page structure
  if (schemaData.page_structure) {
    instructions += `\n### 📄 PAGE STRUCTURE (IMPLEMENT IN THIS EXACT ORDER):\n`;
    schemaData.page_structure.forEach((item, index) => {
      instructions += `${index + 1}. **${item.component}** - ${item.description || 'Component to be implemented'}\n`;
    });
  }
  
  // Extract design system
  if (schemaData.design_system) {
    instructions += `\n### 🎨 DESIGN SYSTEM:\n`;
    instructions += JSON.stringify(schemaData.design_system, null, 2);
  }
  
  // Extract layout guidelines
  if (schemaData.layout_guidelines) {
    instructions += `\n### 📐 LAYOUT GUIDELINES:\n`;
    instructions += JSON.stringify(schemaData.layout_guidelines, null, 2);
  }
  
  return instructions;
})()}

###  DESIGN PATTERNS EXTRACTED:
${(() => {
  if (!designPatterns) return 'No design patterns found';
  
  let patterns = '';
  if (designPatterns.colorPalette) {
    patterns += `\n**Color Palette:**\n`;
    for (const [component, colors] of Object.entries(designPatterns.colorPalette)) {
      patterns += `- ${component}: ${JSON.stringify(colors)}\n`;
    }
  }
  
  if (designPatterns.typography) {
    patterns += `\n**Typography:**\n`;
    for (const [component, typography] of Object.entries(designPatterns.typography)) {
      patterns += `- ${component}: ${JSON.stringify(typography)}\n`;
    }
  }
  
  return patterns;
})()}

**CRITICAL INSTRUCTIONS:**
1. **ALWAYS** implement the components exactly as specified in the schema
2. **FOLLOW** the color schemes, typography, and spacing guidelines precisely
3. **USE** the page structure order for component implementation
4. **APPLY** the design patterns consistently across all components
5. **PRIORITIZE** the schema over any other design guidance`;

        }

        // Add scraped content context if available (SECONDARY to schema data)
        let scrapedContext = '';
        if (scrapedContent) {
          scrapedContext = `

## 📄 REAL WEBSITE CONTENT FROM ${targetUrl}:

**IMPORTANT:** Use this content COMBINED with the schema data above:

${scrapedContent}

**INSTRUCTIONS:**
- Use the DESIGN STRUCTURE from the schema data above (PRIMARY)
- Use the CONTENT/TEXT from this scraped website (SECONDARY)
- Combine both to create an authentic website with proper design following schema data

**Note:** The schema data defines HOW it should look, this content defines WHAT it should say.`;
        }

        // Add business info context if available
        let businessContext = '';
        if (businessInfo) {
          businessContext = `

## EXTRACTED BUSINESS INFORMATION:
- **Business Name:** ${businessInfo.businessName || 'Not specified'}
- **Unique Value Proposition:** ${businessInfo.uniqueValueProposition || 'Not specified'}
- **Competitors:** ${businessInfo.competitors || 'Not specified'}
- **Color Palette:** ${businessInfo.colorPalette || 'Professional and modern colors'}
- **Preferred Font:** ${businessInfo.preferredFont || 'Clean, readable fonts'}

**CRITICAL:** The website you create MUST reflect the business's unique value proposition and brand identity as specified above. Use the extracted color palette and font preferences when possible.`;
        }

        const systemPrompt = `You are an expert React developer creating modern web applications with Tailwind CSS.

## CORE REQUIREMENTS:
- Use React with Tailwind CSS
- Mobile-first responsive design  
- Semantic HTML5 elements
- Use ONLY standard Tailwind classes (bg-white, text-black, bg-blue-500, NOT bg-background)
- Component-based architecture
- Create complete, functional components

${schemaData ? `🎯 **PRIMARY DESIGN SOURCE: ${isRegenerate ? 'NEW ' : isRedesign ? 'DIFFERENT ' : ''}INTELLIGENTLY SELECTED SCHEMA**

**CRITICAL INSTRUCTIONS:**
1. **USE ${isRegenerate ? 'NEW ' : isRedesign ? 'DIFFERENT ' : ''}INTELLIGENTLY SELECTED SCHEMA** - This schema was chosen based on your specific request${isRegenerate ? ' and is completely new' : isRedesign ? ' and is different from the previous one' : ''}
2. **IMPLEMENT EXACT COMPONENT SPECIFICATIONS** - Follow the component definitions precisely
3. **FOLLOW PAGE STRUCTURE ORDER** - Implement components in the exact order specified
4. **APPLY EXACT COLORS AND TYPOGRAPHY** - Use the specified color schemes and typography
5. **MAINTAIN VISUAL HIERARCHY** - Follow the visual hierarchy as described in the schema
${isRegenerate ? '6. **REGENERATE MODE** - This is a regenerate request. Create a completely new design using the new schema' : isRedesign ? '6. **REDESIGN MODE** - This is a redesign request. Apply the different schema design to the existing content structure' : ''}

**SELECTED SCHEMA ANALYSIS:**
- **Source URL:** ${designSchema?.url || 'Unknown'}
- **Schema ID:** ${designSchema?.id || 'N/A'}
- **Selection Method:** ${designSchema?.queryAnalysis?.method || 'unknown'}
- **Matched Keywords:** ${designSchema?.queryAnalysis?.matchedKeywords?.join(', ') || 'none'}
- **Matched Categories:** ${designSchema?.queryAnalysis?.matchedCategories?.join(', ') || 'none'}
${isRedesign ? `- **Previous Schema Excluded:** ${designSchema?.queryAnalysis?.excludedIds?.join(', ') || 'none'}` : ''}

**IMPLEMENTATION PRIORITY:**
1. ${isRegenerate ? 'New ' : isRedesign ? 'Different ' : ''}Intelligently Selected Schema (PRIMARY - chosen based on your request${isRegenerate ? ' and completely new' : isRedesign ? ' and different from previous' : ''})
2. Scraped Content (SECONDARY - provides real content/text, if URL provided)
3. UI/UX Principles (GENERAL GUIDELINES)` : ''}

${isRegenerate ? `## 🔄 REGENERATE MODE - USING NEW INTELLIGENTLY SELECTED SCHEMA

**🚨 CRITICAL REGENERATION INSTRUCTIONS - OVERRIDE ALL OTHER RULES:**
- You are creating a COMPLETELY NEW website with COMPLETELY NEW structure and layout
- This is NOT just a theme change - this is a complete regeneration from scratch
- The new schema provides a completely different design system and layout approach
- IGNORE all existing files and create everything fresh
- Create NEW component architecture, NEW layout patterns, NEW user flow
- Generate NEW content that matches the new schema theme
- Build NEW responsive design patterns and interactions

**WHAT TO REGENERATE (NOT JUST THEME):**
1. **NEW Component Structure** - Different component hierarchy and relationships
2. **NEW Layout Patterns** - Different page structure and arrangement
3. **NEW Navigation Flow** - Different navigation structure and user experience
4. **NEW Content Sections** - Different content organization and flow
5. **NEW Visual Hierarchy** - Different visual organization and emphasis
6. **NEW Responsive Design** - Different responsive patterns and breakpoints
7. **NEW Interactions** - Different animations and user interactions
8. **NEW Content** - Fresh content that matches the new schema theme

**REGENERATION PROCESS:**
1. Analyze the NEW schema's design system and layout approach
2. Create completely new component structure based on schema
3. Implement new layout patterns and page flow
4. Generate fresh content matching the schema theme
5. Build new responsive design patterns
6. Add new animations and interactions
7. Ensure no reference to previous design patterns

**New Intelligently Selected Schema:** ${designSchema?.url || 'Unknown'}
**Schema ID:** ${designSchema?.id || 'N/A'}
**Selection Reason:** ${designSchema?.queryAnalysis?.matchedKeywords?.join(', ') || 'Best new match for your request'}
**Previous Schemas Excluded:** All previously used schemas excluded
**Mode:** COMPLETE REGENERATION (not theme change)` : ''}

${targetUrl ? `TARGET WEBSITE: ${targetUrl}
${scrapedContent ? 'You are recreating this website using intelligently selected schema design for layout and real content for text.' : 'You are creating a website inspired by this URL.'}` : ''}

${conversationContext}

${schemaContext}

${scrapedContext}

${businessContext}

${documentContext}

${getUIPrinciplesPrompt()}

**CRITICAL RULES - YOUR MOST IMPORTANT INSTRUCTIONS:**

${isRedesign ? `
 **REDESIGN MODE - OVERRIDE ALL OTHER RULES**
**YOU ARE CREATING A COMPLETELY NEW WEBSITE FROM SCRATCH**

**REDESIGN OVERRIDE RULES:**
1. **IGNORE ALL EXISTING FILES** - Do NOT check App.jsx or any existing files
2. **CREATE COMPLETE NEW STRUCTURE** - Build everything from scratch using the different schema
3. **NO FILE COUNT LIMITS** - Create ALL necessary files for the new design
4. **COMPLETE LAYOUT RESTRUCTURE** - Change the entire page structure, not just colors
5. **NEW COMPONENT ARCHITECTURE** - Create new component relationships and hierarchy
6. **FRESH CONTENT AND DESIGN** - Generate new content that matches the schema theme
7. **IGNORE PREVIOUS DESIGNS** - Do not reference or preserve any existing design patterns

**WHAT TO REDESIGN:**
- Complete new Header with different navigation structure
- New Hero section with different layout and content
- New content sections with different arrangement
- New Footer with different structure
- New overall page flow and user experience
- New component hierarchy and relationships
- New responsive design patterns
- New animations and interactions

**REDESIGN CHECKLIST:**
- [ ] Create completely new component structure
- [ ] Implement new layout patterns from schema
- [ ] Generate fresh content matching schema theme
- [ ] Build new navigation and user flow
- [ ] Create new visual hierarchy
- [ ] Implement new responsive breakpoints
- [ ] Add new animations and interactions
- [ ] Ensure no reference to previous design
` : isRegenerate ? `
 **REGENERATION MODE - OVERRIDE ALL OTHER RULES**
**YOU ARE CREATING A COMPLETELY NEW WEBSITE FROM SCRATCH**

**REGENERATION OVERRIDE RULES:**
1. **IGNORE ALL EXISTING FILES** - Do NOT check App.jsx or any existing files
2. **CREATE COMPLETE NEW STRUCTURE** - Build everything from scratch using the new schema
3. **NO FILE COUNT LIMITS** - Create ALL necessary files for the new design
4. **COMPLETE LAYOUT RESTRUCTURE** - Change the entire page structure, not just colors
5. **NEW COMPONENT ARCHITECTURE** - Create new component relationships and hierarchy
6. **FRESH CONTENT AND DESIGN** - Generate new content that matches the schema theme
7. **IGNORE PREVIOUS DESIGNS** - Do not reference or preserve any existing design patterns

**WHAT TO REGENERATE:**
- Complete new Header with different navigation structure
- New Hero section with different layout and content
- New content sections with different arrangement
- New Footer with different structure
- New overall page flow and user experience
- New component hierarchy and relationships
- New responsive design patterns
- New animations and interactions

**REGENERATION CHECKLIST:**
- [ ] Create completely new component structure
- [ ] Implement new layout patterns from schema
- [ ] Generate fresh content matching schema theme
- [ ] Build new navigation and user flow
- [ ] Create new visual hierarchy
- [ ] Implement new responsive breakpoints
- [ ] Add new animations and interactions
- [ ] Ensure no reference to previous design
` : `
1. **DO EXACTLY WHAT IS ASKED - NOTHING MORE, NOTHING LESS**
   - Don't add features not requested
   - Don't fix unrelated issues
   - Don't improve things not mentioned
2. **CHECK App.jsx FIRST** - ALWAYS see what components exist before creating new ones
3. **USE STANDARD TAILWIND CLASSES ONLY**:
   - ✅ CORRECT: bg-white, text-black, bg-blue-500, bg-gray-100, text-gray-900
   - ❌ WRONG: bg-background, text-foreground, bg-primary, bg-muted, text-secondary
   - Use ONLY classes from the official Tailwind CSS documentation
4. **FILE COUNT LIMITS**:
   - Simple style/text change = 1 file ONLY
   - New component = 2 files MAX (component + parent)
   - If >3 files, YOU'RE DOING TOO MUCH

COMPONENT RELATIONSHIPS (CHECK THESE FIRST):
- Navigation usually lives INSIDE Header.jsx, not separate Nav.jsx
- Logo is typically in Header, not standalone
- Footer often contains nav links already
- Menu/Hamburger is part of Header, not separate
`}

PACKAGE USAGE RULES:
- DO NOT use react-router-dom unless user explicitly asks for routing
- For simple nav links in a single-page app, use scroll-to-section or href="#"
- Only add routing if building a multi-page application
- Common packages are auto-installed from your imports

${isRegenerate ? `
🔄 **REGENERATION WEBSITE REQUIREMENTS:**
When regenerating a website, you MUST create:
1. **NEW Header with NEW Navigation** - Completely different structure and layout
2. **NEW Hero Section** - Different layout, content, and visual approach
3. **NEW Content Sections** - Different arrangement, components, and flow
4. **NEW Footer** - Different structure and content organization
5. **NEW Overall Layout** - Different page structure and user flow
6. **NEW Component Architecture** - Different component relationships and hierarchy
7. **NEW Visual Design Language** - Different design patterns and aesthetics
` : isRegenerate ? `
🔄 **REGENERATION WEBSITE REQUIREMENTS:**
When regenerating a website, you MUST create:
1. **NEW Header with NEW Navigation** - Completely different structure and layout
2. **NEW Hero Section** - Different layout, content, and visual approach
3. **NEW Content Sections** - Different arrangement, components, and flow
4. **NEW Footer** - Different structure and content organization
5. **NEW Overall Layout** - Different page structure and user flow
6. **NEW Component Architecture** - Different component relationships and hierarchy
7. **NEW Visual Design Language** - Different design patterns and aesthetics
` : `
WEBSITE REQUIREMENTS:
When creating a website, you MUST include:
1. **Header with Navigation** - Usually Header.jsx containing nav
2. **Hero Section** - The main landing area (Hero.jsx)
3. **Main Content Sections** - Features, Services, About, etc.
4. **Footer** - Contact info, links, copyright (Footer.jsx)
`}

${schemaData ? `🎨 **${isRegenerate ? 'NEW ' : isRedesign ? 'DIFFERENT ' : ''}INTELLIGENTLY SELECTED SCHEMA IMPLEMENTATION CHECKLIST:**
- [ ] Implement all components specified in the ${isRegenerate ? 'new ' : isRedesign ? 'different ' : ''}intelligently selected schema
- [ ] Follow the exact page structure order
- [ ] Apply the specified color schemes for each component
- [ ] Use the exact typography specifications
- [ ] Maintain the spacing and layout requirements
- [ ] Ensure responsive design across all components
- [ ] Follow the visual hierarchy as described
- [ ] Implement any special visual notes or requirements
${isRedesign ? `
🎨 **REDESIGN SPECIFIC CHECKLIST:**
- [ ] Create completely new component structure (not just colors)
- [ ] Implement new layout patterns from schema
- [ ] Generate fresh content matching schema theme
- [ ] Build new navigation and user flow
- [ ] Create new visual hierarchy
- [ ] Implement new responsive breakpoints
- [ ] Add new animations and interactions
- [ ] Ensure no reference to previous design patterns
` : isRegenerate ? `
🔄 **REGENERATION SPECIFIC CHECKLIST:**
- [ ] Create completely new component structure (not just colors)
- [ ] Implement new layout patterns from schema
- [ ] Generate fresh content matching schema theme
- [ ] Build new navigation and user flow
- [ ] Create new visual hierarchy
- [ ] Implement new responsive breakpoints
- [ ] Add new animations and interactions
- [ ] Ensure no reference to previous design patterns
` : ''}
- [ ] Use scraped content for text/content if available` : ''}

${isRegenerate ? `
 **REGENERATION MODE CRITICAL REQUIREMENTS:**
- You MUST generate complete files with COMPLETELY NEW design and structure
- Do not just change colors - CREATE NEW LAYOUT AND COMPONENTS
- Apply the NEW schema design to create fresh component architecture
- Generate NEW content that matches the schema theme
- Create NEW navigation and user flow patterns
- Build NEW responsive design patterns
- Implement NEW animations and interactions
- Generate ALL necessary files with the new design system
- This is a COMPLETE REGENERATION, not just a theme change
` : isRedesign ? `
 **REDESIGN MODE CRITICAL REQUIREMENTS - COMPLETE REBUILD:**
- You MUST generate complete files with the NEW design system
- Do not just describe changes - CREATE THE ACTUAL CODE
- Apply the DIFFERENT intelligently selected schema design to create NEW components
- **DISCARD ALL EXISTING CONTENT AND FUNCTIONALITY** - create completely new content
- **CREATE NEW LAYOUT STRUCTURE** - different page organization and flow
- **GENERATE NEW COMPONENT ARCHITECTURE** - different component hierarchy
- **BUILD NEW NAVIGATION PATTERNS** - different user experience flow
- **CREATE NEW VISUAL DESIGN** - different colors, typography, spacing, layout
- Generate ALL necessary files with the completely new design system
- This schema is DIFFERENT from the previous one used
- **THIS IS A COMPLETE REBUILD, NOT A THEME CHANGE**
` : ''}`;

        // Build full prompt with context
        let fullPrompt = prompt;
        if (context) {
          const contextParts = [];

          if (context.sandboxId) {
            contextParts.push(`Current sandbox ID: ${context.sandboxId}`);
          }

          if (context.structure) {
            contextParts.push(`Current file structure:\n${context.structure}`);
          }

          // Use backend file cache instead of frontend-provided files
          let backendFiles = global.sandboxState?.fileCache?.files || {};
          let hasBackendFiles = Object.keys(backendFiles).length > 0;

          console.log('[generate-ai-code-stream] Backend file cache status:');
          console.log('[generate-ai-code-stream] - Has sandboxState:', !!global.sandboxState);
          console.log('[generate-ai-code-stream] - Has fileCache:', !!global.sandboxState?.fileCache);
          console.log('[generate-ai-code-stream] - File count:', Object.keys(backendFiles).length);
          console.log('[generate-ai-code-stream] - Has manifest:', !!global.sandboxState?.fileCache?.manifest);

          // If no backend files and we're in edit mode, try to fetch from sandbox
          if (!hasBackendFiles && isEdit && (global.activeSandbox || context?.sandboxId)) {
            console.log('[generate-ai-code-stream] No backend files, attempting to fetch from sandbox...');

            try {
              const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/get-sandbox-files`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              });

              if (filesResponse.ok) {
                const filesData = await filesResponse.json();
                if (filesData.success && filesData.files) {
                  console.log('[generate-ai-code-stream] Successfully fetched', Object.keys(filesData.files).length, 'files from sandbox');

                  // Initialize sandboxState if needed
                  if (!global.sandboxState) {
                    global.sandboxState = {
                      fileCache: {
                        files: {},
                        lastSync: Date.now(),
                        sandboxId: context?.sandboxId || 'unknown'
                      }
                    };
                  } else if (!global.sandboxState.fileCache) {
                    global.sandboxState.fileCache = {
                      files: {},
                      lastSync: Date.now(),
                      sandboxId: context?.sandboxId || 'unknown'
                    };
                  }

                  // Store files in cache
                  for (const [path, content] of Object.entries(filesData.files)) {
                    const normalizedPath = path.replace('/home/user/app/', '');
                    global.sandboxState.fileCache.files[normalizedPath] = {
                      content: content,
                      lastModified: Date.now()
                    };
                  }

                  if (filesData.manifest) {
                    global.sandboxState.fileCache.manifest = filesData.manifest;

                    if (!editContext) {
                      console.log('[generate-ai-code-stream] Analyzing edit intent with fetched manifest');
                      try {
                        const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-edit-intent`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt, manifest: filesData.manifest, model })
                        });

                        if (intentResponse.ok) {
                          const { searchPlan } = await intentResponse.json();
                          console.log('[generate-ai-code-stream] Search plan received:', searchPlan);

                          const fileContext = selectFilesForEdit(prompt, filesData.manifest);
                          editContext = fileContext;
                          enhancedSystemPrompt = fileContext.systemPrompt;

                          console.log('[generate-ai-code-stream] Edit context created with', editContext.primaryFiles.length, 'primary files');
                        }
                      } catch (error) {
                        console.error('[generate-ai-code-stream] Failed to analyze edit intent:', error);
                      }
                    }
                  }

                  backendFiles = global.sandboxState.fileCache.files;
                  hasBackendFiles = Object.keys(backendFiles).length > 0;
                  console.log('[generate-ai-code-stream] Updated backend cache with fetched files');
                }
              }
            } catch (error) {
              console.error('[generate-ai-code-stream] Failed to fetch sandbox files:', error);
            }
          }

          // Include current file contents from backend cache
          if (hasBackendFiles && !isRegenerate && !isRedesign) {
            // If we have edit context, use intelligent file selection
            if (editContext && editContext.primaryFiles.length > 0) {
              contextParts.push('\nEXISTING APPLICATION - TARGETED EDIT MODE');
              contextParts.push(`\n${editContext.systemPrompt || enhancedSystemPrompt}\n`);

              const primaryFileContents = await getFileContents(editContext.primaryFiles, global.sandboxState.fileCache.manifest);
              const contextFileContents = await getFileContents(editContext.contextFiles, global.sandboxState.fileCache.manifest);

              const formattedFiles = formatFilesForAI(primaryFileContents, contextFileContents);
              contextParts.push(formattedFiles);

              contextParts.push('\nIMPORTANT: Only modify the files listed under "Files to Edit". The context files are provided for reference only.');
            } else {
              console.log('[generate-ai-code-stream] WARNING: Using fallback mode - no edit context available');
              contextParts.push('\nEXISTING APPLICATION - TARGETED EDIT REQUIRED');
              contextParts.push('\nYou MUST analyze the user request and determine which specific file(s) to edit.');
              contextParts.push('\nCurrent project files (DO NOT regenerate all of these):');

              const fileEntries = Object.entries(backendFiles);
              console.log(`[generate-ai-code-stream] Using backend cache: ${fileEntries.length} files`);

              contextParts.push('\n### File List:');
              for (const [path] of fileEntries) {
                contextParts.push(`- ${path}`);
              }

              contextParts.push('\n### File Contents (ALL FILES FOR CONTEXT):');
              for (const [path, fileData] of fileEntries) {
                const content = fileData.content;
                if (typeof content === 'string') {
                  contextParts.push(`\n<file path="${path}">\n${content}\n</file>`);
                }
              }

              contextParts.push('\n🚨 CRITICAL INSTRUCTIONS - VIOLATION = FAILURE 🚨');
              contextParts.push('1. Analyze the user request: "' + prompt + '"');
              contextParts.push('2. Identify the MINIMUM number of files that need editing (usually just ONE)');
              contextParts.push('3. PRESERVE ALL EXISTING CONTENT in those files');
              contextParts.push('4. ONLY ADD/MODIFY the specific part requested');
              contextParts.push('5. DO NOT regenerate entire components from scratch');
              contextParts.push('6. DO NOT change unrelated parts of any file');
              contextParts.push('7. Generate ONLY the files that MUST be changed - NO EXTRAS');
              contextParts.push('\n⚠️ FILE COUNT RULE:');
              contextParts.push('- Simple change (color, text, spacing) = 1 file ONLY');
              contextParts.push('- Adding new component = 2 files MAX (new component + parent that imports it)');
              contextParts.push('- DO NOT exceed these limits unless absolutely necessary');
              contextParts.push('\nEXAMPLES OF CORRECT BEHAVIOR:');
              contextParts.push('✅ "add a chart to the hero" → Edit ONLY Hero.jsx, ADD the chart, KEEP everything else');
              contextParts.push('✅ "change header to black" → Edit ONLY Header.jsx, change ONLY the color');
              contextParts.push('✅ "fix spacing in footer" → Edit ONLY Footer.jsx, adjust ONLY spacing');
              contextParts.push('\nEXAMPLES OF FAILURES:');
              contextParts.push('❌ "change header color" → You edit Header, Footer, and App "for consistency"');
              contextParts.push('❌ "add chart to hero" → You regenerate the entire Hero component');
              contextParts.push('❌ "fix button" → You update 5 different component files');
              contextParts.push('\n⚠️ FINAL WARNING:');
              contextParts.push('If you generate MORE files than necessary, you have FAILED');
              contextParts.push('If you DELETE or REWRITE existing functionality, you have FAILED');
              contextParts.push('ONLY change what was EXPLICITLY requested - NOTHING MORE');
            }
          } else if (isRegenerate || isRedesign) {
            contextParts.push('\n REGENERATION/REDESIGN MODE - IGNORE EXISTING FILES');
            contextParts.push('You are creating a COMPLETELY NEW website from scratch.');
            contextParts.push('DO NOT reference or preserve any existing file content.');
            contextParts.push('Use the NEW schema design to build everything fresh.');
            contextParts.push('Create all necessary components with the new design system.');
          } else if (context.currentFiles && Object.keys(context.currentFiles).length > 0) {
            console.log('[generate-ai-code-stream] Warning: Backend cache empty, using frontend files');
            contextParts.push('\nEXISTING APPLICATION - DO NOT REGENERATE FROM SCRATCH');
            contextParts.push('Current project files (modify these, do not recreate):');

            const fileEntries = Object.entries(context.currentFiles);
            for (const [path, content] of fileEntries) {
              if (typeof content === 'string') {
                contextParts.push(`\n<file path="${path}">\n${content}\n</file>`);
              }
            }
            contextParts.push('\nThe above files already exist. When the user asks to modify something (like "change the header color to black"), find the relevant file above and generate ONLY that file with the requested changes.');
          }

          if (isEdit && !isRegenerate) {
            contextParts.push('\nEDIT MODE ACTIVE');
            contextParts.push('This is an incremental update to an existing application.');
            contextParts.push('DO NOT regenerate App.jsx, index.css, or other core files unless explicitly requested.');
            contextParts.push('ONLY create or modify the specific files needed for the user\'s request.');
            contextParts.push('\n⚠️ CRITICAL FILE OUTPUT FORMAT - VIOLATION = FAILURE:');
            contextParts.push('YOU MUST OUTPUT EVERY FILE IN THIS EXACT XML FORMAT:');
            contextParts.push('<file path="src/components/ComponentName.jsx">');
            contextParts.push('// Complete file content here');
            contextParts.push('</file>');
            contextParts.push('<file path="src/index.css">');
            contextParts.push('/* CSS content here */');
            contextParts.push('</file>');
            contextParts.push('\n⚠️ NEVER OUTPUT: "Generated Files: index.css, App.jsx"');
            contextParts.push('⚠️ NEVER LIST FILE NAMES WITHOUT CONTENT');
            contextParts.push('✅ ALWAYS: One <file> tag per file with COMPLETE content');
            contextParts.push('✅ ALWAYS: Include EVERY file you modified');
          } else if (isRegenerate) {
            contextParts.push('\n🔄 REGENERATION MODE ACTIVE');
            contextParts.push('This is a COMPLETE REGENERATION - create everything from scratch!');
            contextParts.push('IGNORE all existing files and create a completely new design.');
            contextParts.push('Use the NEW schema design to build a fresh website.');
            contextParts.push('Create ALL necessary components with the new design system.');
            contextParts.push('\n⚠️ CRITICAL REGENERATION INSTRUCTIONS:');
            contextParts.push('- DO NOT reference or preserve existing file content');
            contextParts.push('- DO NOT try to modify existing files');
            contextParts.push('- CREATE COMPLETELY NEW files with new design');
            contextParts.push('- APPLY the new schema design system throughout');
            contextParts.push('- BUILD from scratch using the schema specifications');
            contextParts.push('\n⚠️ OUTPUT FORMAT:');
            contextParts.push('Use <file path="...">content</file> tags for ALL new files');
            contextParts.push('Create complete, working components with the new design');
          } else if (!hasBackendFiles) {
            contextParts.push('\n🎨 FIRST GENERATION MODE - CREATE SOMETHING BEAUTIFUL!');
            contextParts.push('\nThis is the user\'s FIRST experience. Make it impressive:');
            contextParts.push('1. **USE TAILWIND PROPERLY** - Use standard Tailwind color classes');
            contextParts.push('2. **NO PLACEHOLDERS** - Use real content, not lorem ipsum');
            contextParts.push('3. **COMPLETE COMPONENTS** - Header, Hero, Features, Footer minimum');
            contextParts.push('4. **VISUAL POLISH** - Shadows, hover states, transitions');
            contextParts.push('5. **STANDARD CLASSES** - bg-white, text-gray-900, bg-blue-500, NOT bg-background');
            contextParts.push('6. **FOLLOW SCHEMA** - If available, follow the design specifications exactly');
            contextParts.push('\nCreate a polished, professional application that works perfectly on first load.');
            contextParts.push('\n⚠️ OUTPUT FORMAT:');
            contextParts.push('Use <file path="...">content</file> tags for EVERY file');
            contextParts.push('NEVER output "Generated Files:" as plain text');
          }

          if (context.conversationContext) {
            if (context.conversationContext.scrapedWebsites?.length > 0) {
              contextParts.push('\nScraped Websites in Context:');
              context.conversationContext.scrapedWebsites.forEach(site => {
                contextParts.push(`\nURL: ${site.url}`);
                contextParts.push(`Scraped: ${new Date(site.timestamp).toLocaleString()}`);
                if (site.content) {
                  const contentPreview = typeof site.content === 'string'
                    ? site.content.substring(0, 1000)
                    : JSON.stringify(site.content).substring(0, 1000);
                  contextParts.push(`Content Preview: ${contentPreview}...`);
                }
              });
            }

            if (context.conversationContext.currentProject) {
              contextParts.push(`\nCurrent Project: ${context.conversationContext.currentProject}`);
            }
          }

          if (contextParts.length > 0) {
            fullPrompt = `CONTEXT:\n${contextParts.join('\n')}\n\nUSER REQUEST:\n${prompt}`;
          }
        }

        await sendProgress({ type: 'status', message: 'Planning application structure...' });

        console.log('\n[generate-ai-code-stream] Starting streaming response...\n');

        const packagesToInstall = [];

        const isAnthropic = model.startsWith('anthropic/');
        const isOpenAI = model.startsWith('openai/gpt-5');
        const modelProvider = isAnthropic ? anthropic : (isOpenAI ? openai : groq);
        const actualModel = isAnthropic ? model.replace('anthropic/', '') :
          (model === 'openai/gpt-5') ? 'gpt-5' : model;

        const streamOptions = {
          model: modelProvider(actualModel),
          messages: [
            {
              role: 'system',
              content: systemPrompt + `

🚨 CRITICAL CODE GENERATION RULES - VIOLATION = FAILURE 🚨:
1. NEVER truncate ANY code - ALWAYS write COMPLETE files
2. NEVER use "..." anywhere in your code - this causes syntax errors
3. NEVER cut off strings mid-sentence - COMPLETE every string
4. NEVER leave incomplete class names or attributes
5. ALWAYS close ALL tags, quotes, brackets, and parentheses
6. If you run out of space, prioritize completing the current file

CRITICAL STRING RULES TO PREVENT SYNTAX ERRORS:
- NEVER write: className="px-8 py-4 bg-black text-white font-bold neobrut-border neobr...
- ALWAYS write: className="px-8 py-4 bg-black text-white font-bold neobrut-border neobrut-shadow"
- COMPLETE every className attribute
- COMPLETE every string literal
- NO ellipsis (...) ANYWHERE in code

PACKAGE RULES:
- For INITIAL generation: Use ONLY React, no external packages
- For EDITS: You may use packages, specify them with <package> tags
- NEVER install packages like @mendable/firecrawl-js unless explicitly requested

Examples of SYNTAX ERRORS (NEVER DO THIS):
⚠️ className="px-4 py-2 bg-blue-600 hover:bg-blue-7...
⚠️ <button className="btn btn-primary btn-...
⚠️ const title = "Welcome to our...
⚠️ import { useState, useEffect, ... } from 'react'

Examples of CORRECT CODE (ALWAYS DO THIS):
✅ className="px-4 py-2 bg-blue-600 hover:bg-blue-700"
✅ <button className="btn btn-primary btn-large">
✅ const title = "Welcome to our application"
✅ import { useState, useEffect, useCallback } from 'react'

REMEMBER: It's better to generate fewer COMPLETE files than many INCOMPLETE files.`
            },
            {
              role: 'user',
              content: fullPrompt + `

CRITICAL: You MUST complete EVERY file you start. If you write:
<file path="src/components/Hero.jsx">

You MUST include the closing </file> tag and ALL the code in between.

NEVER write partial code like:
<h1>Build and deploy on the AI Cloud.</h1>
<p>Some text...</p>  ⚠️ WRONG

ALWAYS write complete code:
<h1>Build and deploy on the AI Cloud.</h1>
<p>Some text here with full content</p>  ✅ CORRECT

If you're running out of space, generate FEWER files but make them COMPLETE.
It's better to have 3 complete files than 10 incomplete files.`
            }
          ],
          maxTokens: 8192, // Reduce to ensure completion
          stopSequences: [] // Don't stop early
          // Note: Neither Groq nor Anthropic models support tool/function calling in this context
          // We use XML tags for package detection instead
        };

        // Add temperature for non-reasoning models
        if (!model.startsWith('openai/gpt-5')) {
          streamOptions.temperature = 0.7;
        }

        // Add reasoning effort for GPT-5 models
        if (isOpenAI) {
          streamOptions.experimental_providerMetadata = {
            openai: {
              reasoningEffort: 'high'
            }
          };
        }

        const result = await streamText(streamOptions);

        // Stream the response and parse in real-time
        let generatedCode = '';
        let currentFile = '';
        let currentFilePath = '';
        let componentCount = 0;
        let isInFile = false;
        let isInTag = false;
        let conversationalBuffer = '';

        // Buffer for incomplete tags
        let tagBuffer = '';

        // Stream the response and parse for packages in real-time
        for await (const textPart of result.textStream) {
          const text = textPart || '';
          generatedCode += text;
          currentFile += text;

          // Combine with buffer for tag detection
          const searchText = tagBuffer + text;

          // Log streaming chunks to console
          process.stdout.write(text);

          // Check if we're entering or leaving a tag
          const hasOpenTag = /<(file|package|packages|explanation|command|structure|template)\b/.test(text);
          const hasCloseTag = /<\/(file|package|packages|explanation|command|structure|template)>/.test(text);

          if (hasOpenTag) {
            // Send any buffered conversational text before the tag
            if (conversationalBuffer.trim() && !isInTag) {
              await sendProgress({
                type: 'conversation',
                text: conversationalBuffer.trim()
              });
              conversationalBuffer = '';
            }
            isInTag = true;
          }

          if (hasCloseTag) {
            isInTag = false;
          }

          // If we're not in a tag, buffer as conversational text
          if (!isInTag && !hasOpenTag) {
            conversationalBuffer += text;
          }

          // Stream the raw text for live preview
          await sendProgress({
            type: 'stream',
            text: text,
            raw: true
          });

          // Check for package tags in buffered text (ONLY for edits, not initial generation)
          let lastIndex = 0;
          if (isEdit) {
            const packageRegex = /<package>([^<]+)<\/package>/g;
            let packageMatch;

            while ((packageMatch = packageRegex.exec(searchText)) !== null) {
              const packageName = packageMatch[1].trim();
              if (packageName && !packagesToInstall.includes(packageName)) {
                packagesToInstall.push(packageName);
                console.log(`[generate-ai-code-stream] Package detected: ${packageName}`);
                await sendProgress({
                  type: 'package',
                  name: packageName,
                  message: `Package detected: ${packageName}`
                });
              }
              lastIndex = packageMatch.index + packageMatch[0].length;
            }
          }

          // Keep unmatched portion in buffer for next iteration
          tagBuffer = searchText.substring(Math.max(0, lastIndex - 50)); // Keep last 50 chars

          // Check for file boundaries
          if (text.includes('<file path="')) {
            const pathMatch = text.match(/<file path="([^"]+)"/);
            if (pathMatch) {
              currentFilePath = pathMatch[1];
              isInFile = true;
              currentFile = text;
            }
          }

          // Check for file end
          if (isInFile && currentFile.includes('</file>')) {
            isInFile = false;

            // Send component progress update
            if (currentFilePath.includes('components/')) {
              componentCount++;
              const componentName = currentFilePath.split('/').pop()?.replace('.jsx', '') || 'Component';
              await sendProgress({
                type: 'component',
                name: componentName,
                path: currentFilePath,
                index: componentCount
              });
            } else if (currentFilePath.includes('App.jsx')) {
              await sendProgress({
                type: 'app',
                message: 'Generated main App.jsx',
                path: currentFilePath
              });
            }

            currentFile = '';
            currentFilePath = '';
          }
        }

        console.log('\n\n[generate-ai-code-stream] Streaming complete.');

        // Send any remaining conversational text
        if (conversationalBuffer.trim()) {
          await sendProgress({
            type: 'conversation',
            text: conversationalBuffer.trim()
          });
        }

        // Also parse <packages> tag for multiple packages - ONLY for edits
        if (isEdit) {
          const packagesRegex = /<packages>([\s\S]*?)<\/packages>/g;
          let packagesMatch;
          while ((packagesMatch = packagesRegex.exec(generatedCode)) !== null) {
            const packagesContent = packagesMatch[1].trim();
            const packagesList = packagesContent.split(/[\n,]+/)
              .map(pkg => pkg.trim())
              .filter(pkg => pkg.length > 0);

            for (const packageName of packagesList) {
              if (!packagesToInstall.includes(packageName)) {
                packagesToInstall.push(packageName);
                console.log(`[generate-ai-code-stream] Package from <packages> tag: ${packageName}`);
                await sendProgress({
                  type: 'package',
                  name: packageName,
                  message: `Package detected: ${packageName}`
                });
              }
            }
          }
        }

        function extractPackagesFromCode(content) {
          const packages = [];
          const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
          let importMatch;

          while ((importMatch = importRegex.exec(content)) !== null) {
            const importPath = importMatch[1];
            if (!importPath.startsWith('.') && !importPath.startsWith('/') &&
              importPath !== 'react' && importPath !== 'react-dom' &&
              !importPath.startsWith('@/')) {
              const packageName = importPath.startsWith('@')
                ? importPath.split('/').slice(0, 2).join('/')
                : importPath.split('/')[0];

              if (!packages.includes(packageName)) {
                packages.push(packageName);
              }
            }
          }

          return packages;
        }

        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        const files = [];
        let match;

        while ((match = fileRegex.exec(generatedCode)) !== null) {
          const filePath = match[1];
          const content = match[2].trim();
          files.push({ path: filePath, content });

          if (isEdit) {
            const filePackages = extractPackagesFromCode(content);
            for (const pkg of filePackages) {
              if (!packagesToInstall.includes(pkg)) {
                packagesToInstall.push(pkg);
                console.log(`[generate-ai-code-stream] Package detected from imports: ${pkg}`);
                await sendProgress({
                  type: 'package',
                  name: pkg,
                  message: `Package detected from imports: ${pkg}`
                });
              }
            }
          }

          if (filePath.includes('components/')) {
            const componentName = filePath.split('/').pop()?.replace('.jsx', '') || 'Component';
            await sendProgress({
              type: 'component',
              name: componentName,
              path: filePath,
              index: componentCount
            });
          } else if (filePath.includes('App.jsx')) {
            await sendProgress({
              type: 'app',
              message: 'Generated main App.jsx',
              path: filePath
            });
          }
        }

        const explanationMatch = generatedCode.match(/<explanation>([\s\S]*?)<\/explanation>/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : 'Code generated successfully!';

        const truncationWarnings = [];

        const fileOpenCount = (generatedCode.match(/<file path="/g) || []).length;
        const fileCloseCount = (generatedCode.match(/<\/file>/g) || []).length;
        if (fileOpenCount !== fileCloseCount) {
          truncationWarnings.push(`Unclosed file tags detected: ${fileOpenCount} open, ${fileCloseCount} closed`);
        }

        const truncationCheckRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
        let truncationMatch;
        while ((truncationMatch = truncationCheckRegex.exec(generatedCode)) !== null) {
          const filePath = truncationMatch[1];
          const content = truncationMatch[2];

          if (content.trim().endsWith('<') || content.trim().endsWith('</')) {
            truncationWarnings.push(`File ${filePath} appears to have incomplete HTML tags`);
          }

          if (filePath.match(/\.(jsx?|tsx?)$/)) {
            const openBraces = (content.match(/{/g) || []).length;
            const closeBraces = (content.match(/}/g) || []).length;
            const braceDiff = Math.abs(openBraces - closeBraces);
            if (braceDiff > 3) {
              truncationWarnings.push(`File ${filePath} has severely unmatched braces (${openBraces} open, ${closeBraces} closed)`);
            }

            if (content.length < 20 && content.includes('function') && !content.includes('}')) {
              truncationWarnings.push(`File ${filePath} appears severely truncated`);
            }
          }
        }

        if (truncationWarnings.length > 0 && appConfig.codeApplication.enableTruncationRecovery) {
          console.warn('[generate-ai-code-stream] Truncation detected, attempting to fix:', truncationWarnings);

          await sendProgress({
            type: 'warning',
            message: 'Detected incomplete code generation. Attempting to complete...',
            warnings: truncationWarnings
          });

          const truncatedFiles = [];
          const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
          let match;

          while ((match = fileRegex.exec(generatedCode)) !== null) {
            const filePath = match[1];
            const content = match[2];

            const hasEllipsis = content.includes('...') &&
              !content.includes('...rest') &&
              !content.includes('...props') &&
              !content.includes('spread');

            const endsAbruptly = content.trim().endsWith('...') ||
              content.trim().endsWith(',') ||
              content.trim().endsWith('(');

            const hasUnclosedTags = content.includes('</') &&
              !content.match(/<\/[a-zA-Z0-9]+>/) &&
              content.includes('<');

            const tooShort = content.length < 50 && filePath.match(/\.(jsx?|tsx?)$/);

            const openBraceCount = (content.match(/{/g) || []).length;
            const closeBraceCount = (content.match(/}/g) || []).length;
            const hasUnmatchedBraces = Math.abs(openBraceCount - closeBraceCount) > 1;

            const isTruncated = (hasEllipsis && endsAbruptly) ||
              hasUnclosedTags ||
              (tooShort && !content.includes('export')) ||
              hasUnmatchedBraces;

            if (isTruncated) {
              truncatedFiles.push(filePath);
            }
          }

          if (truncatedFiles.length > 0) {
            console.log('[generate-ai-code-stream] Attempting to regenerate truncated files:', truncatedFiles);

            for (const filePath of truncatedFiles) {
              await sendProgress({
                type: 'info',
                message: `Completing ${filePath}...`
              });

              try {
                const completionPrompt = `Complete the following file that was truncated. Provide the FULL file content.
                
File: ${filePath}
Original request: ${prompt}
                
Provide the complete file content without any truncation. Include all necessary imports, complete all functions, and close all tags properly.`;

                let completionClient;
                if (model.includes('gpt') || model.includes('openai')) {
                  completionClient = openai;
                } else if (model.includes('claude')) {
                  completionClient = anthropic;
                } else {
                  completionClient = groq;
                }

                const modelMapping = {
                  'anthropic/claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
                  'anthropic/claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
                  'groq/llama-3.1-70b-versatile': 'llama-3.1-70b-versatile',
                  'groq/llama-3.1-8b-instant': 'llama-3.1-8b-instant'
                };

                const isGPT5 = model.startsWith('openai/gpt-5');

                const completionResult = await streamText({
                  model: completionClient(modelMapping[model] || model),
                  messages: [
                    {
                      role: 'system',
                      content: 'You are completing a truncated file. Provide the complete, working file content.'
                    },
                    { role: 'user', content: completionPrompt }
                  ],
                  temperature: isGPT5 ? undefined : (appConfig?.ai?.defaultTemperature || 0.7),
                  maxTokens: appConfig?.ai?.truncationRecoveryMaxTokens || 4096
                });

                let completedContent = '';
                for await (const chunk of completionResult.textStream) {
                  completedContent += chunk;
                }

                const filePattern = new RegExp(
                  `<file path="${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?(?:</file>|$)`,
                  'g'
                );

                let cleanContent = completedContent;
                if (cleanContent.includes('```')) {
                  const codeMatch = cleanContent.match(/```[\w]*\n([\s\S]*?)```/);
                  if (codeMatch) {
                    cleanContent = codeMatch[1];
                  }
                }

                generatedCode = generatedCode.replace(
                  filePattern,
                  `<file path="${filePath}">\n${cleanContent}\n</file>`
                );

                console.log(`[generate-ai-code-stream] Successfully completed ${filePath}`);

              } catch (completionError) {
                console.error(`[generate-ai-code-stream] Failed to complete ${filePath}:`, completionError);
                await sendProgress({
                  type: 'warning',
                  message: `Could not auto-complete ${filePath}. Manual review may be needed.`
                });
              }
            }

            truncationWarnings.length = 0;
            await sendProgress({
              type: 'info',
              message: 'Truncation recovery complete'
            });
          }
        }

        await sendProgress({
          type: 'complete',
          generatedCode,
          explanation,
          files: files.length,
          components: componentCount,
          model,
          packagesToInstall: packagesToInstall.length > 0 ? packagesToInstall : undefined,
          warnings: truncationWarnings.length > 0 ? truncationWarnings : undefined
        });

        if (isEdit && editContext && global.conversationState) {
          const editRecord = {
            timestamp: Date.now(),
            userRequest: prompt,
            editType: editContext.editIntent.type,
            targetFiles: editContext.primaryFiles,
            confidence: editContext.editIntent.confidence,
            outcome: 'success' // Assuming success if we got here
          };

          global.conversationState.context.edits.push(editRecord);

          if (editContext.editIntent.type === 'ADD_FEATURE' || files.length > 3) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: editContext.editIntent.description,
              filesAffected: editContext.primaryFiles
            });
          }

          global.conversationState.lastUpdated = Date.now();

          console.log('[generate-ai-code-stream] Updated conversation history with edit:', editRecord);
        }

      } catch (error) {
        console.error('[generate-ai-code-stream] Stream processing error:', error);

        if (error.message?.includes('tool call validation failed')) {
          console.error('[generate-ai-code-stream] Tool call validation error - this may be due to the AI model sending incorrect parameters');
          await sendProgress({
            type: 'warning',
            message: 'Package installation tool encountered an issue. Packages will be detected from imports instead.'
          });
        } else {
          await sendProgress({
            type: 'error',
            error: error.message
          });
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[generate-ai-code-stream] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Extract the actual user request from the prompt
 */
function extractUserRequest(prompt) {
  // Remove common prefixes and extract the core request
  let userRequest = prompt;
  
  // Remove common AI instruction prefixes
  const prefixesToRemove = [
    'Create a modern, professional website based on this description:',
    'Generate a website based on the uploaded business document requirements:',
    'I want to recreate the',
    'I scraped this website and want you to recreate it as a modern React application.',
    'Please create a complete React application following the UI/UX design principles and the extracted business information.',
    'IMPORTANT INSTRUCTIONS:',
    'Focus on creating a beautiful, functional website based on the description.',
    'Create a COMPLETE, working React application',
    'Use a random design schema from the CSV file for inspiration',
    'Use Tailwind CSS for all styling (no custom CSS files)',
    'Make it responsive and modern',
    'Create proper component structure',
    'Make sure the app actually renders visible content',
    'Create ALL components that you reference in imports'
  ];
  
  for (const prefix of prefixesToRemove) {
    userRequest = userRequest.replace(prefix, '').trim();
  }
  
  // Remove quotes and extra whitespace
  userRequest = userRequest.replace(/^["']|["']$/g, '').trim();
  
  // If the request is still very long, take just the first sentence
  if (userRequest.length > 200) {
    const firstSentence = userRequest.split(/[.!?]/)[0];
    if (firstSentence.length > 10) {
      userRequest = firstSentence.trim();
    }
  }
  
  return userRequest || 'website';
}