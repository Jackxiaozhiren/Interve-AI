/**
 * The product version, for anything user-facing that has to state it.
 *
 * `package.json` is the authority; this constant is a copy of it, and
 * `tests/unit/app-version-claim.test.ts` fails the moment the two disagree. The
 * alternative — importing package.json into a client component — would ship the
 * whole dependency list to the browser to render four characters.
 *
 * Bumping a version is a release decision. When it happens, change both, and let
 * the test say so if only one moves.
 */
export const APP_VERSION = "1.0.0";
