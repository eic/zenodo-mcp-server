# Quick Start

## Prerequisites

- Node.js 18 or later
- npm

## Installation

```bash
git clone https://github.com/eic/zenodo-mcp-server.git
cd zenodo-mcp-server
npm install
npm run build
```

## Running the Server

```bash
# Without authentication (public records only)
node build/src/index.js

# With a persistent API key (service account)
ZENODO_API_KEY=your_token node build/src/index.js

# Against the Zenodo sandbox
ZENODO_BASE_URL=https://sandbox.zenodo.org ZENODO_API_KEY=your_sandbox_token node build/src/index.js
```
