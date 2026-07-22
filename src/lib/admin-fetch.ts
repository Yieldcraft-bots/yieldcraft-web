"use client";

import { supabase } from "./supabaseClient";

export async function adminFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to retrieve session: ${error.message}`);
  }

  if (!session?.access_token) {
    throw new Error("Administrator authentication required.");
  }

  const headers = new Headers(init.headers);

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`
  );

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();

      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // Ignore JSON parsing errors.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}