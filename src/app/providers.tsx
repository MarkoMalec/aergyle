'use client'
import React from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { Toaster } from 'react-hot-toast'
import { RealtimeBridge } from '~/components/realtime/RealtimeBridge'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 6000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 6000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 6000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {children}
    </QueryClientProvider>
  )
}

export const AuthSessionProvider = ({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) => {
  return (
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
};