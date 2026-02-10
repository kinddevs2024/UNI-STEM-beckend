import { createClient } from 'redis';

let redisClient = null;
let redisConnecting = null;

const getMemoryStore = () => {
  if (!global.__OWNER_CACHE__) {
    global.__OWNER_CACHE__ = new Map();
  }
  return global.__OWNER_CACHE__;
};

const getRedisClient = async () => {
  if (!process.env.REDIS_URL) return null;

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (redisConnecting) {
    await redisConnecting;
    return redisClient;
  }

  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  redisConnecting = redisClient.connect();
  await redisConnecting;
  redisConnecting = null;
  return redisClient;
};

export async function getCache(key) {
  try {
    const client = await getRedisClient();
    if (client) {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    }

    const store = getMemoryStore();
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  try {
    const client = await getRedisClient();
    const payload = JSON.stringify(value);
    if (client) {
      await client.setEx(key, ttlSeconds, payload);
      return true;
    }

    const store = getMemoryStore();
    store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

export default {
  getCache,
  setCache,
};
