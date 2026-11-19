import { BillingsDataTable } from "@/components/dashboard/billings/data-table";
import { parsePageParams } from "@/validation/pagination";
import { parseBillingStatus } from "@/validation/billings";
import { parseRequestLocation } from "@/validation/request-location";
import { parseRequestSite } from "@/validation/request-site";
import { requestLocationsFor } from "@/app/dashboard/requests/request-rules";
import { requestChoicesFor } from "@/app/dashboard/requests/requests";
import { listBillings } from "./billings";
import { requireBillingUser } from "./billing-guard";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { access } = await requireBillingUser();

  const params = await searchParams;
  const status = parseBillingStatus(params.status);
  const choices = await requestChoicesFor(access);
  // Only a superadmin with several sites picks a site. HO and admin site are already scoped.
  const pickSite =
    access.siteId === null && access.locationId === null && choices.sites.length > 1;
  const siteId = parseRequestSite(params.site, pickSite ? choices.sites : []);
  const locations = requestLocationsFor(choices.locations, siteId, pickSite);
  // Only locations of the chosen site count, so a ?location= outside it is ignored.
  const locationId = parseRequestLocation(params.location, locations);
  const billings = await listBillings(access, {
    ...parsePageParams(params),
    status,
    siteId,
    locationId,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Bill the days worked at a location for a period.
        </p>
      </div>
      <BillingsDataTable
        data={billings}
        status={status}
        pickSite={pickSite}
        siteId={siteId}
        sites={choices.sites.map(({ id, name }) => ({ id, name }))}
        pickLocation={access.locationId === null}
        locationId={locationId}
        locations={locations.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
