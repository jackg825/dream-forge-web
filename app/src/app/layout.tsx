import type { Metadata } from "next";
import { WebMCPProvider } from "@/components/agent/WebMCPProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dream Forge - Photo to 3D Model",
  description: "Transform your photos into stunning 3D models with AI-powered technology. Perfect for 3D printing, gaming, or digital art.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout wraps [locale]/layout.tsx which handles <html> and <body>
  return (
    <>
      <WebMCPProvider />
      {children}
    </>
  );
}
