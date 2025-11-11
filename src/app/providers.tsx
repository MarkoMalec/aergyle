'use client'
import React from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
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

export const AuthSessionProvider = ({ children }: { children: React.ReactNode }) => {
    return <SessionProvider>{children}</SessionProvider>;
}