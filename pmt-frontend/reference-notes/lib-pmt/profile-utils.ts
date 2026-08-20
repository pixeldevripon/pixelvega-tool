import type { UserProfile } from "@/types/auth";

export function getProfilePhone(profile: UserProfile | null) {
  if (!profile) return null;
  return profile.clientProfile?.phone ?? profile.employeeProfile?.phone ?? null;
}

export function getProfileTitle(profile: UserProfile | null) {
  if (!profile) return null;
  if (profile.role === "CLIENT") {
    return profile.clientProfile?.companyName ?? null;
  }
  return profile.employeeProfile?.designation ?? null;
}

export function isProfileComplete(profile: UserProfile | null) {
  if (!profile) return false;

  if (profile.role === "CLIENT") {
    return Boolean(
      profile.clientProfile?.companyName &&
        profile.clientProfile?.billingEmail &&
        profile.clientProfile?.phone,
    );
  }

  return Boolean(
    profile.employeeProfile?.designation &&
      profile.employeeProfile?.phone &&
      profile.employeeProfile?.timezone,
  );
}
