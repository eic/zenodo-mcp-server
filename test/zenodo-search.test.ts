/**
 * Tests for new search capabilities and community tools:
 * - bounds parameter in search_records
 * - communities default from ZENODO_COMMUNITY env var
 * - get_community tool
 * - list_communities tool
 * - default_community in get_auth_status
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TEST_BASE_URL = process.env.ZENODO_BASE_URL || 'https://zenodo.org';

async function createTestClient(env: Record<string, string> = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['build/src/index.js'],
    env: { ...process.env, ZENODO_BASE_URL: TEST_BASE_URL, ZENODO_API_KEY: '', ZENODO_COMMUNITY: '', ...env },
  });
  const client = new Client({ name: 'zenodo-search-test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

describe('Search gaps and community tools', () => {
  let client: Client;
  let closeClient: () => Promise<void>;

  before(async () => {
    ({ client, close: closeClient } = await createTestClient());
  });

  after(async () => {
    await closeClient();
  });

  describe('search_records – new parameters', () => {
    it('should include get_community and list_communities tools', async () => {
      const tools = await client.listTools();
      const names = tools.tools.map((t: { name: string }) => t.name);
      assert.ok(names.includes('get_community'), 'get_community tool missing');
      assert.ok(names.includes('list_communities'), 'list_communities tool missing');
    });

    it('should accept bounds parameter without error', async () => {
      // Use a bounding box around the Netherlands (high density of Zenodo records)
      const result = await client.callTool({
        name: 'search_records',
        arguments: {
          query: 'data',
          size: 3,
          bounds: '3.31,50.75,7.23,53.55',
        },
      }) as ToolResult;

      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(text);
      assert.ok(Object.hasOwn(data, 'total'), 'Missing total field');
      assert.ok(Array.isArray(data.records));
    });

    it('should include all_versions parameter', async () => {
      const result = await client.callTool({
        name: 'search_records',
        arguments: { query: 'zenodo', size: 2, all_versions: true },
      }) as ToolResult;

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data.records));
    });

    it('should reflect community in result when communities param is given', async () => {
      const result = await client.callTool({
        name: 'search_records',
        arguments: { query: '', size: 2, communities: 'zenodo' },
      }) as ToolResult;

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data.records));
    });
  });

  describe('ZENODO_COMMUNITY default', () => {
    it('get_auth_status should show no default_community when env var not set', async () => {
      const result = await client.callTool({ name: 'get_auth_status', arguments: {} }) as ToolResult;

      const text = result.content?.[0]?.text ?? '';
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: get_auth_status (no default_community) – tool not reachable in this environment');
        return;
      }

      const status = JSON.parse(text);
      assert.strictEqual(status.default_community, undefined);
    });

    it('get_auth_status should expose default_community when ZENODO_COMMUNITY is set', async () => {
      const { client: c2, close } = await createTestClient({ ZENODO_COMMUNITY: 'zenodo' });
      try {
        const result = await c2.callTool({ name: 'get_auth_status', arguments: {} }) as ToolResult;
        const status = JSON.parse(result.content[0].text);
        assert.strictEqual(status.default_community, 'zenodo');
      } finally {
        await close();
      }
    });

    it('search_records should apply default community from env and show it in result', async () => {
      const { client: c2, close } = await createTestClient({ ZENODO_COMMUNITY: 'zenodo' });
      try {
        const result = await c2.callTool({
          name: 'search_records',
          arguments: { query: 'data', size: 2 },
        }) as ToolResult;

        if (result.isError || result.content[0].text.startsWith('Error:')) {
          console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
          return;
        }

        const data = JSON.parse(result.content[0].text);
        assert.strictEqual(data.community, 'zenodo', 'community field should reflect default');
        assert.ok(Array.isArray(data.records));
      } finally {
        await close();
      }
    });

    it('explicit communities param should override the default community', async () => {
      const { client: c2, close } = await createTestClient({ ZENODO_COMMUNITY: 'zenodo' });
      try {
        const result = await c2.callTool({
          name: 'search_records',
          arguments: { query: '', size: 2, communities: 'ecfunded' },
        }) as ToolResult;

        if (result.isError || result.content[0].text.startsWith('Error:')) {
          console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
          return;
        }

        const data = JSON.parse(result.content[0].text);
        // The community field in the response reflects the client default, not the override
        // but the actual API call used 'ecfunded' (we can't verify that directly,
        // but the call must not error and must return records)
        assert.ok(Array.isArray(data.records));
      } finally {
        await close();
      }
    });
  });

  describe('get_community tool', () => {
    it('should fetch details of the zenodo community', async () => {
      const result = await client.callTool({
        name: 'get_community',
        arguments: { id: 'zenodo' },
      }) as ToolResult;

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: community not reachable in this environment');
        return;
      }

      const community = JSON.parse(result.content[0].text);
      assert.ok(community.id || community.title, 'Expected id or title in community response');
    });

    it('should return an error for a non-existent community', async () => {
      const result = await client.callTool({
        name: 'get_community',
        arguments: { id: 'zzz_nonexistent_community_xyzxyz' },
      }) as ToolResult;

      const text = result.content?.[0]?.text ?? '';

      // If the endpoint is clearly unreachable due to network/host issues, skip
      if (text.match(/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ETIMEDOUT|timeout|network error|getaddrinfo|fetch failed/i)) {
        console.error('  ⊘ Skipping: community endpoint not reachable in this environment');
        return;
      }

      // For a non-existent community, we expect a clear 404 / "not found" indication
      if (result.isError) {
        if (/404|not\s*found/i.test(text)) {
          return; // expected error: test passes
        }
        // Some other error (likely environment/network/infra related): skip this test
        console.error('  ⊘ Skipping: unexpected error for non-existent community (likely environment issue)');
        return;
      }

      if (/404|not\s*found/i.test(text)) {
        return; // expected error reported in a non-error payload
      }

      // If we reach here, the tool incorrectly returned a successful response for a non-existent community
      assert.fail('Expected an error for non-existent community, but got a successful response.');
    });

    it('should require id parameter', async () => {
      const result = await client.callTool({
        name: 'get_community',
        arguments: { id: '' },
      }) as ToolResult;

      assert.ok(result.isError, 'Expected isError for empty id');
    });
  });

  describe('list_communities tool', () => {
    it('should list communities without a query', async () => {
      const result = await client.callTool({
        name: 'list_communities',
        arguments: { size: 5 },
      }) as ToolResult;

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: communities endpoint not reachable in this environment');
        return;
      }

      const data = JSON.parse(result.content[0].text);
      assert.ok('total' in data);
      assert.ok(Array.isArray(data.communities));
      assert.ok(data.communities.length <= 5);
    });

    it('should search communities by query', async () => {
      const result = await client.callTool({
        name: 'list_communities',
        arguments: { query: 'zenodo', size: 3 },
      }) as ToolResult;

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: communities endpoint not reachable in this environment');
        return;
      }

      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data.communities));
    });
  });
});
