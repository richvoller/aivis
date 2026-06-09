import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { getBrandsAndCurrent } from "@/lib/current-brand";
import { isMockMode } from "@/lib/dataforseo/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Visibility & Optimisation",
  description: "Track how brands appear in AI-generated responses across ChatGPT, Claude, Gemini and Perplexity.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { brands, current } = await getBrandsAndCurrent();
  const mockMode = isMockMode();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex h-screen overflow-hidden">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar
                brands={brands.map((b) => ({ id: b.id, name: b.name }))}
                currentId={current?.id ?? null}
                mockMode={mockMode}
              />
              <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
