/**
 * FFmpeg processing queue - limits concurrent video processing to avoid CPU overload.
 *
 * Recommended: 3-5 concurrent jobs for 100 users (plan: Server Configuration 100 Users).
 * Configurable via FFMPEG_QUEUE_CONCURRENCY env var.
 */

const MAX_CONCURRENT = parseInt(process.env.FFMPEG_QUEUE_CONCURRENCY || "4", 10);
const queue = [];
let activeCount = 0;

/**
 * Run a job through the queue. Jobs run with limited concurrency.
 * @param {() => Promise<void>} job - Async function that performs FFmpeg work
 * @returns {Promise<void>}
 */
export function enqueue(job) {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) {
    return;
  }

  const { job, resolve, reject } = queue.shift();
  activeCount++;

  job()
    .then(() => {
      resolve();
    })
    .catch((err) => {
      reject(err);
    })
    .finally(() => {
      activeCount--;
      processQueue();
    });
}

/**
 * Get current queue status (for monitoring).
 */
export function getQueueStatus() {
  return {
    active: activeCount,
    pending: queue.length,
    maxConcurrent: MAX_CONCURRENT,
  };
}
