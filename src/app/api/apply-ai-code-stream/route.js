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
        }
      }
    }
    return packages;
  }

  const fileMap = new Map();
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
  let match;
  
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = response.substring(match.index, match.index + match[0].length).includes('</file>');

    const existing = fileMap.get(filePath);
    let shouldReplace = false;
    
    if (!existing) {
      shouldReplace = true;
    } else if (!existing.isComplete && hasClosingTag) {
      shouldReplace = true;
      console.log(`[parseAIResponse] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete && hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true;
      console.log(`[parseAIResponse] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete && !hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true;
    }

    if (shouldReplace) {
      if (content.includes('...') && !content.includes('...props') && !content.includes('...rest')) {
        console.warn(`[parseAIResponse] Warning: ${filePath} contains ellipsis, may be truncated`);
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }

  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[parseAIResponse] Warning: File ${path} appears to be truncated (no closing tag)`);
    }

    sections.files.push({
      path,
      content
    });

    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[parseAIResponse] Package detected from imports: ${pkg}`);
      }
    }
  }

  // Parse markdown file blocks as fallback
  const markdownFileRegex = /```(?:file )?path="([^"]+)"\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    sections.files.push({
      path: filePath,
      content: content
    });

    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[parseAIResponse] Package detected from imports: ${pkg}`);
      }
    }
  }

  // Parse other XML tags
  const cmdRegex = /<command>(.*?)<\/command>/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  const pkgRegex = /<package>(.*?)<\/package>/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }

  const packagesRegex = /<packages>([\s\S]*?)<\/packages>/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesList = packagesMatch[1].trim().split(/[\n,]+/)
      .map(pkg => pkg.trim()).filter(pkg => pkg.length > 0);
    sections.packages.push(...packagesList);
  }

  const structureMatch = /<structure>([\s\S]*?)<\/structure>/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  const explanationMatch = /<explanation>([\s\S]*?)<\/explanation>/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  const templateMatch = /<template>(.*?)<\/template>/;
  const templResult = response.match(templateMatch);
  if (templResult) {
    sections.template = templResult[1].trim();
  }

  return sections;
}

// CRITICAL FIX: Clear files BEFORE streaming begins
async function clearSandboxFiles(sandbox, sendProgress) {
  console.log('[apply-ai-code-stream] *** CLEARING ALL FILES FOR REDESIGN ***');
  
  await sendProgress({
    type: 'step',
    message: 'Clearing existing files for complete redesign...'
  });

  try {
    // Clear the existing files tracking
    if (global.existingFiles) {
      console.log('[apply-ai-code-stream] Clearing existingFiles set, had', global.existingFiles.size, 'files');
      global.existingFiles.clear();
    }

    // Clear the sandbox state cache to prevent conflicts
    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.files = {};
      global.sandboxState.fileCache.manifest = null;
      console.log('[apply-ai-code-stream] Cleared sandbox state cache');
    }

    // Remove all existing files in the src directory - ENHANCED VERSION
    const clearResult = await sandbox.runCode(`
import os
import shutil
import json

print("[CLEAR] Starting comprehensive file clearing process...")

results = {"deleted_files": [], "deleted_dirs": [], "errors": []}

# List all current files before deletion for tracking
src_path = '/home/user/app/src'
if os.path.exists(src_path):
    print(f"[CLEAR] Found src directory: {src_path}")
    # List all files before deletion
    for root, dirs, files in os.walk(src_path):
        for file in files:
            file_path = os.path.join(root, file)
            results["deleted_files"].append(file_path)
            print(f"[CLEAR] Will delete file: {file_path}")
    
    # Remove entire src directory
    try:
        shutil.rmtree(src_path)
        print(f"[CLEAR] Successfully removed entire src directory")
        results["deleted_dirs"].append(src_path)
    except Exception as e:
        results["errors"].append(f"Failed to remove src: {str(e)}")
        print(f"[CLEAR] ERROR removing src: {str(e)}")
else:
    print(f"[CLEAR] No src directory found to remove")

# Recreate src directory
try:
    os.makedirs(src_path, exist_ok=True)
    print(f"[CLEAR] Recreated empty src directory: {src_path}")
except Exception as e:
    results["errors"].append(f"Failed to create src: {str(e)}")
    print(f"[CLEAR] ERROR creating src: {str(e)}")

# Clear components directory if it exists separately
components_path = '/home/user/app/src/components'
if os.path.exists(components_path):
    try:
        shutil.rmtree(components_path)
        print(f"[CLEAR] Removed components directory")
    except:
        pass

# Also clear public directory except index.html and vite.svg
public_path = '/home/user/app/public'
if os.path.exists(public_path):
    print(f"[CLEAR] Clearing public directory: {public_path}")
    for item in os.listdir(public_path):
        item_path = os.path.join(public_path, item)
        if os.path.isfile(item_path) and item not in ['index.html', 'vite.svg']:
            try:
                os.remove(item_path)
                results["deleted_files"].append(item_path)
                print(f"[CLEAR] Removed file: {item_path}")
            except Exception as e:
                results["errors"].append(f"Failed to remove {item_path}: {str(e)}")
        elif os.path.isdir(item_path):
            try:
                shutil.rmtree(item_path)
                results["deleted_dirs"].append(item_path)
                print(f"[CLEAR] Removed directory: {item_path}")
            except Exception as e:
                results["errors"].append(f"Failed to remove {item_path}: {str(e)}")

# Double-check: Verify clearing worked
if os.path.exists(src_path):
    remaining_files = []
    for root, dirs, files in os.walk(src_path):
        for file in files:
            remaining_files.append(os.path.join(root, file))
    print(f"[CLEAR] VERIFICATION: Files remaining in src: {len(remaining_files)}")
    if remaining_files:
        print(f"[CLEAR] WARNING: Still have files:", remaining_files)
        results["errors"].append(f"Files still present: {remaining_files}")
    else:
        print(f"[CLEAR] SUCCESS: All files cleared from src directory")
else:
    print(f"[CLEAR] ERROR: src directory doesn't exist after recreation!")

# Final summary
print(f"[CLEAR] SUMMARY:")
print(f"[CLEAR] - Deleted {len(results['deleted_files'])} files")
print(f"[CLEAR] - Deleted {len(results['deleted_dirs'])} directories")
print(f"[CLEAR] - Errors: {len(results['errors'])}")
if results['errors']:
    print(f"[CLEAR] ERRORS OCCURRED:", results['errors'])

print(json.dumps(results))
            `);
            
    console.log('[apply-ai-code-stream] Clear result:', clearResult.output);
    
    // Parse the clear results to check for errors
    try {
      const clearOutput = clearResult.output || '';
      const jsonMatch = clearOutput.match(/\{.*"deleted_files".*\}/s);
      if (jsonMatch) {
        const clearStats = JSON.parse(jsonMatch[0]);
        console.log('[apply-ai-code-stream] Clear statistics:', clearStats);
        
        if (clearStats.errors && clearStats.errors.length > 0) {
          console.error('[apply-ai-code-stream] Errors during clearing:', clearStats.errors);
          await sendProgress({
            type: 'warning',
            message: `File clearing completed with warnings: ${clearStats.errors.join(', ')}`
          });
        } else {
          await sendProgress({
            type: 'info',
            message: `Successfully cleared ${clearStats.deleted_files.length} files and ${clearStats.deleted_dirs.length} directories`
          });
        }
      } else {
        await sendProgress({
          type: 'info',
          message: 'File clearing completed'
        });
      }
    } catch (parseError) {
      console.log('[apply-ai-code-stream] Could not parse clear results:', parseError);
      await sendProgress({
        type: 'info',
        message: 'File clearing process completed'
      });
    }

    return true;
  } catch (error) {
    console.error('[apply-ai-code-stream] Error clearing files:', error);
    await sendProgress({
      type: 'warning',
      message: `File clearing failed: ${error.message}. Continuing anyway...`
    });
    return false;
  }
}

// Update the apply-ai-code-stream/route.js to remove the clearing logic:

export async function POST(request) {
  try {
    const { response, isEdit = false, isRedesign = false, packages = [], sandboxId } = await request.json();

    if (!response) {
      return NextResponse.json({ error: 'response is required' }, { status: 400 });
    }

    console.log('[apply-ai-code-stream] *** REQUEST DETAILS ***');
    console.log('[apply-ai-code-stream] - isEdit:', isEdit);
    console.log('[apply-ai-code-stream] - isRedesign:', isRedesign);
    console.log('[apply-ai-code-stream] - sandboxId:', sandboxId);

    if (isRedesign) {
      console.log('[apply-ai-code-stream] *** REDESIGN MODE: Files should already be cleared ***');
    }

    const parsed = parseAIResponse(response);
    console.log('[apply-ai-code-stream] Parsed files:', parsed.files.length);

    if (!global.existingFiles) {
      global.existingFiles = new Set();
    }

    // Get or reconnect to sandbox (same as before)
    let sandbox = global.activeSandbox;
    if (!sandbox && sandboxId) {
      try {
        sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
        global.activeSandbox = sandbox;
      } catch (reconnectError) {
        return NextResponse.json({
          success: false,
          error: `Failed to reconnect to sandbox: ${reconnectError.message}`
        });
      }
    }

    if (!sandbox) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox found'
      });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendProgress = async (data) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // REMOVED: File clearing logic (now handled before AI generation)
    // Process files directly
    (async () => {
      const results = {
        filesCreated: [],
        filesUpdated: [],
        packagesInstalled: [],
        packagesFailed: [],
        commandsExecuted: [],
        errors: []
      };

      try {
        await sendProgress({
          type: 'start',
          message: `Applying generated code...${isRedesign ? ' (Post-redesign)' : ''}`
        });

        // Install packages (same as before)
        const allPackages = [...packages, ...parsed.packages].filter(pkg => 
          pkg && typeof pkg === 'string' && pkg !== 'react' && pkg !== 'react-dom'
        );
        const uniquePackages = [...new Set(allPackages)];

        if (uniquePackages.length > 0) {
          // Package installation logic (same as before)
          await sendProgress({ type: 'step', message: `Installing ${uniquePackages.length} packages...` });
          // ... existing package installation code
        }

        // Create files
        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({ type: 'step', message: `Creating ${filesArray.length} files...` });

        const configFiles = ['tailwind.config.js', 'vite.config.js', 'package.json', 'package-lock.json'];
        const filteredFiles = filesArray.filter(file => {
          const fileName = (file.path || '').split('/').pop() || '';
          return !configFiles.includes(fileName);
        });

        for (const [index, file] of filteredFiles.entries()) {
          try {
            let normalizedPath = file.path;
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('src/') && !normalizedPath.startsWith('public/')) {
              normalizedPath = 'src/' + normalizedPath;
            }

            const fullPath = `/home/user/app/${normalizedPath}`;
            
            // For redesign, all files are new since sandbox was cleared
            const isUpdate = isRedesign ? false : global.existingFiles.has(normalizedPath);

            let fileContent = file.content;
            const isEntry = normalizedPath === 'src/main.jsx' || normalizedPath === 'src/main.tsx';
            if (isEntry && !/import\s+['"]\.\/index\.css['"]/.test(fileContent)) {
              fileContent = `import './index.css'\n` + fileContent;
            }

            // Write file to sandbox
            const escapedContent = fileContent
              .replace(/\\/g, '\\\\')
              .replace(/"""/g, '\\"\\"\\"')
              .replace(/\$/g, '\\$');

            await sandbox.runCode(`
import os
os.makedirs(os.path.dirname("${fullPath}"), exist_ok=True)
with open("${fullPath}", 'w') as f:
    f.write("""${escapedContent}""")
print(f"File written: ${fullPath}")
            `);

            // Update tracking
            if (isUpdate) {
              results.filesUpdated.push(normalizedPath);
            } else {
              results.filesCreated.push(normalizedPath);
              global.existingFiles.add(normalizedPath);
            }

            await sendProgress({
              type: 'file-complete',
              fileName: normalizedPath,
              action: isUpdate ? 'updated' : 'created'
            });

          } catch (error) {
            results.errors.push(`Failed to create ${file.path}: ${error.message}`);
          }
        }

        // Execute commands (same as before)
        for (const cmd of parsed.commands) {
          try {
            await sandbox.commands.run(cmd, { cwd: '/home/user/app', timeout: 60 });
            results.commandsExecuted.push(cmd);
          } catch (error) {
            results.errors.push(`Failed to execute ${cmd}: ${error.message}`);
          }
        }

        await sendProgress({
          type: 'complete',
          results,
          message: `Successfully applied ${results.filesCreated.length} files${isRedesign ? ' (Complete redesign)' : ''}`
        });

      } catch (error) {
        await sendProgress({ type: 'error', error: error.message });
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
    console.error('Apply AI code stream error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}