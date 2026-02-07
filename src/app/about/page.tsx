import BackButton from "@/components/BackButton";

export const metadata = {
  title: "About • UC Hoops History",
  description: "How this site works, where the data comes from, and what’s real vs simulated.",
};

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
          <p className="mt-1 text-sm text-zinc-300">
            Seasons and player stats are pulled from Sports-Reference (College Basketball).
          </p>
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
          <p className="mt-1 text-sm text-zinc-300">
            Usernames are device based (cookie). No passwords. It just helps you save and manage drafts.
          </p>
        </div>
      </section>
    </div>
  );
}
