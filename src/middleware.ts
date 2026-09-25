// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_API_PATH,
  adminSessionCookieName,
} from '~/server/admin/constants';
import { isSafeMethod, isSameOriginRequest } from '~/server/security/origin';

// Everything behind the player sign-in. The (game) layout checks as well;
// this just sends signed-out visitors to /play before any rendering.
const GAME_PATHS = [
  '/profile',
  '/marketplace',
  '/skills',
  '/animals',
  '/dungeons',
  '/map',
  '/monsters',
  '/region',
  '/settlements',
];
const AUTH_PAGES = new Set(['/play', '/signin', '/register']);

function isUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = isUnder(pathname, '/api');

  // The game has no Server Actions: every change goes through /api. Next 14
  // gets no more fixes for the denial-of-service bugs in how it decodes
  // Server Action requests, so they are refused before Next reads them, as is
  // anything but a plain read of a page.
  if (
    request.headers.has('next-action') ||
    (!isApi && !isSafeMethod(request.method))
  ) {
    return new NextResponse(null, { status: 405 });
  }

  // Requests that change something must come from our own pages.
  if (isApi && !isSafeMethod(request.method) && !isSameOriginRequest(request.headers)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // /admin has its own sign-in. Without the cookie, go to the login page;
  // with one, the pages and routes validate the session themselves.
  const isAdminApi = isUnder(pathname, '/api/admin');
  if ((isUnder(pathname, '/admin') || isAdminApi) && pathname !== ADMIN_LOGIN_PATH && pathname !== ADMIN_SESSION_API_PATH) {
    if (!request.cookies.has(adminSessionCookieName())) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const login = new URL(ADMIN_LOGIN_PATH, request.url);
      if (pathname !== '/admin') login.searchParams.set('next', pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  const isGamePage = GAME_PATHS.some((path) => isUnder(pathname, path));
  if (!isGamePage && !AUTH_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Signed-in players skip the sign-in screens.
  if (token && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  if (!token && isGamePage) {
    const play = new URL('/play', request.url);
    play.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(play);
  }

  return NextResponse.next();
}

export const config = {
  // Every page and API route (a Server Action can be posted to any page);
  // only build output and public art skip it.
  matcher: ['/((?!_next/static|_next/image|_next/webpack-hmr|assets/|favicon.ico).*)'],
};
