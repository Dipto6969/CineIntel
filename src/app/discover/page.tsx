import { Suspense } from "react";
import DiscoveryBrowser from "@/components/discovery/DiscoveryBrowser";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080a0f]" />}>
      <DiscoveryBrowser />
    </Suspense>
  );
}
