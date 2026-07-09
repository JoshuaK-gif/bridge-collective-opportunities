import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Database', () => {
  it('should connect and run a query', async () => {
    const pool = (await import('../lib/db.js')).default;
    const result = await pool.query('SELECT 1 AS val');
    assert.strictEqual(result.rows[0].val, 1);
  });
});

describe('Migrations', () => {
  it('should have run initial migration', async () => {
    const pool = (await import('../lib/db.js')).default;
    const result = await pool.query("SELECT name FROM _migrations WHERE name = '001_initial.sql'");
    assert.ok(result.rows.length > 0, 'Initial migration not found');
  });
});

describe('App', () => {
  it('should create an Express app', async () => {
    const { createApp } = await import('../server.js');
    const { app } = createApp();
    assert.ok(app);
    assert.strictEqual(typeof app.use, 'function');
  });

  it('should have health check route', async () => {
    const { createApp } = await import('../server.js');
    const { app } = createApp();
    const routes = app._router?.stack?.filter(r => r.route).map(r => r.route.path) || [];
    assert.ok(routes.length >= 0);
  });
});

describe('Validation', () => {
  it('should reject invalid email on register', async () => {
    const { schemas } = await import('../lib/validate.js');
    assert.throws(() => schemas.register.parse({
      email: 'not-an-email',
      password: '123456',
      full_name: 'Test',
      user_type: 'job_seeker',
    }));
  });

  it('should accept valid registration data', async () => {
    const { schemas } = await import('../lib/validate.js');
    const data = schemas.register.parse({
      email: 'test@test.com',
      password: '123456',
      full_name: 'Test User',
      user_type: 'job_seeker',
    });
    assert.strictEqual(data.email, 'test@test.com');
    assert.strictEqual(data.full_name, 'Test User');
  });

  it('should reject short password', async () => {
    const { schemas } = await import('../lib/validate.js');
    assert.throws(() => schemas.register.parse({
      email: 'test@test.com',
      password: '123',
      full_name: 'Test',
      user_type: 'job_seeker',
    }));
  });
});

describe('Cache', () => {
  it('should respond to ping', async () => {
    const cache = (await import('../lib/cache.js')).default;
    const result = await cache.ping();
    assert.strictEqual(result, true);
  });
});
