// src/server/auth.ts

import { PrismaAdapter } from '@auth/prisma-adapter';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import { type Adapter } from 'next-auth/adapters';
import DiscordProvider, { type DiscordProfile } from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare, getRounds, hash } from 'bcryptjs';
import { prisma } from '~/lib/prisma';
import { env } from '~/env';
import {
  PASSWORD_BCRYPT_ROUNDS,
  PLAYER_NAME_MIN,
  sanitizePlayerName,
  signInSchema,
} from '~/lib/auth-rules';
import { provisionNewUser } from '~/server/userSetup';
import { getClientIp, sharedRateLimiter } from '~/server/security/rateLimit';

// Checked when an email has no password account, so response times don't
// reveal which emails are registered. A hash of random bytes nobody knows.
const DUMMY_HASH = '$2a$11$e4W7oXFTFO.BSn9qz/b94e65rJjXmAxJZ5HuHZ1fdhZZm59EoDR06';

const signInsByIp = sharedRateLimiter('sign-in-ip', { limit: 20, windowMs: 15 * 60_000 });
const signInsByEmail = sharedRateLimiter('sign-in-email', { limit: 8, windowMs: 15 * 60_000 });

/** Thrown from authorize(); the sign-in form turns it into a friendly message. */
export const RATE_LIMITED_ERROR = 'RateLimited';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
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
    // Only ever redirect within this site; anything else goes home.
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/') && !url.startsWith('//')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // Not a URL at all.
      }
      return baseUrl;
    },
  },
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: 'identify email' } },
      // PKCE and state tie the Discord callback to the browser that started
      // it, so nobody can finish a sign-in in someone else's browser.
      checks: ['pkce', 'state'],
      profile(profile: DiscordProfile) {
        const displayName: unknown = profile.global_name;
        const name = sanitizePlayerName(
          typeof displayName === 'string' && displayName ? displayName : profile.username,
        );
        return {
          id: profile.id,
          name: name.length >= PLAYER_NAME_MIN ? name : 'Wayfarer',
          // Only an address Discord has verified may match an existing
          // account; otherwise the player gets their own account.
          email: profile.verified && profile.email ? profile.email.toLowerCase() : null,
          // Players pick an in-game portrait; no remote images.
          image: null,
        };
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const parsed = signInSchema.safeParse({
          email: credentials?.email ?? '',
          password: credentials?.password ?? '',
        });
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = getClientIp(req?.headers);
        const byIp = signInsByIp.hit(ip);
        const byEmail = signInsByEmail.hit(email);
        if (!byIp.ok || !byEmail.ok) throw new Error(RATE_LIMITED_ERROR);

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, password: true },
        });

        // Discord-only accounts have no password and fail here like a typo.
        const matches = await compare(password, user?.password ?? DUMMY_HASH);
        if (!user?.password || !matches) return null;

        signInsByEmail.reset(email);

        // Older accounts were hashed with fewer rounds; upgrade them quietly.
        if (getRounds(user.password) < PASSWORD_BCRYPT_ROUNDS) {
          await prisma.user.update({
            where: { id: user.id },
            data: { password: await hash(password, PASSWORD_BCRYPT_ROUNDS) },
          });
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: '/play',
    error: '/play',
    // First Discord sign-in: straight to the character.
    newUser: '/profile',
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
