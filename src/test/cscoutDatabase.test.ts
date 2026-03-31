/**
 * CScout Analyzer Client Tests
 * Tests the HTTP client that communicates with the CScout REST API
 */

import { expect } from 'chai';
import { CScoutAnalyzerClient } from '../analyzer/client';

describe('CScoutAnalyzerClient', function() {
    this.timeout(10000);
    
    const client = new CScoutAnalyzerClient('localhost', 8081);

    before(async function() {
        // Check if server is running
        const reachable = await client.isReachable();
        if (!reachable) {
            console.log('⚠️  CScout server not running. Start with: npm run server');
            this.skip();
        }
    });

    describe('Connection', () => {
        it('should report server as reachable', async () => {
            const reachable = await client.isReachable();
            expect(reachable).to.be.true;
        });

        it('should return correct base URL', () => {
            expect(client.baseUrl()).to.equal('http://localhost:8081');
        });
    });

    describe('getProjects', () => {
        it('should return array of projects', async () => {
            const projects = await client.getProjects();
            expect(projects).to.be.an('array');
            expect(projects.length).to.be.greaterThan(0);
        });

        it('should have pid and name fields', async () => {
            const projects = await client.getProjects();
            expect(projects[0]).to.have.property('pid');
            expect(projects[0]).to.have.property('name');
        });
    });

    describe('getSymbols', () => {
        it('should return array of symbols', async () => {
            const symbols = await client.getSymbols();
            expect(symbols).to.be.an('array');
        });

        it('should have required symbol fields', async () => {
            const symbols = await client.getSymbols();
            if (symbols.length > 0) {
                expect(symbols[0]).to.have.property('eid');
                expect(symbols[0]).to.have.property('name');
                expect(symbols[0]).to.have.property('kind');
            }
        });

        it('should filter unused symbols when requested', async () => {
            const unusedSymbols = await client.getSymbols(true);
            expect(unusedSymbols).to.be.an('array');
            for (const sym of unusedSymbols) {
                expect(sym.unused).to.be.true;
            }
        });
    });

    describe('getFunctions', () => {
        it('should return array of functions', async () => {
            const functions = await client.getFunctions();
            expect(functions).to.be.an('array');
        });

        it('should have required function fields', async () => {
            const functions = await client.getFunctions();
            if (functions.length > 0) {
                expect(functions[0]).to.have.property('fid');
                expect(functions[0]).to.have.property('name');
            }
        });

        it('should include main function', async () => {
            const functions = await client.getFunctions();
            const main = functions.find(f => f.name === 'main');
            expect(main).to.exist;
        });
    });

    describe('getCallers and getCallees', () => {
        it('should return callers for a function', async () => {
            const functions = await client.getFunctions();
            if (functions.length > 0) {
                // Find a function that should have callers (like calc_add)
                const calcAdd = functions.find(f => f.name === 'calc_add');
                if (calcAdd) {
                    const callers = await client.getCallers(calcAdd.fid);
                    expect(callers).to.be.an('array');
                }
            }
        });

        it('should return callees for main', async () => {
            const functions = await client.getFunctions();
            const main = functions.find(f => f.name === 'main');
            if (main) {
                const callees = await client.getCallees(main.fid);
                expect(callees).to.be.an('array');
                // main should call some functions
                expect(callees.length).to.be.greaterThan(0);
            }
        });
    });

    describe('Raw HTTP fetch', () => {
        it('should fetch index page', async () => {
            const body = await client.fetch('/index.html');
            expect(body).to.include('CScout');
        });

        it('should handle 404 errors', async () => {
            try {
                await client.fetch('/nonexistent-endpoint-xyz');
                expect.fail('Should have thrown an error');
            } catch (err: unknown) {
                // Should get an error (either HTTP 404 or network error)
                expect(err).to.be.instanceOf(Error);
            }
        });
    });
});
