import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import RequestApprovalButton from "@/components/atlas/RequestApprovalButton";

async function getUserId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Preview page does not modify auth cookies.
        },
      },
    }
  );

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

async function getPreview() {
  const userId = await getUserId();

  if (!userId) {
    return null;
  }

  const url =
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}` +
    `/api/atlas-portfolio-preview`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export default async function AtlasPreviewPage() {
  const preview = await getPreview();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/atlas/allocation"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to allocation
        </Link>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Atlas Portfolio Preview
          </p>

          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            Review your Atlas plan
          </h1>

          <p className="mt-4 max-w-2xl text-slate-400">
            This preview shows the portfolio plan generated from your selected
            allocation. No trades are submitted from this page.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
            <h2 className="text-lg font-semibold">
              Portfolio Preview
            </h2>

            {!preview?.plan?.portfolioPlan ? (
              <p className="mt-3 text-sm text-slate-400">
                Your Atlas portfolio plan is not ready yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  Deployable USD:{" "}
                  {preview.plan.portfolioPlan.deployableUsd}
                </p>

                <p>
                  Planned USD:{" "}
                  {preview.plan.portfolioPlan.plannedUsd}
                </p>

                <p>
                  Allocation:
                </p>

                <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                  {JSON.stringify(
                    preview.plan.portfolioPlan,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="font-semibold text-amber-300">
              Approval required
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Atlas does not execute from preview. A separate approval boundary
              is required before any protected execution workflow.
            </p>

            <RequestApprovalButton />
          </div>
        </section>
      </div>
    </main>
  );
}