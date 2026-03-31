# cscout-lens

A VS Code extension that brings [CScout](https://www.spinellis.gr/cscout/)'s whole-program C analysis directly into the editor. No database exports needed — it talks to a live CScout process over HTTP.

---

## Background

CScout parses entire C workspaces — multiple projects, preprocessor macros, cross-file identifier scopes — and builds a precise semantic model that no single-file tool can match. Its existing interface is a built-in web server you navigate in a browser. This extension makes the same analysis available as first-class VS Code features.

The approach: CScout exposes its data through a **JSON REST API** (endpoints under `/api/`). The extension queries these endpoints over a raw TCP connection (SWILL, CScout's embedded HTTP server, speaks HTTP/1.0) and maps the results to VS Code provider APIs.

---

## Features

| Feature | Status |
|---|---|
| Project & file browser | ✅ |
| Identifier browser, grouped by kind | ✅ |
| Hover — kind, usage status from whole-program analysis | ✅ |
| Go-to-definition via equivalence classes | ✅ |
| Unused symbol diagnostics (Problems panel) | ✅ |
| Per-file metrics | ✅ |
| Call graph (callers / callees, cycle-safe) | ✅ |
| **Interactive filtering** (identifiers, files, functions) | ✅ NEW |
| **Visual call graph** (webview with zoom/pan) | ✅ NEW |
| Mock server for development | ✅ NEW |
| Test suite (35+ tests) | ✅ NEW |

---

## Demo

[![Extension Demo](https://img.youtube.com/vi/kaDhBLOtNPk/0.jpg)](https://www.youtube.com/watch?v=kaDhBLOtNPk)

---

## Requirements

- CScout built and runnable (see [CScout docs](https://www.spinellis.gr/cscout/doc/))
- Node.js >= 18, VS Code >= 1.85

**Windows:** CScout must be built under Cygwin. Add `C:\cygwin64\bin` to your PATH.

**Linux / macOS:** CScout builds natively with a standard C++ toolchain.

---

## Getting Started

### 1. Build the extension

```bash
cd cscout-lens
npm install
npm run compile
```

### 2. (Optional) Run the mock server for development

The mock server provides a fake CScout REST API for testing without running CScout:

```bash
npm run server
```

### 3. Run CScout on your C project

Branch to Use for JSON REST API: [feat/json-rest-api](https://github.com/HarshalAtre/cscout/tree/feat/json-rest-api)

```bash
cd example
../src/build/cscout awk.cs
```

CScout will print `Listening on port 8081`. Leave it running.

### 4. Launch and connect

1. Open `cscout-lens` in VS Code
2. Press `F5` to start debugging (opens Extension Development Host)
3. Run **CScout Lens: Connect to Analyzer** from Command Palette

---

## Commands

| Command | Description |
|---|---|
| `CScout Lens: Connect to Analyzer` | Connect to a running CScout instance |
| `CScout Lens: Disconnect` | Clear all panels and disconnect |
| `CScout Lens: Refresh Analysis` | Re-fetch everything from CScout |
| `CScout Lens: Analyze Current File` | Jump to the active file in metrics panel |
| `CScout Lens: Map Function Calls` | Focus call graph on function at cursor |
| `CScout Lens: List Unused Symbols` | Dump unused identifiers to Output panel |
| `CScout Lens: Filter Identifiers` | Filter symbols by type, usage status |
| `CScout Lens: Filter Files` | Filter files by readonly/writable |
| `CScout Lens: Filter Functions` | Filter functions by defined/static |
| `CScout Lens: Show Call Graph` | Visual call graph for function at cursor |
| `CScout Lens: Show Full Call Graph` | Visual graph of all function calls |

---

## Configuration

```json
{
  "cscoutLens.host": "localhost",
  "cscoutLens.port": 8081,
  "cscoutLens.initialLoadPageSize": 500,
  "cscoutLens.initialLoadMaxIdentifiers": 5000,
  "cscoutLens.initialLoadMaxFiles": 3000,
  "cscoutLens.initialLoadMaxFunctions": 4000
}
```

---

## Development

### Running Tests

```bash
# Start mock server in one terminal
npm run server

# Run tests in another terminal
npm test
```

### Project Layout

```
src/
├── extension.ts           # Entry point, command registration
├── analyzer/
│   ├── client.ts          # HTTP client — raw TCP, JSON REST API
│   └── types.ts           # Shared interfaces
├── panels/
│   ├── workspacePanel.ts  # Project / file tree
│   ├── symbolPanel.ts     # Identifier browser by kind
│   ├── fileAnalysisPanel.ts # Per-file metrics tree
│   └── functionMapPanel.ts  # Call graph tree
├── handlers/
│   ├── hoverHandler.ts    # HoverProvider
│   ├── navigationHandler.ts # DefinitionProvider
│   └── analysisHandler.ts # Diagnostics
├── services/
│   └── cscoutServer.ts    # HTTP client wrapper with config
├── webview/
│   └── renderGraph.ts     # Interactive graph visualization
├── scripts/
│   └── mockServer.ts      # Development mock server
└── test/
    ├── cscoutDatabase.test.ts # Client tests
    └── mockServer.test.ts     # API endpoint tests
```

---

## REST API Endpoints

| Data | Endpoint |
|---|---|
| Project list | `GET /api/projects` |
| Set active project | `GET /api/setproj?projid=N` |
| Files | `GET /api/files?writable=1` |
| Identifiers | `GET /api/identifiers?unused=1` |
| Functions | `GET /api/functions?defined=1` |
| File metrics | `GET /api/filemetrics?id=FID` |
| Function callers | `GET /api/funlist?f=FID&n=u` |
| Function callees | `GET /api/funlist?f=FID&n=d` |
| Source matches | `GET /api/source?id=FID&ec=EID` |

---

## Contributing

This extension was enhanced as part of GSoC with features from:
- [sanki92/vscode-cscout](https://github.com/sanki92/vscode-cscout) - Testing infrastructure, services layer
- [Ayansh0209/cscout-vscode](https://github.com/Ayansh0209/cscout-vscode) - Filtering UI, graph visualization

Per mentor guidance, this implementation uses direct REST API queries rather than SQLite database dumps.
