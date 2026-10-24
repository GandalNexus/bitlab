import type { Metadata } from "next";
import { Inter, Inconsolata } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LangProvider } from "@/lib/i18n";
import { THEME_BOOT_SCRIPT, ThemeProvider } from "@/lib/theme";

/**
 * Typography aligned with the Stellar Design System (SDS):
 * Inter for text (stellar.org / Stellar Lab official family),
 * Inconsolata for code (hex, xpub, JSON).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const inconsolata = Inconsolata({
  variable: "--font-inconsolata",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BitLab — Laboratoire Bitcoin Sandbox | GandalNexus",
  description:
    "Environnement de laboratoire Bitcoin multi-réseaux (Mainnet, Testnet3, Testnet4, Signet) et Lightning Network : génération de portefeuilles, constructeur de transactions, factures Lightning et explorateur. Clés 100 % locales.",
  keywords: ["Bitcoin", "Testnet4", "Testnet3", "Signet", "Mainnet", "Lightning Network", "sandbox", "BitLab", "GandalNexus", "wasm", "transactions"],
  authors: [{ name: "GandalNexus" }],
  openGraph: {
    title: "BitLab — Laboratoire Bitcoin Sandbox",
    description: "Manipulez le protocole Bitcoin sur Testnet, Signet ou Mainnet : portefeuilles, transactions, Lightning.",
    siteName: "GandalNexus",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inconsolata.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {/* Anti-flash: applies the persisted theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <LangProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LangProvider>
        <Toaster />
      </body>
    </html>
  );
}
