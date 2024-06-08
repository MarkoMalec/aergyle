// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Redirect signed-in users away from /signin and /register
  if (token && (pathname === '/signin' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/character', request.url));
  }

  // Redirect non-signed-in users trying to access protected routes
  const protectedPaths = ['/admin', '/character'];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (!token && isProtectedPath) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  return NextResponse.next();
}

// Configuration for the matcher
export const config = {
  matcher: [
    '/admin/:path*',
    '/character/:path*',
    '/(game)/:path*',
    '/signin',
    '/register',
  ],
};
