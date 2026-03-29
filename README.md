# zenodo-mcp-server

An MCP server that allows LLM agents to query and interact with [Zenodo](https://zenodo.org) repositories using the [Zenodo REST API](https://developers.zenodo.org).

## Features

- **Unauthenticated access** – search and inspect public records without an API key
- **Session API key** – supply a personal access token at runtime via the `set_api_key` tool
- **Persistent service account** – set `ZENODO_API_KEY` environment variable for a long-lived key
- **Optional write access** – create, update, and publish depositions (enabled via `ZENODO_ALLOW_WRITE=true`)
- Search records with full Elasticsearch query syntax, pagination, and filtering
- Browse and filter Zenodo communities
- Retrieve record metadata, files, and file content (text or binary)
- List, create, update, publish, and version depositions (write tools require `ZENODO_ALLOW_WRITE=true`)
- Configurable Zenodo base URL for sandbox or self-hosted instances
- Optional default community filter via `ZENODO_COMMUNITY`

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
git clone https://github.com/eic/zenodo-mcp-server.git
cd zenodo-mcp-server
npm install
npm run build
```

### Running the server

```bash
# Without authentication (public records only)
node build/src/index.js

# With a persistent API key (service account)
ZENODO_API_KEY=your_token node build/src/index.js

# Against the Zenodo sandbox
ZENODO_BASE_URL=https://sandbox.zenodo.org ZENODO_API_KEY=your_sandbox_token node build/src/index.js
```

## Authentication

Zenodo uses [personal access tokens](https://zenodo.org/account/settings/applications/tokens/new/) for authentication.

### Option 1 – Session key (recommended for interactive use)

After connecting to the server, call the `set_api_key` tool:

```json
{ "name": "set_api_key", "arguments": { "api_key": "your_personal_access_token" } }
```

The token is stored in memory for the lifetime of the server process and is never written to disk.

### Option 2 – Environment variable (service account / CI)

```bash
export ZENODO_API_KEY=your_personal_access_token
node build/src/index.js
```

### Creating a token

1. Log in to [zenodo.org](https://zenodo.org)
2. Go to **Account → Settings → Applications → Personal access tokens**
3. Click **New token** and select the required scopes:
   - `deposit:write` – create and update depositions
   - `deposit:actions` – publish depositions
   - `user:email` – verify identity (optional)
4. Save the token securely – it is shown only once

## Available Tools

| Tool | Description | Auth required | Write required |
|------|-------------|:-------------:|:--------------:|
| `get_auth_status` | Check authentication status and get setup guidance | No | No |
| `set_api_key` | Set a personal access token for the current session | No | No |
| `search_records` | Search Zenodo records with Elasticsearch query syntax | No | No |
| `get_community` | Get details about a specific Zenodo community | No | No |
| `list_communities` | Search or list Zenodo communities | No | No |
| `get_record` | Get full metadata for a record by ID or DOI | No | No |
| `list_record_files` | List files attached to a record | No | No |
| `get_file_content` | Download file content (text or base64) | No | No |
| `list_depositions` | List your own depositions (drafts + published) | **Yes** | No |
| `create_deposition` | Create a new empty deposition (draft) | **Yes** | **Yes** |
| `get_deposition` | Retrieve a single deposition by ID | **Yes** | **Yes** |
| `update_deposition` | Update metadata of a draft deposition | **Yes** | **Yes** |
| `delete_deposition` | Delete an unpublished draft deposition | **Yes** | **Yes** |
| `upload_file` | Upload a file to a deposition | **Yes** | **Yes** |
| `delete_deposition_file` | Delete a file from an unpublished deposition | **Yes** | **Yes** |
| `publish_deposition` | Publish a deposition and register a DOI | **Yes** | **Yes** |
| `edit_deposition` | Unlock a published deposition for metadata edits | **Yes** | **Yes** |
| `discard_deposition` | Discard edits and revert to published state | **Yes** | **Yes** |
| `new_version` | Create a new version of a published deposition | **Yes** | **Yes** |

> Write tools are only available when `ZENODO_ALLOW_WRITE=true` (or `ZENODO_ALLOW_WRITE=1`) is set. See [docs/TOOLS.md](docs/TOOLS.md) for full parameter details.

### `search_records`

```json
{
  "name": "search_records",
  "arguments": {
    "query": "electron ion collider",
    "size": 10,
    "page": 1,
    "sort": "mostrecent",
    "type": "dataset",
    "communities": "zenodo",
    "all_versions": false
  }
}
```

Sort options: `bestmatch`, `mostrecent`, `mostviewed`, `mostdownloaded` (prefix `-` for descending).

Resource types: `publication`, `poster`, `presentation`, `dataset`, `image`, `video`, `software`, `lesson`, `other`.

### `get_record`

Accepts a numeric ID or a DOI:

```json
{ "name": "get_record", "arguments": { "id": "1234567" } }
{ "name": "get_record", "arguments": { "id": "10.5281/zenodo.1234567" } }
```

### `get_file_content`

```json
{
  "name": "get_file_content",
  "arguments": {
    "id": "1234567",
    "filename": "data.csv",
    "max_bytes": 1048576
  }
}
```

Text files are returned as UTF-8 strings. Binary files are returned as base64. The `truncated` field indicates whether the file was cut at `max_bytes`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENODO_BASE_URL` | `https://zenodo.org` | Base URL of the Zenodo instance |
| `ZENODO_API_KEY` | *(none)* | Personal access token for persistent authentication |
| `ZENODO_ALLOW_WRITE` | *(unset)* | Set to `true` or `1` to enable write tools (depositions) |
| `ZENODO_COMMUNITY` | *(none)* | Default community identifier applied to searches |
| `ZENODO_MAX_UPLOAD_BYTES` | `52428800` (50 MiB) | Maximum file size for `upload_file` |

## MCP Client Configuration

Add the server to your MCP client configuration (e.g. Claude Desktop `claude_desktop_config.json`):

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

## Development

```bash
npm run build        # Compile TypeScript
npm run watch        # Watch mode
npm test             # Build and run tests
npm run test:coverage  # Tests with coverage report
```

## License

MIT
