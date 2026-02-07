"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Opp = { id: string; name: string };

type OppResp = { opponents: Opp[] };

type RematchResp = { matchId: string };

export default function ChooseOpponentButton({
  draftId,
  mode,
}: {
  draftId: string;
  mode: "top" | "sicko";
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opps, setOpps] = useState<Opp[]>([]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return opps;
    return opps.filter((o) => o.name.toLowerCase().includes(query));
  }, [opps, q]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);

    fetch(`/api/opponents?mode=${mode}&exclude=${draftId}`)
      .then((r) => r.json())
      .then((j: unknown) => {
        const list =
          typeof j === "object" && j && "opponents" in j && Array.isArray((j as OppResp).opponents)
            ? (j as OppResp).opponents
            : [];
        setOpps(list);
      })
      .catch(() => setErr("Failed to load opponents"))
      .finally(() => setLoading(false));
  }, [open, mode, draftId]);

  async function pick(opp: Opp) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftA: draftId, draftB: opp.id, mode }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Match failed";
        throw new Error(msg);
      }

      router.push(`/m/${(json as RematchResp).matchId}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Match failed");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"
      >
        Choose opponent
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">pick opponent</div>
                <div className="truncate text-sm font-black tracking-tight text-zinc-100">Choose who you play</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 p-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20"
              />

              {err ? <div className="text-sm text-red-200">{err}</div> : null}

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">Loading…</div>
              ) : !filtered.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                  No opponents yet. Make another public draft.
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-black/20">
                  {filtered.map((o) => (
                    <button
                      key={o.id}
                      disabled={saving}
                      onClick={() => pick(o)}
                      className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-60"
                    >
                      <span className="truncate font-semibold text-zinc-100">{o.name}</span>
                      <span className="text-[11px] text-zinc-500">Play</span>
                    </button>
                  ))}
                </div>
              )}

              {saving ? <div className="text-[11px] text-zinc-500">Scheduling matchup…</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
