// Create this new file: /api/clear-sandbox-files/route.js

import { NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';

export async function POST(request) {
  try {
    const { sandboxId, isRedesign = false } = await request.json();

    if (!sandboxId) {
      return NextResponse.json({
        success: false,
        error: 'Sandbox ID is required'
      }, { status: 400 });
    }

    console.log('[clear-sandbox-files] *** CLEARING FILES FOR REDESIGN ***');
    console.log('[clear-sandbox-files] - sandboxId:', sandboxId);
    console.log('[clear-sandbox-files] - isRedesign:', isRedesign);

    // Get or connect to sandbox
    let sandbox = global.activeSandbox;
    if (!sandbox || sandbox.sandboxId !== sandboxId) {
      try {
        sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
        global.activeSandbox = sandbox;
        console.log('[clear-sandbox-files] Connected to sandbox:', sandboxId);
      } catch (error) {
        console.error('[clear-sandbox-files] Failed to connect to sandbox:', error);
        return NextResponse.json({
          success: false,
          error: `Failed to connect to sandbox: ${error.message}`
        }, { status: 500 });
      }
    }

    try {
      // Clear global file tracking
      if (global.existingFiles) {
        const originalCount = global.existingFiles.size;
        global.existingFiles.clear();
        console.log('[clear-sandbox-files] Cleared existingFiles set:', originalCount, '-> 0');
      }

      // Clear sandbox state cache
      if (global.sandboxState?.fileCache) {
        const originalFiles = Object.keys(global.sandboxState.fileCache.files || {}).length;
        global.sandboxState.fileCache.files = {};
        global.sandboxState.fileCache.manifest = null;
        console.log('[clear-sandbox-files] Cleared sandbox cache:', originalFiles, '-> 0');
      }

      // Execute file clearing in sandbox
      const clearResult = await sandbox.runCode(`
import os
import shutil
import json

print("[CLEAR] Starting comprehensive file clearing for redesign...")
results = {"deleted_files": [], "deleted_dirs": [], "errors": []}

# Clear src directory completely
src_path = '/home/user/app/src'
if os.path.exists(src_path):
    print(f"[CLEAR] Removing entire src directory: {src_path}")
    try:
        # Count files before deletion
        for root, dirs, files in os.walk(src_path):
            for file in files:
                results["deleted_files"].append(os.path.join(root, file))
        
        shutil.rmtree(src_path)
        results["deleted_dirs"].append(src_path)
        print(f"[CLEAR] Successfully removed src directory with {len(results['deleted_files'])} files")
    except Exception as e:
        results["errors"].append(f"Failed to remove src: {str(e)}")
        print(f"[CLEAR] ERROR: {str(e)}")

# Recreate empty src directory
try:
    os.makedirs(src_path, exist_ok=True)
    print("[CLEAR] Recreated empty src directory")
except Exception as e:
    results["errors"].append(f"Failed to recreate src: {str(e)}")

# Clear public directory (except essential files)
public_path = '/home/user/app/public'
if os.path.exists(public_path):
    for item in os.listdir(public_path):
        if item not in ['index.html', 'vite.svg']:
            item_path = os.path.join(public_path, item)
            try:
                if os.path.isfile(item_path):
                    os.remove(item_path)
                    results["deleted_files"].append(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                    results["deleted_dirs"].append(item_path)
            except Exception as e:
                results["errors"].append(f"Failed to remove {item_path}: {str(e)}")

# Verify clearing
remaining_files = []
if os.path.exists(src_path):
    for root, dirs, files in os.walk(src_path):
        for file in files:
            remaining_files.append(os.path.join(root, file))

print(f"[CLEAR] FINAL RESULT:")
print(f"[CLEAR] - Files deleted: {len(results['deleted_files'])}")
print(f"[CLEAR] - Directories deleted: {len(results['deleted_dirs'])}")  
print(f"[CLEAR] - Files remaining in src: {len(remaining_files)}")
print(f"[CLEAR] - Errors: {len(results['errors'])}")

if remaining_files:
    print(f"[CLEAR] WARNING: Files still exist: {remaining_files}")
    results["errors"].append(f"Files still present: {remaining_files}")

if results['errors']:
    print(f"[CLEAR] ERRORS: {results['errors']}")

print(json.dumps(results))
      `);

      console.log('[clear-sandbox-files] Clearing result:', clearResult.output);

      // Parse results
      let clearStats = {
        deleted_files: [],
        deleted_dirs: [],
        errors: []
      };

      try {
        const output = clearResult.output || '';
        const jsonMatch = output.match(/\{.*"deleted_files".*\}/s);
        if (jsonMatch) {
          clearStats = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.log('[clear-sandbox-files] Could not parse clear results:', parseError);
      }

      const success = clearStats.errors.length === 0;
      const message = success 
        ? `Successfully cleared ${clearStats.deleted_files.length} files and ${clearStats.deleted_dirs.length} directories`
        : `Clearing completed with ${clearStats.errors.length} errors`;

      return NextResponse.json({
        success: true,
        filesDeleted: clearStats.deleted_files.length,
        dirsDeleted: clearStats.deleted_dirs.length,
        errors: clearStats.errors,
        message: message,
        sandboxCleared: true
      });

    } catch (error) {
      console.error('[clear-sandbox-files] Error during clearing:', error);
      return NextResponse.json({
        success: false,
        error: `File clearing failed: ${error.message}`,
        sandboxCleared: false
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[clear-sandbox-files] Request error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}