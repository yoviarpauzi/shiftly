"use client";

import { Inter } from "next/font/google";
import { useEffect } from "react";
import { ErrorView } from "@/components/error-view";
import { cn } from "@/lib/utils";
import "./globals.css";

// This file replaces the root layout, so it loads the stylesheet and font itself.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={cn("h-full antialiased", inter.variable, "font-sans")}
    >
      <body suppressHydrationWarning>
        <ErrorView error={error} retry={unstable_retry} />
      </body>
    </html>
  );
}
