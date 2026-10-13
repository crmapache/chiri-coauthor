import { handleSuggest } from '../server/handler.js'

/** Vercel function for `POST /api/suggest`. All logic lives in `server/handler.ts`. */
export function POST(request: Request): Promise<Response> {
  return handleSuggest(request, process.env)
}
