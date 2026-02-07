/*
  Merge generated coach eras into src/data/eras.json.

  Usage:
    node scripts/generate_eras_from_seasons.mjs > src/data/eras.generated.json
    node scripts/merge_eras.mjs
*/

import fs from "node:fs/promises";
import path from "node:path";

const erasPath = path.join(process.cwd(), "src", "data", "eras.json");
const genPath = path.join(process.cwd(), "src", "data", "eras.generated.json");

const eras = JSON.parse(await fs.readFile(erasPath, "utf8"));
const gen = JSON.parse(await fs.readFile(genPath, "utf8"));

const base = Array.isArray(eras) ? eras : [];
const coach = Array.isArray(gen) ? gen : [];

// Keep non-coach eras from base, replace coach eras with generated.
const kept = base.filter((e) => String(e.group || "").toLowerCase() !== "coach");

// Ensure unique ids
const byId = new Map();
for (const e of [...kept, ...coach]) byId.set(e.id, e);

const out = Array.from(byId.values()).sort((a, b) => {
  const ga = String(a.group || "");
  const gb = String(b.group || "");
  if (ga !== gb) return ga.localeCompare(gb);
  return (a.from ?? 0) - (b.from ?? 0);
});

await fs.writeFile(erasPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Merged eras.json: ${out.length} total eras (kept ${kept.length}, coach ${coach.length})`);
