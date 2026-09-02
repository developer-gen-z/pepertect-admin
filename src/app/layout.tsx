import type { Metadata, Viewport } from "next";
import { Sora, Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({ variable: "--font-ibm-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "Pepertect Admin",
  description: "Admin panel for Pepertect — NSE Paper Trading Platform",
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.svg' },
  openGraph: {
    title: "Pepertect Admin",
    description: "Admin panel for Pepertect — NSE Paper Trading Platform",
    siteName: "Pepertect",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // a11y fix (WCAG 1.4.4): allow pinch-zoom — previously blocked
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F19" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
