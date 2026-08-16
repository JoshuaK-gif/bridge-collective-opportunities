import { createHmac, randomBytes } from 'crypto';
import { query } from './db.js';
import logger from './logger.js';

async function getSocialAccounts() {
  const result = await query("SELECT value FROM site_settings WHERE key = 'social_accounts'");
  if (!result.rows.length) return null;
  const val = result.rows[0].value;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function oauth1Header(method, url, body, consumerKey, consumerSecret, token, tokenSecret) {
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_token: token,
    oauth_version: '1.0',
  };

  const allParams = { ...params };
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      allParams[k] = v;
    }
  }

  const paramString = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  params.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ');

  return authHeader;
}

export async function postToTwitter(account, title, link) {
  if (!account?.enabled || !account.api_key || !account.api_key_secret || !account.access_token || !account.access_token_secret) {
    return { success: false, reason: 'Twitter requires API key + secret + access token + secret (OAuth 1.0a)' };
  }
  const text = `${title}\n\n${link}`.slice(0, 280);
  const url = 'https://api.twitter.com/2/tweets';
  const body = { text };
  try {
    const authHeader = oauth1Header(
      'POST', url, body,
      account.api_key, account.api_key_secret,
      account.access_token, account.access_token_secret
    );
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      logger.error({ err }, 'Twitter post failed');
      return { success: false, reason: err };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, 'Twitter post error');
    return { success: false, reason: err.message };
  }
}

export async function postToLinkedIn(account, title, description, link) {
  if (!account?.enabled || !account.access_token) {
    return { success: false, reason: 'LinkedIn not configured' };
  }
  try {
    const resp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: `urn:li:person:${account.person_id}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: `${title}\n\n${description?.slice(0, 300)}...`,
            },
            shareMediaCategory: 'ARTICLE',
            media: [{
              status: 'READY',
              originalUrl: link,
            }],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      logger.error({ err }, 'LinkedIn post failed');
      return { success: false, reason: err };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, 'LinkedIn post error');
    return { success: false, reason: err.message };
  }
}

export async function postToWhatsApp(account, title, description, link) {
  if (!account?.enabled || !account.access_token || !account.phone_number_id) {
    return { success: false, reason: 'WhatsApp not configured' };
  }
  const message = `*${title}*\n\n${description?.slice(0, 500)}...\n\n🔗 ${link}`.slice(0, 4096);
  const to = account.target_phone || account.group_id;
  if (!to) return { success: false, reason: 'No target phone or group ID' };

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v22.0/${account.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      logger.error({ err }, 'WhatsApp send failed');
      return { success: false, reason: err };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, 'WhatsApp error');
    return { success: false, reason: err.message };
  }
}

export async function postToInstagram(account, title, description, link, imageUrl = '') {
  if (!account?.enabled || !account.access_token || !account.instagram_id) {
    return { success: false, reason: 'Instagram not configured' };
  }
  const caption = `${title}\n\n${description?.slice(0, 200)}...\n\nLink in bio: ${link}`.slice(0, 2200);
  try {
    const mediaResp = await fetch(
      `https://graph.facebook.com/v22.0/${account.instagram_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl || account.default_image_url || 'https://bridgejobs.ug/og-image.jpg',
          caption,
          access_token: account.access_token,
        }),
      }
    );
    if (!mediaResp.ok) {
      const err = await mediaResp.text();
      logger.error({ err }, 'Instagram media create failed');
      return { success: false, reason: err };
    }
    const mediaData = await mediaResp.json();
    const publishResp = await fetch(
      `https://graph.facebook.com/v22.0/${account.instagram_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: mediaData.id, access_token: account.access_token }),
      }
    );
    if (!publishResp.ok) {
      const err = await publishResp.text();
      logger.error({ err }, 'Instagram publish failed');
      return { success: false, reason: err };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, 'Instagram post error');
    return { success: false, reason: err.message };
  }
}

export async function postToFacebook(account, title, description, link) {
  if (!account?.enabled || !account.access_token || !account.page_id) {
    return { success: false, reason: 'Facebook not configured' };
  }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v22.0/${account.page_id}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${title}\n\n${description?.slice(0, 300)}...\n\n${link}`,
          link,
          access_token: account.access_token,
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      logger.error({ err }, 'Facebook post failed');
      return { success: false, reason: err };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, 'Facebook post error');
    return { success: false, reason: err.message };
  }
}

export async function publishToSocial(title, description, link, imageUrl = '') {
  const accounts = await getSocialAccounts();
  if (!accounts) return { twitter: false, linkedin: false, facebook: false, instagram: false, whatsapp: false };

  const results = {};
  if (accounts.twitter?.enabled) {
    results.twitter = await postToTwitter(accounts.twitter, title, link);
  }
  if (accounts.linkedin?.enabled) {
    results.linkedin = await postToLinkedIn(accounts.linkedin, title, description, link);
  }
  if (accounts.facebook?.enabled) {
    results.facebook = await postToFacebook(accounts.facebook, title, description, link);
  }
  if (accounts.instagram?.enabled) {
    results.instagram = await postToInstagram(accounts.instagram, title, description, link, imageUrl);
  }
  if (accounts.whatsapp?.enabled) {
    results.whatsapp = await postToWhatsApp(accounts.whatsapp, title, description, link);
  }
  return results;
}

export default { publishToSocial };
