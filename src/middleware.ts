import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Evitamos error de variables de entorno nulas usando defaults vacíos en build time
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname;

  // Protect Admin Route
  if (path.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const role = user.app_metadata?.role;
    if (role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url)) // Unauthorized
    }
  }

  // Protect Zone Leader Route
  if (path.startsWith('/zona')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const role = user.app_metadata?.role;
    if (role !== 'zone_leader' && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url)) // Unauthorized
    }
    
    // Si el rol es zone_leader, asegurarse de que solo acceda a su zona
    const pathZonaId = path.split('/')[2];
    if (role === 'zone_leader' && pathZonaId && user.app_metadata?.zona_id !== pathZonaId) {
       return NextResponse.redirect(new URL(`/zona/${user.app_metadata.zona_id}`, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Aplica el middleware a todas las rutas excepto a:
     * - _next/static (archivos estáticos)
     * - _next/image (imágenes)
     * - favicon.ico
     * - Imágenes y SVGs generales
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
