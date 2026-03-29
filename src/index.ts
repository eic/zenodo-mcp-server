#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ZenodoClient } from './zenodo.js';

const ZENODO_BASE_URL =
  process.env.ZENODO_BASE_URL || 'https://zenodo.org';
const ZENODO_API_KEY = process.env.ZENODO_API_KEY || null;
const ZENODO_ALLOW_WRITE =
  process.env.ZENODO_ALLOW_WRITE === 'true' ||
  process.env.ZENODO_ALLOW_WRITE === '1';

const zenodoClient = new ZenodoClient(ZENODO_BASE_URL, ZENODO_API_KEY);

const server = new Server(
  {
    name: 'zenodo-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error(`Server: zenodo-mcp-server v0.1.0`);
console.error(`Zenodo base URL: ${ZENODO_BASE_URL}`);
console.error(
  `Authentication: ${ZENODO_API_KEY ? 'API key loaded from environment' : 'no key (unauthenticated)'}`
);
console.error(
  `Write access: ${ZENODO_ALLOW_WRITE ? 'ENABLED (ZENODO_ALLOW_WRITE=true)' : 'disabled (set ZENODO_ALLOW_WRITE=true to enable)'}`
);

const tools: Tool[] = [
  {
    name: 'get_auth_status',
    description:
      'Check the current authentication status with Zenodo and get guidance on how to connect with an API key.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_api_key',
    description:
      'Set a Zenodo personal access token for the current session. ' +
      'This allows authenticated access to private records and depositions. ' +
      'Create a token at https://zenodo.org/account/settings/applications/tokens/new/ ' +
      'with the desired scopes (deposit:write for uploads, deposit:actions for publishing).',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: {
          type: 'string',
          description: 'Your Zenodo personal access token',
        },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'search_records',
    description:
      'Search for records on Zenodo using a query string. Supports Elasticsearch query syntax. ' +
      'Works without authentication for public records.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query. Supports Elasticsearch syntax, e.g. "electron ion collider", ' +
            '"title:higgs", "creators.name:Smith", "+keywords:physics"',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
        size: {
          type: 'number',
          description: 'Number of results per page (default: 10, max: 100)',
        },
        sort: {
          type: 'string',
          description:
            'Sort order: "bestmatch", "mostrecent", "mostviewed", "mostdownloaded" ' +
            '(prefix with "-" for descending, e.g. "-mostrecent")',
        },
        communities: {
          type: 'string',
          description: 'Filter by community identifier (e.g. "zenodo")',
        },
        type: {
          type: 'string',
          description:
            'Filter by resource type: "publication", "poster", "presentation", ' +
            '"dataset", "image", "video", "software", "lesson", "other"',
        },
        subtype: {
          type: 'string',
          description:
            'Filter by resource subtype (depends on type, e.g. "article" for publication)',
        },
        all_versions: {
          type: 'boolean',
          description:
            'Include all versions of records (default: false, only latest versions)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_record',
    description:
      'Get detailed information about a specific Zenodo record by its ID. ' +
      'Works without authentication for public records.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'The Zenodo record ID (numeric, e.g. "1234567") or DOI (e.g. "10.5281/zenodo.1234567")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_record_files',
    description:
      'List all files attached to a Zenodo record, including their names, sizes, and checksums. ' +
      'Works without authentication for open-access records.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The Zenodo record ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_file_content',
    description:
      'Download and return the content of a file from a Zenodo record. ' +
      'Text files are returned as UTF-8 strings; binary files are returned as base64. ' +
      'Use max_bytes to limit the amount of data downloaded.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The Zenodo record ID',
        },
        filename: {
          type: 'string',
          description: 'The filename to download (as listed by list_record_files)',
        },
        max_bytes: {
          type: 'number',
          description:
            'Maximum number of bytes to download (default: 1 MB). ' +
            'Use a larger value for complete binary files.',
        },
      },
      required: ['id', 'filename'],
    },
  },
  {
    name: 'list_depositions',
    description:
      'List your own Zenodo depositions (drafts and published records). ' +
      'Requires authentication via set_api_key or ZENODO_API_KEY environment variable.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search query to filter depositions by title',
        },
        status: {
          type: 'string',
          description: 'Filter by status: "draft" or "published"',
        },
        sort: {
          type: 'string',
          description:
            'Sort order: "bestmatch" or "mostrecent" (prefix "-" for descending)',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        size: {
          type: 'number',
          description: 'Results per page (default: 10)',
        },
      },
    },
  },
];

// Write tools — only registered when ZENODO_ALLOW_WRITE is enabled.
// This prevents AI agents from accidentally modifying Zenodo records
// unless the operator has explicitly opted in.
const writeTools: Tool[] = [
  {
    name: 'create_deposition',
    description:
      'Create a new empty deposition (draft upload) on Zenodo. ' +
      'Returns the deposition resource including its ID and bucket URL for file uploads. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          description:
            'Optional initial metadata. Common fields: title (string), ' +
            'upload_type ("publication"|"dataset"|"software"|"poster"|"presentation"|"image"|"video"|"lesson"|"other"), ' +
            'description (string, HTML allowed), ' +
            'creators (array of {name, affiliation?, orcid?}), ' +
            'publication_date (YYYY-MM-DD), access_right ("open"|"embargoed"|"restricted"|"closed"), ' +
            'license (string, e.g. "cc-by-4.0"), keywords (string[]).',
        },
      },
    },
  },
  {
    name: 'get_deposition',
    description:
      'Retrieve a single deposition (draft or published) owned by the authenticated user. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_deposition',
    description:
      'Update the metadata of an existing draft deposition. ' +
      'The deposition must be in an editable state (not yet published, or unlocked via edit_deposition). ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
        metadata: {
          type: 'object',
          description:
            'Metadata fields to set. Required before publishing: title, upload_type, description, creators. ' +
            'See create_deposition for field details.',
        },
      },
      required: ['id', 'metadata'],
    },
  },
  {
    name: 'delete_deposition',
    description:
      'Delete an unpublished (draft) deposition. Published depositions cannot be deleted. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'upload_file',
    description:
      'Upload a file to a deposition. Provide the bucket_url from the deposition resource ' +
      '(deposition.links.bucket), the filename, and the file content as a UTF-8 string or ' +
      'base64-encoded bytes. Returns the uploaded file resource. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket_url: {
          type: 'string',
          description: 'The bucket URL from the deposition links (e.g. deposition.links.bucket)',
        },
        filename: {
          type: 'string',
          description: 'Name to give the file on Zenodo',
        },
        content: {
          type: 'string',
          description: 'File content as a UTF-8 string, or base64-encoded bytes',
        },
        encoding: {
          type: 'string',
          description: 'Content encoding: "utf-8" (default) or "base64"',
        },
      },
      required: ['bucket_url', 'filename', 'content'],
    },
  },
  {
    name: 'delete_deposition_file',
    description:
      'Delete a file from an unpublished deposition. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        deposition_id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
        file_id: {
          type: 'string',
          description: 'File ID (UUID, as returned by upload_file or list_record_files)',
        },
      },
      required: ['deposition_id', 'file_id'],
    },
  },
  {
    name: 'publish_deposition',
    description:
      'Publish a deposition. Once published, the deposition cannot be deleted and a DOI is registered. ' +
      'The deposition must have required metadata (title, upload_type, description, creators) and at least one file. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'edit_deposition',
    description:
      'Unlock an already-published deposition for editing metadata. ' +
      'Files cannot be changed after publication; use new_version for that. ' +
      'Call discard_deposition to abandon edits without publishing changes. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'discard_deposition',
    description:
      'Discard all edits made during the current editing session and revert to the published state. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Deposition ID (numeric)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'new_version',
    description:
      'Create a new version of a published deposition. Returns the original deposition; ' +
      'the new draft version is accessible via deposition.links.latest_draft. ' +
      'Use the new draft ID for update_deposition, upload_file, and publish_deposition. ' +
      'Requires authentication and ZENODO_ALLOW_WRITE=true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the latest published version of the deposition',
        },
      },
      required: ['id'],
    },
  },
];

if (ZENODO_ALLOW_WRITE) {
  tools.push(...writeTools);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args && name !== 'get_auth_status') {
    throw new Error('Missing arguments');
  }

  const safeArgs = args || {};

  try {
    switch (name) {
      case 'get_auth_status': {
        const status = await zenodoClient.checkAuthStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  authenticated: status.authenticated,
                  message: status.message,
                  user: status.user,
                  help: status.authenticated
                    ? undefined
                    : {
                        step1:
                          'Go to https://zenodo.org/account/settings/applications/tokens/new/',
                        step2:
                          'Create a token with scopes: deposit:write, deposit:actions (for uploads), user:email (to verify identity)',
                        step3:
                          'Call set_api_key with your token for this session, or set ZENODO_API_KEY environment variable for persistent access',
                      },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'set_api_key': {
        const key = String(safeArgs.api_key || '').trim();
        if (!key) {
          throw new Error('api_key must not be empty');
        }
        zenodoClient.setApiKey(key);
        // Immediately verify the key
        const status = await zenodoClient.checkAuthStatus();
        if (!status.authenticated) {
          // Clear the invalid key so the server stays unauthenticated
          zenodoClient.setApiKey(null);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: `API key verification failed: ${status.message}`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `API key accepted. ${status.message}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_records': {
        const query = String(safeArgs.query || '');
        const results = await zenodoClient.searchRecords(query, {
          page: safeArgs.page !== undefined ? Number(safeArgs.page) : undefined,
          size: safeArgs.size !== undefined ? Number(safeArgs.size) : undefined,
          sort: safeArgs.sort ? String(safeArgs.sort) : undefined,
          communities: safeArgs.communities
            ? String(safeArgs.communities)
            : undefined,
          type: safeArgs.type ? String(safeArgs.type) : undefined,
          subtype: safeArgs.subtype ? String(safeArgs.subtype) : undefined,
          allVersions: safeArgs.all_versions
            ? Boolean(safeArgs.all_versions)
            : undefined,
        });

        const simplified = {
          total: results.hits.total,
          page: safeArgs.page || 1,
          size: safeArgs.size || 10,
          next: results.links.next,
          records: results.hits.hits.map((r) => ({
            id: r.id,
            doi: r.doi,
            title: r.metadata.title,
            creators: r.metadata.creators.map((c) => c.name).join(', '),
            publication_date: r.metadata.publication_date,
            resource_type: r.metadata.resource_type,
            access_right: r.metadata.access_right,
            description:
              r.metadata.description
                ? r.metadata.description.slice(0, 300) +
                  (r.metadata.description.length > 300 ? '...' : '')
                : '',
            keywords: r.metadata.keywords,
            version: r.metadata.version,
            files_count: r.files?.length,
            url: r.links.self_html || r.links.html,
          })),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(simplified, null, 2) }],
        };
      }

      case 'get_record': {
        const id = String(safeArgs.id || '').trim();
        if (!id) {
          throw new Error('id is required');
        }

        // Support DOI-style IDs: extract numeric ID
        const numericId = id.includes('zenodo.')
          ? id.split('zenodo.').pop() || id
          : id;

        const record = await zenodoClient.getRecord(numericId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: record.id,
                  conceptrecid: record.conceptrecid,
                  doi: record.doi,
                  doi_url: record.doi_url,
                  title: record.metadata.title,
                  creators: record.metadata.creators,
                  publication_date: record.metadata.publication_date,
                  resource_type: record.metadata.resource_type,
                  access_right: record.metadata.access_right,
                  license: record.metadata.license,
                  version: record.metadata.version,
                  keywords: record.metadata.keywords,
                  communities: record.metadata.communities,
                  description: record.metadata.description ?? '',
                  related_identifiers: record.metadata.related_identifiers,
                  journal: record.metadata.journal,
                  files: record.files?.map((f) => ({
                    key: f.key,
                    size: f.size,
                    size_human: formatBytes(f.size),
                    checksum: f.checksum,
                    download_url: f.links.self,
                  })),
                  stats: record.stats,
                  links: record.links,
                  created: record.created,
                  updated: record.updated,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_record_files': {
        const id = String(safeArgs.id || '').trim();
        if (!id) {
          throw new Error('id is required');
        }

        const files = await zenodoClient.listRecordFiles(id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  record_id: id,
                  file_count: files.length,
                  total_size: formatBytes(
                    files.reduce((sum, f) => sum + f.size, 0)
                  ),
                  files: files.map((f) => ({
                    key: f.key,
                    size: f.size,
                    size_human: formatBytes(f.size),
                    checksum: f.checksum,
                    download_url: f.links.self,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_file_content': {
        const id = String(safeArgs.id || '').trim();
        const filename = String(safeArgs.filename || '').trim();

        let maxBytes: number;
        if (safeArgs.max_bytes === undefined) {
          maxBytes = 1024 * 1024; // 1 MB default
        } else {
          maxBytes = Number(safeArgs.max_bytes);
          if (
            !Number.isFinite(maxBytes) ||
            !Number.isInteger(maxBytes) ||
            maxBytes <= 0
          ) {
            throw new Error('max_bytes must be a positive integer');
          }
        }

        if (!id) throw new Error('id is required');
        if (!filename) throw new Error('filename is required');

        // Look up the file URL from the record's file list
        const files = await zenodoClient.listRecordFiles(id);
        const file = files.find((f) => f.key === filename);
        if (!file) {
          throw new Error(
            `File "${filename}" not found in record ${id}. ` +
              `Available files: ${files.map((f) => f.key).join(', ')}`
          );
        }

        const result = await zenodoClient.getFileContent(
          file.links.self,
          maxBytes
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  record_id: id,
                  filename: file.key,
                  size: file.size,
                  size_human: formatBytes(file.size),
                  checksum: file.checksum,
                  encoding: result.encoding,
                  mime_type: result.mimeType,
                  truncated: result.truncated,
                  truncated_at_bytes: result.truncated ? maxBytes : undefined,
                  content: result.content,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_depositions': {
        const depositions = await zenodoClient.listDepositions({
          q: safeArgs.query ? String(safeArgs.query) : undefined,
          status: safeArgs.status ? String(safeArgs.status) : undefined,
          sort: safeArgs.sort ? String(safeArgs.sort) : undefined,
          page: safeArgs.page !== undefined ? Number(safeArgs.page) : undefined,
          size: safeArgs.size !== undefined ? Number(safeArgs.size) : undefined,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: depositions.length,
                  depositions: depositions.map((d) => ({
                    id: d.id,
                    title: d.title || d.metadata?.title || '(untitled)',
                    doi: d.doi,
                    state: d.state,
                    submitted: d.submitted,
                    created: d.created,
                    modified: d.modified,
                    url: d.links.self_html || d.links.html,
                    publish_url: d.links.publish,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── Write operations ──────────────────────────────────────────────────

      case 'create_deposition':
      case 'get_deposition':
      case 'update_deposition':
      case 'delete_deposition':
      case 'upload_file':
      case 'delete_deposition_file':
      case 'publish_deposition':
      case 'edit_deposition':
      case 'discard_deposition':
      case 'new_version': {
        // Defence-in-depth: reject even if somehow called without the gate
        if (!ZENODO_ALLOW_WRITE) {
          throw new Error(
            `Write operations are disabled. Set ZENODO_ALLOW_WRITE=true to enable them.`
          );
        }

        if (name === 'create_deposition') {
          const metadata = safeArgs.metadata as Partial<import('./zenodo.js').ZenodoMetadata> | undefined;
          const deposition = await zenodoClient.createDeposition(metadata);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: deposition.id,
                state: deposition.state,
                submitted: deposition.submitted,
                title: deposition.title || '(untitled)',
                doi: deposition.doi,
                bucket_url: deposition.links.bucket,
                links: deposition.links,
                created: deposition.created,
              }, null, 2),
            }],
          };
        }

        if (name === 'get_deposition') {
          const id = String(safeArgs.id || '').trim();
          if (!id) throw new Error('id is required');
          const deposition = await zenodoClient.getDeposition(id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: deposition.id,
                title: deposition.title || deposition.metadata?.title || '(untitled)',
                state: deposition.state,
                submitted: deposition.submitted,
                doi: deposition.doi,
                doi_url: deposition.doi_url,
                metadata: deposition.metadata,
                links: deposition.links,
                created: deposition.created,
                modified: deposition.modified,
              }, null, 2),
            }],
          };
        }

        if (name === 'update_deposition') {
          const id = String(safeArgs.id || '').trim();
          if (!id) throw new Error('id is required');
          if (!safeArgs.metadata) throw new Error('metadata is required');
          const deposition = await zenodoClient.updateDeposition(
            id,
            safeArgs.metadata as Partial<import('./zenodo.js').ZenodoMetadata>
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: deposition.id,
                title: deposition.title || deposition.metadata?.title || '(untitled)',
                state: deposition.state,
                modified: deposition.modified,
                links: deposition.links,
              }, null, 2),
            }],
          };
        }

        if (name === 'delete_deposition') {
          const id = String(safeArgs.id || '').trim();
          if (!id) throw new Error('id is required');
          await zenodoClient.deleteDeposition(id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: `Deposition ${id} deleted.` }, null, 2),
            }],
          };
        }

        if (name === 'upload_file') {
          const bucketUrl = String(safeArgs.bucket_url || '').trim();
          const filename = String(safeArgs.filename || '').trim();
          const content = String(safeArgs.content ?? '');
          const encoding = (safeArgs.encoding === 'base64' ? 'base64' : 'utf-8') as 'utf-8' | 'base64';
          if (!bucketUrl) throw new Error('bucket_url is required');
          if (!filename) throw new Error('filename is required');
          const file = await zenodoClient.uploadFile(bucketUrl, filename, content, encoding);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                key: file.key,
                size: file.size,
                checksum: file.checksum,
                download_url: file.links?.self,
              }, null, 2),
            }],
          };
        }

        if (name === 'delete_deposition_file') {
          const depositionId = String(safeArgs.deposition_id || '').trim();
          const fileId = String(safeArgs.file_id || '').trim();
          if (!depositionId) throw new Error('deposition_id is required');
          if (!fileId) throw new Error('file_id is required');
          await zenodoClient.deleteDepositionFile(depositionId, fileId);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: `File ${fileId} deleted from deposition ${depositionId}.` }, null, 2),
            }],
          };
        }

        // Deposition actions: publish, edit, discard, new_version
        const actionId = String(safeArgs.id || '').trim();
        if (!actionId) throw new Error('id is required');

        const actionMap: Record<string, () => Promise<import('./zenodo.js').ZenodoDeposition>> = {
          publish_deposition: () => zenodoClient.publishDeposition(actionId),
          edit_deposition: () => zenodoClient.editDeposition(actionId),
          discard_deposition: () => zenodoClient.discardDeposition(actionId),
          new_version: () => zenodoClient.newVersion(actionId),
        };

        const deposition = await actionMap[name]();
        const actionMessages: Record<string, string> = {
          publish_deposition: `Deposition ${actionId} published successfully.`,
          edit_deposition: `Deposition ${actionId} unlocked for editing.`,
          discard_deposition: `Edits to deposition ${actionId} discarded.`,
          new_version: `New version draft created. Access it via links.latest_draft.`,
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: deposition.id,
              state: deposition.state,
              submitted: deposition.submitted,
              doi: deposition.doi,
              doi_url: deposition.doi_url,
              links: deposition.links,
              message: actionMessages[name],
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Zenodo MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
