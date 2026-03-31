/**
 * Mock CScout Server - For development and testing
 * Uses in-memory data structures instead of SQLite (per mentor's recommendation)
 * 
 * This provides the same REST API endpoints as the real CScout server,
 * allowing extension development without running the full CScout analyzer.
 */

import * as http from 'http';
import * as url from 'url';
import * as path from 'path';

const PORT = 8081;

// Get absolute paths to sample files (cross-platform)
const EXTENSION_ROOT = path.resolve(__dirname, '..', '..');
const SAMPLE_DIR = path.join(EXTENSION_ROOT, 'sample', 'calc');

// ─── In-Memory Sample Data ─────────────────────────────────────────────────────

interface MockProject {
    pid: number;
    name: string;
}

interface MockFile {
    fid: number;
    name: string;
    path: string;
    dir: string;
    readonly: boolean;
    projectIds: number[];
}

interface MockIdentifier {
    eid: string;
    name: string;
    readonly: boolean;
    unused: boolean;
    macro: boolean;
    typedef: boolean;
    function: boolean;
    tag: boolean;
    member: boolean;
    cscope: boolean;
    lscope: boolean;
    xfile: boolean;
    size: number;
    locations: Array<{ fid: number; line: number; col: number }>;
}

interface MockFunction {
    fid: string;
    name: string;
    is_static: boolean;
    is_defined: boolean;
    is_macro: boolean;
    ncallers: number;
    ncallees: number;
    file_id: number;
    line: number;
}

interface MockCallGraph {
    callers: Map<string, string[]>;  // fid -> caller fids
    callees: Map<string, string[]>;  // fid -> callee fids
}

// Sample data mimicking a calculator project
const PROJECTS: MockProject[] = [
    { pid: 1, name: 'calculator' }
];

const FILES: MockFile[] = [
    { fid: 1, name: 'main.c', path: path.join(SAMPLE_DIR, 'main.c'), dir: SAMPLE_DIR, readonly: false, projectIds: [1] },
    { fid: 2, name: 'calc.c', path: path.join(SAMPLE_DIR, 'calc.c'), dir: SAMPLE_DIR, readonly: false, projectIds: [1] },
    { fid: 3, name: 'calc.h', path: path.join(SAMPLE_DIR, 'calc.h'), dir: SAMPLE_DIR, readonly: false, projectIds: [1] },
    { fid: 4, name: 'utils.c', path: path.join(SAMPLE_DIR, 'utils.c'), dir: SAMPLE_DIR, readonly: false, projectIds: [1] },
    { fid: 5, name: 'utils.h', path: path.join(SAMPLE_DIR, 'utils.h'), dir: SAMPLE_DIR, readonly: false, projectIds: [1] },
    { fid: 6, name: 'stdio.h', path: '/usr/include/stdio.h', dir: '/usr/include/', readonly: true, projectIds: [1] },
    { fid: 7, name: 'stdlib.h', path: '/usr/include/stdlib.h', dir: '/usr/include/', readonly: true, projectIds: [1] },
];

const IDENTIFIERS: MockIdentifier[] = [
    // Functions
    { eid: 'f1', name: 'main', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 2, locations: [{ fid: 1, line: 6, col: 5 }] },
    { eid: 'f2', name: 'calc_add', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 3, locations: [{ fid: 2, line: 3, col: 5 }, { fid: 3, line: 17, col: 5 }, { fid: 1, line: 12, col: 14 }] },
    { eid: 'f3', name: 'calc_sub', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 3, locations: [{ fid: 2, line: 7, col: 5 }, { fid: 3, line: 18, col: 5 }, { fid: 1, line: 15, col: 14 }] },
    { eid: 'f4', name: 'calc_mul', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 3, locations: [{ fid: 2, line: 11, col: 5 }, { fid: 3, line: 19, col: 5 }, { fid: 1, line: 18, col: 14 }] },
    { eid: 'f5', name: 'calc_div', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 3, locations: [{ fid: 2, line: 15, col: 5 }, { fid: 3, line: 20, col: 5 }, { fid: 1, line: 21, col: 14 }] },
    { eid: 'f6', name: 'print_result', readonly: false, unused: false, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 5, locations: [{ fid: 4, line: 3, col: 6 }, { fid: 5, line: 3, col: 6 }, { fid: 1, line: 13, col: 5 }, { fid: 1, line: 16, col: 5 }, { fid: 1, line: 19, col: 5 }] },
    { eid: 'f7', name: 'parse_input', readonly: false, unused: true, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 2, locations: [{ fid: 4, line: 8, col: 5 }, { fid: 5, line: 4, col: 5 }] },
    { eid: 'f8', name: 'format_output', readonly: false, unused: true, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 2, locations: [{ fid: 4, line: 12, col: 7 }, { fid: 5, line: 5, col: 8 }] },
    { eid: 'f9', name: 'debug_log', readonly: false, unused: true, macro: false, typedef: false, function: true, tag: false, member: false, cscope: false, lscope: true, xfile: false, size: 2, locations: [{ fid: 4, line: 17, col: 13 }, { fid: 5, line: 6, col: 6 }] },
    // Variables
    { eid: 'v1', name: 'result', readonly: false, unused: false, macro: false, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: true, xfile: false, size: 4, locations: [{ fid: 1, line: 7, col: 9 }, { fid: 1, line: 12, col: 5 }, { fid: 1, line: 15, col: 5 }, { fid: 1, line: 18, col: 5 }] },
    { eid: 'v2', name: 'argc', readonly: true, unused: true, macro: false, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: true, xfile: false, size: 1, locations: [{ fid: 1, line: 6, col: 14 }] },
    { eid: 'v3', name: 'argv', readonly: true, unused: true, macro: false, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: true, xfile: false, size: 1, locations: [{ fid: 1, line: 6, col: 26 }] },
    // Macros
    { eid: 'm1', name: 'MAX_BUF', readonly: false, unused: true, macro: true, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 4, col: 9 }] },
    { eid: 'm2', name: 'EPSILON', readonly: false, unused: true, macro: true, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 5, col: 9 }] },
    { eid: 'm3', name: 'DEBUG_MODE', readonly: false, unused: true, macro: true, typedef: false, function: false, tag: false, member: false, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 6, col: 9 }] },
    // Typedefs and structs
    { eid: 't1', name: 'CalcResult', readonly: false, unused: true, macro: false, typedef: true, function: false, tag: true, member: false, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 12, col: 3 }] },
    { eid: 't2', name: 'calc_op_t', readonly: false, unused: true, macro: false, typedef: true, function: false, tag: true, member: false, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 15, col: 3 }] },
    // Struct members
    { eid: 's1', name: 'value', readonly: false, unused: true, macro: false, typedef: false, function: false, tag: false, member: true, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 9, col: 12 }] },
    { eid: 's2', name: 'error_code', readonly: false, unused: true, macro: false, typedef: false, function: false, tag: false, member: true, cscope: false, lscope: false, xfile: false, size: 1, locations: [{ fid: 3, line: 10, col: 9 }] },
];

const FUNCTIONS: MockFunction[] = [
    { fid: 'f1', name: 'main', is_static: false, is_defined: true, is_macro: false, ncallers: 0, ncallees: 5, file_id: 1, line: 6 },
    { fid: 'f2', name: 'calc_add', is_static: false, is_defined: true, is_macro: false, ncallers: 1, ncallees: 0, file_id: 2, line: 3 },
    { fid: 'f3', name: 'calc_sub', is_static: false, is_defined: true, is_macro: false, ncallers: 1, ncallees: 0, file_id: 2, line: 7 },
    { fid: 'f4', name: 'calc_mul', is_static: false, is_defined: true, is_macro: false, ncallers: 1, ncallees: 0, file_id: 2, line: 11 },
    { fid: 'f5', name: 'calc_div', is_static: false, is_defined: true, is_macro: false, ncallers: 1, ncallees: 0, file_id: 2, line: 15 },
    { fid: 'f6', name: 'print_result', is_static: false, is_defined: true, is_macro: false, ncallers: 4, ncallees: 1, file_id: 4, line: 3 },
    { fid: 'f7', name: 'parse_input', is_static: false, is_defined: true, is_macro: false, ncallers: 0, ncallees: 0, file_id: 4, line: 8 },
    { fid: 'f8', name: 'format_output', is_static: false, is_defined: true, is_macro: false, ncallers: 0, ncallees: 0, file_id: 4, line: 12 },
    { fid: 'f9', name: 'debug_log', is_static: true, is_defined: true, is_macro: false, ncallers: 0, ncallees: 0, file_id: 4, line: 17 },
    { fid: 'printf', name: 'printf', is_static: false, is_defined: false, is_macro: false, ncallers: 2, ncallees: 0, file_id: 6, line: 1 },
];

// Call graph: main calls calc_add, calc_sub, calc_mul, calc_div, print_result
// print_result calls printf
const CALL_GRAPH: MockCallGraph = {
    callers: new Map([
        ['f2', ['f1']],      // calc_add called by main
        ['f3', ['f1']],      // calc_sub called by main
        ['f4', ['f1']],      // calc_mul called by main
        ['f5', ['f1']],      // calc_div called by main
        ['f6', ['f1']],      // print_result called by main
        ['printf', ['f6']],  // printf called by print_result
    ]),
    callees: new Map([
        ['f1', ['f2', 'f3', 'f4', 'f5', 'f6']],  // main calls these
        ['f6', ['printf']],                       // print_result calls printf
    ]),
};

const FILE_METRICS: Map<number, Record<string, number>> = new Map([
    [1, { nstmt: 15, nfun: 1, ncpp: 2, nif: 0, nloop: 0, ngoto: 0, ncase: 0, ncomment: 3 }],
    [2, { nstmt: 12, nfun: 4, ncpp: 1, nif: 1, nloop: 0, ngoto: 0, ncase: 0, ncomment: 0 }],
    [3, { nstmt: 0, nfun: 0, ncpp: 8, nif: 0, nloop: 0, ngoto: 0, ncase: 4, ncomment: 1 }],
    [4, { nstmt: 10, nfun: 4, ncpp: 1, nif: 0, nloop: 0, ngoto: 0, ncase: 0, ncomment: 2 }],
    [5, { nstmt: 0, nfun: 0, ncpp: 4, nif: 0, nloop: 0, ngoto: 0, ncase: 0, ncomment: 1 }],
]);

// ─── HTTP Server ───────────────────────────────────────────────────────────────

function json(res: http.ServerResponse, data: unknown, status = 200): void {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data, null, 2));
}

function html(res: http.ServerResponse, content: string): void {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    const query = parsedUrl.query;
    const start = Date.now();

    res.on('finish', () => {
        console.log(`${res.statusCode} ${req.method} ${req.url} (${Date.now() - start}ms)`);
    });

    try {
        // ─── Project Endpoints ─────────────────────────────────────────────
        
        if (pathname === '/api/projects') {
            json(res, PROJECTS);
            return;
        }

        if (pathname === '/api/setproj') {
            // Just acknowledge - we only have one project
            json(res, { ok: true });
            return;
        }

        // ─── File Endpoints ────────────────────────────────────────────────

        if (pathname === '/api/files') {
            let result = [...FILES];
            if (query.writable === '1') {
                result = result.filter(f => !f.readonly);
            }
            if (query.ro === '0') {
                result = result.filter(f => !f.readonly);
            }
            json(res, result.map(f => ({
                fid: f.fid,
                name: f.name,
                dir: f.dir,
                path: f.path,
                readonly: f.readonly,
            })));
            return;
        }

        if (pathname === '/api/filemetrics') {
            const id = parseInt(String(query.id || query.fid), 10);
            if (isNaN(id)) {
                json(res, { error: 'missing id parameter' }, 400);
                return;
            }
            const file = FILES.find(f => f.fid === id);
            const metrics = FILE_METRICS.get(id);
            if (!file || !metrics) {
                json(res, { error: 'file not found' }, 404);
                return;
            }
            json(res, {
                fid: id,
                path: file.path,
                readonly: file.readonly,
                metrics: Object.entries(metrics).map(([name, value]) => ({
                    name,
                    pre_cpp: value,
                    post_cpp: value,
                })),
            });
            return;
        }

        // ─── Identifier Endpoints ──────────────────────────────────────────

        if (pathname === '/api/identifiers') {
            let result = [...IDENTIFIERS];
            if (query.writable === '1') {
                result = result.filter(id => !id.readonly);
            }
            if (query.unused === '1') {
                result = result.filter(id => id.unused);
            }
            json(res, result.map(id => ({
                eid: id.eid,
                name: id.name,
                size: id.size,
                readonly: id.readonly,
                tag: id.tag,
                member: id.member,
                macro: id.macro,
                typedef: id.typedef,
                function: id.function,
                cscope: id.cscope,
                lscope: id.lscope,
                unused: id.unused,
                xfile: id.xfile,
            })));
            return;
        }

        if (pathname === '/api/source') {
            const fid = parseInt(String(query.id), 10);
            const ec = String(query.ec || '');
            if (isNaN(fid)) {
                json(res, { error: 'missing id parameter' }, 400);
                return;
            }
            const file = FILES.find(f => f.fid === fid);
            if (!file) {
                json(res, { error: 'file not found' }, 404);
                return;
            }
            // Find identifier and its locations in this file
            const identifier = IDENTIFIERS.find(id => id.eid === ec);
            const matches = identifier
                ? identifier.locations.filter(loc => loc.fid === fid).map(loc => ({ line: loc.line, col: loc.col }))
                : [];
            json(res, {
                fid,
                path: file.path,
                matches,
            });
            return;
        }

        // ─── Function Endpoints ────────────────────────────────────────────

        if (pathname === '/api/functions') {
            let result = [...FUNCTIONS];
            if (query.writable === '1') {
                result = result.filter(f => {
                    const file = FILES.find(fi => fi.fid === f.file_id);
                    return file && !file.readonly;
                });
            }
            if (query.defined === '1') {
                result = result.filter(f => f.is_defined);
            }
            json(res, result.map(f => {
                const file = FILES.find(fi => fi.fid === f.file_id);
                return {
                    fid: f.fid,
                    name: f.name,
                    is_static: f.is_static,
                    is_defined: f.is_defined,
                    is_macro: f.is_macro,
                    ncallers: f.ncallers,
                    ncallees: f.ncallees,
                    file: file?.path,
                    line: f.line,
                    file_id: f.file_id,
                };
            }));
            return;
        }

        if (pathname === '/api/funlist') {
            const f = String(query.f || '');
            const n = String(query.n || '');
            
            if (!f) {
                json(res, { error: 'missing f parameter' }, 400);
                return;
            }
            
            let fids: string[] = [];
            if (n === 'u') {
                // Callers (upstream)
                fids = CALL_GRAPH.callers.get(f) || [];
            } else if (n === 'd') {
                // Callees (downstream)
                fids = CALL_GRAPH.callees.get(f) || [];
            }
            
            const result = fids
                .map(fid => FUNCTIONS.find(fn => fn.fid === fid))
                .filter((fn): fn is MockFunction => fn !== undefined)
                .map(fn => ({
                    fid: fn.fid,
                    name: fn.name,
                    is_static: fn.is_static,
                    is_macro: fn.is_macro,
                }));
            
            json(res, result);
            return;
        }

        // ─── HTML Endpoints (for compatibility) ────────────────────────────

        if (pathname === '/xiquery.html') {
            const ec = String(query.ec || '');
            const identifier = IDENTIFIERS.find(id => id.eid === ec);
            
            if (!identifier) {
                html(res, '<html><body><p>Identifier not found</p></body></html>');
                return;
            }
            
            // Build HTML table like real CScout
            let rows = '';
            const seenFiles = new Set<number>();
            for (const loc of identifier.locations) {
                if (seenFiles.has(loc.fid)) continue;
                seenFiles.add(loc.fid);
                const file = FILES.find(f => f.fid === loc.fid);
                if (file) {
                    rows += `<tr><td>${file.dir}</td><td><a href="file.html?id=${file.fid}">${file.name}</a></td></tr>\n`;
                }
            }
            
            html(res, `<html><body>
<h2>Files containing identifier: ${identifier.name}</h2>
<table border="1">
<tr><th>Directory</th><th>File</th></tr>
${rows}
</table>
</body></html>`);
            return;
        }

        if (pathname === '/' || pathname === '/index.html') {
            html(res, `<!DOCTYPE html>
<html>
<head><title>CScout Mock Server</title></head>
<body>
<h1>CScout Mock Server</h1>
<p>This is a development mock server for the CScout Lens VS Code extension.</p>
<h2>REST API Endpoints</h2>
<ul>
  <li><a href="/api/projects">/api/projects</a> - List projects</li>
  <li><a href="/api/files">/api/files</a> - List files</li>
  <li><a href="/api/identifiers">/api/identifiers</a> - List identifiers</li>
  <li><a href="/api/functions">/api/functions</a> - List functions</li>
  <li>/api/filemetrics?id=N - Get file metrics</li>
  <li>/api/source?id=N&ec=EID - Get source matches</li>
  <li>/api/funlist?f=FID&n=u|d - Get callers/callees</li>
</ul>
<h2>Sample Data</h2>
<p>This server provides mock data for a simple calculator project:</p>
<ul>
  <li>${PROJECTS.length} project(s)</li>
  <li>${FILES.length} file(s)</li>
  <li>${IDENTIFIERS.length} identifier(s)</li>
  <li>${FUNCTIONS.length} function(s)</li>
</ul>
</body>
</html>`);
            return;
        }

        // 404 for unknown paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error handling ${pathname}:`, message);
        json(res, { error: message }, 500);
    }
});

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('        CScout Mock Server (REST API - No SQLite)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Listening on http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET /api/projects           - List all projects');
    console.log('  GET /api/files              - List all files');
    console.log('  GET /api/identifiers        - List all identifiers');
    console.log('  GET /api/functions          - List all functions');
    console.log('  GET /api/filemetrics?id=N   - Get file metrics');
    console.log('  GET /api/funlist?f=FID&n=u  - Get callers');
    console.log('  GET /api/funlist?f=FID&n=d  - Get callees');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('═══════════════════════════════════════════════════════════');
});
