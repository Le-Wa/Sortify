import { createClient as _createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

let _server: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!_server) {
    _server = _createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _server;
}

export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
