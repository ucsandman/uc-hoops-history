"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import { coachForYear, eras, filterByScope, playerSeasons, scopeFromQuery, type Scope } from "@/lib/ucData";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

function groupByPlayer(rows: typeof playerSeasons) {
  const m = new Map<string, typeof playerSeasons>();
  for (const r of rows) {
    const arr = m.get(r.player) ?? [];
    arr.push(r);
    m.set(r.player, arr);
  }
  return m;
}

export default function PlayersClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState("");
  const [era, setEra] = useState<string>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [minG, setMinG] = useState(10);
  const [minMPG, setMinMPG] = useState(10);
  const [minPPG, setMinPPG] = useState(0);
  const [minRPG, setMinRPG] = useState(0);
  const [minAPG, setMinAPG] = useState(0);

  useEffect(() => {
    try {
      const eraQ = sp.get("era");
      if (eraQ && (eraQ === "all" || eras.some((e) => e.id === eraQ))) setEra(eraQ);
    } catch {
      // ignore
    }

    try {
      setScope(scopeFromQuery(sp.get("scope")));
    } catch {
      // ignore
    }

    try {
      const saved = JSON.parse(localStorage.getItem("uc_players_controls") ?? "null") as null | { era?: string; scope?: Scope };
      if (saved?.era && !sp.get("era") && (saved.era === "all" || eras.some((e) => e.id === saved.era))) setEra(saved.era);
      if (saved?.scope && !sp.get("scope")) setScope(saved.scope);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("uc_players_controls", JSON.stringify({ era, scope }));
    } catch {
      // ignore
    }

    const url = new URL(window.location.href);
    if (era && era !== "all") url.searchParams.set("era", era);
    else url.searchParams.delete("era");
    if (scope && scope !== "all") url.searchParams.set("scope", scope);
    else url.searchParams.delete("scope");
    router.replace(url.pathname + url.search);
  }, [era, scope, router]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const eraObj = eras.find((e) => e.id === era) ?? null;

    const scoped = filterByScope(playerSeasons, scope);

    return scoped.filter((r) => {
      if (era !== "all" && eraObj) {
        if (r.year < eraObj.from || r.year > eraObj.to) return false;
      }
      if ((r.games ?? 0) < minG) return false;
      if ((r.minutes ?? 0) < minMPG) return false;
      if ((r.pts ?? 0) < minPPG) return false;
      if ((r.trb ?? 0) < minRPG) return false;
      if ((r.ast ?? 0) < minAPG) return false;
      if (!query) return true;
      return r.player.toLowerCase().includes(query);
    });
  }, [q, era, scope, minG, minMPG, minPPG, minRPG, minAPG]);

  const [sortBy, setSortBy] = useState<"name" | "ppg" | "rpg" | "apg" | "mpg" | "games">("name");

  const byPlayer = useMemo(() => groupByPlayer(filteredRows), [filteredRows]);

  const playerCards = useMemo(() => {
    const cards = Array.from(byPlayer.entries()).map(([name, rows]) => {
      const sorted = [...rows].sort((a, b) => b.year - a.year);
      const peakPts = Math.max(...sorted.map((r) => r.pts ?? 0));
      const peakTrb = Math.max(...sorted.map((r) => r.trb ?? 0));
      const peakAst = Math.max(...sorted.map((r) => r.ast ?? 0));
      const peakMin = Math.max(...sorted.map((r) => r.minutes ?? 0));
      const peakGames = Math.max(...sorted.map((r) => r.games ?? 0));

      return {
        name,
        rows: sorted,
        peakPts,
        peakTrb,
        peakAst,
        peakMin,
        peakGames,
      };
    });

    const desc = (a: number, b: number) => b - a;

    cards.sort((a, b) => {
      switch (sortBy) {
        case "ppg":
          return desc(a.peakPts, b.peakPts) || a.name.localeCompare(b.name);
        case "rpg":
          return desc(a.peakTrb, b.peakTrb) || a.name.localeCompare(b.name);
        case "apg":
          return desc(a.peakAst, b.peakAst) || a.name.localeCompare(b.name);
        case "mpg":
          return desc(a.peakMin, b.peakMin) || a.name.localeCompare(b.name);
        case "games":
          return desc(a.peakGames, b.peakGames) || a.name.localeCompare(b.name);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return cards;
  }, [byPlayer, sortBy]);

  const players = useMemo(() => playerCards.map((c) => c.name), [playerCards]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-black tracking-tight">Players</h1>
            <BackButton fallbackHref="/" label="Back" />
          </div>
          <p className="mt-1 text-sm text-zinc-300 max-w-2xl">Filter by season stats. This is per season, so a player can show up multiple times.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {([
              { id: "all", label: "All-time" },
              { id: "since1987", label: "Since 1987" },
              { id: "last15", label: "Last 15 years" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={
                  "sb-chip rounded-xl px-3 py-2 text-xs font-semibold transition-colors " +
                  (scope === s.id ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <div className="text-xs text-zinc-400">Search</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-400">Era</div>
              <select
                value={era}
                onChange={(e) => setEra(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
              >
                <option value="all">All</option>
                {(() => {
                  const groups = new Map<string, typeof eras>();
                  for (const er of eras) {
                    const g = er.group ?? "Other";
                    const arr = groups.get(g) ?? [];
                    arr.push(er);
                    groups.set(g, arr);
                  }

                  const order = ["Default", "Coach", "Conference", "Decade", "Other"];
                  const keys = Array.from(groups.keys()).sort((a, b) => {
                    const ai = order.indexOf(a);
                    const bi = order.indexOf(b);
                    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                    return a.localeCompare(b);
                  });

                  return keys.map((k) => (
                    <optgroup key={k} label={k}>
                      {groups
                        .get(k)!
                        .slice()
                        .sort((a, b) => a.from - b.from)
                        .map((er) => (
                          <option key={er.id} value={er.id}>
                            {er.label}
                          </option>
                        ))}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>

            <Num label="Min G" value={minG} onChange={setMinG} step={1} min={0} />
            <Num label="Min MPG" value={minMPG} onChange={setMinMPG} step={1} min={0} />
            <Num label="Min PPG" value={minPPG} onChange={setMinPPG} step={1} min={0} />
            <Num label="Min RPG" value={minRPG} onChange={setMinRPG} step={1} min={0} />
            <Num label="Min APG" value={minAPG} onChange={setMinAPG} step={1} min={0} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge>{filteredRows.length} player-seasons</Badge>
              <Badge>{players.length} players</Badge>
              <Badge>{era === "all" ? "All years" : eras.find((e) => e.id === era)?.label ?? era}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">
                <span className="text-zinc-400">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "ppg" | "rpg" | "apg" | "mpg" | "games")}
                  className="bg-transparent outline-none"
                >
                  <option value="name">Name</option>
                  <option value="ppg">Peak PPG</option>
                  <option value="rpg">Peak RPG</option>
                  <option value="apg">Peak APG</option>
                  <option value="mpg">Peak MPG</option>
                  <option value="games">Peak games</option>
                </select>
              </label>

              <button
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10 transition-colors"
                onClick={() => {
                  setMinG(10);
                  setMinMPG(10);
                  setMinPPG(0);
                  setMinRPG(0);
                  setMinAPG(0);
                  setQ("");
                }}
              >
                Reset
              </button>
              <button
                className="rounded-xl bg-red-500/90 px-3 py-2 text-xs font-semibold text-black hover:bg-red-400 transition-colors"
                onClick={() => {
                  setMinG(20);
                  setMinMPG(25);
                  setMinPPG(12);
                  setMinRPG(4);
                  setMinAPG(2);
                }}
              >
                Starters preset
              </button>
            </div>
          </div>
        </div>
      </header>

      <Leaderboards rows={filteredRows} />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {playerCards.map((c) => {
          return (
            <article key={c.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.rows[0]?.pos ? <Badge>{c.rows[0].pos}</Badge> : null}
                    <Badge>Peak: {c.peakPts} PPG</Badge>
                    <Badge>{c.peakTrb} RPG</Badge>
                    <Badge>{c.peakAst} APG</Badge>
                  </div>
                </div>
                {c.rows[0]?.player_url ? (
                  <a
                    href={c.rows[0].player_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                  >
                    Source
                  </a>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {c.rows.slice(0, 4).map((r) => {
                  const coach = coachForYear(r.year);
                  return (
                    <div key={`${c.name}-${r.year}`} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-200">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold">
                          {r.year}–{String(r.year + 1).slice(-2)}
                        </div>
                        <div className="text-zinc-400">{coach}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-300 sm:grid-cols-4">
                        <div>
                          <span className="text-zinc-500">G</span> {r.games ?? "—"}
                        </div>
                        <div>
                          <span className="text-zinc-500">MPG</span> {r.minutes ?? "—"}
                        </div>
                        <div>
                          <span className="text-zinc-500">PPG</span> {r.pts ?? "—"}
                        </div>
                        <div>
                          <span className="text-zinc-500">APG</span> {r.ast ?? "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Leaderboards({ rows }: { rows: typeof playerSeasons }) {
  const top = (key: "pts" | "trb" | "ast" | "minutes") =>
    [...rows]
      .filter((r) => (r[key] ?? 0) > 0)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, 10);

  const blocks: { label: string; key: "pts" | "trb" | "ast" | "minutes"; unit: string }[] = [
    { label: "Top PPG seasons", key: "pts", unit: "PPG" },
    { label: "Top RPG seasons", key: "trb", unit: "RPG" },
    { label: "Top APG seasons", key: "ast", unit: "APG" },
    { label: "Top MPG seasons", key: "minutes", unit: "MPG" },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {blocks.map((b) => (
        <div key={b.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100">{b.label}</div>
          <div className="mt-3 space-y-2">
            {top(b.key).map((r) => (
              <div key={`${r.player}-${r.year}-${b.key}`} className="flex items-baseline justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">{r.player}</div>
                  <div className="text-xs text-zinc-500">
                    {r.year}–{String(r.year + 1).slice(-2)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-black text-zinc-100">{(r[b.key] ?? 0).toFixed(1)} {b.unit}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Num({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  step: number;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
      />
    </label>
  );
}
