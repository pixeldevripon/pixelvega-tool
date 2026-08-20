import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/components/settings/settings-view";

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsView />
    </QueryClientProvider>,
  );
}

function mockUser(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

const USER = {
  id: "u1",
  email: "developer@pixelvega.com",
  name: "Jabed Hossain",
  role: { value: "DEVELOPER", label: "Developer", tone: "default" },
  status: { value: "ACTIVE", label: "Active", tone: "success" },
  slackUserId: null,
  mustResetPassword: false,
  createdById: null,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-19T14:32:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsView", () => {
  it("shows a skeleton before the account arrives, not an error", () => {
    mockUser(USER);
    renderView();

    // No heading yet, and nothing claiming the load failed.
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
    expect(screen.queryByText(/unavailable/i)).toBeNull();
  });

  it("reads the account from GET /api/users/me", async () => {
    mockUser(USER);
    renderView();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "http://localhost:5050/api/users/me",
    );
  });

  it("reports a password that has been set, with no warning", async () => {
    mockUser(USER);
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Password set")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Temporary password still active")).toBeNull();
  });

  it("warns while an invited user is still on a temporary password", async () => {
    mockUser({ ...USER, mustResetPassword: true });
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Temporary password")).toBeInTheDocument(),
    );
    expect(screen.getByText("Temporary password still active")).toBeInTheDocument();
  });

  it("offers changing the password as a real link, so it can be opened in a tab", async () => {
    mockUser(USER);
    renderView();

    const link = await waitFor(() =>
      screen.getByRole("link", { name: /change password/i }),
    );
    expect(link).toHaveAttribute("href", "/change-password");
  });

  it("shows the API's own message when the request fails", async () => {
    mockUser({ message: "Your account is no longer active." }, 403);
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Your account is no longer active.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Settings unavailable")).toBeInTheDocument();
  });

  it("shows a humane sentence rather than raw text when the server returns markup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<html><body>502 Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
        ),
      ),
    );
    renderView();

    await waitFor(() =>
      expect(
        screen.getByText("The server is unreachable. Try again in a moment."),
      ).toBeInTheDocument(),
    );
  });
});
