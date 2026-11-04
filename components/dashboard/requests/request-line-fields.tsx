"use client";

import { Trash2Icon } from "lucide-react";
import type { RequestLineFieldsProps } from "@/types/requests";
import {
  lineAfterDayChange,
  lineAfterDepartmentChange,
  lineAfterPerDayToggle,
} from "@/app/dashboard/requests/request-form-options";
import { shiftOptionLabel } from "@/app/dashboard/requests/request-form-options";
import { dayLabels } from "@/app/dashboard/requests/request-rules";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_SUB_DEPARTMENT = "None";

const ANY_SHIFT = "Any shift";

// An empty or non-numeric field becomes NaN, so the schema reports it instead of reading 0.
function numberFromInput(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

function inputFromNumber(value: number): number | "" {
  return Number.isNaN(value) ? "" : value;
}

// One row of the lines section. The parent array field owns the value and its errors.
export function RequestLineFields({
  index,
  line,
  type,
  startDate,
  departments,
  subDepartments,
  positions,
  shifts,
  disabled,
  canRemove,
  showRemove,
  onChange,
  onRemove,
}: RequestLineFieldsProps) {
  const id = (part: string) => `lines-${index}-${part}`;
  const rowLabel = `Line ${index + 1}`;
  const isWeekly = type === "weekly";
  // A weekly line set per day sends the day numbers, so the single number is not used meanwhile.
  const usesDays = isWeekly && line.perDay;

  return (
    <div
      role="group"
      aria-label={rowLabel}
      className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_auto] lg:items-end"
    >
      <Field>
        <FieldLabel htmlFor={id("department")}>Department</FieldLabel>
        <Select
          value={line.departmentId || null}
          onValueChange={(value) => {
            if (value) {
              onChange(lineAfterDepartmentChange(line, value));
            }
          }}
          items={departments.map((row) => ({ value: row.id, label: row.name }))}
          disabled={disabled}
        >
          <SelectTrigger id={id("department")} className="w-full">
            <SelectValue placeholder="Choose a department" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {departments.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={id("sub-department")}>Sub-department</FieldLabel>
        <Select
          value={line.subDepartmentId}
          onValueChange={(value) => onChange({ ...line, subDepartmentId: value ?? null })}
          items={[
            { value: null, label: NO_SUB_DEPARTMENT },
            ...subDepartments.map((row) => ({ value: row.id, label: row.name })),
          ]}
          disabled={disabled || subDepartments.length === 0}
        >
          <SelectTrigger id={id("sub-department")} className="w-full">
            <SelectValue placeholder={NO_SUB_DEPARTMENT} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={null}>{NO_SUB_DEPARTMENT}</SelectItem>
              {subDepartments.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={id("position")}>Position</FieldLabel>
        <Select
          value={line.positionId || null}
          onValueChange={(value) => {
            if (value) {
              onChange({ ...line, positionId: value });
            }
          }}
          items={positions.map((row) => ({ value: row.id, label: row.name }))}
          disabled={disabled}
        >
          <SelectTrigger id={id("position")} className="w-full">
            <SelectValue placeholder="Choose a position" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {positions.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={id("shift")}>Shift</FieldLabel>
        <Select
          value={line.shiftId}
          onValueChange={(value) => onChange({ ...line, shiftId: value ?? null })}
          items={[
            { value: null, label: ANY_SHIFT },
            ...shifts.map((row) => ({ value: row.id, label: shiftOptionLabel(row) })),
          ]}
          disabled={disabled}
        >
          <SelectTrigger id={id("shift")} className="w-full">
            <SelectValue placeholder={ANY_SHIFT} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={null}>{ANY_SHIFT}</SelectItem>
              {shifts.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {shiftOptionLabel(row)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={id("headcount")}>Headcount</FieldLabel>
        <Input
          id={id("headcount")}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={inputFromNumber(line.headcount)}
          onChange={(event) =>
            onChange({ ...line, headcount: numberFromInput(event.target.value) })
          }
          disabled={disabled || usesDays}
        />
      </Field>
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="justify-self-end"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label={`Remove ${rowLabel.toLowerCase()}`}
        >
          <Trash2Icon />
        </Button>
      )}
      {isWeekly && (
        <div className="col-span-full flex flex-col gap-3">
          <Field orientation="horizontal">
            <Checkbox
              id={id("per-day")}
              checked={line.perDay}
              onCheckedChange={(checked) => onChange(lineAfterPerDayToggle(line, checked))}
              disabled={disabled}
            />
            <FieldLabel htmlFor={id("per-day")} className="font-normal">
              Set headcount per day
            </FieldLabel>
          </Field>
          {line.perDay && (
            <div
              role="group"
              aria-label={`${rowLabel} headcount per day`}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
            >
              {dayLabels(startDate).map((label, dayIndex) => (
                <Field key={dayIndex}>
                  <FieldLabel htmlFor={id(`day-${dayIndex}`)}>{label}</FieldLabel>
                  <Input
                    id={id(`day-${dayIndex}`)}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    step={1}
                    value={inputFromNumber(line.dayHeadcounts[dayIndex])}
                    onChange={(event) =>
                      onChange(
                        lineAfterDayChange(line, dayIndex, numberFromInput(event.target.value)),
                      )
                    }
                    disabled={disabled}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
