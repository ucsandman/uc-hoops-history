import Link from "next/link";
import { notFound } from "next/navigation";
import CompeteButton from "@/components/CompeteButton";
import RenameDraft from "@/components/RenameDraft";
import { ensureSchema, db } from "@/lib/db";
import type { Lineup, PlayerSnap } from "@/lib/sim";
import { quickTeamProfile, pct } from "@/lib/teamView";

export const dynamic = "force-dynamic";

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2">
      <div className="text-zinc-500">{label}</div>
      <div className="mt-0.5 font-black text-zinc-100">{value}</div>
    </div>
  );
}

export default async function DraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;

  await ensureSchema();
  const pool = db();

  const res = await pool.query(`SELECT id, mode, name, lineup, edit_key FROM drafts WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) return notFound();

  const canEdit = sp.k && sp.k === row.edit_key;

  const profile = quickTeamProfile(row.lineup as Lineup, row.mode);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs text-zinc-500">{row.mode === "sicko" ? "Sicko League" : "Top 5 League"}</div>
        <h1 className="text-2xl font-black tracking-tight">{row.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4 text-zinc-300 hover:text-white" href={`/draft`}>
            Back to Draft Board
          </Link>
          {canEdit ? (
            <span className="text-xs text-emerald-300/80">Edit enabled</span>
          ) : (
            <span className="text-xs text-zinc-500">View only</span>
          )}
        </div>
      </header>

      {canEdit ? <RenameDraft id={row.id} initial={row.name} editKey={sp.k} /> : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-100">Team profile</div>
          <div className="text-xs text-zinc-500">pace est: {profile.pace} poss</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {profile.chips.map((t) => (
            <span key={t} className="sb-chip rounded-full px-2 py-0.5 text-[11px] text-zinc-200">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <MiniStat label="TO" value={pct(profile.toRate)} />
          <MiniStat label="OReb" value={pct(profile.orebRate)} />
          <MiniStat label="3PA" value={pct(profile.threeRate)} />
          <MiniStat label="Shoot" value={`${pct(profile.p2)} 2s • ${pct(profile.p3)} 3s`} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold text-zinc-100">Lineup snapshot</div>
        <div className="mt-3 space-y-2 text-sm">
          {Object.entries(row.lineup as Lineup).map(([slot, p]) => {
            const ps = p as PlayerSnap | null;
            return (
              <div
                key={slot}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="text-xs text-zinc-500 w-10">{slot.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-zinc-100">{ps?.player ?? "—"}</div>
                  {ps ? (
                    <div className="mt-0.5 text-[11px] text-zinc-400">
                      {ps.year} • {ps.pos ?? "—"} • {ps.pts ?? "—"} PPG • {ps.trb ?? "—"} RPG • {ps.ast ?? "—"} APG • {ps.minutes ?? "—"} MPG
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CompeteButton draftId={row.id} mode={row.mode} />
    </div>
  );
}
