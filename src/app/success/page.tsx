export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-amber-400">Welcome to YieldCraft</h1>
        <p className="mt-3 text-slate-300">
          Your subscription is active. Follow the steps below to get your bot online.
        </p>

        <div className="mt-10 space-y-6 text-left">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">1. Create Your Coinbase API Key</h2>
            <p className="text-slate-400 text-sm mt-1">
              Go to Coinbase Advanced → API → Create API Key → Read & Trade permissions.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-100">2. Enter Your API Key in YieldCraft</h2>
            <p className="text-slate-400 text-sm mt-1">
              This connects your account to the bot. Your secret key never leaves your browser.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-100">3. Start Your Bot</h2>
            <p className="text-slate-400 text-sm mt-1">
              Once connected, your bot will automatically follow Pulse & Recon logic.
            </p>
          </div>
        </div>

        <a
          href="/dashboard"
          className="mt-10 inline-block rounded-full bg-amber-400 px-6 py-3 text-slate-950 font-semibold shadow-lg hover:bg-amber-300"
        >
          Go to Dashboard
        </a>

        <div className="mt-6">
          <a href="/" className="text-slate-500 text-sm hover:text-slate-300">
            Back to homepage
          </a>
        </div>
      </div>
    </main>
  );
}
