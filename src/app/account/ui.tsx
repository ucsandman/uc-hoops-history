"use client";

import { useEffect, useState } from "react";

type User = { id: string; username: string };

export default function AccountClient() {
  const [username, setUsername] = useState("");
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      const json: unknown = await res.json();
      const u =
        typeof json === "object" && json && "user" in json
          ? (json as { user: User | null }).user
          : null;
      setMe(u);
      if (u?.username) setUsername(u.username);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Failed";
        throw new Error(msg);
      }
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/account", { method: "DELETE" });
    setMe(null);
  }

  return (
    <div className="space-y-6">
      <header className="sb-card rounded-2xl p-6">
        <div className="text-xs text-zinc-400">Account</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Pick a username</h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
          This is a lightweight device account. No passwords. It just lets you save drafts and rename them.
        </p>
      </header>

      <section className="sb-card rounded-2xl p-5">
        {loading ? (
          <div className="text-sm text-zinc-300">Loading…</div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="block text-xs text-zinc-400">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="wes"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20"
                />
                <div className="mt-2 text-[11px] text-zinc-500">
                  Your drafts will default to: <span className="text-zinc-300">{(username || "username") + " - Draft (1)"}</span>
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="sb-chip rounded-xl px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-60"
              >
                {saving ? "Saving…" : me ? "Update" : "Create"}
              </button>
            </div>

            {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}

            {me ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                <div className="text-xs text-zinc-500">Current</div>
                <div className="mt-1 font-black text-zinc-100">{me.username}</div>
                <div className="mt-3 flex gap-2">
                  <a href="/me" className="sb-chip rounded-xl px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5">
                    Go to My drafts
                  </a>
                  <button onClick={logout} className="sb-chip rounded-xl px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5">
                    Log out
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
