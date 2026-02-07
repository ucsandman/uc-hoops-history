"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { eras, filterActuallyPlayed, playerSeasons } from "@/lib/ucData";

type Row = (typeof playerSeasons)[number];

type SlotId = "pg" | "sg" | "sf" | "pf" | "c";

type DraftState = {
  top: Record<SlotId, string | null>;
  bottom: Record<SlotId, string | null>;
};

type PosFilter = "All" | "G" | "F" | "C";

const SLOTS: { id: SlotId; label: string; hint: string }[] = [
  { id: "pg", label: "PG", hint: "ball handler" },
  { id: "sg", label: "SG", hint: "scorer" },
  { id: "sf", label: "SF", hint: "wing" },
  { id: "pf", label: "PF", hint: "big wing" },
  { id: "c", label: "C", hint: "rim" },
];

const EMPTY: DraftState = {
  top: { pg: null, sg: null, sf: null, pf: null, c: null },
  bottom: { pg: null, sg: null, sf: null, pf: null, c: null },
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

function encodeState(s: DraftState): string {
  const json = JSON.stringify(s);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeState(v: string): DraftState | null {
  try {
    const json = decodeURIComponent(escape(atob(v)));
    const parsed = JSON.parse(json);
    if (!parsed?.top || !parsed?.bottom) return null;
    return parsed as DraftState;
  } catch {
    return null;
  }
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function bestSeasonRow(rows: Row[]): Row | null {
  if (!rows.length) return null;
  // Prefer highest PPG, then MPG, then games.
  return [...rows].sort((a, b) => {
    const ap = a.pts ?? 0;
    const bp = b.pts ?? 0;
    if (bp !== ap) return bp - ap;
    const am = a.minutes ?? 0;
    const bm = b.minutes ?? 0;
    if (bm !== am) return bm - am;
    const ag = a.games ?? 0;
    const bg = b.games ?? 0;
    return bg - ag;
  })[0];
}

function posBucket(pos?: string | null): "G" | "F" | "C" | "U" {
  const p = (pos ?? "").toUpperCase();
  if (p.includes("G") || p.includes("PG") || p.includes("SG")) return "G";
  if (p.includes("F") || p.includes("SF") || p.includes("PF")) return "F";
  if (p.includes("C")) return "C";
  return "U";
}

function eligibleSlotsForBucket(bucket: ReturnType<typeof posBucket>): SlotId[] {
  if (bucket === "G") return ["pg", "sg"];
  if (bucket === "F") return ["sf", "pf"];
  if (bucket === "C") return ["c", "pf"]; // allow C to play PF
  return ["pg", "sg", "sf", "pf", "c"];
}

function slotBucket(slot: SlotId): "G" | "F" | "C" {
  if (slot === "pg" || slot === "sg") return "G";
  if (slot === "c") return "C";
  return "F";
}

function avg(nums: Array<number | null | undefined>) {
  const arr = nums.map((x) => x ?? 0).filter((x) => Number.isFinite(x));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(name: string, q: string) {
  const n = norm(name);
  const query = norm(q);
  if (!query) return true;

  // Token match ("yancy gate" matches "Yancy Gates")
  const tokens = query.split(" ").filter(Boolean);
  if (tokens.every((t) => n.includes(t))) return true;

  // Subsequence match for sloppy typing ("gts" -> "gates")
  let i = 0;
  for (const ch of query.replace(/\s+/g, "")) {
    i = n.indexOf(ch, i);
    if (i === -1) return false;
    i++;
  }
  return true;
}

export default function DraftBoard() {
  const played = useMemo(() => filterActuallyPlayed(playerSeasons, { minGames: 10, minMinutes: 10 }), []);

  const [query, setQuery] = useState("");
  const [era, setEra] = useState<string>("all");
  const [mode, setMode] = useState<"top" | "sicko">("top");
  const [sortBy, setSortBy] = useState<"alpha" | "ppg" | "mpg" | "games">("ppg");
  const [draftName, setDraftName] = useState("");
  const [meUser, setMeUser] = useState<null | { id: string; username: string }>(null);
  const active = mode === "top" ? "top" : "bottom";

  const [posFilter, setPosFilter] = useState<PosFilter>("All");

  const [rosterLimit, setRosterLimit] = useState(80);
  const [picker, setPicker] = useState<null | { side: "top" | "bottom"; slot: SlotId }>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const [recents, setRecents] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  const playerListRef = useRef<HTMLDivElement | null>(null);
  const [focus, setFocus] = useState<null | { side: "top" | "bottom"; slot: SlotId }>(null);

  const [state, setState] = useState<DraftState>(() => {
    if (typeof window === "undefined") return EMPTY;
    const url = new URL(window.location.href);
    const s = url.searchParams.get("s");
    const decoded = s ? decodeState(s) : null;
    return decoded ?? EMPTY;
  });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const shareUrlRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // If we land without a URL-encoded state, prefill the share field with current URL.
    if (shareUrlRef.current) shareUrlRef.current.value = window.location.href;

    // Load local prefs
    try {
      const r = JSON.parse(localStorage.getItem("uc_draft_recents") ?? "[]");
      if (Array.isArray(r)) setRecents(r.filter((x) => typeof x === "string").slice(0, 24));

      const f = JSON.parse(localStorage.getItem("uc_draft_favorites") ?? "[]");
      if (Array.isArray(f)) setFavorites(new Set(f.filter((x) => typeof x === "string")));
    } catch {
      // ignore
    }

    // Device account (optional)
    fetch("/api/account")
      .then((r) => r.json())
      .then((j: unknown) => {
        const u =
          typeof j === "object" && j && "user" in j
            ? (j as { user: { id: string; username: string } | null }).user
            : null;
        if (u?.id && u?.username) setMeUser(u);
      })
      .catch(() => null);
  }, []);

  const statsByPlayer = useMemo(() => {
    const eraObj = eras.find((e) => e.id === era) ?? null;
    const filtered = played.filter((r) => {
      if (era === "all") return true;
      if (!eraObj) return true;
      return r.year >= eraObj.from && r.year <= eraObj.to;
    });

    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const arr = map.get(r.player) ?? [];
      arr.push(r);
      map.set(r.player, arr);
    }

    const out = new Map<string, Row>();
    for (const [name, rows] of map.entries()) {
      const best = bestSeasonRow(rows);
      if (best) out.set(name, best);
    }
    return out;
  }, [played, era]);

  const roster = useMemo(() => {
    const eraObj = eras.find((e) => e.id === era) ?? null;
    const filtered = played.filter((r) => {
      if (era === "all") return true;
      if (!eraObj) return true;
      return r.year >= eraObj.from && r.year <= eraObj.to;
    });

    // collapse to unique player names
    let names = uniq(filtered.map((r) => r.player));

    // position filter (based on each player's best season row in this era)
    if (posFilter !== "All") {
      names = names.filter((n) => {
        const best = statsByPlayer.get(n);
        const b = posBucket(best?.pos);
        if (posFilter === "G") return b === "G" || b === "U";
        if (posFilter === "F") return b === "F" || b === "U";
        return b === "C" || b === "U";
      });
    }

    if (query.trim()) {
      names = names.filter((n) => fuzzyMatch(n, query));
    }

    const val = (name: string) => {
      const r = statsByPlayer.get(name);
      return {
        ppg: r?.pts ?? 0,
        mpg: r?.minutes ?? 0,
        games: r?.games ?? 0,
      };
    };

    if (sortBy === "alpha") return names.sort((a, b) => a.localeCompare(b));

    const key = sortBy;
    return names.sort((a, b) => {
      const av = val(a)[key];
      const bv = val(b)[key];
      if (bv !== av) return bv - av;
      return a.localeCompare(b);
    });
  }, [played, query, era, posFilter, statsByPlayer, sortBy]);

  /* const statsByPlayer_UNUSED_REMOVED = useMemo(() => {
    const filtered = played.filter((r) => {
      const coach = coachForYear(r.year);
      const e = eraForCoach(coach);
      if (era === "All") return true;
      return e === era;
    });

    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const arr = map.get(r.player) ?? [];
      arr.push(r);
      map.set(r.player, arr);
    }

    const out = new Map<string, Row>();
    for (const [name, rows] of map.entries()) {
      const best = bestSeasonRow(rows);
      if (best) out.set(name, best);
    }
    return out;
  }, [played, era]);
  */

  function bumpRecent(player: string) {
    setRecents((prev) => {
      const next = [player, ...prev.filter((x) => x !== player)].slice(0, 24);
      try {
        localStorage.setItem("uc_draft_recents", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function toggleFavorite(player: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(player)) next.delete(player);
      else next.add(player);
      try {
        localStorage.setItem("uc_draft_favorites", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function pickPlayer(side: "top" | "bottom", slot: SlotId, player: string) {
    let applied = false;
    setState((prev) => {
      const current = prev[side][slot];

      // prevent duplicates across board (but allow replacing the current slot)
      const taken = new Set<string>();
      for (const s of Object.values(prev.top)) if (s) taken.add(s);
      for (const s of Object.values(prev.bottom)) if (s) taken.add(s);
      if (current) taken.delete(current);

      const next: DraftState = {
        top: { ...prev.top },
        bottom: { ...prev.bottom },
      };
      // If player already taken elsewhere, ignore.
      if (taken.has(player)) return prev;

      next[side][slot] = player;
      applied = true;
      return next;
    });

    if (applied) bumpRecent(player);
  }

  function clearSlot(side: "top" | "bottom", slot: SlotId) {
    setState((prev) => ({
      top: side === "top" ? { ...prev.top, [slot]: null } : prev.top,
      bottom: side === "bottom" ? { ...prev.bottom, [slot]: null } : prev.bottom,
    }));
  }

  function setSlotFocus(next: null | { side: "top" | "bottom"; slot: SlotId }) {
    setFocus(next);
    if (!next) return;

    const b = slotBucket(next.slot);
    setPosFilter(b);

    // encourage search+tap flow on mobile
    setTimeout(() => {
      playerListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function quickAdd(filter: PosFilter) {
    const board = active;

    // Choose slot order preference depending on requested position.
    const slotPrefs: SlotId[] =
      filter === "G" ? ["pg", "sg"] : filter === "F" ? ["sf", "pf"] : filter === "C" ? ["c", "pf"] : ["pg", "sg", "sf", "pf", "c"];

    // Find first empty slot in preference.
    const slot = slotPrefs.find((s) => !state[board][s]) ?? (Object.entries(state[board]).find(([, v]) => !v)?.[0] as SlotId | undefined);
    if (!slot) return;

    const sb = filter === "All" ? null : filter;

    // Find best available player by PPG that fits this slot bucket.
    const candidates = Array.from(statsByPlayer.entries())
      .map(([name, row]) => ({ name, row }))
      .filter(({ name }) => !taken.has(name))
      .filter(({ row }) => {
        if (!sb) return true;
        const b = posBucket(row.pos);
        if (sb === "G") return b === "G" || b === "U";
        if (sb === "F") return b === "F" || b === "U";
        return b === "C" || b === "U";
      })
      .filter(({ row }) => {
        // Slot-specific sanity: don't put a pure C at PG etc.
        const b = posBucket(row.pos);
        const sbb = slotBucket(slot);
        if (sbb === "G") return b === "G" || b === "U";
        if (sbb === "C") return b === "C" || b === "U";
        return b === "F" || b === "U";
      })
      .sort((a, b) => (b.row.pts ?? 0) - (a.row.pts ?? 0));

    const best = candidates[0]?.name;
    if (best) pickPlayer(board, slot, best);
  }

  function clearAll() {
    setState(EMPTY);
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState({}, "", url.toString());
  }

  function makeShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("s", encodeState(state));
    window.history.replaceState({}, "", url.toString());
    return url.toString();
  }

  async function copyShare() {
    const url = makeShareUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    if (shareUrlRef.current) shareUrlRef.current.value = url;
  }

  const taken = useMemo(() => {
    const t = new Set<string>();
    for (const s of Object.values(state.top)) if (s) t.add(s);
    for (const s of Object.values(state.bottom)) if (s) t.add(s);
    return t;
  }, [state]);

  async function saveDraft() {
    setSaveErr(null);
    setSaving(true);
    try {
      const lineup = {
        pg: state[active].pg ? (statsByPlayer.get(state[active].pg) ?? null) : null,
        sg: state[active].sg ? (statsByPlayer.get(state[active].sg) ?? null) : null,
        sf: state[active].sf ? (statsByPlayer.get(state[active].sf) ?? null) : null,
        pf: state[active].pf ? (statsByPlayer.get(state[active].pf) ?? null) : null,
        c: state[active].c ? (statsByPlayer.get(state[active].c) ?? null) : null,
      };

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          name: draftName.trim() || undefined,
          lineup,
          isPublic: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");

      window.location.href = `/d/${json.id}?k=${json.editKey}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveErr(msg);
      setSaving(false);
    }
  }

  const pickerList = useMemo(() => {
    if (!picker) return [] as string[];

    const sb = slotBucket(picker.slot);

    const candidates = roster
      .filter((n) => !taken.has(n) || state[picker.side][picker.slot] === n)
      .filter((n) => {
        const r = statsByPlayer.get(n);
        if (!r) return false;
        const b = posBucket(r.pos);
        if (sb === "G") return b === "G" || b === "U";
        if (sb === "C") return b === "C" || b === "U";
        return b === "F" || b === "U";
      })
      .filter((n) => (pickerQuery.trim() ? fuzzyMatch(n, pickerQuery) : true));

    // Prefer stronger + closer text match
    return [...candidates]
      .sort((a, b) => {
        const aq = norm(a);
        const bq = norm(b);
        const q = norm(pickerQuery);
        const aStarts = q && aq.startsWith(q) ? 1 : 0;
        const bStarts = q && bq.startsWith(q) ? 1 : 0;
        if (bStarts !== aStarts) return bStarts - aStarts;

        const ar = statsByPlayer.get(a);
        const br = statsByPlayer.get(b);
        const ap = ar?.pts ?? 0;
        const bp = br?.pts ?? 0;
        if (bp !== ap) return bp - ap;

        const aFav = favorites.has(a) ? 1 : 0;
        const bFav = favorites.has(b) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;

        return a.localeCompare(b);
      })
      .slice(0, 24);
  }, [picker, pickerQuery, roster, statsByPlayer, taken, state, favorites]);

  const pickerRecommended = useMemo(() => {
    if (!picker) return [] as string[];
    const sb = slotBucket(picker.slot);

    const all = Array.from(statsByPlayer.keys())
      .filter((n) => !taken.has(n) || state[picker.side][picker.slot] === n)
      .filter((n) => {
        const r = statsByPlayer.get(n);
        const b = posBucket(r?.pos);
        if (sb === "G") return b === "G" || b === "U";
        if (sb === "C") return b === "C" || b === "U";
        return b === "F" || b === "U";
      })
      .sort((a, b) => (statsByPlayer.get(b)?.pts ?? 0) - (statsByPlayer.get(a)?.pts ?? 0));

    return all.slice(0, 8);
  }, [picker, statsByPlayer, taken, state]);

  const pickerFavorites = useMemo(() => {
    if (!picker) return [] as string[];
    const sb = slotBucket(picker.slot);
    const out = Array.from(favorites)
      .filter((n) => statsByPlayer.has(n))
      .filter((n) => !taken.has(n) || state[picker.side][picker.slot] === n)
      .filter((n) => {
        const r = statsByPlayer.get(n);
        const b = posBucket(r?.pos);
        if (sb === "G") return b === "G" || b === "U";
        if (sb === "C") return b === "C" || b === "U";
        return b === "F" || b === "U";
      })
      .sort((a, b) => (statsByPlayer.get(b)?.pts ?? 0) - (statsByPlayer.get(a)?.pts ?? 0));

    return out.slice(0, 8);
  }, [picker, favorites, statsByPlayer, taken, state]);

  const pickerRecents = useMemo(() => {
    if (!picker) return [] as string[];
    const sb = slotBucket(picker.slot);
    const out = recents
      .filter((n) => statsByPlayer.has(n))
      .filter((n) => !taken.has(n) || state[picker.side][picker.slot] === n)
      .filter((n) => {
        const r = statsByPlayer.get(n);
        const b = posBucket(r?.pos);
        if (sb === "G") return b === "G" || b === "U";
        if (sb === "C") return b === "C" || b === "U";
        return b === "F" || b === "U";
      });

    return out.slice(0, 8);
  }, [picker, recents, statsByPlayer, taken, state]);

  const rosterShown = useMemo(() => roster.slice(0, rosterLimit), [roster, rosterLimit]);

  const letterIndex = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of rosterShown) {
      const letter = (n[0] ?? "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }

    const letters = Array.from(map.keys()).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    return { letters, map };
  }, [rosterShown]);

  function jumpToLetter(letter: string) {
    const el = document.getElementById(`roster-${letter}`);
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY;
    // account for sticky header + sticky filter bar
    window.scrollTo({ top: Math.max(0, top - 140), behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Draft Board</h1>
          <p className="text-sm text-zinc-300 max-w-3xl">
            Build a lineup, save it, then compete. Top 5 League is normal. Sicko League is inverted.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Era: {era === "all" ? "All" : eras.find((e) => e.id === era)?.label ?? era}</Badge>
          <Badge>Sort: {sortBy.toUpperCase()}</Badge>
          <Badge>Threshold: 10 games + 10 MPG</Badge>
          <Badge>Duplicates blocked</Badge>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs text-zinc-400">League</div>
                <div className="mt-1 inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("top")}
                    className={
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors " +
                      (mode === "top" ? "bg-white text-black" : "text-zinc-200 hover:bg-white/10")
                    }
                  >
                    Top 5
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("sicko")}
                    className={
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors " +
                      (mode === "sicko" ? "bg-white text-black" : "text-zinc-200 hover:bg-white/10")
                    }
                  >
                    Sicko
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {mode === "top" ? "Normal scoring. Higher wins." : "Inverted scoring. Lower wins."}
                </div>
              </div>

              <label className="block sm:min-w-[320px]">
                <div className="text-xs text-zinc-400">Draft name</div>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={meUser ? `${meUser.username} - Draft (auto)` : "My Draft"}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                />
                <div className="mt-1 text-[11px] text-zinc-500">
                  {meUser ? (
                    <>Leave blank to auto-name + save to <a className="underline underline-offset-4 hover:text-zinc-200" href="/me">My drafts</a>.</>
                  ) : (
                    <>Want saved drafts? <a className="underline underline-offset-4 hover:text-zinc-200" href="/account">Pick a username</a>.</>
                  )}
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="rounded-xl bg-red-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-red-400 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving" : mode === "top" ? "Save Top 5 Draft" : "Save Sicko Draft"}
              </button>
              <button
                type="button"
                onClick={copyShare}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition-colors"
              >
                {copied ? "Copied" : "Copy share link"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {saveErr ? <div className="mt-3 text-xs text-red-300">{saveErr}</div> : null}
          <div className="mt-2 text-xs text-zinc-500">
            Saving snapshots each player’s best UC season by PPG within the current era filter.
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        {/* Lineup first on mobile */}
        <div className="space-y-3 order-1 lg:order-none">
          {mode === "top" ? (
            <Lineup
              title="Top 5"
              accent="from-emerald-400/35"
              slots={state.top}
              statsByPlayer={statsByPlayer}
              onPick={(slot) => {
                setSlotFocus({ side: "top", slot });
                setPicker({ side: "top", slot });
                setPickerQuery("");
              }}
              onClear={(slot) => clearSlot("top", slot)}
            />
          ) : (
            <Lineup
              title="Bottom 5 (Sicko League)"
              accent="from-red-500/35"
              slots={state.bottom}
              statsByPlayer={statsByPlayer}
              onPick={(slot) => {
                setSlotFocus({ side: "bottom", slot });
                setPicker({ side: "bottom", slot });
                setPickerQuery("");
              }}
              onClear={(slot) => clearSlot("bottom", slot)}
            />
          )}

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              Optional: build the other lineup too
            </summary>
            <div className="mt-3">
              {mode === "top" ? (
                <Lineup
                  title="Bottom 5 (for laughs)"
                  accent="from-red-500/35"
                  slots={state.bottom}
                  statsByPlayer={statsByPlayer}
                  onPick={(slot) => {
                    setSlotFocus({ side: "bottom", slot });
                    setPicker({ side: "bottom", slot });
                    setPickerQuery("");
                  }}
                  onClear={(slot) => clearSlot("bottom", slot)}
                />
              ) : (
                <Lineup
                  title="Top 5 (for comparison)"
                  accent="from-emerald-400/35"
                  slots={state.top}
                  statsByPlayer={statsByPlayer}
                  onPick={(slot) => {
                    setSlotFocus({ side: "top", slot });
                    setPicker({ side: "top", slot });
                    setPickerQuery("");
                  }}
                  onClear={(slot) => clearSlot("top", slot)}
                />
              )}
            </div>
          </details>
        </div>

        {/* Player list */}
        <div ref={playerListRef} className="rounded-2xl border border-white/10 bg-white/5 p-5 order-2 lg:order-none">
          <div className="sticky top-[76px] z-10 -mx-5 -mt-5 mb-4 border-b border-white/10 bg-[rgba(10,10,14,0.88)] px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setRosterLimit(80);
                  }}
                  placeholder="Search players (fuzzy)"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                />
                <select
                  value={era}
                  onChange={(e) => {
                    setEra(e.target.value);
                    setRosterLimit(80);
                  }}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
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

                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as typeof sortBy);
                    setRosterLimit(80);
                  }}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                >
                  <option value="ppg">PPG</option>
                  <option value="mpg">MPG</option>
                  <option value="games">Games</option>
                  <option value="alpha">A→Z</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {focus ? (
                  <div className="mr-1 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-zinc-100">
                    <span className="text-zinc-400">Filling</span>
                    <span className="font-black">{(focus.side === "top" ? "Top 5" : "Bottom 5") + " " + focus.slot.toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={() => setSlotFocus(null)}
                      className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-white/10"
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                {(["All", "G", "F", "C"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPosFilter(p);
                      setRosterLimit(80);
                      setFocus(null);
                    }}
                    className={
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors border " +
                      (posFilter === p
                        ? "border-white/15 bg-white text-black"
                        : "border-white/10 bg-black/25 text-zinc-200 hover:bg-white/10")
                    }
                  >
                    {p === "All" ? "All" : p === "G" ? "Guards" : p === "F" ? "Forwards" : "Centers"}
                  </button>
                ))}
                <div className="ml-auto text-[11px] text-zinc-500">{roster.length} players</div>
              </div>

              {/* Alphabet jump */}
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
                {letterIndex.letters.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => jumpToLetter(l)}
                    className="shrink-0 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <button
                  onClick={copyShare}
                  className="rounded-xl bg-red-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-red-400 transition-colors"
                >
                  {copied ? "Copied" : "Copy share link"}
                </button>
                <button
                  onClick={clearAll}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {focus ? (
            <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-zinc-400">Slot-focused mode</div>
              <div className="mt-1 text-sm font-black text-zinc-100">
                Tap a player to fill {(focus.side === "top" ? "Top 5" : "Bottom 5") + " " + focus.slot.toUpperCase()}.
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Filters auto-adjusted to {slotBucket(focus.slot) === "G" ? "Guards" : slotBucket(focus.slot) === "C" ? "Centers" : "Forwards"}.
              </div>
            </div>
          ) : null}

          {/* Quick add */}
          <div className="mb-3 flex flex-wrap gap-2">
            <QuickAdd
              label="Best available G"
              onPick={() => quickAdd("G")}
            />
            <QuickAdd
              label="Best available F"
              onPick={() => quickAdd("F")}
            />
            <QuickAdd
              label="Best available C"
              onPick={() => quickAdd("C")}
            />
            <QuickAdd
              label="Best available (any)"
              onPick={() => quickAdd("All")}
            />
          </div>

          <div className="mt-4 space-y-5">
            {letterIndex.letters.map((letter) => (
              <div key={letter} id={`roster-${letter}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-black tracking-widest text-zinc-500">{letter}</div>
                  <div className="text-[11px] text-zinc-600">tap a name to auto-place</div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(letterIndex.map.get(letter) ?? []).map((name) => {
                    const disabled = taken.has(name);
                    const best = statsByPlayer.get(name);

                    return (
                      <button
                        key={name}
                        disabled={disabled}
                        className={
                          "text-left rounded-2xl border px-3 py-3 text-sm transition-colors " +
                          (disabled
                            ? "border-white/5 bg-white/5 text-zinc-500 cursor-not-allowed"
                            : "border-white/10 bg-black/20 text-zinc-100 hover:bg-white/10")
                        }
                        onClick={() => {
                          // Slot-focused mode: always fill the focused slot.
                          if (focus) {
                            pickPlayer(focus.side, focus.slot, name);
                            return;
                          }

                          // Default: auto-place by position into the active board.
                          const best = statsByPlayer.get(name);
                          const bucket = posBucket(best?.pos);
                          const preferred = eligibleSlotsForBucket(bucket);

                          const board = active;

                          // 1) First empty preferred slot
                          for (const slot of preferred) {
                            if (!state[board][slot]) {
                              pickPlayer(board, slot, name);
                              return;
                            }
                          }

                          // 2) Fallback to any empty slot
                          const anySlot = (Object.entries(state[board]).find(([, v]) => !v)?.[0] as SlotId | undefined);
                          if (anySlot) pickPlayer(board, anySlot, name);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{name}</div>
                            {best ? (
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-snug text-zinc-400">
                                <span className="text-zinc-500">{best.pos ?? "—"}</span>
                                <span>
                                  <span className="text-zinc-500">PPG</span> {best.pts ?? "—"}
                                </span>
                                <span className="text-zinc-500">
                                  {best.year}–{String(best.year + 1).slice(-2)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            aria-label={favorites.has(name) ? "Unfavorite" : "Favorite"}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(name);
                            }}
                            className={
                              "shrink-0 rounded-xl border px-2 py-1 text-[11px] transition-colors " +
                              (favorites.has(name)
                                ? "border-yellow-300/30 bg-yellow-300/15 text-yellow-100"
                                : "border-white/10 bg-black/25 text-zinc-300 hover:bg-white/10")
                            }
                          >
                            {favorites.has(name) ? "★" : "☆"}
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <div>
              Tip: tapping a player auto-places them by position (G → PG/SG, F → SF/PF, C → C/PF). You can also tap a slot to pick from a searchable list.
            </div>
            {roster.length > rosterLimit ? (
              <button
                type="button"
                onClick={() => setRosterLimit((n) => Math.min(roster.length, n + 120))}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-zinc-200 hover:bg-white/10 transition-colors"
              >
                Show more
              </button>
            ) : null}
          </div>

          <div className="mt-3">
            <input
              ref={shareUrlRef}
              readOnly
              placeholder="Share link will appear here"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300"
            />
          </div>
        </div>
      </section>

      {/* Slot picker bottom-sheet */}
      {picker ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/60"
            onClick={() => setPicker(null)}
          />

          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-3xl border border-white/10 bg-[rgba(10,10,14,0.92)] p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-400">Pick for</div>
                <div className="text-base font-black tracking-tight text-zinc-100">
                  {(picker.side === "top" ? "Top 5" : "Bottom 5") + " — " + picker.slot.toUpperCase()}
                </div>
              </div>
              <button
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10 transition-colors"
                onClick={() => setPicker(null)}
              >
                Done
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Type a name (fuzzy search works)"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-white/20"
              />
              <button
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-zinc-200 hover:bg-white/10 transition-colors"
                onClick={() => setPickerQuery("")}
              >
                Clear
              </button>
            </div>

            <div className="mt-3 max-h-[55vh] overflow-auto pr-1 space-y-4">
              <PickerSection
                title="Recommended"
                items={pickerRecommended}
                onPick={(name) => {
                  pickPlayer(picker.side, picker.slot, name);
                  setPicker(null);
                }}
              />
              <PickerSection
                title="Favorites"
                items={pickerFavorites}
                onPick={(name) => {
                  pickPlayer(picker.side, picker.slot, name);
                  setPicker(null);
                }}
              />
              <PickerSection
                title="Recents"
                items={pickerRecents}
                onPick={(name) => {
                  pickPlayer(picker.side, picker.slot, name);
                  setPicker(null);
                }}
              />

              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">Search results</div>
                <div className="grid grid-cols-1 gap-2">
                  {pickerList.length ? (
                    pickerList.map((name) => {
                      const best = statsByPlayer.get(name);
                      const disabled = taken.has(name) && state[picker.side][picker.slot] !== name;
                      return (
                        <button
                          key={name}
                          disabled={disabled}
                          onClick={() => {
                            pickPlayer(picker.side, picker.slot, name);
                            setPicker(null);
                          }}
                          className={
                            "rounded-2xl border px-3 py-3 text-left transition-colors " +
                            (disabled
                              ? "border-white/5 bg-white/5 text-zinc-500"
                              : "border-white/10 bg-black/20 text-zinc-100 hover:bg-white/10")
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{name}</div>
                              {best ? (
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-snug text-zinc-400">
                                  <span className="text-zinc-500">{best.pos ?? "—"}</span>
                                  <span>
                                    <span className="text-zinc-500">PPG</span> {best.pts ?? "—"}
                                  </span>
                                  <span>
                                    <span className="text-zinc-500">RPG</span> {best.trb ?? "—"}
                                  </span>
                                  <span>
                                    <span className="text-zinc-500">APG</span> {best.ast ?? "—"}
                                  </span>
                                  <span className="text-zinc-500">
                                    {best.year}–{String(best.year + 1).slice(-2)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              aria-label={favorites.has(name) ? "Unfavorite" : "Favorite"}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite(name);
                              }}
                              className={
                                "shrink-0 rounded-xl border px-2 py-1 text-[11px] transition-colors " +
                                (favorites.has(name)
                                  ? "border-yellow-300/30 bg-yellow-300/15 text-yellow-100"
                                  : "border-white/10 bg-black/25 text-zinc-300 hover:bg-white/10")
                              }
                            >
                              {favorites.has(name) ? "★" : "☆"}
                            </button>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                      No matches. Try last name only.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-zinc-500">
              Tip: you can type just a last name (or even a sloppy fragment). We’ll still find it.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuickAdd({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
    >
      + {label}
    </button>
  );
}

function PickerSection({
  title,
  items,
  onPick,
}: {
  title: string;
  items: string[];
  onPick: (name: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Lineup({
  title,
  accent,
  slots,
  statsByPlayer,
  onPick,
  onClear,
}: {
  title: string;
  accent: string;
  slots: Record<SlotId, string | null>;
  statsByPlayer: Map<string, Row>;
  onPick: (slot: SlotId) => void;
  onClear: (slot: SlotId) => void;
}) {
  const rows: Row[] = SLOTS.map((s) => {
    const name = slots[s.id];
    if (!name) return null;
    return statsByPlayer.get(name) ?? null;
  }).filter(Boolean) as Row[];

  const avgPts = avg(rows.map((r) => r.pts));
  const avgTrb = avg(rows.map((r) => r.trb));
  const avgAst = avg(rows.map((r) => r.ast));
  const avgMpg = avg(rows.map((r) => r.minutes));

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 via-white/5 to-black/20 p-5">
      <div className={`pointer-events-none -mx-5 -mt-5 h-1 w-[calc(100%+40px)] bg-gradient-to-r ${accent} to-transparent`} />
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <span className="text-xs text-zinc-500">Click slot to set</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-500">Avg PPG</div>
          <div className="mt-1 font-black text-zinc-100">{avgPts.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-500">Avg RPG</div>
          <div className="mt-1 font-black text-zinc-100">{avgTrb.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-500">Avg APG</div>
          <div className="mt-1 font-black text-zinc-100">{avgAst.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-zinc-500">Avg MPG</div>
          <div className="mt-1 font-black text-zinc-100">{avgMpg.toFixed(1)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {SLOTS.map((s) => {
          const val = slots[s.id];
          const best = val ? statsByPlayer.get(val) : null;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="group flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-white/10 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs text-zinc-400">{s.label}</div>
                <div className="truncate text-sm font-semibold text-zinc-100">
                  {val ?? <span className="text-zinc-500">Pick a player</span>}
                </div>
                {best ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span>
                      <span className="text-zinc-500">Peak</span> {best.pts ?? "—"} PPG
                    </span>
                    <span>{best.trb ?? "—"} RPG</span>
                    <span>{best.ast ?? "—"} APG</span>
                    <span>{best.minutes ?? "—"} MPG</span>
                    <span className="text-zinc-500">({best.year}–{String(best.year + 1).slice(-2)})</span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-zinc-500">{s.hint}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(s.id);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                >
                  clear
                </button>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Stats shown are each player’s best UC season by PPG. It is not perfect, but it makes the arguments faster.
      </div>
    </section>
  );
}
