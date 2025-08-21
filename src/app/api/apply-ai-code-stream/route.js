import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';


function parseAIResponse(response) {
  const sections = {
    files: [],
    commands: [],
    packages: [],
    structure: null,
    explanation: '',
    template: ''
  };

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

          if (packageName === 'react-router-dom' || packageName.includes('router') || packageName.includes('icon')) {
            console.log(`[apply-ai-code-stream] Detected package from imports: ${packageName}`);
          }
        }
      }
    }

    return packages;
  }

  // FIXED: More robust file parsing that handles conversational text and truncated content
  const fileMap = new Map();

  // First, try to find complete file blocks
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    
    // Skip empty or very short content
    if (content.length < 10) {
      console.warn(`[apply-ai-code-stream] Skipping file ${filePath} with very short content: ${content.length} chars`);
      continue;
    }

    fileMap.set(filePath, { content, isComplete: true });
    console.log(`[apply-ai-code-stream] Found complete file: ${filePath} (${content.length} chars)`);
  }

  // If no complete files found, try to find incomplete file blocks
  if (fileMap.size === 0) {
    console.log('[apply-ai-code-stream] No complete files found, looking for incomplete file blocks...');
    
    const incompleteFileRegex = /<file path="([^"]+)">([\s\S]*?)$/g;
    while ((match = incompleteFileRegex.exec(response)) !== null) {
      const filePath = match[1];
      const content = match[2].trim();
      
      if (content.length > 50) { // Only accept files with substantial content
        fileMap.set(filePath, { content, isComplete: false });
        console.log(`[apply-ai-code-stream] Found incomplete file: ${filePath} (${content.length} chars)`);
      }
    }
  }

  // If still no files found, try to extract from conversational text
  if (fileMap.size === 0) {
    console.log('[apply-ai-code-stream] No file blocks found, attempting to extract from conversational text...');
    
    // Look for code blocks that might be files
    const codeBlockRegex = /```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/g;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const content = match[1].trim();
      
      // Try to determine if this is a React component
      if (content.includes('import React') || content.includes('export default') || content.includes('function') || content.includes('const')) {
        // Try to extract filename from content or use a default
        let fileName = 'Component.jsx';
        
        // Look for component name in the content
        const componentMatch = content.match(/(?:function|const)\s+(\w+)/);
        if (componentMatch) {
          fileName = `${componentMatch[1]}.jsx`;
        }
        
        // Look for export default name
        const exportMatch = content.match(/export\s+default\s+(\w+)/);
        if (exportMatch) {
          fileName = `${exportMatch[1]}.jsx`;
        }
        
        const filePath = `src/components/${fileName}`;
        
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { content, isComplete: true });
          console.log(`[apply-ai-code-stream] Extracted component from code block: ${filePath}`);
        }
      }
    }
  }

  // Process found files
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[apply-ai-code-stream] Warning: File ${path} appears to be truncated (no closing tag)`);
      
      // Try to complete the file content if it looks like it was cut off
      if (content.includes('import') && !content.includes('export default') && !content.includes('export {')) {
        console.log(`[apply-ai-code-stream] Attempting to complete truncated file: ${path}`);
        
        // Add a basic export if missing
        let completedContent = content;
        if (!completedContent.includes('export default')) {
          const componentName = path.split('/').pop().replace('.jsx', '').replace('.js', '');
          completedContent += `\n\nexport default ${componentName};`;
        }
        
        sections.files.push({
          path,
          content: completedContent
        });
      } else {
        sections.files.push({
          path,
          content
        });
      }
    } else {
      sections.files.push({
        path,
        content
      });
    }

    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // FIXED: Better handling of markdown file blocks
  const markdownFileRegex = /```(?:file )?path="([^"]+)"\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    
    // Only add if not already processed
    if (!sections.files.some(f => f.path === filePath)) {
      sections.files.push({
        path: filePath,
        content: content
      });
      console.log(`[apply-ai-code-stream] Found markdown file block: ${filePath}`);
    }

    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from markdown imports: ${pkg}`);
      }
    }
  }

  // FIXED: Better handling of generated files from plain text
  const generatedFilesMatch = response.match(/Generated Files?:\s*([^\n]+)/i);
  if (generatedFilesMatch) {
    const filesList = generatedFilesMatch[1]
      .split(',')
      .map(f => f.trim())
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.json') || f.endsWith('.html'));
    console.log(`[apply-ai-code-stream] Detected generated files from plain text: ${filesList.join(', ')}`);

    for (const fileName of filesList) {
      const fileContentRegex = new RegExp(`${fileName}[\\s\\S]*?(?:import[\\s\\S]+?)(?=Generated Files:|Applying code|$)`, 'i');
      const fileContentMatch = response.match(fileContentRegex);
      if (fileContentMatch) {
        const codeMatch = fileContentMatch[0].match(/^(import[\s\S]+)$/m);
        if (codeMatch) {
          const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;
          
          // Only add if not already processed
          if (!sections.files.some(f => f.path === filePath)) {
            sections.files.push({
              path: filePath,
              content: codeMatch[1].trim()
            });
            console.log(`[apply-ai-code-stream] Extracted content for ${filePath}`);
          }

          const filePackages = extractPackagesFromCode(codeMatch[1]);
          for (const pkg of filePackages) {
            if (!sections.packages.includes(pkg)) {
              sections.packages.push(pkg);
              console.log(`[apply-ai-code-stream] Package detected from imports: ${pkg}`);
            }
          }
        }
      }
    }
  }

  // FIXED: Better code block extraction
  const codeBlockRegex = /```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const content = match[1].trim();
    const fileNameMatch = content.match(/\/\/\s*(?:File:|Component:)\s*([^\n]+)/);
    if (fileNameMatch) {
      const fileName = fileNameMatch[1].trim();
      const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;

      if (!sections.files.some(f => f.path === filePath)) {
        sections.files.push({
          path: filePath,
          content: content
        });
        console.log(`[apply-ai-code-stream] Extracted file from code block: ${filePath}`);
      }

      const filePackages = extractPackagesFromCode(content);
      for (const pkg of filePackages) {
        if (!sections.packages.includes(pkg)) {
          sections.packages.push(pkg);
        }
      }
    }
  }

  // Extract commands
  const cmdRegex = /<command>(.*?)<\/command>/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Extract packages
  const pkgRegex = /<package>(.*?)<\/package>/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }

  const packagesRegex = /<packages>([\s\S]*?)<\/packages>/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    const packagesList = packagesContent.split(/[\n,]+/)
      .map(pkg => pkg.trim())
      .filter(pkg => pkg.length > 0);
    sections.packages.push(...packagesList);
  }

  // Extract structure
  const structureMatch = /<structure>([\s\S]*?)<\/structure>/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  // Extract explanation
  const explanationMatch = /<explanation>([\s\S]*?)<\/explanation>/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  // FIXED: Better logging for debugging
  console.log(`[apply-ai-code-stream] Parsing results:`);
  console.log(`[apply-ai-code-stream] - Files found: ${sections.files.length}`);
  console.log(`[apply-ai-code-stream] - Packages found: ${sections.packages.length}`);
  console.log(`[apply-ai-code-stream] - Commands found: ${sections.commands.length}`);
  
  if (sections.files.length > 0) {
    sections.files.forEach((file, index) => {
      console.log(`[apply-ai-code-stream] - File ${index + 1}: ${file.path} (${file.content.length} chars)`);
    });
  }

  return sections;
}

export async function POST(request) {
  try {
    const { response, isEdit = false, packages = [], sandboxId } = await request.json();

    if (!response) {
      return NextResponse.json({
        error: 'response is required'
      }, { status: 400 });
    }

    console.log('[apply-ai-code-stream] Received response to parse:');
    console.log('[apply-ai-code-stream] Response length:', response.length);
    console.log('[apply-ai-code-stream] Response preview:', response.substring(0, 500));
    console.log('[apply-ai-code-stream] isEdit:', isEdit);
    console.log('[apply-ai-code-stream] packages:', packages);

    const parsed = parseAIResponse(response);

    console.log('[apply-ai-code-stream] Parsed result:');
    console.log('[apply-ai-code-stream] Files found:', parsed.files.length);
    if (parsed.files.length > 0) {
      parsed.files.forEach(f => {
        console.log(`[apply-ai-code-stream] - ${f.path} (${f.content.length} chars)`);
      });
    }
    console.log('[apply-ai-code-stream] Packages found:', parsed.packages);

    if (!global.existingFiles) {
      global.existingFiles = new Set();
    }

    let sandbox = global.activeSandbox;

    if (!sandbox && sandboxId) {
      console.log(`[apply-ai-code-stream] Sandbox ${sandboxId} not in this instance, attempting reconnect...`);

      try {
        sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
        console.log(`[apply-ai-code-stream] Successfully reconnected to sandbox ${sandboxId}`);

        global.activeSandbox = sandbox;

        if (!global.sandboxData) {
          const host = sandbox.getHost(5173);
          global.sandboxData = {
            sandboxId,
            url: `https://${host}`
          };
        }

        if (!global.existingFiles) {
          global.existingFiles = new Set();
        }
      } catch (reconnectError) {
        console.error(`[apply-ai-code-stream] Failed to reconnect to sandbox ${sandboxId}:`, reconnectError);

        return NextResponse.json({
          success: false,
          error: `Failed to reconnect to sandbox ${sandboxId}. The sandbox may have expired or been terminated.`,
          results: {
            filesCreated: [],
            packagesInstalled: [],
            commandsExecuted: [],
            errors: [`Sandbox reconnection failed: ${reconnectError.message}`]
          },
          explanation: parsed.explanation,
          structure: parsed.structure,
          parsedFiles: parsed.files,
          message: `Parsed ${parsed.files.length} files but couldn't apply them - sandbox reconnection failed.`
        });
      }
    }

    if (!sandbox && !sandboxId) {
      console.log('[apply-ai-code-stream] No sandbox available and no sandboxId provided');
      return NextResponse.json({
        success: false,
        error: 'No active sandbox found. Please create a sandbox first.',
        results: {
          filesCreated: [],
          packagesInstalled: [],
          commandsExecuted: [],
          errors: ['No sandbox available']
        },
        explanation: parsed.explanation,
        structure: parsed.structure,
        parsedFiles: parsed.files,
        message: `Parsed ${parsed.files.length} files but no sandbox available to apply them.`
      });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendProgress = async (data) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    (async (sandboxInstance, req) => {
      const results = {
        filesCreated: [],
        filesUpdated: [],
        filesDeleted: [],
        packagesInstalled: [],
        packagesAlreadyInstalled: [],
        packagesFailed: [],
        commandsExecuted: [],
        errors: []
      };

      try {
        await sendProgress({
          type: 'start',
          message: 'Starting code application...',
          totalSteps: isEdit ? 3 : 4
        });

        // FIXED: Clear existing files if this is not an edit operation (redesign/rebuild)
        if (!isEdit) {
          await sendProgress({
            type: 'step',
            step: 1,
            message: 'Clearing existing files for complete rebuild...'
          });

          try {
            // FIXED: Ensure existingFiles is properly initialized before clearing
            if (!global.existingFiles) {
              global.existingFiles = new Set();
            }
            
            // Clear the existing files tracking
            global.existingFiles.clear();
            
            // Clear the file cache if it exists
            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files = {};
            }

            console.log('[apply-ai-code-stream] Cleared existing files tracking for complete rebuild');
            
            await sendProgress({
              type: 'step-complete',
              step: 1,
              message: 'Existing files cleared successfully'
            });
          } catch (clearError) {
            console.warn('[apply-ai-code-stream] Warning: Could not clear existing files:', clearError.message);
            await sendProgress({
              type: 'warning',
              message: `Could not clear existing files: ${clearError.message}. Continuing with rebuild...`
            });
          }
        }

        const packagesArray = Array.isArray(packages) ? packages : [];
        const parsedPackages = Array.isArray(parsed.packages) ? parsed.packages : [];

        const allPackages = [...packagesArray.filter(pkg => pkg && typeof pkg === 'string'), ...parsedPackages];

        const uniquePackages = [...new Set(allPackages)]
          .filter(pkg => pkg && typeof pkg === 'string' && pkg.trim() !== '')
          .filter(pkg => pkg !== 'react' && pkg !== 'react-dom');

        if (allPackages.length !== uniquePackages.length) {
          console.log(`[apply-ai-code-stream] Removed ${allPackages.length - uniquePackages.length} duplicate packages`);
          console.log(`[apply-ai-code-stream] Original packages:`, allPackages);
          console.log(`[apply-ai-code-stream] Deduplicated packages:`, uniquePackages);
        }

        if (uniquePackages.length > 0) {
          await sendProgress({
            type: 'step',
            step: isEdit ? 1 : 2,
            message: `Installing ${uniquePackages.length} packages...`,
            packages: uniquePackages
          });

          try {
            const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/install-packages`;

            const installResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                packages: uniquePackages,
                sandboxId: sandboxId || sandboxInstance.sandboxId
              })
            });

            if (installResponse.ok && installResponse.body) {
              const reader = installResponse.body.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                if (!chunk) continue;
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));

                      await sendProgress({
                        type: 'package-progress',
                        ...data
                      });

                      if (data.type === 'success' && data.installedPackages) {
                        results.packagesInstalled = data.installedPackages;
                      }
                    } catch (e) {
                      // Silent error handling for malformed JSON
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('[apply-ai-code-stream] Error installing packages:', error);
            await sendProgress({
              type: 'warning',
              message: `Package installation skipped (${error.message}). Continuing with file creation...`
            });
            results.errors.push(`Package installation failed: ${error.message}`);
          }
        } else {
          await sendProgress({
            type: 'step',
            step: isEdit ? 1 : 2,
            message: 'No additional packages to install, skipping...'
          });
        }

        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({
          type: 'step',
          step: isEdit ? 2 : 3,
          message: `Creating ${filesArray.length} files...`
        });

        const configFiles = ['tailwind.config.js', 'vite.config.js', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.js'];
        const filteredFiles = filesArray.filter(file => {
          if (!file || typeof file !== 'object') return false;
          const fileName = (file.path || '').split('/').pop() || '';
          return !configFiles.includes(fileName);
        });

        // FIXED: Ensure existingFiles is properly initialized before file processing
        if (!global.existingFiles) {
          global.existingFiles = new Set();
        }

        for (const [index, file] of filteredFiles.entries()) {
          try {
            await sendProgress({
              type: 'file-progress',
              current: index + 1,
              total: filteredFiles.length,
              fileName: file.path,
              action: isEdit ? 'updating' : 'creating'
            });

            let normalizedPath = file.path;
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('src/') &&
              !normalizedPath.startsWith('public/') &&
              normalizedPath !== 'index.html' &&
              !configFiles.includes(normalizedPath.split('/').pop() || '')) {
              normalizedPath = 'src/' + normalizedPath;
            }

            const fullPath = `/home/user/app/${normalizedPath}`;
            const isUpdate = global.existingFiles.has(normalizedPath);

            let fileContent = file.content;
            if (file.path.endsWith('.jsx') || file.path.endsWith('.js') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
              fileContent = fileContent.replace(
                /import\s+['"]([^'"]+\.css)['"];?\s*\n?/g,
                (m, p1) => (p1.endsWith('index.css') ? m : '')
              );
            }

            const isEntry = normalizedPath === 'src/main.jsx' || normalizedPath === 'src/main.tsx';
            if (isEntry && !/import\s+['"]\.\/index\.css['"]/.test(fileContent)) {
              fileContent = `import './index.css'\n` + fileContent;
            }

            const escapedContent = fileContent
              .replace(/\\/g, '\\\\')
              .replace(/"""/g, '\\"\\"\\"')
              .replace(/\$/g, '\\$');

            await sandboxInstance.runCode(`
import os
os.makedirs(os.path.dirname("${fullPath}"), exist_ok=True)
with open("${fullPath}", 'w') as f:
    f.write("""${escapedContent}""")
print(f"File written: ${fullPath}")
            `);

            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files[normalizedPath] = {
                content: fileContent,
                lastModified: Date.now()
              };
            }

            if (isUpdate) {
              if (results.filesUpdated) results.filesUpdated.push(normalizedPath);
            } else {
              if (results.filesCreated) results.filesCreated.push(normalizedPath);
              if (global.existingFiles) global.existingFiles.add(normalizedPath);
            }

            await sendProgress({
              type: 'file-complete',
              fileName: normalizedPath,
              action: isEdit ? 'updated' : 'created'
            });
          } catch (error) {
            if (results.errors) {
              results.errors.push(`Failed to create ${file.path}: ${error.message}`);
            }
            await sendProgress({
              type: 'file-error',
              fileName: file.path,
              error: error.message
            });
          }
        }

        const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [];
        if (commandsArray.length > 0) {
          await sendProgress({
            type: 'step',
            step: isEdit ? 3 : 4,
            message: `Executing ${commandsArray.length} commands...`
          });

          for (const [index, cmd] of commandsArray.entries()) {
            try {
              await sendProgress({
                type: 'command-progress',
                current: index + 1,
                total: parsed.commands.length,
                command: cmd,
                action: 'executing'
              });

              const result = await sandboxInstance.commands.run(cmd, {
                cwd: '/home/user/app',
                timeout: 60,
                on_stdout: async (data) => {
                  await sendProgress({
                    type: 'command-output',
                    command: cmd,
                    output: data,
                    stream: 'stdout'
                  });
                },
                on_stderr: async (data) => {
                  await sendProgress({
                    type: 'command-output',
                    command: cmd,
                    output: data,
                    stream: 'stderr'
                  });
                }
              });

              if (results.commandsExecuted) {
                results.commandsExecuted.push(cmd);
              }

              await sendProgress({
                type: 'command-complete',
                command: cmd,
                success: true
              });
            } catch (error) {
              if (results.errors) {
                results.errors.push(`Failed to execute command ${cmd}: ${error.message}`);
              }
              await sendProgress({
                type: 'command-error',
                command: cmd,
                error: error.message
              });
            }
          }
        }

        await sendProgress({
          type: 'success',
          message: isEdit ? 'Code updated successfully!' : 'Website rebuilt from scratch successfully!',
          results: {
            filesCreated: results.filesCreated,
            filesUpdated: results.filesUpdated,
            filesDeleted: results.filesDeleted,
            packagesInstalled: results.packagesInstalled,
            commandsExecuted: results.commandsExecuted,
            errors: results.errors
          },
          explanation: parsed.explanation,
          structure: parsed.structure,
          parsedFiles: parsed.files,
          isEdit: isEdit
        });

      } catch (error) {
        console.error('[apply-ai-code-stream] Error in main processing:', error);
        await sendProgress({
          type: 'error',
          message: `Failed to apply code: ${error.message}`,
          error: error.message
        });
      }
    })(sandbox, request);

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('[apply-ai-code-stream] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results: {
        filesCreated: [],
        packagesInstalled: [],
        commandsExecuted: [],
        errors: [error.message]
      }
    });
  }
}