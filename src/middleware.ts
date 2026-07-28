import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const pathname = req.nextUrl.pathname;
      
      // Protect any route that starts with /dashboard
      if (pathname.startsWith("/dashboard")) {
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
  matcher: ["/dashboard/:path*", "/api/((?!auth).*)"],
};
