import { Pool } from "pg";

declare global {
  var __uc_pool: Pool | undefined;
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");

  if (!global.__uc_pool) {
    global.__uc_pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }

  return global.__uc_pool;
}

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;

  const pool = db();
  const client = await pool.connect();
  try {
    // Needed for gen_random_uuid()
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
      ON users (LOWER(username));
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        mode TEXT NOT NULL CHECK (mode IN ('top','sicko')),
        name TEXT NOT NULL,
        lineup JSONB NOT NULL,
        public BOOLEAN NOT NULL DEFAULT true,
        edit_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Back-compat: if drafts table existed before user_id column.
    await client.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS user_id UUID NULL;`);
    await client.query(`DO $$ BEGIN
      ALTER TABLE drafts
      ADD CONSTRAINT drafts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        draft_id UUID PRIMARY KEY REFERENCES drafts(id) ON DELETE CASCADE,
        mode TEXT NOT NULL CHECK (mode IN ('top','sicko')),
        elo INT NOT NULL DEFAULT 1200,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mode TEXT NOT NULL CHECK (mode IN ('top','sicko')),
        draft_a UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        draft_b UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        score_a INT NOT NULL,
        score_b INT NOT NULL,
        winner UUID NOT NULL,
        recap JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    schemaReady = true;
  } finally {
    client.release();
  }
}
