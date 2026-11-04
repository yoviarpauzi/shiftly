"use client";

import * as React from "react";
import Image from "next/image";

import { NavMain } from "@/components/dashboard/nav-main";
import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavUser } from "@/components/dashboard/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  FolderTreeIcon,
  UsersIcon,
  Building2Icon,
  Settings2Icon,
  MapPinIcon,
  BriefcaseIcon,
  HardHatIcon,
  ClockIcon,
  ClipboardListIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
} from "lucide-react";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Site",
      url: "/dashboard/sites",
      icon: <Building2Icon />,
      roles: ["superadmin"],
    },
    {
      title: "Location",
      url: "/dashboard/locations",
      icon: <MapPinIcon />,
      roles: ["superadmin", "ho"],
    },
    {
      title: "Users",
      url: "/dashboard/users",
      icon: <UsersIcon />,
      roles: ["superadmin", "ho"],
    },
    {
      title: "Department",
      url: "/dashboard/departments",
      icon: <FolderTreeIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Position",
      url: "/dashboard/positions",
      icon: <BriefcaseIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Worker",
      url: "/dashboard/workers",
      icon: <HardHatIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Shift",
      url: "/dashboard/shifts",
      icon: <ClockIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Request",
      url: "/dashboard/requests",
      icon: <ClipboardListIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Roster",
      url: "/dashboard/rosters",
      icon: <CalendarDaysIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
    {
      title: "Attendance",
      url: "/dashboard/attendance",
      icon: <ClipboardCheckIcon />,
      roles: ["superadmin", "ho", "admin_site"],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <Settings2Icon />,
    },
  ],
};
export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
    avatar?: string | null;
    role?: string | null;
  };
}) {
  // An item without roles is shown to every signed-in user.
  const navMain = data.navMain.filter(
    (item) => !item.roles || item.roles.some((role) => role === user.role),
  );

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <Image
                src="/logo.webp"
                alt=""
                width={203}
                height={230}
                className="h-6 w-auto"
              />
              <span className="text-base font-semibold">Shiftly</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
