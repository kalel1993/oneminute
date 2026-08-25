import { neon } from '@neondatabase/serverless';import { drizzle } from 'drizzle-orm/neon-http';import * as schema from './schema';
let database:ReturnType<typeof drizzle<typeof schema>>|null=null;
export function hasDb(){return Boolean(process.env.DATABASE_URL)}
export function getDb(){if(database)return database;const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_NOT_CONFIGURED');database=drizzle(neon(url),{schema});return database}
