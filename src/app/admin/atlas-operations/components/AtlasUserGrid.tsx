"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AtlasCard from "./AtlasCard";

type AtlasUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  customer_label: string;
  health: string;
  plan: string | null;
  subscription_status: string | null;
  atlas_entitled: boolean;
  atlas_key_connected: boolean;
  status:
    | "READY"
    | "COOLDOWN"
    | "NEEDS_FUNDS"
    | "ERROR"
    | string;
  reason: string;
  cash_available_usd: number;
  btc_available: number;
  cooldown_until: string | null;
  last_buy_at: string | null;
  market_state_used: string | null;
};

type AtlasOpsResponse = {
  ok: boolean;
  users?: AtlasUser[];
};

type StatusFilter =
  | "ALL"
  | "READY"
  | "COOLDOWN"
  | "NEEDS_FUNDS"
  | "ERROR";

const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "READY",
  "COOLDOWN",
  "NEEDS_FUNDS",
  "ERROR",
];

export default function AtlasUserGrid() {
  const [users, setUsers] = useState<AtlasUser[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    null
  );

  const activeRequestRef = useRef<AbortController | null>(null);

  const loadUsers = useCallback(async () => {
    activeRequestRef.current?.abort();

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        "/api/admin/atlas-ops-status",
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Atlas Operations request failed with status ${response.status}.`
        );
      }

      const data = (await response.json()) as AtlasOpsResponse;

      if (!data.ok || !Array.isArray(data.users)) {
        throw new Error(
          "Atlas user grid payload was unavailable or invalid."
        );
      }

      setUsers(data.users);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Atlas users."
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }

      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadUsers();

    const interval = window.setInterval(() => {
      void loadUsers();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    if (filter === "ALL") {
      return users;
    }

    return users.filter((user) => user.status === filter);
  }, [filter, users]);

  return (
    <AtlasCard title="Atlas User Grid">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              aria-pressed={filter === status}
              className={
                filter === status
                  ? "rounded-xl border border-sky-400 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200"
                  : "rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
              }
            >
              {friendlyReason(status)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated ? (
            <span className="text-xs text-slate-500">
              Updated {lastUpdated}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4"
        >
          <p className="font-semibold text-rose-300">
            Atlas user data unavailable
          </p>

          <p className="mt-2 text-sm text-rose-200">
            {errorMessage}
          </p>

          {lastUpdated ? (
            <p className="mt-2 text-xs text-rose-300/70">
              The table below shows the last successful snapshot from{" "}
              {lastUpdated}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-4">Customer</th>
              <th className="px-4 py-4">Health</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Plan</th>
              <th className="px-4 py-4">Sub</th>
              <th className="px-4 py-4">Keys</th>
              <th className="px-4 py-4">Cash</th>
              <th className="px-4 py-4">BTC</th>
              <th className="px-4 py-4">Last Buy</th>
              <th className="px-4 py-4">Reason</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.user_id}
                className="border-t border-white/10 text-slate-300"
              >
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">
                    {displayCustomer(user)}
                  </div>

                  <div className="font-mono text-xs text-slate-500">
                    {user.email || shortUser(user.user_id)}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <HealthPill health={user.health} />
                </td>

                <td className="px-4 py-4">
                  <StatusPill status={user.status} />
                </td>

                <td className="px-4 py-4 capitalize">
                  {user.plan || "—"}
                </td>

                <td className="px-4 py-4 capitalize">
                  {user.subscription_status || "—"}
                </td>

                <td className="px-4 py-4">
                  <SmallPill
                    value={
                      user.atlas_key_connected
                        ? "Connected"
                        : "Needed"
                    }
                  />
                </td>

                <td className="px-4 py-4">
                  {formatMoney(user.cash_available_usd)}
                </td>

                <td className="px-4 py-4 font-mono text-xs">
                  {formatBtc(user.btc_available)}
                </td>

                <td className="px-4 py-4">
                  {formatDateShort(user.last_buy_at)}
                </td>

                <td className="px-4 py-4 text-slate-400">
                  {friendlyReason(user.reason)}
                </td>
              </tr>
            ))}

            {loading && users.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Loading Atlas users...
                </td>
              </tr>
            ) : null}

            {!loading &&
            !errorMessage &&
            filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No users match this filter.
                </td>
              </tr>
            ) : null}

            {!loading &&
            errorMessage &&
            users.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-rose-300"
                >
                  Atlas user data could not be loaded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AtlasCard>
  );
}

function HealthPill(props: { health: string }) {
  const tone =
    props.health === "HEALTHY"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : props.health === "COOLDOWN"
        ? "border-sky-400/40 bg-sky-400/10 text-sky-200"
        : props.health === "NEEDS_FUNDS"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
          : "border-rose-400/40 bg-rose-400/10 text-rose-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {friendlyReason(props.health)}
    </span>
  );
}

function StatusPill(props: { status: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
      {friendlyReason(props.status)}
    </span>
  );
}

function SmallPill(props: { value: string }) {
  const connected = props.value === "Connected";

  return (
    <span
      className={
        connected
          ? "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"
          : "rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200"
      }
    >
      {props.value}
    </span>
  );
}

function displayCustomer(user: AtlasUser) {
  return (
    user.display_name ||
    user.email ||
    shortUser(user.user_id)
  );
}

function shortUser(userId: string) {
  if (!userId) {
    return "—";
  }

  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatBtc(value: number) {
  return Number(value || 0).toFixed(8);
}

function formatDateShort(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function friendlyReason(value: string | null) {
  if (!value) {
    return "—";
  }

  const map: Record<string, string> = {
    ALL: "All",
    HEALTHY: "Healthy",
    READY: "Ready",
    COOLDOWN: "Cooldown",
    NEEDS_FUNDS: "Needs Funds",
    NEEDS_KEYS: "Needs Keys",
    NEEDS_SUBSCRIPTION: "Needs Subscription",
    LOCKED: "Locked",
    ERROR: "Error",
    atlas_state_observed: "Healthy",
    below_min_cash: "Below Min Cash",
    cooldown_active: "Cooling Down",
    cash_available_zero_or_missing: "No Cash Available",
  };

  return map[value] || value.replaceAll("_", " ");
}