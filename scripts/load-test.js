/**
 * Load test script - simulate users with socket connections
 * Run: node scripts/load-test.js (requires backend running)
 *
 * Simulates: connect socket, heartbeat every 5s, timer-sync every 30s
 * For heavier load use k6: k6 run scripts/load-test-k6.js
 */

const BASE = process.env.API_BASE || "http://localhost:3000";
const SOCKET_URL = process.env.SOCKET_URL || BASE;
const VUS = parseInt(process.env.VUS || "20", 10); // Use VUS=100 for 100 CCU

async function main() {
  const { io } = await import("socket.io-client");

  const results = { connected: 0, heartbeat: 0, timerSync: 0, errors: 0 };

  const connectUser = (id) => {
    return new Promise((resolve, reject) => {
      const socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: false,
        auth: { token: "test-token" },
      });

      socket.on("connect", () => {
        results.connected++;
        socket.emit("join-olympiad", { olympiadId: "test", attemptId: "test" });
        resolve(socket);
      });

      socket.on("connect_error", () => {
        results.errors++;
        reject();
      });
    });
  };

  const runVirtualUser = async (id) => {
    try {
      const socket = await connectUser(id);
      const interval = setInterval(() => {
        socket.emit("heartbeat", { attemptId: "test" });
        results.heartbeat++;
      }, 5000);
      const syncInterval = setInterval(() => {
        socket.emit("timer-sync", { attemptId: "test" });
        results.timerSync++;
      }, 30000);

      await new Promise((r) => setTimeout(r, 25000));
      clearInterval(interval);
      clearInterval(syncInterval);
      socket.disconnect();
    } catch {
      results.errors++;
    }
  };

  const start = Date.now();
  const vus = Math.min(VUS, 100);
  const promises = [];
  for (let i = 0; i < vus; i++) {
    promises.push(runVirtualUser(i));
  }
  await Promise.all(promises);
  const elapsed = (Date.now() - start) / 1000;

  console.log("Load test results:");
  console.log("  Connected:", results.connected);
  console.log("  Heartbeats:", results.heartbeat);
  console.log("  Timer syncs:", results.timerSync);
  console.log("  Errors:", results.errors);
  console.log("  Duration:", elapsed.toFixed(1), "s");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
