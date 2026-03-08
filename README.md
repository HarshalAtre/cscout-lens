# cscout-lens

A VS Code extension that brings [CScout](https://www.spinellis.gr/cscout/)'s whole-program C analysis directly into the editor. No database exports, no mock servers. It talks to a live CScout process over HTTP.

---

## Background

CScout parses entire C workspaces multiple projects, preprocessor macros, cross-file identifier scopes and builds a precise semantic model that no single-file tool can match. Its existing interface is a built-in web server you navigate in a browser. This extension makes the same analysis available as first-class VS Code features.

The approach: CScout already exposes its data through HTML query pages. The extension scrapes those pages over a raw TCP connection (SWILL, CScout's embedded HTTP server, speaks HTTP/1.0 with bare newlines that Node's `http` module rejects) and maps the results to VS Code's provider APIs.

---

## DEMO

[![Extension Demo](https://img.youtube.com/vi/5rS2wp8-LJQ/0.jpg)](https://www.youtube.com/watch?v=5rS2wp8-LJQ)

## What's working in this POC

| Feature | Status |
|---|---|
| Project & file browser | ✅ |
| Identifier browser, grouped by kind | ✅ |
| Hover — kind, usage status from whole-program analysis | ✅ |
| Go-to-definition via equivalence classes | ✅ |
| Unused symbol diagnostics (Problems panel) | ✅ |
| Per-file metrics | ✅ |
| Call graph (callers / callees, cycle-safe) | ✅ |

---

## Requirements

- CScout built and runnable (see [CScout docs](https://www.spinellis.gr/cscout/doc/))
- Node.js >= 18, VS Code >= 1.85

**Windows:** CScout must be built under Cygwin. Add `C:\cygwin64\bin` to your PATH before running it from PowerShell.

**Linux / macOS:** CScout builds natively with a standard C++ toolchain. No extra setup needed beyond `make`.

The extension itself is pure TypeScript and runs without modification on all three platforms.

---

## Getting started

**1. Build the extension**

```bash
cd cscout-lens
npm install
npm run compile
```

**2. Run CScout on your C project**

On Windows (PowerShell, with Cygwin on PATH):

```powershell
cd C-scout\cscout\example
..\src\build\cscout.exe awk.cs
```

On Linux / macOS:

```bash
cd C-scout/cscout/example
../src/build/cscout awk.cs
```

CScout will print something like `Listening on port 8081`. Leave it running.

**3. Launch the extension**

Open the `cscout-lens` folder in VS Code. Open the Command Palette (`Ctrl+Shift+P`) and run **Debug: Start Debugging**. This opens a new Extension Development Host window.

**4. Connect**

In Extension Development Host window , Open the Command Palette (`Ctrl+Shift+P`) → **CScout Lens: Connect to Analyzer**

The sidebar will populate with your project's files, symbols, and functions.

---

## Commands

| Command | Description |
|---|---|
| `CScout Lens: Connect to Analyzer` | Connect to a running CScout instance |
| `CScout Lens: Disconnect` | Clear all panels and disconnect |
| `CScout Lens: Refresh Analysis` | Re-fetch everything from CScout |
| `CScout Lens: Analyze Current File` | Jump to the active file in the metrics panel |
| `CScout Lens: Map Function Calls` | Focus the call graph on the function at the cursor |
| `CScout Lens: List Unused Symbols` | Dump all unused identifiers to the Output panel |

---

## Configuration

```json
"cscoutLens.host": "localhost",   // CScout hostname
"cscoutLens.port": 8081           // CScout port
```

---

## How it works

CScout's web interface is a set of query pages (`xiquery.html`, `xfunquery.html`, `file.html`, etc.) that accept filter parameters and return HTML. The extension uses those same pages as an informal REST API:

| Data | CScout endpoint |
|---|---|
| Project list | `/sproject.html` |
| Files per project | `/xfilequery.html?ro=1&writable=1&match=Y&skip=-1` |
| All identifiers | `/xiquery.html?writable=1&match=Y&qi=1&skip=-1` |
| Identifiers by kind | `/xiquery.html?writable=1&match=L&a22=1&skip=-1` (functions: `a22`, macros: `a14`, typedefs: `a19`, tags: `a10`, members: `a11`) |
| Identifier locations | `/xiquery.html?ec=EID&qf=1` → then `/qsrc.html?id=FID&qt=id&ec=EID` |
| File metrics | `/file.html?id=FID` |
| Functions | `/xfunquery.html?writable=1&match=Y&qi=1&skip=-1` |
| Callers / callees | `/funlist.html?f=FID&n=u` / `&n=d` |

`skip=-1` disables CScout's built-in pagination (defaults to 20 per page).

On Windows, CScout (built under Cygwin) returns paths in Cygwin format (`/cygdrive/d/...`). The extension converts these to Windows paths automatically. On Linux/macOS, CScout returns native Unix paths and no conversion is needed.

---

## Project layout

```
src/
├── extension.ts                 # entry point, command registration
├── analyzer/
│   ├── client.ts                # HTTP client — raw TCP, HTML parsing
│   └── types.ts                 # shared interfaces
├── panels/
│   ├── workspacePanel.ts        # project / file tree
│   ├── symbolPanel.ts           # identifier browser by kind
│   ├── fileAnalysisPanel.ts     # per-file metrics tree
│   └── functionMapPanel.ts      # call graph tree, cycle detection
└── handlers/
    ├── hoverHandler.ts          # HoverProvider
    ├── navigationHandler.ts     # DefinitionProvider
    └── analysisHandler.ts       # diagnostics (unused symbols)
```

---

## Trying the features

Once connected, here is what you can explore:

**Workspace and symbols (sidebar)**
- Expand the CScout Lens sidebar. You will see three views: Projects/Files, Identifiers by Kind, and File Metrics.
- Under Identifiers, expand any category (Functions, Macros, Typedefs, etc.), then expand a symbol name. You will see occurrence nodes like `awk.c:80:0`. Click one and it opens the file at that exact line.
- Identifiers marked "unused" appear with a warning icon. These same symbols also show up in the Problems panel (`Ctrl+Shift+M`) as diagnostics. Clicking a problem there jumps directly to the declaration.

**Hover and go-to-definition**
- Open any `.c` file from the analyzed workspace. Hover over a function name or identifier to see the kind (function / macro / typedef / etc.) and whether it is unused according to whole-program analysis.
- `F12` (Go to Definition) on any identifier navigates to its first definition site.

**File metrics**
- Open a `.c` file and run `CScout Lens: Analyze Current File` from the Command Palette. The file moves to the top of the File Metrics panel and its metrics (lines, complexity, etc.) are shown.

**Call graph**
- Place the cursor on a function name in a `.c` file, then run `CScout Lens: Map Function Calls`. The Function Map panel shows callers and callees of that function. Expand either group and click a function name to jump to it.

---

## What remains for GSoC

This POC covers the full extension side against CScout's existing HTML interface. No changes to the CScout C++ source were needed. The actual GSoC work splits into two halves.

**CScout side (C++ changes)**

To expose internal data structures through a proper REST interface, the same way the current web interface already works. That means adding SWILL endpoints that return structured data instead of HTML pages:

- Add JSON-returning endpoints for identifiers, files, functions, and metrics
- Add a dry-run mode to `file_refactor()` so rename operations return a diff instead of writing to disk directly

**Extension side**

- Replace the HTML parsing in `client.ts` with clean JSON responses once the REST layer exists
- Refactoring preview shown as a VS Code diff editor
- `CodeLens` annotations showing call count and cyclomatic complexity inline in the editor
- Interactive call graph as a WebView panel with expand/collapse, not just a static tree
