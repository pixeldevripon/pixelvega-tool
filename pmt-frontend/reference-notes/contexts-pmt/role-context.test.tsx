import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoleProvider, usePermissions } from "@/contexts/role-context";

/**
 * A probe that renders the whole context as text, so a test asserts what a
 * component would actually see rather than poking at internals.
 */
function Probe() {
  const { role, isLoaded, isError, can, canAll, canAny } = usePermissions();
  return (
    <ul>
      <li data-testid="role">{role?.label ?? "none"}</li>
      <li data-testid="loaded">{String(isLoaded)}</li>
      <li data-testid="error">{String(isError)}</li>
      <li data-testid="can-edit">{String(can("EDIT_PROJECT"))}</li>
      <li data-testid="can-delete-user">{String(can("DELETE_USER"))}</li>
      <li data-testid="can-all">
        {String(canAll("EDIT_PROJECT", "VIEW_ALL_PROJECTS"))}
      </li>
      <li data-testid="can-all-missing">
        {String(canAll("EDIT_PROJECT", "DELETE_USER"))}
      </li>
      <li data-testid="can-any">{String(canAny("DELETE_USER", "EDIT_PROJECT"))}</li>
      <li data-testid="can-any-none">
        {String(canAny("DELETE_USER", "MANAGE_HOLIDAYS"))}
      </li>
    </ul>
  );
}

function renderWithProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <Probe />
      </RoleProvider>
    </QueryClientProvider>,
  );
}

function mockPermissions(body: unknown, status = 200) {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RoleProvider", () => {
  it("grants exactly what the API returned and nothing else", async () => {
    mockPermissions({
      role: { value: "PROJECT_MANAGER", label: "Project Manager", tone: "primary" },
      permissions: ["EDIT_PROJECT", "VIEW_ALL_PROJECTS"],
    });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loaded")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("can-edit")).toHaveTextContent("true");
    expect(screen.getByTestId("can-delete-user")).toHaveTextContent("false");
  });

  it("exposes the role for display, as the label the server sent", async () => {
    mockPermissions({
      role: { value: "PROJECT_MANAGER", label: "Project Manager", tone: "primary" },
      permissions: [],
    });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("Project Manager"),
    );
  });

  it("calls the permissions endpoint, not a role lookup", async () => {
    mockPermissions({ role: null, permissions: [] });

    renderWithProvider();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe("http://localhost:5050/api/users/me/permissions");
  });

  describe("canAll", () => {
    it("is true only when every permission is held", async () => {
      mockPermissions({
        role: { value: "ADMIN", label: "Admin", tone: "primary" },
        permissions: ["EDIT_PROJECT", "VIEW_ALL_PROJECTS"],
      });

      renderWithProvider();

      await waitFor(() =>
        expect(screen.getByTestId("can-all")).toHaveTextContent("true"),
      );
      expect(screen.getByTestId("can-all-missing")).toHaveTextContent("false");
    });
  });

  describe("canAny", () => {
    it("is true when one is held and false when none are", async () => {
      mockPermissions({
        role: { value: "DEVELOPER", label: "Developer", tone: "default" },
        permissions: ["EDIT_PROJECT"],
      });

      renderWithProvider();

      await waitFor(() =>
        expect(screen.getByTestId("can-any")).toHaveTextContent("true"),
      );
      expect(screen.getByTestId("can-any-none")).toHaveTextContent("false");
    });
  });

  it("denies everything while the set is still loading", () => {
    // No await: this asserts the very first render, before the fetch resolves.
    mockPermissions({ role: null, permissions: ["EDIT_PROJECT"] });

    renderWithProvider();

    expect(screen.getByTestId("loaded")).toHaveTextContent("false");
    expect(screen.getByTestId("can-edit")).toHaveTextContent("false");
  });

  it("denies everything and reports the failure when the request fails", async () => {
    mockPermissions({ message: "Unauthorized" }, 401);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("can-edit")).toHaveTextContent("false");
    expect(screen.getByTestId("loaded")).toHaveTextContent("false");
  });
});

describe("usePermissions outside a provider", () => {
  it("denies everything rather than throwing", () => {
    render(<Probe />);

    expect(screen.getByTestId("loaded")).toHaveTextContent("false");
    expect(screen.getByTestId("can-edit")).toHaveTextContent("false");
    expect(screen.getByTestId("can-any")).toHaveTextContent("false");
    expect(screen.getByTestId("role")).toHaveTextContent("none");
  });
});
