import type { TimelineEvent } from "@/types/civic";
import { formatCivicDateTime } from "@/lib/civic-logic";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

interface StatusTimelineProps {
  events: readonly TimelineEvent[];
  compact?: boolean;
}

export function StatusTimeline({
  events,
  compact = false,
}: StatusTimelineProps) {
  return (
    <div>
      <ol className="relative space-y-5 border-l border-slate-200 pl-5">
        {events.map((event, index) => {
          const isLatest = index === events.length - 1;
          return (
            <li key={event.id} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  event.statusTransition === "resolved"
                    ? "bg-[#10B981]"
                    : event.statusTransition === "in_progress"
                      ? "bg-[#2563EB]"
                      : isLatest
                        ? "bg-[#F97316]"
                        : "bg-slate-400"
                }`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`font-semibold text-slate-900 ${
                    compact ? "text-xs" : "text-sm"
                  }`}
                >
                  {event.label}
                </p>
                <time
                  dateTime={event.createdAt}
                  className="text-xs tabular-nums text-slate-500"
                >
                  {formatCivicDateTime(event.createdAt)}
                </time>
              </div>
              {event.statusTransition && !compact && (
                <div className="mt-1">
                  <StatusIndicator status={event.statusTransition} size="sm" />
                </div>
              )}
              <p
                className={`mt-1 leading-relaxed text-slate-600 ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {event.note}
              </p>
              {!compact && (
                <p className="mt-1 text-xs text-slate-500">{event.actorLabel}</p>
              )}
            </li>
          );
        })}
      </ol>
      {!compact && (
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Prototype status updates are managed by the CivicSnap project team.
          Timeline entries reflect recorded platform events and do not indicate
          an automatic government escalation.
        </p>
      )}
    </div>
  );
}
