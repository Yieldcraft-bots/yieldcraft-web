import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Subscription active
        </p>

        <h1 className="mt-3 text-3xl font-bold text-amber-400">
          Welcome to YieldCraft
        </h1>

        <p className="mt-3 text-slate-300">
          Your subscription is active. Complete setup by connecting your Coinbase API key.
        </p>

        <div className="mt-10 space-y-6 text-left">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              1. Create your Coinbase API key
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              In Coinbase, create an API key with View and Trade permissions. Keep withdrawals disabled.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              2. Connect your key in YieldCraft
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Paste the API key name and private key into YieldCraft so your connection can be verified.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              3. Confirm setup status
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              After verification, open your dashboard to confirm your account status and next steps.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/connect-keys"
            className="inline-flex justify-center rounded-full bg-amber-400 px-6 py-3 font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
          >
            Connect Coinbase
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex justify-center rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-100 hover:border-slate-500"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            Back to homepage
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          YieldCraft provides software tools for structured workflows. Trading involves risk,
          including possible loss of capital. No guarantees of performance.
        </p>
      </div>
    </main>
  );
}