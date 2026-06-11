import Link from "next/link";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  variant = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";

  return (
    <div className={cn("page-heading relative mb-7 flex flex-col gap-5 pb-7", hero ? "scanner-hero items-center justify-center text-center" : "md:flex-row md:items-end md:justify-between")}>
      <div className={cn(hero && "mx-auto flex max-w-4xl flex-col items-center")}>
        <p className={cn("mb-3 flex items-center gap-2 font-mono text-[9px] font-medium uppercase tracking-[0.28em] text-primary", hero && "justify-center")}>
          <span className="h-px w-6 bg-primary/70" />{eyebrow}
        </p>
        <h1 className={cn("font-editorial font-medium leading-[0.95] tracking-[-0.035em] text-foreground", hero ? "text-[3.2rem] md:text-[5.4rem]" : "text-[2.5rem] md:text-[3.35rem]")}>{title}</h1>
        <p className={cn("mt-3 text-[13px] leading-6 text-muted-foreground", hero ? "mx-auto max-w-3xl md:text-[15px] md:leading-7" : "max-w-2xl")}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone = score >= 80 ? "text-positive border-positive/30 bg-positive/10" : score >= 60 ? "text-warning border-warning/30 bg-warning/10" : "text-negative border-negative/30 bg-negative/10";
  return <Badge variant="outline" className={cn("metric-number min-w-11 justify-center", tone, className)}>{Math.round(score)}</Badge>;
}

export function StatusBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const tone =
    lower.includes("bull") || lower.includes("leading") || lower === "clean" || lower.includes("actionable")
      ? "border-positive/30 bg-positive/10 text-positive"
      : lower.includes("bear") || lower.includes("avoid") || lower.includes("dead") || lower.includes("rejected")
        ? "border-negative/30 bg-negative/10 text-negative"
        : "border-warning/30 bg-warning/10 text-warning";
  return <Badge variant="outline" className={tone}>{label}</Badge>;
}

export function Metric({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail?: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0 px-5 py-5">
      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("metric-number mt-2.5 text-xl font-medium", positive === true && "text-positive", positive === false && "text-negative")}>{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex gap-3 rounded-lg border border-warning/25 bg-warning/8 p-4 text-sm text-warning">
      <WarningCircle className="mt-0.5 shrink-0" size={18} weight="fill" />
      <div className="leading-6">{children}</div>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80">
      {children}<ArrowRight size={15} />
    </Link>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel grid min-h-64 place-items-center p-8 text-center">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
