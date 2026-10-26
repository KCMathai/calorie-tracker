import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";
import { SyncProvider } from "@/components/SyncProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Calorie Tracker", template: "%s · Calorie Tracker" },
  description: "Track your daily calories and stay on target.",
  applicationName: "Calorie Tracker",
  // iPhone: open full-screen when launched from the Home Screen.
  appleWebApp: { capable: true, title: "Calories", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthGate>
          <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">{children}</main>
          <BottomNav />
          <SyncProvider />
        </AuthGate>
      </body>
    </html>
  );
}
