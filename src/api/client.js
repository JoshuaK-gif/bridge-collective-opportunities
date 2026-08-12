const API_URL = '/api';

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

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
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

const apiBase = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export const api = {
  request: (path, options) => request(path, options),
  auth: {
    me: async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      return request('/auth/me');
    },
    login: async (email, password) => {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(data.access_token);
      return data;
    },
    logout: () => {
      setToken(null);
      window.location.href = '/';
    },
  },
  upload: {
    image: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Upload failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    opportunityImage: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/upload/opportunity-image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Upload failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
  },
  categories: {
    list: () => request('/categories'),
    get: (id) => request(`/categories/${id}`),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  messages: {
    list: () => request('/messages'),
    markRead: (id) => request(`/messages/${id}/read`, { method: 'PUT' }),
    delete: (id) => request(`/messages/${id}`, { method: 'DELETE' }),
    deleteBulk: (ids) => request('/messages/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    send: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  },
  settings: {
    getAll: () => request('/settings'),
    get: (key) => request(`/settings/${key}`),
    update: (key, value) => request(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  },
  subscribers: {
    subscribe: (email, source = '') => request('/subscribers', { method: 'POST', body: JSON.stringify({ email, source_page: source || window.location.pathname, referrer: document.referrer ? new URL(document.referrer).pathname : '' }) }),
    list: () => request('/subscribers'),
    delete: (id) => request(`/subscribers/${id}`, { method: 'DELETE' }),
    deleteBulk: (ids) => request('/subscribers/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },
  scraper: {
    preview: () => request('/scraper/feed/preview'),
    process: (sourceId) => request('/scraper/process', { method: 'POST', body: JSON.stringify({ sourceId }) }),
    processAll: () => request('/scraper/process-all', { method: 'POST' }),
    posts: () => request('/scraper/posts'),
    logs: () => request('/scraper/logs'),
    socialPost: (id) => request(`/scraper/social/${id}`, { method: 'POST' }),
    scrapeUrl: (url) => request('/scraper/scrape-url', { method: 'POST', body: JSON.stringify({ url }) }),
    drafts: () => request('/scraper/drafts'),
    getDraft: (id) => request(`/scraper/drafts/${id}`),
    updateDraft: (id, data) => request(`/scraper/drafts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    publishDraft: (id) => request(`/scraper/drafts/${id}/publish`, { method: 'POST' }),
    republishDraft: (id) => request(`/scraper/drafts/${id}/republish`, { method: 'POST' }),
    deleteDraft: (id) => request(`/scraper/drafts/${id}`, { method: 'DELETE' }),
    enrichDraft: (id) => request(`/scraper/drafts/${id}/enrich`, { method: 'POST' }),
  },
  lists: {
    list: () => request('/lists'),
    get: (id) => request(`/lists/${id}`),
    getBySlug: (slug) => request(`/lists/slug/${slug}`),
    create: (data) => request('/lists', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/lists/${id}`, { method: 'DELETE' }),
    addItem: (listId, opportunityId) => request(`/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ opportunity_id: opportunityId }) }),
    removeItem: (listId, itemId) => request(`/lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
    reorderItem: (listId, itemId, sortOrder) => request(`/lists/${listId}/items/${itemId}/reorder`, { method: 'PUT', body: JSON.stringify({ sort_order: sortOrder }) }),
  },
  opportunities: {
    list: (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.category) params.set('category', opts.category);
      if (opts.search) params.set('search', opts.search);
      if (opts.trending) params.set('trending', 'true');
      if (opts.featured) params.set('featured', 'true');
      if (opts.all) params.set('all', 'true');
      if (opts.expiringSoon) params.set('expiring_soon', 'true');
      if (opts.expiringWithin) params.set('expiring_within', String(opts.expiringWithin));
      const qs = params.toString();
      return request(`/opportunities${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/opportunities/${id}`),
    create: (data) => request('/opportunities', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/opportunities/${id}`, { method: 'DELETE' }),
    deleteBulk: (ids) => request('/opportunities/bulk/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    bulkUpdate: (ids, data) => request('/opportunities/bulk/update', { method: 'POST', body: JSON.stringify({ ids, data }) }),
    enrich: (id) => request(`/opportunities/${id}/enrich`, { method: 'POST' }),
    duplicate: (id) => request(`/opportunities/${id}/duplicate`, { method: 'POST' }),
    bulkPublish: (ids) => request('/opportunities/bulk/publish', { method: 'POST', body: JSON.stringify({ ids }) }),
    cloneFromUrl: (url) => request('/opportunities/clone-from-url', { method: 'POST', body: JSON.stringify({ url }) }),
    checkDuplicates: (params) => request(`/opportunities/check-duplicates?${new URLSearchParams(params)}`),
    submit: (data) => request('/opportunities/submit', { method: 'POST', body: JSON.stringify(data) }),
  },
  reminders: {
    create: (data) => request('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  },
  resumes: {
    save: (data, token) => request('/resumes', { method: 'POST', body: JSON.stringify({ data, token }) }),
    load: (token) => request(`/resumes/${token}`),
    delete: (token) => request(`/resumes/${token}`, { method: 'DELETE' }),
  },
  cv: {
    downloadPdf: (cv) => request('/cv/pdf', { method: 'POST', body: JSON.stringify(cv), parseJson: false }),
  },
  ai: {
    atsScan: (cv, jobDescription) => request('/ai/ats-scan', { method: 'POST', body: JSON.stringify({ cv, jobDescription }) }),
    cvFeedback: (cv) => request('/ai/cv-feedback', { method: 'POST', body: JSON.stringify({ cv }) }),
    generateSummary: (cv) => request('/ai/generate-summary', { method: 'POST', body: JSON.stringify({ cv }) }),
    suggestSkills: (title, existingSkills = []) => request('/ai/suggest-skills', { method: 'POST', body: JSON.stringify({ title, existingSkills }) }),
    rewrite: (text, field = 'text', tone = 'professional') => request('/ai/rewrite', { method: 'POST', body: JSON.stringify({ text, field, tone }) }),
    applicationAssist: (opportunity) => request('/ai/application-assist', { method: 'POST', body: JSON.stringify(opportunity) }),
    grantWrite: (data) => request('/ai/grant-write', { method: 'POST', body: JSON.stringify(data) }),
    grantPolish: (text, section, tone) => request('/ai/grant-polish', { method: 'POST', body: JSON.stringify({ text, section, tone }) }),
    grantGenerate: (data) => request('/ai/grant-generate', { method: 'POST', body: JSON.stringify(data) }),
    extractFromUrl: (url) => request('/ai/extract-from-url', { method: 'POST', body: JSON.stringify({ url }) }),
  },
  templates: {
    list: () => request('/templates'),
    get: (id) => request(`/templates/${id}`),
    create: (data) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  },
  news: {
    list: (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.limit) params.set('limit', opts.limit);
      const qs = params.toString();
      return request(`/news${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/news/${id}`),
    create: (data) => request('/news', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/news/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/news/${id}`, { method: 'DELETE' }),
  },
};
