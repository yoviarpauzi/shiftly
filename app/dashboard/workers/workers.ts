import "server-only";
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { notFound } from "next/navigation";
import { loadEngineRules } from "@/app/dashboard/rosters/roster-work-rules";
import { DEFAULT_WORK_DAYS } from "@/app/dashboard/settings/settings-rules";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SiteChoice } from "@/types/locations";
import type { SortCriterion } from "@/types/sort";
import type { WorkerDetail } from "@/types/worker-history";
import type {
  WorkerAccess,
  WorkerFormOptions,
  WorkerListParams,
  WorkerPage,
  WorkerPositionTag,
  WorkerSortColumn,
} from "@/types/workers";

const DEFAULT_SORT: SortCriterion<WorkerSortColumn>[] = [
  { column: "site", direction: "asc" },
  { column: "location", direction: "asc" },
  { column: "name", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const WORKER_SORT_EXPRESSIONS: Record<WorkerSortColumn, SQLWrapper> = {
  employeeId: sql`lower(${worker.employeeId})`,
  name: sql`lower(${worker.name})`,
  site: site.name,
  location: location.name,
  status: sql`(${worker.deletedAt} is not null)`,
};

// Superadmin sees every worker. HO sees its site. Admin site sees its location.
export function workerScopeFilter(access: WorkerAccess): SQL | undefined {
  return and(
    access.siteId ? eq(worker.siteId, access.siteId) : undefined,
    access.locationId ? eq(worker.locationId, access.locationId) : undefined,
  );
}

export const CONTRACT_ENDING_DAYS = 30;

// Active workers whose contract ends from today to CONTRACT_ENDING_DAYS later. Today is read in the
// time zone of the worker's location. A scalar subquery supplies it, so a query on the worker table
// alone (the count) needs no join.
export function contractEndingFilter(): SQL {
  const today = sql`(select (timezone(${location.timezone}, now()))::date from ${location} where ${location.id} = ${worker.locationId})`;
  const last = sql`(${today} + ${sql.raw(`interval '${CONTRACT_ENDING_DAYS} days'`)})::date`;

  return sql`(${isNull(worker.deletedAt)} and ${worker.endContract} >= ${today} and ${worker.endContract} <= ${last})`;
}

// Matches name or employee ID case-insensitively. An empty query matches every worker in the status.
// The site and location filters narrow inside the scope, so they can never widen it.
function workerFilter(
  access: WorkerAccess,
  { query, status, siteId, locationId, positionId, ending }: Pick<
    WorkerListParams,
    "query" | "status" | "siteId" | "locationId" | "positionId" | "ending"
  >,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    workerScopeFilter(access),
    status === "active" ? isNull(worker.deletedAt) : undefined,
    status === "deleted" ? isNotNull(worker.deletedAt) : undefined,
    siteId ? eq(worker.siteId, siteId) : undefined,
    locationId ? eq(worker.locationId, locationId) : undefined,
    // exists, not a join, so a worker is counted once however many positions it has.
    positionId
      ? exists(
          db
            .select({ one: sql`1` })
            .from(workerPosition)
            .where(
              and(
                eq(workerPosition.workerId, worker.id),
                eq(workerPosition.positionId, positionId),
              ),
            ),
        )
      : undefined,
    ending ? contractEndingFilter() : undefined,
    query ? or(ilike(worker.name, pattern), ilike(worker.employeeId, pattern)) : undefined,
  );
}

export async function listWorkers(
  access: WorkerAccess,
  { page, pageSize, query, status, siteId, locationId, positionId, ending, sort }: WorkerListParams,
): Promise<WorkerPage> {
  const filter = workerFilter(access, {
    query,
    status,
    siteId,
    locationId,
    positionId,
    ending,
  });
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the worker table alone, so the joins do not inflate the total.
  const [{ total }] = await db.select({ total: count() }).from(worker).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: worker.id,
      employeeId: worker.employeeId,
      name: worker.name,
      siteId: worker.siteId,
      siteName: site.name,
      locationId: worker.locationId,
      locationName: location.name,
      endContract: worker.endContract,
      workDaysPerWeek: worker.workDaysPerWeek,
      deletedAt: worker.deletedAt,
    })
    .from(worker)
    .innerJoin(site, eq(site.id, worker.siteId))
    .innerJoin(location, eq(location.id, worker.locationId))
    .where(filter)
    .orderBy(...sortTerms(criteria, WORKER_SORT_EXPRESSIONS), asc(worker.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const tags = await positionTagsFor(rows.map((row) => row.id));

  return {
    rows: rows.map((row) => ({ ...row, positions: tags.get(row.id) ?? [] })),
    total,
    page: currentPage,
    pageSize,
  };
}

// Positions of the given workers, in one query. A deleted position is not shown.
async function positionTagsFor(workerIds: string[]): Promise<Map<string, WorkerPositionTag[]>> {
  const tags = new Map<string, WorkerPositionTag[]>();

  if (workerIds.length === 0) {
    return tags;
  }

  const assigned = await db
    .select({ workerId: workerPosition.workerId, id: position.id, name: position.name })
    .from(workerPosition)
    .innerJoin(position, eq(position.id, workerPosition.positionId))
    .where(and(inArray(workerPosition.workerId, workerIds), isNull(position.deletedAt)))
    .orderBy(asc(position.name), asc(position.id));

  for (const item of assigned) {
    const list = tags.get(item.workerId) ?? [];

    list.push({ id: item.id, name: item.name });
    tags.set(item.workerId, list);
  }

  return tags;
}

// One worker for the detail page. The scope is part of the query, so a worker outside it gives null,
// the same as a missing one. A deleted worker is returned: its history outlives the delete. The
// working days are the worker's own, else the work rule that applies to its location.
export async function getWorkerDetail(
  access: WorkerAccess,
  id: string,
): Promise<WorkerDetail | null> {
  const [row] = await db
    .select({
      id: worker.id,
      employeeId: worker.employeeId,
      name: worker.name,
      siteId: worker.siteId,
      siteName: site.name,
      locationId: worker.locationId,
      locationName: location.name,
      timezone: location.timezone,
      endContract: worker.endContract,
      workDaysPerWeek: worker.workDaysPerWeek,
      deletedAt: worker.deletedAt,
    })
    .from(worker)
    .innerJoin(site, eq(site.id, worker.siteId))
    .innerJoin(location, eq(location.id, worker.locationId))
    .where(and(eq(worker.id, id), workerScopeFilter(access)));

  if (!row) {
    return null;
  }

  // The work rules are only read when the worker has no value of its own, and together with the
  // positions, so the page waits for one round trip instead of five.
  const [tags, ruleDays] = await Promise.all([
    positionTagsFor([row.id]),
    row.workDaysPerWeek === null
      ? loadEngineRules(db, { locationId: row.locationId, siteId: row.siteId }).then(
          (rules) => rules.workDaysPerWeek,
        )
      : Promise.resolve(null),
  ]);

  return {
    ...row,
    positions: tags.get(row.id) ?? [],
    workDays: row.workDaysPerWeek ?? ruleDays ?? DEFAULT_WORK_DAYS,
  };
}

// HO and admin site get their own site as fixed text. Superadmin picks from the active sites.
async function workerSiteChoiceFor(access: WorkerAccess): Promise<SiteChoice> {
  if (access.siteId) {
    const [own] = await db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(and(eq(site.id, access.siteId), isNull(site.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", site: own };
  }

  const sites = await db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(isNull(site.deletedAt))
    .orderBy(asc(site.name), asc(site.id));

  return { mode: "pick", sites };
}

// Active sites, locations, and positions the actor may assign. The form filters locations and
// positions by the chosen site. The server checks the same rules again when it saves.
export async function workerFormOptionsFor(access: WorkerAccess): Promise<WorkerFormOptions> {
  const siteChoice = await workerSiteChoiceFor(access);

  const locations = await db
    .select({ id: location.id, siteId: location.siteId, name: location.name })
    .from(location)
    .where(
      and(
        isNull(location.deletedAt),
        access.siteId ? eq(location.siteId, access.siteId) : undefined,
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    )
    .orderBy(asc(location.name), asc(location.id));

  const positions = await db
    .select({ id: position.id, siteId: position.siteId, name: position.name })
    .from(position)
    .where(
      and(isNull(position.deletedAt), access.siteId ? eq(position.siteId, access.siteId) : undefined),
    )
    .orderBy(asc(position.name), asc(position.id));

  return { siteChoice, locations, positions };
}
