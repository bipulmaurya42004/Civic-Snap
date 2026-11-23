import { LoadingState } from "@/components/ui/StateViews";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <LoadingState label="Loading CivicSnap page..." rows={4} />
    </div>
  );
}
