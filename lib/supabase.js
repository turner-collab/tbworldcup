import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the secret key so API routes can read/write freely.
// These env vars are set in Vercel (and .env.local for local dev).
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY env vars");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
