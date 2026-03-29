/**
 * Tests for write operations gated by ZENODO_ALLOW_WRITE.
 *
 * Gate/auth enforcement tests run always (no network needed).
 * Live sandbox round-trip tests run only when ZENODO_SANDBOX_API_KEY is set,
 * pointing at https://sandbox.zenodo.org.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SANDBOX_BASE_URL = 'https://sandbox.zenodo.org';
const SANDBOX_API_KEY = process.env.ZENODO_SANDBOX_API_KEY || '';
const HAVE_SANDBOX = SANDBOX_API_KEY.length > 0;

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

async function makeClient(env: Record<string, string> = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['build/src/index.js'],
    env: {
      ...process.env,
      ZENODO_BASE_URL: 'https://zenodo.org',
      ZENODO_API_KEY: '',
      ZENODO_ALLOW_WRITE: 'false',
      ...env,
    },
  });
  const client = new Client(
    { name: 'zenodo-write-test-client', version: '1.0.0' },
    { capabilities: {} }
  );
  await client.connect(transport);
  return { client, close: () => client.close() };
}

describe('Write operations – gate and auth enforcement', () => {
  let readOnlyClient: Client;
  let closeReadOnly: () => Promise<void>;

  before(async () => {
    // Server with write disabled (default)
    ({ client: readOnlyClient, close: closeReadOnly } = await makeClient());
  });

  after(async () => {
    await closeReadOnly();
  });

  describe('Tool registration', () => {
    it('write tools should NOT appear when ZENODO_ALLOW_WRITE is false', async () => {
      const tools = await readOnlyClient.listTools();
      const names = tools.tools.map((t: { name: string }) => t.name);
      const writeToolNames = [
        'create_deposition', 'update_deposition', 'delete_deposition',
        'upload_file', 'delete_deposition_file',
        'publish_deposition', 'edit_deposition', 'discard_deposition', 'new_version',
      ];
      for (const toolName of writeToolNames) {
        assert.ok(!names.includes(toolName), `${toolName} should not be registered when write is disabled`);
      }
    });

    it('get_deposition should always be present (not write-gated)', async () => {
      const tools = await readOnlyClient.listTools();
      const names = tools.tools.map((t: { name: string }) => t.name);
      assert.ok(names.includes('get_deposition'), 'get_deposition should be registered even without write access');
    });

    it('write tools SHOULD appear when ZENODO_ALLOW_WRITE=true', async () => {
      const { client, close } = await makeClient({ ZENODO_ALLOW_WRITE: 'true' });
      try {
        const tools = await client.listTools();
        const names = tools.tools.map((t: { name: string }) => t.name);
        assert.ok(names.includes('create_deposition'), 'create_deposition should be registered');
        assert.ok(names.includes('publish_deposition'), 'publish_deposition should be registered');
        assert.ok(names.includes('upload_file'), 'upload_file should be registered');
        assert.ok(names.includes('new_version'), 'new_version should be registered');
      } finally {
        await close();
      }
    });

    it('read-only tools should still be present when write is enabled', async () => {
      const { client, close } = await makeClient({ ZENODO_ALLOW_WRITE: 'true' });
      try {
        const tools = await client.listTools();
        const names = tools.tools.map((t: { name: string }) => t.name);
        assert.ok(names.includes('search_records'));
        assert.ok(names.includes('get_record'));
        assert.ok(names.includes('list_record_files'));
        assert.ok(names.includes('list_depositions'));
      } finally {
        await close();
      }
    });
  });

  describe('Defence-in-depth: write blocked even if called on write-disabled server', () => {
    // These verify the handler-level guard, not just the tool-registration guard.
    // We call via the MCP protocol directly, bypassing the tool list.
    const writeToolCalls = [
      { name: 'create_deposition', args: {} },
      { name: 'update_deposition', args: { id: '1', metadata: {} } },
      { name: 'delete_deposition', args: { id: '1' } },
      { name: 'publish_deposition', args: { id: '1' } },
      { name: 'edit_deposition', args: { id: '1' } },
      { name: 'discard_deposition', args: { id: '1' } },
      { name: 'new_version', args: { id: '1' } },
      { name: 'upload_file', args: { bucket_url: 'https://x', filename: 'f.txt', content: 'hi' } },
      { name: 'delete_deposition_file', args: { deposition_id: '1', file_id: 'abc' } },
    ];

    for (const { name, args } of writeToolCalls) {
      it(`${name} returns isError when write is disabled`, async () => {
        const result = await readOnlyClient.callTool({ name, arguments: args }) as ToolResult;
        assert.ok(result.isError, `${name} should return isError when write is disabled`);
        assert.ok(
          result.content[0].text.includes('ZENODO_ALLOW_WRITE'),
          `Error message should mention ZENODO_ALLOW_WRITE; got: ${result.content[0].text}`
        );
      });
    }
  });

  describe('Write enabled but not authenticated', () => {
    let writeUnauthClient: Client;
    let closeWriteUnauth: () => Promise<void>;

    before(async () => {
      ({ client: writeUnauthClient, close: closeWriteUnauth } = await makeClient({
        ZENODO_ALLOW_WRITE: 'true',
        ZENODO_API_KEY: '',
      }));
    });

    after(async () => {
      await closeWriteUnauth();
    });

    it('create_deposition returns error when not authenticated', async () => {
      const result = await writeUnauthClient.callTool({
        name: 'create_deposition',
        arguments: {},
      }) as ToolResult;
      assert.ok(result.isError);
      assert.ok(result.content[0].text.toLowerCase().includes('auth'));
    });

    it('publish_deposition returns error when not authenticated', async () => {
      const result = await writeUnauthClient.callTool({
        name: 'publish_deposition',
        arguments: { id: '1' },
      }) as ToolResult;
      assert.ok(result.isError);
    });
  });
});

describe('Write operations – live sandbox round-trip', () => {
  let client: Client;
  let closeClient: () => Promise<void>;
  let depositionId: string;

  before(async () => {
    if (!HAVE_SANDBOX) return;
    ({ client, close: closeClient } = await makeClient({
      ZENODO_BASE_URL: SANDBOX_BASE_URL,
      ZENODO_API_KEY: SANDBOX_API_KEY,
      ZENODO_ALLOW_WRITE: 'true',
    }));
  });

  after(async () => {
    if (!HAVE_SANDBOX) return;
    // Clean up: delete the draft if it wasn't already deleted in the test
    if (depositionId) {
      try {
        await client.callTool({ name: 'delete_deposition', arguments: { id: depositionId } });
      } catch { /* best effort */ }
    }
    await closeClient();
  });

  it('create_deposition returns a new draft with a bucket URL', async (t) => {
    if (!HAVE_SANDBOX) {
      return t.skip('ZENODO_SANDBOX_API_KEY not set');
    }
    const result = await client.callTool({
      name: 'create_deposition',
      arguments: {},
    }) as ToolResult;
    assert.ok(!result.isError, `create failed: ${result.content[0].text}`);
    const dep = JSON.parse(result.content[0].text);
    assert.ok(dep.id, 'Expected numeric id');
    assert.ok(dep.bucket_url, 'Expected bucket_url');
    assert.strictEqual(dep.submitted, false);
    depositionId = String(dep.id);
  });

  it('upload_file uploads text content to the draft', async (t) => {
    if (!HAVE_SANDBOX || !depositionId) {
      return t.skip('no sandbox key or deposition');
    }
    // Get the bucket URL first
    const depResult = await client.callTool({
      name: 'get_deposition',
      arguments: { id: depositionId },
    }) as ToolResult;
    assert.ok(!depResult.isError, depResult.content[0].text);
    const dep = JSON.parse(depResult.content[0].text);

    const result = await client.callTool({
      name: 'upload_file',
      arguments: {
        bucket_url: dep.links.bucket,
        filename: 'hello.txt',
        content: 'Hello from zenodo-mcp-server test!',
        encoding: 'utf-8',
      },
    }) as ToolResult;
    assert.ok(!result.isError, `upload failed: ${result.content[0].text}`);
    const file = JSON.parse(result.content[0].text);
    assert.strictEqual(file.key, 'hello.txt');
    assert.ok(file.checksum);
  });

  it('update_deposition sets metadata on the draft', async (t) => {
    if (!HAVE_SANDBOX || !depositionId) {
      return t.skip('no sandbox key or deposition');
    }
    const result = await client.callTool({
      name: 'update_deposition',
      arguments: {
        id: depositionId,
        metadata: {
          title: 'zenodo-mcp-server automated test (please ignore)',
          upload_type: 'other',
          description: 'Automated integration test from zenodo-mcp-server CI. Safe to delete.',
          creators: [{ name: 'Zenodo MCP Server Test Bot', affiliation: 'zenodo-mcp-server' }],
          access_right: 'open',
          license: 'cc-zero',
        },
      },
    }) as ToolResult;
    assert.ok(!result.isError, `update failed: ${result.content[0].text}`);
    const dep = JSON.parse(result.content[0].text);
    assert.ok(dep.id);
  });

  it('delete_deposition removes the draft', async (t) => {
    if (!HAVE_SANDBOX || !depositionId) {
      return t.skip('no sandbox key or deposition');
    }
    const result = await client.callTool({
      name: 'delete_deposition',
      arguments: { id: depositionId },
    }) as ToolResult;
    assert.ok(!result.isError, `delete failed: ${result.content[0].text}`);
    const data = JSON.parse(result.content[0].text);
    assert.strictEqual(data.success, true);
    depositionId = ''; // prevent after() from trying to delete again
  });
});
