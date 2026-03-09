export default function AffiliateTermsPage() {
  return (
    <main className="min-h-screen bg-[#050B16] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
              YieldCraft
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Affiliate Terms & Compliance
            </h1>
            <p className="mt-4 text-sm text-white/60">Effective date: March 2026</p>
          </div>

          <div className="space-y-8 text-sm leading-7 text-white/80">
            <section>
              <h2 className="text-xl font-semibold text-white">1. Program overview</h2>
              <p className="mt-3">
                The YieldCraft Affiliate Program allows approved affiliates to refer
                new members to YieldCraft using a unique referral link.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">2. Approval and participation</h2>
              <p className="mt-3">
                Submission of an affiliate application does not guarantee approval.
                YieldCraft may approve, reject, suspend, or remove any affiliate at its discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">3. Commission structure</h2>
              <p className="mt-3">
                Approved affiliates may receive a 30% recurring commission on qualifying
                subscription revenue attributed to their referral link.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">4. Attribution</h2>
              <p className="mt-3">
                Referral attribution is determined by YieldCraft’s internal tracking systems.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">5. Payouts</h2>
              <p className="mt-3">
                Payouts occur after successful Stripe payout onboarding and only for cleared commissions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">6. Prohibited conduct</h2>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>No spam or unsolicited marketing.</li>
                <li>No misleading claims about performance.</li>
                <li>No guarantees of profits or returns.</li>
                <li>No impersonation of YieldCraft.</li>
                <li>No fake testimonials.</li>
                <li>No self-referrals or abuse of the system.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">7. Termination</h2>
              <p className="mt-3">
                YieldCraft may suspend or terminate affiliate access at any time for violations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">8. Changes</h2>
              <p className="mt-3">
                YieldCraft may update these terms or the affiliate program at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white">9. Contact</h2>
              <p className="mt-3">Questions may be directed to support@yieldcraft.co.</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}