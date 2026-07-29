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
  let { data: profile } = await admin.from("funnel_profiles").select("*").eq("id", data.user.id).maybeSingle();
  // También cubre usuarios creados en Authentication antes de ejecutar schema.sql.
  if (!profile) {
    const { count } = await admin.from("funnel_profiles").select("id", { count: "exact", head: true });
    const fallbackProfile = {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Usuario",
      role: (count || 0) === 0 ? "admin" : "capturista",
      active: true
    };
    const { data: created, error: createError } = await admin
      .from("funnel_profiles")
      .upsert(fallbackProfile)
      .select("*")
      .single();
    if (createError) return null;
    profile = created;
  }
  if (!profile || profile.active === false) return null;
  return { user: data.user, profile, admin };
}
