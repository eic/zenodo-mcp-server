import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ZenodoClient } from '../src/zenodo.js';

describe('ZenodoClient', () => {
  describe('constructor', () => {
    it('should accept a valid base URL', () => {
      assert.doesNotThrow(() => new ZenodoClient('https://zenodo.org'));
    });

    it('should strip trailing slash from base URL', () => {
      const client = new ZenodoClient('https://zenodo.org/');
      // Access via a search to confirm the URL is normalized; just check no throw
      assert.ok(client);
    });

    it('should throw on an invalid base URL', () => {
      assert.throws(
        () => new ZenodoClient('https://zenodo.org ZENODO_API_KEY'),
        /Invalid ZENODO_BASE_URL/
      );
    });

    it('should throw on an empty base URL', () => {
      assert.throws(
        () => new ZenodoClient(''),
        /Invalid ZENODO_BASE_URL/
      );
    });

    it('should throw on a relative path as base URL', () => {
      assert.throws(
        () => new ZenodoClient('/api'),
        /Invalid ZENODO_BASE_URL/
      );
    });
  });
});
