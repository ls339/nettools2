import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const expectedUser = process.env.AUTH_USERNAME
                const expectedHash = process.env.AUTH_PASSWORD_HASH

                if (!expectedUser || !expectedHash) return null
                if (credentials.username !== expectedUser) return null

                const valid = await bcrypt.compare(
                    credentials.password as string,
                    expectedHash,
                )
                if (!valid) return null

                return { id: '1', name: expectedUser, email: `${expectedUser}@nettools` }
            },
        }),
    ],
    session: { strategy: 'jwt' },
    pages: {},
})
