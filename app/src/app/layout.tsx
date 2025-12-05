import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Dream Forge - Photo to 3D Model",
  description: "Transform your photos into stunning 3D models with AI-powered technology. Perfect for 3D printing, gaming, or digital art.",
};

// Export font variables for use in locale layout
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout wraps [locale]/layout.tsx which handles <html> and <body>
  return children;
}
