import type { LeaderboardEntry } from "@/types/civic";
import { EmptyState } from "@/components/ui/StateViews";
import { CivicBadgeChip } from "@/components/ui/CivicBadgeChip";
import { Award } from "lucide-react";

interface LeaderboardTableProps {
  entries: readonly LeaderboardEntry[];
  isDemo?: boolean;
}

export function LeaderboardTable({
  entries,
  isDemo = false,
}: LeaderboardTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-[18px] border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            CivicPoints Ranking · Bronze, Silver &amp; Gold Badges
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            +10 CivicPoints for each Accepted report and +25 CivicPoints when
            Resolved. Public listing is strictly opt-in using a chosen
            alias—never your email or legal name.
          </p>
        </div>
        {isDemo && (
          <span className="text-xs font-semibold text-[#C2410C] whitespace-nowrap shrink-0">
            Sample aliases · Demo data
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Award size={20} aria-hidden="true" />}
          title="No public contributors listed yet"
          description="CivicPoints rankings appear here automatically from Firestore once reports are accepted or resolved for opted-in residents."
          primaryAction={{
            label: "View Demo Leaderboard",
            href: "/demo?tab=leaderboard",
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th scope="col" className="px-5 py-3.5">
                    Rank
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Contributor Alias
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Level Badge
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Accepted
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Resolved
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    CivicPoints
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr
                    key={entry.alias}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4 font-mono text-sm font-semibold tabular-nums text-slate-700">
                      #{entry.rank}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {entry.alias}
                    </td>
                    <td className="px-5 py-4">
                      <CivicBadgeChip badge={entry.levelBadge} size="sm" />
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-slate-700">
                      {entry.acceptedReports}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-emerald-700">
                      {entry.resolvedReports}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-semibold tabular-nums text-[#2563EB]">
                      {entry.points} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
