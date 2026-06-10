export type AuthRoute = "/dashboard" | "/login" | "/signup" | string;

export function getAuthRedirect(pathname: AuthRoute, isAuthenticated: boolean): string | null {
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    return "/login";
  }

  if ((pathname === "/login" || pathname === "/signup") && isAuthenticated) {
    return "/dashboard";
  }

  return null;
}
