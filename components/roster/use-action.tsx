"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";

/** Runs a Server Action and keeps its latest result message for display. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const r = await action();
        setResult(r);
        if (r.ok) onSuccess?.();
      } catch {
        setResult({ ok: false, error: "Something went wrong. Please try again." });
      }
    });
  }

  return { pending, result, run, clear: () => setResult(null) };
}

export function ResultMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={result.ok ? "text-sm text-success-ink" : "text-sm font-medium text-danger-ink"}>
      {result.ok ? result.message : result.error}
    </p>
  );
}
