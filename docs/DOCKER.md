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

### Automatic Updates with Watchtower

[Watchtower](https://containrrr.dev/watchtower/) keeps the `zenodo-mcp-server` container up to date without any manual intervention. When a new image is pushed to `ghcr.io/eic/zenodo-mcp-server`, Watchtower:

1. Pulls the new image
2. Gracefully stops the running container
3. Starts a fresh container with the same configuration
4. Removes the old image (via `--cleanup`)

Watchtower is **disabled by default** (via a Compose profile). To enable it:

```bash
docker compose --profile watchtower up -d
```

This starts two containers:

- **`zenodo-mcp-server`** — the MCP server itself
- **`zenodo-mcp-server-watchtower`** — Watchtower, which polls `ghcr.io` once per hour and automatically pulls and restarts `zenodo-mcp-server` whenever a new image is published

> **Security note:** Watchtower requires access to the Docker daemon socket
> (`/var/run/docker.sock`), which grants it full control over the host Docker
> daemon. In shared or multi-tenant environments, consider whether this
> privilege is acceptable before enabling the `watchtower` profile.

> **Note for local development:** `docker-compose.yml` includes `build: .` for
> `zenodo-mcp-server`. If you run a locally built image with Watchtower enabled,
> Watchtower may later replace it with the published `ghcr.io/eic/zenodo-mcp-server:latest`
> image. To develop and test local changes without Watchtower updating the container,
> omit the `--profile watchtower` flag (or run just the server service):
>
> ```bash
> docker compose up zenodo-mcp-server
> ```

The default poll interval is **1 hour**. Override it in your `.env` file:

```bash
# Check for updates every 30 minutes
WATCHTOWER_POLL_INTERVAL=1800
```

To stop Watchtower independently:

```bash
docker compose stop watchtower
```

To trigger an immediate update check:

```bash
docker compose pull zenodo-mcp-server && docker compose up -d zenodo-mcp-server
```

## Building Locally

```bash
docker build -t zenodo-mcp-server .
```

Multi-platform build (push to registry):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/eic/zenodo-mcp-server:latest --push .
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
