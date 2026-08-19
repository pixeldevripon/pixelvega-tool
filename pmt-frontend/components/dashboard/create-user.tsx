"use client";

import { useRouter } from "next/navigation";
import { MailPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userStore } from "@/lib/api/user-store";
import { usersApi } from "@/lib/api/users";
import { assignableUserRoles, roleLabels } from "@/lib/auth-meta";
import type { UserRole } from "@/types/auth";

export function CreateUser() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("PROJECT_MANAGER");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const user = await usersApi.invite({ email, name, role });
      userStore.upsertUser(user);
      toast.success("Invitation sent", {
        description: `${user.email} was invited to the workspace.`,
      });
      setEmail("");
      setName("");
      setRole("PROJECT_MANAGER");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to invite user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Create new user
        </h1>
        <p className="mt-2 max-w-2xl text-base font-medium text-muted-foreground">
          Create a user with an email and role. The system will generate and
          email a random initial password; no invitation link is used.
        </p>
      </section>

      <section className="max-w-3xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <form className="space-y-5" onSubmit={handleInvite}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold">Full name</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sarah Mitchell"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Role</label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {assignableUserRoles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>
              <MailPlus size={18} />
              {isSubmitting ? "Sending..." : "Send invitation"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/users")}
            >
              View all users
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
