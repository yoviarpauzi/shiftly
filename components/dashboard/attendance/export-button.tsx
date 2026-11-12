import { DownloadIcon } from "lucide-react";
import type { AttendanceExportButtonProps } from "@/types/attendance-export";
import { Button } from "@/components/ui/button";

// Downloads the week's printable forms as Excel. It is a link, so the browser downloads the file the
// route builds. While no single location is chosen there is nothing to export, so it is disabled.
export function AttendanceExportButton({ href }: AttendanceExportButtonProps) {
  if (!href) {
    return (
      <Button type="button" variant="outline" disabled>
        <DownloadIcon data-icon="inline-start" />
        Export Excel
      </Button>
    );
  }

  return (
    <Button variant="outline" render={<a href={href} download />} nativeButton={false}>
      <DownloadIcon data-icon="inline-start" />
      Export Excel
    </Button>
  );
}
