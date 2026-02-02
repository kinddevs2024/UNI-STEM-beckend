#!/usr/bin/env node
/**
 * API and Socket smoke tests
 * Run: node scripts/smoke-test.js (backend must be running: npm run dev)
 */

const BASE = process.env.API_BASE || "http://localhost:3000";
const SOCKET_URL = process.env.SOCKET_URL || BASE;

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function smokeApi() {
  const failures = [];

  const health = await fetchJson(`${BASE}/api/health`);
  if (health.status >= 500) {
    failures.push(`health: server error ${health.status}`);
  } else if (health.data?.checks?.db === "connected") {
    console.log("  health: ok (db connected)");
  } else {
    console.log("  health: ok (db may be down)");
  }

  const login = await fetchJson(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (login.status !== 400 && login.status !== 401 && login.status !== 500) {
    failures.push(`login: unexpected ${login.status}`);
  } else {
    console.log("  login: responded");
  }

  const olympiads = await fetchJson(`${BASE}/api/olympiads`);
  if (olympiads.status >= 500) {
    failures.push(`olympiads: server error ${olympiads.status}`);
  } else {
    console.log("  olympiads: responded");
  }

  return failures;
}

async function smokeSocket() {
  const { io } = await import("socket.io-client");
  return new Promise((resolve) => {
    const failures = [];
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: "smoke-test" },
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      failures.push("socket: timeout waiting for heartbeat-ack");
      resolve(failures);
    }, 10000);

    socket.on("connect", () => {
      socket.emit("join-olympiad", { olympiadId: "smoke", attemptId: "smoke" });
      socket.emit("heartbeat", { attemptId: "smoke" }); // Trigger ack
    });

    socket.on("heartbeat-ack", () => {
      clearTimeout(timeout);
      socket.emit("leave-olympiad", "smoke");
      socket.disconnect();
      console.log("  socket: connect, join-olympiad, heartbeat-ack, disconnect OK");
      resolve([]);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      failures.push(`socket: connect_error ${err.message}`);
      resolve(failures);
    });
  });
}

async function run() {
  console.log("API smoke tests...");
  const apiFailures = await smokeApi();

  console.log("\nSocket smoke test...");
  const socketFailures = await smokeSocket();

  const failures = [...apiFailures, ...socketFailures];
  if (failures.length > 0) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log("\nAll smoke tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
