import * as vscode from 'vscode';
import * as path from 'path';
import { CsMetric } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';


class FileGroupNode extends vscode.TreeItem {
    constructor(
        public readonly fileName: string,
        public readonly metrics: CsMetric[],
    ) {
        super(path.basename(fileName), vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.fileGroup';
        this.description = path.dirname(fileName);
        this.tooltip = fileName;
        this.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.blue'));
    }
}

class MetricNode extends vscode.TreeItem {
    constructor(metric: CsMetric) {
        super(metric.label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'cscoutLens.metric';
        this.description = String(metric.value);
        this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.orange'));
        this.tooltip = `${metric.label}: ${metric.value}`;
    }
}

type AnalysisNode = FileGroupNode | MetricNode;


export class FileAnalysisPanel implements vscode.TreeDataProvider<AnalysisNode> {
    private readonly _onChange = new vscode.EventEmitter<AnalysisNode | undefined>();
    readonly onDidChangeTreeData = this._onChange.event;

    private _entries: Array<{ fileName: string; metrics: CsMetric[] }> = [];
    private _client: CScoutAnalyzerClient | undefined;

    loadData(
        entries: Array<{ fileName: string; metrics: CsMetric[] }>,
        client: CScoutAnalyzerClient,
    ): void {
        this._entries = entries;
        this._client = client;
        this._onChange.fire(undefined);
    }

    /** Move a specific file to the top of the list so it appears first */
    focusFile(filePath: string): void {
        const lower = filePath.toLowerCase();
        const idx = this._entries.findIndex(e => e.fileName.toLowerCase() === lower);
        if (idx > 0) {
            const [entry] = this._entries.splice(idx, 1);
            this._entries.unshift(entry);
            this._onChange.fire(undefined);
        }
    }

    findFile(filePath: string): FileGroupNode | undefined {
        const lower = filePath.toLowerCase();
        const entry = this._entries.find(e => e.fileName.toLowerCase() === lower);
        return entry ? new FileGroupNode(entry.fileName, entry.metrics) : undefined;
    }

    clear(): void {
        this._entries = [];
        this._client = undefined;
        this._onChange.fire(undefined);
    }

    getTreeItem(el: AnalysisNode): vscode.TreeItem { return el; }

    getChildren(el?: AnalysisNode): vscode.ProviderResult<AnalysisNode[]> {
        if (!el) {
            return this._entries.map(e => new FileGroupNode(e.fileName, e.metrics));
        }
        if (el instanceof FileGroupNode) {
            return el.metrics.map(m => new MetricNode(m));
        }
        return [];
    }
}
