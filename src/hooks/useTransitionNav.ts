import { useNavigate } from 'react-router-dom'
import { useTransitionContext } from '../components/common/transition/TransitionProvider'

// Thin accessor for the themed route transition (Liveliness PRD-02). Returns the two public
// navigation actions. If (somehow) called outside a TransitionProvider, it degrades gracefully to
// a plain navigate — a missing provider must never dead-end a tap.

export interface TransitionNav {
  navigateWithTransition: (to: string, opts?: { replace?: boolean }) => void
  goBack: (to: string) => void
}

export function useTransitionNav(): TransitionNav {
  const ctx = useTransitionContext()
  const navigate = useNavigate()
  if (ctx) return { navigateWithTransition: ctx.navigateWithTransition, goBack: ctx.goBack }
  return {
    navigateWithTransition: (to, opts) => navigate(to, opts?.replace ? { replace: true } : undefined),
    goBack: (to) => navigate(to),
  }
}

export default useTransitionNav
