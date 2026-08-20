import { describe, expect, it } from "vitest";
import { extractApiMessage, humaneError } from "@/lib/api/humane-error";

describe("extractApiMessage", () => {
  it("reads a single string message", () => {
    expect(extractApiMessage({ message: "Project not found" })).toBe(
      "Project not found",
    );
  });

  it("joins the array class-validator produces for several broken rules", () => {
    expect(
      extractApiMessage({
        message: ["name should not be empty", "deadline must be a date"],
      }),
    ).toBe("name should not be empty deadline must be a date");
  });

  it("drops empty entries rather than leaving double spaces", () => {
    expect(extractApiMessage({ message: ["a", "", "b"] })).toBe("a b");
  });

  it("accepts a bare string body", () => {
    expect(extractApiMessage("Gateway timeout")).toBe("Gateway timeout");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["an object with no message", { statusCode: 500 }],
    ["a whitespace-only message", { message: "   " }],
    ["an empty array", { message: [] }],
    ["an empty string", ""],
  ])("returns null for %s", (_label, payload) => {
    expect(extractApiMessage(payload)).toBeNull();
  });
});

describe("humaneError", () => {
  it("prefers the API's own wording, because it is more specific than ours", () => {
    expect(
      humaneError(409, { message: "This project already has an open feedback round." }),
    ).toBe("This project already has an open feedback round.");
  });

  it("falls back to status copy when there is no message", () => {
    expect(humaneError(403)).toBe("You do not have permission to do that.");
  });

  it.each([
    [400, "Some of the details are not valid. Check the highlighted fields and try again."],
    [401, "Your session has ended. Sign in again to continue."],
    [404, "That item no longer exists. It may have been deleted or renamed."],
    [408, "The request took too long. Check your connection and try again."],
    [429, "Too many requests. Wait a moment and try again."],
    [500, "Something went wrong on our side. Try again in a moment."],
    [503, "The service is temporarily unavailable. Try again in a moment."],
  ])("maps %i to its own sentence", (status, expected) => {
    expect(humaneError(status)).toBe(expected);
  });

  it("treats status 0 as no server rather than a server error", () => {
    expect(humaneError(0)).toBe(
      "Cannot reach the server. Check your connection and try again.",
    );
  });

  it("points an unmapped 4xx at the request", () => {
    expect(humaneError(418)).toBe(humaneError(400));
  });

  it("apologises for an unmapped 5xx", () => {
    expect(humaneError(599)).toBe("Something went wrong. Try again in a moment.");
  });

  describe("rejects text that was written for a log, not a person", () => {
    it.each([
      ["an HTML error page", "<html><head><title>502 Bad Gateway</title></head>"],
      ["a stack frame", "TypeError: x is undefined\n    at handler (/app/dist/main.js:1:1)"],
      ["raw JSON", '{"code":"P2002","meta":{"target":["email"]}}'],
      ["a socket error", "connect ECONNREFUSED 127.0.0.1:5432"],
      ["a Prisma error name", "PrismaClientKnownRequestError: invalid invocation"],
    ])("%s", (_label, raw) => {
      expect(humaneError(502, { message: raw })).toBe(
        "The server is unreachable. Try again in a moment.",
      );
    });

    it("a message too long to be a sentence", () => {
      const wall = "detail ".repeat(100);
      expect(humaneError(500, { message: wall })).toBe(
        "Something went wrong on our side. Try again in a moment.",
      );
    });
  });

  it("keeps a long-but-plausible validation message under the length bound", () => {
    const message = [
      "name must be shorter than or equal to 120 characters",
      "deadline must be a valid ISO 8601 date string",
      "estimatedHours must not be less than 0",
    ];
    expect(humaneError(400, { message })).toBe(message.join(" "));
  });
});
