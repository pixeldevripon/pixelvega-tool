import {
  CalendarCheck,
  ClipboardCheck,
  AlertTriangle,
  FileClock,
  FolderKanban,
  LayoutDashboard,
  BarChart3,
  Settings,
  UserCircle,
  Users,
  UserPlus,
} from "lucide-react";
import type { UserRole } from "@/types/auth";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  children?: DashboardNavItem[];
};

const adminNavItems: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    children: [
      { label: "All users", href: "/dashboard/users", icon: Users },
      {
        label: "Create new user",
        href: "/dashboard/users/create",
        icon: UserPlus,
      },
    ],
  },
  { label: "Audit logs", href: "/dashboard/audit-logs", icon: FileClock },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Blockers", href: "/dashboard/blockers", icon: AlertTriangle },
  { label: "Standups", href: "/dashboard/standups", icon: ClipboardCheck },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Leave", href: "/dashboard/leave", icon: CalendarCheck },
  { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const dashboardNav = {
  SYSTEM_ADMIN: adminNavItems,
  ADMIN: adminNavItems,
  PROJECT_MANAGER: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Blockers", href: "/dashboard/blockers", icon: AlertTriangle },
    { label: "Standups", href: "/dashboard/standups", icon: ClipboardCheck },
    { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { label: "Leave", href: "/dashboard/leave", icon: CalendarCheck },
    { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
  DESIGNER: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Blockers", href: "/dashboard/blockers", icon: AlertTriangle },
    { label: "Standups", href: "/dashboard/standups", icon: ClipboardCheck },
    { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { label: "Leave", href: "/dashboard/leave", icon: CalendarCheck },
    { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
  DEVELOPER: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Blockers", href: "/dashboard/blockers", icon: AlertTriangle },
    { label: "Standups", href: "/dashboard/standups", icon: ClipboardCheck },
    { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { label: "Leave", href: "/dashboard/leave", icon: CalendarCheck },
    { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
  CLIENT: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
} satisfies Record<UserRole, DashboardNavItem[]>;
