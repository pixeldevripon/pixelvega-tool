import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixelvega PMT",
  description: "Project management workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        {/* Data before presentation: the query cache wraps the theme rather
            than the other way round, so a provider that needs to read server
            state later has one available. Both are client components, and
            `children` stays a server component inside either. */}
        <QueryProvider>
          <ThemeProvider>
            {/* Radix requires one provider per app for tooltip timing to be
                shared: without it every tooltip runs its own delay, so moving
                along a row of icon buttons re-waits at each one. */}
            <TooltipProvider>
              {children}
              <Toaster position="top-right" />
            </TooltipProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
