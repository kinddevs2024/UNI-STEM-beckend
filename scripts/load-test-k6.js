/**
 * K6 load test - 100 virtual users
 * Install: https://k6.io/docs/getting-started/installation/
 * Run: k6 run scripts/load-test-k6.js
 *
 * For socket load test use: node scripts/load-test.js (VUS=100)
 *
 * Expected metrics for 100 CCU:
 * - CPU < 70%
 * - RAM < 2 GB
 * - DB ops < 10/sec (after heartbeat rework)
 */

import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.API_BASE || "http://localhost:3000";

export const options = {
  vus: 100,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  const health = http.get(`${BASE}/api/health`);
  check(health, { "health ok": (r) => r.status === 200 || r.status === 503 });

  const olympiads = http.get(`${BASE}/api/olympiads`);
  check(olympiads, { "olympiads ok": (r) => r.status < 500 });
}
