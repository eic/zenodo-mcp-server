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
const ZENODO_COMMUNITY = process.env.ZENODO_COMMUNITY || null;

const zenodoClient = new ZenodoClient(ZENODO_BASE_URL, ZENODO_API_KEY, ZENODO_COMMUNITY);

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
  `Default community: ${ZENODO_COMMUNITY || 'none (all communities searched by default)'}`
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
          description:
            'Filter by community identifier (e.g. "zenodo"). ' +
            'When omitted, the ZENODO_COMMUNITY default is applied if set.',
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
        bounds: {
          type: 'string',
          description:
            'Geolocation bounding box filter. Format: "west,south,east,north" ' +
            '(longitude/latitude in decimal degrees, e.g. "143.37,-38.99,146.90,-37.35")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_community',
    description:
      'Get details about a specific Zenodo community by its identifier. ' +
      'Returns the title, description, curation policy, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The community identifier (e.g. "zenodo", "eic")',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_communities',
    description:
      'Search or list Zenodo communities. ' +
      'Returns community identifiers, titles, and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search query to filter communities by name or description',
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
          description: 'Sort order: "bestmatch" or "mostrecent"',
        },
      },
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
                  default_community: status.default_community,
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
          bounds: safeArgs.bounds ? String(safeArgs.bounds) : undefined,
        });

        const simplified = {
          total: results.hits.total,
          page: safeArgs.page || 1,
          size: safeArgs.size || 10,
          community: zenodoClient.getDefaultCommunity() ?? undefined,
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

      case 'get_community': {
        const id = String(safeArgs.id || '').trim();
        if (!id) {
          throw new Error('id is required');
        }
        const community = await zenodoClient.getCommunity(id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: community.id,
                  title: community.title,
                  description: community.description,
                  curation_policy: community.curation_policy,
                  links: community.links,
                  created: community.created,
                  updated: community.updated,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_communities': {
        const query = safeArgs.query ? String(safeArgs.query) : undefined;
        const result = await zenodoClient.listCommunities(query, {
          page: safeArgs.page !== undefined ? Number(safeArgs.page) : undefined,
          size: safeArgs.size !== undefined ? Number(safeArgs.size) : undefined,
          sort: safeArgs.sort ? String(safeArgs.sort) : undefined,
        });
        const simplified = {
          total: result.hits.total,
          next: result.links.next,
          communities: result.hits.hits.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description
              ? c.description.slice(0, 200) + (c.description.length > 200 ? '...' : '')
              : undefined,
            links: c.links,
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
