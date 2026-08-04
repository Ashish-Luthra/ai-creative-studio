'use client'

/**
 * OAuth popup landing page: relays ?code&state to the opener (the Connections
 * screen) via postMessage — same popup pattern as marketingos's
 * mcpOAuthConnect — then closes itself.
 */
import { useEffect, useState } from 'react'

export default function ConnectorOAuthCallback() {
  const [note, setNote] = useState('Completing connection…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error_description') ?? params.get('error')
    if (window.opener && (code || error)) {
      window.opener.postMessage(
        { type: 'allyvate:connector-oauth', code, state, error },
        window.location.origin
      )
      setNote(error ? `Connection failed: ${error}` : 'Connected — you can close this window.')
      setTimeout(() => window.close(), 800)
    } else {
      setNote('Missing authorization code — close this window and try again.')
    }
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <p className="text-[13px] text-[#6b7280]">{note}</p>
    </div>
  )
}
