"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light/dark theme for the whole app. Adds the "dark" class to <html>
 * (matching globals.css), remembers the choice in localStorage, follows the
 * OS setting until the user picks one, and sets the class before the page
 * paints so there's no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
