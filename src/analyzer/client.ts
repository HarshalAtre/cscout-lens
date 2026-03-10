import * as net from 'net';
import * as path from 'path';
import { CsSymbol, CsFile, CsFunction, CsMetric, CsLocation, CsProjectEntry } from './types';

function toWinPath(p: string): string {
    let result = p;
    const cyg = /^\/cygdrive\/([a-zA-Z])(\/.*)?$/.exec(p);
    if (cyg) {
        const drive = cyg[1].toUpperCase();
        const rest = (cyg[2] ?? '').replace(/\//g, '\\');
        result = `${drive}:${rest}`;
    }
    return path.normalize(result);
}

// ── JSON response interfaces (mirror the CScout /api/ shapes) ────────────────

interface ApiProject { pid: number; name: string }
interface ApiFile { fid: number; name: string; dir: string; path: string; readonly: boolean }
interface ApiIdentifier {
    eid: string; name: string; size: number;
    readonly: boolean; tag: boolean; member: boolean;
    macro: boolean; typedef: boolean; function: boolean;
    cscope: boolean; lscope: boolean; unused: boolean; xfile: boolean;
}
interface ApiFunction {
    fid: string; name: string; is_static: boolean;
    is_defined: boolean; is_macro: boolean;
    ncallers: number; ncallees: number;
    file?: string; line?: number; file_id?: number;
}
interface ApiFunlistEntry {
    fid: string; name: string; is_static: boolean; is_macro: boolean;
}
interface ApiFileMetrics {
    fid: number; path: string; readonly: boolean;
    metrics: Array<{ name: string; pre_cpp?: number; post_cpp?: number }>;
}
interface ApiSourceMatch { line: number; col: number }
interface ApiSourceResult { fid: number; path: string; matches: ApiSourceMatch[] }
interface ApiIdDetail {
    eid: string; name: string; size: number;
    readonly: boolean; unused: boolean; xfile: boolean;
    attributes: Record<string, boolean>;
    projects: string[];
}

export class CScoutAnalyzerClient {
    private readonly _base: string;

    constructor(host: string, port: number) {
        this._base = `http://${host}:${port}`;
    }

    baseUrl(): string { return this._base; }

    async isReachable(): Promise<boolean> {
        try {
            const body = await this.fetch('/index.html');
            return body.includes('CScout');
        } catch {
            return false;
        }
    }

    // ── Projects ──────────────────────────────────────────────────────────

    async getProjects(): Promise<CsProjectEntry[]> {
        const body = await this.fetch('/api/projects');
        const data: ApiProject[] = JSON.parse(body);
        return data.map(p => ({ pid: p.pid, name: p.name }));
    }

    async getProjectFiles(pid: number): Promise<CsFile[]> {
        // Set project scope first, then query files
        await this.fetch(`/api/setproj?projid=${pid}`);
        const body = await this.fetch('/api/files?ro=1&writable=1&match=Y&skip=-1');
        const data: ApiFile[] = JSON.parse(body);
        return data.map(f => ({
            fid: f.fid,
            path: toWinPath(f.path),
            writable: !f.readonly,
        }));
    }

    // ── Symbols / Identifiers ─────────────────────────────────────────────

    private static readonly KIND_ATTRS: Array<{ kind: CsSymbol['kind']; jsonKey: string }> = [
        { kind: 'function', jsonKey: 'function' },
        { kind: 'macro', jsonKey: 'macro' },
        { kind: 'typedef', jsonKey: 'typedef' },
        { kind: 'tag', jsonKey: 'tag' },
        { kind: 'member', jsonKey: 'member' },
    ];

    async getSymbols(unusedOnly = false): Promise<CsSymbol[]> {
        const unusedFlag = unusedOnly ? '&unused=1' : '';
        const body = await this.fetch(
            `/api/identifiers?writable=1&match=Y&qi=1&skip=-1${unusedFlag}`,
        );
        const data: ApiIdentifier[] = JSON.parse(body);
        return data.map(id => {
            let kind: CsSymbol['kind'] = 'variable';
            for (const { kind: k, jsonKey } of CScoutAnalyzerClient.KIND_ATTRS) {
                if ((id as unknown as Record<string, unknown>)[jsonKey]) {
                    kind = k;
                    break;
                }
            }
            return { eid: id.eid, name: id.name, kind, unused: id.unused };
        });
    }

    async getSymbolLocations(eid: string): Promise<CsLocation[]> {
        // Step 1: find which files contain this identifier via html endpoint
        // (it accepts the pointer-string eid directly)
        const htmlBody = await this.fetch(
            `/xiquery.html?ec=${encodeURIComponent(eid)}&qf=1&skip=-1`,
        );

        // Parse file IDs and paths from the HTML table rows
        const fileEntries: Array<{ fid: number; fullPath: string }> = [];
        const fidRe = /file\.html\?id=(\d+)/gi;
        const pathRe = /<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*><a\s[^>]*>([^<]+)<\/a>/gi;

        // Simpler: just scan for all file.html?id= links and paired path text
        const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowm: RegExpExecArray | null;
        while ((rowm = rowRe.exec(htmlBody)) !== null) {
            const row = rowm[1];
            const fm = /file\.html\?id=(\d+)/.exec(row);
            if (!fm) { continue; }
            const fid = parseInt(fm[1], 10);
            // Extract path from the row text (dir + filename)
            const cellRe = /<td[^>]*>\s*([^<\n]+?)\s*<\/td>/gi;
            const cells: string[] = [];
            let cm: RegExpExecArray | null;
            while ((cm = cellRe.exec(row)) !== null) {
                cells.push(cm[1].trim());
            }
            // Also extract linked filename text
            const linkText = /<a\s[^>]*>([^<]+)<\/a>/.exec(row);
            const fname = linkText ? linkText[1].trim() : '';
            // Compose path: first non-empty cell is dir, linked text is filename
            const dir = cells.find(c => c.length > 0 && !c.includes('<')) ?? '';
            const rawPath = fname ? (dir ? dir + fname : fname) : dir;
            if (rawPath) {
                fileEntries.push({ fid, fullPath: toWinPath(rawPath) });
            }
        }

        if (fileEntries.length === 0) { return []; }

        // Step 2: get exact line numbers from /api/source for each file
        const locations: CsLocation[] = [];
        for (const file of fileEntries.slice(0, 10)) {
            try {
                const srcBody = await this.fetch(
                    `/api/source?id=${file.fid}&ec=${encodeURIComponent(eid)}`,
                );
                const srcData: ApiSourceResult = JSON.parse(srcBody);
                const resolvedPath = toWinPath(srcData.path);
                for (const m of srcData.matches) {
                    locations.push({
                        filePath: resolvedPath,
                        line: m.line,
                        column: m.col,
                    });
                }
                // If api/source returned no matches but file was listed,
                // at least show the file at line 1
                if (srcData.matches.length === 0 && resolvedPath) {
                    locations.push({ filePath: resolvedPath, line: 1, column: 0 });
                }
            } catch {
                // Fall back to file at line 1
                if (file.fullPath) {
                    locations.push({ filePath: file.fullPath, line: 1, column: 0 });
                }
            }
        }

        return locations;
    }

    // ── File metrics ───────────────────────────────────────────────────────

    async getFileMetrics(fid: number): Promise<CsMetric[]> {
        const body = await this.fetch(`/api/filemetrics?id=${fid}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = JSON.parse(body);
        if (!data || !Array.isArray(data.metrics)) {
            throw new Error(`Unexpected response from /api/filemetrics?id=${fid}: ${body.slice(0, 120)}`);
        }
        return (data.metrics as Array<{ name: string; pre_cpp?: number; post_cpp?: number }>)
            .map(m => ({
                label: m.name,
                // Prefer post_cpp, fall back to pre_cpp
                value: m.post_cpp !== undefined ? m.post_cpp
                    : m.pre_cpp !== undefined ? m.pre_cpp
                        : 0,
            }));
    }

    // ── Functions ──────────────────────────────────────────────────────────

    async getFunctions(definedOnly = false): Promise<CsFunction[]> {
        const qs = definedOnly ? '&defined=1' : '';
        const body = await this.fetch(
            `/api/functions?writable=1&match=Y&qi=1&skip=-1${qs}`,
        );
        const data: ApiFunction[] = JSON.parse(body);
        const seen = new Set<string>();
        return data.filter(f => {
            if (seen.has(f.name)) { return false; }
            seen.add(f.name);
            return true;
        }).map(f => ({
            fid: f.fid,
            name: f.name,
            isStatic: f.is_static,
        }));
    }

    async getCallers(fid: string): Promise<CsFunction[]> {
        const body = await this.fetch(
            `/api/funlist?f=${encodeURIComponent(fid)}&n=u`,
        );
        const data: ApiFunlistEntry[] = JSON.parse(body);
        // Server already filters self-references; extra client-side safety
        return data
            .filter(f => f.fid !== fid)
            .map(f => ({ fid: f.fid, name: f.name, isStatic: f.is_static }));
    }

    async getCallees(fid: string): Promise<CsFunction[]> {
        const body = await this.fetch(
            `/api/funlist?f=${encodeURIComponent(fid)}&n=d`,
        );
        const data: ApiFunlistEntry[] = JSON.parse(body);
        return data.map(f => ({
            fid: f.fid,
            name: f.name,
            isStatic: f.is_static,
        }));
    }

    // ── HTTP fetch (raw TCP for SWILL compatibility) ───────────────────────

    fetch(urlPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const withoutScheme = this._base.replace(/^https?:\/\//, '');
            const [host, portStr] = withoutScheme.split(':');
            const port = portStr ? parseInt(portStr, 10) : 80;

            const socket = net.createConnection({ host, port });
            let raw = '';
            let settled = false;

            const fail = (err: Error) => {
                if (settled) { return; }
                settled = true;
                socket.destroy();
                reject(err);
            };

            socket.setTimeout(12000);
            socket.setEncoding('utf-8');

            socket.on('connect', () => {
                socket.write(
                    `GET ${urlPath} HTTP/1.0\r\n` +
                    `Host: ${host}:${port}\r\n` +
                    `Connection: close\r\n` +
                    `\r\n`
                );
            });

            socket.on('data', (chunk: string) => { raw += chunk; });

            socket.on('end', () => {
                if (settled) { return; }
                settled = true;

                const firstNewline = raw.indexOf('\n');
                if (firstNewline === -1) {
                    reject(new Error(`Empty response from ${urlPath}`));
                    return;
                }
                const statusLine = raw.substring(0, firstNewline).trim();
                const statusMatch = /HTTP\/\S+\s+(\d+)/.exec(statusLine);
                const code = statusMatch ? parseInt(statusMatch[1], 10) : 0;
                if (code < 200 || code >= 300) {
                    reject(new Error(`HTTP ${code} for ${urlPath}: ${statusLine}`));
                    return;
                }

                let bodyStart = raw.indexOf('\r\n\r\n');
                if (bodyStart !== -1) {
                    bodyStart += 4;
                } else {
                    bodyStart = raw.indexOf('\n\n');
                    bodyStart = bodyStart !== -1 ? bodyStart + 2 : firstNewline + 1;
                }

                resolve(raw.substring(bodyStart));
            });

            socket.on('timeout', () => fail(new Error(`Timeout fetching ${urlPath}`)));
            socket.on('error', (err) => fail(err));
        });
    }
}
