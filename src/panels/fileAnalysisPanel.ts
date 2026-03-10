import * as vscode from 'vscode';
import * as path from 'path';
import { CsMetric } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';

// A curated subset of metric keys to show (db_field name → display label)
// These match what CScout's file metrics tables use as column headings.
const DISPLAY_METRICS: { key: string; label: string }[] = [
    { key: 'NLINE', label: 'Lines' },
    { key: 'NSTMT', label: 'Statements' },
    { key: 'NOP', label: 'Operators' },
    { key: 'NIF', label: 'If statements' },
    { key: 'NTOKEN', label: 'Tokens' },
    { key: 'NUID', label: 'Unique identifiers' },
    { key: 'MAXSTMTNEST', label: 'Max nesting' },
    { key: 'NBCOMMENT', label: 'Block comments' },
    { key: 'NLCOMMENT', label: 'Line comments' },
    { key: 'NCHAR', label: 'Characters' },
];

export class FileMetricItem extends vscode.TreeItem {
    constructor(
        public readonly fileName: string,
        public readonly metrics: CsMetric[],
    ) {
        super(path.basename(fileName), vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.fileGroup';
        this.tooltip = fileName;
        // Exact match to avoid matching "Number of line comments" (which comes first and is 0)
        const lines = metrics.find(m => m.label === 'Number of lines');
        this.description = lines ? `${lines.value} lines` : path.dirname(fileName);
        this.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.blue'));
    }
}

class MetricNode extends vscode.TreeItem {
    public readonly _parentFile: string;
    constructor(metric: CsMetric, parentFile: string) {
        super(`${metric.label}: ${metric.value}`, vscode.TreeItemCollapsibleState.None);
        this._parentFile = parentFile;
        this.contextValue = 'cscoutLens.metric';
        this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.orange'));
        this.tooltip = `${metric.label}: ${metric.value}`;
    }
}

type AnalysisNode = FileMetricItem | MetricNode;

export class FileAnalysisPanel implements vscode.TreeDataProvider<AnalysisNode> {
    private readonly _onChange = new vscode.EventEmitter<AnalysisNode | undefined>();
    readonly onDidChangeTreeData = this._onChange.event;

    // Pre-built items array (same objects returned by getChildren)
    private _fileItems: FileMetricItem[] = [];
    private _treeView: vscode.TreeView<AnalysisNode> | undefined;

    setTreeView(tv: vscode.TreeView<AnalysisNode>): void {
        this._treeView = tv;
    }

    loadData(
        entries: Array<{ fileName: string; metrics: CsMetric[] }>,
        _client: CScoutAnalyzerClient,
    ): void {
        // Build items once — these same objects are returned from getChildren
        this._fileItems = entries.map(e => new FileMetricItem(e.fileName, e.metrics));
        this._onChange.fire(undefined);
    }

    private _normPath(p: string): string {
        return path.resolve(p).toLowerCase();
    }

    findFile(filePath: string): FileMetricItem | undefined {
        const norm = this._normPath(filePath);
        return this._fileItems.find(item => {
            const n = this._normPath(item.fileName);
            // Allow suffix match for Cygwin vs Windows path mismatches
            return n === norm || norm.endsWith(n.replace(/\\/g, '/'))
                || n.endsWith(norm.replace(/\\/g, '/'));
        });
    }

    focusFile(filePath: string): void {
        const item = this.findFile(filePath);
        if (!item) { return; }

        // Move to top and refresh
        const idx = this._fileItems.indexOf(item);
        if (idx > 0) {
            this._fileItems.splice(idx, 1);
            this._fileItems.unshift(item);
        }
        this._onChange.fire(undefined);

        // After tree refreshes, reveal the same object instance
        setTimeout(() => {
            this._treeView?.reveal(item, { select: true, focus: true, expand: true });
        }, 200);
    }

    clear(): void {
        this._fileItems = [];
        this._onChange.fire(undefined);
    }

    getTreeItem(el: AnalysisNode): vscode.TreeItem { return el; }

    getChildren(el?: AnalysisNode): vscode.ProviderResult<AnalysisNode[]> {
        if (!el) {
            return this._fileItems;
        }
        if (el instanceof FileMetricItem) {
            if (el.metrics.length === 0) {
                return [new MetricNode({ label: 'No metrics available', value: 0 }, el.fileName)];
            }
            return el.metrics.map(m => new MetricNode(m, el.fileName));
        }
        return [];
    }

    getParent(el: AnalysisNode): vscode.ProviderResult<AnalysisNode> {
        if (el instanceof MetricNode) {
            return this._fileItems.find(f => f.fileName === el._parentFile);
        }
        return undefined;
    }
}
