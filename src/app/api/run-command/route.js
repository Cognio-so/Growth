import { NextResponse } from 'next/server';



export async function POST(request) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json({
        success: false,
        error: 'Command is required'
      }, { status: 400 });
    }

    if (!global.activeSandbox) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 400 });
    }

    console.log(`[run-command] Executing: ${command}`);

    const result = await global.activeSandbox.runCode(`
import subprocess
import os

os.chdir('/home/user/app')
result = subprocess.run(${JSON.stringify(command.split(' '))}, 
                       capture_output=True, 
                       text=True, 
                       shell=False)

print("STDOUT:")
print(result.stdout)
if result.stderr:
    print("\\nSTDERR:")
    print(result.stderr)
print(f"\\nReturn code: {result.returncode}")
    `);

    const output = result.logs.stdout.join('\n');

    return NextResponse.json({
      success: true,
      output,
      message: 'Command executed successfully'
    });

  } catch (error) {
    console.error('[run-command] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}