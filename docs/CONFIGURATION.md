# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENODO_BASE_URL` | `https://zenodo.org` | Base URL of the Zenodo instance |
| `ZENODO_API_KEY` | *(none)* | Personal access token for persistent authentication |
| `ZENODO_ALLOW_WRITE` | *(unset)* | Set to `true` or `1` to enable write tools (depositions) |
| `ZENODO_COMMUNITY` | *(none)* | Default community identifier applied to searches when `communities` is not supplied by the caller |
| `ZENODO_MAX_UPLOAD_BYTES` | `52428800` (50 MiB) | Maximum file size for the `upload_file` tool |

### `ZENODO_ALLOW_WRITE`

Write tools (`create_deposition`, `update_deposition`, `upload_file`, `publish_deposition`, etc.) are disabled by default to prevent accidental modifications. To enable them:

```bash
ZENODO_ALLOW_WRITE=true node build/src/index.js
```

> **Warning:** Enabling write access allows an AI agent to create, update, and publish Zenodo records on your behalf. Only enable this when using a trusted agent and a token with appropriate scopes (`deposit:write`, `deposit:actions`).

### `ZENODO_COMMUNITY`

Set a default Zenodo community identifier to narrow all searches automatically:

```bash
ZENODO_COMMUNITY=eic node build/src/index.js
```

The caller can always override this by passing `communities` explicitly to `search_records`.

### `ZENODO_MAX_UPLOAD_BYTES`

Controls the maximum upload size accepted by the `upload_file` tool (default 50 MiB):

```bash
ZENODO_MAX_UPLOAD_BYTES=104857600 node build/src/index.js   # 100 MiB
```

## Zenodo Sandbox

To use the Zenodo sandbox for testing:

```bash
export ZENODO_BASE_URL=https://sandbox.zenodo.org
export ZENODO_API_KEY=your_sandbox_token
node build/src/index.js
```

The sandbox is a separate environment with its own records and tokens. Sandbox tokens do not work on the production instance and vice versa.
