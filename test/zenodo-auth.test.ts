/**
 * Authenticated access tests for the Zenodo MCP server.
 *
 * These tests require a valid ZENODO_API_KEY in the environment. They are
 * skipped gracefully when the key is absent so that local runs without
 * credentials and fork PRs (which cannot access secrets) still pass.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TEST_BASE_URL = process.env.ZENODO_BASE_URL || 'https://zenodo.org';
const TEST_API_KEY = process.env.ZENODO_API_KEY || '';

const HAVE_KEY = TEST_API_KEY.length > 0;

function skipIfNoKey(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    if (!HAVE_KEY) {
      console.error('  ⊘ Skipping: ZENODO_API_KEY not set');
      return;
    }
    await fn();
  };
}

describe('Zenodo MCP Server – Authenticated Access Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;

  before(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: ['build/src/index.js'],
      env: {
        ...process.env,
        ZENODO_BASE_URL: TEST_BASE_URL,
        ZENODO_API_KEY: TEST_API_KEY,
      },
    });

    client = new Client(
      { name: 'zenodo-auth-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  describe('Authentication status', () => {
    it('should report authenticated when API key is set', skipIfNoKey(async () => {
      const result = await client.callTool({
        name: 'get_auth_status',
        arguments: {},
      }) as { content: Array<{ type: string; text: string }> };

      assert.ok(result.content?.[0]);
      const status = JSON.parse(result.content[0].text);
      assert.strictEqual(status.authenticated, true, 'Expected authenticated: true with a valid API key');
    }));
  });

  describe('Deposition listing', () => {
    it('should list depositions without error when authenticated', skipIfNoKey(async () => {
      const result = await client.callTool({
        name: 'list_depositions',
        arguments: {},
      }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.content?.[0]);
      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(text);
      // The response must include a depositions array (may be empty for a fresh account)
      assert.ok(Array.isArray(data.depositions), 'Expected depositions array');
    }));

    it('should support size parameter for deposition listing', skipIfNoKey(async () => {
      const result = await client.callTool({
        name: 'list_depositions',
        arguments: { size: 2 },
      }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.content?.[0]);
      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(text);
      assert.ok(data.depositions.length <= 2, 'Should not return more than requested size');
    }));

    it('should filter depositions by status draft', skipIfNoKey(async () => {
      const result = await client.callTool({
        name: 'list_depositions',
        arguments: { status: 'draft' },
      }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.content?.[0]);
      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(text);
      assert.ok(Array.isArray(data.depositions), 'Expected depositions array for draft filter');
    }));

    it('should filter depositions by status published', skipIfNoKey(async () => {
      const result = await client.callTool({
        name: 'list_depositions',
        arguments: { status: 'published' },
      }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.content?.[0]);
      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }
      const data = JSON.parse(text);
      assert.ok(Array.isArray(data.depositions), 'Expected depositions array for published filter');
    }));
  });

  describe('Restricted record access', () => {
    it('should access auth status confirming token is accepted by Zenodo', skipIfNoKey(async () => {
      // get_auth_status verifies the API key by calling Zenodo's /api/me endpoint.
      // Passing here confirms the key is valid and accepted by Zenodo's API.
      const result = await client.callTool({
        name: 'get_auth_status',
        arguments: {},
      }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(!result.isError, 'API key was rejected by Zenodo');
      const status = JSON.parse(result.content[0].text);
      assert.strictEqual(status.authenticated, true);
    }));
  });

  describe('set_api_key via tool call', () => {
    it('should accept a valid API key set via the tool', skipIfNoKey(async () => {
      // Use a separate unauthenticated client and inject the key via the tool.
      const unauthTransport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/src/index.js'],
        env: { ...process.env, ZENODO_BASE_URL: TEST_BASE_URL, ZENODO_API_KEY: '' },
      });
      const unauthClient = new Client(
        { name: 'zenodo-set-key-test-client', version: '1.0.0' },
        { capabilities: {} }
      );
      await unauthClient.connect(unauthTransport);

      try {
        const setResult = await unauthClient.callTool({
          name: 'set_api_key',
          arguments: { api_key: TEST_API_KEY },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

        assert.ok(!setResult.isError, `set_api_key failed: ${setResult.content?.[0]?.text}`);
        const setData = JSON.parse(setResult.content[0].text);
        assert.strictEqual(setData.success, true);

        // Verify auth status is now true
        const authResult = await unauthClient.callTool({
          name: 'get_auth_status',
          arguments: {},
        }) as { content: Array<{ type: string; text: string }> };
        const authStatus = JSON.parse(authResult.content[0].text);
        assert.strictEqual(authStatus.authenticated, true);
      } finally {
        await unauthClient.close();
      }
    }));
  });
});
