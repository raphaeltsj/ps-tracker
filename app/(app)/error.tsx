"use client";
import { useEffect } from "react";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

// Something failed while loading a page: say so plainly, offer a retry and a way back.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      title="Something went wrong"
      action={
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
      }
    >
      This page couldn&apos;t load. Nothing you entered has been lost. Try again, and if it keeps happening, tell your supervisor{error.digest ? ` (reference ${error.digest})` : ""}.
    </StatusPage>
  );
}
