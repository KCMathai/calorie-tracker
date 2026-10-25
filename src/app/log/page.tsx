import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log food" };

export default function LogPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Log food</h1>
      <p className="text-muted">Coming in the next step: add meals by hand, photo or barcode.</p>
    </div>
  );
}
