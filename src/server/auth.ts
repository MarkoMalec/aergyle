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
import { ItemRarity } from '@prisma/client';
import { getStatsForRarity } from '~/utils/statProgressions';
import { createUserItem } from '~/utils/userItems';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      user_skills: any;
      inventory: any;
    } & DefaultSession['user'];
  }
}

/**
 * Create starter items for new users
 * Returns UserItem IDs to add to inventory
 */
async function createStarterItems(userId: string): Promise<number[]> {
  // Find item templates by name
  const [woodenSwordTemplate, goldRingTemplate, goldGlovesTemplate] = await Promise.all([
    prisma.item.findFirst({ where: { name: 'Wooden Sword' } }),
    prisma.item.findFirst({ where: { name: 'Gold Ring' } }),
    prisma.item.findFirst({ where: { name: 'Gold Gloves' } }),
  ]);

  if (!woodenSwordTemplate || !goldRingTemplate || !goldGlovesTemplate) {
    console.error('Starter item templates not found in database');
    return [];
  }

  // Create UserItems with specified rarities
  const starterItems = [
    {
      userId,
      itemId: woodenSwordTemplate.id,
      rarity: ItemRarity.COMMON,
    },
    {
      userId,
      itemId: goldRingTemplate.id,
      rarity: ItemRarity.BROKEN,
    },
    {
      userId,
      itemId: goldGlovesTemplate.id,
      rarity: ItemRarity.COMMON,
    },
  ];

  await Promise.all(
    starterItems.map(async (item) => {
      const userItemId = await createUserItem(item.userId, item.itemId, item.rarity, "IN_INVENTORY");
      item['itemId'] = userItemId; // Add generated ID to item object
    })
  )

  console.log(`✅ Created ${starterItems.length} starter items for user ${userId}`);
  
  return starterItems.map(item => item.itemId);
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
          // Initialize empty inventory with base capacity (25 slots)
          const BASE_CAPACITY = 25;
          
          // Check if equipment already exists (race condition check)
          const existingEquipment = await prisma.equipment.findUnique({
            where: { userId: user.id },
          });

          // Only create starter items and inventory if equipment doesn't exist
          // This prevents duplicate creation in race conditions
          if (!existingEquipment) {
            // Give new user starting gold (100 gold)
            await prisma.user.update({
              where: { id: user.id },
              data: { gold: 100 },
            });

            // Create starter items for new user
            const starterItemIds = await createStarterItems(user.id);

            // Create slots with starter items in first slots
            const emptySlots: Array<{ slotIndex: number; item: { id: number } | null }> = Array.from(
              { length: BASE_CAPACITY }, 
              (_, index) => {
                const itemId = starterItemIds[index];
                if (itemId !== undefined) {
                  return {
                    slotIndex: index,
                    item: { id: itemId },
                  };
                }
                return {
                  slotIndex: index,
                  item: null,
                };
              }
            );

            // Create inventory and equipment using upsert to handle race conditions
            const [inventory, equipment] = await Promise.all([
              prisma.inventory.upsert({
                where: { userId: user.id },
                create: {
                  userId: user.id,
                  slots: emptySlots,
                  maxSlots: BASE_CAPACITY,
                  deleteSlotId: null,
                },
                update: {},
              }),
              prisma.equipment.upsert({
                where: { userId: user.id },
                create: {
                  userId: user.id,
                  // All equipment slots start empty (null)
                },
                update: {},
              }),
            ]);

            user = { ...user, inventory: inventory };
          } else {
            // Equipment exists, just fetch the inventory
            const inventory = await prisma.inventory.findUnique({
              where: { userId: user.id },
            });
            if (inventory) {
              user = { ...user, inventory: inventory };
            }
          }
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
