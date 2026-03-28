# Authentication

Zenodo uses [personal access tokens](https://zenodo.org/account/settings/applications/tokens/new/) for authentication.

## Creating a Token

1. Log in to [zenodo.org](https://zenodo.org)
2. Go to **Account → Settings → Applications → Personal access tokens**
3. Click **New token** and select the required scopes:
   - `deposit:write` – create and update depositions
   - `deposit:actions` – publish depositions
   - `user:email` – verify identity (optional)
4. Save the token securely – it is shown only once

## Option 1 – Session Key (recommended for interactive use)

After connecting to the server, call the `set_api_key` tool:

```json
{ "name": "set_api_key", "arguments": { "api_key": "your_personal_access_token" } }
```

The token is stored in memory for the lifetime of the server process and is never written to disk.

## Option 2 – Environment Variable (service account / CI)

```bash
export ZENODO_API_KEY=your_personal_access_token
node build/src/index.js
```
