import type { Metadata } from "next";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="text-muted">Coming soon: your last 7 days and weight trend.</p>
    </div>
  );
}
