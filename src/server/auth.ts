// src/server/auth.ts

import { PrismaAdapter } from '@auth/prisma-adapter';
import { getServerSession, type DefaultSession, type NextAuthOptions } from 'next-auth';
import { type Adapter } from 'next-auth/adapters';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '~/lib/prisma';
import { env } from '~/env';
import { db } from '~/server/db';
import { compare } from 'bcryptjs';
import { provisionNewUser } from '~/server/userSetup';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  events: {
    async createUser({ user }) {
      // Discord (and other OAuth) new users land here.
      await provisionNewUser(user.id);
    },
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (token?.id) {
        session.user = {
          ...session.user,
          id: token.id as string,
        };
      }
      return session;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to /character after successful login
      if (url.startsWith(baseUrl)) {
        return `${baseUrl}/character`;
      } else if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      return baseUrl;
    },
  },
  adapter: PrismaAdapter(db) as Adapter,
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, password: true },
        });

        if (!user?.password) return null;

        const isValidPassword = await compare(password, user.password);
        if (!isValidPassword) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: '/signin',  // Redirects to /signin if not authenticated
    newUser: '/character',  // Redirects to /character after successful registration
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
