/*
  Build UC Hoops data from Sports-Reference.

  Outputs:
    - src/data/seasons.json
    - src/data/players.json

  Notes:
    - We store `year` as the *season start year* (e.g. 2012 = 2012-13).
    - Sports-Reference season pages are keyed by season end year (2013.html).

  Usage:
    node scripts/build_uc_data.mjs                 # all available seasons
    node scripts/build_uc_data.mjs --from 1950
    node scripts/build_uc_data.mjs --from 1950 --to 2025
    node scripts/build_uc_data.mjs --from 1950 --to 1969 --append
    node scripts/build_uc_data.mjs --from 1901 --to 1949 --append --seasons-only

  Be polite. This is a small scraper.
*/

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as cheerio from "cheerio";

const SCHOOL_SEASONS_URL = "https://www.sports-reference.com/cbb/schools/cincinnati/men/";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function n(v) {
  const x = typeof v === "string" ? v.trim() : "";
  if (!x) return null;
  const num = Number(x);
  return Number.isFinite(num) ? num : null;
}

function parseRecord(s) {
  const m = String(s || "").match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return { wins: null, losses: null };
  return { wins: Number(m[1]), losses: Number(m[2]) };
}

function absUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  return `https://www.sports-reference.com${href}`;
}

async function fetchHtml(url, opts = { tries: 6 }) {
  let wait = 650;
  for (let i = 0; i < opts.tries; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20_000);

    let res;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": "uc-hoops-history/0.1 (data builder; personal fan project)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(t);
      await sleep(wait);
      wait = Math.min(wait * 1.6, 10_000);
      continue;
    } finally {
      clearTimeout(t);
    }

    if (res.ok) return await res.text();

    // Basic backoff for rate limiting / transient errors.
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.headers.get("retry-after");
      const raMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const sleepMs = Number.isFinite(raMs) ? Math.max(raMs, wait) : wait;
      await sleep(sleepMs);
      wait = Math.min(wait * 1.6, 10_000);
      continue;
    }

    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }

  throw new Error(`Fetch failed after retries for ${url}`);
}

function extractTable(html, id) {
  // Sports-Reference often wraps tables in HTML comments.
  // Try non-comment first, then commented.
  const direct = html.match(new RegExp(`<table[^>]*id=\"${id}\"[\\s\\S]*?<\\/table>`, "i"));
  if (direct?.[0]) return direct[0];

  const commented = html.match(new RegExp(`<!--\\s*(<table[^>]*id=\"${id}\"[\\s\\S]*?<\\/table>)\\s*-->`, "i"));
  if (commented?.[1]) return commented[1];

  return null;
}

function loadTable(html, id) {
  const t = extractTable(html, id);
  if (!t) return null;
  return cheerio.load(t);
}

async function getSeasonIndex() {
  const html = await fetchHtml(SCHOOL_SEASONS_URL);

  // seasons table id on this Sports-Reference page
  const $seasons = loadTable(html, "cincinnati");
  if (!$seasons) throw new Error("Could not find seasons table on school index page");

  const rows = $seasons("#cincinnati tbody tr").toArray();

  const seasons = [];
  for (const tr of rows) {
    const row = $seasons(tr);

    const seasonCell = row.find('td[data-stat="season"]');
    const yearEndStr = seasonCell.find("a").text().trim() || seasonCell.text().trim();

    // season text is usually like "2025-26" (start-end). Derive end-year.
    const mYear = yearEndStr.match(/(\d{4})(?:\s*-\s*(\d{2}))?/);
    if (!mYear) continue;

    const y0 = Number(mYear[1]);
    const y1s = mYear[2];

    let yearEnd = y0;
    if (y1s) {
      const suffix = Number(y1s);
      const century = Math.floor(y0 / 100) * 100;
      yearEnd = century + suffix;
      if (yearEnd < y0) yearEnd += 100;
    }

    if (!Number.isFinite(yearEnd)) continue;

    const seasonUrl = absUrl(seasonCell.find("a").attr("href"));

    const record = row.find('td[data-stat="win_loss_pct"]').text().trim();
    // Sports-Reference uses win_loss_pct column; but the visible record is in W and L columns.
    const w = n(row.find('td[data-stat="wins"]').text());
    const l = n(row.find('td[data-stat="losses"]').text());

    const coach =
      row.find('td[data-stat="coaches"] a').text().trim() ||
      row.find('td[data-stat="coaches"]').text().trim() ||
      "";
    const conf = row.find('td[data-stat="conf_abbr"] a').text().trim() || row.find('td[data-stat="conf_abbr"]').text().trim();

    const srs = n(row.find('td[data-stat="srs"]').text());
    const sos = n(row.find('td[data-stat="sos"]').text());

    const confWins = n(row.find('td[data-stat="wins_conf"]').text());
    const confLosses = n(row.find('td[data-stat="losses_conf"]').text());

    const postseason = row.find('td[data-stat="round_max"]').text().trim() || null;

    // map end-year to start-year (2013 -> 2012 season)
    const year = yearEnd - 1;

    seasons.push({
      year,
      coach: coach || "Unknown",
      record: w != null && l != null ? `${w}-${l}` : record || "",
      wins: w ?? 0,
      losses: l ?? 0,
      srs,
      sos,
      conf: conf || null,
      conf_wins: confWins,
      conf_losses: confLosses,
      postseason,
      season_url: seasonUrl,
      _yearEnd: yearEnd,
    });
  }

  // sort ascending by year
  seasons.sort((a, b) => a.year - b.year);
  return seasons;
}

async function getPlayersForSeason(yearEnd) {
  const url = `https://www.sports-reference.com/cbb/schools/cincinnati/men/${yearEnd}.html`;
  const html = await fetchHtml(url);

  const $per = loadTable(html, "players_per_game");
  if (!$per) throw new Error(`Could not find players_per_game table for ${yearEnd}`);

  const rows = $per("#players_per_game tbody tr").toArray();

  const out = [];
  for (const tr of rows) {
    const row = $per(tr);
    const playerCell = row.find('td[data-stat="name_display"]');

    const player = playerCell.text().trim();
    if (!player || player === "Player") continue;

    const href = playerCell.find("a").attr("href");
    const player_url = absUrl(href);

    const pos = row.find('td[data-stat="pos"]').text().trim() || null;
    const class_year = row.find('td[data-stat="class"]').text().trim() || null;

    const games = n(row.find('td[data-stat="games"]').text());
    const games_started = n(row.find('td[data-stat="games_started"]').text());

    // per-game numbers
    const minutes = n(row.find('td[data-stat="mp_per_g"]').text());
    const pts = n(row.find('td[data-stat="pts_per_g"]').text());
    const trb = n(row.find('td[data-stat="trb_per_g"]').text()) ?? n(row.find('td[data-stat="trb_per_g"]').text());
    const ast = n(row.find('td[data-stat="ast_per_g"]').text());

    out.push({
      year: yearEnd - 1,
      player,
      player_url,
      class_year,
      pos,
      games,
      games_started,
      minutes,
      pts,
      trb,
      ast,
    });
  }

  return out;
}

async function main() {
  const from = Number(arg("--from", "0"));
  const to = Number(arg("--to", "9999"));
  const indexOnly = process.argv.includes("--index-only");
  const append = process.argv.includes("--append");
  const seasonsOnly = process.argv.includes("--seasons-only");

  const seasonsAll = await getSeasonIndex();
  if (indexOnly) {
    console.log(`Found ${seasonsAll.length} seasons.`);
    console.log("First 5:", seasonsAll.slice(0, 5).map((s) => ({ year: s.year, coach: s.coach, season_url: s.season_url })));
    console.log("Last 5:", seasonsAll.slice(-5).map((s) => ({ year: s.year, coach: s.coach, season_url: s.season_url })));
    return;
  }

  const seasons = seasonsAll.filter((s) => s.year >= from && s.year <= to);

  if (!seasons.length) {
    console.error("No seasons found for the requested range.");
    process.exit(1);
  }

  const players = [];

  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    const yearEnd = s._yearEnd;

    console.log(`[${i + 1}/${seasons.length}] Season ${s.year}-${String(yearEnd).slice(-2)} (${yearEnd})`);

    if (!seasonsOnly) {
      try {
        const rows = await getPlayersForSeason(yearEnd);
        players.push(...rows);
      } catch (e) {
        console.error(`Failed season ${yearEnd}:`, e);
        // continue
      }
    }

    // polite delay
    await sleep(900);
  }

  // Remove helper field
  const seasonsOut = seasons.map(({ _yearEnd, ...rest }) => rest);

  const root = process.cwd();
  const seasonsPath = path.join(root, "src", "data", "seasons.json");
  const playersPath = path.join(root, "src", "data", "players.json");

  let seasonsFinal = seasonsOut;
  let playersFinal = players;

  if (append) {
    try {
      const existingSeasons = JSON.parse(await fs.readFile(seasonsPath, "utf8"));
      if (Array.isArray(existingSeasons)) {
        const byYear = new Map(existingSeasons.map((s) => [s.year, s]));
        for (const s of seasonsOut) byYear.set(s.year, s);
        seasonsFinal = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
      }
    } catch {
      // ignore missing/invalid
    }

    try {
      const existingPlayers = JSON.parse(await fs.readFile(playersPath, "utf8"));
      if (Array.isArray(existingPlayers)) {
        const key = (r) => `${r.year}|${r.player_url || r.player}`;
        const byKey = new Map(existingPlayers.map((r) => [key(r), r]));
        for (const r of players) byKey.set(key(r), r);
        playersFinal = Array.from(byKey.values()).sort((a, b) => (a.year - b.year) || String(a.player).localeCompare(String(b.player)));
      }
    } catch {
      // ignore missing/invalid
    }
  }

  await fs.writeFile(seasonsPath, JSON.stringify(seasonsFinal, null, 2) + "\n", "utf8");
  await fs.writeFile(playersPath, JSON.stringify(playersFinal, null, 2) + "\n", "utf8");

  console.log(`Wrote ${seasonsFinal.length} seasons → ${seasonsPath}`);
  console.log(`Wrote ${playersFinal.length} player seasons → ${playersPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
