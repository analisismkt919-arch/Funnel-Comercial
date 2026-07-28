import { createClient } from "@supabase/supabase-js";

export function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan variables públicas de Supabase");
  return createClient(url, key);
}

export function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedProfile(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = publicSupabase();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const admin = adminSupabase();
  const { data: profile } = await admin.from("funnel_profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.active === false) return null;
  return { user: data.user, profile, admin };
}
