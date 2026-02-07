import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { rateLimit, ipKey } from "@/lib/rateLimit";
import { isUuid } from "@/lib/validate";
import { getUserId } from "@/lib/auth";

function cleanName(s: string) {
  return s.trim().replace(/\s+/g, " ").slice(0, 60);
}

export async function PATCH(req: Request) {
  const rl = rateLimit({ key: ipKey(req, "draft_rename"), limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  await ensureSchema();
  const body = (await req.json()) as { id?: unknown; name?: string; editKey?: string };
  const id = body?.id;
  const name = cleanName(body?.name ?? "");
  if (!isUuid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const pool = db();
  const userId = await getUserId();

  // Allow rename if you own it (via cookie) OR you have the edit key.
  const res = await pool.query(
    `
    UPDATE drafts
    SET name = $1, updated_at = now()
    WHERE id = $2
      AND (
        ($3::uuid IS NOT NULL AND user_id = $3)
        OR ($4::text IS NOT NULL AND edit_key = $4)
      )
    RETURNING id;
    `,
    [name, id, userId, body?.editKey ?? null]
  );

  if (!res.rows[0]) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
