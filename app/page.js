"use client";
import dynamic from "next/dynamic";

const DraftApp = dynamic(() => import("@/components/DraftApp"), { ssr: false });

export default function Page() {
  return <DraftApp />;
}
