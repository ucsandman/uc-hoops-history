"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { coachForYear, eraForCoach, filterActuallyPlayed, filterByScope, playerSeasons, scopeFromQuery, type Scope } from "@/lib/ucData";
import type { Lineup } from "@/lib/sim";

type Row = (typeof playerSeasons)[number];
type Slot = "PG" | "SG" | "SF" | "PF" | "C";

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function posBucket(pos?: string | null): "G" | "F" | "C" | "U" {
  const p = (pos ?? "").toUpperCase();
  if (p.includes("G") || p.includes("PG") || p.includes("SG")) return "G";
  if (p.includes("F") || p.includes("SF") || p.includes("PF")) return "F";
  if (p.includes("C")) return "C";
  return "U";
}

function pickOneUnique(pool: Row[], taken: Set<string>): Row | null {
  for (const r of pool) {
    if (!taken.has(r.player)) {
      taken.add(r.player);
      return r;
    }
  }
  return null;
}

export default function RandomFive() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const seedStr = params.get("s") ?? "0";
  const seed = Number.parseInt(seedStr.slice(0, 10), 10) || 0;
  const rand = useMemo(() => mulberry32(seed || 1), [seed]);

  const scope: Scope = scopeFromQuery(params.get("scope"));

  useEffect(() => {
    if (!params.get("s")) {
      router.replace(`/random?s=${new Date().getTime()}&scope=${scope}`);
    }
  }, [params, router, scope]);

  const played = useMemo(() => {
    const base = filterActuallyPlayed(playerSeasons, { minGames: 10, minMinutes: 10 });
    return filterByScope(base, scope);
  }, [scope]);

  const chosen = useMemo(() => {
    const taken = new Set<string>();

    const guards = shuffle(played.filter((r) => posBucket(r.pos) === "G"), rand);
    const forwards = shuffle(played.filter((r) => posBucket(r.pos) === "F"), rand);
    const centers = shuffle(played.filter((r) => posBucket(r.pos) === "C"), rand);
    const any = shuffle([...played], rand);

    const plan: { slot: Slot; pool: Row[] }[] = [
      { slot: "PG", pool: guards },
      { slot: "SG", pool: guards },
      { slot: "SF", pool: forwards },
      { slot: "PF", pool: forwards.length ? forwards : any },
      { slot: "C", pool: centers.length ? centers : any },
    ];

    const picks: { slot: Slot; row: Row }[] = [];
    for (const p of plan) {
      const r = pickOneUnique(p.pool, taken) ?? pickOneUnique(any, taken);
      if (r) picks.push({ slot: p.slot, row: r });
    }

    return picks;
  }, [played, rand]);

  async function competeRandom() {
    setErr(null);
    setLoading(true);
    try {
      const toLineup = (): Lineup => {
        const map = new Map(chosen.map((c) => [c.slot, c.row] as const));
        return {
          pg: map.get("PG") ?? null,
          sg: map.get("SG") ?? null,
          sf: map.get("SF") ?? null,
          pf: map.get("PF") ?? null,
          c: map.get("C") ?? null,
        };
      };

      const name = `Random 5 ${new Date().toLocaleString()}`;

      const saveRes = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "top",
          name,
          lineup: toLineup(),
          isPublic: true,
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson?.error ?? "Save failed");

      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: saveJson.id, mode: "top" }),
      });
      const matchJson = await matchRes.json();
      if (!matchRes.ok) throw new Error(matchJson?.error ?? "Match failed");

      router.push(`/m/${matchJson.matchId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-black tracking-tight">Random Starting Five</h1>
        <p className="text-sm text-zinc-300 max-w-2xl">
          Refresh for a new lineup. Or compete this lineup against a random saved team.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "all", label: "All-time" },
              { id: "since1987", label: "Since 1987" },
              { id: "last15", label: "Last 15 years" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => router.replace(`/random?s=${seed || new Date().getTime()}&scope=${s.id}`)}
                className={
                  "sb-chip rounded-xl px-3 py-2 text-sm font-semibold transition-colors " +
                  (scope === s.id ? "!bg-white !text-black" : "text-zinc-200 hover:bg-white/5")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => router.replace(`/random?s=${new Date().getTime()}`)}
            className="rounded-xl bg-red-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-red-400 transition-colors"
          >
            Refresh lineup
          </button>
          <button
            onClick={competeRandom}
            disabled={loading}
            className="sb-chip rounded-xl px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            {loading ? "Simulating" : "Compete this Random 5"}
          </button>
        </div>

        {err ? <div className="text-xs text-red-300">{err}</div> : null}
      </header>

      {/* Mobile: one compact lineup card for easy screenshots */}
      <section className="md:hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/30 via-white/5 to-black/20 p-4">
        <div className="text-xs text-zinc-500">Lineup</div>
        <div className="mt-2 divide-y divide-white/10">
          {chosen.map(({ slot, row: r }) => {
            const coach = coachForYear(r.year);
            return (
              <div key={`${slot}-${r.player}-${r.year}`} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-400">{slot}</div>
                    <div className="truncate text-base font-black tracking-tight">{r.player}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {r.year}–{String(r.year + 1).slice(-2)} • {eraForCoach(coach)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-zinc-400">
                    <div>{r.pts ?? "—"} PPG</div>
                    <div>{r.trb ?? "—"} RPG</div>
                    <div>{r.ast ?? "—"} APG</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Desktop: cards */}
      <section className="hidden md:grid grid-cols-1 gap-3 md:grid-cols-2">
        {chosen.map(({ slot, row: r }) => {
          const coach = coachForYear(r.year);
          return (
            <article
              key={`${slot}-${r.player}-${r.year}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-400">{slot}</div>
                  <div className="text-xl font-black tracking-tight">{r.player}</div>
                </div>
                <div className="text-xs text-zinc-500">pos: {r.pos ?? "—"}</div>
              </div>

              <div className="mt-2 text-sm text-zinc-300">
                {r.year}–{String(r.year + 1).slice(-2)} • {eraForCoach(coach)} • {coach}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">G</div>
                  <div className="mt-1 font-semibold">{r.games ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">MPG</div>
                  <div className="mt-1 font-semibold">{r.minutes ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">PPG</div>
                  <div className="mt-1 font-semibold">{r.pts ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">APG</div>
                  <div className="mt-1 font-semibold">{r.ast ?? "—"}</div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
