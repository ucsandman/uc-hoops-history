import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { rateLimit, ipKey } from "@/lib/rateLimit";
import { isUuid } from "@/lib/validate";
import type { DraftMode } from "@/lib/sim";

export async function GET(req: Request) {
  // This one is called a lot while typing in search.
  const rl = rateLimit({ key: ipKey(req, "opponents"), limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  await ensureSchema();
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") ?? "top") as DraftMode;
  if (mode !== "top" && mode !== "sicko") return NextResponse.json({ error: "Bad mode" }, { status: 400 });

  const excludeRaw = url.searchParams.get("exclude");
  const exclude = excludeRaw && isUuid(excludeRaw) ? excludeRaw : null;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);

  const pool = db();

  // lightweight search on name, but only among public drafts in same mode
  const params: Array<string> = [mode];
  let where = `WHERE mode = $1 AND public = true`;

  if (exclude) {
    params.push(exclude);
    where += ` AND id <> $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    where += ` AND name ILIKE $${params.length}`;
  }

  const res = await pool.query(
    `
    SELECT id, name
    FROM drafts
    ${where}
    ORDER BY updated_at DESC
    LIMIT 60;
    `,
    params
  );

  return NextResponse.json({ opponents: res.rows.map((r) => ({ id: r.id as string, name: r.name as string })) });
}
