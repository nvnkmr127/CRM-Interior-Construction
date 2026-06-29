if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });
}
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config();

const { z } = require('zod');

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL is required' }),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' }),
  JWT_REFRESH_SECRET: z.string({ required_error: 'JWT_REFRESH_SECRET is required' }),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PROVIDER: z.enum(['s3', 'local']).default('s3'),
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingVars = parsed.error.issues.map((i) => i.path[0]).join(', ');
  throw new Error(`Missing or invalid required environment variables: ${missingVars}`);
}

const env = parsed.data;

module.exports = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  dbUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  clientUrl: env.CLIENT_URL,
  s3Bucket: env.S3_BUCKET,
  s3Region: env.S3_REGION,
  awsKey: env.AWS_ACCESS_KEY_ID,
  awsSecret: env.AWS_SECRET_ACCESS_KEY,
  storageProvider: env.STORAGE_PROVIDER,
  redisUrl: env.REDIS_URL,
};
