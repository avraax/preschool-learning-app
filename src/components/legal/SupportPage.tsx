// `/support` — the App Store Connect **Support URL**.
//
// Guideline 2.1(a) explicitly scrubs "empty websites", so a placeholder fails review. This page
// therefore answers real questions (no sound, difficulty, where the mic game went, multiple children,
// missing progress) and says how to reach a human, rather than being a contact form with nothing on it.

import React from 'react'
import { SUPPORT_DA } from '../../config/legalContent'
import LegalPage from './LegalPage'

const SupportPage: React.FC = () => <LegalPage docs={[SUPPORT_DA]} showEmail />

export default SupportPage
