import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ZenodoClient } from '../src/zenodo.js';

describe('ZenodoClient', () => {
  describe('constructor', () => {
    it('should accept a valid base URL', () => {
      assert.doesNotThrow(() => new ZenodoClient('https://zenodo.org'));
    });

    it('should accept a base URL with a trailing slash', () => {
      assert.doesNotThrow(() => new ZenodoClient('https://zenodo.org/'));
    });

    it('should throw on an invalid base URL', () => {
      assert.throws(
        () => new ZenodoClient('not a url'),
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

    it('should throw on a URL with a non-root path', () => {
      assert.throws(
        () => new ZenodoClient('https://example.com/api'),
        /Invalid ZENODO_BASE_URL/
      );
    });

    it('should throw on a URL with a query string', () => {
      assert.throws(
        () => new ZenodoClient('https://example.com?foo=1'),
        /Invalid ZENODO_BASE_URL/
      );
    });

    it('should throw on a URL with a fragment', () => {
      assert.throws(
        () => new ZenodoClient('https://example.com#frag'),
        /Invalid ZENODO_BASE_URL/
      );
    });

    it('should throw on a URL with credentials', () => {
      assert.throws(
        () => new ZenodoClient('https://user:pass@example.com'),
        /Invalid ZENODO_BASE_URL/
      );
    });
  });
});
