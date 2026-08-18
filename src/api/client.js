const API_URL = '/api';

// Nhost Auth — sign-in happens directly with Nhost from the browser.
// https://<subdomain>.auth.<region>.nhost.run/v1
const NHOST_AUTH_URL =
  import.meta.env?.VITE_NHOST_AUTH_URL ||
  'https://ybgaidcwksqeuojraxoe.auth.ap-southeast-1.nhost.run/v1';

function getToken() {
  return localStorage.getItem('bridge_jobs_token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('bridge_jobs_token', token);
  } else {
    localStorage.removeItem('bridge_jobs_token');
  }
}

function getRefreshToken() {
  return localStorage.getItem('bridge_jobs_refresh');
}

function setRefreshToken(token) {
  if (token) {
    localStorage.setItem('bridge_jobs_refresh', token);
  } else {
    localStorage.removeItem('bridge_jobs_refresh');
  }
}

/** Refresh the Nhost access token using the stored refresh token. */
async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${NHOST_AUTH_URL}/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.session?.accessToken) return false;
    setToken(data.session.accessToken);
    if (data.session.refreshToken) setRefreshToken(data.session.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request(path, options = {}, _retried = false) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Nhost access tokens expire (~15 min). On a 401, refresh once and retry.
  if (res.status === 401 && !_retried && (await refreshSession())) {
    return request(path, options, true);
  }

  if (options.parseJson === false) {
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  }
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'API Error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Build a query string for GET requests to the Nhost functions. */
function qs(params) {
  const url = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.set(k, String(v));
  }
  const s = url.toString();
  return s ? `?${s}` : '';
}

/**
 * Direct-to-Cloudinary upload. Nhost Functions can't receive multipart, so we
 * fetch a signed upload (signature + timestamp) from the backend, then POST the
 * file straight to Cloudinary from the browser.
 */
async function uploadToCloudinary(file, folder = 'bridge-jobs') {
  const sig = await request('/admin', {
    method: 'POST',
    body: JSON.stringify({ resource: 'upload', action: 'signature', folder }),
  });
  if (!sig.cloud_name || !sig.signature) {
    throw new Error('Upload is not configured. Ask the admin to add Cloudinary keys.');
  }
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  if (sig.upload_preset) form.append('upload_preset', sig.upload_preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return {
    url: data.secure_url || data.url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
  };
}

/** AI / GrantKit / PDF features are not deployed on this backend. */
function disabled(feature) {
  return async () => {
    throw new Error(`${feature} is not available on this deployment.`);
  };
}

export const api = {
  request: (path, options) => request(path, options),
  home: () => request(`/content${qs({ resource: 'home' })}`),
  auth: {
    me: async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      return request(`/auth${qs({ action: 'me' })}`);
    },
    /** Sign in with Nhost Auth — returns the session. */
    login: async (email, password) => {
      const res = await fetch(`${NHOST_AUTH_URL}/signin/email-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.session?.accessToken) {
        const err = new Error(data.message || data.error || 'Invalid email or password');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      setToken(data.session.accessToken);
      setRefreshToken(data.session.refreshToken);
      return data.session;
    },
    logout: async () => {
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          await fetch(`${NHOST_AUTH_URL}/signout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch {}
      setToken(null);
      setRefreshToken(null);
      window.location.href = '/';
    },
  },
  upload: {
    image: (file) => uploadToCloudinary(file, 'bridge-jobs'),
    opportunityImage: (file) => uploadToCloudinary(file, 'bridge-jobs'),
    cvPhoto: (file) => uploadToCloudinary(file, 'cv-photos'),
  },
  categories: {
    list: () => request(`/content${qs({ resource: 'categories' })}`),
    get: (id) => request(`/content${qs({ resource: 'category', id })}`),
    create: (data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'category', action: 'create', ...data }) }),
    update: (id, data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'category', action: 'update', id, ...data }) }),
    delete: (id) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'category', action: 'delete', id }) }),
  },
  messages: {
    list: () => request(`/admin${qs({ resource: 'messages' })}`),
    markRead: (id) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'message', action: 'mark-read', id }) }),
    delete: (id) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'message', action: 'delete', id }) }),
    deleteBulk: (ids) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'message', action: 'bulk-delete', ids }) }),
    send: (data) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'message', action: 'send', ...data }) }),
  },
  settings: {
    getAll: () => request(`/admin${qs({ resource: 'settings' })}`),
    get: (key) => request(`/admin${qs({ resource: 'setting', key })}`),
    update: (key, value) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'setting', action: 'update', key, value }) }),
  },
  subscribers: {
    subscribe: (email, source = '') => request('/admin', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'subscriber',
        action: 'subscribe',
        email,
        source_page: source || window.location.pathname,
        referrer: document.referrer ? new URL(document.referrer).pathname : '',
      }),
    }),
    list: () => request(`/admin${qs({ resource: 'subscribers' })}`),
    delete: (id) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'subscriber', action: 'delete', id }) }),
    deleteBulk: (ids) => request('/admin', { method: 'POST', body: JSON.stringify({ resource: 'subscriber', action: 'bulk-delete', ids }) }),
  },
  scraper: {
    preview: () => request(`/scraper${qs({ resource: 'feed-preview' })}`),
    process: (sourceId) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'process', sourceId }) }),
    processAll: () => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'process-all' }) }),
    posts: () => request(`/scraper${qs({ resource: 'posts' })}`),
    logs: () => request(`/scraper${qs({ resource: 'logs' })}`),
    socialPost: (id) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'social', id }) }),
    scrapeUrl: (url) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'scrape-url', url }) }),
    drafts: () => request(`/scraper${qs({ resource: 'drafts' })}`),
    getDraft: (id) => request(`/scraper${qs({ resource: 'draft', id })}`),
    updateDraft: (id, data) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'draft', action: 'update', id, ...data }) }),
    publishDraft: (id) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'draft', action: 'publish', id }) }),
    republishDraft: (id) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'draft', action: 'republish', id }) }),
    deleteDraft: (id) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'draft', action: 'delete', id }) }),
    enrichDraft: (id) => request('/scraper', { method: 'POST', body: JSON.stringify({ resource: 'draft', action: 'enrich', id }) }),
  },
  lists: {
    list: () => request(`/collections${qs({ resource: 'lists' })}`),
    get: (id) => request(`/collections${qs({ resource: 'list', id })}`),
    getBySlug: (slug) => request(`/collections${qs({ resource: 'list-by-slug', slug })}`),
    create: (data) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'create', ...data }) }),
    update: (id, data) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'update', id, ...data }) }),
    delete: (id) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'delete', id }) }),
    addItem: (listId, opportunityId) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'add-item', id: listId, opportunity_id: opportunityId }) }),
    removeItem: (listId, itemId) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'remove-item', list_id: listId, item_id: itemId }) }),
    reorderItem: (listId, itemId, sortOrder) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'list', action: 'reorder-item', list_id: listId, item_id: itemId, sort_order: sortOrder }) }),
  },
  opportunities: {
    list: (opts = {}) => {
      const params = {};
      if (opts.category) params.category = opts.category;
      if (opts.search) params.search = opts.search;
      if (opts.trending) params.trending = 'true';
      if (opts.featured) params.featured = 'true';
      if (opts.all) params.all = 'true';
      if (opts.expiringSoon) params.expiring_soon = 'true';
      if (opts.expiringWithin) params.expiring_within = String(opts.expiringWithin);
      return request(`/content${qs({ resource: 'opportunities', ...params })}`);
    },
    get: (id) => request(`/content${qs({ resource: 'opportunity', id })}`),
    create: (data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'create', ...data }) }),
    update: (id, data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'update', id, ...data }) }),
    delete: (id) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'delete', id }) }),
    deleteBulk: (ids) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'bulk-delete', ids }) }),
    bulkUpdate: (ids, data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'bulk-update', ids, data }) }),
    enrich: (id) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'enrich', id }) }),
    duplicate: (id) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'duplicate', id }) }),
    bulkPublish: (ids) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'bulk-publish', ids }) }),
    cloneFromUrl: (url) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'clone-from-url', url }) }),
    checkDuplicates: (params) => request(`/content${qs({ resource: 'check-duplicates', ...params })}`),
    related: (id) => request(`/content${qs({ resource: 'related', id })}`),
    submit: (data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'opportunity', action: 'submit', ...data }) }),
  },
  reminders: {
    create: (data) => request('/outreach', { method: 'POST', body: JSON.stringify({ resource: 'reminder', action: 'create', ...data }) }),
  },
  resumes: {
    save: (data, token) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'resume', action: 'save', data, token }) }),
    load: (token) => request(`/collections${qs({ resource: 'resume', token })}`),
    delete: (token) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'resume', action: 'delete', token }) }),
  },
  cv: {
    downloadPdf: disabled('PDF download'),
  },
  ai: {
    atsScan: disabled('AI ATS scan'),
    cvFeedback: disabled('AI CV feedback'),
    generateSummary: disabled('AI summary generation'),
    suggestSkills: disabled('AI skill suggestions'),
    rewrite: disabled('AI rewrite'),
    applicationAssist: disabled('AI application assist'),
    grantWrite: disabled('AI grant writing'),
    grantPolish: disabled('AI grant polishing'),
    grantGenerate: disabled('AI grant generation'),
    extractFromUrl: disabled('AI URL extraction'),
  },
  grantkit: {
    packs: disabled('GrantKit'),
    sections: disabled('GrantKit'),
    check: disabled('GrantKit'),
    build: disabled('GrantKit'),
  },
  templates: {
    list: () => request(`/collections${qs({ resource: 'templates' })}`),
    get: (id) => request(`/collections${qs({ resource: 'template', id })}`),
    create: (data) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'template', action: 'create', ...data }) }),
    update: (id, data) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'template', action: 'update', id, ...data }) }),
    delete: (id) => request('/collections', { method: 'POST', body: JSON.stringify({ resource: 'template', action: 'delete', id }) }),
  },
  news: {
    list: (opts = {}) => {
      const params = {};
      if (opts.limit) params.limit = opts.limit;
      return request(`/content${qs({ resource: 'news', ...params })}`);
    },
    get: (id) => request(`/content${qs({ resource: 'news-item', id })}`),
    create: (data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'news', action: 'create', ...data }) }),
    update: (id, data) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'news', action: 'update', id, ...data }) }),
    delete: (id) => request('/content', { method: 'POST', body: JSON.stringify({ resource: 'news', action: 'delete', id }) }),
  },
};
