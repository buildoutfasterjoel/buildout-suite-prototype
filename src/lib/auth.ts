import { createHash } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'

type AuthSession = { authenticated?: boolean }

// SHA256 the password so it always meets useSession's 32-char minimum key length
function sessionKey(pw: string) {
  return createHash('sha256').update(pw).digest('hex')
}

async function getSession(pw: string) {
  return useSession<AuthSession>({
    password: sessionKey(pw),
    name: 'proto-auth',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  const pw = process.env.PROTOTYPE_PASSWORD
  if (!pw) return { authenticated: true }
  const session = await getSession(pw)
  return { authenticated: !!session.data.authenticated }
})

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const pw = process.env.PROTOTYPE_PASSWORD
    if (!pw || data.password !== pw) throw new Error('Invalid password')
    const session = await getSession(pw)
    await session.update({ authenticated: true })
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const pw = process.env.PROTOTYPE_PASSWORD
  if (!pw) return
  const session = await getSession(pw)
  await session.clear()
})
