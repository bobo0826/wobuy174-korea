import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export function getSupabaseClient() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey);
  }

  return client;
}
