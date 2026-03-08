import * as vscode from 'vscode';
import { CsSymbol } from '../analyzer/types';

export class CScoutHoverHandler implements vscode.HoverProvider {
    private _cache: CsSymbol[] = [];

    updateCache(symbols: CsSymbol[]): void {
        this._cache = symbols;
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) { return undefined; }

        const word = document.getText(wordRange);
        if (!word || word.length < 2) { return undefined; }

        // Look up by exact name in the symbol cache
        const sym = this._cache.find(s => s.name === word);
        if (!sym) { return undefined; }

        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        md.appendMarkdown(`### CScout: \`${sym.name}\`\n\n`);
        md.appendMarkdown(`**Kind:** ${sym.kind}\n\n`);

        if (sym.unused) {
            md.appendMarkdown(`> ⚠️  **Unused** — this symbol has no uses across the entire project\n\n`);
        } else {
            md.appendMarkdown(`> ✅ Active symbol\n\n`);
        }

        md.appendMarkdown(`---\n*Powered by CScout whole-program analysis*`);

        return new vscode.Hover(md, wordRange);
    }
}
