import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Connect, Plugin } from 'vite'

import { handleSuggest, type ServerEnv } from './handler.js'

const ROUTE = '/api/suggest'

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of request) chunks.push(chunk as Buffer)

  return Buffer.concat(chunks)
}

/** Node's req/res pair adapted to the Web Request/Response the handler speaks. */
function middleware(env: ServerEnv): Connect.NextHandleFunction {
  return (request: IncomingMessage, response: ServerResponse, next) => {
    if (request.url?.split('?')[0] !== ROUTE) return next()

    const aborter = new AbortController()

    // `close` on the response fires once the client is gone, including after a normal finish.
    response.on('close', () => aborter.abort())

    void (async () => {
      const body = request.method === 'POST' ? await readBody(request) : undefined
      const webRequest = new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers: request.headers as Record<string, string>,
        body: body ? new Uint8Array(body) : undefined,
        signal: aborter.signal,
      })

      const webResponse = await handleSuggest(webRequest, env)

      if (response.writableEnded || aborter.signal.aborted) return

      response.statusCode = webResponse.status
      webResponse.headers.forEach((value, key) => response.setHeader(key, value))
      response.end(Buffer.from(await webResponse.arrayBuffer()))
    })().catch(next)
  }
}

/**
 * Serves the API route from the Vite dev and preview servers, so `pnpm dev` is the only command
 * needed locally. In production Vercel serves the same handler from `api/suggest.ts`.
 */
export function suggestApiPlugin(env: ServerEnv): Plugin {
  return {
    name: 'coauthor-suggest-api',
    configureServer(server) {
      server.middlewares.use(middleware(env))
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(env))
    },
  }
}
