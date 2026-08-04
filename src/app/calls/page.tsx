'use client'

/**
 * Calls — post-call recommendations (Phase 4 of the Content Engine plan).
 * The transcript-analysis flow ships with call intelligence; this page holds
 * the approved empty-state so the nav route is real from day one.
 */
export default function CallsPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-4 bg-white border-b border-[#e5e5e5]">
        <h1 className="text-[20px] font-bold text-[#0d1117]">Calls</h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <div className="max-w-[560px] w-full">
          <p className="text-[13px] text-[#6b7280] mb-3">
            Paste a call transcript. The SalesDemo Agent extracts what the prospect cared
            about and recommends approved content and creatives to send.
          </p>
          <textarea
            className="w-full min-h-[180px] rounded-xl border border-[#d1d5db] p-3.5 text-[13px] leading-relaxed outline-none focus:border-[#2563EB]"
            placeholder={'Paste call transcript…\n\ne.g.  [00:14:22] Priya (Acme): Before we go further — is the platform multi-tenant? Data isolation matters a lot for us…'}
            disabled
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[12px] text-[#9ca3af]">
              Call analysis arrives with the Content Engine's call-intelligence phase.
            </span>
            <button
              disabled
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-white bg-[#111827] opacity-50 cursor-not-allowed"
            >
              Analyze call
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
