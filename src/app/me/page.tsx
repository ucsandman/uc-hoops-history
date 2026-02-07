import Link from "next/link";
import { ensureSchema, db } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  mode: "top" | "sicko";
  updated_at: string;
  wins: number;
  losses: number;
  elo: number;
};

export default async function MePage() {
  await ensureSchema();
  const userId = await getUserId();

  if (!userId) {
    return (
      <div className="space-y-6">
        <header className="sb-card rounded-2xl p-6">
          <div className="text-xs text-zinc-400">Account</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Your stuff</h1>
          <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
            Pick a username first so we can save your drafts on this device.
          </p>
          <div className="mt-4">
            <Link href="/account" className="sb-chip rounded-xl px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/5">
              Create account
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const pool = db();
  const res = await pool.query<Row>(
    `
    SELECT d.id, d.name, d.mode, d.updated_at, r.wins, r.losses, r.elo
    FROM drafts d
    JOIN ratings r ON r.draft_id = d.id
    WHERE d.user_id = $1
    ORDER BY d.updated_at DESC
    LIMIT 100;
    `,
    [userId]
  );

  return (
    <div className="space-y-6">
      <header className="sb-card rounded-2xl p-6">
        <div className="text-xs text-zinc-400">Account</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">My drafts</h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
          Drafts saved to this device account.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/draft" className="sb-chip rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
            New draft
          </Link>
          <Link href="/account" className="sb-chip rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
            Account settings
          </Link>
        </div>
      </header>

      <section className="sb-card rounded-2xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr className="text-left">
                <th className="py-2 pr-2">Draft</th>
                <th className="py-2 pr-2">Mode</th>
                <th className="py-2 pr-2">Elo</th>
                <th className="py-2 pr-2">W</th>
                <th className="py-2 pr-2">L</th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="py-2 pr-2">
                    <a className="underline underline-offset-4 text-zinc-100 hover:text-white" href={`/d/${r.id}`}>
                      {r.name}
                    </a>
                  </td>
                  <td className="py-2 pr-2 text-zinc-200">{r.mode === "sicko" ? "Sicko" : "Top 5"}</td>
                  <td className="py-2 pr-2 font-black text-zinc-100">{r.elo}</td>
                  <td className="py-2 pr-2 text-zinc-200">{r.wins}</td>
                  <td className="py-2 pr-2 text-zinc-200">{r.losses}</td>
                </tr>
              ))}
              {!res.rows.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-zinc-400">
                    No drafts yet. Make one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
