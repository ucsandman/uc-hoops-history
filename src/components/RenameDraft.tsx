"use client";

import { useState } from "react";

export default function RenameDraft({
  id,
  initial,
  editKey,
}: {
  id: string;
  initial: string;
  editKey?: string;
}) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setErr(null);
    setOk(false);
    setSaving(true);
    try {
      const res = await fetch("/api/draft/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, editKey }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Rename failed";
        throw new Error(msg);
      }
      setOk(true);
      setTimeout(() => setOk(false), 900);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-zinc-400">Rename</div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20"
            placeholder="Username - Team Name"
          />
          {err ? <div className="mt-1 text-xs text-red-300">{err}</div> : null}
          {ok ? <div className="mt-1 text-xs text-emerald-300/80">Saved</div> : null}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="sb-chip rounded-xl px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save name"}
        </button>
      </div>
      <div className="mt-2 text-[11px] text-zinc-500">
        Tip: use <span className="text-zinc-300">username - nickname</span> so matchups look clean.
      </div>
    </div>
  );
}
