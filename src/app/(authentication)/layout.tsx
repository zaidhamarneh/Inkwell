import { Logo } from "@/shared/brand/logo";
import { ThemeToggle } from "@/shared/theme/theme-toggle";

/** Log in and register: brand at the top, the form in a centered card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pt-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8 dark:shadow-black/30">
          {children}
        </div>
      </main>
    </div>
  );
}
