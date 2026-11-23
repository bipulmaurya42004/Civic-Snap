import Link from "next/link";
import { FlaskConical } from "lucide-react";

interface DemoBannerProps {
  compact?: boolean;
}

export function DemoBanner({ compact = false }: DemoBannerProps) {
  return (
    <div
      role="region"
      aria-label="Demo mode notice"
      className="border-b border-orange-200 bg-orange-50/90 text-slate-900"
    >
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 ${
          compact ? "py-2.5" : "py-3.5"
        }`}
      >
        <div className="flex items-start gap-2.5 text-sm">
          <FlaskConical
            size={16}
            className="mt-0.5 shrink-0 text-[#F97316]"
            aria-hidden="true"
          />
          <p className="font-medium text-slate-900">
            Demo mode — sample data, no real complaints are being submitted.
          </p>
        </div>
        <Link
          href="/report"
          className="text-xs font-semibold text-[#2563EB] underline-offset-4 hover:underline whitespace-nowrap shrink-0"
        >
          View Reporting Flow
        </Link>
      </div>
    </div>
  );
}
