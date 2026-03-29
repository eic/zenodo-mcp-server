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
- **Error responses**: Prefer `{ content: [...], isError: true }` for tool failures so errors are returned as MCP responses; avoid throwing from handlers except for programming/validation errors handled by the server infrastructure
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
  // buildUrl() constructs the full URL with query params; request<T>() handles auth headers and error checking
  const url = this.buildUrl('/api/endpoint', { q: param });
  return this.request<NewResult>(url);
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
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

// ❌ BAD: unhandled, crashes the server process
const result = await zenodoClient.someOperation(id);
```

### Working with Zenodo Record IDs

The `get_record` handler accepts both numeric IDs and DOI-style IDs as input, but it normalizes DOI-style values to their numeric record ID before calling `ZenodoClient.getRecord()`. For example, an input ID can be:
- A plain integer: `1234567`
- A DOI-style ID: `10.5281/zenodo.1234567` (normalized to `1234567` before the API call)

```typescript
// In the get_record handler (src/index.ts), before calling ZenodoClient.getRecord():
// Normalize DOI-style IDs to a plain numeric record ID before calling Zenodo
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

| Tool | Auth required | Write required | Description |
|------|:---:|:---:|---------|
| `get_auth_status` | No | No | Current auth state and setup guidance |
| `set_api_key` | No | No | Store a personal access token in-session |
| `search_records` | No | No | Elasticsearch query across public records |
| `get_community` | No | No | Details about a specific community by ID |
| `list_communities` | No | No | Search or list Zenodo communities |
| `get_record` | No | No | Full metadata for a record by ID or DOI |
| `list_record_files` | No | No | Files attached to a record |
| `get_file_content` | No | No | Download file content (text or base64) |
| `list_depositions` | **Yes** | No | Your own depositions (drafts + published) |
| `create_deposition` | **Yes** | **Yes** | Create a new draft deposition |
| `get_deposition` | **Yes** | No | Retrieve a deposition by ID |
| `update_deposition` | **Yes** | **Yes** | Update metadata of a draft deposition |
| `delete_deposition` | **Yes** | **Yes** | Delete an unpublished draft |
| `upload_file` | **Yes** | **Yes** | Upload a file to a deposition bucket |
| `delete_deposition_file` | **Yes** | **Yes** | Delete a file from an unpublished deposition |
| `publish_deposition` | **Yes** | **Yes** | Publish a deposition and register a DOI |
| `edit_deposition` | **Yes** | **Yes** | Unlock a published deposition for metadata edits |
| `discard_deposition` | **Yes** | **Yes** | Discard edits and revert to published state |
| `new_version` | **Yes** | **Yes** | Create a new version of a published deposition |

Write tools are only registered when `ZENODO_ALLOW_WRITE=true` (or `1`).

## Configuration

### Environment Variables

```bash
ZENODO_BASE_URL="https://zenodo.org"   # optional, default shown
ZENODO_API_KEY="your_token_here"       # optional; unauthenticated if absent
ZENODO_ALLOW_WRITE="true"             # optional; enables write tools when set to true or 1
ZENODO_COMMUNITY="eic"                # optional; default community for searches
ZENODO_MAX_UPLOAD_BYTES="52428800"    # optional; max upload size in bytes (default 50 MiB)
```

### MCP Client Configuration

**Claude Desktop** — add to `claude_desktop_config.json`:

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

**VS Code / GitHub Copilot** — add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "zenodo": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/zenodo-mcp-server/build/src/index.js"],
      "env": {
        "ZENODO_API_KEY": "your_token_here"
      }
    }
  }
}
```

See [docs/MCP_CLIENT.md](docs/MCP_CLIENT.md) for additional client setup instructions.

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
1. **Community search** — additional filter parameters for `list_communities`
2. **Versioning navigation** — navigate record versions via `conceptrecid`

### Extension Points
- Add new search filters as optional parameters to `search_records`
- Document and extend resource-type subtype filters for `search_records` (e.g., supported subtype values)

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
- **Post-v0.1.0 additions**:
  - Community tools: `get_community`, `list_communities`
  - Write tools (requires `ZENODO_ALLOW_WRITE=true`): `create_deposition`, `update_deposition`, `delete_deposition`, `upload_file`, `delete_deposition_file`, `publish_deposition`, `edit_deposition`, `discard_deposition`, `new_version`
  - New env vars: `ZENODO_ALLOW_WRITE`, `ZENODO_COMMUNITY`, `ZENODO_MAX_UPLOAD_BYTES`
  - `search_records` gained `bounds`, `subtype`, and `all_versions` parameters; default `communities` from `ZENODO_COMMUNITY`

---

*Keep this document up-to-date when adding tools, changing architecture, or discovering new best practices.*
