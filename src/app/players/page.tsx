import { Suspense } from "react";
import PlayersClient from "./ui";

export default function PlayersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-300">Loading…</div>}>
      <PlayersClient />
    </Suspense>
  );
}
