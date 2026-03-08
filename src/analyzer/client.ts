import * as net from 'net';
import * as path from 'path';
import { CsSymbol, CsFile, CsFunction, CsMetric, CsLocation, CsProjectEntry } from './types';

function extractLinks(html: string, hrefPattern: RegExp): Array<{ href: string; text: string }> {
    const results: Array<{ href: string; text: string }> = [];
    const tag = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = tag.exec(html)) !== null) {
        if (hrefPattern.test(m[1])) {
            results.push({ href: m[1], text: m[2].trim() });
        }
    }
    return results;
}

function tableRows(html: string): string[][] {
    const rows: string[][] = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let rowM: RegExpExecArray | null;
    while ((rowM = rowRe.exec(html)) !== null) {
        const cells: string[] = [];
        let cellM: RegExpExecArray | null;
        while ((cellM = cellRe.exec(rowM[1])) !== null) {
            cells.push(cellM[1].replace(/<[^>]+>/g, '').trim());
        }
        if (cells.length > 0) { rows.push(cells); }
    }
    return rows;
}

function qparam(href: string, key: string): string | undefined {
    const m = new RegExp(`[?&]${key}=([^&]+)`).exec(href);
    return m ? decodeURIComponent(m[1]) : undefined;
}

function toWinPath(p: string): string {
    let result = p;
    const cyg = /^\/cygdrive\/([a-zA-Z])(\/.*)?$/.exec(p);
    if (cyg) {
        const drive = cyg[1].toUpperCase();
        const rest  = (cyg[2] ?? '').replace(/\//g, '\\');
        result = `${drive}:${rest}`;
    }
    return path.normalize(result);
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

    async getProjects(): Promise<CsProjectEntry[]> {
        const html = await this.fetch('/sproject.html');
        const links = extractLinks(html, /setproj\.html/);
        const seen = new Set<number>();
        const projects: CsProjectEntry[] = [];
        for (const lnk of links) {
            const pidStr = qparam(lnk.href, 'projid');
            if (!pidStr) { continue; }
            const pid = parseInt(pidStr, 10);
            if (pid === 0) { continue; }
            if (!seen.has(pid)) {
                seen.add(pid);
                projects.push({ pid, name: lnk.text });
            }
        }
        return projects;
    }

    async getProjectFiles(pid: number): Promise<CsFile[]> {
        await this.fetch(`/setproj.html?projid=${pid}`);
        const html = await this.fetch('/xfilequery.html?ro=1&writable=1&match=Y&skip=-1');
        return this._parseFileList(html);
    }

    private _parseFileList(html: string): CsFile[] {
        const results: CsFile[] = [];
        const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowM: RegExpExecArray | null;
        while ((rowM = rowRe.exec(html)) !== null) {
            const row = rowM[1];
            const fidLink = /file\.html\?id=(\d+)">([^<]+)<\/a>/i.exec(row);
            if (!fidLink) { continue; }
            const fid = parseInt(fidLink[1], 10);
            const fileName = fidLink[2].trim();
            const dirM = /<td[^>]*>\s*([^<]+?)\s*<\/td>/i.exec(row);
            const dir = dirM ? dirM[1].trim() : '';
            results.push({ fid, path: toWinPath(dir + fileName), writable: true });
        }
        return results;
    }

    // iquery.html attribute flags: a10=tag, a11=member, a14=macro, a19=typedef, a22=function
    private static readonly KIND_ATTRS: Array<{ kind: CsSymbol['kind']; attr: string }> = [
        { kind: 'function', attr: 'a22=1' },
        { kind: 'macro',    attr: 'a14=1' },
        { kind: 'typedef',  attr: 'a19=1' },
        { kind: 'tag',      attr: 'a10=1' },
        { kind: 'member',   attr: 'a11=1' },
    ];

    async getSymbols(unusedOnly = false): Promise<CsSymbol[]> {
        const unusedFlag = unusedOnly ? '&unused=1' : '';
        const allHtml = await this.fetch(
            `/xiquery.html?writable=1&match=Y&qi=1&skip=-1${unusedFlag}`,
        );
        const allLinks = extractLinks(allHtml, /id\.html/);

        const kindMap = new Map<string, CsSymbol['kind']>();
        for (const { kind, attr } of CScoutAnalyzerClient.KIND_ATTRS) {
            try {
                const html = await this.fetch(
                    `/xiquery.html?writable=1&match=L&qi=1&${attr}&skip=-1${unusedFlag}`,
                );
                for (const lnk of extractLinks(html, /id\.html/)) {
                    const eid = qparam(lnk.href, 'id') ?? lnk.href;
                    if (!kindMap.has(eid)) { kindMap.set(eid, kind); }
                }
            } catch { /* fall back to 'variable' */ }
        }

        return allLinks.map(lnk => {
            const eid = qparam(lnk.href, 'id') ?? lnk.href;
            return { eid, name: lnk.text, kind: kindMap.get(eid) ?? 'variable', unused: unusedOnly };
        });
    }

    async getSymbolLocations(eid: string): Promise<CsLocation[]> {
        const fileListHtml = await this.fetch(
            `/xiquery.html?ec=${encodeURIComponent(eid)}&qf=1&skip=-1`,
        );

        const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const dirRe = /<td[^>]*>\s*([^<]+?)\s*<\/td>/i;
        const fidRe = /file\.html\?id=(\d+)/i;
        const nameFromLinkRe = /file\.html\?id=\d+">([^<]+)<\/a>/i;
        const files: Array<{ fid: number; fullPath: string }> = [];
        let rowM: RegExpExecArray | null;
        while ((rowM = rowRe.exec(fileListHtml)) !== null) {
            const row = rowM[1];
            const dirM = dirRe.exec(row);
            const fidM = fidRe.exec(row);
            const nameM = nameFromLinkRe.exec(row);
            if (dirM && fidM && nameM) {
                files.push({
                    fid: parseInt(fidM[1], 10),
                    fullPath: toWinPath(dirM[1].trim() + nameM[1].trim()),
                });
            }
        }

        if (files.length === 0) { return []; }

        const locations: CsLocation[] = [];
        for (const file of files.slice(0, 5)) {
            try {
                const srcHtml = await this.fetch(
                    `/qsrc.html?id=${file.fid}&qt=id&ec=${encodeURIComponent(eid)}`,
                );
                const tokenRe = /<a\s+(?:name="(\d+)"|href="id\.html\?id=([^"]+)")/gi;
                let currentLine = 1;
                let tm: RegExpExecArray | null;
                while ((tm = tokenRe.exec(srcHtml)) !== null) {
                    if (tm[1]) {
                        currentLine = parseInt(tm[1], 10);
                    } else if (tm[2] === eid) {
                        locations.push({ filePath: file.fullPath, line: currentLine, column: 0 });
                    }
                }
            } catch { /* skip file on error */ }
        }

        return locations;
    }

    // ── file metrics ───────────────────────────────────────────────────────

    async getFileMetrics(fid: number): Promise<CsMetric[]> {
        const html = await this.fetch(`/file.html?id=${fid}`);
        const tableM = /<table[^>]*class=['"]metrics['"][^>]*>([\s\S]*?)<\/table>/i.exec(html);
        if (!tableM) { return []; }
        const rows = tableRows(tableM[1]);
        const metrics: CsMetric[] = [];
        for (const row of rows) {
            if (row.length < 2) { continue; }
            const label = row[0];
            // Table has 3 cols: Metric | Pre-cpp | Post-cpp
            // Many rows have &mdash; in Post-cpp — fall back to Pre-cpp value
            const postCpp = parseFloat(row[2] ?? '');
            const preCpp  = parseFloat(row[1] ?? '');
            const val = !isNaN(postCpp) ? postCpp : !isNaN(preCpp) ? preCpp : NaN;
            if (label && !isNaN(val)) {
                metrics.push({ label, value: val });
            }
        }
        return metrics;
    }

    // ── functions ──────────────────────────────────────────────────────────

    async getFunctions(definedOnly = false): Promise<CsFunction[]> {
        // writable=1&match=Y&qi=1 matches the pattern CScout uses for defined functions
        const qs = definedOnly ? '&defined=1' : '';
        const html = await this.fetch(`/xfunquery.html?writable=1&match=Y&qi=1&skip=-1${qs}`);
        return this._parseFunctionList(html);
    }

    async getCallers(fid: string): Promise<CsFunction[]> {
        const html = await this.fetch(`/funlist.html?f=${encodeURIComponent(fid)}&n=u`);
        return this._parseFunctionList(html);
    }

    async getCallees(fid: string): Promise<CsFunction[]> {
        const html = await this.fetch(`/funlist.html?f=${encodeURIComponent(fid)}&n=d`);
        return this._parseFunctionList(html);
    }

    private _parseFunctionList(html: string): CsFunction[] {
        const links = extractLinks(html, /fun\.html/);
        const seen = new Set<string>();
        const fns: CsFunction[] = [];
        for (const lnk of links) {
            const name = lnk.text;
            if (seen.has(name)) { continue; }
            seen.add(name);
            fns.push({
                fid: qparam(lnk.href, 'f') ?? lnk.href,
                name,
                isStatic: /\bstatic\b/i.test(lnk.href),
            });
        }
        return fns;
    }

    fetch(path: string): Promise<string> {
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
                    `GET ${path} HTTP/1.0\r\n` +
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
                    reject(new Error(`Empty response from ${path}`));
                    return;
                }
                const statusLine = raw.substring(0, firstNewline).trim();
                const statusMatch = /HTTP\/\S+\s+(\d+)/.exec(statusLine);
                const code = statusMatch ? parseInt(statusMatch[1], 10) : 0;
                if (code < 200 || code >= 300) {
                    reject(new Error(`HTTP ${code} for ${path}: ${statusLine}`));
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

            socket.on('timeout', () => fail(new Error(`Timeout fetching ${path}`)));
            socket.on('error',   (err) => fail(err));
        });
    }
}
