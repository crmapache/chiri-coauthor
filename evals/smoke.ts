import { suggest } from '../server/suggest.js'
import { resolveModel } from '../server/models.js'

const document = `# Weekly update\n\nWe have recieved a lot of feedback from users about the the new onboarding flow, and alot of it was positive.\n\nThe team is going to be working on fixing the bugs that was reported next week.`

const outcome = await suggest(
  { mode: 'document', document },
  { apiKey: process.env.OPENROUTER_API_KEY ?? '', model: resolveModel(process.argv[2]) },
)

console.log(JSON.stringify(outcome, null, 2))