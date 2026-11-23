import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminRouterClient } from "@/components/admin/AdminRouterClient";
import { LoadingState } from "@/components/ui/StateViews";

export const metadata: Metadata = {
  title: "City Dashboard & AI Verification",
  description:
    "Municipal review console for side-by-side Before vs After contractor repair verification powered by CivicSnap Vision AI.",
};

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          Bengaluru Pilot • City Dashboard &amp; AI Fix Verification
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          CivicSnap municipal verification dashboard
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-slate-600 sm:text-base">
          Compare citizen Before photos against contractor After repair proof
          with CivicSnap Vision AI match scores, audit estimated materials, and
          approve verified fixes.
        </p>
      </div>

      <Suspense
        fallback={
          <LoadingState
            label="Loading CivicSnap verification dashboard..."
            rows={3}
          />
        }
      >
        <AdminRouterClient />
      </Suspense>
    </div>
  );
}
