import * as vscode from 'vscode';
import * as path from 'path';
import { CsProjectEntry, CsFile } from '../analyzer/types';


class ProjectNode extends vscode.TreeItem {
    constructor(public readonly entry: CsProjectEntry) {
        super(entry.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'cscoutLens.project';
        this.iconPath = new vscode.ThemeIcon('project', new vscode.ThemeColor('charts.purple'));
        this.tooltip = `Project: ${entry.name} (pid=${entry.pid})`;
    }
}

class FileNode extends vscode.TreeItem {
    constructor(public readonly file: CsFile) {
        super(path.basename(file.path), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'cscoutLens.file';
        this.iconPath = new vscode.ThemeIcon(
            file.writable ? 'file-code' : 'lock',
            new vscode.ThemeColor(file.writable ? 'charts.blue' : 'charts.red'),
        );
        this.description = path.dirname(file.path);
        this.tooltip = file.path;
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(file.path)],
        };
    }
}

type WorkspaceNode = ProjectNode | FileNode;


export class WorkspacePanel implements vscode.TreeDataProvider<WorkspaceNode> {
    private readonly _onChange = new vscode.EventEmitter<WorkspaceNode | undefined>();
    readonly onDidChangeTreeData = this._onChange.event;

    private _projects: CsProjectEntry[] = [];
    private _fileMap = new Map<number, CsFile[]>();

    loadData(projects: CsProjectEntry[], fileMap: Map<number, CsFile[]>): void {
        this._projects = projects;
        this._fileMap = fileMap;
        this._onChange.fire(undefined);
    }

    clear(): void {
        this._projects = [];
        this._fileMap.clear();
        this._onChange.fire(undefined);
    }

    getTreeItem(element: WorkspaceNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: WorkspaceNode): vscode.ProviderResult<WorkspaceNode[]> {
        if (!element) {
            if (this._projects.length === 0) { return []; }
            return this._projects.map(p => new ProjectNode(p));
        }
        if (element instanceof ProjectNode) {
            const files = this._fileMap.get(element.entry.pid) ?? [];
            return files.map(f => new FileNode(f));
        }
        return [];
    }
}
