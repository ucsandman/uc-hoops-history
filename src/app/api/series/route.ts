import { NextResponse } from "next/server";
import { ensureSchema, db } from "@/lib/db";
import { rateLimit, ipKey } from "@/lib/rateLimit";
import { isUuid } from "@/lib/validate";
import { eloUpdate, simulateMatch, type DraftMode, type DraftSnap } from "@/lib/sim";

export async function POST(req: Request) {
  // Series can be heavier (n up to 25). Keep this tighter.
  const rl = rateLimit({ key: ipKey(req, "series"), limit: 6, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  await ensureSchema();

  const body = (await req.json()) as {
    draftA: unknown;
    draftB: unknown;
    mode: DraftMode;
    n?: number;
    commit?: boolean; // if true, writes matches + updates ratings/elo
  };

  if (!isUuid(body?.draftA) || !isUuid(body?.draftB)) return NextResponse.json({ error: "Bad drafts" }, { status: 400 });
  if (body.mode !== "top" && body.mode !== "sicko") return NextResponse.json({ error: "Bad mode" }, { status: 400 });

  const n = Math.max(1, Math.min(25, Math.floor(body.n ?? 10)));

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

  const sims: Array<{ a: number; b: number; winner: "A" | "B"; margin: number; hadOT: boolean }> = [];

  const baseSeed = (Date.now() % 2147483647) >>> 0;

  const commit = body.commit === undefined ? true : Boolean(body.commit);

  // If committing, prefetch current elos so we can advance them game-by-game.
  let ra: number | null = null;
  let rb: number | null = null;

  if (commit) {
    const rRes = await pool.query(`SELECT draft_id, elo FROM ratings WHERE draft_id = ANY($1::uuid[])`, [[a.id, b.id]]);
    ra = rRes.rows.find((x) => x.draft_id === a.id)?.elo ?? 1200;
    rb = rRes.rows.find((x) => x.draft_id === b.id)?.elo ?? 1200;

    // Ensure rows exist
    await pool.query(
      `INSERT INTO ratings (draft_id, mode, elo, wins, losses) VALUES ($1,$2,COALESCE($3,1200),0,0)
       ON CONFLICT (draft_id) DO NOTHING;`,
      [a.id, body.mode, ra]
    );
    await pool.query(
      `INSERT INTO ratings (draft_id, mode, elo, wins, losses) VALUES ($1,$2,COALESCE($3,1200),0,0)
       ON CONFLICT (draft_id) DO NOTHING;`,
      [b.id, body.mode, rb]
    );

    await pool.query("BEGIN");
  }

  try {
    for (let i = 0; i < n; i++) {
      const seed = (baseSeed + i * 9973) % 2147483647;
      const recap = simulateMatch({ seed, mode: body.mode, a, b });
      const winner = recap.winnerId === a.id ? "A" : "B";
      const margin = Math.abs(recap.a.score - recap.b.score);
      sims.push({ a: recap.a.score, b: recap.b.score, winner, margin, hadOT: Boolean(recap.overtime) });

      if (commit) {
        // Insert match row
        await pool.query(
          `
          INSERT INTO matches (mode, draft_a, draft_b, score_a, score_b, winner, recap)
          VALUES ($1,$2,$3,$4,$5,$6,$7);
          `,
          [body.mode, a.id, b.id, recap.a.score, recap.b.score, recap.winnerId, recap]
        );

        // Elo update sequentially
        const { na, nb } = eloUpdate({ ra: ra ?? 1200, rb: rb ?? 1200, winner });
        ra = na;
        rb = nb;

        await pool.query(`UPDATE ratings SET elo = $1, updated_at = now() WHERE draft_id = $2`, [ra, a.id]);
        await pool.query(`UPDATE ratings SET elo = $1, updated_at = now() WHERE draft_id = $2`, [rb, b.id]);

        const winnerId = recap.winnerId;
        const loserId = winnerId === a.id ? b.id : a.id;
        await pool.query(`UPDATE ratings SET wins = wins + 1, updated_at = now() WHERE draft_id = $1`, [winnerId]);
        await pool.query(`UPDATE ratings SET losses = losses + 1, updated_at = now() WHERE draft_id = $1`, [loserId]);
      }
    }

    if (commit) await pool.query("COMMIT");
  } catch (e) {
    if (commit) await pool.query("ROLLBACK");
    throw e;
  }

  const aWins = sims.filter((x) => x.winner === "A").length;
  const bWins = n - aWins;

  const avgA = sims.reduce((s, x) => s + x.a, 0) / n;
  const avgB = sims.reduce((s, x) => s + x.b, 0) / n;

  const avgMargin = sims.reduce((s, x) => s + x.margin, 0) / n;
  const blowouts = sims.filter((x) => x.margin >= 15).length;
  const nailbiters = sims.filter((x) => x.margin <= 3).length;
  const ots = sims.filter((x) => x.hadOT).length;

  return NextResponse.json({
    n,
    a: { id: a.id, name: a.name, wins: aWins, avg: Math.round(avgA * 10) / 10 },
    b: { id: b.id, name: b.name, wins: bWins, avg: Math.round(avgB * 10) / 10 },
    meta: {
      avgMargin: Math.round(avgMargin * 10) / 10,
      blowouts,
      nailbiters,
      ots,
    },
    sims: sims.slice(0, 12),
  });
}
