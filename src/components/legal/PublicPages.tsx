// The two public pages, mounted OUTSIDE the auth gate.
//
// `AuthGate` renders this instead of the lock screen when the path is in `PUBLIC_PATHS`, so App Review
// (and any parent) can fetch the privacy policy and the support page with no account. Deliberately not
// `<App />`: these are static text, and mounting the whole app for them would start the persistent
// world, the audio engine and `progressStore` behind a page that needs none of them.
//
// The SAME components are also registered as ordinary routes in `App.tsx`, so a signed-in adult reaches
// them through the normal router. One component, two mount points — the route table is not duplicated,
// only the mapping is, and `authGatePolicy.test.ts` pins the path list both read from.

import React from 'react'
import { useLocation } from 'react-router-dom'
import PrivacyPage from './PrivacyPage'
import SupportPage from './SupportPage'

const PublicPages: React.FC = () => {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/support') return <SupportPage />
  // `AuthGate` only mounts this for a path already in PUBLIC_PATHS, so the fallback can only be
  // `/privatliv` — but defaulting to the POLICY rather than throwing keeps a future third entry in that
  // list from rendering a blank screen at the one URL Apple checks.
  return <PrivacyPage />
}

export default PublicPages
