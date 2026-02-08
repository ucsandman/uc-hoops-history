"use client";

import { useState, useMemo } from "react";
import { seasons, eras, coachForYear } from "@/lib/ucData";
import { StatsCard } from "@/components/StatsCard";
import { TimelineChart } from "@/components/TimelineChart";
import { SeasonFilters } from "@/components/SeasonFilters";
import { EraLegend } from "@/components/EraLegend";
import { SeasonCard } from "@/components/SeasonCard";
import type { Season } from "@/lib/ucData";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

interface FilterState {
  coach: string;
  era: string;
  tournamentOnly: boolean;
  winningOnly: boolean;
}

export default function Home() {
  const [filters, setFilters] = useState<FilterState>({
    coach: "all",
    era: "all",
    tournamentOnly: false,
    winningOnly: false
  });

  // Get unique coaches for filter dropdown
  const coaches = useMemo(() => {
    const coachSet = new Set<string>();
    seasons.forEach(s => {
      coachSet.add(coachForYear(s.year));
    });
    return Array.from(coachSet).sort();
  }, []);

  // Get eras for filter (focusing on major coaching/conference eras)
  const majorEras = useMemo(() => {
    return eras
      .filter(e => e.group === "Coach" || e.group === "Conference" || e.group === "Decade")
      .sort((a, b) => a.from - b.from);
  }, []);

  // Filter seasons based on current filters
  const filteredSeasons = useMemo(() => {
    return seasons.filter(season => {
      // Coach filter
      if (filters.coach !== "all" && coachForYear(season.year) !== filters.coach) {
        return false;
      }

      // Era filter
      if (filters.era !== "all") {
        const selectedEra = eras.find(e => e.id === filters.era);
        if (selectedEra) {
          if (season.year < selectedEra.from || season.year > selectedEra.to) {
            return false;
          }
        }
      }

      // Tournament only filter
      if (filters.tournamentOnly && !season.postseason?.includes("NCAA Tournament")) {
        return false;
      }

      // Winning seasons only filter (>50% win rate)
      if (filters.winningOnly) {
        const totalGames = season.wins + season.losses;
        const winPct = totalGames > 0 ? season.wins / totalGames : 0;
        if (winPct <= 0.5) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const sortedSeasons = useMemo(() => {
    return [...filteredSeasons].sort((a, b) => b.year - a.year);
  }, [filteredSeasons]);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="sb-card relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/70 via-red-500/15 to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>UC Men's Basketball</Badge>
            <Badge>Halftime Mode</Badge>
            <Badge>1901 → Now</Badge>
          </div>

          <h1 className="mt-4 text-balance text-3xl tracking-tight sm:text-4xl font-black [font-family:var(--font-display)]">
            Pull this up at halftime and start talking trash.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-zinc-300">
            Draft teams, run fake sims, and argue with receipts. Built for group chats, tailgates, and
            that one friend who will not stop bringing up 2014.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a href="/draft" className="sb-chip rounded-2xl border border-white/10 bg-black/25 p-4 hover:bg-white/5 transition-colors">
              <div className="text-xs text-zinc-400">Main event</div>
              <div className="mt-1 text-lg font-black tracking-tight">Draft</div>
              <div className="mt-1 text-xs text-zinc-400">Top 5 League and Sicko League</div>
            </a>
            <a href="/players" className="sb-chip rounded-2xl border border-white/10 bg-black/25 p-4 hover:bg-white/5 transition-colors">
              <div className="text-xs text-zinc-400">Scouting</div>
              <div className="mt-1 text-lg font-black tracking-tight">Players</div>
              <div className="mt-1 text-xs text-zinc-400">Leaderboards and filters</div>
            </a>
            <a href="/random" className="sb-chip rounded-2xl border border-white/10 bg-black/25 p-4 hover:bg-white/5 transition-colors">
              <div className="text-xs text-zinc-400">Chaos</div>
              <div className="mt-1 text-lg font-black tracking-tight">Random 5</div>
              <div className="mt-1 text-xs text-zinc-400">Screenshot a lineup</div>
            </a>
          </div>
        </div>
      </section>

      {/* Quick Stats Section */}
      <StatsCard />

      {/* Timeline Chart Section */}
      <TimelineChart />

      {/* Era Legend */}
      <EraLegend />

      {/* Filters and Seasons Section */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">
            Season Timeline 
            <span className="ml-2 text-sm text-zinc-400 font-normal">
              ({sortedSeasons.length} {sortedSeasons.length === 1 ? 'season' : 'seasons'})
            </span>
          </h2>
          <a
            href="/players"
            className="text-sm text-zinc-300 hover:text-white underline underline-offset-4"
          >
            Go to Players →
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <SeasonFilters 
                coaches={coaches}
                eras={majorEras}
                onFilterChange={setFilters}
              />
            </div>
          </div>

          {/* Season Cards Grid */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedSeasons.map((s) => (
                <SeasonCard key={s.year} season={s} />
              ))}
            </div>

            {sortedSeasons.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-zinc-400">No seasons match your filters.</div>
                <div className="text-sm text-zinc-500 mt-1">Try adjusting your filter settings.</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
