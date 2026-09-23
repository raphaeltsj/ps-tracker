"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    document.cookie = `theme=${dark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle light and dark mode" title="Light / dark mode">
      <Sun className="size-4 dark:hidden" />
      <Moon className="size-4 hidden dark:block" />
    </Button>
  );
}
