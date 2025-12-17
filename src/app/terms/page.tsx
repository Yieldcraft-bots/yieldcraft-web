export const metadata = {
  title: "Terms of Service | YieldCraft",
  description:
    "YieldCraft Terms of Service. Software-only platform. Not investment advice. Trading involves risk.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Terms of Service
        </h1>

        <p className="mt-4 text-sm text-slate-400">
          Effective Date: {new Date().getFullYear()}
        </p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <p>
            YieldCraft (“YieldCraft,” “we,” “us,” or “our”) provides software tools
            designed to assist users in building structured trading workflows.
            By accessing or using this website, dashboard, APIs, or related
            services (collectively, the “Service”), you agree to be bound by
            these Terms of Service.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            1. No Investment Advice
          </h2>
          <p>
            YieldCraft is <strong>not</strong> an investment advisor, broker,
            dealer, or fiduciary. The Service provides software tools and
            automation infrastructure only. Nothing on this site constitutes
            financial, investment, tax, or legal advice, nor should any content
            be interpreted as a recommendation to buy or sell any asset.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            2. Risk Disclosure
          </h2>
          <p>
            Trading digital assets and other financial instruments involves
            significant risk. Losses may exceed expectations and may include
            loss of principal. You acknowledge that you understand these risks
            and agree that you are solely responsible for all trading decisions,
            outcomes, and losses.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            3. No Guarantees
          </h2>
          <p>
            YieldCraft makes no representations, warranties, or guarantees
            regarding performance, profitability, or loss prevention. Any
            performance targets, examples, simulations, or design goals are
            illustrative only and do not reflect actual or future results.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            4. User Responsibility
          </h2>
          <p>
            You are solely responsible for configuring, enabling, disabling, and
            monitoring any automation or execution logic. You agree to use only
            capital you can afford to lose and to independently evaluate whether
            the Service is appropriate for your situation.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            5. Third-Party Services
          </h2>
          <p>
            YieldCraft integrates with third-party platforms such as exchanges,
            APIs, and infrastructure providers. We do not control and are not
            responsible for outages, execution delays, slippage, fees, pricing
            discrepancies, or failures of third-party services.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            6. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, YieldCraft shall not be
            liable for any direct, indirect, incidental, consequential, or
            special damages arising from or related to your use of the Service,
            including but not limited to financial losses, lost profits, or data
            loss.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            7. No Warranty
          </h2>
          <p>
            The Service is provided on an “as is” and “as available” basis,
            without warranties of any kind, whether express or implied,
            including but not limited to merchantability, fitness for a
            particular purpose, or non-infringement.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            8. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            Service after changes become effective constitutes acceptance of
            the revised Terms.
          </p>

          <h2 className="text-xl font-semibold text-slate-100">
            9. Governing Law
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable laws, without regard to conflict of law principles.
          </p>

          <p className="pt-4 text-xs text-slate-400">
            By using YieldCraft, you acknowledge that you have read, understood,
            and agreed to these Terms of Service.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-4xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools only. Not investment advice. Trading
          involves risk, including possible loss of capital. No guarantees of
          performance.
        </div>
      </footer>
    </main>
  );
}
