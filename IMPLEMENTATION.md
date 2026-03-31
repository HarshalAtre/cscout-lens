# CScout-Lens Enhancement Implementation Guide

## Step 1: Run Setup Script

Execute the setup script to create necessary directories:

```bash
setup-directories.bat
```

This creates:
- `src/db/` - Database layer for mock testing
- `src/scripts/` - Mock server and sample data generator
- `src/test/` - Test suites
- `src/services/` - Service layer (future enhancement)
- `src/webview/` - Graph visualization (future enhancement)
- `sample/calc/` - Sample C project for testing
- `resources/` - Icons and assets

## Step 2: Install Dependencies

Run:
```bash
npm install
```

This installs:
- **sql.js** - In-memory SQLite for mock database
- **mocha & chai** - Testing framework
- **ts-node** - TypeScript execution for scripts
- **eslint** - Code linting
- **Type definitions** for all above

## Step 3: Files Created

After running the setup, the following new files will be available:

### Database Layer
- `src/db/cscoutDatabase.ts` - SQLite database wrapper

### Scripts
- `src/scripts/mockServer.ts` - HTTP mock server for development
- `src/scripts/generateSampleDb.ts` - Creates sample database

### Tests (to be created next)
- `src/test/cscoutDatabase.test.ts` - Database layer tests
- `src/test/cscoutServer.test.ts` - HTTP client tests
- `src/test/jsonEndpoint.test.ts` - REST API contract tests

### Sample Data
- `sample/calc/*.c` - Sample C files
- `sample/calc/*.h` - Sample header files
- `sample/sample-cscout.db` - Generated SQLite database

## Step 4: Verify Installation

```bash
# Compile TypeScript
npm run compile

# Generate sample database (once directories exist)
npx ts-node src/scripts/generateSampleDb.ts

# Start mock server
npm run server

# Run tests (after creating test files)
npm test

# Lint code
npm run lint
```

## Next Implementation Phases

### ✅ Phase 1: Testing Infrastructure (CURRENT)
- [x] Updated package.json with dependencies
- [x] Created directory structure
- [ ] Create sample C files
- [ ] Create database layer
- [ ] Create mock server
- [ ] Create test suites

### 📋 Phase 2: Architecture Refactoring
- [ ] Create services layer
- [ ] Add configuration options
- [ ] Rename panels to views

### 📋 Phase 3: Interactive Filtering
- [ ] Add filter commands
- [ ] Implement QuickPick UI
- [ ] Add custom icons

### 📋 Phase 4: Webview Graph Visualization
- [ ] Create webview infrastructure
- [ ] Add graph commands
- [ ] Implement interactions

### 📋 Phase 5: Dependencies View
- [ ] Create dependency provider
- [ ] Create dependency API
- [ ] Build dependency tree

### 📋 Phase 6: Code Quality
- [ ] Setup ESLint
- [ ] Implement paged loading
- [ ] Improve error handling

## Running the Extension

1. Open cscout-lens folder in VS Code
2. Press F5 to launch Extension Development Host
3. In the new window:
   - Start mock server: `npm run server` (Terminal 1)
   - Connect: Ctrl+Shift+P → "CScout Lens: Connect to Analyzer"
   - Browse projects, symbols, and functions

## Testing Strategy

- **Unit Tests**: Database queries, data transformations
- **Integration Tests**: HTTP endpoints, mock server responses
- **Manual Tests**: VS Code extension features, UI interactions

## Configuration

New settings available:
```json
{
  "cscoutLens.host": "localhost",
  "cscoutLens.port": 8081,
  "cscoutLens.initialLoadPageSize": 500,
  "cscoutLens.initialLoadMaxIdentifiers": 5000,
  "cscoutLens.initialLoadMaxFiles": 3000,
  "cscoutLens.initialLoadMaxFunctions": 4000,
  "cscoutLens.maxDiagnosticsIdentifiers": 1500
}
```

## Troubleshooting

### Directories not created
- Run `setup-directories.bat` manually
- Or create directories using File Explorer

### npm install fails
- Ensure Node.js >= 18 is installed
- Try: `npm cache clean --force` then `npm install`

### TypeScript compilation fails
- Check TypeScript version: `npx tsc --version`
- Should be 5.3.x or higher

### Mock server won't start
- Ensure port 8081 is free
- Kill existing CScout process if running

### Tests fail
- Generate sample database first
- Ensure sample C files exist in `sample/calc/`

## Architecture Improvements

### Before (Current)
```
src/
├── analyzer/
│   ├── client.ts  (HTTP client + type definitions)
│   └── types.ts
├── handlers/      (Language feature providers)
├── panels/        (TreeDataProviders)
└── extension.ts
```

### After (Enhanced)
```
src/
├── analyzer/
│   └── types.ts   (Type definitions only)
├── db/            (Mock database layer)
├── services/      (HTTP client + API services)
├── views/         (TreeDataProviders - renamed from panels)
├── handlers/      (Language feature providers)
├── webview/       (Graph visualizations)
├── scripts/       (Dev tools: mock server, generators)
├── test/          (Test suites)
└── extension.ts
```

## Key Features Added

1. **Mock Server** - Develop/test without running CScout
2. **Database Layer** - Query test data efficiently
3. **Test Suite** - Automated testing for reliability
4. **Better Organization** - Clear separation of concerns
5. **Paged Loading** - Handle large codebases
6. **Interactive Filtering** - QuickPick UI for filters
7. **Graph Visualization** - Interactive call/dependency graphs
8. **Dependencies View** - Structured dependency exploration

## Documentation

- README.md - Updated with new features
- This file - Implementation guide
- plan.md - Detailed feature comparison and roadmap
