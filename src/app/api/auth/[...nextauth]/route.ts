import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyWorkforceCredentials } from "@/lib/workforce";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        let user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (user) {
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            const workforce = await verifyWorkforceCredentials({
              email: credentials.email,
              password: credentials.password,
            });
            if (!workforce.success || !workforce.employee || workforce.employee.email !== user.email) {
              throw new Error("Invalid credentials");
            }

            user = await prisma.user.update({
              where: { email: user.email },
              data: {
                name: workforce.employee.name,
                role: workforce.employee.role,
                department: workforce.employee.department,
                active: workforce.employee.active,
                password: await bcrypt.hash(credentials.password, 10),
              },
            });
          }
        } else {
          const workforce = await verifyWorkforceCredentials({
            email: credentials.email,
            password: credentials.password,
          });
          if (!workforce.success || !workforce.employee) {
            throw new Error("Invalid credentials");
          }

          user = await prisma.user.create({
            data: {
              name: workforce.employee.name,
              email: workforce.employee.email,
              role: workforce.employee.role,
              department: workforce.employee.department,
              active: workforce.employee.active,
              password: await bcrypt.hash(credentials.password, 10),
            },
          });
        }

        if (!user.active) {
          throw new Error("Account is disabled");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        };
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.department = token.department as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
