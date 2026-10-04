"use client";
import { Moon, Sun } from "lucide-react";

/** Switches the public site between light and dark and remembers the choice. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("th-theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-th-muted transition-colors hover:bg-th-raised hover:text-th-ink ${className}`}
      aria-label="Switch between light and dark mode"
      title="Light / dark"
    >
      <Sun className="h-[18px] w-[18px] dark:hidden" aria-hidden />
      <Moon className="hidden h-[18px] w-[18px] dark:block" aria-hidden />
    </button>
  );
}
