/*
  Generate coach eras from src/data/seasons.json.

  Usage:
    node scripts/generate_eras_from_seasons.mjs > src/data/eras.generated.json

  Then copy/paste into eras.json (or merge manually).
*/

import fs from "node:fs/promises";
import path from "node:path";

const seasonsPath = path.join(process.cwd(), "src", "data", "seasons.json");

function cleanCoach(coach) {
  return String(coach || "Unknown").replace(/\s*\(.*\)\s*$/, "").trim();
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const seasons = JSON.parse(await fs.readFile(seasonsPath, "utf8"));
const rows = Array.isArray(seasons) ? seasons : [];
rows.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

/**
 * Build contiguous spans by coach.
 */
const spans = [];
let cur = null;
for (const r of rows) {
  const year = Number(r.year);
  if (!Number.isFinite(year)) continue;
  const coach = cleanCoach(r.coach);

  if (!cur || cur.coach !== coach || year !== cur.to + 1) {
    if (cur) spans.push(cur);
    cur = { coach, from: year, to: year };
  } else {
    cur.to = year;
  }
}
if (cur) spans.push(cur);

const eras = spans
  .filter((s) => s.to - s.from >= 1) // drop 1-year stints by default
  .map((s) => ({
    id: `coach-${slug(s.coach)}-${s.from}`,
    label: `${s.coach} Era (${s.from}–${s.to})`,
    from: s.from,
    to: s.to,
    group: "Coach",
  }));

process.stdout.write(JSON.stringify(eras, null, 2) + "\n");
