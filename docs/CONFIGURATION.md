# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENODO_BASE_URL` | `https://zenodo.org` | Base URL of the Zenodo instance |
| `ZENODO_API_KEY` | *(none)* | Personal access token for persistent authentication |

## Zenodo Sandbox

To use the Zenodo sandbox for testing:

```bash
export ZENODO_BASE_URL=https://sandbox.zenodo.org
export ZENODO_API_KEY=your_sandbox_token
node build/src/index.js
```

The sandbox is a separate environment with its own records and tokens. Sandbox tokens do not work on the production instance and vice versa.
