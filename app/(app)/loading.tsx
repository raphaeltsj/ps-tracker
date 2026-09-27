// Shown while another page's data loads, so a tap never looks ignored.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-10" role="status" aria-live="polite">
      <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" aria-hidden />
      <span className="ml-3 text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}
