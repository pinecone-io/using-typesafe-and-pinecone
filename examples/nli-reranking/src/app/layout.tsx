import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * GT Planar VCTR is the Pinecone primary typeface but is licensed from Grilli Type, so its files
 * are not committed here. The font stack picks it up when installed locally and otherwise falls
 * back to Inter, which the brand guide names for exactly this case.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Search Birds and Rerank them in Natural Language",
  description:
    "Pinecone full-text search over bird Wikipedia pages, reranked in natural language with TypeSafe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
