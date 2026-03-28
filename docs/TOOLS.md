# Available Tools

| Tool | Description | Auth required |
|------|-------------|:-------------:|
| `get_auth_status` | Check authentication status and get setup guidance | No |
| `set_api_key` | Set a personal access token for the current session | No |
| `search_records` | Search Zenodo records with Elasticsearch query syntax | No |
| `get_record` | Get full metadata for a record by ID or DOI | No |
| `list_record_files` | List files attached to a record | No |
| `get_file_content` | Download file content (text or base64) | No |
| `list_depositions` | List your own depositions (drafts + published) | **Yes** |

## `search_records`

Search Zenodo records with full Elasticsearch query syntax.

```json
{
  "name": "search_records",
  "arguments": {
    "query": "electron ion collider",
    "size": 10,
    "page": 1,
    "sort": "mostrecent",
    "type": "dataset",
    "communities": "zenodo",
    "all_versions": false
  }
}
```

**Sort options:** `bestmatch`, `mostrecent`, `mostviewed`, `mostdownloaded` (prefix `-` for descending).

**Resource types:** `publication`, `poster`, `presentation`, `dataset`, `image`, `video`, `software`, `lesson`, `other`.

## `get_record`

Accepts a numeric ID or a DOI:

```json
{ "name": "get_record", "arguments": { "id": "1234567" } }
{ "name": "get_record", "arguments": { "id": "10.5281/zenodo.1234567" } }
```

## `get_file_content`

Download and return the content of a file attached to a record.

```json
{
  "name": "get_file_content",
  "arguments": {
    "id": "1234567",
    "filename": "data.csv",
    "max_bytes": 1048576
  }
}
```

Text files are returned as UTF-8 strings. Binary files are returned as base64. The `truncated` field indicates whether the file was cut at `max_bytes`.
