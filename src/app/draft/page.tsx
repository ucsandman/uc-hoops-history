import { Suspense } from "react";
import DraftBoard from "@/components/DraftBoard";

export default function DraftPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-300">Loading…</div>}>
      <DraftBoard />
    </Suspense>
  );
}
