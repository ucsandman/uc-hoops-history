import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { rateLimit, ipKey } from "@/lib/rateLimit";
import { getUserId } from "@/lib/auth";
import type { DraftMode, Lineup } from "@/lib/sim";

function randKey() {
  // URL-safe-ish edit token
  return crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

export async function POST(req: Request) {
  const rl = rateLimit({ key: ipKey(req, "drafts_post"), limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  await ensureSchema();

  const body = (await req.json()) as {
    mode: DraftMode;
    name?: string;
    lineup: Lineup;
    isPublic?: boolean;
  };

  const userId = await getUserId();

  // Auto-name: if the user is "logged in" and didn't provide a name,
  // generate: "username - Draft (n)".
  let name = (body?.name ?? "").trim();
  if (!name && userId) {
    const pool = db();
    const uRes = await pool.query(`SELECT username FROM users WHERE id = $1`, [userId]);
    const username = (uRes.rows[0]?.username as string | undefined) ?? "User";

    const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM drafts WHERE user_id = $1`, [userId]);
    const c = (countRes.rows[0]?.c as number | undefined) ?? 0;
    const n = c + 1;
    name = `${username} - Draft (${n})`;
  }

  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (body.mode !== "top" && body.mode !== "sicko") {
    return NextResponse.json({ error: "Bad mode" }, { status: 400 });
  }

  const editKey = randKey();
  const pool = db();

  const res = await pool.query(
    `
    INSERT INTO drafts (user_id, mode, name, lineup, public, edit_key)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
    `,
    [userId, body.mode, name, body.lineup, body.isPublic ?? true, editKey]
  );

  const id = res.rows[0].id as string;

  // Seed rating row
  await pool.query(
    `
    INSERT INTO ratings (draft_id, mode, elo, wins, losses)
    VALUES ($1, $2, 1200, 0, 0)
    ON CONFLICT (draft_id) DO NOTHING;
    `,
    [id, body.mode]
  );

  return NextResponse.json({ id, editKey });
}
