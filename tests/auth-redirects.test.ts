import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "@/lib/auth-redirects";

describe("auth redirect logic", () => {
  it("redirects unauthenticated dashboard requests to login", () => {
    expect(getAuthRedirect("/dashboard", false)).toBe("/login");
    expect(getAuthRedirect("/dashboard/reviews", false)).toBe("/login");
  });

  it("redirects authenticated login and signup requests to dashboard", () => {
    expect(getAuthRedirect("/login", true)).toBe("/dashboard");
    expect(getAuthRedirect("/signup", true)).toBe("/dashboard");
  });

  it("allows valid route/auth combinations", () => {
    expect(getAuthRedirect("/dashboard", true)).toBeNull();
    expect(getAuthRedirect("/login", false)).toBeNull();
    expect(getAuthRedirect("/", false)).toBeNull();
  });
});
