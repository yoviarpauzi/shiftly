import { Suspense } from "react";
import { BillingForm } from "@/components/dashboard/billings/billing-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requestChoicesFor } from "@/app/dashboard/requests/requests";
import { dateInZone } from "@/lib/indonesia-date";
import { DEFAULT_LOCATION_TIMEZONE } from "@/validation/location";
import { billingLocationChoices } from "../billing-rules";
import { requireBillingUser } from "../billing-guard";

function Heading() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">New billing</h1>
      <p className="text-sm text-muted-foreground">
        Pick a location and a period. The billing starts as a draft and gets its number when issued.
      </p>
    </div>
  );
}

async function NewBilling() {
  const { access } = await requireBillingUser();
  const choices = await requestChoicesFor(access);
  const today = dateInZone(DEFAULT_LOCATION_TIMEZONE);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <Heading />
      <BillingForm
        locations={billingLocationChoices(choices.sites, choices.locations)}
        today={today}
      />
    </div>
  );
}

function NewBillingFallback() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <Heading />
      <div className="flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<NewBillingFallback />}>
      <NewBilling />
    </Suspense>
  );
}
