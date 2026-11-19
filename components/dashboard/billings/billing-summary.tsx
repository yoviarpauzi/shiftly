import type { BillingSummaryProps } from "@/types/billings";

// Counts for the billing. The left-out card shows only on a Draft.
export function BillingSummary({ totalDays, poCount, excludedDays }: BillingSummaryProps) {
  const cards = [
    { label: "Total days", value: totalDays, hint: "Worker-days to bill" },
    { label: "POs", value: poCount, hint: "Purchase orders in the period" },
    ...(excludedDays === null
      ? []
      : [{ label: "Left out", value: excludedDays, hint: "Already held by another billing" }]),
  ];

  return (
    <dl className="grid gap-2 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-0.5 rounded-lg border px-4 py-3">
          <dt className="text-sm text-muted-foreground">{card.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{card.value}</dd>
          <dd className="text-xs text-muted-foreground">{card.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
