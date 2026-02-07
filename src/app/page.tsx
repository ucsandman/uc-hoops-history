import { seasons, eraForCoach, coachForYear } from "@/lib/ucData";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

export default function Home() {
  const rows = [...seasons].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-8">
      <section className="sb-card relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/70 via-red-500/15 to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>UC Men’s Basketball</Badge>
            <Badge>Halftime Mode</Badge>
            <Badge>1901 → Now</Badge>
          </div>

          <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-4xl">
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

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">Timeline</h2>
          <a
            href="/players"
            className="text-sm text-zinc-300 hover:text-white underline underline-offset-4"
          >
            Go to Players →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((s) => {
            const coachName = coachForYear(s.year);
            const era = eraForCoach(coachName);
            return (
              <article
                key={s.year}
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/7 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-400">Season</div>
                    <div className="text-xl font-black tracking-tight">{s.year}–{String(s.year + 1).slice(-2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">Record</div>
                    <div className="text-lg font-bold">{s.record}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{coachName}</Badge>
                  <Badge>{era}</Badge>
                  {s.conf ? <Badge>{s.conf}</Badge> : null}
                  {s.postseason ? <Badge>{s.postseason}</Badge> : <Badge>No postseason</Badge>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-300">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-zinc-400">Conf</div>
                    <div className="mt-1 font-semibold">
                      {s.conf_wins != null && s.conf_losses != null
                        ? `${s.conf_wins}-${s.conf_losses}`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-zinc-400">SRS / SOS</div>
                    <div className="mt-1 font-semibold">
                      {s.srs != null ? s.srs.toFixed(2) : "—"} / {s.sos != null ? s.sos.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>

                {s.season_url ? (
                  <a
                    className="mt-3 inline-block text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                    href={s.season_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
