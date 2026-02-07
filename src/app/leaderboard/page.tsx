import Link from "next/link";
import BackButton from "@/components/BackButton";
import { ensureSchema, db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  draft_id: string;
  mode: "top" | "sicko";
  elo: number;
  wins: number;
  losses: number;
  name: string;
  updated_at: string;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; sort?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "sicko" ? "sicko" : "top";
  const sort = sp.sort === "wins" || sp.sort === "winpct" ? sp.sort : "elo";
  const scope = sp.scope === "last15" ? "last15" : sp.scope === "since1987" ? "since1987" : "all";

  await ensureSchema();
  const pool = db();

  const res = await pool.query<Row>(
    `
    SELECT r.draft_id, r.mode, r.elo, r.wins, r.losses, r.updated_at, d.name
    FROM ratings r
    JOIN drafts d ON d.id = r.draft_id
    WHERE r.mode = $1 AND d.scope = $2
    ORDER BY r.elo DESC
    LIMIT 200;
    `,
    [mode, scope]
  );

  let rows = res.rows;

  if (sort === "wins") {
    rows = [...rows].sort((a, b) => b.wins - a.wins || b.elo - a.elo);
  } else if (sort === "winpct") {
    const pct = (r: Row) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0);
    rows = [...rows].sort((a, b) => pct(b) - pct(a) || b.elo - a.elo);
  } else {
    rows = [...rows].sort((a, b) => b.elo - a.elo);
  }

  rows = rows.slice(0, 50);

  return (
    <div className="space-y-6">
      <header className="sb-card relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/70 via-red-500/15 to-transparent" />

        <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">Leaderboard</div>
                <BackButton fallbackHref="/" label="Back" />
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                {mode === "sicko" ? "Sicko League" : "Top 5 League"}
              </h1>
              <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
                Elo ratings. Wins and losses. Public drafts only.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/leaderboard?mode=${mode}&sort=${sort}&scope=all`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (scope === "all" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                All-time
              </Link>
              <Link
                href={`/leaderboard?mode=${mode}&sort=${sort}&scope=since1987`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (scope === "since1987" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Since 1987
              </Link>
              <Link
                href={`/leaderboard?mode=${mode}&sort=${sort}&scope=last15`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (scope === "last15" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Last 15 years
              </Link>

              <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
              <Link
                href={`/leaderboard?mode=top&sort=${sort}&scope=${scope}`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (mode === "top" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Top 5
              </Link>
              <Link
                href={`/leaderboard?mode=sicko&sort=${sort}&scope=${scope}`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors " +
                  (mode === "sicko" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Sicko
              </Link>

              <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

              <Link
                href={`/leaderboard?mode=${mode}&sort=elo&scope=${scope}`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm transition-colors " +
                  (sort === "elo" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Elo
              </Link>
              <Link
                href={`/leaderboard?mode=${mode}&sort=winpct&scope=${scope}`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm transition-colors " +
                  (sort === "winpct" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Win%
              </Link>
              <Link
                href={`/leaderboard?mode=${mode}&sort=wins&scope=${scope}`}
                className={
                  "sb-chip rounded-xl px-3 py-1.5 text-sm transition-colors " +
                  (sort === "wins" ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                Wins
              </Link>

              <Link
                href="/draft"
                className="sb-chip rounded-xl px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5"
              >
                Draft
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="sb-card rounded-2xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr className="text-left">
                <th className="py-2 pr-2">Rank</th>
                <th className="py-2 pr-2">Draft</th>
                <th className="py-2 pr-2">Elo</th>
                <th className="py-2 pr-2">W</th>
                <th className="py-2 pr-2">L</th>
                <th className="py-2 pr-2">Win%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.draft_id} className="border-t border-white/10">
                  <td className="py-2 pr-2 text-zinc-500">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    <a
                      className="underline underline-offset-4 text-zinc-100 hover:text-white"
                      href={`/d/${r.draft_id}`}
                    >
                      {r.name}
                    </a>
                  </td>
                  <td className="py-2 pr-2 font-black text-zinc-100">{r.elo}</td>
                  <td className="py-2 pr-2 text-zinc-200">{r.wins}</td>
                  <td className="py-2 pr-2 text-zinc-200">{r.losses}</td>
                  <td className="py-2 pr-2 text-zinc-200">
                    {r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0}%
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-zinc-400">
                    No drafts yet. Save a draft first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
