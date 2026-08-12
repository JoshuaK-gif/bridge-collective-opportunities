import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

const BASE = 'http://localhost:3000';

const STAGES = [
  { duration: '30s', target: 10 },
  { duration: '30s', target: 50 },
  { duration: '30s', target: 100 },
  { duration: '30s', target: 200 },
  { duration: '30s', target: 500 },
  { duration: '30s', target: 1000 },
  { duration: '30s', target: 0 },
];

export const options = {
  stages: STAGES,
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE}/api/health`);
    check(res, { 'health status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);

  group('List Opportunities', () => {
    const res = http.get(`${BASE}/api/opportunities`);
    check(res, { 'opportunities 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  sleep(1);

  group('Filtered Query', () => {
    const res = http.get(`${BASE}/api/opportunities?category=Scholarship&limit=5`);
    check(res, { 'filtered 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(1);

  group('Newsletter Subscribe', () => {
    const payload = JSON.stringify({ email: `test${Math.random()}@example.com` });
    const res = http.post(`${BASE}/api/subscribers`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'subscribe created': (r) => r.status === 200 || r.status === 201 });
    errorRate.add(res.status !== 200 && res.status !== 201);
  });

  sleep(1);

  group('AI Summary', () => {
    const payload = JSON.stringify({ text: 'Software engineering internship in Kampala for youth' });
    const res = http.post(`${BASE}/api/ai/generate-summary`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
    });
    check(res, { 'ai summary 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    if (res.status === 200) apiLatency.add(res.timings.duration);
  });
}
