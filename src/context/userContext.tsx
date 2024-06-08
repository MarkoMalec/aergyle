"use client";

import React, {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { User } from "@prisma/client";
interface UserProps extends User {
  inventory: {
    id: number;
    userId: string;
    slots: Prisma.JsonValue;
    maxSlots: number;
  } | null;
}

const UserContext = createContext<{
  user: UserProps | null;
  setUser: Dispatch<SetStateAction<UserProps | undefined>>;
}>({ user: null, setUser: useState });

type UserContextProviderProps = {
  children: React.ReactNode;
  initialUser?: UserProps;
};

export const UserContextProvider = ({
  children,
  initialUser,
}: UserContextProviderProps) => {
  const [user, setUser] = useState(initialUser);

  if (!user) {
    return redirect('/signin');
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => useContext(UserContext);
