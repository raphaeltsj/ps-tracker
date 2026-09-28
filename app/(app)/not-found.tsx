import { StatusPage } from "@/components/status-page";
import { getViewer } from "@/lib/auth";

// Shown inside the app (with the header and tabs) for a page that does not exist, or one the
// viewer's role cannot open (Tasks, Task report, Dayworkers, Staff call notFound() for other roles).
// The role note below is tailored to what the current viewer actually can't open, rather than a
// single hardcoded example that may not match the page they were just on.
export default async function NotFound() {
  const viewer = await getViewer();
  const roleNote =
    viewer?.role === "STAFF"
      ? " Regular Staff can't open Staff records, Tasks, Task report, Dayworkers, or Manage requests."
      : viewer?.role === "SUPERVISOR"
        ? " Only Management can open Tasks."
        : "";

  return (
    <StatusPage title="This page isn't available">
      It may not exist, or it may be for another role.{roleNote} Use the menu or the links below.
    </StatusPage>
  );
}
