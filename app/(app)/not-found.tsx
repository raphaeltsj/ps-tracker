import { StatusPage } from "@/components/status-page";

// Shown inside the app (with the header and tabs) for a page that does not exist, or one the
// viewer's role cannot open (Tasks, Task report, Dayworkers call notFound() for other roles).
export default function NotFound() {
  return (
    <StatusPage title="This page isn't available">
      It may not exist, or it may be for another role (for example, only Management manages Tasks). Use the menu or the links below.
    </StatusPage>
  );
}
