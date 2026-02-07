import seasonsRaw from "@/data/seasons.json";
import playersRaw from "@/data/players.json";
import erasRaw from "@/data/eras.json";

export type Season = {
  year: number;
  coach: string;
  record: string;
  wins: number;
  losses: number;
  srs?: number | null;
  sos?: number | null;
  conf?: string | null;
  conf_wins?: number | null;
  conf_losses?: number | null;
  postseason?: string | null;
  season_url?: string | null;
};

export type PlayerSeason = {
  year: number;
  player: string;
  player_url?: string | null;
  class_year?: string | null;
  pos?: string | null;
  games?: number | null;
  games_started?: number | null;
  minutes?: number | null;
  pts?: number | null;
  trb?: number | null;
  ast?: number | null;
};

export type Era = {
  id: string;
  label: string;
  from: number;
  to: number;
  group?: string | null;
};

export const seasons = seasonsRaw as Season[];
export const playerSeasons = playersRaw as PlayerSeason[];
export const eras = erasRaw as Era[];

export function coachForYear(year: number): string {
  const s = seasons.find((x) => x.year === year);
  if (!s?.coach) return "Unknown";
  // SportsRef includes record in parentheses; keep name only.
  return s.coach.replace(/\s*\(.*\)\s*$/, "");
}

export function eraForCoach(coach: string): "Cronin" | "Brannen" | "Miller" | "Other" {
  const c = coach.toLowerCase();
  if (c.includes("cronin")) return "Cronin";
  if (c.includes("brannen")) return "Brannen";
  if (c.includes("miller")) return "Miller";
  return "Other";
}

// NOTE: In our Sports-Reference scrape, `minutes` is Minutes Per Game (MPG), not total minutes.
export function filterActuallyPlayed(rows: PlayerSeason[], opts?: { minGames?: number; minMinutes?: number }) {
  const minGames = opts?.minGames ?? 10;
  const minMinutes = opts?.minMinutes ?? 10; // min MPG
  return rows.filter((r) => (r.games ?? 0) >= minGames && (r.minutes ?? 0) >= minMinutes);
}

export function uniqPlayers(rows: PlayerSeason[]) {
  const set = new Set<string>();
  for (const r of rows) set.add(r.player);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
