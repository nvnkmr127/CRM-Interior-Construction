const logger = require('../utils/logger');
const { createClient } = require('redis');
const env = require('../config/env');

const useRedis = !!env.redisUrl && env.redisUrl !== 'redis://localhost:6379';

const client = useRedis ? createClient({
  url: env.redisUrl
}) : null;

if (client) {
  client.on('error', (error) => logger.info('Redis Client Error', error));
}

let isConnected = false;

const connectRedis = async () => {
  if (useRedis && !isConnected) {
    await client.connect();
    isConnected = true;
  }
};

// Simple high-performance in-memory cache fallback
const memoryCache = new Map();

const getCache = async (key) => {
  if (useRedis) {
    try {
      await connectRedis();
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error('Redis getCache error, failing back to memory cache:', e);
    }
  }
  
  const cached = memoryCache.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.value;
    }
    memoryCache.delete(key);
  }
  return null;
};

const setCache = async (key, value, expiresInSeconds = 3600) => {
  if (useRedis) {
    try {
      await connectRedis();
      await client.setEx(key, expiresInSeconds, JSON.stringify(value));
      return;
    } catch (e) {
      logger.error('Redis setCache error, failing back to memory cache:', e);
    }
  }
  
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (expiresInSeconds * 1000)
  });
};

const clearCache = async (key) => {
  if (useRedis) {
    try {
      await connectRedis();
      await client.del(key);
      return;
    } catch (e) {
      logger.error('Redis clearCache error, failing back to memory cache:', e);
    }
  }
  memoryCache.delete(key);
};

const clearCachePrefix = async (prefix) => {
  if (useRedis) {
    try {
      await connectRedis();
      const keys = await client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return;
    } catch (e) {
      logger.error('Redis clearCachePrefix error, failing back to memory cache:', e);
    }
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
};

module.exports = {
  client,
  getCache,
  setCache,
  clearCache,
  clearCachePrefix
};
