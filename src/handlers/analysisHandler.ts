import * as vscode from 'vscode';
import * as fs from 'fs';
import { CsSymbol } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';

export class CScoutAnalysisHandler {
    private static readonly _collection =
        vscode.languages.createDiagnosticCollection('cscout-lens');

    static async refresh(
        unusedSymbols: CsSymbol[],
        client: CScoutAnalyzerClient,
    ): Promise<void> {
        this._collection.clear();

        const batch = unusedSymbols.slice(0, 30);
        const diagMap = new Map<string, vscode.Diagnostic[]>();

        for (const sym of batch) {
            let locs;
            try {
                locs = await client.getSymbolLocations(sym.eid);
            } catch {
                continue;
            }

            for (const loc of locs) {
                if (!fs.existsSync(loc.filePath)) { continue; }

                const startPos = new vscode.Position(
                    Math.max(0, loc.line - 1),
                    Math.max(0, loc.column),
                );
                const endPos = new vscode.Position(
                    Math.max(0, loc.line - 1),
                    Math.max(0, loc.column + sym.name.length),
                );
                const range = new vscode.Range(startPos, endPos);

                const diag = new vscode.Diagnostic(
                    range,
                    `Unused symbol: '${sym.name}' (CScout whole-program analysis)`,
                    vscode.DiagnosticSeverity.Warning,
                );
                diag.source = 'CScout Lens';
                diag.code = 'unused-symbol';

                const bucket = diagMap.get(loc.filePath) ?? [];
                bucket.push(diag);
                diagMap.set(loc.filePath, bucket);
            }
        }

        for (const [filePath, diags] of diagMap) {
            this._collection.set(vscode.Uri.file(filePath), diags);
        }
    }

    static clear(): void {
        this._collection.clear();
    }
}
