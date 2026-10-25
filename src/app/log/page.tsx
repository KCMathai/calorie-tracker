import type { Metadata } from "next";
import { LogView } from "@/components/LogView";

export const metadata: Metadata = { title: "Log food" };

export default function LogPage() {
  return <LogView />;
}
