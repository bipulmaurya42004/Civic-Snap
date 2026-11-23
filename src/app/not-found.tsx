import { EmptyState } from "@/components/ui/StateViews";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <EmptyState
        icon={<Compass size={20} aria-hidden="true" />}
        title="Page not found"
        description="The civic report or page you requested does not exist on CivicSnap."
        primaryAction={{ label: "Go to Home", href: "/" }}
        secondaryAction={{ label: "Explore Read-Only Demo", href: "/demo" }}
      />
    </div>
  );
}
