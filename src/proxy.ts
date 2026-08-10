import { withAuth } from "next-auth/middleware";

const protectedRoutes = [
  "/dashboard",
  "/workspace",
  "/approvals",
  "/members",
  "/leads",
  "/calls",
  "/followups",
  "/reports",
  "/services",
  "/team",
];

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const pathname = req.nextUrl.pathname;

      if (
        protectedRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        )
      ) {
        return token !== null;
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/approvals/:path*",
    "/members/:path*",
    "/leads/:path*",
    "/calls/:path*",
    "/followups/:path*",
    "/reports/:path*",
    "/services/:path*",
    "/team/:path*",
    "/api/((?!auth).*)",
  ],
};
