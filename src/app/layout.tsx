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
  title: {
    default: "Échiquier jouable, Stockfish sur l'appareil",
    template: "%s | Démonstration échecs",
  },
  description:
    "Démonstration jouable : chess.js pour les règles, Stockfish 18 en WebAssembly pour l'adversaire, force réglable, interface accessible au clavier.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Le contenu est en français. Avec lang="en", une synthèse vocale lit le
    // texte avec la phonétique anglaise et le rend incompréhensible.
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
