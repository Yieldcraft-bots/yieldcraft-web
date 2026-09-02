"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type Customer = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  customer_label: string;
  plan: string | null;
  subscription_status: string | null;
  signup_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  atlas_entitled: boolean;
  pulse_entitled: boolean;
  atlas_key_connected: boolean;
  pulse_key_connected: boolean;
  health: string;
  next_action: string;
};

type CustomerSuccessResponse = {
  ok: boolean;
  customers?: Customer[];
};

export default function CustomerGrid() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadCustomers =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const data =
          await adminFetch<CustomerSuccessResponse>(
            "/api/admin/customer-success",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (
          !data.ok ||
          !Array.isArray(data.customers)
        ) {
          throw new Error(
            "Customer data was unavailable or invalid."
          );
        }

        setCustomers(data.customers);
        setLastUpdated(
          new Date().toLocaleTimeString()
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load customers."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadCustomers();

    const interval =
      window.setInterval(() => {
        void loadCustomers();
      }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadCustomers]);

  return (
    <AtlasCard title="Customer Grid">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          {lastUpdated
            ? `Updated ${lastUpdated}`
            : loading
              ? "Loading customers"
              : "Not yet updated"}
        </div>

        <button
          type="button"
          onClick={() =>
            void loadCustomers()
          }
          disabled={loading}
          className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4"
        >
          <p className="font-semibold text-rose-300">
            Customer data unavailable
          </p>

          <p className="mt-2 text-sm text-rose-200">
            {errorMessage}
          </p>

          {lastUpdated ? (
            <p className="mt-2 text-xs text-rose-300/70">
              The table below shows the last
              successful snapshot from{" "}
              {lastUpdated}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-4">
                Customer
              </th>

              <th className="px-4 py-4">
                Plan
              </th>

              <th className="px-4 py-4">
                Signup
              </th>

              <th className="px-4 py-4">
                Subscription
              </th>

              <th className="px-4 py-4">
                Keys
              </th>

              <th className="px-4 py-4">
                Atlas
              </th>

              <th className="px-4 py-4">
                Pulse
              </th>

              <th className="px-4 py-4">
                Health
              </th>

              <th className="px-4 py-4">
                Next Action
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map(
              (customer) => (
                <tr
                  key={customer.user_id}
                  className="border-t border-white/10 text-slate-300"
                >
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">
                      {displayCustomer(
                        customer
                      )}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {customer.email ||
                        shortUser(
                          customer.user_id
                        )}
                    </div>
                  </td>

                  <td className="px-4 py-4 capitalize">
                    {customer.plan || "—"}
                  </td>

                  <td className="px-4 py-4">
                    {formatDate(
                      customer.signup_at
                    )}
                  </td>

                  <td className="px-4 py-4 capitalize">
                    {customer.subscription_status ||
                      "—"}
                  </td>

                  <td className="px-4 py-4">
                    <KeyStatus
                      atlas={
                        customer.atlas_key_connected
                      }
                      pulse={
                        customer.pulse_key_connected
                      }
                    />
                  </td>

                  <td className="px-4 py-4">
                    {customer.atlas_entitled
                      ? "Yes"
                      : "No"}
                  </td>

                  <td className="px-4 py-4">
                    {customer.pulse_entitled
                      ? "Yes"
                      : "No"}
                  </td>

                  <td className="px-4 py-4">
                    <HealthPill
                      value={
                        customer.health
                      }
                    />
                  </td>

                  <td className="px-4 py-4 text-slate-400">
                    {customer.next_action ||
                      "No Action"}
                  </td>
                </tr>
              )
            )}

            {loading &&
            customers.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-500"
                  colSpan={9}
                >
                  Loading customers...
                </td>
              </tr>
            ) : null}

            {!loading &&
            !errorMessage &&
            customers.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-500"
                  colSpan={9}
                >
                  No customer records found.
                </td>
              </tr>
            ) : null}

            {!loading &&
            errorMessage &&
            customers.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-rose-300"
                  colSpan={9}
                >
                  Customer data could not be
                  loaded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AtlasCard>
  );
}

function displayCustomer(
  customer: Customer
) {
  return (
    customer.display_name ||
    customer.email ||
    shortUser(customer.user_id)
  );
}

function KeyStatus(props: {
  atlas: boolean;
  pulse: boolean;
}) {
  if (props.atlas && props.pulse) {
    return <span>Atlas + Pulse</span>;
  }

  if (props.atlas) {
    return <span>Atlas</span>;
  }

  if (props.pulse) {
    return <span>Pulse</span>;
  }

  return <span>Needed</span>;
}

function HealthPill(props: {
  value: string;
}) {
  const healthy =
    props.value === "Healthy";

  return (
    <span
      className={
        healthy
          ? "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"
          : "rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200"
      }
    >
      {props.value}
    </span>
  );
}

function shortUser(userId: string) {
  if (!userId) {
    return "—";
  }

  return `${userId.slice(
    0,
    8
  )}…${userId.slice(-4)}`;
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}