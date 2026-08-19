import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { PasswordChangePrompt } from "@/components/dashboard/password-change-prompt";
import { ProfileSetupPrompt } from "@/components/dashboard/profile-setup-prompt";

export default function DashboardPage() {
  return (
    <>
      <PasswordChangePrompt />
      <ProfileSetupPrompt />
      <DashboardOverview />
    </>
  );
}
