import 'server-only';
import {sql} from 'drizzle-orm';
import {getDb,hasDb} from './db';

let schemaReady:Promise<void>|null=null;

export function ensurePresenceSchema(){
  if(!hasDb())return Promise.resolve();
  if(!schemaReady){
    schemaReady=(async()=>{
      await getDb().execute(sql`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz`);
      await getDb().execute(sql`CREATE INDEX IF NOT EXISTS "players_last_seen_at_idx" ON "players" ("last_seen_at")`);
    })().catch(error=>{
      schemaReady=null;
      throw error;
    });
  }
  return schemaReady;
}
