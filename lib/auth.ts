import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isRateLimited, recordFailedAttempt, clearAttempts, getClientIp } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "landlord",
      name: "Landlord",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase().trim();
        const ip = getClientIp(request);
        const identifier = `landlord:${email}:${ip}`;

        if (await isRateLimited(identifier)) {
          throw new Error("Too many attempts. Please try again later.");
        }

        // Check SuperAdmin
        const superAdmin = await prisma.superAdmin.findUnique({
          where: { email },
        });
        if (superAdmin) {
          const valid = await bcrypt.compare(
            credentials.password as string,
            superAdmin.password
          );
          if (!valid) {
            await recordFailedAttempt(identifier);
            return null;
          }
          await clearAttempts(identifier);
          return {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
            role: "SUPER_ADMIN",
          };
        }

        // Check Account (Landlord)
        const account = await prisma.account.findUnique({
          where: { email },
        });
        if (account) {
          if (!account.isActive) throw new Error("Account suspended");
          const valid = await bcrypt.compare(
            credentials.password as string,
            account.password
          );
          if (!valid) {
            await recordFailedAttempt(identifier);
            return null;
          }
          await clearAttempts(identifier);
          return {
            id: account.id,
            email: account.email,
            name: account.ownerName,
            role: "LANDLORD",
            accountId: account.id,
            accountName: account.name,
          };
        }

        // Check Staff User
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (user) {
          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!valid) {
            await recordFailedAttempt(identifier);
            return null;
          }
          await clearAttempts(identifier);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: "STAFF",
            accountId: user.accountId,
          };
        }

        await recordFailedAttempt(identifier);
        return null;
      },
    }),
    Credentials({
      id: "tenant",
      name: "Tenant",
      credentials: {
        phone: { label: "Phone", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.phone || !credentials?.pin) return null;
        const phone = (credentials.phone as string).trim();
        const pin = credentials.pin as string;
        const ip = getClientIp(request);
        const identifier = `tenant:${phone}:${ip}`;

        if (await isRateLimited(identifier)) {
          throw new Error("Too many attempts. Please try again later.");
        }

        const tenant = await prisma.tenant.findUnique({
          where: { phone },
          include: { unit: { include: { property: true } } },
        });
        if (!tenant || !tenant.isActive) {
          await recordFailedAttempt(identifier);
          return null;
        }

        // portalPin is bcrypt-hashed going forward; transparently upgrade
        // any legacy plaintext PIN on successful login.
        let valid: boolean;
        if (tenant.portalPin.startsWith("$2")) {
          valid = await bcrypt.compare(pin, tenant.portalPin);
        } else {
          valid = tenant.portalPin === pin;
          if (valid) {
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: { portalPin: await bcrypt.hash(pin, 10) },
            });
          }
        }
        if (!valid) {
          await recordFailedAttempt(identifier);
          return null;
        }
        await clearAttempts(identifier);
        return {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email ?? undefined,
          role: "TENANT",
          tenantId: tenant.id,
          unitId: tenant.unitId,
          accountId: tenant.unit.property.accountId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.accountId = (user as any).accountId;
        token.tenantId = (user as any).tenantId;
        token.accountName = (user as any).accountName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.sub;
        (session.user as any).accountId = token.accountId;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).accountName = token.accountName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
});
