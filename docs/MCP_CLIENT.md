# MCP Client Setup

Add the server to your MCP client configuration.

## Claude Desktop

Edit `claude_desktop_config.json`:

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

## VS Code (GitHub Copilot)

Edit `.vscode/mcp.json` in your workspace:

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
