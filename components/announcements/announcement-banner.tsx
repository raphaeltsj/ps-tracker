"use client";
import { useState } from "react";
import { Megaphone, X } from "lucide-react";
import { closeAnnouncements } from "@/app/announcement-actions";
import type { AnnouncementSummary } from "@/lib/announcements";

const SEPARATOR = "     •     ";

/**
 * A supervisor's locked-date or special-event banner (spec 8.4). Several active announcements combine
 * into one banner instead of stacking, with the text sliding left to right so a long combined message
 * stays readable. Closing it is per-viewer: it does not remove the announcement for anyone else.
 */
export function AnnouncementBanner({ announcements }: { announcements: AnnouncementSummary[] }) {
  const [closed, setClosed] = useState(false);
  if (closed || announcements.length === 0) return null;

  const text = announcements.map((a) => a.message).join(SEPARATOR);
  const duration = Math.min(60, Math.max(18, text.length * 0.15));

  const close = () => {
    setClosed(true);
    void closeAnnouncements(announcements.map((a) => a.id));
  };

  return (
    <div
      role="status"
      data-announcement-banner
      className="flex h-(--banner-h) items-center gap-2 border-b border-info/40 bg-info-soft px-3 text-sm text-info-ink"
    >
      <Megaphone className="size-4 shrink-0" aria-hidden />
      <div className="relative h-5 flex-1 overflow-hidden">
        <span
          className="absolute top-0 left-0 flex items-center whitespace-nowrap font-medium [animation-name:banner-slide] [animation-timing-function:linear] [animation-iteration-count:infinite] motion-reduce:static motion-reduce:block motion-reduce:truncate motion-reduce:[animation-name:none]"
          style={{ animationDuration: `${duration}s` }}
        >
          {text}
        </span>
        {/* Full text for screen readers: the sliding copy above is decorative. */}
        <span className="sr-only">{announcements.map((a) => a.message).join(". ")}</span>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close announcement banner"
        title="Close"
        className="shrink-0 rounded p-0.5 hover:bg-info/10"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
