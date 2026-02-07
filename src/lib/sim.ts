export type DraftMode = "top" | "sicko";

export type PlayerSnap = {
  player: string;
  year: number;
  pos?: string | null;
  games?: number | null;
  minutes?: number | null; // MPG in our scrape
  pts?: number | null; // PPG
  trb?: number | null; // RPG
  ast?: number | null; // APG
  player_url?: string | null;
};

export type Lineup = {
  pg: PlayerSnap | null;
  sg: PlayerSnap | null;
  sf: PlayerSnap | null;
  pf: PlayerSnap | null;
  c: PlayerSnap | null;
};

export type DraftSnap = {
  id: string;
  mode: DraftMode;
  name: string;
  lineup: Lineup;
};

export type BoxPlayerLine = {
  slot: "PG" | "SG" | "SF" | "PF" | "C";
  player: string;
  pts: number;
  reb: number;
  ast: number;
  min: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
};

export type MatchRecap = {
  seed: number;
  mode: DraftMode;
  a: {
    id: string;
    name: string;
    score: number;
    half1: number;
    half2: number;
    box: BoxPlayerLine[];
  };
  b: {
    id: string;
    name: string;
    score: number;
    half1: number;
    half2: number;
    box: BoxPlayerLine[];
  };
  overtime?: {
    periods: number;
    a: number[];
    b: number[];
    headline: string;
  };
  debug?: {
    pace: number; // possessions per team
    a: {
      base: number;
      cons: number;
      off: number;
      def: number;
      toRate: number;
      orebRate: number;
      threeRate: number;
      p2: number;
      p3: number;
      regulationScore: number;
    };
    b: {
      base: number;
      cons: number;
      off: number;
      def: number;
      toRate: number;
      orebRate: number;
      threeRate: number;
      p2: number;
      p3: number;
      regulationScore: number;
    };
    notes: string[];
  };
  winnerId: string;
  playerOfGame: {
    team: "A" | "B";
    player: string;
    line: BoxPlayerLine;
    blurb: string;
  };
  lastPossessions: Array<{ t: string; text: string }>;
  playByPlay?: Array<{ t: string; text: string; a: number; b: number }>;
  winProbTimeline?: Array<{ t: string; a: number; b: number; wpA: number }>;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function nvl(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function consistency(p: PlayerSnap) {
  const g = clamp(nvl(p.games) / 30, 0, 1);
  const m = clamp(nvl(p.minutes) / 35, 0, 1);
  return 0.55 * g + 0.45 * m;
}

function baseImpact(p: PlayerSnap) {
  return nvl(p.pts) * 1.0 + nvl(p.trb) * 0.7 + nvl(p.ast) * 0.8;
}

function teamStrength(lineup: Lineup) {
  const ps = Object.values(lineup).filter(Boolean) as PlayerSnap[];
  if (!ps.length) return { base: 0, cons: 0 };

  const base = ps.reduce((a, p) => a + baseImpact(p), 0);
  const cons = ps.reduce((a, p) => a + consistency(p), 0) / ps.length;
  return { base, cons };
}

export type TeamTraits = {
  scoring: number; // sum PPG
  playmaking: number; // sum APG
  rebounding: number; // sum RPG
  consistency: number; // 0..1
  size: number; // proxy 0..1
  style: {
    pace: number; // -1..+1
    threes: number; // -1..+1
    physical: number; // 0..1
  };
};

export function teamTraits(lineup: Lineup): TeamTraits {
  const ps = Object.values(lineup).filter(Boolean) as PlayerSnap[];
  if (!ps.length) {
    return {
      scoring: 0,
      playmaking: 0,
      rebounding: 0,
      consistency: 0,
      size: 0,
      style: { pace: 0, threes: 0, physical: 0 },
    };
  }

  const scoring = ps.reduce((a, p) => a + nvl(p.pts), 0);
  const playmaking = ps.reduce((a, p) => a + nvl(p.ast), 0);
  const rebounding = ps.reduce((a, p) => a + nvl(p.trb), 0);
  const consistencyAvg = ps.reduce((a, p) => a + consistency(p), 0) / ps.length;

  // crude "size" proxy: big rebounding + having a true C/PF
  const hasBig = Boolean(lineup.c) || Boolean(lineup.pf);
  const size = clamp((rebounding / 40) * 0.65 + (hasBig ? 0.35 : 0), 0, 1);

  // Style inference from stats mix
  const pace = clamp((playmaking - 10) / 10 + (scoring - 65) / 30, -1, 1);
  const threes = clamp((playmaking - rebounding) / 20, -1, 1);
  const physical = clamp((rebounding - 18) / 20, 0, 1);

  return {
    scoring,
    playmaking,
    rebounding,
    consistency: clamp(consistencyAvg, 0, 1),
    size,
    style: { pace, threes, physical },
  };
}

function balanceBonus(t: TeamTraits) {
  // Reward "real" teams: at least some passing, some rebounding, some scoring.
  const s = clamp((t.scoring - 55) / 25, 0, 1);
  const p = clamp((t.playmaking - 8) / 10, 0, 1);
  const r = clamp((t.rebounding - 18) / 18, 0, 1);
  const minCore = Math.min(s, p, r);
  return minCore * 0.10; // up to +10% efficiency
}

function simRates(opts: { rand: () => number; a: TeamTraits; b: TeamTraits }) {
  const { rand } = opts;

  // Offense/defense proxies
  const offA = opts.a.scoring * 0.55 + opts.a.playmaking * 1.15 + opts.a.rebounding * 0.10;
  const offB = opts.b.scoring * 0.55 + opts.b.playmaking * 1.15 + opts.b.rebounding * 0.10;

  const defA = opts.a.rebounding * 0.70 + opts.a.size * 10 + opts.a.consistency * 6;
  const defB = opts.b.rebounding * 0.70 + opts.b.size * 10 + opts.b.consistency * 6;

  // Turnover rate: better playmaking + consistency -> fewer TOs
  const toA = clamp(0.22 - opts.a.playmaking * 0.006 - (opts.a.consistency - 0.6) * 0.10, 0.10, 0.30);
  const toB = clamp(0.22 - opts.b.playmaking * 0.006 - (opts.b.consistency - 0.6) * 0.10, 0.10, 0.30);

  // Offensive rebound rate: more rebounding + size, versus opponent's rebounding
  const orebA = clamp(0.24 + opts.a.rebounding * 0.003 - opts.b.rebounding * 0.0015, 0.14, 0.42);
  const orebB = clamp(0.24 + opts.b.rebounding * 0.003 - opts.a.rebounding * 0.0015, 0.14, 0.42);

  // Shot selection: threes rate (not literal 3PT%, just vibe)
  const threeRateA = clamp(0.30 + opts.a.style.threes * 0.10 + opts.a.playmaking * 0.004, 0.18, 0.50);
  const threeRateB = clamp(0.30 + opts.b.style.threes * 0.10 + opts.b.playmaking * 0.004, 0.18, 0.50);

  // Shooting: base probabilities + offense vs defense pull.
  const swingA = clamp((offA - defB) / 120, -0.08, 0.10);
  const swingB = clamp((offB - defA) / 120, -0.08, 0.10);

  // Allow "weird" nights more often for inconsistent teams.
  const weirdA = (1 - opts.a.consistency) * 0.06 + (rand() < 0.10 ? 0.06 : 0);
  const weirdB = (1 - opts.b.consistency) * 0.06 + (rand() < 0.10 ? 0.06 : 0);

  const base2 = 0.46;
  const base3 = 0.33;

  const p2A = clamp(base2 + swingA + balanceBonus(opts.a) - weirdA, 0.32, 0.62);
  const p3A = clamp(base3 + swingA + balanceBonus(opts.a) - weirdA, 0.22, 0.48);
  const p2B = clamp(base2 + swingB + balanceBonus(opts.b) - weirdB, 0.32, 0.62);
  const p3B = clamp(base3 + swingB + balanceBonus(opts.b) - weirdB, 0.22, 0.48);

  return {
    offA,
    offB,
    defA,
    defB,
    toA,
    toB,
    orebA,
    orebB,
    threeRateA,
    threeRateB,
    p2A,
    p3A,
    p2B,
    p3B,
  };
}

type PossLog = {
  t: string;
  side: "A" | "B";
  pts: number;
  a: number;
  b: number;
  ot?: boolean;
  text: string;
};

function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function fmtNCAARegClock(secLeftReg: number) {
  // Regulation is 40 minutes: 2 halves x 20.
  const reg = Math.max(0, Math.min(40 * 60, Math.floor(secLeftReg)));
  if (reg > 20 * 60) {
    const inHalf = reg - 20 * 60;
    return `1H ${fmtClock(inHalf)}`;
  }
  return `2H ${fmtClock(reg)}`;
}

function simulateTimeline(opts: {
  rand: () => number;
  mode: DraftMode;
  possessionsPerTeam: number;
  a: TeamTraits;
  b: TeamTraits;
  minutes: number;
  ot?: boolean;
}) {
  const { rand } = opts;
  const r = simRates({ rand, a: opts.a, b: opts.b });

  const totalPoss = opts.possessionsPerTeam * 2;
  let aPts = 0;
  let bPts = 0;

  let aTos = 0;
  let bTos = 0;
  let aOreb = 0;
  let bOreb = 0;
  let aMade2 = 0;
  let aMade3 = 0;
  let bMade2 = 0;
  let bMade3 = 0;

  const log: PossLog[] = [];

  function runPoss(side: "A" | "B") {
    const to = side === "A" ? r.toA : r.toB;
    const oreb = side === "A" ? r.orebA : r.orebB;
    const threeRate = side === "A" ? r.threeRateA : r.threeRateB;
    const p2 = side === "A" ? r.p2A : r.p2B;
    const p3 = side === "A" ? r.p3A : r.p3B;

    if (rand() < to) {
      if (side === "A") aTos++;
      else bTos++;
      return { pts: 0, text: "turnover" };
    }

    const take3 = rand() < threeRate;
    if (take3) {
      if (rand() < p3) {
        if (side === "A") aMade3++;
        else bMade3++;
        return { pts: 3, text: "made 3" };
      }
      if (rand() < oreb) {
        if (side === "A") aOreb++;
        else bOreb++;
        if (rand() < p3 * 0.92) {
          if (side === "A") aMade3++;
          else bMade3++;
          return { pts: 3, text: "OREB → made 3" };
        }
        return { pts: 0, text: "OREB → miss 3" };
      }
      return { pts: 0, text: "miss 3" };
    }

    if (rand() < p2) {
      if (side === "A") aMade2++;
      else bMade2++;
      return { pts: 2, text: "made 2" };
    }
    if (rand() < oreb) {
      if (side === "A") aOreb++;
      else bOreb++;
      if (rand() < p2 * 0.92) {
        if (side === "A") aMade2++;
        else bMade2++;
        return { pts: 2, text: "OREB → made 2" };
      }
      return { pts: 0, text: "OREB → miss 2" };
    }
    return { pts: 0, text: "miss 2" };
  }

  for (let i = 0; i < totalPoss; i++) {
    const side: "A" | "B" = i % 2 === 0 ? "A" : "B";
    const rpos = runPoss(side);
    const pts = rpos.pts;

    // score BEFORE this possession (for buzzer / lead-change text)
    const preA = aPts;
    const preB = bPts;

    if (side === "A") aPts += pts;
    else bPts += pts;

    const secLeft = ((totalPoss - (i + 1)) / totalPoss) * (opts.minutes * 60);

    const t = opts.ot
      ? `OT ${fmtClock(secLeft)}`
      : opts.minutes === 40
        ? fmtNCAARegClock(secLeft)
        : fmtClock(secLeft);

    const isFinalTick = secLeft <= 0.5;
    const leadBefore = preA === preB ? "T" : preA > preB ? "A" : "B";
    const leadAfter = aPts === bPts ? "T" : aPts > bPts ? "A" : "B";
    const flipped = leadBefore !== leadAfter && leadAfter !== "T";

    const sideLabel = side === "A" ? "A" : "B";
    let text = `${sideLabel}: ${rpos.text}`;

    if (isFinalTick && pts > 0 && (flipped || leadAfter === side)) {
      text = `${sideLabel}: ${rpos.text} (BUZZER)`;
    } else if (flipped && pts > 0) {
      text = `${sideLabel}: ${rpos.text} (lead change)`;
    }

    log.push({ t, side, pts, a: aPts, b: bPts, ot: opts.ot, text });
  }

  // Small endgame free-throw noise in close games.
  const close = Math.abs(aPts - bPts) <= 4;
  if (close) {
    const ftSwingA = Math.round(clamp(gaussianish(rand) * 2, -3, 3));
    const ftSwingB = Math.round(clamp(gaussianish(rand) * 2, -3, 3));
    aPts = Math.max(0, aPts + ftSwingA);
    bPts = Math.max(0, bPts + ftSwingB);

      // Put the swings into the last log entry to keep the timeline consistent.
    const last = log[log.length - 1];
    if (last) {
      last.a = aPts;
      last.b = bPts;
      last.text = `${last.side}: endgame FTs`; // make the adjustment explicit
    }
  }

  // Sicko League: tilt toward uglier outcomes (more turnovers, slightly lower scoring)
  if (opts.mode === "sicko") {
    aPts = Math.max(35, Math.round(aPts * (0.94 + rand() * 0.03)));
    bPts = Math.max(35, Math.round(bPts * (0.94 + rand() * 0.03)));
    const last = log[log.length - 1];
    if (last) {
      last.a = aPts;
      last.b = bPts;
      last.text = `${last.side}: sicko scoring environment`; // make the adjustment explicit
    }
  }

  return {
    a: { pts: aPts, tos: aTos, oreb: aOreb, made2: aMade2, made3: aMade3 },
    b: { pts: bPts, tos: bTos, oreb: bOreb, made2: bMade2, made3: bMade3 },
    log,
    ...r,
  };
}

function erfApprox(x: number) {
  // Abramowitz & Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

function phi(z: number) {
  // standard normal CDF
  return 0.5 * (1 + erfApprox(z / Math.SQRT2));
}

function epp(toRate: number, threeRate: number, p2: number, p3: number, oreb: number) {
  const shotEv = (1 - threeRate) * (2 * p2) + threeRate * (3 * p3);
  // crude 2nd chance boost (oreb doesn't always lead to points)
  const secondChance = 1 + oreb * 0.22;
  return (1 - toRate) * shotEv * secondChance;
}

function winProbTimeline(opts: { log: PossLog[]; totalPoss: number; rates: { toA: number; toB: number; threeRateA: number; threeRateB: number; p2A: number; p2B: number; p3A: number; p3B: number; orebA: number; orebB: number } }) {
  const eppA = epp(opts.rates.toA, opts.rates.threeRateA, opts.rates.p2A, opts.rates.p3A, opts.rates.orebA);
  const eppB = epp(opts.rates.toB, opts.rates.threeRateB, opts.rates.p2B, opts.rates.p3B, opts.rates.orebB);

  // per-possession variance proxy. tuned to look/feel plausible.
  const sdPerPoss = 1.85;

  const out: Array<{ t: string; a: number; b: number; wpA: number }> = [];

  for (let i = 0; i < opts.log.length; i++) {
    const x = opts.log[i]!;
    const r = opts.totalPoss - (i + 1);

    // remaining possession counts depend on who gets the next possession
    const nextIsA = (i + 1) % 2 === 0;
    const remA = Math.floor((r + (nextIsA ? 1 : 0)) / 2);
    const remB = r - remA;

    const diffNow = x.a - x.b;
    const expRem = eppA * remA - eppB * remB;

    const sd = sdPerPoss * Math.sqrt(Math.max(1, remA + remB));
    const z = (diffNow + expRem) / sd;
    const wpA = clamp(phi(z), 0.01, 0.99);
    out.push({ t: x.t, a: x.a, b: x.b, wpA });
  }

  return out;
}

function simulatePossessions(opts: {
  rand: () => number;
  mode: DraftMode;
  possessions: number;
  a: TeamTraits;
  b: TeamTraits;
}) {
  // backwards-compatible wrapper for old callers
  return simulateTimeline({ rand: opts.rand, mode: opts.mode, possessionsPerTeam: opts.possessions, a: opts.a, b: opts.b, minutes: 40 });
}

function splitHalves(total: number, rand: () => number): [number, number] {
  const h1 = Math.round(total * clamp(0.47 + (rand() * 2 - 1) * 0.06, 0.4, 0.6));
  return [h1, total - h1];
}

function gaussianish(rand: () => number) {
  // Sum of uniforms approximates a bell curve.
  return (rand() + rand() + rand() + rand() - 2) / 2; // ~[-1,1]
}

function allocateStatTotal(weights: number[], total: number, rand: () => number) {
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / wsum) * total);
  const out = raw.map((v) => Math.max(0, Math.round(v + gaussianish(rand) * 1.2)));

  let diff = total - out.reduce((a, b) => a + b, 0);
  let i = 0;
  while (diff !== 0 && i < 200) {
    const idx = Math.floor(rand() * out.length);
    if (diff > 0) {
      out[idx] += 1;
      diff -= 1;
    } else if (out[idx] > 0) {
      out[idx] -= 1;
      diff += 1;
    }
    i++;
  }
  return out;
}

function slotLabel(slot: keyof Lineup): BoxPlayerLine["slot"] {
  return slot.toUpperCase() as BoxPlayerLine["slot"];
}

function buildBox(lineup: Lineup, teamPts: number, rand: () => number): BoxPlayerLine[] {
  const slots = Object.entries(lineup) as Array<[keyof Lineup, PlayerSnap | null]>;
  const ps = slots.map(([slot, p]) => ({ slot, p })).filter((x) => x.p) as Array<{ slot: keyof Lineup; p: PlayerSnap }>;

  const ppgW = ps.map(({ p }) => Math.max(1, nvl(p.pts) * 1.2 + nvl(p.minutes) * 0.35));
  const rpgW = ps.map(({ p }) => Math.max(1, nvl(p.trb) * 1.1 + (p.pos?.includes("C") ? 2 : 0)));
  const apgW = ps.map(({ p }) => Math.max(1, nvl(p.ast) * 1.4 + (p.pos?.includes("G") ? 1 : 0)));

  const teamReb = Math.round(clamp(26 + teamPts * 0.18 + gaussianish(rand) * 3, 18, 48));
  const teamAst = Math.round(clamp(10 + teamPts * 0.12 + gaussianish(rand) * 2, 5, 28));

  const pts = allocateStatTotal(ppgW, teamPts, rand);
  const reb = allocateStatTotal(rpgW, teamReb, rand);
  const ast = allocateStatTotal(apgW, teamAst, rand);

  return ps.map(({ slot, p }, i) => {
    const min = Math.round(clamp(nvl(p.minutes) + gaussianish(rand) * 4, 10, 40));
    const cons = consistency(p);

    // Turnovers: ballhandlers + high minutes carry more risk, consistency lowers it.
    const isG = Boolean(p.pos?.includes("G"));
    const minFactor = clamp((min - 18) / 18, 0, 1);
    const tovBase = (isG ? 2.0 : 1.2) + minFactor * (isG ? 1.6 : 0.8);
    const tov = Math.round(clamp(tovBase - cons * 1.6 + gaussianish(rand) * 1.0, 0, 7));

    const stl = Math.round(clamp((isG ? 1.4 : 0.7) + gaussianish(rand) * 0.8, 0, 4));
    const blk = Math.round(clamp((p.pos?.includes("C") ? 1.6 : p.pos?.includes("F") ? 0.8 : 0.3) + gaussianish(rand) * 0.7, 0, 4));
    const pf = Math.round(clamp(2.2 + gaussianish(rand) * 1.1, 0, 5));

    return {
      slot: slotLabel(slot),
      player: p.player,
      pts: pts[i],
      reb: reb[i],
      ast: ast[i],
      min,
      tov,
      stl,
      blk,
      pf,
    };
  });
}

function playerOfGame(recap: Pick<MatchRecap, "a" | "b" | "winnerId">, rand: () => number): MatchRecap["playerOfGame"] {
  const team = recap.winnerId === recap.a.id ? "A" : "B";
  const box = team === "A" ? recap.a.box : recap.b.box;
  const scored = box
    .map((l) => ({
      l,
      g: l.pts + 1.2 * l.reb + 1.5 * l.ast + 0.8 * l.stl + 0.9 * l.blk - 1.2 * l.tov,
    }))
    .sort((x, y) => y.g - x.g);

  const pick = scored[Math.floor(rand() * Math.min(2, scored.length))]?.l ?? scored[0].l;

  const baseQuotes = [
    "Said it was just 'one of those nights' and then asked where the after party was.",
    "Told the camera 'we do this for the group chat' and walked off.",
    "Claimed the stat line was mid and promised to be better next game.",
    "Pointed at the other bench and mouthed 'that was personal'.",
    "Refused to elaborate. Simply nodded. Left.",
    "Said 'they can’t guard me' and then immediately requested an ice bath.",
    "Dedicated the win to 'whoever doubted' (nobody did).",
    "Said the rim looked like the ocean tonight.",
    "Apologized for nothing.",
  ];

  const scorerQuotes = [
    "Said the game plan was 'give me the ball and get out the way'.",
    "Told the other team 'y’all better double or pray'.",
    "Said the defense was 'a suggestion'.",
    "Called it a 'light workout' and smirked.",
    "Admitted they blacked out sometime around bucket #6.",
  ];

  const dimesQuotes = [
    "Said 'I saw everything two plays ahead'. Nobody asked.",
    "Told the reporter 'passing is an art and I’m Picasso'.",
    "Said the assists were easy because teammates 'finally listened'.",
    "Claimed the defense was 'staring at the ball like toddlers'.",
  ];

  const boardQuotes = [
    "Said 'that was my rim'.",
    "Told the other bigs 'rent is due'.",
    "Said rebounds are 'just wanting it more'.",
    "Admitted they were just chasing missed shots like it was a hobby.",
  ];

  const stocksQuotes = [
    "Said 'we don’t allow happiness in the paint'.",
    "Told the other team 'try that again and see what happens'.",
    "Said defense is 'vibes and violence'.",
    "Claimed they could hear the passing lane whispering.",
  ];

  const sickoQuotes = [
    "Said 'I did my part' and refused to look at the box score.",
    "Called it 'elite cardio' and sprinted to the locker room.",
    "Said the shooting was 'a social experiment'.",
    "Told the media 'points are overrated anyway'.",
  ];

  const lineScore = pick.pts + 1.2 * pick.reb + 1.5 * pick.ast;
  const isScorer = pick.pts >= 22;
  const isDimer = pick.ast >= 7;
  const isBoard = pick.reb >= 10;
  const isStocks = pick.stl + pick.blk >= 4;
  const isSickoLow = pick.pts <= 9 && lineScore < 18;

  const pools: string[][] = [baseQuotes];
  if (isScorer) pools.push(scorerQuotes);
  if (isDimer) pools.push(dimesQuotes);
  if (isBoard) pools.push(boardQuotes);
  if (isStocks) pools.push(stocksQuotes);
  if (isSickoLow) pools.push(sickoQuotes);

  const pool = pools[Math.floor(rand() * pools.length)];

  return {
    team,
    player: pick.player,
    line: pick,
    blurb: pool[Math.floor(rand() * pool.length)],
  };
}

function pickFrom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function starFromBox(box: BoxPlayerLine[], rand: () => number) {
  const ranked = [...box]
    .map((l) => ({
      l,
      g: l.pts + 1.0 * l.reb + 1.3 * l.ast + 1.2 * l.stl + 1.2 * l.blk - 1.1 * l.tov,
    }))
    .sort((a, b) => b.g - a.g);

  // Bias toward best 2.
  const idx = Math.floor(rand() * Math.min(2, ranked.length));
  return ranked[idx]?.l ?? ranked[0]?.l;
}

function lastPossessions(
  aName: string,
  bName: string,
  aScore: number,
  bScore: number,
  aBox: BoxPlayerLine[],
  bBox: BoxPlayerLine[],
  rand: () => number
): Array<{ t: string; text: string }> {
  const diff = Math.abs(aScore - bScore);
  const close = diff <= 3;

  const t = ["1:07", "0:48", "0:31", "0:18", "0:07", "0:02", "0:00"];

  const teamUp = aScore >= bScore ? aName : bName;
  const teamDown = aScore >= bScore ? bName : aName;

  const roleGuys = (box: BoxPlayerLine[]) => {
    const sorted = [...box].sort((x, y) => (y.ast + y.reb) - (x.ast + x.reb));
    return {
      handler: sorted.find((x) => x.slot === "PG" || x.slot === "SG") ?? sorted[0],
      big: sorted.find((x) => x.slot === "C" || x.slot === "PF") ?? sorted[0],
      wing: sorted.find((x) => x.slot === "SF") ?? sorted[0],
    };
  };

  const aRoles = roleGuys(aBox);
  const bRoles = roleGuys(bBox);

  const actions = {
    stop: [
      "gets a stop",
      "forces a miss",
      "draws a charge (it’s definitely a block)",
      "gets away with a little grab",
      "switches everything and survives",
    ],
    turnover: [
      "throws it into the third row",
      "dribbles it off their foot",
      "gets picked clean",
      "travels and acts confused",
      "steps on the sideline",
    ],
    bucket: [
      "hits a tough two",
      "splashes a corner three",
      "finishes through contact",
      "banks in a runner",
      "hits a 12-footer off the glass",
      "pulls up from the elbow",
    ],
    miss: [
      "bricks a wide open look",
      "rims out a jumper",
      "airballs and points at the lights",
      "short-arms it",
      "gets blocked at the rim",
    ],
    foul: [
      "gets a whistle and the other bench explodes",
      "draws contact like a pro",
      "gets bailed out (allegedly)",
      "earns two at the line",
    ],
    ft: [
      "knocks down both",
      "splits the pair",
      "goes 0-for-2 and stares into the void",
    ],
    rebound: [
      "grabs the offensive board",
      "tips it out",
      "skyhooks a rebound like it’s personal",
      "wrestles one away",
    ],
    heave: [
      "launches a heave",
      "gets a look at the buzzer",
      "pulls from way too deep",
      "fades to the corner for a prayer",
    ],
  };

  function playerName(team: "A" | "B", role: keyof typeof aRoles | "star") {
    const box = team === "A" ? aBox : bBox;
    const r = team === "A" ? aRoles : bRoles;
    if (role === "star") return (starFromBox(box, rand) ?? r.handler)?.player;
    return r[role]?.player ?? r.handler?.player;
  }

  const lines: Array<{ t: string; text: string }> = [];

  // Sequence scaffolding
  const whoDownTeam = teamDown === aName ? "A" : "B";
  const whoUpTeam = teamUp === aName ? "A" : "B";

  // Possession 1: down team pushes
  {
    const p = playerName(whoDownTeam, "handler");
    const flavor = rand() < 0.18 ? `${p} ${pickFrom(actions.turnover, rand)}. Disaster.` : `${p} ${pickFrom(actions.bucket, rand)}.`;
    lines.push({ t: t[1], text: `${teamDown} — ${flavor}` });
  }

  // Possession 2: up team responds
  {
    const p = playerName(whoUpTeam, rand() < 0.55 ? "star" : "handler");
    const outcomeRoll = rand();
    const txt =
      outcomeRoll < 0.18
        ? `${p} ${pickFrom(actions.turnover, rand)}. ${teamDown} smells blood.`
        : outcomeRoll < 0.62
          ? `${p} ${pickFrom(actions.bucket, rand)}.`
          : `${p} ${pickFrom(actions.miss, rand)}.`;
    lines.push({ t: t[2], text: `${teamUp} — ${txt}` });
  }

  // Possession 3: chaos (rebound/foul)
  {
    const downBig = playerName(whoDownTeam, "big");
    const upBig = playerName(whoUpTeam, "big");
    const chaos = rand();
    const txt =
      chaos < 0.34
        ? `${downBig} ${pickFrom(actions.rebound, rand)} and ${pickFrom(actions.bucket, rand)}.`
        : chaos < 0.68
          ? `${upBig} ${pickFrom(actions.foul, rand)}. ${playerName(whoDownTeam, "star")} ${pickFrom(actions.ft, rand)}.`
          : `${playerName(whoDownTeam, "wing")} ${pickFrom(actions.miss, rand)}. ${upBig} ${pickFrom(actions.rebound, rand)}.`;
    lines.push({ t: t[3], text: txt });
  }

  // Possession 4: final shot flavor
  if (close) {
    const shooter = playerName(whoDownTeam, "star");
    const heave = pickFrom(actions.heave, rand);
    const drops = rand() < 0.55;
    const makeTxt = pickFrom(
      [
        `${shooter} ${heave}. It drops. Absolute scenes.`,
        `${shooter} ${pickFrom(actions.bucket, rand)} at the horn. People are sprinting onto the imaginary court.`,
        `${shooter} hits a 12-footer off the glass as time expires. ${teamUp} is sick.`,
      ],
      rand
    );
    const missTxt = pickFrom(
      [
        `${shooter} ${heave}. Front rim. ${teamUp} survives and still complains anyway.`,
        `${shooter} gets a clean look… ${pickFrom(actions.miss, rand)}. Group chat immediately toxic.`,
        `${shooter} tries to draw contact. No call. Everyone loses their mind.`,
      ],
      rand
    );

    lines.push({ t: t[5], text: drops ? makeTxt : missTxt });
  } else {
    const closer = playerName(whoUpTeam, "handler");
    const txt = pickFrom(
      [
        `${teamUp} slows it down. ${closer} ${pickFrom(actions.foul, rand)}. ${pickFrom(actions.ft, rand)}.`,
        `${teamUp} dribbles out the clock like it’s personal.`,
        `Final. ${teamUp} survives. ${teamDown} demands a rematch.`,
      ],
      rand
    );
    lines.push({ t: t[6], text: txt });
  }

  return lines;
}

function addBox(a: BoxPlayerLine[], b: BoxPlayerLine[]) {
  // Same slot order (PG..C). Just add each stat line.
  return a.map((x, i) => {
    const y = b[i];
    return {
      ...x,
      pts: x.pts + (y?.pts ?? 0),
      reb: x.reb + (y?.reb ?? 0),
      ast: x.ast + (y?.ast ?? 0),
      tov: x.tov + (y?.tov ?? 0),
      stl: x.stl + (y?.stl ?? 0),
      blk: x.blk + (y?.blk ?? 0),
      pf: x.pf + (y?.pf ?? 0),
      min: clamp(x.min + 5, 10, 45),
    };
  });
}

/* overtimePeriod: legacy OT helper (replaced by possession-based OT)
function overtimePeriod(opts: {
  aName: string;
  bName: string;
  mode: DraftMode;
  aStrength: number;
  bStrength: number;
  rand: () => number;
}) {
  const { rand } = opts;
  const base = 6 + Math.floor(rand() * 7);
  const diff = opts.aStrength - opts.bStrength;
  const pA = clamp(0.5 + diff / 120, 0.25, 0.75);
  const aWins = rand() < pA;
  const swing = 1 + Math.floor(rand() * 4);
  let a = base;
  let b = base;

  if (opts.mode === "sicko") {
    if (aWins) {
      a = base;
      b = base + swing;
    } else {
      b = base;
      a = base + swing;
    }
  } else {
    if (aWins) {
      a = base + swing;
      b = base;
    } else {
      b = base + swing;
      a = base;
    }
  }

  const lines: Array<{ t: string; text: string }> = [{ t: "OT", text: "Legacy overtime." }];
  return { a, b, lines };
}
*/

export function simulateMatch(opts: {
  seed: number;
  mode: DraftMode;
  a: DraftSnap;
  b: DraftSnap;
}): MatchRecap {
  const rand = mulberry32(opts.seed);

  const sa = teamStrength(opts.a.lineup);
  const sb = teamStrength(opts.b.lineup);

  const ta = teamTraits(opts.a.lineup);
  const tb = teamTraits(opts.b.lineup);

  // Pace (possessions per team). Can get weird sometimes.
  const basePace = 66 + (ta.style.pace + tb.style.pace) * 4;
  const chaos = rand() < 0.12 ? 10 : 0; // occasional weird track meets
  const pace = Math.round(clamp(basePace + gaussianish(rand) * 6 + chaos, 56, 90));

  const sim = simulatePossessions({ rand, mode: opts.mode, possessions: pace, a: ta, b: tb });

  let aScore = sim.a.pts;
  let bScore = sim.b.pts;

  let wpTimeline = winProbTimeline({
    log: sim.log,
    totalPoss: pace * 2,
    rates: {
      toA: sim.toA,
      toB: sim.toB,
      threeRateA: sim.threeRateA,
      threeRateB: sim.threeRateB,
      p2A: sim.p2A,
      p2B: sim.p2B,
      p3A: sim.p3A,
      p3B: sim.p3B,
      orebA: sim.orebA,
      orebB: sim.orebB,
    },
  });

  const [aH1, aH2] = splitHalves(aScore, rand);
  const [bH1, bH2] = splitHalves(bScore, rand);

  let aBox = buildBox(opts.a.lineup, aScore, rand);
  let bBox = buildBox(opts.b.lineup, bScore, rand);

  let overtime: MatchRecap["overtime"] | undefined;
  let lp = lastPossessions(opts.a.name, opts.b.name, aScore, bScore, aBox, bBox, rand);

  const debug: NonNullable<MatchRecap["debug"]> = {
    pace,
    a: {
      base: sa.base,
      cons: sa.cons,
      off: sim.offA,
      def: sim.defA,
      toRate: sim.toA,
      orebRate: sim.orebA,
      threeRate: sim.threeRateA,
      p2: sim.p2A,
      p3: sim.p3A,
      regulationScore: sim.a.pts,
    },
    b: {
      base: sb.base,
      cons: sb.cons,
      off: sim.offB,
      def: sim.defB,
      toRate: sim.toB,
      orebRate: sim.orebB,
      threeRate: sim.threeRateB,
      p2: sim.p2B,
      p3: sim.p3B,
      regulationScore: sim.b.pts,
    },
    notes: [
      "We simulate possessions (not a single formula score).",
      "Pace = number of possessions per team (can spike for weird track meets).",
      "Each possession: turnover check → shot (2 or 3) → make/miss → possible offensive rebound for a second chance.",
      "Offense proxy comes from PPG/APG with a balance bonus. Defense proxy is mostly rebounding + size + consistency.",
      opts.mode === "sicko" ? "Sicko League: lower final score wins + slightly uglier scoring environment." : "Top 5 League: higher final score wins.",
    ],
  };

  // No ties. Ever. If it's tied after regulation, we play OT possessions until someone wins.
  if (aScore === bScore) {
    const otA: number[] = [];
    const otB: number[] = [];

    let periods = 0;
    while (aScore === bScore && periods < 4) {
      periods++;
      const otPoss = 8; // ~5 minutes worth (ish)
      const otSim = simulateTimeline({
        rand,
        mode: opts.mode,
        possessionsPerTeam: otPoss,
        a: ta,
        b: tb,
        minutes: 5,
        ot: true,
      });
      otA.push(otSim.a.pts);
      otB.push(otSim.b.pts);
      aScore += otSim.a.pts;
      bScore += otSim.b.pts;

      // Extend win prob timeline through OT.
      const otWp = winProbTimeline({
        log: otSim.log,
        totalPoss: otPoss * 2,
        rates: {
          toA: otSim.toA,
          toB: otSim.toB,
          threeRateA: otSim.threeRateA,
          threeRateB: otSim.threeRateB,
          p2A: otSim.p2A,
          p2B: otSim.p2B,
          p3A: otSim.p3A,
          p3B: otSim.p3B,
          orebA: otSim.orebA,
          orebB: otSim.orebB,
        },
      });
      // OT starts from current score, so offset the OT log scores.
      const baseA = aScore - otSim.a.pts;
      const baseB = bScore - otSim.b.pts;
      wpTimeline = wpTimeline.concat(otWp.map((x) => ({ ...x, a: baseA + x.a, b: baseB + x.b })));


      // Add OT stats onto the existing box score.
      const aOtBox = buildBox(opts.a.lineup, otSim.a.pts, rand);
      const bOtBox = buildBox(opts.b.lineup, otSim.b.pts, rand);
      aBox = addBox(aBox, aOtBox);
      bBox = addBox(bBox, bOtBox);
    }

    overtime = {
      periods,
      a: otA,
      b: otB,
      headline: periods > 1 ? "Overtime marathon. Everybody is cramping." : "Overtime. No ties in this house.",
    };

    debug.notes.push("OT: we simulate extra possessions (not a coin flip) until there's a winner.");

    // OT story beats
    const otLines = [
      { t: "OT", text: overtime.headline },
      { t: "2:11", text: "Somebody hits a shot that ruins friendships." },
      { t: "0:00", text: "Overtime ends. Everyone immediately requests a rematch." },
    ];
    lp = [...lp, ...otLines];
  }

  // Determine winner from FINAL score.
  const winnerId =
    opts.mode === "sicko"
      ? aScore < bScore
        ? opts.a.id
        : opts.b.id
      : aScore > bScore
        ? opts.a.id
        : opts.b.id;

  const recapBase = {
    seed: opts.seed,
    mode: opts.mode,
    a: {
      id: opts.a.id,
      name: opts.a.name,
      score: aScore,
      half1: aH1,
      half2: aH2,
      box: aBox,
    },
    b: {
      id: opts.b.id,
      name: opts.b.name,
      score: bScore,
      half1: bH1,
      half2: bH2,
      box: bBox,
    },
    overtime,
    debug,
    winnerId,
  } as const;

  const pog = playerOfGame(recapBase, rand);

  const playByPlay = sim.log.map((x) => ({ t: x.t, text: x.text, a: x.a, b: x.b }));

  // Last possessions = literal last 10 entries from the actual timeline.
  lp = playByPlay.slice(-10).map((x) => ({ t: x.t, text: `${x.text} (${x.a}-${x.b})` }));

  return {
    ...recapBase,
    playerOfGame: pog,
    lastPossessions: lp,
    playByPlay,
    winProbTimeline: wpTimeline,
  };
}

export function eloUpdate(opts: {
  ra: number;
  rb: number;
  winner: "A" | "B";
  k?: number;
}) {
  const k = opts.k ?? 24;
  const ea = 1 / (1 + Math.pow(10, (opts.rb - opts.ra) / 400));
  const eb = 1 - ea;

  const sa = opts.winner === "A" ? 1 : 0;
  const sb = 1 - sa;

  const na = Math.round(opts.ra + k * (sa - ea));
  const nb = Math.round(opts.rb + k * (sb - eb));
  return { na, nb };
}
