import type { DraftMode, Lineup } from "@/lib/sim";
import { teamTraits } from "@/lib/sim";

export function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function tagLevel(x: number, ranges: [number, string][]) {
  for (const [th, label] of ranges) if (x >= th) return label;
  return ranges[ranges.length - 1]![1];
}

export function identityFromTraits(opts: { pace: number; toRate: number; orebRate: number; threeRate: number }) {
  const paceTag = opts.pace >= 78 ? "Track meet" : opts.pace <= 62 ? "Rock fight" : opts.pace >= 72 ? "Fast" : "Normal";

  const threeTag = tagLevel(opts.threeRate, [
    [0.44, "Bombs away"],
    [0.36, "3s heavy"],
    [0.28, "Balanced"],
    [0.0, "Paint first"],
  ]);

  const glassTag = tagLevel(opts.orebRate, [
    [0.34, "Owns the glass"],
    [0.27, "Crashes"],
    [0.22, "Fine"],
    [0.0, "One and done"],
  ]);

  const securityTag = tagLevel(1 - opts.toRate, [
    [0.84, "Ball security"],
    [0.78, "Steady"],
    [0.72, "Loose"],
    [0.0, "Turnover vibes"],
  ]);

  return [paceTag, threeTag, glassTag, securityTag];
}

export function quickTeamProfile(lineup: Lineup, mode: DraftMode) {
  const t = teamTraits(lineup);

  // Rough pace guess from traits
  const basePace = 66 + t.style.pace * 6;
  const pace = Math.round(Math.max(56, Math.min(90, basePace)));

  // Mirror the sim's proxy formulas (so labels match what people see)
  const off = t.scoring * 0.55 + t.playmaking * 1.15 + t.rebounding * 0.1;
  const def = t.rebounding * 0.7 + t.size * 10 + t.consistency * 6;

  const toRate = Math.max(0.1, Math.min(0.3, 0.22 - t.playmaking * 0.006 - (t.consistency - 0.6) * 0.1));
  const orebRate = Math.max(0.14, Math.min(0.42, 0.24 + t.rebounding * 0.003));
  const threeRate = Math.max(0.18, Math.min(0.5, 0.3 + t.style.threes * 0.1 + t.playmaking * 0.004));

  // crude shooting estimates (not exact; for UI flavor)
  const swing = Math.max(-0.08, Math.min(0.1, (off - def) / 140));
  const p2 = Math.max(0.32, Math.min(0.62, 0.46 + swing));
  const p3 = Math.max(0.22, Math.min(0.48, 0.33 + swing));

  const chips = identityFromTraits({ pace, toRate, orebRate, threeRate });

  return {
    mode,
    traits: t,
    pace,
    off,
    def,
    toRate,
    orebRate,
    threeRate,
    p2,
    p3,
    chips,
  };
}
