"use server";

import { prisma } from "~/lib/prisma";

export const getUser = async ({ id }: { id: any }) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: id,
      },
      include: {
        inventory: true,
      }
    });

    return user;
  } catch (error) {
    console.error(error);
    return { user: null }
  }


};
