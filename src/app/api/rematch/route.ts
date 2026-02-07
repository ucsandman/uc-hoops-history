import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { rateLimit, ipKey } from "@/lib/rateLimit";
import { isUuid } from "@/lib/validate";
import { eloUpdate, simulateMatch, type DraftMode, type DraftSnap } from "@/lib/sim";

export async function POST(req: Request) {
  const rl = rateLimit({ key: ipKey(req, "rematch"), limit: 15, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  await ensureSchema();

  const body = (await req.json()) as { draftA: unknown; draftB: unknown; mode: DraftMode };
  if (!isUuid(body?.draftA) || !isUuid(body?.draftB)) return NextResponse.json({ error: "Bad drafts" }, { status: 400 });
  if (body.mode !== "top" && body.mode !== "sicko") return NextResponse.json({ error: "Bad mode" }, { status: 400 });

  const pool = db();

  const dRes = await pool.query(
    `SELECT id, mode, name, lineup FROM drafts WHERE id = ANY($1::uuid[]) AND mode = $2`,
    [[body.draftA, body.draftB], body.mode]
  );

  const aRow = dRes.rows.find((x) => x.id === body.draftA);
  const bRow = dRes.rows.find((x) => x.id === body.draftB);
  if (!aRow || !bRow) return NextResponse.json({ error: "Drafts not found" }, { status: 404 });

  const a: DraftSnap = { id: aRow.id, mode: aRow.mode, name: aRow.name, lineup: aRow.lineup };
  const b: DraftSnap = { id: bRow.id, mode: bRow.mode, name: bRow.name, lineup: bRow.lineup };

  const seed = Date.now() % 2147483647;
  const recap = simulateMatch({ seed, mode: body.mode, a, b });

  const winnerId = recap.winnerId;

  const matchRes = await pool.query(
    `
    INSERT INTO matches (mode, draft_a, draft_b, score_a, score_b, winner, recap)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
    `,
    [body.mode, a.id, b.id, recap.a.score, recap.b.score, winnerId, recap]
  );

  const matchId = matchRes.rows[0].id as string;

  const rRes = await pool.query(
    `SELECT draft_id, elo FROM ratings WHERE draft_id = ANY($1::uuid[])`,
    [[a.id, b.id]]
  );

  const ra = rRes.rows.find((x) => x.draft_id === a.id)?.elo ?? 1200;
  const rb = rRes.rows.find((x) => x.draft_id === b.id)?.elo ?? 1200;

  const winner = winnerId === a.id ? "A" : "B";
  const { na, nb } = eloUpdate({ ra, rb, winner });

  await pool.query(`UPDATE ratings SET elo = $1, updated_at = now() WHERE draft_id = $2`, [na, a.id]);
  await pool.query(`UPDATE ratings SET elo = $1, updated_at = now() WHERE draft_id = $2`, [nb, b.id]);

  await pool.query(`UPDATE ratings SET wins = wins + 1, updated_at = now() WHERE draft_id = $1`, [winnerId]);
  const loserId = winnerId === a.id ? b.id : a.id;
  await pool.query(`UPDATE ratings SET losses = losses + 1, updated_at = now() WHERE draft_id = $1`, [loserId]);

  return NextResponse.json({ matchId });
}
