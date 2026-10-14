import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appConfig } from "@/config/app";
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
  metadataBase: new URL(appConfig.url),
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  openGraph: {
    type: "website",
    siteName: appConfig.name,
    title: appConfig.name,
    description: appConfig.description,
    images: [{ url: "/images/arclivo-hero.webp", width: 1851, height: 850, alt: "Arclivo Labs digital product studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: appConfig.name,
    description: appConfig.description,
    images: ["/images/arclivo-hero.webp"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
