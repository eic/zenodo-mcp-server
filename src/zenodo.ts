export interface ZenodoCreator {
  name: string;
  affiliation?: string;
  orcid?: string;
}

export interface ZenodoMetadata {
  title: string;
  description: string;
  creators: ZenodoCreator[];
  keywords?: string[];
  publication_date: string;
  resource_type: { type: string; subtype?: string };
  access_right: string;
  license?: { id: string };
  version?: string;
  language?: string;
  communities?: Array<{ identifier: string }>;
  related_identifiers?: Array<{
    identifier: string;
    relation: string;
    scheme: string;
  }>;
  references?: string[];
  journal?: {
    title?: string;
    volume?: string;
    issue?: string;
    pages?: string;
  };
}

export interface ZenodoFile {
  id: string;
  key: string;
  size: number;
  checksum: string;
  links: {
    self: string;
  };
}

export interface ZenodoRecord {
  id: number;
  conceptrecid: string;
  conceptdoi?: string;
  doi: string;
  doi_url: string;
  metadata: ZenodoMetadata;
  links: {
    self: string;
    self_html?: string;
    html?: string;
    files: string;
    badge?: string;
    conceptbadge?: string;
    thumb250?: string;
    concepthtml?: string;
    latest?: string;
    latest_html?: string;
  };
  files?: ZenodoFile[];
  stats?: {
    version_downloads: number;
    unique_downloads: number;
    version_unique_downloads: number;
    unique_views: number;
    version_views: number;
    version_unique_views: number;
    volume: number;
    version_volume: number;
  };
  created: string;
  updated: string;
  revision: number;
  owners?: number[];
}

export interface SearchResult {
  hits: {
    hits: ZenodoRecord[];
    total: number;
  };
  links: {
    self: string;
    next?: string;
    prev?: string;
  };
  aggregations?: Record<string, unknown>;
}

/**
 * Metadata fields accepted by the Zenodo deposition API.
 * These differ from ZenodoMetadata (used for published records):
 *  - upload_type / publication_type / image_type instead of resource_type
 *  - license is a plain id string, not an object
 */
export interface ZenodoDepositionMetadata {
  upload_type?: string;
  publication_type?: string;
  image_type?: string;
  title?: string;
  description?: string;
  creators?: ZenodoCreator[];
  publication_date?: string;
  access_right?: string;
  license?: string;
  embargo_date?: string;
  access_conditions?: string;
  doi?: string;
  preserve_doi?: boolean;
  keywords?: string[];
  notes?: string;
  related_identifiers?: Array<{
    identifier: string;
    relation: string;
    scheme: string;
  }>;
  contributors?: Array<{
    name: string;
    type: string;
    affiliation?: string;
    orcid?: string;
  }>;
  references?: string[];
  communities?: Array<{ identifier: string }>;
  grants?: Array<{ id: string }>;
  version?: string;
  language?: string;
  [key: string]: unknown;
}

export interface ZenodoDeposition {
  id: number;
  conceptrecid: string;
  doi?: string;
  doi_url?: string;
  metadata: ZenodoDepositionMetadata;
  title: string;
  links: {
    self: string;
    self_html?: string;
    html?: string;
    badge: string;
    files: string;
    bucket: string;
    latest_draft: string;
    latest_draft_html: string;
    publish: string;
    edit: string;
    discard: string;
    newversion: string;
    registerconceptdoi: string;
  };
  state: string;
  submitted: boolean;
  created: string;
  modified: string;
  owner: number;
}

export interface FileDownloadResult {
  content: string;
  mimeType: string;
  truncated: boolean;
  encoding: 'utf-8' | 'base64';
}

export interface AuthStatus {
  authenticated: boolean;
  user?: Record<string, unknown>;
  message: string;
}

export class ZenodoClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(
    baseUrl: string = 'https://zenodo.org',
    apiKey: string | null = null
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  setApiKey(key: string | null): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  isAuthenticated(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...((options?.headers as Record<string, string>) || {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = await response.text();
        errorMessage += `: ${errorBody}`;
      } catch {
        // Ignore body parse errors
      }
      throw new Error(`Zenodo API error ${errorMessage}`);
    }

    return response.json() as Promise<T>;
  }

  async checkAuthStatus(): Promise<AuthStatus> {
    if (!this.isAuthenticated()) {
      return {
        authenticated: false,
        message:
          'No API key configured. Use the set_api_key tool to provide one ' +
          'for this session, or set the ZENODO_API_KEY environment variable ' +
          'for a persistent service account. You can create a personal access ' +
          'token at https://zenodo.org/account/settings/applications/tokens/new/',
      };
    }

    try {
      const url = this.buildUrl('/api/me');
      const user = await this.request<Record<string, unknown>>(url);
      const email = (user.email as string) || '';
      const username = (user.username as string) || '';
      return {
        authenticated: true,
        user,
        message: `Authenticated as ${email || username || 'user'}`,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        authenticated: false,
        message: `API key is set but authentication failed: ${msg}`,
      };
    }
  }

  async searchRecords(
    query: string,
    options: {
      page?: number;
      size?: number;
      sort?: string;
      communities?: string;
      type?: string;
      subtype?: string;
      allVersions?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const params: Record<string, string> = { q: query };
    if (options.page !== undefined) params.page = String(options.page);
    if (options.size !== undefined) params.size = String(options.size);
    if (options.sort) params.sort = options.sort;
    if (options.communities) params.communities = options.communities;
    if (options.type) params.type = options.type;
    if (options.subtype) params.subtype = options.subtype;
    if (options.allVersions) params.all_versions = '1';

    const url = this.buildUrl('/api/records', params);
    return this.request<SearchResult>(url);
  }

  async getRecord(id: string | number): Promise<ZenodoRecord> {
    const url = this.buildUrl(`/api/records/${id}`);
    return this.request<ZenodoRecord>(url);
  }

  async listRecordFiles(id: string | number): Promise<ZenodoFile[]> {
    const url = this.buildUrl(`/api/records/${id}/files`);
    const result = await this.request<{ entries: ZenodoFile[] }>(url);
    return result.entries || [];
  }

  async getFileContent(
    fileUrl: string,
    maxBytes?: number
  ): Promise<FileDownloadResult> {
    const headers: Record<string, string> = { ...this.getHeaders() };
    delete headers['Content-Type'];

    if (maxBytes !== undefined) {
      if (
        typeof maxBytes !== 'number' ||
        !Number.isFinite(maxBytes) ||
        !Number.isInteger(maxBytes) ||
        maxBytes <= 0
      ) {
        throw new Error('maxBytes must be a finite positive integer');
      }
      headers['Range'] = `bytes=0-${maxBytes - 1}`;
    }

    const response = await fetch(fileUrl, { headers });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to download file: HTTP ${response.status}`);
    }

    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    // Stream the response body, stopping after maxBytes to reliably cap
    // memory usage even when the server ignores the Range header.
    const body = response.body;
    if (!body) {
      throw new Error('Failed to download file: missing response body');
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    const limit = maxBytes ?? Number.POSITIVE_INFINITY;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.length === 0) {
        continue;
      }

      if (received + value.length <= limit) {
        chunks.push(value);
        received += value.length;
      } else {
        const remaining = limit - received;
        if (remaining > 0) {
          chunks.push(value.subarray(0, remaining));
          received += remaining;
        }
        truncated = maxBytes !== undefined;
        await reader.cancel();
        break;
      }
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    if (maxBytes !== undefined && received >= maxBytes) {
      truncated = true;
    }

    // Attempt UTF-8 text decode; fall back to base64 for binary files
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const text = decoder.decode(bytes);
      return { content: text, mimeType: contentType, truncated, encoding: 'utf-8' };
    } catch {
      const base64 = Buffer.from(bytes).toString('base64');
      return {
        content: base64,
        mimeType: contentType,
        truncated,
        encoding: 'base64',
      };
    }
  }

  async listDepositions(
    options: {
      q?: string;
      status?: string;
      sort?: string;
      page?: number;
      size?: number;
    } = {}
  ): Promise<ZenodoDeposition[]> {
    if (!this.isAuthenticated()) {
      throw new Error(
        'Authentication required to list depositions. Use set_api_key to provide an API key.'
      );
    }

    const params: Record<string, string> = {};
    if (options.q) params.q = options.q;
    if (options.status) params.status = options.status;
    if (options.sort) params.sort = options.sort;
    if (options.page !== undefined) params.page = String(options.page);
    if (options.size !== undefined) params.size = String(options.size);

    const url = this.buildUrl('/api/deposit/depositions', params);
    return this.request<ZenodoDeposition[]>(url);
  }

  // ── Write operations ─────────────────────────────────────────────────────

  private requireAuth(): void {
    if (!this.isAuthenticated()) {
      throw new Error(
        'Authentication required. Use set_api_key or set the ZENODO_API_KEY environment variable.'
      );
    }
  }

  async createDeposition(
    metadata?: ZenodoDepositionMetadata
  ): Promise<ZenodoDeposition> {
    this.requireAuth();
    const body = metadata ? { metadata } : {};
    const url = this.buildUrl('/api/deposit/depositions');
    return this.request<ZenodoDeposition>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getDeposition(id: string | number): Promise<ZenodoDeposition> {
    this.requireAuth();
    const url = this.buildUrl(`/api/deposit/depositions/${id}`);
    return this.request<ZenodoDeposition>(url);
  }

  async updateDeposition(
    id: string | number,
    metadata: ZenodoDepositionMetadata
  ): Promise<ZenodoDeposition> {
    this.requireAuth();
    const url = this.buildUrl(`/api/deposit/depositions/${id}`);
    return this.request<ZenodoDeposition>(url, {
      method: 'PUT',
      body: JSON.stringify({ metadata }),
    });
  }

  async deleteDeposition(id: string | number): Promise<void> {
    this.requireAuth();
    const url = this.buildUrl(`/api/deposit/depositions/${id}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        errorMessage += `: ${await response.text()}`;
      } catch { /* ignore */ }
      throw new Error(`Zenodo API error ${errorMessage}`);
    }
  }

  private async depositionAction(
    id: string | number,
    action: string
  ): Promise<ZenodoDeposition> {
    this.requireAuth();
    const url = this.buildUrl(`/api/deposit/depositions/${id}/actions/${action}`);
    return this.request<ZenodoDeposition>(url, { method: 'POST', body: '{}' });
  }

  async publishDeposition(id: string | number): Promise<ZenodoDeposition> {
    return this.depositionAction(id, 'publish');
  }

  async editDeposition(id: string | number): Promise<ZenodoDeposition> {
    return this.depositionAction(id, 'edit');
  }

  async discardDeposition(id: string | number): Promise<ZenodoDeposition> {
    return this.depositionAction(id, 'discard');
  }

  async newVersion(id: string | number): Promise<ZenodoDeposition> {
    return this.depositionAction(id, 'newversion');
  }

  async uploadFile(
    bucketUrl: string,
    filename: string,
    content: string,
    encoding: 'utf-8' | 'base64' = 'utf-8'
  ): Promise<ZenodoFile> {
    this.requireAuth();

    // Validate bucketUrl to prevent SSRF: must be https, same host as baseUrl,
    // and path must begin with /api/files/
    const baseOrigin = new URL(this.baseUrl).origin;
    let parsedBucket: URL;
    try {
      parsedBucket = new URL(bucketUrl);
    } catch {
      throw new Error('bucket_url is not a valid URL');
    }
    if (parsedBucket.protocol !== 'https:') {
      throw new Error('bucket_url must use the https scheme');
    }
    if (parsedBucket.origin !== baseOrigin) {
      throw new Error(`bucket_url host must match the configured Zenodo host (${baseOrigin})`);
    }
    if (!parsedBucket.pathname.startsWith('/api/files/')) {
      throw new Error('bucket_url path must start with /api/files/');
    }

    const bytes =
      encoding === 'base64'
        ? Buffer.from(content, 'base64')
        : Buffer.from(content, 'utf-8');

    const headers: Record<string, string> = { ...this.getHeaders() };
    delete headers['Content-Type']; // Let fetch set it for binary upload
    headers['Content-Type'] = 'application/octet-stream';

    const url = `${bucketUrl.replace(/\/$/, '')}/${encodeURIComponent(filename)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: bytes,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        errorMessage += `: ${await response.text()}`;
      } catch { /* ignore */ }
      throw new Error(`Zenodo API error ${errorMessage}`);
    }

    return response.json() as Promise<ZenodoFile>;
  }

  async deleteDepositionFile(
    depositionId: string | number,
    fileId: string
  ): Promise<void> {
    this.requireAuth();
    const url = this.buildUrl(
      `/api/deposit/depositions/${depositionId}/files/${fileId}`
    );
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        errorMessage += `: ${await response.text()}`;
      } catch { /* ignore */ }
      throw new Error(`Zenodo API error ${errorMessage}`);
    }
  }
}
