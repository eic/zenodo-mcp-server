# Test Suite

Integration tests for the Zenodo MCP Server, using Node's built-in test runner.

## Running Tests

```bash
npm test                  # Build + run all tests
npm run test:coverage     # Build + run with c8 coverage report
npm run coverage          # Alias for test:coverage
```

Coverage output is written to `coverage/`. Open `coverage/index.html` in a browser for the full HTML report.

## Test File

| File | Description |
|------|-------------|
| `zenodo.test.ts` | Integration tests — spins up the MCP server as a subprocess via `StdioClientTransport` and exercises all 7 tools through the MCP protocol |

## Test Structure

```
Zenodo MCP Server Integration Tests
├── Server Initialization
│   ├── should connect to the MCP server
│   └── should list available tools
├── Authentication
│   ├── should return auth status without API key
│   └── should reject empty API key
├── Record Search
│   ├── should search for public records without authentication
│   ├── should support pagination
│   ├── should filter by resource type
│   └── should handle queries with no results gracefully
├── Record Details
│   ├── should get details of a known public record
│   ├── should support DOI-style record IDs
│   └── should return an error for non-existent record
├── File Listing
│   └── should list files for a known record
└── Error Handling
    ├── should return isError for invalid API key
    ├── should reject zero or negative max_bytes for get_file_content
    ├── should reject non-integer max_bytes for get_file_content
    ├── should require api_key parameter for set_api_key
    ├── should require id parameter for get_record
    ├── should require authentication for list_depositions
    └── should handle unknown tool gracefully
```

## Network-Dependent Tests

Several tests call the live Zenodo API (`https://zenodo.org`). These tests include graceful skip guards — if Zenodo is unreachable they print a notice and return without failing. All input-validation and error-handling tests run entirely offline.

To run against the Zenodo sandbox:

```bash
ZENODO_BASE_URL=https://sandbox.zenodo.org npm test
```

To run with an API key (exercises authenticated paths):

```bash
ZENODO_API_KEY=your_token npm test
```

## CI Integration

Tests run automatically on GitHub Actions (`.github/workflows/test.yml`) on every push and pull request that touches `src/`, `test/`, `package*.json`, or `tsconfig.json`. Coverage is uploaded as a workflow artifact and a summary table is written to the job summary via `scripts/test-summary.js`.

## Adding New Tests

1. Add a `describe` block to `test/zenodo.test.ts` (or a new `it` inside an existing one)
2. Follow the graceful-skip pattern for network-dependent assertions:
   ```typescript
   if (result.isError || result.content[0].text.startsWith('Error:')) {
     console.error('  ⊘ Skipping: not reachable in this environment');
     return;
   }
   ```
3. For purely offline assertions (input validation, error responses), no skip guard is needed
4. Run `npm test` locally to verify before pushing
