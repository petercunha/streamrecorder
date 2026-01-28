import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Initialize server-side services (auto-recording, etc.)
import "@/lib/server-init";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TwitchRecorder - Stream Recording Manager",
  description: "Manage and record Twitch livestreams with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181B',
              border: '1px solid #2D2D35',
              color: '#F0F0F0',
            },
          }}
        />
      </body>
    </html>
  );
}
