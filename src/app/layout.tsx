import type { Metadata, Viewport } from "next";
import { Geist_Mono, Geom } from "next/font/google";
import "./globals.css";

const geom = Geom({
  variable: "--font-geom",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Flint - durable job scheduling over HTTP",
    template: "%s | Flint",
  },
  description:
    "Flint is a self-hostable job scheduling service. POST work over HTTP, run it on a fleet of workers, and watch every transition stream back in real time.",
  applicationName: "Flint",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  keywords: [
    "job queue",
    "scheduler",
    "PostgreSQL",
    "background jobs",
    "distributed systems",
  ],
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geom.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
