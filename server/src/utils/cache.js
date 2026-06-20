const { createClient } = require('redis');
const env = require('../config/env');

const client = createClient({
  url: env.redisUrl || 'redis://localhost:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));

let isConnected = false;

const connectRedis = async () => {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }
};

const getCache = async (key) => {
  await connectRedis();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, expiresInSeconds = 3600) => {
  await connectRedis();
  await client.setEx(key, expiresInSeconds, JSON.stringify(value));
};

const clearCache = async (key) => {
  await connectRedis();
  await client.del(key);
};

const clearCachePrefix = async (prefix) => {
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
