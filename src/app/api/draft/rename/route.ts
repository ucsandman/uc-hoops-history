import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { getUserId } from "@/lib/auth";

function cleanName(s: string) {
  return s.trim().replace(/\s+/g, " ").slice(0, 60);
}

export async function PATCH(req: Request) {
  await ensureSchema();
  const body = (await req.json()) as { id?: string; name?: string; editKey?: string };
  const id = body?.id;
  const name = cleanName(body?.name ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
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
