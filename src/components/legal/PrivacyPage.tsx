// `/privatliv` — the App Store Connect **Privacy Policy URL**, and the in-app copy 5.1.1(i) requires.
//
// Danish first (the app's language), English second on the same page for App Review. See
// `src/config/legalContent.ts` for why the text is config and what the guard pins.

import React from 'react'
import { PRIVACY_DA, PRIVACY_EN } from '../../config/legalContent'
import LegalPage from './LegalPage'

const PrivacyPage: React.FC = () => <LegalPage docs={[PRIVACY_DA, PRIVACY_EN]} showEmail />

export default PrivacyPage
