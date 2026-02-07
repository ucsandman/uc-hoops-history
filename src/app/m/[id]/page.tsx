import { notFound } from "next/navigation";
import RunItBackButton from "@/components/RunItBackButton";
import NewOpponentButton from "@/components/NewOpponentButton";
import SeriesButton from "@/components/SeriesButton";
import ShareMatchButton from "@/components/ShareMatchButton";
import WinProbChart from "@/components/WinProbChart";
import BackButton from "@/components/BackButton";
import { ensureSchema, db } from "@/lib/db";
import type { MatchRecap, BoxPlayerLine } from "@/lib/sim";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    await ensureSchema();
    const pool = db();
    const res = await pool.query(`SELECT recap FROM matches WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) return { title: "Match not found" };

    const recap = row.recap as MatchRecap;
    const hadOT = Boolean(recap.overtime);

    const title = `${recap.a.name} vs ${recap.b.name} — ${recap.a.score}-${recap.b.score}${hadOT ? " (OT)" : ""}`;
    const desc = `${recap.mode === "sicko" ? "Sicko" : "Top 5"} League matchup. ${recap.playerOfGame?.player ? `Player of the game: ${recap.playerOfGame.player}.` : ""}`;

    const img = `/api/og?a=${encodeURIComponent(recap.a.name)}&b=${encodeURIComponent(recap.b.name)}&as=${recap.a.score}&bs=${recap.b.score}&mode=${recap.mode}&ot=${hadOT ? 1 : 0}&pog=${encodeURIComponent(recap.playerOfGame?.player ?? "")}`;

    return {
      title,
      description: desc,
      openGraph: {
        title,
        description: desc,
        type: "article",
        images: [{ url: img, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: [img],
      },
    };
  } catch {
    return { title: "UC Hoops Match" };
  }
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const pool = db();

  const res = await pool.query(`SELECT recap FROM matches WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) return notFound();

  const recap = row.recap as MatchRecap;

  const isSicko = recap.mode === "sicko";
  // winnerIsA no longer used; Team A is always the initiating draft for "New matchup".
  const diff = Math.abs(recap.a.score - recap.b.score);
  const total = recap.a.score + recap.b.score;
  const hadOT = Boolean(recap.overtime);

  function hashSeed(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) % 100000;
  }

  function pick<T>(seed: string, options: T[]) {
    const idx = hashSeed(seed) % options.length;
    return options[idx];
  }

  function vibePack(team: "A" | "B") {
    const isWinner = recap.winnerId === (team === "A" ? recap.a.id : recap.b.id);
    const teamScore = team === "A" ? recap.a.score : recap.b.score;

    const close = diff <= 3;
    const blowout = diff >= 15;
    const rockFight = total <= 125;
    const trackMeet = total >= 160;

    const vibe = hadOT
      ? pick(`${id}-${team}-v-ot`, ["After hours", "Double espresso", "No sleep", "Extended cut"]) // 1 OT for now
      : close
        ? pick(`${id}-${team}-v-close`, ["Heart attack", "Clutch time", "Stress test", "Cardiac cats"]) 
        : blowout
          ? isWinner
            ? pick(`${id}-${team}-v-bw`, ["Wire to wire", "Statement", "Never in doubt", "Cruise control"]) 
            : pick(`${id}-${team}-v-bl`, ["Long night", "Got run", "Bus ride", "Film session"]) 
          : pick(`${id}-${team}-v-mid`, ["Business", "Chaos", "Feisty", "Chippy"]); 

    const energy = trackMeet
      ? pick(`${id}-${team}-e-track`, ["Track meet", "Run and gun", "Buckets", "No defense"])
      : rockFight
        ? pick(`${id}-${team}-e-rock`, ["Rock fight", "Mud", "Brick city", "Grinder"])
        : close
          ? pick(`${id}-${team}-e-close`, ["Tense", "Volatile", "Nervy", "On edge"])
          : pick(`${id}-${team}-e-mid`, ["Chaotic", "Loud", "Spiky", "Rowdy"]);

    const chat = isSicko
      ? pick(`${id}-${team}-c-sicko`, ["Cursed", "Pure sicko", "Weird hoops", "Foul art"]) 
      : isWinner
        ? pick(`${id}-${team}-c-win`, ["Receipts", "Talk your talk", "Ring it", "Run it back"]) 
        : pick(`${id}-${team}-c-loss`, ["Pain", "Cope", "" + (close ? "Robbed" : "We move"), "" + (teamScore < 55 ? "Shootaround" : "Unlucky")]);

    return { vibe, energy, chat };
  }

  function pct(x: number) {
    return `${Math.round(x * 100)}%`;
  }

  function tagLevel(x: number, ranges: [number, string][]) {
    for (const [th, label] of ranges) if (x >= th) return label;
    return ranges[ranges.length - 1]![1];
  }

  function identityChips(d: NonNullable<MatchRecap["debug"]>["a"]) {
    const pace = recap.debug?.pace ?? 66;

    const paceTag =
      pace >= 78 ? "Track meet" : pace <= 62 ? "Rock fight" : pace >= 72 ? "Fast" : "Normal";

    const threeTag = tagLevel(d.threeRate, [
      [0.44, "Bombs away"],
      [0.36, "3s heavy"],
      [0.28, "Balanced"],
      [0.0, "Paint first"],
    ]);

    const glassTag = tagLevel(d.orebRate, [
      [0.34, "Owns the glass"],
      [0.27, "Crashes"],
      [0.22, "Fine"],
      [0.0, "One and done"],
    ]);

    const securityTag = tagLevel(1 - d.toRate, [
      [0.84, "Ball security"],
      [0.78, "Steady"],
      [0.72, "Loose"],
      [0.0, "Turnover vibes"],
    ]);

    return [paceTag, threeTag, glassTag, securityTag];
  }

  function highlights() {
    const out: string[] = [];

    const diff = Math.abs(recap.a.score - recap.b.score);
    const total = recap.a.score + recap.b.score;

    if (recap.debug) {
      const p = recap.debug.pace;
      if (p >= 78) out.push(`Track meet pace (${p} poss/team). Nobody guarded anybody.`);
      else if (p <= 62) out.push(`Rock-fight pace (${p} poss/team). Every bucket felt earned.`);

      const a3 = recap.debug.a.threeRate;
      const b3 = recap.debug.b.threeRate;
      if (a3 >= 0.42) out.push(`${recap.a.name} launched threes all night (${Math.round(a3 * 100)}% of shots).`);
      if (b3 >= 0.42) out.push(`${recap.b.name} lived and died by the three (${Math.round(b3 * 100)}% of shots).`);

      const aTo = recap.debug.a.toRate;
      const bTo = recap.debug.b.toRate;
      if (aTo >= 0.23) out.push(`${recap.a.name} got sloppy (TO rate ${Math.round(aTo * 100)}%).`);
      if (bTo >= 0.23) out.push(`${recap.b.name} turned it over a ton (TO rate ${Math.round(bTo * 100)}%).`);

      const aO = recap.debug.a.orebRate;
      const bO = recap.debug.b.orebRate;
      if (aO >= 0.32) out.push(`${recap.a.name} owned the glass (OReb ${Math.round(aO * 100)}%).`);
      if (bO >= 0.32) out.push(`${recap.b.name} dominated second chances (OReb ${Math.round(bO * 100)}%).`);
    }

    if (recap.overtime) out.push("Overtime chaos decided it.");
    if (diff <= 3) out.push("Absolute nailbiter.");
    if (diff >= 18) out.push("Statement game. Never really close.");
    if (total <= 120) out.push("Certified brick fest.");
    if (total >= 170) out.push("Buckets for 40 minutes straight.");

    if (recap.playerOfGame?.player) out.push(`${recap.playerOfGame.player} was the headline act.`);

    return out.slice(0, 5);
  }

  function keysToWin(a: NonNullable<MatchRecap["debug"]>["a"], b: NonNullable<MatchRecap["debug"]>["a"]) {
    const keysA: string[] = [];
    const keysB: string[] = [];

    if (a.toRate > 0.22) keysA.push(`Protect the ball (TO rate ${pct(a.toRate)}).`);
    if (b.toRate > 0.22) keysB.push(`Protect the ball (TO rate ${pct(b.toRate)}).`);

    if (a.orebRate < 0.22 && b.orebRate > 0.28) keysA.push("Finish possessions. Can't give up second chances.");
    if (b.orebRate < 0.22 && a.orebRate > 0.28) keysB.push("Finish possessions. Can't give up second chances.");

    if (a.threeRate > 0.40 && a.p3 < 0.31) keysA.push("Live with the variance. If the 3s aren't falling, get downhill.");
    if (b.threeRate > 0.40 && b.p3 < 0.31) keysB.push("Live with the variance. If the 3s aren't falling, get downhill.");

    if (a.p2 < 0.43) keysA.push("Get easier 2s. Stop settling.");
    if (b.p2 < 0.43) keysB.push("Get easier 2s. Stop settling.");

    if (keysA.length < 2) keysA.push("Win the possession game. Make them score in the halfcourt.");
    if (keysB.length < 2) keysB.push("Win the possession game. Make them score in the halfcourt.");

    return { keysA: keysA.slice(0, 3), keysB: keysB.slice(0, 3) };
  }

  return (
    <div className="space-y-6">
      {/* Matchup */}
      <section className="sb-card relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/70 via-red-500/15 to-transparent" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BackButton fallbackHref="/" label="Back" className="mr-1" />
              <span className="sb-chip rounded-full px-2 py-0.5 text-[11px] text-zinc-200">
                {isSicko ? "Sicko League" : "Top 5 League"}
              </span>
              {isSicko ? (
                <span className="sb-chip rounded-full px-2 py-0.5 text-[11px] text-zinc-200">Lower score wins</span>
              ) : null}
              <span className="text-[11px] text-zinc-500">Match ID: {id.slice(0, 8)}</span>
            </div>

            <div className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
              <style>{"div::-webkit-scrollbar{display:none}"}</style>
              <NewOpponentButton draftId={recap.a.id} mode={recap.mode} />
              <RunItBackButton draftA={recap.a.id} draftB={recap.b.id} mode={recap.mode} />
              <SeriesButton draftA={recap.a.id} draftB={recap.b.id} mode={recap.mode} />
              <ShareMatchButton />
              <a
                href={`/d/${recap.a.id}`}
                className="sb-chip rounded-xl px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
              >
                View Team A
              </a>
              <a
                href={`/d/${recap.b.id}`}
                className="sb-chip rounded-xl px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
              >
                View Team B
              </a>
            </div>
          </div>

          {/* Real scoreboard */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-zinc-100">{recap.a.name}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Team A</div>
              </div>

              <div className="text-center">
                <div className="flex items-end justify-center gap-3">
                  <div className="text-4xl font-black tracking-tight text-zinc-100">{recap.a.score}</div>
                  <div className="pb-1 text-xs font-black text-zinc-500">FINAL</div>
                  <div className="text-4xl font-black tracking-tight text-zinc-100">{recap.b.score}</div>
                </div>
                {recap.overtime ? (
                  <div className="mt-1 text-[11px] text-zinc-400">OT</div>
                ) : null}
              </div>

              <div className="min-w-0 text-right">
                <div className="truncate text-sm font-black text-zinc-100">{recap.b.name}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Team B</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <TeamScore
                idSeed={`${id}-A`}
                name={recap.a.name}
                score={recap.a.score}
                oppScore={recap.b.score}
                half1={recap.a.half1}
                half2={recap.a.half2}
                winner={recap.winnerId === recap.a.id}
                isSicko={isSicko}
                hadOT={hadOT}
                side="A"
                vibe={vibePack("A")}
              />

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-500">Halves</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] text-zinc-500">A</div>
                    <div className="mt-1 font-black text-zinc-100">
                      {recap.a.half1} <span className="text-zinc-500">/</span> {recap.a.half2}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] text-zinc-500">B</div>
                    <div className="mt-1 font-black text-zinc-100">
                      {recap.b.half1} <span className="text-zinc-500">/</span> {recap.b.half2}
                    </div>
                  </div>
                </div>
                {recap.overtime ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2 text-[11px] text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-zinc-100">OT</span>
                      <span className="text-zinc-400">
                        +{recap.overtime.a.reduce((x, y) => x + y, 0)} / +{recap.overtime.b.reduce((x, y) => x + y, 0)}
                      </span>
                    </div>
                    <div className="mt-1 text-zinc-500">{recap.overtime.headline}</div>
                  </div>
                ) : null}
              </div>

              <TeamScore
                idSeed={`${id}-B`}
                name={recap.b.name}
                score={recap.b.score}
                oppScore={recap.a.score}
                half1={recap.b.half1}
                half2={recap.b.half2}
                winner={recap.winnerId === recap.b.id}
                isSicko={isSicko}
                hadOT={hadOT}
                side="B"
                vibe={vibePack("B")}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <LineupGlance title={`Team A — ${recap.a.name}`} rows={recap.a.box} />
            <LineupGlance title={`Team B — ${recap.b.name}`} rows={recap.b.box} />
          </div>

          {recap.debug ? (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Team A identity</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {identityChips(recap.debug.a).map((t) => (
                    <span key={t} className="sb-chip rounded-full px-2 py-0.5 text-[11px] text-zinc-200">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <MiniStat label="TO" value={pct(recap.debug.a.toRate)} />
                  <MiniStat label="OReb" value={pct(recap.debug.a.orebRate)} />
                  <MiniStat label="3PA" value={pct(recap.debug.a.threeRate)} />
                  <MiniStat label="Shoot" value={`${pct(recap.debug.a.p2)} 2s • ${pct(recap.debug.a.p3)} 3s`} />
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Team B identity</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {identityChips(recap.debug.b).map((t) => (
                    <span key={t} className="sb-chip rounded-full px-2 py-0.5 text-[11px] text-zinc-200">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <MiniStat label="TO" value={pct(recap.debug.b.toRate)} />
                  <MiniStat label="OReb" value={pct(recap.debug.b.orebRate)} />
                  <MiniStat label="3PA" value={pct(recap.debug.b.threeRate)} />
                  <MiniStat label="Shoot" value={`${pct(recap.debug.b.p2)} 2s • ${pct(recap.debug.b.p3)} 3s`} />
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/25 p-4 lg:col-span-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Keys to win</div>
                  <div className="text-[11px] text-zinc-500">Pace: {recap.debug.pace} poss/team</div>
                </div>
                {(() => {
                  const { keysA, keysB } = keysToWin(recap.debug.a, recap.debug.b);
                  return (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs font-black text-zinc-100">{recap.a.name}</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                          {keysA.map((k) => (
                            <li key={k}>{k}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs font-black text-zinc-100">{recap.b.name}</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                          {keysB.map((k) => (
                            <li key={k}>{k}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {/* Highlights */}
      <section className="sb-card rounded-2xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight">Highlights</h2>
          <div className="text-xs text-zinc-500">Auto recap</div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-200">
          {highlights().map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      {recap.winProbTimeline?.length ? (
        <WinProbChart aName={recap.a.name} bName={recap.b.name} data={recap.winProbTimeline} />
      ) : null}

      {/* POG + Story */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="sb-card relative overflow-hidden rounded-2xl p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/60 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black tracking-tight">Player of the game</h2>
              <div className="text-xs text-zinc-500">
                {recap.playerOfGame.team === "A" ? recap.a.name : recap.b.name}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="text-2xl font-black tracking-tight text-zinc-100">{recap.playerOfGame.player}</div>
                <div className="mt-1 text-sm text-zinc-300">
                  <span className="font-black text-zinc-100">{recap.playerOfGame.line.pts}</span> PTS
                  <span className="text-zinc-500"> • </span>
                  <span className="font-black text-zinc-100">{recap.playerOfGame.line.reb}</span> REB
                  <span className="text-zinc-500"> • </span>
                  <span className="font-black text-zinc-100">{recap.playerOfGame.line.ast}</span> AST
                </div>
                <div className="mt-2 text-xs text-zinc-400">{recap.playerOfGame.blurb}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">Extras</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="text-zinc-500">STL</div>
                    <div className="mt-0.5 font-black text-zinc-100">{recap.playerOfGame.line.stl}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="text-zinc-500">BLK</div>
                    <div className="mt-0.5 font-black text-zinc-100">{recap.playerOfGame.line.blk}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="text-zinc-500">TOV</div>
                    <div className="mt-0.5 font-black text-zinc-100">{recap.playerOfGame.line.tov}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sb-card rounded-2xl p-5">
          <h2 className="text-lg font-black tracking-tight">Last possessions</h2>
          <div className="mt-3 space-y-2">
            {recap.lastPossessions.map((x, i) => {
              const desc = x.desc?.startsWith(x.player)
                ? x.desc.slice(x.player.length).replace(/^\s*[—-]?\s*/, "")
                : x.desc ?? x.text;

              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                >
                  <div className="w-12 shrink-0 pt-0.5 text-[11px] text-zinc-500">{x.t}</div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">
                      <span className="font-black text-zinc-100">{x.player}</span>
                      <span className="text-zinc-500"> — </span>
                      <span className="text-zinc-200">{desc}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {x.side} • {x.a}-{x.b}
                      {x.buzzer ? " • BUZZER" : ""}
                      {x.leadChange ? " • lead change" : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Score breakdown */}
      <details className="sb-card rounded-2xl p-5">
        <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-200">
          Score breakdown
          <span className="ml-2 text-xs text-zinc-500">(the math + why)</span>
        </summary>

        {recap.debug ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <BreakdownCard side="A" name={recap.a.name} d={recap.debug.a} />
              <BreakdownCard side="B" name={recap.b.name} d={recap.debug.b} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-200">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">How it works</div>
                <div className="text-[11px] text-zinc-500">Pace: {recap.debug.pace} poss/team</div>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
                {recap.debug.notes.map((x, i) => (
                  <li key={i} className="text-zinc-200">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-zinc-400">
            This match was created before we started storing breakdown details. Run a new matchup and this section will populate.
          </div>
        )}
      </details>

      {/* Box score */}
      <details className="sb-card rounded-2xl p-5">
        <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-200">
          Box score
          <span className="ml-2 text-xs text-zinc-500">Tap to expand</span>
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Box title={recap.a.name} rows={recap.a.box} />
          <Box title={recap.b.name} rows={recap.b.box} />
        </div>
      </details>

      <div className="text-xs text-zinc-500">
        Made up simulation for arguing with friends. Stats are generated from the drafted UC player seasons.
      </div>
    </div>
  );
}

function LineupGlance({ title, rows }: { title: string; rows: BoxPlayerLine[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-black tracking-tight">{title}</div>
        <div className="text-[11px] text-zinc-500">PG SG SF PF C</div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
          >
            <div className="w-10 shrink-0 text-[11px] font-black text-zinc-500">{r.slot}</div>
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{r.player}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2">
      <div className="text-zinc-500">{label}</div>
      <div className="mt-0.5 font-black text-zinc-100">{value}</div>
    </div>
  );
}

function BreakdownCard({
  side,
  name,
  d,
}: {
  side: "A" | "B";
  name: string;
  d: NonNullable<MatchRecap["debug"]>["a"];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-zinc-500">Team {side}</div>
          <div className="truncate text-sm font-black tracking-tight text-zinc-100">{name}</div>
        </div>
        <div className="text-right text-[11px] text-zinc-500">reg: {d.regulationScore}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Base (old model)</div>
          <div className="mt-0.5 font-black text-zinc-100">{d.base.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Consistency</div>
          <div className="mt-0.5 font-black text-zinc-100">{d.cons.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Offense proxy</div>
          <div className="mt-0.5 font-black text-zinc-100">{d.off.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Defense proxy</div>
          <div className="mt-0.5 font-black text-zinc-100">{d.def.toFixed(1)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Turnovers</div>
          <div className="mt-0.5 font-black text-zinc-100">{Math.round(d.toRate * 100)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">OReb (2nd chance)</div>
          <div className="mt-0.5 font-black text-zinc-100">{Math.round(d.orebRate * 100)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">3PA share</div>
          <div className="mt-0.5 font-black text-zinc-100">{Math.round(d.threeRate * 100)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-zinc-500">Shooting</div>
          <div className="mt-0.5 font-black text-zinc-100">
            {Math.round(d.p2 * 100)}% 2s • {Math.round(d.p3 * 100)}% 3s
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ title, rows }: { title: string; rows: BoxPlayerLine[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-black tracking-tight">{title}</div>
        <div className="text-[11px] text-zinc-500">MIN PTS REB AST STL BLK TOV PF</div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 pr-2">Slot</th>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2">MIN</th>
              <th className="py-2 pr-2">PTS</th>
              <th className="py-2 pr-2">REB</th>
              <th className="py-2 pr-2">AST</th>
              <th className="py-2 pr-2">STL</th>
              <th className="py-2 pr-2">BLK</th>
              <th className="py-2 pr-2">TOV</th>
              <th className="py-2 pr-2">PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/10 text-zinc-200">
                <td className="py-2 pr-2 text-zinc-500">{r.slot}</td>
                <td className="py-2 pr-2 font-semibold">{r.player}</td>
                <td className="py-2 pr-2">{r.min}</td>
                <td className="py-2 pr-2 font-black text-zinc-100">{r.pts}</td>
                <td className="py-2 pr-2">{r.reb}</td>
                <td className="py-2 pr-2">{r.ast}</td>
                <td className="py-2 pr-2">{r.stl}</td>
                <td className="py-2 pr-2">{r.blk}</td>
                <td className="py-2 pr-2">{r.tov}</td>
                <td className="py-2 pr-2">{r.pf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamScore({
  idSeed,
  name,
  score,
  oppScore,
  half1,
  half2,
  winner,
  side,
  isSicko,
  hadOT,
  vibe,
}: {
  idSeed: string;
  name: string;
  score: number;
  oppScore: number;
  half1: number;
  half2: number;
  winner: boolean;
  side: "A" | "B";
  isSicko: boolean;
  hadOT: boolean;
  vibe: { vibe: string; energy: string; chat: string };
}) {
  const diff = Math.abs(score - oppScore);
  const tag = hadOT ? "OT" : diff <= 3 ? "1-pos" : diff >= 15 ? "blowout" : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-zinc-500">Team {side}</div>
            {tag ? (
              <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                {tag}
              </span>
            ) : null}
            {isSicko ? (
              <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                sicko
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-base font-black tracking-tight text-zinc-100">{name}</div>
        </div>
        {winner ? (
          <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-black text-black">W</span>
        ) : (
          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
            L
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-zinc-500">FINAL</div>
          <div className="mt-1 font-black tracking-tight text-4xl text-zinc-100">{score}</div>
        </div>
        <div className="text-right text-[11px] text-zinc-400">
          <div>
            H1 <span className="font-semibold text-zinc-200">{half1}</span>
          </div>
          <div>
            H2 <span className="font-semibold text-zinc-200">{half2}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-px w-full bg-white/10" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-xl border border-white/10 bg-black/25 p-2">
          <div className="text-zinc-500">Vibe</div>
          <div className="mt-0.5 font-semibold text-zinc-200">{vibe.vibe}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-2">
          <div className="text-zinc-500">Energy</div>
          <div className="mt-0.5 font-semibold text-zinc-200">{vibe.energy}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-2">
          <div className="text-zinc-500">Chat</div>
          <div className="mt-0.5 font-semibold text-zinc-200">{vibe.chat}</div>
        </div>
      </div>

      <div className="sr-only">seed {idSeed}</div>
    </div>
  );
}
