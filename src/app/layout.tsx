import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_SUBTITLE} untuk tracking AWB, flight board, dan dashboard operator.`,
  icons: {
    icon: "/skyhub-mark-blue.svg",
    shortcut: "/skyhub-mark-blue.svg",
    apple: "/skyhub-mark-blue.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="h-full min-h-full overflow-hidden bg-[color:var(--app-bg)] font-[family:var(--font-body)] text-[color:var(--app-fg)]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
