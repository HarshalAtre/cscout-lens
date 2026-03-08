import * as vscode from 'vscode';
import { CsSymbol } from '../analyzer/types';
import { CScoutAnalyzerClient } from '../analyzer/client';

export class CScoutNavigationHandler implements vscode.DefinitionProvider {
    private _symbolCache: CsSymbol[] = [];
    private _cacheTimestamp = 0;
    private readonly CACHE_TTL_MS = 60_000;

    constructor(private readonly getClient: () => CScoutAnalyzerClient | undefined) {}

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Definition | undefined> {
        const client = this.getClient();
        if (!client) { return undefined; }

        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) { return undefined; }

        const word = document.getText(wordRange);
        if (!word || word.length < 2) { return undefined; }

        try {
            await this._ensureCache(client);
            const sym = this._symbolCache.find(s => s.name === word);
            if (!sym) { return undefined; }

            const locations = await client.getSymbolLocations(sym.eid);
            if (locations.length === 0) { return undefined; }

            const loc = locations[0];
            const targetUri = vscode.Uri.file(loc.filePath);
            const targetPos = new vscode.Position(
                Math.max(0, loc.line - 1),
                Math.max(0, loc.column),
            );
            return new vscode.Location(targetUri, targetPos);
        } catch (err) {
            console.error('[CScout Lens] definition lookup failed:', err);
            return undefined;
        }
    }

    private async _ensureCache(client: CScoutAnalyzerClient): Promise<void> {
        const now = Date.now();
        if (now - this._cacheTimestamp < this.CACHE_TTL_MS && this._symbolCache.length > 0) {
            return;
        }
        this._symbolCache = await client.getSymbols();
        this._cacheTimestamp = now;
    }

    invalidate(): void {
        this._cacheTimestamp = 0;
    }
}
