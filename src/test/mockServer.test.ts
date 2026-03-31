import { expect } from 'chai';
import * as http from 'http';

const PORT = 8081;
const HOST = 'localhost';

interface FetchResponse {
    statusCode: number;
    data: unknown;
}

function fetch(path: string): Promise<FetchResponse> {
    return new Promise((resolve, reject) => {
        http.get({ hostname: HOST, port: PORT, path, timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode || 200, data: JSON.parse(data) });
                } catch {
                    resolve({ statusCode: res.statusCode || 200, data });
                }
            });
        }).on('error', reject);
    });
}

describe('Mock Server REST API Tests', function() {
    this.timeout(10000);

    before(async function() {
        try {
            await fetch('/api/projects');
        } catch {
            console.log('⚠️  Mock server not running. Start with: npm run server');
            this.skip();
        }
    });

    describe('GET /api/projects', () => {
        it('should return array of projects', async () => {
            const { data } = await fetch('/api/projects');
            expect(data).to.be.an('array');
            expect((data as Array<{pid: number}>).length).to.be.greaterThan(0);
        });

        it('should have pid and name fields', async () => {
            const { data } = await fetch('/api/projects');
            const projects = data as Array<{pid: number; name: string}>;
            expect(projects[0]).to.have.property('pid');
            expect(projects[0]).to.have.property('name');
        });
    });

    describe('GET /api/files', () => {
        it('should return array of files', async () => {
            const { data } = await fetch('/api/files');
            expect(data).to.be.an('array');
        });

        it('should have required file fields', async () => {
            const { data } = await fetch('/api/files');
            const files = data as Array<{fid: number; name: string; path: string}>;
            expect(files[0]).to.have.property('fid');
            expect(files[0]).to.have.property('name');
            expect(files[0]).to.have.property('path');
        });

        it('should filter writable files', async () => {
            const { data } = await fetch('/api/files?writable=1');
            const files = data as Array<{readonly: boolean}>;
            for (const file of files) {
                expect(file.readonly).to.be.false;
            }
        });
    });

    describe('GET /api/identifiers', () => {
        it('should return array of identifiers', async () => {
            const { data } = await fetch('/api/identifiers');
            expect(data).to.be.an('array');
        });

        it('should have required identifier fields', async () => {
            const { data } = await fetch('/api/identifiers');
            const ids = data as Array<{eid: string; name: string}>;
            expect(ids[0]).to.have.property('eid');
            expect(ids[0]).to.have.property('name');
        });

        it('should filter unused identifiers', async () => {
            const { data } = await fetch('/api/identifiers?unused=1');
            const ids = data as Array<{unused: boolean}>;
            for (const id of ids) {
                expect(id.unused).to.be.true;
            }
        });
    });

    describe('GET /api/functions', () => {
        it('should return array of functions', async () => {
            const { data } = await fetch('/api/functions');
            expect(data).to.be.an('array');
        });

        it('should have required function fields', async () => {
            const { data } = await fetch('/api/functions');
            const fns = data as Array<{fid: string; name: string}>;
            expect(fns[0]).to.have.property('fid');
            expect(fns[0]).to.have.property('name');
        });

        it('should filter defined functions', async () => {
            const { data } = await fetch('/api/functions?defined=1');
            const fns = data as Array<{is_defined: boolean}>;
            for (const fn of fns) {
                expect(fn.is_defined).to.be.true;
            }
        });
    });

    describe('GET /api/funlist (call graph)', () => {
        it('should return callers for main', async () => {
            const { data } = await fetch('/api/funlist?f=f1&n=u');
            expect(data).to.be.an('array');
        });

        it('should return callees for main', async () => {
            const { data } = await fetch('/api/funlist?f=f1&n=d');
            const callees = data as Array<{name: string}>;
            expect(callees).to.be.an('array');
            // main calls calc_add, calc_sub, etc.
            expect(callees.length).to.be.greaterThan(0);
            const names = callees.map(c => c.name);
            expect(names).to.include('calc_add');
        });

        it('should return error for missing f parameter', async () => {
            const { statusCode, data } = await fetch('/api/funlist?n=u');
            expect(statusCode).to.equal(400);
            expect(data).to.have.property('error');
        });
    });

    describe('GET /api/filemetrics', () => {
        it('should return metrics for valid file', async () => {
            const { data } = await fetch('/api/filemetrics?id=1');
            const metrics = data as {fid: number; metrics: Array<{name: string}>};
            expect(metrics).to.have.property('fid');
            expect(metrics).to.have.property('metrics');
            expect(metrics.metrics).to.be.an('array');
        });

        it('should return 404 for unknown file', async () => {
            const { statusCode } = await fetch('/api/filemetrics?id=9999');
            expect(statusCode).to.equal(404);
        });

        it('should return 400 for missing id', async () => {
            const { statusCode } = await fetch('/api/filemetrics');
            expect(statusCode).to.equal(400);
        });
    });

    describe('GET /api/source', () => {
        it('should return source matches', async () => {
            const { data } = await fetch('/api/source?id=1&ec=f1');
            const result = data as {fid: number; matches: Array<{line: number}>};
            expect(result).to.have.property('fid');
            expect(result).to.have.property('matches');
        });
    });

    describe('HTML endpoints', () => {
        it('should return HTML for index', async () => {
            const { data } = await fetch('/index.html');
            expect(data).to.be.a('string');
            expect(data).to.include('CScout');
        });

        it('should return HTML for xiquery', async () => {
            const { data } = await fetch('/xiquery.html?ec=f1');
            expect(data).to.be.a('string');
            expect(data).to.include('main');
        });
    });

    describe('Error handling', () => {
        it('should return 404 for unknown endpoints', async () => {
            const { statusCode } = await fetch('/api/unknown');
            expect(statusCode).to.equal(404);
        });
    });
});
