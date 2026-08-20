import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/safe-redirect";

describe("safeRedirect", () => {
  it("allows the dashboard root", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
  });

  it("allows a path inside the dashboard, with its query string", () => {
    expect(safeRedirect("/dashboard/projects?status=ACTIVE&page=2")).toBe(
      "/dashboard/projects?status=ACTIVE&page=2",
    );
  });

  it("allows a fragment", () => {
    expect(safeRedirect("/dashboard/projects#members")).toBe(
      "/dashboard/projects#members",
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
  ])("falls back for %s", (_label, value) => {
    expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
  });

  describe("refuses anything that could leave this app", () => {
    it.each([
      ["an absolute URL", "https://evil.example/harvest"],
      ["a protocol-relative URL", "//evil.example/harvest"],
      ["a scheme-only prefix", "http://evil.example"],
      ["javascript:", "javascript:alert(1)"],
      ["a data URL", "data:text/html,<script>"],
      ["backslashes", "\\\\evil.example"],
      ["a mixed slash", "/\\evil.example"],
      ["a bare relative path", "dashboard/projects"],
    ])("%s", (_label, value) => {
      expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
    });

    it("a newline, which could split a header", () => {
      expect(safeRedirect("/dashboard\nLocation: https://evil.example")).toBe(
        DEFAULT_REDIRECT,
      );
    });

    it("a tab", () => {
      expect(safeRedirect("/dashboard\tx")).toBe(DEFAULT_REDIRECT);
    });
  });

  describe("refuses in-app paths outside the allowlist", () => {
    it.each([
      ["the sign-in page, which would loop", "/login"],
      ["a flow the user did not start", "/change-password"],
      ["profile setup", "/profile-setup"],
      ["the root", "/"],
    ])("%s", (_label, value) => {
      expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
    });

    it("a path that only starts with the allowed prefix as text", () => {
      // `/dashboardevil` shares a prefix with `/dashboard` but is a different
      // route, which is why the check is on a segment boundary.
      expect(safeRedirect("/dashboardevil")).toBe(DEFAULT_REDIRECT);
    });
  });
});
