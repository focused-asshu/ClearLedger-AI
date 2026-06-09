import { COMPLIANCE_DISCLAIMER } from "@/lib/report";

export function DisclaimerBanner() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
      <strong className="font-semibold">Important compliance note:</strong> {COMPLIANCE_DISCLAIMER}
    </div>
  );
}
