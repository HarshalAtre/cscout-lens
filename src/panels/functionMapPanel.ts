import * as vscode from 'vscode';
import { CsFunction } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';

class FunctionNode extends vscode.TreeItem {
    parentVisited: Set<string> | undefined;

    constructor(public readonly fn: CsFunction) {
        super(fn.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.function';
        const isMacroLike = fn.name === fn.name.toUpperCase() && fn.name.length > 1;
        this.iconPath = new vscode.ThemeIcon(
            isMacroLike ? 'symbol-constant' : 'symbol-function',
            new vscode.ThemeColor(isMacroLike ? 'charts.purple' : 'charts.yellow'),
        );
        this.description = fn.isStatic ? 'static' : '';
        this.tooltip = `${fn.name}${fn.isStatic ? ' (static)' : ''}`;
    }
}

type RelationKind = 'callers' | 'callees';

class RelationNode extends vscode.TreeItem {
    constructor(
        public readonly funcId: string,
        public readonly kind: RelationKind,
        count: number,
        public readonly visitedIds: ReadonlySet<string> = new Set(),
    ) {
        const label = kind === 'callers' ? `Callers (${count})` : `Callees (${count})`;
        super(label, count > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.contextValue = `cscoutLens.${kind}`;
        this.iconPath = new vscode.ThemeIcon(
            kind === 'callers' ? 'call-incoming' : 'call-outgoing',
            new vscode.ThemeColor(kind === 'callers' ? 'charts.green' : 'charts.orange'),
        );
    }
}

type FunctionMapNode = FunctionNode | RelationNode;


export class FunctionMapPanel implements vscode.TreeDataProvider<FunctionMapNode> {
    private readonly _onChange = new vscode.EventEmitter<FunctionMapNode | undefined>();
    readonly onDidChangeTreeData = this._onChange.event;

    private _allFunctions: CsFunction[] = [];
    private _roots: CsFunction[] = [];
    private _client: CScoutAnalyzerClient | undefined;

    loadData(functions: CsFunction[], client: CScoutAnalyzerClient): void {
        this._allFunctions = functions;
        this._roots = functions;
        this._client = client;
        this._onChange.fire(undefined);
    }

    focusFunction(name: string): void {
        const fn = this._allFunctions.find(f => f.name === name);
        this._roots = fn ? [fn] : this._allFunctions;
        this._onChange.fire(undefined);
    }

    resetToAll(): void {
        this._roots = this._allFunctions;
        this._onChange.fire(undefined);
    }

    clear(): void {
        this._allFunctions = [];
        this._roots = [];
        this._client = undefined;
        this._onChange.fire(undefined);
    }

    getTreeItem(el: FunctionMapNode): vscode.TreeItem { return el; }

    getChildren(el?: FunctionMapNode): vscode.ProviderResult<FunctionMapNode[]> {
        if (!el) {
            return this._roots.map(f => new FunctionNode(f));
        }

        if (el instanceof FunctionNode && this._client) {
            const client = this._client;
            const fid = el.fn.fid;
            const visited = el.parentVisited ?? new Set<string>();
            return Promise.all([
                client.getCallers(fid).catch(() => []),
                client.getCallees(fid).catch(() => []),
            ]).then(([callers, callees]) => [
                new RelationNode(fid, 'callers', callers.length, visited),
                new RelationNode(fid, 'callees', callees.length, visited),
            ]);
        }

        if (el instanceof RelationNode && this._client) {
            const client = this._client;
            const fetch = el.kind === 'callers'
                ? client.getCallers(el.funcId)
                : client.getCallees(el.funcId);
            return fetch
                .then(fns => {
                    // Build the new visited set for children of this relation
                    const nextVisited = new Set(el.visitedIds);
                    nextVisited.add(el.funcId);
                    return fns
                        .filter(f => !nextVisited.has(f.fid)) // stop cycles
                        .map(f => {
                            const node = new FunctionNode(f);
                            node.parentVisited = nextVisited;
                            return node;
                        });
                })
                .catch(() => []);
        }

        return [];
    }
}
