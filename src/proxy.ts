import { withAuth } from "next-auth/middleware";

const protectedRoutes = [
  "/dashboard",
  "/members",
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
    "/members/:path*",
    "/calls/:path*",
    "/followups/:path*",
    "/reports/:path*",
    "/services/:path*",
    "/team/:path*",
    "/api/((?!auth).*)",
  ],
};
