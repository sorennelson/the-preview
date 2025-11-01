import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpotifyEmbedProvider } from "@/contexts/SpotifyPlayerContext";
import Providers from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Preview",
  description: "Playlist creation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`antialiased`}
      >
        <Providers>
          <SpotifyEmbedProvider>{children}</SpotifyEmbedProvider>
        </Providers>
      </body>
    </html>
  );
}
