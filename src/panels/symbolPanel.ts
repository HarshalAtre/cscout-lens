import * as vscode from 'vscode';
import * as path from 'path';
import { CsSymbol, CsLocation } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';


const KIND_META: Record<CsSymbol['kind'], { label: string; icon: string; color: string }> = {
    function:  { label: 'Functions',            icon: 'symbol-function',  color: 'charts.yellow' },
    macro:     { label: 'Macros',               icon: 'symbol-constant',  color: 'charts.purple' },
    typedef:   { label: 'Typedefs',             icon: 'symbol-class',     color: 'charts.blue'   },
    tag:       { label: 'Struct / Union / Enum', icon: 'symbol-struct',    color: 'charts.green'  },
    member:    { label: 'Struct Members',        icon: 'symbol-field',     color: 'charts.orange' },
    variable:  { label: 'Variables',             icon: 'symbol-variable',  color: 'charts.red'    },
};


class KindNode extends vscode.TreeItem {
    constructor(
        public readonly kind: CsSymbol['kind'],
        count: number,
    ) {
        const meta = KIND_META[kind];
        super(`${meta.label} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.symbolKind';
        this.iconPath = new vscode.ThemeIcon(meta.icon, new vscode.ThemeColor(meta.color));
    }
}

class SymbolNode extends vscode.TreeItem {
    constructor(public readonly symbol: CsSymbol) {
        super(symbol.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.symbol';
        this.description = symbol.unused ? 'unused' : '';
        this.iconPath = new vscode.ThemeIcon(
            symbol.unused ? 'warning' : 'symbol-namespace',
            new vscode.ThemeColor(symbol.unused ? 'list.warningForeground' : 'charts.blue'),
        );
        this.tooltip = `${symbol.name} [${symbol.kind}]${symbol.unused ? ' — unused' : ''}`;
    }
}

class OccurrenceNode extends vscode.TreeItem {
    constructor(loc: CsLocation) {
        const base = path.basename(loc.filePath);
        const label = `${base}:${loc.line}:${loc.column}`;
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'cscoutLens.occurrence';
        this.tooltip = `${loc.filePath}:${loc.line}:${loc.column}`;
        this.iconPath = new vscode.ThemeIcon('go-to-file', new vscode.ThemeColor('charts.green'));
        this.command = {
            command: 'cscoutLens.openLocation',
            title: 'Go to Location',
            arguments: [loc.filePath, loc.line - 1, loc.column],
        };
    }
}

type SymbolPanelNode = KindNode | SymbolNode | OccurrenceNode;


export class SymbolPanel implements vscode.TreeDataProvider<SymbolPanelNode> {
    private readonly _onChange = new vscode.EventEmitter<SymbolPanelNode | undefined>();
    readonly onDidChangeTreeData = this._onChange.event;

    private _symbols: CsSymbol[] = [];
    private _client: CScoutAnalyzerClient | undefined;

    loadData(symbols: CsSymbol[], client: CScoutAnalyzerClient): void {
        this._symbols = symbols;
        this._client = client;
        this._onChange.fire(undefined);
    }

    clear(): void {
        this._symbols = [];
        this._client = undefined;
        this._onChange.fire(undefined);
    }

    getTreeItem(el: SymbolPanelNode): vscode.TreeItem { return el; }

    getChildren(el?: SymbolPanelNode): vscode.ProviderResult<SymbolPanelNode[]> {
        if (!el) {
            // Root: one node per kind that has at least one symbol
            return (Object.keys(KIND_META) as CsSymbol['kind'][])
                .map(k => ({ kind: k, count: this._symbols.filter(s => s.kind === k).length }))
                .filter(x => x.count > 0)
                .map(x => new KindNode(x.kind, x.count));
        }

        if (el instanceof KindNode) {
            return this._symbols
                .filter(s => s.kind === el.kind)
                .slice(0, 300)
                .map(s => new SymbolNode(s));
        }

        if (el instanceof SymbolNode && this._client) {
            return this._client
                .getSymbolLocations(el.symbol.eid)
                .then(locs => locs.map(l => new OccurrenceNode(l)))
                .catch(() => []);
        }

        return [];
    }
}
