import * as http from 'http';
import * as net from 'net';
import * as vscode from 'vscode';

export interface PagedResponse<T> {
    total: number;
    items: T[];
}

export interface CScoutServerConfig {
    host: string;
    port: number;
    pageSize: number;
    maxIdentifiers: number;
    maxFiles: number;
    maxFunctions: number;
}

export class CScoutServer {
    private config: CScoutServerConfig;
    private connected = false;
    private useRawTcp = true;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): CScoutServerConfig {
        const cfg = vscode.workspace.getConfiguration('cscoutLens');
        return {
            host: cfg.get<string>('host') ?? 'localhost',
            port: cfg.get<number>('port') ?? 8081,
            pageSize: cfg.get<number>('initialLoadPageSize') ?? 500,
            maxIdentifiers: cfg.get<number>('initialLoadMaxIdentifiers') ?? 5000,
            maxFiles: cfg.get<number>('initialLoadMaxFiles') ?? 3000,
            maxFunctions: cfg.get<number>('initialLoadMaxFunctions') ?? 4000,
        };
    }

    async isReachable(): Promise<boolean> {
        try {
            const response = await this.fetch('/');
            this.connected = response.includes('CScout') || response.includes('html');
            return this.connected;
        } catch {
            this.connected = false;
            return false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    async fetch(urlPath: string): Promise<string> {
        const { host, port } = this.config;

        if (this.useRawTcp) {
            return this.fetchRawTcp(host, port, urlPath);
        }

        return new Promise((resolve, reject) => {
            const req = http.get({ hostname: host, port, path: urlPath, timeout: 12000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
    }

    private fetchRawTcp(host: string, port: number, urlPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let data = '';
            let resolved = false;

            socket.setTimeout(12000);
            socket.connect(port, host, () => {
                socket.write(`GET ${urlPath} HTTP/1.0\r\nHost: ${host}:${port}\r\nConnection: close\r\n\r\n`);
            });

            socket.on('data', chunk => { data += chunk.toString(); });
            socket.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    const idx = data.indexOf('\r\n\r\n');
                    resolve(idx >= 0 ? data.slice(idx + 4) : data);
                }
            });
            socket.on('error', err => { if (!resolved) { resolved = true; reject(err); } });
            socket.on('timeout', () => { socket.destroy(); if (!resolved) { resolved = true; reject(new Error('Timeout')); } });
        });
    }

    async fetchJson<T>(urlPath: string): Promise<T> {
        const raw = await this.fetch(urlPath);
        return JSON.parse(raw);
    }

    async getProjects(): Promise<any[]> {
        return this.fetchJson('/api/projects');
    }

    async getFiles(writable = false, limit?: number, offset?: number): Promise<PagedResponse<any>> {
        let url = '/api/files';
        const params: string[] = [];
        if (writable) params.push('writable=true');
        if (limit !== undefined) params.push(`limit=${limit}`);
        if (offset !== undefined) params.push(`offset=${offset}`);
        if (params.length) url += '?' + params.join('&');
        return this.fetchJson(url);
    }

    async getIdentifiers(options: { unused?: boolean; writable?: boolean; limit?: number; offset?: number } = {}): Promise<PagedResponse<any>> {
        let url = '/api/identifiers';
        const params: string[] = [];
        if (options.unused) params.push('unused=true');
        if (options.writable) params.push('writable=true');
        if (options.limit !== undefined) params.push(`limit=${options.limit}`);
        if (options.offset !== undefined) params.push(`offset=${options.offset}`);
        if (params.length) url += '?' + params.join('&');
        return this.fetchJson(url);
    }

    async getIdentifier(eid: number): Promise<any> {
        return this.fetchJson(`/api/identifier?eid=${eid}`);
    }

    async getFunctions(defined = false, limit?: number, offset?: number): Promise<PagedResponse<any>> {
        let url = '/api/functions';
        const params: string[] = [];
        if (defined) params.push('defined=true');
        if (limit !== undefined) params.push(`limit=${limit}`);
        if (offset !== undefined) params.push(`offset=${offset}`);
        if (params.length) url += '?' + params.join('&');
        return this.fetchJson(url);
    }

    async getFunction(id: number): Promise<any> {
        return this.fetchJson(`/api/function?id=${id}`);
    }

    async getFunctionCallers(id: number): Promise<any[]> {
        return this.fetchJson(`/api/function_callers?id=${id}`);
    }

    async getFunctionCallees(id: number): Promise<any[]> {
        return this.fetchJson(`/api/function_callees?id=${id}`);
    }

    async getFileMetrics(fid: number): Promise<any> {
        return this.fetchJson(`/api/filemetrics?fid=${fid}`);
    }

    async getProjectFiles(pid: number): Promise<any[]> {
        return this.fetchJson(`/api/project_files?pid=${pid}`);
    }
}

export const cscoutServer = new CScoutServer();
