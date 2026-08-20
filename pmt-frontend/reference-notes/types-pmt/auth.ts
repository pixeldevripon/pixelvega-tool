export type UserRole =
  | "SYSTEM_ADMIN"
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "DESIGNER"
  | "DEVELOPER"
  | "CLIENT";

export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export type EmployeeWorkStatus = "WORKING" | "ON_LEAVE";

export type AvailabilityStatus = "AVAILABLE" | "BUSY" | "UNAVAILABLE";

export type EmployeeProfile = {
  id: string;
  userId: string;
  designation?: string | null;
  phone?: string | null;
  timezone?: string | null;
  bio?: string | null;
  currentStatus: EmployeeWorkStatus;
  availabilityStatus: AvailabilityStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientProfile = {
  id: string;
  userId: string;
  companyName?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  timezone?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  employeeProfile?: EmployeeProfile | null;
  clientProfile?: ClientProfile | null;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustResetPassword: boolean;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  slackUserId?: string | null;
  avatarUrl?: string;
  invitedAt?: string;
  lastActiveAt?: string;
};

export type LoginResult = {
  user: AppUser;
  requiresPasswordChange: boolean;
};

export type InviteUserInput = {
  email: string;
  role: UserRole;
  name?: string;
};
