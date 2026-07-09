// k6 load test — run with: k6 run tests/load.js
// Install k6 from https://k6.io/docs/get-started/installation/

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const FAILURE_RATE = new Rate('failed_requests');
const RESPONSE_TIME = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // ramp up to 100 users
    { duration: '1m', target: 500 },    // ramp to 500
    { duration: '2m', target: 1000 },   // ramp to 1000
    { duration: '3m', target: 2000 },   // ramp to 2000
    { duration: '2m', target: 5000 },   // ramp to 5000
    { duration: '1m', target: 10000 },  // ramp to 10000
    { duration: '2m', target: 10000 },  // stay at 10000
    { duration: '1m', target: 0 },      // ramp down
  ],
  thresholds: {
    failed_requests: ['rate<0.01'],     // <1% failure rate
    response_time: ['p(95)<2000'],      // 95% under 2s
    http_req_duration: ['p(99)<5000'],  // 99% under 5s
  },
};

export default function () {
  group('API Health', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, { 'health ok': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
    RESPONSE_TIME.add(res.timings.duration);
    sleep(1);
  });

  group('List Jobs', () => {
    const res = http.get(`${BASE_URL}/api/jobs?limit=20&page=1`);
    check(res, { 'jobs listed': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
    RESPONSE_TIME.add(res.timings.duration);
  });

  group('Search Jobs', () => {
    const res = http.get(`${BASE_URL}/api/jobs?keyword=developer&salary_min=1000&salary_max=5000`);
    check(res, { 'jobs searched': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
  });

  group('Get Profiles', () => {
    const res = http.get(`${BASE_URL}/api/profiles/seeker/list?limit=10`);
    check(res, { 'profiles listed': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
  });

  group('Register + Login', () => {
    const email = `loadtest${__VU}${Date.now()}@test.com`;
    const register = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email, password: 'test123456', full_name: 'Load Test', user_type: 'job_seeker',
    }), { headers: { 'Content-Type': 'application/json' } });
    check(register, { 'registered': (r) => r.status === 201 });

    if (register.status === 201) {
      const token = register.json('access_token');
      const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email, password: 'test123456',
      }), { headers: { 'Content-Type': 'application/json' } });
      check(login, { 'logged in': (r) => r.status === 200 });

      const me = http.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      check(me, { 'got profile': (r) => r.status === 200 });
    }
    FAILURE_RATE.add(register.status !== 201);
    sleep(2);
  });

  group('Job Count', () => {
    const res = http.get(`${BASE_URL}/api/jobs/count`);
    check(res, { 'count ok': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
  });

  group('Employer Profiles', () => {
    const res = http.get(`${BASE_URL}/api/profiles/employer/list?limit=10`);
    check(res, { 'employers listed': (r) => r.status === 200 });
    FAILURE_RATE.add(res.status !== 200);
  });
}
