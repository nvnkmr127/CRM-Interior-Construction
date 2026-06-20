const { createClient } = require('redis');
const env = require('../config/env');

const useRedis = !!env.redisUrl && env.redisUrl !== 'redis://localhost:6379';

const client = useRedis ? createClient({
  url: env.redisUrl
}) : null;

if (client) {
  client.on('error', (err) => console.log('Redis Client Error', err));
}

let isConnected = false;

const connectRedis = async () => {
  if (useRedis && !isConnected) {
    await client.connect();
    isConnected = true;
  }
};

const getCache = async (key) => {
  if (!useRedis) return null;
  await connectRedis();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, expiresInSeconds = 3600) => {
  if (!useRedis) return;
  await connectRedis();
  await client.setEx(key, expiresInSeconds, JSON.stringify(value));
};

const clearCache = async (key) => {
  if (!useRedis) return;
  await connectRedis();
  await client.del(key);
};

const clearCachePrefix = async (prefix) => {
  if (!useRedis) return;
  await connectRedis();
  const keys = await client.keys(`${prefix}*`);
  if (keys.length > 0) {
    await client.del(keys);
  }
};

module.exports = {
  client,
  getCache,
  setCache,
  clearCache,
  clearCachePrefix
};
