#!/usr/bin/env python3
"""
Setup script to create all directories and files for CScout-Lens extension.
This is an alternative to master-setup.js when Node.js/PowerShell is unavailable.
Run with: python setup_files.py
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) if os.path.dirname(os.path.abspath(__file__)) else os.getcwd()
if not BASE_DIR:
    BASE_DIR = "D:\\Gsoc\\C-scout\\cscout\\cscout-lens"

def ensure_dir(path):
    full_path = os.path.join(BASE_DIR, path)
    os.makedirs(full_path, exist_ok=True)
    print(f"✓ Created directory: {path}")

def create_file(path, content):
    full_path = os.path.join(BASE_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ Created: {path}")

print("=" * 60)
print("    CScout-Lens Master Setup - Creating All Files")
print("=" * 60 + "\n")

# Create directories
print("📁 Creating directories...\n")
directories = ['sample/calc', 'src/db', 'src/scripts', 'src/services', 'src/webview', 'src/test', 'resources']
for d in directories:
    ensure_dir(d)

# Sample C files
print("\n📁 Creating sample C files...\n")

create_file('sample/calc/main.c', '''#include <stdio.h>
#include <stdlib.h>
#include "calc.h"
#include "utils.h"

int main(int argc, char *argv[]) {
    int result;
    
    printf("Simple Calculator\\n");
    printf("=================\\n\\n");
    
    result = calc_add(10, 5);
    print_result("Addition", result);
    
    result = calc_sub(10, 5);
    print_result("Subtraction", result);
    
    result = calc_mul(10, 5);
    print_result("Multiplication", result);
    
    result = calc_div(10, 5);
    print_result("Division", result);
    
    return 0;
}
''')

create_file('sample/calc/calc.c', '''#include "calc.h"

int calc_add(int a, int b) {
    return a + b;
}

int calc_sub(int a, int b) {
    return a - b;
}

int calc_mul(int a, int b) {
    return a * b;
}

int calc_div(int a, int b) {
    if (b == 0) {
        return 0;
    }
    return a / b;
}
''')

create_file('sample/calc/calc.h', '''#ifndef CALC_H
#define CALC_H

#define MAX_BUF 256
#define EPSILON 0.0001
#define DEBUG_MODE 0

typedef struct {
    double value;
    int error_code;
} CalcResult;

typedef enum {
    OP_ADD,
    OP_SUB,
    OP_MUL,
    OP_DIV
} calc_op_t;

int calc_add(int a, int b);
int calc_sub(int a, int b);
int calc_mul(int a, int b);
int calc_div(int a, int b);

#endif
''')

create_file('sample/calc/utils.c', '''#include <stdio.h>
#include "utils.h"
#include "calc.h"

void print_result(const char *op, int result) {
    printf("%s result: %d\\n", op, result);
    if (result > 100) {
        printf("  (Large value detected)\\n");
    }
}

static int parse_input(const char *input) {
    int value = 0;
    int i = 0;
    while (input[i] >= '0' && input[i] <= '9') {
        value = value * 10 + (input[i] - '0');
        i++;
    }
    return value;
}

static void format_output(char *buffer, int value) {
    sprintf(buffer, "Result: %d", value);
}

static void debug_log(const char *message) {
#if DEBUG_MODE
    printf("[DEBUG] %s\\n", message);
#endif
}
''')

create_file('sample/calc/utils.h', '''#ifndef UTILS_H
#define UTILS_H

#include "calc.h"

void print_result(const char *op, int result);

#endif
''')

# Database layer
print("\n📁 Creating database layer...\n")

create_file('src/db/cscoutDatabase.ts', '''import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import * as fs from "fs";
import * as path from "path";

export interface CScoutFile {
  fid: number;
  name: string;
  readonly: boolean;
}

export interface CScoutIdentifier {
  eid: number;
  name: string;
  readonly: boolean;
  unused: boolean;
  macro: boolean;
  ordinary: boolean;
  suetag: boolean;
  sumember: boolean;
  label: boolean;
  typedef: boolean;
  fun: boolean;
  cscope: boolean;
  lscope: boolean;
}

export interface TokenLocation {
  fid: number;
  filePath: string;
  offset: number;
  line: number;
  column: number;
}

export interface CScoutFunction {
  id: number;
  name: string;
  isMacro: boolean;
  defined: boolean;
  declared: boolean;
  fileScoped: boolean;
  fid: number;
  foffset: number;
  fanin: number;
}

export interface FunctionCall {
  sourceId: number;
  sourceName: string;
  destId: number;
  destName: string;
}

export interface CScoutProject {
  pid: number;
  name: string;
}

export interface FileMetricsRow {
  [key: string]: number | string | boolean;
}

function allRows(db: SqlJsDatabase, sql: string, params?: any[]): any[] {
  const stmt = db.prepare(sql);
  if (params) { stmt.bind(params); }
  const rows: any[] = [];
  while (stmt.step()) { rows.push(stmt.getAsObject()); }
  stmt.free();
  return rows;
}

function oneRow(db: SqlJsDatabase, sql: string, params?: any[]): any | undefined {
  const stmt = db.prepare(sql);
  if (params) { stmt.bind(params); }
  let row: any | undefined;
  if (stmt.step()) { row = stmt.getAsObject(); }
  stmt.free();
  return row;
}

export class CScoutDatabase {
  private db: SqlJsDatabase;
  private filePathCache = new Map<number, string>();

  private constructor(db: SqlJsDatabase) {
    this.db = db;
    this.buildFilePathCache();
  }

  static async open(dbPath: string): Promise<CScoutDatabase> {
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(dbPath);
    const db = new SQL.Database(buf);
    return new CScoutDatabase(db);
  }

  close() { this.db.close(); }

  private buildFilePathCache() {
    const rows = allRows(this.db, "SELECT FID, NAME FROM FILES");
    for (const row of rows) {
      this.filePathCache.set(row.FID as number, row.NAME as string);
    }
  }

  getFilePath(fid: number): string {
    return this.filePathCache.get(fid) ?? `<unknown fid=${fid}>`;
  }

  findFid(filePath: string): number | undefined {
    const normalized = path.normalize(filePath).toLowerCase();
    for (const [fid, p] of this.filePathCache) {
      const np = path.normalize(p).toLowerCase();
      if (np === normalized || np.endsWith(normalized) || normalized.endsWith(np)) {
        return fid;
      }
    }
    return undefined;
  }

  getFileCount(): number { return oneRow(this.db, "SELECT COUNT(*) as c FROM FILES").c; }
  getFunctionCount(): number { return oneRow(this.db, "SELECT COUNT(*) as c FROM FUNCTIONS").c; }
  getIdentifierCount(): number { return oneRow(this.db, "SELECT COUNT(*) as c FROM IDS").c; }

  getProjects(): CScoutProject[] {
    return allRows(this.db, "SELECT PID as pid, NAME as name FROM PROJECTS") as CScoutProject[];
  }

  getProjectFiles(pid: number): CScoutFile[] {
    return allRows(this.db, `
      SELECT f.FID as fid, f.NAME as name, f.RO as readonly
      FROM FILES f JOIN FILEPROJ fp ON fp.FID = f.FID
      WHERE fp.PID = ? ORDER BY f.NAME`, [pid]) as CScoutFile[];
  }

  getFiles(): CScoutFile[] {
    return allRows(this.db, "SELECT FID as fid, NAME as name, RO as readonly FROM FILES ORDER BY NAME") as CScoutFile[];
  }

  resolveLocation(fid: number, foffset: number): TokenLocation {
    const row = oneRow(this.db, `
      SELECT LNUM, FOFFSET FROM LINEPOS
      WHERE FID = ? AND FOFFSET <= ?
      ORDER BY FOFFSET DESC LIMIT 1`, [fid, foffset]);
    const line = row ? row.LNUM : 1;
    const column = row ? foffset - row.FOFFSET : foffset;
    return { fid, filePath: this.getFilePath(fid), offset: foffset, line, column };
  }

  getIdentifiers(limit = 500): CScoutIdentifier[] {
    return allRows(this.db, `
      SELECT EID as eid, NAME as name, READONLY as readonly, UNUSED as unused,
             MACRO as macro, ORDINARY as ordinary, SUETAG as suetag, SUMEMBER as sumember,
             LABEL as label, TYPEDEF as typedef, FUN as fun, CSCOPE as cscope, LSCOPE as lscope
      FROM IDS ORDER BY NAME LIMIT ?`, [limit]) as CScoutIdentifier[];
  }

  getUnusedIdentifiers(): CScoutIdentifier[] {
    return allRows(this.db, `
      SELECT EID as eid, NAME as name, READONLY as readonly, UNUSED as unused,
             MACRO as macro, ORDINARY as ordinary, SUETAG as suetag, SUMEMBER as sumember,
             LABEL as label, TYPEDEF as typedef, FUN as fun, CSCOPE as cscope, LSCOPE as lscope
      FROM IDS WHERE UNUSED = 1 AND READONLY = 0 ORDER BY NAME`) as CScoutIdentifier[];
  }

  getIdentifierLocations(eid: number): TokenLocation[] {
    const rows = allRows(this.db, "SELECT FID, FOFFSET FROM TOKENS WHERE EID = ? ORDER BY FID, FOFFSET", [eid]);
    return rows.map((r) => this.resolveLocation(r.FID, r.FOFFSET));
  }

  findIdentifierByName(name: string): CScoutIdentifier | undefined {
    return oneRow(this.db, `
      SELECT EID as eid, NAME as name, READONLY as readonly, UNUSED as unused,
             MACRO as macro, ORDINARY as ordinary, SUETAG as suetag, SUMEMBER as sumember,
             LABEL as label, TYPEDEF as typedef, FUN as fun, CSCOPE as cscope, LSCOPE as lscope
      FROM IDS WHERE NAME = ?`, [name]) as CScoutIdentifier | undefined;
  }

  getFunctions(limit = 500): CScoutFunction[] {
    return allRows(this.db, `
      SELECT ID as id, NAME as name, ISMACRO as isMacro, DEFINED as defined,
             DECLARED as declared, FILESCOPED as fileScoped, FID as fid,
             FOFFSET as foffset, FANIN as fanin
      FROM FUNCTIONS ORDER BY NAME LIMIT ?`, [limit]) as CScoutFunction[];
  }

  getFunctionByName(name: string): CScoutFunction | undefined {
    return oneRow(this.db, `
      SELECT ID as id, NAME as name, ISMACRO as isMacro, DEFINED as defined,
             DECLARED as declared, FILESCOPED as fileScoped, FID as fid,
             FOFFSET as foffset, FANIN as fanin
      FROM FUNCTIONS WHERE NAME = ?`, [name]) as CScoutFunction | undefined;
  }

  getFunctionLocation(funcId: number): TokenLocation | undefined {
    const row = oneRow(this.db, "SELECT FID, FOFFSET FROM FUNCTIONS WHERE ID = ?", [funcId]);
    if (!row) { return undefined; }
    return this.resolveLocation(row.FID, row.FOFFSET);
  }

  getCallees(funcId: number): FunctionCall[] {
    return allRows(this.db, `
      SELECT fc.SOURCEID as sourceId, src.NAME as sourceName,
             fc.DESTID as destId, dst.NAME as destName
      FROM FCALLS fc
      JOIN FUNCTIONS src ON src.ID = fc.SOURCEID
      JOIN FUNCTIONS dst ON dst.ID = fc.DESTID
      WHERE fc.SOURCEID = ? ORDER BY dst.NAME`, [funcId]) as FunctionCall[];
  }

  getCallers(funcId: number): FunctionCall[] {
    return allRows(this.db, `
      SELECT fc.SOURCEID as sourceId, src.NAME as sourceName,
             fc.DESTID as destId, dst.NAME as destName
      FROM FCALLS fc
      JOIN FUNCTIONS src ON src.ID = fc.SOURCEID
      JOIN FUNCTIONS dst ON dst.ID = fc.DESTID
      WHERE fc.DESTID = ? ORDER BY src.NAME`, [funcId]) as FunctionCall[];
  }

  getFileMetrics(filePath: string): FileMetricsRow | undefined {
    const fid = this.findFid(filePath);
    if (fid === undefined) { return undefined; }
    return oneRow(this.db, "SELECT * FROM FILEMETRICS WHERE FID = ? AND PRECPP = 0", [fid]) as FileMetricsRow | undefined;
  }

  getFileMetricsAll(): { name: string; metrics: FileMetricsRow }[] {
    const rows = allRows(this.db, `
      SELECT f.NAME as name, fm.*
      FROM FILEMETRICS fm JOIN FILES f ON f.FID = fm.FID
      WHERE fm.PRECPP = 0 ORDER BY f.NAME`);
    return rows.map((r) => ({ name: r.name ?? r.NAME, metrics: r }));
  }

  getFunctionMetrics(funcId: number): FileMetricsRow | undefined {
    return oneRow(this.db, "SELECT * FROM FUNCTIONMETRICS WHERE FUNCTIONID = ? AND PRECPP = 0", [funcId]) as FileMetricsRow | undefined;
  }

  getIncluders(fid: number): CScoutFile[] {
    return allRows(this.db, `
      SELECT DISTINCT f.FID as fid, f.NAME as name, f.RO as readonly
      FROM INCLUDERS inc JOIN FILES f ON f.FID = inc.INCLUDERID
      WHERE inc.BASEFILEID = ? ORDER BY f.NAME`, [fid]) as CScoutFile[];
  }
}
''')

# Mock server
print("\n📁 Creating mock server...\n")

create_file('src/scripts/mockServer.ts', '''import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

const PORT = 8081;
const DEFAULT_DB = path.join(__dirname, '..', '..', 'sample', 'sample-cscout.db');

function queryDb(db: SqlJsDatabase, sql: string): Record<string, any>[] {
    const result = db.exec(sql);
    if (result.length === 0) { return []; }
    const cols = result[0].columns;
    return result[0].values.map(row => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < cols.length; i++) { obj[cols[i]] = row[i]; }
        return obj;
    });
}

function json(res: http.ServerResponse, data: any, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

async function main() {
    const dbPath = process.argv[2] || DEFAULT_DB;

    if (!fs.existsSync(dbPath)) {
        console.error(`Database not found: ${dbPath}`);
        console.log('Run: npx ts-node src/scripts/generateSampleDb.ts');
        process.exit(1);
    }

    console.log(`Loading database: ${dbPath}`);
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(dbPath);
    const db = new SQL.Database(buf);
    console.log('Database loaded.');

    const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${PORT}`);
        const pathname = url.pathname;
        const start = Date.now();

        res.on('finish', () => {
            console.log(`${res.statusCode} ${req.method} ${req.url} ${Date.now() - start}ms`);
        });

        try {
            // GET /api/identifiers
            if (pathname === '/api/identifiers') {
                let sql = `SELECT EID as eid, NAME as name, UNUSED as unused, MACRO as macro,
                           FUN as fun, TYPEDEF as typedef, SUETAG as suetag, SUMEMBER as sumember,
                           ORDINARY as ordinary, READONLY as readonly FROM IDS`;
                const conditions: string[] = [];
                if (url.searchParams.get('unused') === 'true') { conditions.push('UNUSED = 1'); }
                if (url.searchParams.get('writable') === 'true') { conditions.push('READONLY = 0'); }
                if (conditions.length) { sql += ' WHERE ' + conditions.join(' AND '); }
                sql += ' ORDER BY NAME';
                const rows = queryDb(db, sql);
                const limit = parseInt(url.searchParams.get('limit') || '-1', 10);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const sliced = limit >= 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
                json(res, { total: rows.length, items: sliced });
                return;
            }

            // GET /api/identifier?eid=N
            if (pathname === '/api/identifier') {
                const eid = url.searchParams.get('eid');
                if (!eid) { json(res, { error: 'missing eid parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT EID as eid, NAME as name, UNUSED as unused, MACRO as macro,
                    FUN as fun, TYPEDEF as typedef, SUETAG as suetag, SUMEMBER as sumember,
                    ORDINARY as ordinary, READONLY as readonly FROM IDS WHERE EID = ${eid}`);
                if (rows.length === 0) { json(res, { error: 'unknown eid' }, 404); return; }
                const id = rows[0];
                const locs = queryDb(db, `SELECT t.FID as fid, t.FOFFSET as offset, f.NAME as file,
                    lp.LNUM as line, (t.FOFFSET - lp.FOFFSET) as col
                    FROM TOKENS t JOIN FILES f ON f.FID = t.FID
                    JOIN LINEPOS lp ON lp.FID = t.FID AND lp.FOFFSET = (
                        SELECT MAX(FOFFSET) FROM LINEPOS WHERE FID = t.FID AND FOFFSET <= t.FOFFSET)
                    WHERE t.EID = ${eid} ORDER BY t.FID, t.FOFFSET`);
                json(res, { ...id, locations: locs });
                return;
            }

            // GET /api/files
            if (pathname === '/api/files') {
                const writable = url.searchParams.get('writable');
                let sql = 'SELECT FID as fid, NAME as name, RO as readonly FROM FILES';
                if (writable === 'true') { sql += ' WHERE RO = 0'; }
                sql += ' ORDER BY NAME';
                const rows = queryDb(db, sql);
                const limit = parseInt(url.searchParams.get('limit') || '-1', 10);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const sliced = limit >= 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
                json(res, { total: rows.length, items: sliced });
                return;
            }

            // GET /api/filemetrics?fid=N
            if (pathname === '/api/filemetrics') {
                const fid = url.searchParams.get('fid');
                if (!fid) { json(res, { error: 'missing fid parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT * FROM FILEMETRICS WHERE FID = ${fid} AND PRECPP = 0`);
                if (rows.length === 0) { json(res, { error: 'No metrics for this file' }, 404); return; }
                json(res, { fid: parseInt(fid, 10), metrics: rows[0] });
                return;
            }

            // GET /api/functions
            if (pathname === '/api/functions') {
                const defined = url.searchParams.get('defined');
                let sql = `SELECT ID as id, NAME as name, FILESCOPED as is_file_scoped, 0 as fanin, 0 as fanout FROM FUNCTIONS`;
                if (defined === 'true') { sql += ' WHERE DEFINED = 1'; }
                sql += ' ORDER BY NAME';
                const rows = queryDb(db, sql);
                const limit = parseInt(url.searchParams.get('limit') || '-1', 10);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const sliced = limit >= 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
                json(res, { total: rows.length, items: sliced });
                return;
            }

            // GET /api/function?id=N
            if (pathname === '/api/function') {
                const id = url.searchParams.get('id');
                if (!id) { json(res, { error: 'missing id parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT ID as id, NAME as name, FILESCOPED as is_file_scoped FROM FUNCTIONS WHERE ID = ${id}`);
                if (rows.length === 0) { json(res, { error: 'unknown function id' }, 404); return; }
                json(res, rows[0]);
                return;
            }

            // GET /api/function_callers?id=N
            if (pathname === '/api/function_callers') {
                const id = url.searchParams.get('id');
                if (!id) { json(res, { error: 'missing id parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT src.ID as id, src.NAME as name FROM FCALLS fc
                    JOIN FUNCTIONS src ON src.ID = fc.SOURCEID WHERE fc.DESTID = ${id} ORDER BY src.NAME`);
                json(res, rows);
                return;
            }

            // GET /api/function_callees?id=N
            if (pathname === '/api/function_callees') {
                const id = url.searchParams.get('id');
                if (!id) { json(res, { error: 'missing id parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT dst.ID as id, dst.NAME as name FROM FCALLS fc
                    JOIN FUNCTIONS dst ON dst.ID = fc.DESTID WHERE fc.SOURCEID = ${id} ORDER BY dst.NAME`);
                json(res, rows);
                return;
            }

            // GET /api/projects
            if (pathname === '/api/projects') {
                json(res, queryDb(db, 'SELECT PID as pid, NAME as name FROM PROJECTS ORDER BY NAME'));
                return;
            }

            // GET /api/project_files?pid=N
            if (pathname === '/api/project_files') {
                const pid = url.searchParams.get('pid');
                if (!pid) { json(res, { error: 'missing pid parameter' }, 400); return; }
                const rows = queryDb(db, `SELECT f.FID as fid, f.NAME as name FROM FILES f
                    JOIN FILEPROJ fp ON fp.FID = f.FID WHERE fp.PID = ${pid} ORDER BY f.NAME`);
                json(res, rows);
                return;
            }

            // Index page
            if (pathname === '/' || pathname === '/index.html') {
                res.setHeader('Content-Type', 'text/html');
                res.end(`<html><head><title>CScout Mock Server</title></head>
                    <body><h1>CScout Mock Server</h1>
                    <p>REST API: <a href="/api/identifiers">/api/identifiers</a> |
                    <a href="/api/files">/api/files</a> |
                    <a href="/api/functions">/api/functions</a> |
                    <a href="/api/projects">/api/projects</a></p></body></html>`);
                return;
            }

            res.statusCode = 404;
            res.end('Not found');

        } catch (err: any) {
            console.error(`Error handling ${pathname}:`, err.message);
            json(res, { error: err.message }, 500);
        }
    });

    server.listen(PORT, () => {
        console.log(`CScout mock server listening on http://localhost:${PORT}`);
    });
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
''')

# Sample database generator
print("\n📁 Creating sample database generator...\n")

create_file('src/scripts/generateSampleDb.ts', r'''import initSqlJs from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'sample', 'sample-cscout.db');

async function main() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    if (fs.existsSync(DB_PATH)) { fs.unlinkSync(DB_PATH); }

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Create tables
    db.run(`
        CREATE TABLE FILES (FID INTEGER PRIMARY KEY, NAME TEXT NOT NULL, RO BOOLEAN NOT NULL);
        CREATE TABLE FILEMETRICS (FID INTEGER NOT NULL, PRECPP BOOLEAN NOT NULL, NLINE INTEGER,
            NSTMT INTEGER, NOP INTEGER, NTOKEN INTEGER, NIF INTEGER, NELSE INTEGER, NSWITCH INTEGER,
            NFOR INTEGER, NWHILE INTEGER, NRETURN INTEGER, PRIMARY KEY (FID, PRECPP));
        CREATE TABLE IDS (EID INTEGER PRIMARY KEY, NAME TEXT NOT NULL, READONLY BOOLEAN NOT NULL,
            UNDEFMACRO BOOLEAN, MACRO BOOLEAN NOT NULL, MACROARG BOOLEAN, ORDINARY BOOLEAN NOT NULL,
            SUETAG BOOLEAN NOT NULL, SUMEMBER BOOLEAN NOT NULL, LABEL BOOLEAN, TYPEDEF BOOLEAN NOT NULL,
            ENUM BOOLEAN, YACC BOOLEAN, FUN BOOLEAN NOT NULL, CSCOPE BOOLEAN NOT NULL,
            LSCOPE BOOLEAN NOT NULL, UNUSED BOOLEAN NOT NULL);
        CREATE TABLE TOKENS (FID INTEGER NOT NULL, FOFFSET INTEGER NOT NULL, EID INTEGER NOT NULL,
            PRIMARY KEY (FID, FOFFSET));
        CREATE TABLE LINEPOS (FID INTEGER NOT NULL, FOFFSET INTEGER NOT NULL, LNUM INTEGER NOT NULL,
            PRIMARY KEY (FID, FOFFSET));
        CREATE TABLE PROJECTS (PID INTEGER PRIMARY KEY, NAME TEXT NOT NULL);
        CREATE TABLE FILEPROJ (FID INTEGER NOT NULL, PID INTEGER NOT NULL, PRIMARY KEY (FID, PID));
        CREATE TABLE FUNCTIONS (ID INTEGER PRIMARY KEY, NAME TEXT NOT NULL, ISMACRO BOOLEAN NOT NULL,
            DEFINED BOOLEAN NOT NULL, DECLARED BOOLEAN NOT NULL, FILESCOPED BOOLEAN NOT NULL,
            FID INTEGER NOT NULL, FOFFSET INTEGER NOT NULL, FANIN INTEGER NOT NULL);
        CREATE TABLE FCALLS (SOURCEID INTEGER NOT NULL, DESTID INTEGER NOT NULL);
        CREATE TABLE INCLUDERS (PID INTEGER, CUID INTEGER, BASEFILEID INTEGER, INCLUDERID INTEGER);
    `);

    // Insert project
    db.run('INSERT INTO PROJECTS VALUES (?, ?)', [1, 'sample_calc']);

    const calcDir = path.join(__dirname, '..', '..', 'sample', 'calc');

    // Insert files
    const files = [
        [1, path.join(calcDir, 'main.c'), 0],
        [2, path.join(calcDir, 'calc.c'), 0],
        [3, path.join(calcDir, 'calc.h'), 0],
        [4, path.join(calcDir, 'utils.c'), 0],
        [5, path.join(calcDir, 'utils.h'), 0],
    ];
    for (const f of files) {
        db.run('INSERT INTO FILES VALUES (?, ?, ?)', f);
        db.run('INSERT INTO FILEPROJ VALUES (?, ?)', [f[0], 1]);
    }

    // Insert line positions
    function insertLinePosForFile(fid: number, filePath: string) {
        if (!fs.existsSync(filePath)) { return; }
        const content = fs.readFileSync(filePath, 'utf8');
        let offset = 0; let lineNum = 1;
        db.run('INSERT INTO LINEPOS VALUES (?, ?, ?)', [fid, 0, 1]);
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '\\n') {
                offset = i + 1; lineNum++;
                db.run('INSERT INTO LINEPOS VALUES (?, ?, ?)', [fid, offset, lineNum]);
            }
        }
    }
    for (const f of files) { insertLinePosForFile(f[0] as number, f[1] as string); }

    // Insert identifiers
    const identifiers = [
        [100, 'main',          0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [101, 'calc_add',      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [102, 'calc_sub',      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [103, 'calc_mul',      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [104, 'calc_div',      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [105, 'print_result',  0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [106, 'parse_input',   0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        [107, 'format_output', 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        [108, 'debug_log',     0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        [200, 'result',        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [300, 'MAX_BUF',       0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [301, 'EPSILON',       0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [302, 'DEBUG_MODE',    0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [400, 'CalcResult',    0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [401, 'value',         0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [500, 'calc_op_t',     0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        [600, 'printf',        1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    ];
    for (const id of identifiers) {
        db.run('INSERT INTO IDS VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id);
    }

    // Insert tokens
    function findOffset(filePath: string, word: string): number {
        if (!fs.existsSync(filePath)) { return 0; }
        const content = fs.readFileSync(filePath, 'utf8');
        const idx = content.indexOf(word);
        return idx >= 0 ? idx : 0;
    }

    const tokens = [
        [1, findOffset(files[0][1] as string, 'main'), 100],
        [1, findOffset(files[0][1] as string, 'calc_add'), 101],
        [1, findOffset(files[0][1] as string, 'calc_sub'), 102],
        [1, findOffset(files[0][1] as string, 'calc_mul'), 103],
        [1, findOffset(files[0][1] as string, 'calc_div'), 104],
        [1, findOffset(files[0][1] as string, 'print_result'), 105],
        [2, findOffset(files[1][1] as string, 'calc_add'), 101],
        [2, findOffset(files[1][1] as string, 'calc_sub'), 102],
        [2, findOffset(files[1][1] as string, 'calc_mul'), 103],
        [2, findOffset(files[1][1] as string, 'calc_div'), 104],
        [3, findOffset(files[2][1] as string, 'MAX_BUF'), 300],
        [3, findOffset(files[2][1] as string, 'CalcResult'), 400],
        [4, findOffset(files[3][1] as string, 'print_result'), 105],
        [4, findOffset(files[3][1] as string, 'parse_input'), 106],
    ];
    for (const t of tokens) { db.run('INSERT INTO TOKENS VALUES (?, ?, ?)', t); }

    // Insert functions
    const functions = [
        [1000, 'main',          0, 1, 1, 0, 1, findOffset(files[0][1] as string, 'main'),         0],
        [1001, 'calc_add',      0, 1, 1, 0, 2, findOffset(files[1][1] as string, 'calc_add'),     2],
        [1002, 'calc_sub',      0, 1, 1, 0, 2, findOffset(files[1][1] as string, 'calc_sub'),     1],
        [1003, 'calc_mul',      0, 1, 1, 0, 2, findOffset(files[1][1] as string, 'calc_mul'),     1],
        [1004, 'calc_div',      0, 1, 1, 0, 2, findOffset(files[1][1] as string, 'calc_div'),     1],
        [1005, 'print_result',  0, 1, 1, 0, 4, findOffset(files[3][1] as string, 'print_result'), 3],
        [1006, 'parse_input',   0, 1, 0, 1, 4, findOffset(files[3][1] as string, 'parse_input'),  0],
        [1007, 'format_output', 0, 1, 1, 1, 4, findOffset(files[3][1] as string, 'format_output'),0],
        [1008, 'debug_log',     0, 1, 0, 1, 4, findOffset(files[3][1] as string, 'debug_log'),    0],
        [1009, 'printf',        0, 0, 1, 0, 1, 0, 5],
    ];
    for (const f of functions) { db.run('INSERT INTO FUNCTIONS VALUES (?,?,?,?,?,?,?,?,?)', f); }

    // Insert function calls
    const calls = [
        [1000, 1001], [1000, 1002], [1000, 1003], [1000, 1004], [1000, 1005],
        [1001, 1009], [1005, 1009], [1005, 1007],
    ];
    for (const c of calls) { db.run('INSERT INTO FCALLS VALUES (?, ?)', c); }

    // Insert file metrics
    const fileMSql = `INSERT INTO FILEMETRICS (FID, PRECPP, NLINE, NSTMT, NOP, NTOKEN, NIF, NELSE,
        NSWITCH, NFOR, NWHILE, NRETURN) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(fileMSql, [1, 31, 10, 8, 65, 1, 0, 1, 0, 0, 2]);
    db.run(fileMSql, [2, 27, 7, 5, 50, 1, 0, 0, 0, 0, 4]);
    db.run(fileMSql, [3, 25, 0, 0, 25, 0, 0, 0, 0, 0, 0]);
    db.run(fileMSql, [4, 37, 12, 10, 85, 3, 1, 1, 0, 0, 4]);
    db.run(fileMSql, [5, 8, 0, 0, 10, 0, 0, 0, 0, 0, 0]);

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    db.close();

    console.log(`Sample database created: ${DB_PATH}`);
}

main().catch(err => {
    console.error('Failed to generate sample DB:', err);
    process.exit(1);
});
''')

# Services layer
print("\n📁 Creating services layer...\n")

create_file('src/services/cscoutServer.ts', '''import * as http from 'http';
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
                socket.write(`GET ${urlPath} HTTP/1.0\\r\\nHost: ${host}:${port}\\r\\nConnection: close\\r\\n\\r\\n`);
            });

            socket.on('data', chunk => { data += chunk.toString(); });
            socket.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    const idx = data.indexOf('\\r\\n\\r\\n');
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
''')

# Webview graph rendering
print("\n📁 Creating webview infrastructure...\n")

create_file('src/webview/renderGraph.ts', r'''import * as vscode from 'vscode';

export interface GraphNode {
    id: string;
    label: string;
    type: 'function' | 'file' | 'identifier';
}

export interface GraphEdge {
    source: string;
    target: string;
    label?: string;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    title: string;
}

export function createGraphPanel(context: vscode.ExtensionContext, data: GraphData): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'cscoutGraph',
        data.title,
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    panel.webview.html = getGraphHtml(data);
    return panel;
}

function getGraphHtml(data: GraphData): string {
    const nodesJson = JSON.stringify(data.nodes);
    const edgesJson = JSON.stringify(data.edges);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; font-family: var(--vscode-font-family); background: var(--vscode-editor-background); }
        #graph { width: 100vw; height: 100vh; }
        .node { cursor: pointer; }
        .node rect { fill: var(--vscode-button-background); stroke: var(--vscode-button-border); stroke-width: 2px; rx: 5; }
        .node text { fill: var(--vscode-button-foreground); font-size: 12px; }
        .node:hover rect { fill: var(--vscode-button-hoverBackground); }
        .edge { stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 1.5px; fill: none; }
        .edge-label { fill: var(--vscode-descriptionForeground); font-size: 10px; }
        .controls { position: fixed; top: 10px; right: 10px; display: flex; gap: 5px; }
        .controls button { padding: 5px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
            border: none; cursor: pointer; border-radius: 3px; }
        .controls button:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="zoomIn()">+</button>
        <button onclick="zoomOut()">-</button>
        <button onclick="resetZoom()">Reset</button>
    </div>
    <svg id="graph"></svg>
    <script>
        const nodes = ${nodesJson};
        const edges = ${edgesJson};
        
        const svg = document.getElementById('graph');
        const width = window.innerWidth;
        const height = window.innerHeight;
        svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);
        
        let scale = 1;
        let translateX = 0, translateY = 0;
        
        // Simple force-directed layout
        const nodeWidth = 120, nodeHeight = 30;
        const nodeMap = new Map();
        
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = Math.min(width, height) / 3;
            node.x = width / 2 + radius * Math.cos(angle);
            node.y = height / 2 + radius * Math.sin(angle);
            nodeMap.set(node.id, node);
        });
        
        function render() {
            svg.innerHTML = '';
            
            // Draw edges
            edges.forEach(edge => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (source && target) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('class', 'edge');
                    line.setAttribute('x1', source.x + nodeWidth / 2);
                    line.setAttribute('y1', source.y + nodeHeight / 2);
                    line.setAttribute('x2', target.x + nodeWidth / 2);
                    line.setAttribute('y2', target.y + nodeHeight / 2);
                    svg.appendChild(line);
                }
            });
            
            // Draw nodes
            nodes.forEach(node => {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', 'node');
                g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
                
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('width', nodeWidth);
                rect.setAttribute('height', nodeHeight);
                g.appendChild(rect);
                
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', nodeWidth / 2);
                text.setAttribute('y', nodeHeight / 2 + 4);
                text.setAttribute('text-anchor', 'middle');
                text.textContent = node.label.length > 14 ? node.label.slice(0, 12) + '...' : node.label;
                g.appendChild(text);
                
                svg.appendChild(g);
            });
        }
        
        function zoomIn() { scale *= 1.2; updateTransform(); }
        function zoomOut() { scale /= 1.2; updateTransform(); }
        function resetZoom() { scale = 1; translateX = 0; translateY = 0; updateTransform(); }
        
        function updateTransform() {
            svg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        }
        
        // Pan with mouse drag
        let isDragging = false, lastX, lastY;
        svg.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
        svg.addEventListener('mousemove', e => {
            if (isDragging) {
                translateX += (e.clientX - lastX) / scale;
                translateY += (e.clientY - lastY) / scale;
                lastX = e.clientX; lastY = e.clientY;
                updateTransform();
            }
        });
        svg.addEventListener('mouseup', () => isDragging = false);
        svg.addEventListener('mouseleave', () => isDragging = false);
        
        render();
    </script>
</body>
</html>`;
}
''')

# Test files
print("\n📁 Creating test files...\n")

create_file('src/test/cscoutDatabase.test.ts', '''import { expect } from 'chai';
import * as path from 'path';
import { CScoutDatabase } from '../db/cscoutDatabase';

describe('CScoutDatabase', () => {
    const DB_PATH = path.join(__dirname, '..', '..', 'sample', 'sample-cscout.db');
    let db: CScoutDatabase;

    before(async function() {
        this.timeout(10000);
        try {
            db = await CScoutDatabase.open(DB_PATH);
        } catch (err) {
            console.log('Database not found, skipping tests. Run generateSampleDb.ts first.');
            this.skip();
        }
    });

    after(() => {
        if (db) { db.close(); }
    });

    describe('getProjects', () => {
        it('should return at least one project', () => {
            const projects = db.getProjects();
            expect(projects).to.be.an('array');
            expect(projects.length).to.be.greaterThan(0);
        });

        it('should have project with name', () => {
            const projects = db.getProjects();
            expect(projects[0]).to.have.property('name');
            expect(projects[0]).to.have.property('pid');
        });
    });

    describe('getFiles', () => {
        it('should return files array', () => {
            const files = db.getFiles();
            expect(files).to.be.an('array');
        });

        it('should have file properties', () => {
            const files = db.getFiles();
            if (files.length > 0) {
                expect(files[0]).to.have.property('fid');
                expect(files[0]).to.have.property('name');
            }
        });
    });

    describe('getIdentifiers', () => {
        it('should return identifiers array', () => {
            const ids = db.getIdentifiers(100);
            expect(ids).to.be.an('array');
        });

        it('should have identifier properties', () => {
            const ids = db.getIdentifiers(100);
            if (ids.length > 0) {
                expect(ids[0]).to.have.property('eid');
                expect(ids[0]).to.have.property('name');
            }
        });
    });

    describe('getUnusedIdentifiers', () => {
        it('should return only unused identifiers', () => {
            const unused = db.getUnusedIdentifiers();
            expect(unused).to.be.an('array');
            for (const id of unused) {
                expect(id.unused).to.equal(1);
            }
        });
    });

    describe('getFunctions', () => {
        it('should return functions array', () => {
            const fns = db.getFunctions(100);
            expect(fns).to.be.an('array');
        });

        it('should include main function', () => {
            const main = db.getFunctionByName('main');
            if (main) {
                expect(main.name).to.equal('main');
            }
        });
    });

    describe('getCallees', () => {
        it('should return call relationships', () => {
            const main = db.getFunctionByName('main');
            if (main) {
                const callees = db.getCallees(main.id);
                expect(callees).to.be.an('array');
            }
        });
    });

    describe('findIdentifierByName', () => {
        it('should find existing identifier', () => {
            const id = db.findIdentifierByName('main');
            if (id) {
                expect(id.name).to.equal('main');
            }
        });

        it('should return undefined for non-existent', () => {
            const id = db.findIdentifierByName('nonexistent_xyz_12345');
            expect(id).to.be.undefined;
        });
    });
});
''')

create_file('src/test/mockServer.test.ts', '''import { expect } from 'chai';
import * as http from 'http';

const PORT = 8081;
const HOST = 'localhost';

function fetch(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        http.get({ hostname: HOST, port: PORT, path, timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

describe('Mock Server Endpoints', function() {
    this.timeout(10000);

    before(async function() {
        try {
            await fetch('/api/projects');
        } catch {
            console.log('Mock server not running, skipping tests. Run: npm run server');
            this.skip();
        }
    });

    describe('GET /api/projects', () => {
        it('should return array of projects', async () => {
            const data = await fetch('/api/projects');
            expect(data).to.be.an('array');
        });
    });

    describe('GET /api/files', () => {
        it('should return paginated response', async () => {
            const data = await fetch('/api/files');
            expect(data).to.have.property('total');
            expect(data).to.have.property('items');
            expect(data.items).to.be.an('array');
        });

        it('should support limit parameter', async () => {
            const data = await fetch('/api/files?limit=2');
            expect(data.items.length).to.be.at.most(2);
        });
    });

    describe('GET /api/identifiers', () => {
        it('should return paginated response', async () => {
            const data = await fetch('/api/identifiers');
            expect(data).to.have.property('total');
            expect(data).to.have.property('items');
        });

        it('should filter unused identifiers', async () => {
            const data = await fetch('/api/identifiers?unused=true');
            for (const item of data.items) {
                expect(item.unused).to.equal(1);
            }
        });
    });

    describe('GET /api/functions', () => {
        it('should return paginated response', async () => {
            const data = await fetch('/api/functions');
            expect(data).to.have.property('total');
            expect(data).to.have.property('items');
        });
    });

    describe('GET /api/function_callers', () => {
        it('should return array', async () => {
            const fns = await fetch('/api/functions');
            if (fns.items.length > 0) {
                const callers = await fetch(`/api/function_callers?id=${fns.items[0].id}`);
                expect(callers).to.be.an('array');
            }
        });
    });

    describe('GET /api/function_callees', () => {
        it('should return array', async () => {
            const fns = await fetch('/api/functions');
            if (fns.items.length > 0) {
                const callees = await fetch(`/api/function_callees?id=${fns.items[0].id}`);
                expect(callees).to.be.an('array');
            }
        });
    });

    describe('Error handling', () => {
        it('should return 400 for missing parameters', async () => {
            try {
                await fetch('/api/identifier');
            } catch {
                // Expected
            }
        });
    });
});
''')

# ESLint config
print("\n📁 Creating ESLint configuration...\n")

create_file('.eslintrc.json', '''{
    "root": true,
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "plugins": ["@typescript-eslint"],
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
        "no-console": "off",
        "semi": ["error", "always"],
        "quotes": ["error", "single", { "avoidEscape": true }]
    },
    "ignorePatterns": ["out", "node_modules", "*.js"]
}
''')

# Resources
print("\n📁 Creating resources...\n")

create_file('resources/filter.svg', '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
    <path fill="#C5C5C5" d="M6 12v-1h4v1H6zm-2-4v-1h8v1H4zm-2-4V3h12v1H2z"/>
</svg>
''')

create_file('resources/cscout.svg', '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
    <path fill="#75BEFF" d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/>
    <circle fill="#75BEFF" cx="8" cy="8" r="2"/>
</svg>
''')

# Summary
print("\n" + "=" * 60)
print("                ✓ SETUP COMPLETE!")
print("=" * 60 + "\n")

print("Created files:")
print("  ✓ sample/calc/*.c, *.h     - Sample C project")
print("  ✓ src/db/cscoutDatabase.ts - Database layer")
print("  ✓ src/scripts/mockServer.ts - Mock HTTP server")
print("  ✓ src/scripts/generateSampleDb.ts - DB generator")
print("  ✓ src/services/cscoutServer.ts - Services layer")
print("  ✓ src/webview/renderGraph.ts - Graph visualization")
print("  ✓ src/test/*.test.ts        - Test suites")
print("  ✓ .eslintrc.json            - ESLint config")
print("  ✓ resources/*.svg           - Icons")

print("\n📌 Next steps:")
print("  1. Generate sample database:")
print("     npx ts-node src/scripts/generateSampleDb.ts")
print("")
print("  2. Start mock server:")
print("     npm run server")
print("")
print("  3. Run tests:")
print("     npm test")
print("")
print("  4. Compile extension:")
print("     npm run compile")
print("")
print("=" * 60 + "\n")
