// Global React error boundary (Bug Report feature) — the app previously had NONE, so a
// render crash meant a silent blank screen. Now: a kid-friendly Danish fallback with a
// reload button, plus an automatic slim crash report (deduped/capped in bugReporter).
//
// The fallback deliberately uses NO MUI and no theme — if the crash came from the theme
// or an MUI portal, a MUI-based fallback would crash again and blank the screen anyway.

import React from 'react'
import { reportCrash } from '../../services/bugReporter'

interface AppErrorBoundaryProps {
  children: React.ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }
  private reported = false

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Once per mounted boundary; bugReporter's session cap is the crash-loop backstop.
    if (this.reported) return
    this.reported = true
    void reportCrash(error, info.componentStack ?? undefined)
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #fdf6e3 0%, #ffe9f0 100%)',
          fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
          color: '#4a3b56',
        }}
      >
        <div style={{ fontSize: '5rem', lineHeight: 1 }}>🙈</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>Ups! Noget gik galt.</div>
        <div style={{ fontSize: '1rem', maxWidth: 420 }}>
          Vi har fået besked om fejlen. Tryk på knappen for at prøve igen.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '14px 32px',
            fontSize: '1.2rem',
            fontWeight: 700,
            fontFamily: 'inherit',
            color: '#ffffff',
            background: '#7c4dff',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            minHeight: '44px',
            boxShadow: '0 4px 12px rgba(124, 77, 255, 0.4)',
          }}
        >
          Prøv igen 🔄
        </button>
      </div>
    )
  }
}
