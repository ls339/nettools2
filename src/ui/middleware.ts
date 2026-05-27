import { auth } from '@/auth'

export default auth((req) => {
    if (!req.auth && req.nextUrl.pathname !== '/api/auth') {
        const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
        signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
        return Response.redirect(signInUrl)
    }
})

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
