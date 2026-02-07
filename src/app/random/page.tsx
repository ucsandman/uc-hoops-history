import { Suspense } from "react";
import RandomFive from "@/components/RandomFive";

export const dynamic = "force-dynamic";

export default function RandomPage() {
  return (
    <Suspense>
      <RandomFive />
    </Suspense>
  );
}
