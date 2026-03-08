import * as vscode from 'vscode';
import { CScoutAnalyzerClient } from './analyzer/client';
import { CsFile, CsSymbol } from './analyzer/types';
import { WorkspacePanel } from './panels/workspacePanel';
import { SymbolPanel } from './panels/symbolPanel';
import { FileAnalysisPanel } from './panels/fileAnalysisPanel';
import { FunctionMapPanel } from './panels/functionMapPanel';
import { CScoutHoverHandler } from './handlers/hoverHandler';
import { CScoutNavigationHandler } from './handlers/navigationHandler';
import { CScoutAnalysisHandler } from './handlers/analysisHandler';

// ─── module-level state ───────────────────────────────────────────────────────

let analyzer: CScoutAnalyzerClient | undefined;
const log = vscode.window.createOutputChannel('CScout Lens');

export function activate(context: vscode.ExtensionContext): void {
    log.appendLine('CScout Lens activated.');

    const workspacePanel    = new WorkspacePanel();
    const symbolPanel       = new SymbolPanel();
    const fileAnalysisPanel = new FileAnalysisPanel();
    const functionMapPanel  = new FunctionMapPanel();

    vscode.window.registerTreeDataProvider('cscoutLens.workspace',    workspacePanel);
    vscode.window.registerTreeDataProvider('cscoutLens.symbols',      symbolPanel);
    vscode.window.registerTreeDataProvider('cscoutLens.fileAnalysis', fileAnalysisPanel);
    vscode.window.registerTreeDataProvider('cscoutLens.functionMap',  functionMapPanel);

    // Language feature handlers
    const hoverHandler = new CScoutHoverHandler();
    const navHandler   = new CScoutNavigationHandler(() => analyzer);

    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: 'c' }, hoverHandler),
        vscode.languages.registerDefinitionProvider({ language: 'c' }, navHandler),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.connect', async () => {
            const cfg  = vscode.workspace.getConfiguration('cscoutLens');
            const host = cfg.get<string>('host') ?? 'localhost';
            const port = cfg.get<number>('port') ?? 8081;

            analyzer = new CScoutAnalyzerClient(host, port);
            log.appendLine(`Connecting to CScout at ${analyzer.baseUrl()} …`);

            const reachable = await analyzer.isReachable();
            if (!reachable) {
                vscode.window.showErrorMessage(
                    `CScout Lens: cannot reach ${analyzer.baseUrl()}. ` +
                    'Start CScout first (e.g. cscout your-workspace.cs).',
                );
                analyzer = undefined;
                return;
            }

            log.appendLine('Connected — loading analysis data…');
            await refreshAll(workspacePanel, symbolPanel, fileAnalysisPanel, functionMapPanel, hoverHandler, navHandler);
        }),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.disconnect', () => {
            analyzer = undefined;
            workspacePanel.clear();
            symbolPanel.clear();
            fileAnalysisPanel.clear();
            functionMapPanel.clear();
            hoverHandler.updateCache([]);
            navHandler.invalidate();
            CScoutAnalysisHandler.clear();
            vscode.window.showInformationMessage('CScout Lens disconnected.');
            log.appendLine('Disconnected.');
        }),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.refresh', async () => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected. Use "Connect to Analyzer" first.');
                return;
            }
            await refreshAll(workspacePanel, symbolPanel, fileAnalysisPanel, functionMapPanel, hoverHandler, navHandler);
        }),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.showFileAnalysis', async () => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const filePath = editor.document.uri.fsPath;
            const found = fileAnalysisPanel.findFile(filePath);
            if (!found) {
                vscode.window.showInformationMessage(`CScout Lens: '${filePath}' is not part of the analyzed workspace.`);
                return;
            }
            fileAnalysisPanel.focusFile(filePath);
            await vscode.commands.executeCommand('cscoutLens.fileAnalysis.focus');
        }),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.focusFunction', async () => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const range = editor.document.getWordRangeAtPosition(editor.selection.active);
            if (!range) {
                vscode.window.showInformationMessage('Place your cursor on a function name first.');
                return;
            }
            const word = editor.document.getText(range);
            functionMapPanel.focusFunction(word);
            await vscode.commands.executeCommand('cscoutLens.functionMap.focus');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.openLocation', async (filePath: string, line: number, col: number) => {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(line, col);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.listUnused', async () => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected.');
                return;
            }
            try {
                const unused = await analyzer.getSymbols(true);
                log.appendLine(`\n── Unused symbols (${unused.length}) ──`);
                for (const sym of unused) {
                    log.appendLine(`  ${sym.kind.padEnd(10)} ${sym.name}  (eid=${sym.eid})`);
                }
                log.show();
                vscode.window.showInformationMessage(
                    `CScout Lens: found ${unused.length} unused symbols. See output panel for details.`,
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`CScout Lens: failed to fetch unused symbols — ${msg}`);
            }
        }),
    );

    log.appendLine('CScout Lens ready. Use "CScout Lens: Connect to Analyzer" to begin.');
}

export function deactivate(): void {
    analyzer = undefined;
    CScoutAnalysisHandler.clear();
}

async function refreshAll(
    workspacePanel:    WorkspacePanel,
    symbolPanel:       SymbolPanel,
    fileAnalysisPanel: FileAnalysisPanel,
    functionMapPanel:  FunctionMapPanel,
    hoverHandler:      CScoutHoverHandler,
    navHandler:        CScoutNavigationHandler,
): Promise<void> {
    if (!analyzer) { return; }
    const client = analyzer;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'CScout Lens: Analyzing…',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Loading workspace structure…' });
            const projects = await client.getProjects();
            const fileMap = new Map<number, CsFile[]>();
            for (const proj of projects) {
                const files = await client.getProjectFiles(proj.pid).catch(() => []);
                fileMap.set(proj.pid, files);
            }
            workspacePanel.loadData(projects, fileMap);

            progress.report({ message: 'Loading symbols…' });
            const symbols: CsSymbol[] = await client.getSymbols().catch(() => []);
            hoverHandler.updateCache(symbols);
            navHandler.invalidate();
            symbolPanel.loadData(symbols, client);

            progress.report({ message: 'Loading file metrics…' });
            const allFiles = [...fileMap.values()].flat();
            const metricsEntries = await Promise.all(
                allFiles.map(f =>
                    client.getFileMetrics(f.fid)
                        .then(m => ({ fileName: f.path, metrics: m }))
                        .catch(() => ({ fileName: f.path, metrics: [] })),
                ),
            );
            fileAnalysisPanel.loadData(metricsEntries, client);

            progress.report({ message: 'Loading functions…' });
            const functions = await client.getFunctions(true).catch(() => []);
            functionMapPanel.loadData(functions, client);

            progress.report({ message: 'Computing diagnostics…' });
            const unusedSymbols = await client.getSymbols(true).catch(() => []);
            await CScoutAnalysisHandler.refresh(unusedSymbols, client);

            const summary = `${symbols.length} symbols · ${allFiles.length} files · ${functions.length} functions`;
            log.appendLine(`Analysis complete: ${summary}`);
            vscode.window.showInformationMessage(`CScout Lens: ${summary}`);
        },
    );
}
