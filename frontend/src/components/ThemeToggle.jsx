import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, setTheme } from "../lib/theme";
import { cn } from "../lib/utils";

/** Açık / koyu tema düğmesi. Seçim kalıcıdır. */
export default function ThemeToggle({ className = "" }) {
  const [theme, setThemeState] = useState(getTheme);
  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";
  const label = isDark ? "Açık temaya geç" : "Koyu temaya geç";

  const toggle = () => {
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="btn-theme-toggle"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
