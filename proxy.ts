import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't need authentication
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }
  
  // Our primary auth guard is client-side in the AuthProvider since we use localStorage,
  // but we can do a basic check here for SSR if a cookie were to be set in the future.
  // For now, allow requests through to the client-side AuthProvider.
  
  return NextResponse.next();
}
