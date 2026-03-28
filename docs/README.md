# Zenodo MCP Server

An MCP server that allows LLM agents to query and interact with [Zenodo](https://zenodo.org) repositories using the [Zenodo REST API](https://developers.zenodo.org).

## Features

- **Unauthenticated access** – search and inspect public records without an API key
- **Session API key** – supply a personal access token at runtime via the `set_api_key` tool
- **Persistent service account** – set `ZENODO_API_KEY` environment variable for a long-lived key
- Search records with full Elasticsearch query syntax, pagination, and filtering
- Retrieve record metadata, files, and file content (text or binary)
- List your own depositions (drafts and published, requires authentication)
- Configurable Zenodo base URL for sandbox or self-hosted instances

## Repository

Source code is available at [github.com/eic/zenodo-mcp-server](https://github.com/eic/zenodo-mcp-server).
