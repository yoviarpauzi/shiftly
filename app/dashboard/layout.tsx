import { Suspense } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Header } from "@/components/dashboard/header";
import { ShellSkeleton } from "@/components/dashboard/shell-skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { requireUser } from "@/lib/session";

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={{
          name: user.name,
          email: user.email,
          avatar: user.image,
          role: user.role,
        }}
      />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
