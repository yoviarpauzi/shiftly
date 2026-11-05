import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLongDay } from "@/app/dashboard/(dashboard)/dashboard-rules";
import type { AttendanceTableProps } from "@/types/dashboard";

export function AttendanceTable({ series }: AttendanceTableProps) {
  const rows = [...series].reverse();

  return (
    <Table>
      <TableCaption className="sr-only">
        Workers present and not present per day, newest day first
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Present</TableHead>
          <TableHead className="text-right">Not present</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((point) => (
          <TableRow key={point.date}>
            <TableCell className="whitespace-nowrap">{formatLongDay(point.date)}</TableCell>
            <TableCell className="text-right tabular-nums">{point.present}</TableCell>
            <TableCell className="text-right tabular-nums">{point.notPresent}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
