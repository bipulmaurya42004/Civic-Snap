"use client";

import { ErrorState } from "@/components/ui/StateViews";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: GlobalErrorProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <ErrorState
        title="We hit an unexpected page error"
        message="Please try loading this view again, or return to the CivicSnap home page."
        onRetry={reset}
        fallbackHref="/"
        fallbackLabel="Back to Home"
      />
    </div>
  );
}
