import * as vscode from 'vscode';
import * as path from 'path';
import { Command } from '../common/commandManager';
import { runAndCapturePlots, CapturedFigure } from '../features/plotRunner';

export class ShowPlotOutputCommand implements Command {
    public readonly id = 'pythonVisualizer.showPlotOutput';

    public constructor(private readonly _context: vscode.ExtensionContext) {}

    public async execute(uri?: vscode.Uri) {
        let resource = uri;
        if (!(resource instanceof vscode.Uri)) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('Open a Python file first.');
                return;
            }
            resource = editor.document.uri;
        }

        const fileName = path.basename(resource.fsPath);
        const panel = vscode.window.createWebviewPanel(
            'pythonPlotOutput',
            `Plot: ${fileName}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = loadingHtml(fileName);

        try {
            const result = await runAndCapturePlots(resource.fsPath, this._context);
            panel.webview.html = resultHtml(fileName, result);
        } catch (err) {
            panel.webview.html = errorHtml(fileName, String(err));
        }
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Encode a string for use inside an HTML srcdoc="..." attribute value. */
function encodeSrcdoc(html: string): string {
    return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function loadingHtml(fileName: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); padding: 24px; color: var(--vscode-foreground); }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--vscode-progressBar-background); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body><span class="spinner"></span>Running <strong>${escapeHtml(fileName)}</strong>…</body></html>`;
}

function errorHtml(fileName: string, message: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); padding: 24px; color: var(--vscode-foreground); }
pre { font-family: var(--vscode-editor-font-family, monospace); background: var(--vscode-textBlockQuote-background); padding: 12px; white-space: pre-wrap; word-break: break-all; color: var(--vscode-errorForeground); }
</style></head>
<body><h3>Error running ${escapeHtml(fileName)}</h3><pre>${escapeHtml(message)}</pre></body></html>`;
}

function figureToHtml(fig: CapturedFigure, _index: number): string {
    if (fig.type === 'image/png') {
        return `<div class="figure"><img src="data:image/png;base64,${fig.data}" /></div>`;
    }
    if (fig.type === 'plotly-html') {
        // Render self-contained plotly HTML inside a sandboxed iframe.
        // allow-scripts lets plotly.js run; allow-same-origin is intentionally omitted.
        return `<div class="figure">
<iframe srcdoc="${encodeSrcdoc(fig.data)}"
  sandbox="allow-scripts"
  style="width:100%;height:600px;border:none;display:block;"
  loading="eager">
</iframe>
</div>`;
    }
    return '';
}

function resultHtml(
    fileName: string,
    result: { stdout: string; stderr: string; figures: CapturedFigure[]; error: string | null }
): string {
    const figureHtml = result.figures.map((fig, i) => figureToHtml(fig, i)).join('\n');

    const stdoutSection = result.stdout
        ? `<h4>Output</h4><pre class="stdout">${escapeHtml(result.stdout)}</pre>`
        : '';

    const errorSection = result.error
        ? `<h4>Error</h4><pre class="error">${escapeHtml(result.error)}</pre>`
        : '';

    const stderrSection = (result.stderr && result.stderr.trim())
        ? `<details><summary>Stderr</summary><pre class="stderr">${escapeHtml(result.stderr)}</pre></details>`
        : '';

    const noOutput = result.figures.length === 0 && !result.stdout && !result.error
        ? `<p class="hint">Script ran but produced no plots or output.</p>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-src 'self' data:;">
<style>
* { box-sizing: border-box; }
body { font-family: var(--vscode-font-family); padding: 16px 24px; color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; }
h3 { margin: 0 0 16px; font-size: 1em; opacity: 0.7; }
h4 { margin: 16px 0 6px; font-size: 0.9em; opacity: 0.7; }
.figure { margin: 12px 0; }
.figure img { max-width: 100%; border-radius: 4px; display: block; }
pre { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; background: var(--vscode-textBlockQuote-background); padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; margin: 0; }
pre.error { color: var(--vscode-errorForeground); }
details { margin-top: 12px; }
summary { cursor: pointer; opacity: 0.6; font-size: 0.85em; }
.hint { opacity: 0.5; font-style: italic; }
</style>
</head>
<body>
<h3>${escapeHtml(fileName)}</h3>
${figureHtml}
${stdoutSection}
${errorSection}
${stderrSection}
${noOutput}
</body>
</html>`;
}
