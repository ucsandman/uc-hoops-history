import { filterByScope, playerSeasons, scopeFromQuery, seasons, coachForYear, eraForCoach, filterActuallyPlayed, type Scope } from "@/lib/ucData";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function pct(w: number, l: number) {
  const t = w + l;
  if (!t) return 0;
  return w / t;
}

type EraPick = { player: string; r: (typeof playerSeasons)[number] };

function EraList({ title, rows }: { title: string; rows: EraPick[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-black tracking-tight">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.map((x, idx) => (
          <div
            key={x.player}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-zinc-100">
                {idx + 1}. {x.player}
              </div>
              <div className="text-zinc-400">
                {x.r.year}–{String(x.r.year + 1).slice(-2)} • {x.r.pos ?? "—"}
              </div>
            </div>
            <div className="shrink-0 text-right text-zinc-200">
              <span className="font-black text-zinc-100">{x.r.pts ?? "—"}</span> <span className="text-zinc-500">PPG</span>
              <div className="text-[11px] text-zinc-500">
                {x.r.trb ?? "—"} RPG • {x.r.ast ?? "—"} APG
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBottom({ era, scope }: { era: "Cronin" | "Brannen" | "Miller"; scope: Scope }) {
  const played = filterActuallyPlayed(filterByScope(playerSeasons, scope), { minGames: 10, minMinutes: 10 });

  const rows = played
    .filter((r) => eraForCoach(coachForYear(r.year)) === era)
    .filter((r) => (r.pts ?? 0) > 0);

  // Dedupe by player, choose their best season in this era by PPG
  const byPlayer = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byPlayer.get(r.player) ?? [];
    arr.push(r);
    byPlayer.set(r.player, arr);
  }

  const bestSeason: EraPick[] = Array.from(byPlayer.entries()).map(([player, rs]) => {
    const best = [...rs].sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0))[0];
    return { player, r: best };
  });

  const top = [...bestSeason].sort((a, b) => (b.r.pts ?? 0) - (a.r.pts ?? 0)).slice(0, 5);
  const bottom = [...bestSeason].sort((a, b) => (a.r.pts ?? 0) - (b.r.pts ?? 0)).slice(0, 5);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight">{era} era draft board</h2>
        <div className="text-xs text-zinc-500">Top and Bottom 5 by peak PPG in-era</div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EraList title="Top 5 (by PPG)" rows={top} />
        <EraList title="Bottom 5 (by PPG)" rows={bottom} />
      </div>
    </section>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const scope: Scope = scopeFromQuery(sp.scope);

  const seasonsAll = [...filterByScope(seasons, scope)].sort((a, b) => a.year - b.year);

  const byCoach = new Map<string, typeof seasonsAll>();
  for (const s of seasonsAll) {
    const coach = coachForYear(s.year);
    const arr = byCoach.get(coach) ?? [];
    arr.push(s);
    byCoach.set(coach, arr);
  }

  const coachRows = Array.from(byCoach.entries()).map(([coach, ss]) => {
    const w = ss.reduce((a, b) => a + b.wins, 0);
    const l = ss.reduce((a, b) => a + b.losses, 0);

    const confW = ss.reduce((a, b) => a + (b.conf_wins ?? 0), 0);
    const confL = ss.reduce((a, b) => a + (b.conf_losses ?? 0), 0);

    const confNames = Array.from(new Set(ss.map((x) => x.conf).filter(Boolean))) as string[];

    const ncaaApps = ss.filter((x) => (x.postseason ?? "").includes("NCAA")).length;
    const best = [...ss].sort((a, b) => pct(b.wins, b.losses) - pct(a.wins, a.losses))[0];

    const from = Math.min(...ss.map((x) => x.year));
    const to = Math.max(...ss.map((x) => x.year));

    return {
      coach,
      from,
      to,
      seasons: ss.length,
      w,
      l,
      winPct: pct(w, l),
      confW,
      confL,
      confNames,
      ncaaApps,
      best,
    };
  });

  coachRows.sort((a, b) => b.winPct - a.winPct);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Compare coaches</h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
          Coach comparison from season-level data. Use the scope toggle to focus on modern eras.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { id: "all", label: "All-time" },
            { id: "since1987", label: "Since 1987" },
            { id: "last15", label: "Last 15 years" },
          ] as const).map((s) => (
            <a
              key={s.id}
              href={`/compare?scope=${s.id}`}
              className={
                "sb-chip rounded-xl px-3 py-2 text-sm font-semibold transition-colors " +
                (scope === s.id ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
              }
            >
              {s.label}
            </a>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Seasons tracked" value={String(seasonsAll.length)} />
        <Stat label="Players tracked" value={String(new Set(playerSeasons.map((p) => p.player)).size)} />
        <Stat label="Data window" value={`${seasonsAll[0]?.year ?? "—"} → ${seasonsAll.at(-1)?.year ?? "—"}`} />
      </section>

      <section className="grid grid-cols-1 gap-3">
        {coachRows.map((c) => (
          <article key={c.coach} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-400">Coach</div>
                <div className="text-xl font-black tracking-tight">{c.coach}</div>
                <div className="mt-1 text-sm text-zinc-300">Tenure: {c.from}–{c.to}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-400">Overall</div>
                <div className="text-lg font-bold">{c.w}-{c.l} ({(c.winPct * 100).toFixed(1)}%)</div>
                <div className="mt-1 text-xs text-zinc-400">NCAA apps: {c.ncaaApps}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Best season (by win%)</div>
                <div className="mt-1 text-lg font-bold">
                  {c.best.year}–{String(c.best.year + 1).slice(-2)}
                </div>
                <div className="mt-1 text-sm text-zinc-300">{c.best.record}</div>
                <div className="mt-1 text-xs text-zinc-400">{c.best.postseason ?? "No postseason"}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Conference (sum)</div>
                <div className="mt-1 text-lg font-bold">
                  {c.confW || c.confL ? `${c.confW}-${c.confL}` : "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {c.confNames.length ? `Conferences: ${c.confNames.join(" • ")}` : "Conference unknown"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Notes</div>
                <div className="mt-1 text-sm text-zinc-300">
                  Conference record is aggregated across all seasons in this window.
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className="pt-4" />
      <TopBottom era="Cronin" scope={scope} />
      <TopBottom era="Brannen" scope={scope} />
      <TopBottom era="Miller" scope={scope} />
    </div>
  );
}
