"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChooseOpponentButton from "@/components/ChooseOpponentButton";

export default function CompeteButton({ draftId, mode }: { draftId: string; mode: "top" | "sicko" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Match failed");
      router.push(`/m/${json.matchId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/30 via-white/5 to-black/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight">Compete</h2>
        <div className="text-xs text-zinc-500">Random opponent</div>
      </div>
      <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
        Generate a matchup against a random public team in the same league.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={run}
          disabled={loading}
          className="rounded-xl bg-red-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-red-400 transition-colors disabled:opacity-60"
        >
          {loading ? "Simulating" : "Compete"}
        </button>
        <ChooseOpponentButton draftId={draftId} mode={mode} />
      </div>
      {err ? <div className="mt-3 text-xs text-red-300">{err}</div> : null}
    </section>
  );
}
