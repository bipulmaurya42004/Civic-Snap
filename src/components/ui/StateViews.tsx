import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Info } from "lucide-react";

interface LoadingStateProps {
  label?: string;
  rows?: number;
}

export function LoadingState({
  label = "Loading civic reports...",
  rows = 3,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[18px] border border-slate-200 bg-white p-6"
    >
      <p className="text-sm font-medium text-slate-600 mb-5">{label}</p>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
          >
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon ?? <Inbox size={20} aria-hidden="true" />}
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
            >
              {primaryAction.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fallbackHref?: string;
  fallbackLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  fallbackHref,
  fallbackLabel,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-[18px] border border-red-200 bg-white p-6 text-left"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          {(onRetry || fallbackHref) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  Try again
                </button>
              )}
              {fallbackHref && fallbackLabel && (
                <Link
                  href={fallbackHref}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                >
                  {fallbackLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MilestoneNoticeProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function MilestoneNotice({
  title,
  description,
  actionHref = "/demo",
  actionLabel = "Explore Read-Only Demo",
}: MilestoneNoticeProps) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
            <Info size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
