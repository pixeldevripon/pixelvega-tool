import type { UserRole, UserStatus } from "@/types/auth";

export const roleLabels: Record<UserRole, string> = {
  SYSTEM_ADMIN: "System Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DESIGNER: "Designer",
  DEVELOPER: "Developer",
  CLIENT: "Client",
};

export const userRoles = Object.keys(roleLabels) as UserRole[];

export const assignableUserRoles = userRoles.filter(
  (role) => role !== "SYSTEM_ADMIN",
);

export const userStatuses: UserStatus[] = ["INVITED", "ACTIVE", "SUSPENDED"];
