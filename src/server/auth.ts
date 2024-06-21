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

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      user_skills: any;
      inventory: any;
    } & DefaultSession['user'];
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (token) {
        let user = await prisma.user.findUnique({
          where: {
            id: token.id as string,
          },
          include: {
            user_skills: true,
            inventory: true,
          },
        });

        if (user && !user.inventory) {
          const slots = Array.from({ length: 50 }, (_, index) => {
            if (index < 10) {
              return {
                slotIndex: index,
                item: { id: index + 1 },
              }
            }
            else {
              return {
                slotIndex: index,
                item: null,
              }
            }
          });
          const inventory = await prisma.inventory.create({
            data: {
              userId: user.id,
              slots: slots,
              maxSlots: 20,
            },
          });
          user = { ...user, inventory: inventory }; // Reassign user with updated inventory
        }

        session.user = {
          ...session.user,
          id: token.id,
          user_skills: user?.user_skills || [],
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
        if (!credentials) {
          throw new Error('No credentials provided');
        }
        const { email, password } = credentials;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          throw new Error('No user found with this email');
        }

        const isValidPassword = await compare(password, user.password);

        if (!isValidPassword) {
          throw new Error('Password does not match the given email');
        }

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
