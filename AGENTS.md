# AI Agent Instructions for Zenodo MCP Server

This document provides guidance for AI agents (GitHub Copilot, Claude, ChatGPT, etc.) working on this repository.

## Project Overview

**Zenodo MCP Server** — A Model Context Protocol server that gives LLM agents access to [Zenodo](https://zenodo.org), the open-access research data repository operated by CERN.

- **Language**: TypeScript (Node.js, ESM)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Purpose**: Search records, retrieve metadata and files, and manage depositions via the Zenodo REST API
- **Target**: Open-science workflows, research data management, scientific computing

## Architecture

```
src/
├── index.ts      # MCP server entry point, tool definitions and handlers
└── zenodo.ts     # ZenodoClient class, API calls, type definitions

test/
└── zenodo.test.ts  # Integration tests (uses Node built-in test runner)

build/            # Compiled JavaScript (generated — do not edit)
docs/             # Docsify documentation site
```

## Key Principles

### 1. Authentication Handling
- The server works **unauthenticated** for public records — never require a key
- Session keys set via `set_api_key` are stored in memory only; never persisted to disk or logged
- `ZENODO_API_KEY` env var is the service-account / CI path
- Always check `isError: true` on responses that require auth but have no key

### 2. Zenodo API Conventions
- Base URL is configurable (`ZENODO_BASE_URL`, default `https://zenodo.org`) to support the sandbox (`https://sandbox.zenodo.org`) and self-hosted instances
- All API calls go through `ZenodoClient` in `src/zenodo.ts` — never call `fetch` directly from `index.ts`
- Pass `Authorization: Bearer <key>` header only when a key is available
- The Zenodo REST API uses:
  - `GET /api/records` — search
  - `GET /api/records/:id` — single record (also resolves DOIs)
  - `GET /api/records/:id/files` — file list
  - `GET /api/deposit/depositions` — authenticated deposition list

### 3. MCP Protocol Standards
- **Tool schemas**: Define clear JSON schemas for all input parameters
- **Response format**: Return `{ content: [{ type: 'text', text: JSON.stringify(..., null, 2) }] }`
- **Error responses**: Use `{ content: [...], isError: true }` — never throw unhandled errors out of tool handlers
- **Capabilities**: Only declare `tools` (no resources/prompts currently)

### 4. TypeScript Best Practices
- Strict mode is enabled — all types must be explicit
- Use interfaces for Zenodo API response shapes (defined in `src/zenodo.ts`)
- ESM modules with `.js` extensions on imports
- Node 18+ target; `"module": "Node16"` in tsconfig

## Build & Test

```bash
npm run build          # Compile TypeScript → build/
npm run watch          # Watch mode
npm test               # Build + run integration tests
npm run test:coverage  # Tests with c8 coverage report
```

Tests use Node's built-in test runner (`node --test`) against the compiled output in `build/test/`.

## Common Tasks

### Adding a New Tool

1. **Add types** (if needed) in `src/zenodo.ts`:
```typescript
export interface NewResult {
  // define fields
}
```

2. **Implement the method** on `ZenodoClient`:
```typescript
async newOperation(param: string): Promise<NewResult> {
  const url = `${this.baseUrl}/api/endpoint?q=${encodeURIComponent(param)}`;
  const res = await this.fetch(url);
  if (!res.ok) throw new Error(`Zenodo API error: ${res.status}`);
  return res.json() as Promise<NewResult>;
}
```

3. **Add the tool definition** to the `tools` array in `src/index.ts`:
```typescript
{
  name: 'new_operation',
  description: 'Clear, LLM-friendly description of what this does.',
  inputSchema: {
    type: 'object',
    properties: {
      param: {
        type: 'string',
        description: 'Description of this parameter.',
      },
    },
    required: ['param'],
  },
},
```

4. **Add the handler** in the `CallToolRequestSchema` switch in `src/index.ts`:
```typescript
case 'new_operation': {
  const param = String(args.param ?? '');
  const result = await zenodoClient.newOperation(param);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
```

5. **Update docs**: Add the tool to the table in `docs/TOOLS.md` and `README.md`.

### Error Handling Pattern

```typescript
// ✅ GOOD: descriptive, wrapped, isError set
try {
  const result = await zenodoClient.someOperation(id);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
} catch (error: any) {
  return {
    content: [{ type: 'text', text: `Error: ${error.message}` }],
    isError: true,
  };
}

// ❌ BAD: unhandled, crashes the server process
const result = await zenodoClient.someOperation(id);
```

### Working with Zenodo Record IDs

Zenodo accepts both numeric IDs and DOIs interchangeably in `get_record`. The client resolves DOIs by hitting `https://zenodo.org/api/records/<id>` where `<id>` can be:
- A plain integer: `1234567`
- A DOI: `10.5281/zenodo.1234567` (URL-encoded when passed as query param)

```typescript
// Normalize: strip DOI prefix if present
const numericId = id.replace(/^10\.5281\/zenodo\./, '');
```

### Sandbox vs Production

The Zenodo sandbox (`https://sandbox.zenodo.org`) is a separate environment:
- Has its own records, tokens, and depositions
- Sandbox tokens do **not** work on production and vice versa
- Useful for testing deposition workflows without polluting production

## Naming Conventions

| Concept | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `ZenodoClient` |
| Methods | camelCase | `searchRecords` |
| Interfaces | PascalCase | `ZenodoRecord` |
| Tool names | snake_case | `search_records` |
| Env vars | UPPER_SNAKE_CASE | `ZENODO_API_KEY` |
| MCP errors | `isError: true` | see handler pattern above |

## Tool Reference

| Tool | Auth required | Description |
|------|:---:|---------|
| `get_auth_status` | No | Current auth state and setup guidance |
| `set_api_key` | No | Store a personal access token in-session |
| `search_records` | No | Elasticsearch query across public records |
| `get_record` | No | Full metadata for a record by ID or DOI |
| `list_record_files` | No | Files attached to a record |
| `get_file_content` | No | Download file content (text or base64) |
| `list_depositions` | **Yes** | Your own depositions (drafts + published) |

## Configuration

### Environment Variables

```bash
ZENODO_BASE_URL="https://zenodo.org"   # optional, default shown
ZENODO_API_KEY="your_token_here"       # optional; unauthenticated if absent
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "zenodo": {
      "command": "node",
      "args": ["/path/to/zenodo-mcp-server/build/src/index.js"],
      "env": {
        "ZENODO_API_KEY": "your_token_here"
      }
    }
  }
}
```

### Docker

```bash
docker run -i --rm \
  -e ZENODO_API_KEY=your_token \
  ghcr.io/eic/zenodo-mcp-server:latest
```

See [docs/DOCKER.md](docs/DOCKER.md) for full Docker and docker-compose instructions.

## Debugging Tips

### Common Issues

1. **401 Unauthorized** — API key is missing or invalid; call `get_auth_status` to check state.
2. **404 on a record** — Record may be embargoed, private, or the ID/DOI is wrong.
3. **File content truncated** — Increase `max_bytes` argument; binary files are base64-encoded.
4. **`list_depositions` returns empty** — Correct token scope required: `deposit:write`.
5. **Sandbox token on production** — Tokens are environment-specific; use the matching base URL.

### Manual API Testing

```bash
# Search records
curl "https://zenodo.org/api/records?q=electron+ion+collider&size=5"

# Get a record by ID
curl "https://zenodo.org/api/records/1234567"

# Authenticated: list depositions
curl -H "Authorization: Bearer $ZENODO_API_KEY" \
  "https://zenodo.org/api/deposit/depositions"
```

## Future Development

### Potential Features
1. **Create/update depositions** — `deposit:write` scope, POST/PUT to `/api/deposit/depositions`
2. **Upload files** — multipart upload to deposition file bucket
3. **Publish depositions** — POST to `/api/deposit/depositions/:id/actions/publish`
4. **Community search** — filter records by Zenodo community identifier
5. **Versioning support** — navigate record versions via `conceptrecid`

### Extension Points
- Add new search filters as optional parameters to `search_records`
- Implement deposition mutation tools gated behind `deposit:write` scope check
- Add a `get_community` tool for community metadata

## Resources

- **MCP Specification**: https://modelcontextprotocol.io/
- **Zenodo REST API**: https://developers.zenodo.org/
- **Zenodo Sandbox**: https://sandbox.zenodo.org/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

## Version History

- **v0.1.0** (2025): Initial release with 7 tools
  - Authentication management (2 tools)
  - Record search and retrieval (4 tools)
  - Deposition listing (1 tool)

---

*Keep this document up-to-date when adding tools, changing architecture, or discovering new best practices.*
