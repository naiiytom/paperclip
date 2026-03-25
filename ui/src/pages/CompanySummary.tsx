import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "@/lib/router";
import {
  Bot,
  CircleDot,
  DollarSign,
  ShieldCheck,
  PauseCircle,
  LayoutGrid,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { DashboardSummary } from "@paperclipai/shared";
import type { Company } from "@paperclipai/shared";

interface CompanyCardProps {
  company: Company;
  summary: DashboardSummary;
}

function BudgetBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isOver = pct >= 90;
  const isMid = pct >= 60;

  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${
          isOver ? "bg-red-500" : isMid ? "bg-amber-400" : "bg-green-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "danger" | "warn";
}) {
  const iconColor =
    tone === "danger"
      ? "text-red-400"
      : tone === "warn"
        ? "text-amber-400"
        : "text-muted-foreground/60";

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              tone === "danger"
                ? "text-red-400"
                : tone === "warn"
                  ? "text-amber-400"
                  : "text-foreground"
            }`}
          >
            {value}
          </span>
        </div>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function CompanyCard({ company, summary }: CompanyCardProps) {
  const totalAgents =
    summary.agents.active + summary.agents.running + summary.agents.paused + summary.agents.error;
  const totalApprovals = summary.pendingApprovals + summary.budgets.pendingApprovals;
  const hasIncidents = summary.budgets.activeIncidents > 0;
  const hasErrors = summary.agents.error > 0;

  const agentSub = [
    summary.agents.running > 0 ? `${summary.agents.running} running` : null,
    summary.agents.paused > 0 ? `${summary.agents.paused} paused` : null,
    summary.agents.error > 0 ? `${summary.agents.error} error` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const taskSub = [
    summary.tasks.open > 0 ? `${summary.tasks.open} open` : null,
    summary.tasks.blocked > 0 ? `${summary.tasks.blocked} blocked` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const budgetSub =
    summary.costs.monthBudgetCents > 0
      ? `${summary.costs.monthUtilizationPercent}% of ${formatCents(summary.costs.monthBudgetCents)}`
      : "Unlimited budget";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {company.brandColor && (
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: company.brandColor }}
              />
            )}
            <span className="font-semibold text-sm truncate">{company.name}</span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
              company.status === "active"
                ? "bg-green-500/10 text-green-500"
                : company.status === "paused"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {company.status}
          </span>
        </div>

        {hasIncidents && (
          <div className="flex items-center gap-1.5 mt-2 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
            <PauseCircle className="h-3 w-3 text-red-400 shrink-0" />
            <span className="text-xs text-red-300">
              {summary.budgets.activeIncidents} budget incident
              {summary.budgets.activeIncidents !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between gap-4 pt-0">
        <div>
          <Stat
            icon={Bot}
            label="Agents"
            value={totalAgents}
            sub={agentSub || undefined}
            tone={hasErrors ? "danger" : "default"}
          />
          <Stat
            icon={CircleDot}
            label="In Progress"
            value={summary.tasks.inProgress}
            sub={taskSub || undefined}
            tone={summary.tasks.blocked > 0 ? "warn" : "default"}
          />
          <div className="py-2 border-b border-border">
            <div className="flex items-start gap-2.5">
              <DollarSign className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Month Spend</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCents(summary.costs.monthSpendCents)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{budgetSub}</p>
                {summary.costs.monthBudgetCents > 0 && (
                  <BudgetBar
                    used={summary.costs.monthSpendCents}
                    total={summary.costs.monthBudgetCents}
                  />
                )}
              </div>
            </div>
          </div>
          <Stat
            icon={ShieldCheck}
            label="Pending Approvals"
            value={totalApprovals}
            tone={totalApprovals > 0 ? "warn" : "default"}
          />
        </div>

        <Link
          to={`/${company.issuePrefix.toLowerCase()}/dashboard`}
          className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors no-underline group pt-1"
        >
          <span>Open Dashboard</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}

function SummaryTotals({
  summaries,
  companies,
}: {
  summaries: DashboardSummary[];
  companies: Company[];
}) {
  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        agents: acc.agents + s.agents.active + s.agents.running + s.agents.paused + s.agents.error,
        running: acc.running + s.agents.running,
        errors: acc.errors + s.agents.error,
        inProgress: acc.inProgress + s.tasks.inProgress,
        open: acc.open + s.tasks.open,
        spend: acc.spend + s.costs.monthSpendCents,
        approvals: acc.approvals + s.pendingApprovals + s.budgets.pendingApprovals,
        incidents: acc.incidents + s.budgets.activeIncidents,
      }),
      { agents: 0, running: 0, errors: 0, inProgress: 0, open: 0, spend: 0, approvals: 0, incidents: 0 },
    );
  }, [summaries]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
      {[
        {
          icon: Bot,
          value: totals.agents,
          label: "Total Agents",
          sub: `${totals.running} running · ${totals.errors} errors`,
          tone: totals.errors > 0 ? ("danger" as const) : ("default" as const),
        },
        {
          icon: CircleDot,
          value: totals.inProgress,
          label: "Tasks In Progress",
          sub: `${totals.open} open across ${companies.length} companies`,
          tone: "default" as const,
        },
        {
          icon: DollarSign,
          value: formatCents(totals.spend),
          label: "Total Month Spend",
          sub: `Across ${summaries.length} companies`,
          tone: "default" as const,
        },
        {
          icon: totals.incidents > 0 ? AlertTriangle : TrendingUp,
          value: totals.incidents > 0 ? totals.incidents : totals.approvals,
          label: totals.incidents > 0 ? "Budget Incidents" : "Pending Approvals",
          sub:
            totals.incidents > 0
              ? `${totals.approvals} pending approvals`
              : "Awaiting board review",
          tone: totals.incidents > 0 ? ("danger" as const) : totals.approvals > 0 ? ("warn" as const) : ("default" as const),
        },
      ].map(({ icon: Icon, value, label, sub, tone }) => (
        <div
          key={label}
          className="bg-card border border-border rounded-lg px-4 py-4 sm:px-5 sm:py-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">{label}</p>
              <p
                className={`text-xs mt-1.5 hidden sm:block ${
                  tone === "danger"
                    ? "text-red-400"
                    : tone === "warn"
                      ? "text-amber-400"
                      : "text-muted-foreground/70"
                }`}
              >
                {sub}
              </p>
            </div>
            <Icon
              className={`h-4 w-4 shrink-0 mt-1.5 ${
                tone === "danger"
                  ? "text-red-400/60"
                  : tone === "warn"
                    ? "text-amber-400/60"
                    : "text-muted-foreground/50"
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompanySummary() {
  const { companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Summary" }]);
  }, [setBreadcrumbs]);

  const { data: summaries, isLoading } = useQuery({
    queryKey: queryKeys.dashboardAll,
    queryFn: () => dashboardApi.allCompanies(),
  });

  const summaryByCompanyId = useMemo(() => {
    const map = new Map<string, DashboardSummary>();
    for (const s of summaries ?? []) map.set(s.companyId, s);
    return map;
  }, [summaries]);

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.status !== "archived"),
    [companies],
  );

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (activeCompanies.length === 0) {
    return (
      <EmptyState icon={LayoutGrid} message="No companies found. Create one to get started." />
    );
  }

  const companiesWithSummary = activeCompanies
    .map((c) => ({ company: c, summary: summaryByCompanyId.get(c.id) }))
    .filter((x): x is { company: Company; summary: DashboardSummary } => !!x.summary);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">All Companies</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of {activeCompanies.length} active{" "}
          {activeCompanies.length === 1 ? "company" : "companies"}
        </p>
      </div>

      {companiesWithSummary.length > 0 && (
        <SummaryTotals
          summaries={companiesWithSummary.map((x) => x.summary)}
          companies={activeCompanies}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {companiesWithSummary.map(({ company, summary }) => (
          <CompanyCard key={company.id} company={company} summary={summary} />
        ))}
      </div>
    </div>
  );
}
