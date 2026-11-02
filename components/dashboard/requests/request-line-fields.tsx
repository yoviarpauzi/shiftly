"use client";

import { Trash2Icon } from "lucide-react";
import type { RequestLineFieldsProps } from "@/types/requests";
import { lineAfterDepartmentChange } from "@/app/dashboard/requests/request-form-options";
import { Button } from "@/components/ui/button";
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

// One row of the lines section. The parent array field owns the value and its errors.
export function RequestLineFields({
  index,
  line,
  departments,
  subDepartments,
  positions,
  disabled,
  canRemove,
  showRemove,
  onChange,
  onRemove,
}: RequestLineFieldsProps) {
  const id = (part: string) => `lines-${index}-${part}`;
  const rowLabel = `Line ${index + 1}`;

  return (
    <div
      role="group"
      aria-label={rowLabel}
      className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_auto] lg:items-end"
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
        <FieldLabel htmlFor={id("headcount")}>Headcount</FieldLabel>
        <Input
          id={id("headcount")}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={Number.isNaN(line.headcount) ? "" : line.headcount}
          onChange={(event) =>
            onChange({
              ...line,
              headcount: event.target.value === "" ? Number.NaN : Number(event.target.value),
            })
          }
          disabled={disabled}
         
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
    </div>
  );
}
