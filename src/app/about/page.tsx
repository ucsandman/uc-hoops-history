import Link from "next/link";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "About • UC Hoops History",
  description: "How this site works, quick picks, and what’s real vs simulated.",
};

type HallLineup = {
  title: string;
  desc: string;
  href: string;
  tags: string[];
};

const lineups: HallLineup[] = [
  {
    title: "Modern quickstart",
    desc: "Jump straight into drafting from the modern pool.",
    href: "/draft?era=modern&sort=ppg",
    tags: ["Draft"],
  },
  {
    title: "Huggins era pool",
    desc: "Filter the board to the Huggins years.",
    href: "/draft?era=coach-huggins&sort=ppg",
    tags: ["Coach"],
  },
  {
    title: "Big East era pool",
    desc: "Big East years only.",
    href: "/draft?era=conf-big-east&sort=ppg",
    tags: ["Conference"],
  },
  {
    title: "2010s pool",
    desc: "2010–2019.",
    href: "/draft?era=decade-2010s&sort=ppg",
    tags: ["Decade"],
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <header className="sb-card rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">About</div>
          <BackButton fallbackHref="/" label="Back" />
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">UC Hoops History</h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
          Unofficial fan project for sharing, debating, and halftime trash talk.
        </p>
      </header>

      <section className="sb-card rounded-2xl p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Data</div>
          <p className="mt-1 text-sm text-zinc-300">Seasons and player stats are pulled from Sports-Reference (College Basketball).</p>
        </div>

        <div>
          <div className="text-sm font-semibold text-zinc-100">Simulation</div>
          <p className="mt-1 text-sm text-zinc-300">
            Matchups are made up. The simulator uses the drafted UC player seasons to generate a possession timeline,
            highlights, and a win probability chart. It’s meant to feel believable, not be an analytics model.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold text-zinc-100">Accounts</div>
          <p className="mt-1 text-sm text-zinc-300">Usernames are device based (cookie). No passwords. It just helps you save drafts.</p>
        </div>
      </section>

      <section className="space-y-3" id="quick-picks">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">Hall</div>
            <h2 className="text-lg font-black tracking-tight">Quick picks</h2>
            <p className="mt-1 text-sm text-zinc-300 max-w-2xl">Ready-made starting points. These are just filters and links — you still get to argue.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {lineups.map((x) => (
            <Link key={x.href} href={x.href} className="sb-card rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black tracking-tight text-zinc-100">{x.title}</div>
                  <div className="mt-1 text-sm text-zinc-300">{x.desc}</div>
                </div>
                <div className="text-xs text-zinc-500">→</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {x.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
