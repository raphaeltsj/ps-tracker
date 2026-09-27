import { Logo } from "@/components/logo";
import { StatusPage } from "@/components/status-page";

// Unknown addresses outside the app pages (for example a mistyped link).
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b px-4">
        <Logo />
      </header>
      <StatusPage title="Page not found">That address doesn&apos;t match any page in PS Tracker. Check the link, or go back to the app.</StatusPage>
    </div>
  );
}
