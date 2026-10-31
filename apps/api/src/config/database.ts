import postgres, { type Sql } from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema/index.js';
import { loadEnvironment } from './env.js';

export type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: Sql | undefined;
let database: Database | undefined;

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const environment = loadEnvironment();
  sqlClient = postgres(environment.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  });
  database = drizzle(sqlClient, { schema });

  return database;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await getDatabase().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = undefined;
    database = undefined;
  }
}