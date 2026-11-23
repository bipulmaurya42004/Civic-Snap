import { Award, Crown, Shield } from "lucide-react";
import type { CivicLevelBadgeInfo } from "@/types/civic";

interface CivicBadgeChipProps {
  badge: CivicLevelBadgeInfo;
  size?: "sm" | "md";
}

const TIER_STYLES = {
  bronze: {
    container: "border-amber-300/80 bg-amber-50 text-amber-900",
    iconWrap: "bg-amber-700/15 text-amber-800",
    Icon: Award,
  },
  silver: {
    container: "border-slate-300 bg-slate-100 text-slate-800",
    iconWrap: "bg-slate-600/15 text-slate-700",
    Icon: Shield,
  },
  gold: {
    container: "border-yellow-400/90 bg-yellow-50 text-yellow-900",
    iconWrap: "bg-yellow-500/20 text-yellow-800",
    Icon: Crown,
  },
} as const;

export function CivicBadgeChip({ badge, size = "md" }: CivicBadgeChipProps) {
  const style = TIER_STYLES[badge.tier];
  const Icon = style.Icon;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${style.container}`}
      >
        <Icon size={13} aria-hidden="true" />
        <span>
          {badge.label} · {badge.rankTitle}
        </span>
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${style.container}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconWrap}`}
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-xs font-bold uppercase tracking-wide">
          {badge.label} Badge
        </p>
        <p className="text-sm font-semibold">{badge.rankTitle}</p>
      </div>
    </div>
  );
}
