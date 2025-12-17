export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Privacy Policy
        </h1>

        <p className="mt-4 text-sm text-slate-300">
          Last updated: {new Date().getFullYear()}
        </p>

        <p className="mt-6 text-sm text-slate-300">
          YieldCraft respects your privacy. This Privacy Policy explains how
          information is collected, used, and protected when you access or use
          YieldCraft’s website, software tools, and services.
        </p>

        {/* What we collect */}
        <div className="mt-10 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-300">
              <li>
                <strong>Account information:</strong> such as email address and
                basic account identifiers when you create an account.
              </li>
              <li>
                <strong>Usage data:</strong> interactions with the site,
                dashboards, and software features for reliability and
                improvement.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, device type,
                browser, and logs required for security and system integrity.
              </li>
            </ul>
          </div>

          {/* What we do NOT collect */}
          <div>
            <h2 className="text-xl font-semibold">What We Do Not Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-300">
              <li>We do not store exchange passwords.</li>
              <li>We do not store private keys.</li>
              <li>We do not have withdrawal access to user funds.</li>
              <li>We do not sell personal data.</li>
            </ul>
          </div>

          {/* How info is used */}
          <div>
            <h2 className="text-xl font-semibold">How Information Is Used</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-300">
              <li>To provide and operate YieldCraft software tools.</li>
              <li>To maintain security, prevent abuse, and detect errors.</li>
              <li>To improve product performance and user experience.</li>
              <li>To communicate important service or account updates.</li>
            </ul>
          </div>

          {/* Third parties */}
          <div>
            <h2 className="text-xl font-semibold">Third-Party Services</h2>
            <p className="mt-3 text-sm text-slate-300">
              YieldCraft may rely on third-party infrastructure providers (such
              as hosting, analytics, or payment processors) solely to operate
              the service. These providers are given only the minimum data
              necessary and are not permitted to use it for unrelated purposes.
            </p>
          </div>

          {/* Data security */}
          <div>
            <h2 className="text-xl font-semibold">Data Security</h2>
            <p className="mt-3 text-sm text-slate-300">
              Reasonable administrative, technical, and organizational measures
              are used to protect information. However, no system is 100%
              secure, and users acknowledge this risk when using the service.
            </p>
          </div>

          {/* User responsibility */}
          <div>
            <h2 className="text-xl font-semibold">User Responsibility</h2>
            <p className="mt-3 text-sm text-slate-300">
              Users are responsible for safeguarding their own credentials,
              API keys, and access methods. YieldCraft is not responsible for
              losses resulting from compromised user credentials.
            </p>
          </div>

          {/* Changes */}
          <div>
            <h2 className="text-xl font-semibold">Policy Updates</h2>
            <p className="mt-3 text-sm text-slate-300">
              This Privacy Policy may be updated from time to time. Continued
              use of YieldCraft after changes constitutes acceptance of the
              revised policy.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-xs text-slate-400">
            YieldCraft provides software tools only. This Privacy Policy does
            not create a fiduciary relationship. Trading involves risk,
            including possible loss of capital.
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft · Software tools only · Not investment advice
        </div>
      </footer>
    </main>
  );
}
