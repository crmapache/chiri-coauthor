/**
 * The draft a first-time visitor sees. Deliberately rough: typos, a passive dodge, padding and a
 * tone wobble, so every quick action has something real to work on in the first minute.
 */
export const SAMPLE_DOCUMENT = `# Offline mode: launch plan

## Why we are doing this

Our customers in the field has been asking for offline mode for a really long time now. Technicians often work in basements, rural sites and other places where the signal is basically non-existent, and when the app can't connect they loose whatever they were typing. It's super frustrating for them and honestly it's frustrating for us too, because support tickets about lost work went up 40% last quarter.

## What we're shipping

The first version will let technicians:

- open any job that was synced in the last 7 days
- fill out checklists and add photos without a connection
- have there changes synced automatically once they are back online

Conflicts are handled by keeping the most recent edit, and the user is shown a notice when this happens. It was decided by the team that we will not support creating brand new jobs offline in this release, since it touches billing.

## Timeline

Beta starts on **March 3** with three customers. If the beta goes well we will roll out to everyone in April, but this depends on the results of the beta and also on whether the sync bugs that was found in testing are fixed by then.

## Open questions

We still need to figure out how much storage we can use on older Android phones, and whether photos should be compressed before they are stored. Any thoughts on this are very welcome, just leave a comment in the [design doc](https://example.com/offline-design).
`
