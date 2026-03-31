import * as vscode from 'vscode';
import { CScoutAnalyzerClient } from './analyzer/client';
import { CsFile, CsSymbol, CsMetric } from './analyzer/types';
import { WorkspacePanel } from './panels/workspacePanel';
import { SymbolPanel } from './panels/symbolPanel';
import { FileAnalysisPanel } from './panels/fileAnalysisPanel';
import { FunctionMapPanel } from './panels/functionMapPanel';
import { CScoutHoverHandler } from './handlers/hoverHandler';
import { CScoutNavigationHandler } from './handlers/navigationHandler';
import { CScoutAnalysisHandler } from './handlers/analysisHandler';
import { createGraphPanel, GraphData } from './webview/renderGraph';

// ─── module-level state ───────────────────────────────────────────────────────

let analyzer: CScoutAnalyzerClient | undefined;
const log = vscode.window.createOutputChannel('CScout Lens');

// Filter state
interface FilterState {
    identifiers: {
        readonly: boolean;
        writable: boolean;
        unused: boolean;
        functions: boolean;
        macros: boolean;
        typedefs: boolean;
    };
    files: {
        readonly: boolean;
        writable: boolean;
    };
    functions: {
        defined: boolean;
        static: boolean;
    };
}

const filterState: FilterState = {
    identifiers: { readonly: true, writable: true, unused: false, functions: true, macros: true, typedefs: true },
    files: { readonly: true, writable: true },
    functions: { defined: true, static: true },
};

export function activate(context: vscode.ExtensionContext): void {
    log.appendLine('CScout Lens activated.');

    const workspacePanel = new WorkspacePanel();
    const symbolPanel = new SymbolPanel();
    const fileAnalysisPanel = new FileAnalysisPanel();
    const functionMapPanel = new FunctionMapPanel();

    vscode.window.registerTreeDataProvider('cscoutLens.workspace', workspacePanel);
    vscode.window.registerTreeDataProvider('cscoutLens.symbols', symbolPanel);
    const fileAnalysisTreeView = vscode.window.createTreeView('cscoutLens.fileAnalysis', {
        treeDataProvider: fileAnalysisPanel,
    });
    fileAnalysisPanel.setTreeView(fileAnalysisTreeView);
    context.subscriptions.push(fileAnalysisTreeView);
    vscode.window.registerTreeDataProvider('cscoutLens.functionMap', functionMapPanel);

    // Language feature handlers
    const hoverHandler = new CScoutHoverHandler();
    const navHandler = new CScoutNavigationHandler(() => analyzer);

    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: 'c' }, hoverHandler),
        vscode.languages.registerDefinitionProvider({ language: 'c' }, navHandler),
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.connect', async () => {
            const cfg = vscode.workspace.getConfiguration('cscoutLens');
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

    // ─── Filter Commands ───────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.openFilter', async () => {
            const options: vscode.QuickPickItem[] = [
                { label: 'Readonly identifiers', picked: filterState.identifiers.readonly, description: 'Include readonly identifiers' },
                { label: 'Writable identifiers', picked: filterState.identifiers.writable, description: 'Include writable identifiers' },
                { label: 'Unused only', picked: filterState.identifiers.unused, description: 'Show only unused identifiers' },
                { label: 'Functions', picked: filterState.identifiers.functions, description: 'Include function identifiers' },
                { label: 'Macros', picked: filterState.identifiers.macros, description: 'Include macro identifiers' },
                { label: 'Typedefs', picked: filterState.identifiers.typedefs, description: 'Include typedef identifiers' },
            ];

            const selected = await vscode.window.showQuickPick(options, {
                canPickMany: true,
                placeHolder: 'Select identifier filters',
                title: 'Filter Identifiers',
            });

            if (selected) {
                const labels = selected.map(s => s.label);
                filterState.identifiers.readonly = labels.includes('Readonly identifiers');
                filterState.identifiers.writable = labels.includes('Writable identifiers');
                filterState.identifiers.unused = labels.includes('Unused only');
                filterState.identifiers.functions = labels.includes('Functions');
                filterState.identifiers.macros = labels.includes('Macros');
                filterState.identifiers.typedefs = labels.includes('Typedefs');
                
                // Refresh symbol panel with new filters
                if (analyzer) {
                    const symbols = await analyzer.getSymbols(filterState.identifiers.unused);
                    let filtered = symbols;
                    if (!filterState.identifiers.functions) {
                        filtered = filtered.filter(s => s.kind !== 'function');
                    }
                    if (!filterState.identifiers.macros) {
                        filtered = filtered.filter(s => s.kind !== 'macro');
                    }
                    if (!filterState.identifiers.typedefs) {
                        filtered = filtered.filter(s => s.kind !== 'typedef');
                    }
                    symbolPanel.loadData(filtered, analyzer);
                    vscode.window.showInformationMessage(`Filter applied: ${filtered.length} identifiers shown`);
                }
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.openFileFilter', async () => {
            const options: vscode.QuickPickItem[] = [
                { label: 'Readonly files', picked: filterState.files.readonly, description: 'Include system/readonly files' },
                { label: 'Writable files', picked: filterState.files.writable, description: 'Include writable project files' },
            ];

            const selected = await vscode.window.showQuickPick(options, {
                canPickMany: true,
                placeHolder: 'Select file filters',
                title: 'Filter Files',
            });

            if (selected) {
                const labels = selected.map(s => s.label);
                filterState.files.readonly = labels.includes('Readonly files');
                filterState.files.writable = labels.includes('Writable files');
                vscode.window.showInformationMessage('File filter applied. Refresh to see changes.');
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.openFunctionFilter', async () => {
            const options: vscode.QuickPickItem[] = [
                { label: 'Defined functions', picked: filterState.functions.defined, description: 'Include defined functions' },
                { label: 'Static functions', picked: filterState.functions.static, description: 'Include static/file-scoped functions' },
            ];

            const selected = await vscode.window.showQuickPick(options, {
                canPickMany: true,
                placeHolder: 'Select function filters',
                title: 'Filter Functions',
            });

            if (selected) {
                const labels = selected.map(s => s.label);
                filterState.functions.defined = labels.includes('Defined functions');
                filterState.functions.static = labels.includes('Static functions');

                // Refresh function panel with new filters
                if (analyzer) {
                    const functions = await analyzer.getFunctions(filterState.functions.defined);
                    let filtered = functions;
                    if (!filterState.functions.static) {
                        filtered = filtered.filter(f => !f.isStatic);
                    }
                    functionMapPanel.loadData(filtered, analyzer);
                    vscode.window.showInformationMessage(`Filter applied: ${filtered.length} functions shown`);
                }
            }
        }),
    );

    // ─── Graph Commands ────────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.showCallGraph', async (treeItem?: any) => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected.');
                return;
            }

            let functionName: string;
            let targetFunc: any;

            // Called from tree view context menu
            if (treeItem && treeItem.fn) {
                functionName = treeItem.fn.name;
                targetFunc = treeItem.fn;
            } else {
                // Called from editor
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showInformationMessage('Open a C file and place cursor on a function name.');
                    return;
                }

                const range = editor.document.getWordRangeAtPosition(editor.selection.active);
                if (!range) {
                    vscode.window.showInformationMessage('Place cursor on a function name.');
                    return;
                }

                functionName = editor.document.getText(range);
                
                const functions = await analyzer.getFunctions();
                targetFunc = functions.find(f => f.name === functionName);
                
                if (!targetFunc) {
                    vscode.window.showInformationMessage(`Function '${functionName}' not found in analysis.`);
                    return;
                }
            }
            
            try {
                const callers = await analyzer.getCallers(targetFunc.fid);
                const callees = await analyzer.getCallees(targetFunc.fid);

                const graphData: GraphData = {
                    title: `Call Graph: ${functionName}`,
                    nodes: [
                        { id: targetFunc.fid, label: functionName, type: 'function' },
                        ...callers.map(c => ({ id: c.fid, label: c.name, type: 'function' as const })),
                        ...callees.map(c => ({ id: c.fid, label: c.name, type: 'function' as const })),
                    ],
                    edges: [
                        ...callers.map(c => ({ source: c.fid, target: targetFunc.fid, label: 'calls' })),
                        ...callees.map(c => ({ source: targetFunc.fid, target: c.fid, label: 'calls' })),
                    ],
                };

                createGraphPanel(context, graphData);
                log.appendLine(`Graph: ${functionName} - ${callers.length} callers, ${callees.length} callees`);

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Failed to build call graph: ${msg}`);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cscoutLens.showFullCallGraph', async () => {
            if (!analyzer) {
                vscode.window.showWarningMessage('CScout Lens: not connected.');
                return;
            }

            try {
                const functions = await analyzer.getFunctions(true);
                
                // Build graph with all functions and their relationships
                const nodes = functions.map(f => ({
                    id: f.fid,
                    label: f.name,
                    type: 'function' as const,
                }));

                const edges: Array<{ source: string; target: string; label?: string }> = [];
                
                // Get call relationships for each function (limit to first 50 for performance)
                const limitedFunctions = functions.slice(0, 50);
                for (const func of limitedFunctions) {
                    const callees = await analyzer.getCallees(func.fid);
                    for (const callee of callees) {
                        if (functions.some(f => f.fid === callee.fid)) {
                            edges.push({ source: func.fid, target: callee.fid });
                        }
                    }
                }

                const graphData: GraphData = {
                    title: 'Full Call Graph',
                    nodes,
                    edges,
                };

                createGraphPanel(context, graphData);
                log.appendLine(`Full graph: ${nodes.length} functions, ${edges.length} edges`);

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Failed to build full call graph: ${msg}`);
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
    workspacePanel: WorkspacePanel,
    symbolPanel: SymbolPanel,
    fileAnalysisPanel: FileAnalysisPanel,
    functionMapPanel: FunctionMapPanel,
    hoverHandler: CScoutHoverHandler,
    navHandler: CScoutNavigationHandler,
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
            const metricsEntries: Array<{ fileName: string; metrics: CsMetric[] }> = [];
            for (const f of allFiles) {
                try {
                    const m = await client.getFileMetrics(f.fid);
                    log.appendLine(`  metrics: ${f.path} → ${m.length} entries`);
                    metricsEntries.push({ fileName: f.path, metrics: m });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    log.appendLine(`  metrics FAILED: fid=${f.fid} ${f.path}: ${msg}`);
                    metricsEntries.push({ fileName: f.path, metrics: [] });
                }
            }
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
