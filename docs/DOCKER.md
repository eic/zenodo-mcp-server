# Docker Usage

## Quick Start

```bash
docker run -i --rm \
  -e ZENODO_API_KEY=your_token \
  ghcr.io/eic/zenodo-mcp-server:latest
```

Omit `ZENODO_API_KEY` for unauthenticated access to public records.

## MCP Client Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "zenodo": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ZENODO_API_KEY=your_token",
        "ghcr.io/eic/zenodo-mcp-server:latest"
      ]
    }
  }
}
```

### VS Code (GitHub Copilot)

```json
{
  "servers": {
    "zenodo": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ZENODO_API_KEY=your_token",
        "ghcr.io/eic/zenodo-mcp-server:latest"
      ]
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENODO_BASE_URL` | `https://zenodo.org` | Base URL (use `https://sandbox.zenodo.org` for testing) |
| `ZENODO_API_KEY` | *(none)* | Personal access token |

## Docker Compose

Create a `.env` file:

```bash
ZENODO_API_KEY=your_token
# ZENODO_BASE_URL=https://sandbox.zenodo.org  # uncomment for sandbox
```

Then run:

```bash
docker compose up
```

## Building Locally

```bash
docker build -t zenodo-mcp-server .
```

Multi-platform build (push to registry):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t zenodo-mcp-server --push .
```

## Image Tags

Images are published to `ghcr.io/eic/zenodo-mcp-server`:

| Tag | Description |
|-----|-------------|
| `latest` | Latest build from `main` |
| `edge` | Development edge build |
| `v1.0.0` | Specific release version |
| `1.0`, `1` | Minor/major version aliases |

## Troubleshooting

**Container exits immediately** — MCP servers communicate over stdin/stdout; always pass `-i`:

```bash
docker run -i --rm ghcr.io/eic/zenodo-mcp-server:latest
```
