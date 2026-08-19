"use client";

import {
  BriefcaseBusiness,
  Building2,
  Camera,
  Clock,
  Mail,
  Phone,
  Upload,
  UserRound,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { profilesApi, type UpdateProfileInput } from "@/lib/api/profiles";
import { userStore } from "@/lib/api/user-store";
import { getProfilePhone, getProfileTitle, isProfileComplete } from "@/lib/profile-utils";
import { roleLabels } from "@/lib/auth-meta";
import type { UserProfile } from "@/types/auth";

export function ProfileView() {
  const { currentUser, loadingCurrentUser, error: storeError } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void userStore.loadCurrentUser();
  }, []);

  useEffect(() => {
    let active = true;

    void profilesApi
      .me()
      .then((result) => {
        if (!active) return;
        setProfile(result);
      })
      .catch((error) => {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Unable to load profile.");
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !profile) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("Full name is required.");
      return;
    }

    const input: UpdateProfileInput =
      currentUser.role === "CLIENT"
        ? {
            name,
            companyName: String(formData.get("companyName") ?? ""),
            billingEmail: String(formData.get("billingEmail") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            timezone: String(formData.get("timezone") ?? ""),
          }
        : {
            name,
            designation: String(formData.get("designation") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            timezone: String(formData.get("timezone") ?? ""),
            bio: String(formData.get("bio") ?? ""),
            currentStatus: String(
              formData.get("currentStatus") ?? "WORKING",
            ) as UpdateProfileInput["currentStatus"],
            availabilityStatus: String(
              formData.get("availabilityStatus") ?? "AVAILABLE",
            ) as UpdateProfileInput["availabilityStatus"],
          };

    setIsSaving(true);
    setError("");

    try {
      const updatedProfile = await profilesApi.updateMe(input);
      setProfile(updatedProfile);
      userStore.upsertUser({
        ...currentUser,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        avatarUrl: updatedProfile.avatarUrl ?? undefined,
      });
      toast.success("Profile updated", {
        description: "Your workspace profile details were saved.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploadingAvatar(true);
    setError("");

    try {
      const updatedProfile = await profilesApi.uploadAvatar(file);
      setProfile(updatedProfile);
      userStore.upsertUser({
        ...currentUser,
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        avatarUrl: updatedProfile.avatarUrl ?? undefined,
      });
      toast.success("Profile image updated", {
        description: "Your avatar is now visible on your profile.",
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to upload profile image.",
      );
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  if (!currentUser || isLoadingProfile) {
    return (
      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="mx-auto h-28 w-28 rounded-full" />
          <Skeleton className="mx-auto mt-5 h-5 w-36" />
          <Skeleton className="mx-auto mt-3 h-4 w-28" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-44" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <p className="mt-5 text-sm font-semibold text-muted-foreground">
            {loadingCurrentUser || isLoadingProfile
              ? "Loading profile..."
              : storeError ?? "Unable to load profile."}
          </p>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error || storeError || "Unable to load profile."}
        </AlertDescription>
      </Alert>
    );
  }

  const employeeProfile = profile.employeeProfile;
  const clientProfile = profile.clientProfile;
  const complete = isProfileComplete(profile);
  const profileTitle = getProfileTitle(profile);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-2 text-base font-medium text-muted-foreground">
          Update your workspace identity and contact information.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <Avatar className="mx-auto h-28 w-28 border border-border">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt={`${profile.name} profile`} />
            <AvatarFallback>
              <Camera size={36} />
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-5 text-xl font-extrabold">{profile.name}</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {profileTitle ?? roleLabels[currentUser.role]}
          </p>
          <div className="mt-4">
            <Badge tone={complete ? "success" : "warning"}>
              {complete ? "Profile ready" : "Setup recommended"}
            </Badge>
          </div>
          <label className="mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold transition hover:bg-muted">
            <Upload size={17} />
            {isUploadingAvatar ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={isUploadingAvatar}
              onChange={uploadAvatar}
            />
          </label>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            JPG, PNG, or WebP. Max 5MB.
          </p>
        </div>

        <form
          key={currentUser.id}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
          onSubmit={saveProfile}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <UserRound size={17} />
                Full name
              </label>
              <Input
                name="name"
                defaultValue={profile.name}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <Mail size={17} />
                Email
              </label>
              <Input value={currentUser.email} disabled />
            </div>
            {currentUser.role === "CLIENT" ? (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <Building2 size={17} />
                    Company name
                  </label>
                  <Input
                    name="companyName"
                    defaultValue={clientProfile?.companyName ?? ""}
                    placeholder="Client company"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <Mail size={17} />
                    Billing email
                  </label>
                  <Input
                    name="billingEmail"
                    type="email"
                    defaultValue={clientProfile?.billingEmail ?? ""}
                    placeholder="billing@company.com"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <BriefcaseBusiness size={17} />
                    Designation
                  </label>
                  <Input
                    name="designation"
                    defaultValue={employeeProfile?.designation ?? ""}
                    placeholder="Frontend Developer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <Clock size={17} />
                    Current status
                  </label>
                  <Select
                    name="currentStatus"
                    defaultValue={employeeProfile?.currentStatus ?? "WORKING"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Current status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WORKING">Working</SelectItem>
                      <SelectItem value="ON_LEAVE">On leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <UserRound size={17} />
                    Availability
                  </label>
                  <Select
                    name="availabilityStatus"
                    defaultValue={
                      employeeProfile?.availabilityStatus ?? "AVAILABLE"
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">Available</SelectItem>
                      <SelectItem value="BUSY">Busy</SelectItem>
                      <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <Phone size={17} />
                Phone
              </label>
              <Input
                name="phone"
                defaultValue={getProfilePhone(profile) ?? ""}
                placeholder="+1 555 0123"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <Clock size={17} />
                Timezone
              </label>
              <Input
                name="timezone"
                defaultValue={
                  clientProfile?.timezone ?? employeeProfile?.timezone ?? ""
                }
                placeholder="Asia/Dhaka"
              />
            </div>
            {currentUser.role !== "CLIENT" ? (
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <UserRound size={17} />
                  Bio
                </label>
                <Textarea
                  name="bio"
                  defaultValue={employeeProfile?.bio ?? ""}
                  placeholder="Short team-facing bio"
                  className="min-h-28"
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-5">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
