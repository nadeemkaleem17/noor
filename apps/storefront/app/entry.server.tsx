import { PassThrough } from 'node:stream'
import { createReadableStreamFromReadable } from '@react-router/node'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import { ServerRouter, type EntryContext } from 'react-router'
import { getEnv } from '~/lib/env.server'
import { makeNonce, securityHeaders } from '~/lib/security.server'

export const streamTimeout = 5_000

// Evaluated when the built server starts, so a bad environment stops it here with the variable's name.
const env = getEnv()

export default function handleRequest(request: Request, status: number, headers: Headers, context: EntryContext) {
  const nonce = makeNonce()
  const path = new URL(request.url).pathname
  const security = securityHeaders({ nonce, imgOrigin: new URL(env.PUBLIC_IMG_URL).origin, production: import.meta.env.PROD, path })
  for (const [name, value] of Object.entries(security)) headers.set(name, value)

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false
    // Crawlers get the whole page rather than a stream (SEO); visitors get the shell first.
    const ready = isbot(request.headers.get('user-agent') ?? '') ? 'onAllReady' : 'onShellReady'
    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={context} url={request.url} nonce={nonce} />, {
      nonce,
      [ready]() {
        shellRendered = true
        const body = new PassThrough()
        headers.set('Content-Type', 'text/html; charset=utf-8')
        resolve(new Response(createReadableStreamFromReadable(body), { headers, status }))
        pipe(body)
      },
      onShellError: reject,
      onError(error: unknown) {
        status = 500
        if (shellRendered) console.error(error) // errors before the shell reach onShellError
      },
    })
    setTimeout(abort, streamTimeout + 1000)
  })
}
