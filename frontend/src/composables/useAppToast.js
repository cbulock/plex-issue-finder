import { ensureToastRegion, showToast } from 'cindor-ui-core'

const TONE_MAP = {
  success: 'success',
  warn: 'warning',
  warning: 'warning',
  error: 'danger',
  danger: 'danger',
  secondary: 'neutral',
  info: 'neutral',
}

function buildToastContent(summary, detail) {
  if (summary && detail) return `${summary}: ${detail}`
  return summary || detail || ''
}

export function useAppToast() {
  function add({ severity, summary, detail, life, closable }) {
    const content = buildToastContent(summary, detail)
    if (!content) return

    showToast(
      {
        content,
        dismissible: closable ?? true,
        duration: life,
        tone: TONE_MAP[severity] || 'neutral',
      },
      ensureToastRegion(document),
    )
  }

  return { add }
}
