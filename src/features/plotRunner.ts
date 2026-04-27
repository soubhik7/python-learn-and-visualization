import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import pvUtils from '../debugger/common/pvUtils';

export interface CapturedFigure {
    type: 'image/png' | 'plotly' | 'plotly-html';
    data: string;
}

export interface PlotRunResult {
    stdout: string;
    stderr: string;
    figures: CapturedFigure[];
    error: string | null;
}

export async function runAndCapturePlots(
    scriptPath: string,
    context: vscode.ExtensionContext
): Promise<PlotRunResult> {
    const pythonPath = await pvUtils.getPythonPath();
    const runnerScript = context.asAbsolutePath(
        path.join('pythonFiles', 'pydev', 'pg_run.py')
    );

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn(pythonPath, [runnerScript, scriptPath]);

        proc.stdout.setEncoding('utf-8');
        proc.stdout.on('data', (d: string) => { stdout += d; });

        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', (d: string) => { stderr += d; });

        proc.on('close', () => {
            try {
                const result = JSON.parse(stdout.trim()) as PlotRunResult;
                resolve(result);
            } catch {
                resolve({
                    stdout: '',
                    stderr: stderr || stdout,
                    figures: [],
                    error: `Failed to parse output.\n\nRaw output:\n${stdout}\n\nStderr:\n${stderr}`
                });
            }
        });

        proc.on('error', reject);
    });
}
