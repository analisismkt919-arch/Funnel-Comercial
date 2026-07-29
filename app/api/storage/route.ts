import { authenticatedProfile } from "@/lib/supabase";
import { createHash } from "node:crypto";

const RECORDS_KEY = "funnel-kpi-v2-records";
const USERS_KEY = "funnel-kpi-users-v1";
const ADMIN_KEYS = new Set([USERS_KEY, "funnel-kpi-v2-targets", "funnel-kpi-period-locks-v1", "funnel-kpi-v2-branches"]);
const CAPTURE_KEYS = new Set([RECORDS_KEY, "funnel-kpi-v2-teams", "funnel-kpi-bdc-v1", "funnel-kpi-industry-v1"]);

const isAdmin = (profile: any) => profile.role === "admin";
const canCapture = (profile: any) => isAdmin(profile) || profile.role === "capturista" || profile.role === "bdc_operador" || profile.permissions?.canCapture === true;
const owner = (profile: any, scope: string) => scope === "shared" ? null : profile.id;

function appUser(profile: any) {
  return {
    id: profile.id, username: profile.email, name: profile.name, role: profile.role,
    sucursal: profile.branch, branches: profile.branches || [], brands: profile.brands || [],
    manager: profile.manager, active: profile.active,
    customViews: profile.permissions?.views || [], customCanCapture: Boolean(profile.permissions?.canCapture),
    captureFields: profile.permissions?.captureFields || []
  };
}

async function audit(admin: any, userId: string, action: string, storageKey: string, detail: any = {}) {
  await admin.from("funnel_audit_log").insert({ user_id: userId, action, storage_key: storageKey, detail });
}

export async function GET(request: Request) {
  const auth = await authenticatedProfile(request);
  if (!auth) return Response.json({ error: "Sesión inválida" }, { status: 401 });
  const url = new URL(request.url), key = String(url.searchParams.get("key") || "").slice(0, 160);
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "shared";
  if (key === "profile") return Response.json({ value: JSON.stringify(auth.profile) });
  if (key === USERS_KEY) {
    const query = auth.admin.from("funnel_profiles").select("*").order("name");
    const { data, error } = isAdmin(auth.profile) ? await query : await query.eq("id", auth.profile.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ value: JSON.stringify((data || []).map(appUser)) });
  }
  if (key === RECORDS_KEY) {
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 500)));
    const from = page * limit;
    const { data, error } = await auth.admin.from("funnel_records").select("payload")
      .order("month").order("branch").order("manager").order("advisor")
      .range(from, from + limit - 1);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({
      value: JSON.stringify((data || []).map(row => row.payload)),
      hasMore: (data || []).length === limit
    });
  }
  const ownerId = owner(auth.profile, scope);
  let storageQuery = auth.admin.from("funnel_storage").select("value").eq("storage_key", key).eq("scope", scope);
  storageQuery = ownerId ? storageQuery.eq("owner_id", ownerId) : storageQuery.is("owner_id", null);
  const { data, error } = await storageQuery.maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ value: typeof data.value === "string" ? data.value : JSON.stringify(data.value) });
}

export async function POST(request: Request) {
  const auth = await authenticatedProfile(request);
  if (!auth) return Response.json({ error: "Sesión inválida" }, { status: 401 });
  const body = await request.json() as { key?: string; value?: string; scope?: string; mode?: string };
  const key = String(body.key || "").slice(0, 160), value = String(body.value || "");
  const scope = body.scope === "personal" ? "personal" : "shared";
  if (!key || value.length > 12_000_000) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  if (scope === "shared" && ADMIN_KEYS.has(key) && !isAdmin(auth.profile)) return Response.json({ error: "Solo un administrador puede modificar esta información" }, { status: 403 });
  if (scope === "shared" && CAPTURE_KEYS.has(key) && !canCapture(auth.profile)) return Response.json({ error: "Tu perfil no tiene permiso de captura" }, { status: 403 });

  if (key === USERS_KEY) {
    if (!isAdmin(auth.profile)) return Response.json({ error: "Sin permiso" }, { status: 403 });
    const users = JSON.parse(value || "[]");
    if (!Array.isArray(users)) return Response.json({ error: "Usuarios inválidos" }, { status: 400 });
    const { data: existingProfiles } = await auth.admin.from("funnel_profiles").select("id,email");
    const retained = new Set<string>();
    for (const user of users) {
      let id = String(user.id || "");
      const existing = (existingProfiles || []).find(row => row.id === id || row.email?.toLowerCase() === String(user.username || "").toLowerCase());
      if (existing) {
        id = existing.id;
        const password = String(user.password || "");
        if (password) {
          if (password.length < 8) return Response.json({ error: `La nueva contraseña de ${user.name || user.username} necesita por lo menos 8 caracteres` }, { status: 400 });
          const updatedAuth = await auth.admin.auth.admin.updateUserById(id, {
            password,
            user_metadata: { name: user.name }
          });
          if (updatedAuth.error) return Response.json({ error: updatedAuth.error.message }, { status: 400 });
        }
      }
      else {
        const email = String(user.username || "").trim().toLowerCase();
        const password = String(user.password || "");
        if (!email.includes("@") || password.length < 8) return Response.json({ error: `El usuario ${user.name || email} necesita correo válido y contraseña de 8 caracteres` }, { status: 400 });
        const created = await auth.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: user.name } });
        if (created.error || !created.data.user) return Response.json({ error: created.error?.message }, { status: 400 });
        id = created.data.user.id;
      }
      retained.add(id);
      const profile = {
        id, email: String(user.username).toLowerCase(), name: user.name || user.username,
        role: user.role || "capturista", active: user.active !== false, branch: user.sucursal || null,
        branches: user.branches || [], brands: user.brands || [], manager: user.manager || null,
        permissions: { views: user.customViews || [], canCapture: Boolean(user.customCanCapture), captureFields: user.captureFields || [] }
      };
      const { error } = await auth.admin.from("funnel_profiles").upsert(profile);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    }
    for (const profile of existingProfiles || []) {
      if (profile.id !== auth.user.id && !retained.has(profile.id)) {
        await auth.admin.auth.admin.deleteUser(profile.id);
      }
    }
    await audit(auth.admin, auth.user.id, "USERS_REPLACED", key, { count: users.length });
    return Response.json({ ok: true });
  }

  if (key === RECORDS_KEY) {
    if (body.mode === "clear") {
      const { error } = await auth.admin.from("funnel_records").delete().neq("id", "");
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(auth.admin, auth.user.id, "RECORDS_CLEARED_FOR_REPLACE", key);
      return Response.json({ ok: true });
    }
    if (body.mode === "delete-periods") {
      const periods = JSON.parse(value || "[]");
      if (!Array.isArray(periods) || periods.length > 250) {
        return Response.json({ error: "Periodos de importación inválidos" }, { status: 400 });
      }
      let deleted = 0;
      for (const period of periods) {
        const branch = String(period?.sucursal || "").trim();
        const month = String(period?.month || "").trim();
        if (!branch || !month) continue;
        const { error } = await auth.admin.from("funnel_records")
          .delete().eq("branch", branch).eq("month", month);
        if (error) return Response.json({ error: error.message }, { status: 400 });
        deleted++;
      }
      await audit(auth.admin, auth.user.id, "RECORD_PERIODS_REPLACED", key, { periods: deleted });
      return Response.json({ ok: true });
    }
    const rows = JSON.parse(value || "[]");
    if (!Array.isArray(rows)) return Response.json({ error: "Registros inválidos" }, { status: 400 });
    const rowsById = new Map<string, any>();
    for (const row of rows) {
      const normalized = {
        ...row,
        id: String(row?.id || "").trim() || createHash("sha256").update(JSON.stringify(row)).digest("hex")
      };
      rowsById.set(normalized.id, normalized);
    }
    const normalizedRows = Array.from(rowsById.values());
    const databaseRows = normalizedRows.map((row: any) => ({
      id: row.id,
      month: String(row.month || ""),
      branch: String(row.sucursal || ""),
      manager: String(row.manager || "SIN ASIGNAR"),
      advisor: String(row.vendor || "SIN ASIGNAR"),
      payload: row,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString()
    }));

    // El modo append recibe lotes pequeños desde el navegador. El modo normal
    // conserva compatibilidad y reemplaza toda la colección.
    if (body.mode !== "append") {
      const { error: deleteError } = await auth.admin.from("funnel_records").delete().neq("id", "");
      if (deleteError) return Response.json({ error: deleteError.message }, { status: 400 });
    }
    for (let start = 0; start < databaseRows.length; start += 400) {
      const { error: insertError } = await auth.admin
        .from("funnel_records")
        .upsert(databaseRows.slice(start, start + 400), { onConflict: "id" });
      if (insertError) {
        await audit(auth.admin, auth.user.id, "RECORDS_IMPORT_PARTIAL", key, {
          inserted: start,
          total: databaseRows.length,
          error: insertError.message
        });
        return Response.json({
          error: `La importación se detuvo después de ${start} registros: ${insertError.message}`
        }, { status: 400 });
      }
    }
    await audit(auth.admin, auth.user.id, body.mode === "append" ? "RECORDS_BATCH_APPENDED" : "RECORDS_REPLACED", key, { count: normalizedRows.length });
    return Response.json({ ok: true });
  }

  const { error } = await auth.admin.from("funnel_storage").upsert({
    storage_key: key, scope, owner_id: owner(auth.profile, scope), value, updated_by: auth.user.id, updated_at: new Date().toISOString()
  }, { onConflict: "storage_key,scope,owner_key" });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await audit(auth.admin, auth.user.id, "STORAGE_UPSERTED", key);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticatedProfile(request);
  if (!auth) return Response.json({ error: "Sesión inválida" }, { status: 401 });
  const url = new URL(request.url), key = String(url.searchParams.get("key") || "").slice(0, 160);
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "shared";
  if (scope === "shared" && !isAdmin(auth.profile)) return Response.json({ error: "Sin permiso" }, { status: 403 });
  if (key === RECORDS_KEY) {
    const { error } = await auth.admin.from("funnel_records").delete().neq("id", "");
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const ownerId = owner(auth.profile, scope);
    let deleteQuery = auth.admin.from("funnel_storage").delete().eq("storage_key", key).eq("scope", scope);
    deleteQuery = ownerId ? deleteQuery.eq("owner_id", ownerId) : deleteQuery.is("owner_id", null);
    const { error } = await deleteQuery;
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }
  await audit(auth.admin, auth.user.id, "PERMANENT_DELETE", key);
  return Response.json({ ok: true, permanent: true });
}
