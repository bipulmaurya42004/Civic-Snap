import { CheckCircle2, Clock, Wrench } from "lucide-react";
import type { IssueStatus } from "@/types/civic";
import { STATUS_LABELS } from "@/types/civic";

interface StatusIndicatorProps {
  status: IssueStatus;
  size?: "sm" | "md";
}

const STATUS_STYLES: Record<
  IssueStatus,
  {
    text: string;
    iconColor: string;
  }
> = {
  pending: {
    text: "text-[#C2410C]",
    iconColor: "text-[#F97316]",
  },
  in_progress: {
    text: "text-[#1D4ED8]",
    iconColor: "text-[#2563EB]",
  },
  resolved: {
    text: "text-[#047857]",
    iconColor: "text-[#10B981]",
  },
};

/**
 * Accessible status indicator that pairs color, icon, and explicit text label.
 */
export function StatusIndicator({ status, size = "sm" }: StatusIndicatorProps) {
  const style = STATUS_STYLES[status];
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
        size === "sm" ? "text-xs" : "text-sm"
      } ${style.text}`}
    >
      {status === "pending" && (
        <Clock size={iconSize} className={style.iconColor} aria-hidden="true" />
      )}
      {status === "in_progress" && (
        <Wrench size={iconSize} className={style.iconColor} aria-hidden="true" />
      )}
      {status === "resolved" && (
        <CheckCircle2
          size={iconSize}
          className={style.iconColor}
          aria-hidden="true"
        />
      )}
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
