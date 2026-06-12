import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Manrope } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { AccountProvider } from "@/components/account-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const editorial = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SwingScanner", template: "%s · SwingScanner" },
  description: "Live end-of-day swing setup scanner with a private local trading journal coach.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${plexMono.variable} ${editorial.variable} dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem("swingscanner-theme");
                const theme = ["retro", "flux", "chroma", "pastel", "romantic"].includes(saved) ? saved : "modern";
                document.documentElement.dataset.theme = theme;
                const chroma = localStorage.getItem("swingscanner-chroma");
                document.documentElement.dataset.chroma = ["purple", "orange", "red", "green", "blue"].includes(chroma) ? chroma : "purple";
              } catch (_) {
                document.documentElement.dataset.theme = "modern";
              }
            `,
          }}
        />
      </head>
      <body>
        <TooltipProvider>
          <AccountProvider><AppShell>{children}</AppShell></AccountProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
