# Zenodo MCP Server

An MCP server that allows LLM agents to query and interact with [Zenodo](https://zenodo.org) repositories using the [Zenodo REST API](https://developers.zenodo.org).

## Features

- **Unauthenticated access** – search and inspect public records without an API key
- **Session API key** – supply a personal access token at runtime via the `set_api_key` tool
- **Persistent service account** – set `ZENODO_API_KEY` environment variable for a long-lived key
- **Optional write access** – create, update, and publish depositions (requires both an API key **and** `ZENODO_ALLOW_WRITE=true`)
- Search records with full Elasticsearch query syntax, pagination, and filtering
- Browse and filter Zenodo communities (`get_community`, `list_communities`)
- Retrieve record metadata, files, and file content (text or binary)
- List depositions (requires authentication); create, update, publish, and version depositions (requires authentication **and** `ZENODO_ALLOW_WRITE=true`)
- Configurable Zenodo base URL for sandbox or self-hosted instances
- Optional default community filter via `ZENODO_COMMUNITY`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENODO_BASE_URL` | `https://zenodo.org` | Base URL of the Zenodo instance |
| `ZENODO_API_KEY` | *(none)* | Personal access token for persistent authentication |
| `ZENODO_ALLOW_WRITE` | *(unset)* | Set to `true` or `1` to enable write tools (depositions) |
| `ZENODO_COMMUNITY` | *(none)* | Default community identifier applied to searches |
| `ZENODO_MAX_UPLOAD_BYTES` | `52428800` (50 MiB) | Maximum file size for the `upload_file` tool |

## Repository

Source code is available at [github.com/eic/zenodo-mcp-server](https://github.com/eic/zenodo-mcp-server).
