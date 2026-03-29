# Available Tools

| Tool | Description | Auth required | Write required |
|------|-------------|:-------------:|:--------------:|
| `get_auth_status` | Check authentication status and get setup guidance | No | No |
| `set_api_key` | Set a personal access token for the current session | No | No |
| `search_records` | Search Zenodo records with Elasticsearch query syntax | No | No |
| `get_community` | Get details about a specific Zenodo community | No | No |
| `list_communities` | Search or list Zenodo communities | No | No |
| `get_record` | Get full metadata for a record by ID or DOI | No | No |
| `list_record_files` | List files attached to a record | No | No |
| `get_file_content` | Download file content (text or base64) | No | No |
| `list_depositions` | List your own depositions (drafts + published) | **Yes** | No |
| `create_deposition` | Create a new empty deposition (draft) | **Yes** | **Yes** |
| `get_deposition` | Retrieve a single deposition by ID | **Yes** | No |
| `update_deposition` | Update metadata of a draft deposition | **Yes** | **Yes** |
| `delete_deposition` | Delete an unpublished draft deposition | **Yes** | **Yes** |
| `upload_file` | Upload a file to a deposition | **Yes** | **Yes** |
| `delete_deposition_file` | Delete a file from an unpublished deposition | **Yes** | **Yes** |
| `publish_deposition` | Publish a deposition and register a DOI | **Yes** | **Yes** |
| `edit_deposition` | Unlock a published deposition for metadata edits | **Yes** | **Yes** |
| `discard_deposition` | Discard edits and revert to published state | **Yes** | **Yes** |
| `new_version` | Create a new version of a published deposition | **Yes** | **Yes** |

> **Write tools** (`create_deposition` and all tools below it) are only available when the server is started with `ZENODO_ALLOW_WRITE=true` (or `ZENODO_ALLOW_WRITE=1`). This opt-in prevents AI agents from accidentally modifying Zenodo records.

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
    "all_versions": false,
    "bounds": "143.37,-38.99,146.90,-37.35"
  }
}
```

**Sort options:** `bestmatch`, `mostrecent`, `mostviewed`, `mostdownloaded`. Prefix with `-` for descending order (e.g. `-mostrecent`). See the [Zenodo search API docs](https://developers.zenodo.org/#search).

**Resource types:** `publication`, `poster`, `presentation`, `dataset`, `image`, `video`, `software`, `lesson`, `other`.

**`bounds`** — optional geolocation bounding box filter: `"west,south,east,north"` in decimal degrees.

**`subtype`** — optional resource subtype filter (depends on `type`, e.g. `"article"` for `type=publication`).

**`all_versions`** — set to `true` to include all versions of records (default: `false`, returns only the latest version of each record).

When `ZENODO_COMMUNITY` is set, the `communities` parameter defaults to that value if not supplied.

## `get_community`

Get details about a specific Zenodo community.

```json
{ "name": "get_community", "arguments": { "id": "eic" } }
```

Returns the community title, description, curation policy, and links.

## `list_communities`

Search or list Zenodo communities.

```json
{
  "name": "list_communities",
  "arguments": {
    "query": "physics",
    "page": 1,
    "size": 10,
    "sort": "bestmatch"
  }
}
```

**Sort options:** `bestmatch`, `mostrecent`.

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

## Write Tools

The following tools require both authentication (`ZENODO_API_KEY` or `set_api_key`) **and** write access (`ZENODO_ALLOW_WRITE=true`).

### `create_deposition`

Create a new empty deposition (draft upload) on Zenodo.

```json
{
  "name": "create_deposition",
  "arguments": {
    "metadata": {
      "title": "My Dataset",
      "upload_type": "dataset",
      "description": "Description of the dataset.",
      "creators": [{ "name": "Smith, John", "affiliation": "CERN" }],
      "access_right": "open",
      "license": "cc-by-4.0"
    }
  }
}
```

Returns the deposition resource including its `id` and `links.bucket` URL for file uploads.

### `get_deposition`

Retrieve a single deposition (draft or published) owned by the authenticated user.

```json
{ "name": "get_deposition", "arguments": { "id": "1234567" } }
```

### `update_deposition`

Update the metadata of an existing draft deposition.

```json
{
  "name": "update_deposition",
  "arguments": {
    "id": "1234567",
    "metadata": {
      "title": "Updated Title",
      "description": "Updated description."
    }
  }
}
```

### `delete_deposition`

Delete an unpublished (draft) deposition. Published depositions cannot be deleted.

```json
{ "name": "delete_deposition", "arguments": { "id": "1234567" } }
```

### `upload_file`

Upload a file to a deposition using its bucket URL.

```json
{
  "name": "upload_file",
  "arguments": {
    "bucket_url": "https://zenodo.org/api/files/<bucket-id>",
    "filename": "data.csv",
    "content": "col1,col2\n1,2\n",
    "encoding": "utf-8"
  }
}
```

`encoding` is `"utf-8"` (default) or `"base64"` for binary content. The maximum upload size defaults to 50 MiB and can be changed via `ZENODO_MAX_UPLOAD_BYTES`.

### `delete_deposition_file`

Delete a file from an unpublished deposition.

```json
{
  "name": "delete_deposition_file",
  "arguments": {
    "deposition_id": "1234567",
    "file_id": "uuid-of-the-file"
  }
}
```

### `publish_deposition`

Publish a deposition. A DOI is registered and the record becomes publicly visible. The deposition must have required metadata and at least one file.

```json
{ "name": "publish_deposition", "arguments": { "id": "1234567" } }
```

### `edit_deposition`

Unlock a published deposition for metadata edits. Files cannot be changed after publication; use `new_version` instead.

```json
{ "name": "edit_deposition", "arguments": { "id": "1234567" } }
```

### `discard_deposition`

Discard all edits made in the current editing session and revert to the published state.

```json
{ "name": "discard_deposition", "arguments": { "id": "1234567" } }
```

### `new_version`

Create a new version of a published deposition. The new draft is accessible via `deposition.links.latest_draft`.

```json
{ "name": "new_version", "arguments": { "id": "1234567" } }
```
