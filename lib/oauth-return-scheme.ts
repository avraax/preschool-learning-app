// WHERE A SHELL FLOW RETURNS TO — a custom URL scheme, chosen HERE and never echoed from the request.
//
// Sign-in reliability PRD W5 layer 1. The shell opens the authorize URL in `SFSafariViewController`, and
// nothing in that sheet can reach the native app: `/#bl_auth=1` boots the whole web app *inside* the
// sheet, and `<a href="/">` navigates the sheet rather than returning. A custom scheme is the one link
// iOS will hand back to the app — `appUrlOpen` fires, the handler dismisses the sheet and claims at once.
//
// NO NEW REGISTRATION WITH GOOGLE OR APPLE IS REQUIRED, which is what makes this cheap: our OWN server
// issues that final redirect, so the `redirect_uri` registered with each provider is unchanged.
//
// THE ALLOW-LIST IS KEYED BY TIER AND IS THE ONLY SOURCE OF A SCHEME. A request may say it can HANDLE a
// scheme return (older binaries cannot, and must keep getting the terminal page — see layer 2); it may
// never say WHICH. Echoing a caller-supplied scheme would turn this endpoint into an open redirect into
// an arbitrary app, at the exact moment a session token is in flight.
//
// Dependency-free on purpose, so `oauthReturnScheme.test.ts` can cross-check it against
// `scripts/set-build-tier.mjs`'s table without importing the server graph. Reached by a Vercel function,
// so any relative import it grows must end in `.js`.

export type ReturnSchemeTier = 'staging' | 'production'

/**
 * One scheme per tier, and they must differ: two apps are installed side by side on the owner's iPad
 * (`Børnelæring` and `BL Staging`), and iOS resolves a scheme to whichever app claimed it — with the
 * winner UNDEFINED when two apps claim the same one. A staging sign-in that opened production would be
 * both baffling and a cross-tier session hand-off.
 *
 * Kept in step with `BUILD_TIERS` in `scripts/set-build-tier.mjs`, which writes them into
 * `CFBundleURLTypes`; the test asserts the two agree, because a mismatch is a redirect into a scheme no
 * app claims — Safari's "address is invalid" error, at the end of a successful sign-in.
 */
const RETURN_SCHEMES: Record<ReturnSchemeTier, string> = {
  production: 'bl',
  staging: 'bl-staging',
}

/** The full return URL for a tier. `ok=1` carries no secret — the claim credential is the local flowId. */
export function returnSchemeUrl(tier: ReturnSchemeTier): string {
  const scheme = RETURN_SCHEMES[tier]
  if (!scheme) throw new Error(`[oauth] no return scheme for tier ${JSON.stringify(tier)}`)
  return `${scheme}://auth?ok=1`
}

export const returnSchemeFor = (tier: ReturnSchemeTier): string => RETURN_SCHEMES[tier]

export const allReturnSchemes = (): string[] => Object.values(RETURN_SCHEMES)
