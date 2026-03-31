# CScout Lens - Simple Architecture

## Architecture

```mermaid
graph LR
    A["VS Code Extension"] -->|HTTP Requests| B["CScout Server<br/>Port 8081"]
    A -->|HTTP Requests| C["Mock Server<br/>Port 8081"]
    B -->|JSON Response| A
    C -->|JSON Response| A
    A -->|Display| D["UI Panels<br/>Trees & Graphs"]
```

## Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant VSCode as VS Code<br/>Extension
    participant Services as Services<br/>Fetch Layer
    participant CScout as CScout Server

    User->>VSCode: Open Sidebar / Expand Node
    VSCode->>Services: Request data<br/>(identifiers/files/functions)
    Services->>CScout: HTTP GET<br/>(JSON endpoint)
    CScout-->>Services: JSON response
    Services-->>VSCode: Parsed data
    VSCode->>VSCode: Cache data in memory
    VSCode-->>User: Render Tree View
```

## CScout Process Architecture

```mermaid
graph TB
    subgraph CScout["CScout Server Process"]
        A["Run cscout"]
        B["In-Memory<br/>Analysis"]
        C["REST API<br/>Layer"]
        D["HTTP Server<br/>Port 8081"]
        A --> B
        B --> C
        C --> D
    end

    subgraph Extension["VS Code Extension"]
        E["UI<br/>Tree View"]
        F["In-Memory<br/>Cache"]
        G["Services<br/>Fetch Layer"]
        H["Providers<br/>Data"]
        
        E --> H
        H --> F
        F ---|Cache Hit| H
        F ---|Cache Miss| G
    end

    D -->|HTTP GET| G
    G -->|JSON| F
```

## Data Model

```mermaid
graph LR
    A["CScout Server<br/>C Code Analysis"] -->|REST API| B["JSON Data<br/>Projects/Files/Functions"]
    B -->|Parse| C["Extension<br/>Client Objects"]
    C -->|Display| D["Tree Views<br/>& Graphs"]
```

## Key Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| GET /api/projects | Get project info |
| GET /api/files | Get all files |
| GET /api/functions | Get all functions |
| GET /api/identifiers | Get all symbols |
| GET /api/funlist?f=FID | Get callers/callees |
| GET /api/filemetrics?id=N | Get file metrics |


