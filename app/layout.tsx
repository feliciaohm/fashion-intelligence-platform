import "./globals.css";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import AppHeader from "@/components/AppHeader";
import { MobileNavProvider } from "@/lib/mobile-nav-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Display serif, used only for the public marketing page's section
// headlines (the "Design support with clear direction" reference) --
// deliberately not used anywhere in the working app itself, which stays
// on Inter throughout.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Fashion Intelligence Platform",
  description: "Analytics for luxury fashion brands — finance, product, and influencer intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
        <MobileNavProvider>
          <div className="app-shell">
            <Nav />
            <main className="app-main">
              <AppHeader />
              <div className="app-main-content">{children}</div>
            </main>
          </div>
        </MobileNavProvider>
      </body>
    </html>
  );
}
