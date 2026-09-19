// Wires the real sign-in implementations into authSignIn's registries.
//
// Imported once for its side effects (from AuthGate), which keeps the LOCK SCREEN free of any
// knowledge of *how* a method works — it only knows which buttons its capability flags allow. That
// separation is what let W4 ship a working gate before W7 existed, and it is what will let a future
// method (email OTP) be added without touching the screen.
//
// It is down to one line since biometric unlock was removed (2026-09-19). Kept anyway: the
// indirection is the point, and collapsing it into AuthGate would put method knowledge back into the
// view.

// Registers itself on import (startGoogleSignIn + claimPendingFlow).
import './googleSignIn'
