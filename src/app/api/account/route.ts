import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureSchema, db } from "@/lib/db";
import { USER_COOKIE } from "@/lib/auth";

function cleanUsername(s: string) {
  return s.trim().replace(/\s+/g, " ").slice(0, 32);
}

export async function GET() {
  await ensureSchema();
  const c = await cookies();
  const userId = c.get(USER_COOKIE)?.value;
  if (!userId) return NextResponse.json({ user: null });

  const pool = db();
  const res = await pool.query(`SELECT id, username FROM users WHERE id = $1`, [userId]);
  const row = res.rows[0];
  if (!row) return NextResponse.json({ user: null });

  return NextResponse.json({ user: { id: row.id as string, username: row.username as string } });
}

export async function POST(req: Request) {
  await ensureSchema();

  const body = (await req.json()) as { username?: string };
  const username = cleanUsername(body?.username ?? "");
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const pool = db();

  // Find or create (case-insensitive)
  const found = await pool.query(`SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [username]);
  const row =
    found.rows[0] ??
    (
      await pool.query(`INSERT INTO users (username) VALUES ($1) RETURNING id, username`, [username])
    ).rows[0];

  const res = NextResponse.json({ user: { id: row.id as string, username: row.username as string } });
  res.cookies.set({
    name: USER_COOKIE,
    value: row.id as string,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: USER_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
