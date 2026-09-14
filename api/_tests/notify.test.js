/**
 * Tests for the instant new-opportunity subscriber notification.
 *
 * Run with: npm run test:api
 *
 * The DB module is mocked (via --experimental-test-module-mocks) and fetch is
 * stubbed, so these tests never touch a real database or send real email.
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

const state = {
  smtpConfig: { api_key: 'xkeysib-test', from_email: 'noreply@bridgecollectiveopport.org', from_name: 'Bridge Collective' },
  subscribers: [],
  settingsReads: 0,
};

// Register the DB mock before importing the module under test.
mock.module('../_db.js', {
  namedExports: {
    getPool: () => ({
      query: async (sql) => {
        if (sql.includes('site_settings')) {
          state.settingsReads++;
          return { rows: state.smtpConfig ? [{ value: state.smtpConfig }] : [] };
        }
        if (sql.includes('FROM subscribers')) {
          return { rows: state.subscribers };
        }
        throw new Error(`Unexpected query in test: ${sql}`);
      },
    }),
  },
});

const { notifyNewOpportunities } = await import('../_email.js');

let captured;
let inFlight;
let maxInFlight;

function stubFetch({ failFor = () => false, networkError = false } = {}) {
  captured = [];
  inFlight = 0;
  maxInFlight = 0;
  globalThis.fetch = async (_url, opts) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise(r => setTimeout(r, 5));
      if (networkError) throw new Error('ECONNRESET');
      const body = JSON.parse(opts.body);
      const to = body.to[0].email;
      captured.push(body);
      if (failFor(to)) {
        return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'rejected by provider' }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ messageId: 'msg-1' }) };
    } finally {
      inFlight--;
    }
  };
}

const opp = (i = 1) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`,
  title: `Opportunity ${i}`,
  description: '<p>Some <b>rich</b> description</p>',
  image_url: 'https://example.com/img.jpg',
  category: 'Scholarship',
  deadline: '2026-12-01',
});

beforeEach(() => {
  state.smtpConfig = { api_key: 'xkeysib-test', from_email: 'noreply@bridgecollectiveopport.org', from_name: 'Bridge Collective' };
  state.subscribers = [];
  state.settingsReads = 0;
  stubFetch();
});

describe('notifyNewOpportunities', () => {
  it('skips cleanly when SMTP is not configured', async () => {
    state.smtpConfig = null;
    state.subscribers = [{ id: 's1', email: 'a@example.com' }];

    const result = await notifyNewOpportunities([opp()]);

    assert.strictEqual(result.sent, 0);
    assert.strictEqual(result.skipped, true);
    assert.match(result.reason, /SMTP not configured/);
    assert.strictEqual(captured.length, 0, 'must not attempt any send');
  });

  it('skips cleanly when there are no active subscribers', async () => {
    state.subscribers = [];

    const result = await notifyNewOpportunities([opp()]);

    assert.strictEqual(result.sent, 0);
    assert.strictEqual(result.skipped, true);
    assert.match(result.reason, /No active subscribers/);
  });

  it('returns skipped for an empty opportunity list', async () => {
    state.subscribers = [{ id: 's1', email: 'a@example.com' }];

    const result = await notifyNewOpportunities([]);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(captured.length, 0);
  });

  it('sends exactly one email per subscriber', async () => {
    state.subscribers = [
      { id: 's1', email: 'one@example.com' },
      { id: 's2', email: 'two@example.com' },
      { id: 's3', email: 'three@example.com' },
    ];

    const result = await notifyNewOpportunities([opp()]);

    assert.deepStrictEqual(
      captured.map(c => c.to[0].email).sort(),
      ['one@example.com', 'three@example.com', 'two@example.com']
    );
    assert.strictEqual(result.sent, 3);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.total, 3);
  });

  it('titles a single-opportunity email after the opportunity', async () => {
    state.subscribers = [{ id: 's1', email: 'one@example.com' }];

    await notifyNewOpportunities([opp(7)]);

    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].subject, 'New: Opportunity 7');
    // Hero layout for a single post.
    assert.match(captured[0].htmlContent, /New Opportunity Available/);
    assert.match(captured[0].htmlContent, /Opportunity 7/);
  });

  it('sends ONE combined email listing every opportunity', async () => {
    state.subscribers = [{ id: 's1', email: 'one@example.com' }];

    await notifyNewOpportunities([opp(1), opp(2), opp(3)]);

    assert.strictEqual(captured.length, 1, 'a batch must not send one email per opportunity');
    const email = captured[0];
    assert.strictEqual(email.subject, '3 new opportunities — Bridge Collective');
    assert.match(email.htmlContent, /3 New Opportunities/);
    for (const n of [1, 2, 3]) {
      assert.match(email.htmlContent, new RegExp(`Opportunity ${n}`));
    }
    // Plain-text fallback still lists each one.
    assert.match(email.textContent, /Opportunity 1/);
    assert.match(email.textContent, /Opportunity 3/);
  });

  it('includes a per-recipient unsubscribe link', async () => {
    state.subscribers = [
      { id: 'aaaa', email: 'one@example.com' },
      { id: 'bbbb', email: 'two@example.com' },
    ];

    await notifyNewOpportunities([opp()]);

    const one = captured.find(c => c.to[0].email === 'one@example.com');
    const two = captured.find(c => c.to[0].email === 'two@example.com');
    assert.match(one.htmlContent, /unsubscribe\?email=one%40example\.com&id=aaaa/);
    assert.match(two.htmlContent, /unsubscribe\?email=two%40example\.com&id=bbbb/);
  });

  it('escapes opportunity titles into the HTML', async () => {
    state.subscribers = [{ id: 's1', email: 'one@example.com' }];

    await notifyNewOpportunities([{ ...opp(), title: 'Chess & Drama <script>' }]);

    assert.match(captured[0].htmlContent, /Chess &amp; Drama &lt;script&gt;/);
    assert.doesNotMatch(captured[0].htmlContent, /<script>/);
  });

  it('counts provider rejections as failures without throwing', async () => {
    state.subscribers = [
      { id: 's1', email: 'ok@example.com' },
      { id: 's2', email: 'fail@example.com' },
    ];
    stubFetch({ failFor: to => to.startsWith('fail') });

    const result = await notifyNewOpportunities([opp()]);

    assert.strictEqual(result.sent, 1);
    assert.strictEqual(result.failed, 1);
  });

  it('never throws when the network is down', async () => {
    state.subscribers = [
      { id: 's1', email: 'one@example.com' },
      { id: 's2', email: 'two@example.com' },
    ];
    stubFetch({ networkError: true });

    const result = await notifyNewOpportunities([opp()]);

    assert.strictEqual(result.sent, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.total, 2);
  });

  it('bounds concurrency instead of firing every send at once', async () => {
    state.subscribers = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, email: `user${i}@example.com` }));

    const result = await notifyNewOpportunities([opp()]);

    assert.strictEqual(result.sent, 50);
    assert.ok(maxInFlight > 1, `expected parallel sends, saw max ${maxInFlight}`);
    assert.ok(maxInFlight <= 10, `concurrency exceeded the limit: ${maxInFlight}`);
  });

  it('reuses one settings read instead of one per recipient', async () => {
    state.subscribers = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, email: `user${i}@example.com` }));

    await notifyNewOpportunities([opp()]);

    assert.strictEqual(state.settingsReads, 1, `expected 1 settings read, got ${state.settingsReads}`);
  });
});
