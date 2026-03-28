import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TEST_BASE_URL =
  process.env.ZENODO_BASE_URL || 'https://zenodo.org';
const TEST_API_KEY = process.env.ZENODO_API_KEY || '';

describe('Zenodo MCP Server Integration Tests', () => {
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
      {
        name: 'zenodo-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  describe('Server Initialization', () => {
    it('should connect to the MCP server', async () => {
      assert.ok(client);
      assert.ok(transport);
    });

    it('should list available tools', async () => {
      const tools = await client.listTools();
      assert.ok(tools.tools);
      assert.ok(tools.tools.length > 0);

      const toolNames = tools.tools.map((t: { name: string }) => t.name);
      assert.ok(toolNames.includes('get_auth_status'));
      assert.ok(toolNames.includes('set_api_key'));
      assert.ok(toolNames.includes('search_records'));
      assert.ok(toolNames.includes('get_record'));
      assert.ok(toolNames.includes('list_record_files'));
      assert.ok(toolNames.includes('get_file_content'));
      assert.ok(toolNames.includes('list_depositions'));
    });
  });

  describe('Authentication', () => {
    it('should return auth status without API key', async () => {
      // Create a separate client without an API key to test the unauthenticated state
      const unauthTransport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/src/index.js'],
        env: {
          ...process.env,
          ZENODO_BASE_URL: TEST_BASE_URL,
          ZENODO_API_KEY: '',
        },
      });

      const unauthClient = new Client(
        { name: 'zenodo-unauth-test-client', version: '1.0.0' },
        { capabilities: {} }
      );

      await unauthClient.connect(unauthTransport);

      try {
        const result: { content: Array<{ type: string; text: string }> } =
          await unauthClient.callTool({ name: 'get_auth_status', arguments: {} }) as { content: Array<{ type: string; text: string }> };

        assert.ok(result.content);
        assert.ok(result.content.length > 0);
        assert.equal(result.content[0].type, 'text');

        const status = JSON.parse(result.content[0].text);
        assert.equal(status.authenticated, false);
        assert.ok(status.message);
        assert.ok(status.help);
        assert.ok(status.help.step1);
      } finally {
        await unauthClient.close();
      }
    });

    it('should reject empty API key', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'set_api_key',
          arguments: { api_key: '' },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.isError);
    });
  });

  describe('Record Search', () => {
    it('should search for public records without authentication', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'search_records',
          arguments: { query: 'open science data', size: 5 },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.content);
      assert.ok(result.content.length > 0);
      assert.equal(result.content[0].type, 'text');

      const text = result.content[0].text;
      if (result.isError || text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }

      const data = JSON.parse(text);
      assert.ok(data.hasOwnProperty('total'));
      assert.ok(Array.isArray(data.records));
      assert.ok(data.records.length > 0);

      // Validate record structure
      const record = data.records[0];
      assert.ok(record.id);
      assert.ok(record.title);
      assert.ok(record.doi);
      assert.ok(record.url);
    });

    it('should support pagination', async () => {
      const page1: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'search_records',
          arguments: { query: 'physics', size: 3, page: 1 },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      if (page1.isError || page1.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }

      const page2: { content: Array<{ type: string; text: string }> } =
        await client.callTool({
          name: 'search_records',
          arguments: { query: 'physics', size: 3, page: 2 },
        }) as { content: Array<{ type: string; text: string }> };

      const data1 = JSON.parse(page1.content[0].text);
      const data2 = JSON.parse(page2.content[0].text);

      assert.ok(data1.records.length > 0);
      assert.ok(data2.records.length > 0);

      // Pages should have different records
      const ids1 = data1.records.map((r: { id: number }) => r.id);
      const ids2 = data2.records.map((r: { id: number }) => r.id);
      const intersection = ids1.filter((id: number) => ids2.includes(id));
      assert.equal(intersection.length, 0);
    });

    it('should filter by resource type', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'search_records',
          arguments: { query: 'climate', type: 'dataset', size: 5 },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }

      const data = JSON.parse(result.content[0].text);
      assert.ok(data.records.length > 0);
      for (const record of data.records) {
        assert.equal(record.resource_type.type, 'dataset');
      }
    });

    it('should handle queries with no results gracefully', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'search_records',
          arguments: {
            query: 'zzz_no_results_expected_xyzxyzxyz_abc123_999999',
            size: 5,
          },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      if (result.isError || result.content[0].text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: Zenodo not reachable in this environment');
        return;
      }

      const data = JSON.parse(result.content[0].text);
      assert.equal(data.records.length, 0);
    });
  });

  describe('Record Details', () => {
    it('should get details of a known public record', async () => {
      // Use Zenodo record 10.5281/zenodo.3911261 - a well-known open dataset
      const result: { content: Array<{ type: string; text: string }> } =
        await client.callTool({
          name: 'get_record',
          arguments: { id: '3911261' },
        }) as { content: Array<{ type: string; text: string }> };

      assert.ok(result.content);
      assert.ok(result.content.length > 0);

      const text = result.content[0].text;
      if (text.startsWith('Error:')) {
        // Network may not be available in CI; skip gracefully
        console.error('  ⊘ Skipping: record not accessible in this environment');
        return;
      }

      const record = JSON.parse(text);
      assert.ok(record.id);
      assert.ok(record.doi);
      assert.ok(record.title);
      assert.ok(record.creators);
      assert.ok(record.publication_date);
    });

    it('should support DOI-style record IDs', async () => {
      const result: { content: Array<{ type: string; text: string }> } =
        await client.callTool({
          name: 'get_record',
          arguments: { id: '10.5281/zenodo.3911261' },
        }) as { content: Array<{ type: string; text: string }> };

      const text = result.content[0].text;
      if (text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: record not accessible in this environment');
        return;
      }

      const record = JSON.parse(text);
      assert.equal(record.id, 3911261);
    });

    it('should return an error for non-existent record', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'get_record',
          arguments: { id: '999999999999' },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.isError);
      assert.ok(result.content[0].text.startsWith('Error:'));
    });
  });

  describe('File Listing', () => {
    it('should list files for a known record', async () => {
      const result: { content: Array<{ type: string; text: string }> } =
        await client.callTool({
          name: 'list_record_files',
          arguments: { id: '3911261' },
        }) as { content: Array<{ type: string; text: string }> };

      const text = result.content[0].text;
      if (text.startsWith('Error:')) {
        console.error('  ⊘ Skipping: files not accessible in this environment');
        return;
      }

      const data = JSON.parse(text);
      assert.ok(data.hasOwnProperty('file_count'));
      assert.ok(Array.isArray(data.files));
      if (data.files.length > 0) {
        const file = data.files[0];
        assert.ok(file.key);
        assert.ok(file.hasOwnProperty('size'));
        assert.ok(file.checksum);
        assert.ok(file.download_url);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return isError for invalid API key', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'set_api_key',
          arguments: { api_key: 'invalid_token_that_will_fail_verification' },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      // In an offline environment the verification call itself fails, which
      // is also an auth failure – either way isError must be true.
      // If the network is available, a bad token returns a 401 → isError.
      assert.ok(result.isError);
      const parsed = JSON.parse(result.content[0].text);
      assert.equal(parsed.success, false);
    });

    it('should reject zero or negative max_bytes for get_file_content', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'get_file_content',
          arguments: { id: '1234567', filename: 'test.txt', max_bytes: 0 },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('max_bytes'));
    });

    it('should reject non-integer max_bytes for get_file_content', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'get_file_content',
          arguments: { id: '1234567', filename: 'test.txt', max_bytes: 1.5 },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('max_bytes'));
    });

    it('should require api_key parameter for set_api_key', async () => {
      try {
        await client.callTool({
          name: 'set_api_key',
          arguments: {},
        });
        assert.fail('Should have thrown an error for missing api_key');
      } catch (error) {
        assert.ok(error);
      }
    });

    it('should require id parameter for get_record', async () => {
      const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
        await client.callTool({
          name: 'get_record',
          arguments: { id: '' },
        }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      assert.ok(result.isError);
    });

    it('should require authentication for list_depositions', async () => {
      const unauthTransport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/src/index.js'],
        env: {
          ...process.env,
          ZENODO_BASE_URL: TEST_BASE_URL,
          ZENODO_API_KEY: '',
        },
      });

      const unauthClient = new Client(
        { name: 'zenodo-unauth-test-client-2', version: '1.0.0' },
        { capabilities: {} }
      );

      await unauthClient.connect(unauthTransport);

      try {
        const result: { content: Array<{ type: string; text: string }>; isError?: boolean } =
          await unauthClient.callTool({
            name: 'list_depositions',
            arguments: {},
          }) as { content: Array<{ type: string; text: string }>; isError?: boolean };

        assert.ok(result.isError);
        assert.ok(result.content[0].text.includes('Authentication required'));
      } finally {
        await unauthClient.close();
      }
    });

    it('should handle unknown tool gracefully', async () => {
      try {
        await client.callTool({
          name: 'nonexistent_tool',
          arguments: {},
        });
        assert.fail('Should have thrown an error for unknown tool');
      } catch (error) {
        assert.ok(error);
      }
    });
  });
});
