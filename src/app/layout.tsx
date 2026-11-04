import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { THEME_COLORS, themeBootScript } from "@/lib/theme";
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
  title: {
    default: "Shuttle · Badminton tournaments",
    template: "%s · Shuttle",
  },
  description:
    "Create a badminton tournament in seconds, share a link, and keep live scores in sync on every phone. No sign-up.",
  applicationName: "Shuttle",
  appleWebApp: { capable: true, title: "Shuttle", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLORS.light,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeBootScript} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" offset={{ top: "calc(env(safe-area-inset-top) + 5.5rem)" }} />
        <ServiceWorker />
      </body>
    </html>
  );
}
