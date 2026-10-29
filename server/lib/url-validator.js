const PRIVATE_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
];

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc * 256) + parseInt(octet, 10), 0);
}

function isPrivateIP(ip) {
  const num = ipToNumber(ip);
  return PRIVATE_IP_RANGES.some(range => {
    const start = ipToNumber(range.start);
    const end = ipToNumber(range.end);
    return num >= start && num <= end;
  });
}

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_HOSTNAMES = [
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  '100.100.100.200',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
];

const BLOCKED_HOSTNAME_PATTERNS = [
  /\.internal$/,
  /\.local$/,
  /^metadata\./,
];

export function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  let url;
  try {
    url = new URL(urlString.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return { valid: false, error: 'Only http and https URLs are allowed' };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'This URL is not allowed' };
  }

  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'This URL is not allowed' };
    }
  }

  try {
    const ip = hostname;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && isPrivateIP(ip)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
  } catch {}

  return { valid: true, url };
}

const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Fetch a URL with SSRF protection:
 * - every hop (including redirects) is re-validated via validateUrl
 * - response body is stream-read with a hard size cap
 */
export async function safeFetch(urlString, { maxRedirects = MAX_REDIRECTS, maxBytes = DEFAULT_MAX_BYTES, timeoutMs = 15000, headers = {} } = {}) {
  let current = urlString;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validation = validateUrl(current);
    if (!validation.valid) throw new Error(validation.error);

    const response = await fetch(current, {
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const declared = parseInt(response.headers.get('content-length') || '0', 10);
    if (declared > maxBytes) throw new Error('Response too large');

    if (!response.body) return { text: '', response };
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('Response too large');
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { text: new TextDecoder().decode(merged), response };
  }
  throw new Error('Too many redirects');
}
