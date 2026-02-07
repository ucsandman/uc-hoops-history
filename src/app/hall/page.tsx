import Link from "next/link";

export const metadata = {
  title: "Hall • UC Hoops History",
  description: "Quick picks, famous eras, and ready-made lineups for arguing with friends.",
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

export default function HallPage() {
  return (
    <div className="space-y-6">
      <header className="sb-card rounded-2xl p-6">
        <div className="text-xs text-zinc-400">Hall</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Quick picks</h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
          Ready-made starting points. These are just filters and links — you still get to argue.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <span key={t} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-200">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
