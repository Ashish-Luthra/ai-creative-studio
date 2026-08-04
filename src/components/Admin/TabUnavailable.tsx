/**
 * Consistent fallback for drawer tabs that are not implemented yet.
 * Use instead of "Content for {activeTab} tab" placeholders.
 */
export function TabUnavailable() {
  return (
    <div className="py-6 px-4 text-center rounded-md bg-[#fafafa] border border-[#e5e5e5]" role="status">
      <p className="text-[13px] text-[#666]">This tab isn&apos;t available yet.</p>
    </div>
  );
}
