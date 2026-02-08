"use client";

import type { Season } from "@/lib/ucData";
import { coachForYear, eraForCoach } from "@/lib/ucData";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

// Color palette for major eras
const ERA_COLORS = {
  // Championship Era (1960-1963)
  championship: {
    border: "border-amber-500/50",
    bg: "bg-gradient-to-br from-amber-950/30 to-yellow-950/20",
    accent: "text-amber-400"
  },
  // Huggins Era (1989-2004)
  huggins: {
    border: "border-red-500/40",
    bg: "bg-gradient-to-br from-red-950/30 to-red-900/20",
    accent: "text-red-400"
  },
  // Cronin Era (2006-2018)
  cronin: {
    border: "border-blue-500/40",
    bg: "bg-gradient-to-br from-blue-950/30 to-blue-900/20",
    accent: "text-blue-400"
  },
  // Modern Era
  modern: {
    border: "border-purple-500/40",
    bg: "bg-gradient-to-br from-purple-950/30 to-purple-900/20",
    accent: "text-purple-400"
  },
  // Default
  default: {
    border: "border-white/10",
    bg: "bg-white/5",
    accent: "text-zinc-400"
  }
};

function getEraStyle(season: Season) {
  const coach = coachForYear(season.year).toLowerCase();
  
  // Championship era (1960-1963)
  if (season.year >= 1960 && season.year <= 1963) {
    return ERA_COLORS.championship;
  }
  
  // Huggins era
  if (coach.includes("huggins")) {
    return ERA_COLORS.huggins;
  }
  
  // Cronin era
  if (coach.includes("cronin")) {
    return ERA_COLORS.cronin;
  }
  
  // Modern era (Miller, Brannen)
  if (season.year >= 2019) {
    return ERA_COLORS.modern;
  }
  
  return ERA_COLORS.default;
}

interface SeasonCardProps {
  season: Season;
}

export function SeasonCard({ season }: SeasonCardProps) {
  const coachName = coachForYear(season.year);
  const era = eraForCoach(coachName);
  const style = getEraStyle(season);
  
  const isChampionship = season.postseason?.includes("Won NCAA Tournament National Final");
  const isFinalFour = season.postseason?.includes("National Semifinal") || season.postseason?.includes("National Final");
  
  return (
    <article
      className={`relative rounded-xl border p-4 hover:bg-white/7 transition-all ${style.border} ${style.bg}`}
    >
      {isChampionship && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50 animate-pulse">
            <span className="text-sm">🏆</span>
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs ${style.accent}`}>Season</div>
          <div className="text-xl font-black tracking-tight">
            {season.year}–{String(season.year + 1).slice(-2)}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs ${style.accent}`}>Record</div>
          <div className="text-lg font-bold">{season.record}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{coachName}</Badge>
        <Badge>{era}</Badge>
        {season.conf ? <Badge>{season.conf}</Badge> : null}
        {isChampionship ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-300 font-bold">
            🏆 National Champions
          </span>
        ) : isFinalFour ? (
          <Badge>Final Four</Badge>
        ) : season.postseason ? (
          <Badge>{season.postseason}</Badge>
        ) : (
          <Badge>No postseason</Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-300">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-400">Conf</div>
          <div className="mt-1 font-semibold">
            {season.conf_wins != null && season.conf_losses != null
              ? `${season.conf_wins}-${season.conf_losses}`
              : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-400">SRS / SOS</div>
          <div className="mt-1 font-semibold">
            {season.srs != null ? season.srs.toFixed(2) : "—"} / {season.sos != null ? season.sos.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      {season.season_url ? (
        <a
          className="mt-3 inline-block text-xs text-zinc-400 hover:text-white underline underline-offset-4"
          href={season.season_url}
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      ) : null}
    </article>
  );
}
