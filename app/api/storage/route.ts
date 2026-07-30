import { authenticatedProfile } from "@/lib/supabase";
import { createHash } from "node:crypto";

const RECORDS_KEY = "funnel-kpi-v2-records";
const USERS_KEY = "funnel-kpi-users-v1";
const SECURITY_ALERTS_KEY = "security-alerts";
const ADMIN_KEYS = new Set([USERS_KEY, "funnel-kpi-v2-targets", "funnel-kpi-period-locks-v1", "funnel-kpi-v2-branches"]);
const CAPTURE_KEYS = new Set([RECORDS_KEY, "funnel-kpi-v2-teams", "funnel-kpi-bdc-v1", "funnel-kpi-industry-v1"]);

const isAdmin = (profile: any) => profile.role === "admin";
const canCapture = (profile: any) => isAdmin(profile) || profile.role === "capturista" || profile.role === "bdc_operador" || profile.permissions?.canCapture === true;
const requiresMfa = (profile: any) => isAdmin(profile) || canCapture(profile);
const mfaRequired = (auth: any) => requiresMfa(auth.profile) && auth.aal !== "aal2";
const owner = (profile: any, scope: string) => scope === "shared" ? null : profile.id;
const normalize = (value: any) => String(value || "").trim().toLocaleUpperCase("es-MX");
const strongPassword = (value: string) =>
  value.length >= 12 &&
  /[a-záéíóúñ]/i.test(value) &&
  /[A-ZÁÉÍÓÚÑ]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(value);

function jsonValue(value: any) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

async function recordScope(admin: any, profile: any) {
  if (isAdmin(profile)) return { unrestricted: true, branches: new Set<string>(), queryBranches: [] as string[], manager: "" };
  const explicitBranchValues = [
    ...(Array.isArray(profile.branches) ? profile.branches : []),
    profile.branch
  ].map((value: any) => String(value || "").trim()).filter(Boolean);
  const explicitBranches = new Map(explicitBranchValues.map((value: string) => [normalize(value), value]));
  const allowedBrands = new Set(
    (Array.isArray(profile.brands) ? profile.brands : []).map(normalize).filter(Boolean)
  );
  let branchMap = new Map<string, string>(explicitBranches);

  if (allowedBrands.size) {
    const { data } = await admin.from("funnel_storage").select("value")
      .eq("storage_key", "funnel-kpi-v2-branches")
      .eq("scope", "shared")
      .is("owner_id", null)
      .maybeSingle();
    const catalog = jsonValue(data?.value);
    const catalogRows = Array.isArray(catalog) ? catalog : [];
    const brandBranches = new Map<string, string>(catalogRows
      .filter((branch: any) => branch?.active !== false && allowedBrands.has(normalize(branch?.brand)))
      .map((branch: any) => [normalize(branch?.name), String(branch?.name || "").trim()] as [string, string])
      .filter(([key]) => Boolean(key)));
    branchMap = branchMap.size
      ? new Map([...branchMap].filter(([branch]) => brandBranches.has(branch)))
      : brandBranches;
  }

  return {
    unrestricted: false,
    branches: new Set(branchMap.keys()),
    queryBranches: [...branchMap.values()],
    manager: normalize(profile.manager)
  };
}

function scopeAllows(scope: Awaited<ReturnType<typeof recordScope>>, branch: any, manager?: any) {
  if (scope.unrestricted) return true;
  if (!scope.branches.has(normalize(branch))) return false;
  return !scope.manager || manager == null || scope.manager === normalize(manager);
}

function validateRecordRows(rows: any[]) {
  if (rows.length > 1000) return "Cada lote puede contener como máximo 1,000 registros";
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return `La fila ${index + 1} no es un objeto válido`;
    const month = String(row.month || "").trim();
    const branch = String(row.sucursal || "").trim();
    const manager = String(row.manager || "").trim();
    const advisor = String(row.vendor || "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return `La fila ${index + 1} tiene un periodo inválido`;
    if (!branch || branch.length > 120) return `La fila ${index + 1} tiene una sucursal inválida`;
    if (manager.length > 160 || advisor.length > 160) return `La fila ${index + 1} excede el tamaño permitido`;
  }
  return "";
}

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
  const webhook = process.env.SECURITY_ALERT_WEBHOOK_URL;
  if (webhook && ["PERMANENT_DELETE", "RECORDS_CLEARED_FOR_REPLACE", "RECORDS_IMPORT_PARTIAL"].includes(action)) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "Funnel Comercial",
          severity: action === "RECORDS_IMPORT_PARTIAL" ? "high" : "critical",
          action,
          storageKey,
          userId,
          detail,
          occurredAt: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      // La alerta interna queda registrada aunque el canal externo no responda.
    }
  }
}

export async function GET(request: Request) {
  const auth = await authenticatedProfile(request);
  if (!auth) return Response.json({ error: "Sesión inválida" }, { status: 401 });
  const url = new URL(request.url), key = String(url.searchParams.get("key") || "").slice(0, 160);
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "shared";
  if (key === "profile") return Response.json({ value: JSON.stringify(auth.profile) });
  if (key === SECURITY_ALERTS_KEY) {
    if (!isAdmin(auth.profile)) return Response.json({ error: "Solo un administrador puede consultar las alertas" }, { status: 403 });
    if (mfaRequired(auth)) return Response.json({ error: "Se requiere verificaciÃ³n MFA", code: "MFA_REQUIRED" }, { status: 403 });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await auth.admin
      .from("funnel_audit_log")
      .select("id,user_id,action,storage_key,detail,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const userIds = [...new Set((events || []).map((event: any) => event.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await auth.admin.from("funnel_profiles").select("id,name,email").in("id", userIds)
      : { data: [] as any[] };
    const actors = new Map((profiles || []).map((profile: any) => [profile.id, profile.name || profile.email]));
    const rules: Record<string, { severity: string; title: string; recommendation: string }> = {
      PERMANENT_DELETE: { severity: "critical", title: "EliminaciÃ³n permanente", recommendation: "Confirma que la eliminaciÃ³n fue autorizada y conserva la evidencia." },
      RECORDS_CLEARED_FOR_REPLACE: { severity: "critical", title: "Base comercial vaciada para reemplazo", recommendation: "Verifica que la importaciÃ³n de reemplazo haya concluido correctamente." },
      RECORDS_IMPORT_PARTIAL: { severity: "high", title: "ImportaciÃ³n incompleta", recommendation: "Revisa el error, corrige el archivo y vuelve a cargar Ãºnicamente el periodo afectado." },
      ACCESS_DENIED: { severity: "high", title: "Intento de acceso fuera del alcance", recommendation: "Valida los permisos del usuario y confirma que el intento sea legÃ­timo." },
      MFA_REQUIRED: { severity: "medium", title: "OperaciÃ³n detenida por falta de MFA", recommendation: "Solicita al usuario completar la verificaciÃ³n de dos factores." },
      RECORDS_VALIDATION_FAILED: { severity: "medium", title: "Archivo rechazado por validaciÃ³n", recommendation: "Corrige estructura, periodos o sucursales antes de reintentar." },
      USERS_REPLACED: { severity: "medium", title: "Usuarios o permisos modificados", recommendation: "Revisa que altas, bajas y alcances correspondan a la autorizaciÃ³n." }
    };
    const actionable = (events || []).filter((event: any) => rules[event.action]);
    const deniedByUser = new Map<string, number>();
    const recentLimit = Date.now() - 15 * 60 * 1000;
    actionable.forEach((event: any) => {
      if (event.action === "ACCESS_DENIED" && new Date(event.created_at).getTime() >= recentLimit) {
        const key = String(event.user_id || "unknown");
        deniedByUser.set(key, (deniedByUser.get(key) || 0) + 1);
      }
    });
    const alerts = actionable.map((event: any) => ({
      id: String(event.id),
      action: event.action,
      ...rules[event.action],
      actor: actors.get(event.user_id) || "Usuario no disponible",
      storageKey: event.storage_key,
      detail: event.detail || {},
      occurredAt: event.created_at
    }));
    for (const [userId, count] of deniedByUser) {
      if (count >= 5) alerts.unshift({
        id: `repeated-access-${userId}`,
        action: "REPEATED_ACCESS_DENIED",
        severity: "critical",
        title: "Accesos denegados repetidos",
        recommendation: "Revisa inmediatamente la cuenta, su alcance y las sesiones activas.",
        actor: actors.get(userId) || "Usuario no disponible",
        storageKey: "control de acceso",
        detail: { attempts: count, windowMinutes: 15 },
        occurredAt: new Date().toISOString()
      });
    }
    const totals = alerts.reduce((result: Record<string, number>, alert: any) => {
      result[alert.severity] = (result[alert.severity] || 0) + 1;
      return result;
    }, { critical: 0, high: 0, medium: 0 });
    return Response.json({ value: JSON.stringify({
      generatedAt: new Date().toISOString(),
      periodDays: 30,
      totals,
      alerts: alerts.slice(0, 100)
    }) });
  }
  if (key === USERS_KEY) {
    if (mfaRequired(auth)) return Response.json({ error: "Se requiere verificación MFA", code: "MFA_REQUIRED" }, { status: 403 });
    const query = auth.admin.from("funnel_profiles").select("*").order("name");
    const { data, error } = isAdmin(auth.profile) ? await query : await query.eq("id", auth.profile.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ value: JSON.stringify((data || []).map(appUser)) });
  }
  if (key === RECORDS_KEY) {
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 1000)));
    const from = page * limit;
    const access = await recordScope(auth.admin, auth.profile);
    if (!access.unrestricted && access.branches.size === 0) {
      return Response.json({ value: "[]", hasMore: false });
    }
    let recordsQuery = auth.admin.from("funnel_records").select("payload")
      .order("month").order("branch").order("manager").order("advisor");
    if (!access.unrestricted) recordsQuery = recordsQuery.in("branch", access.queryBranches);
    if (access.manager) recordsQuery = recordsQuery.ilike("manager", access.manager);
    const { data, error } = await recordsQuery.range(from, from + limit - 1);
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
  if (auth && mfaRequired(auth)) {
    await audit(auth.admin, auth.user.id, "MFA_REQUIRED", "POST");
    return Response.json({ error: "Se requiere verificación MFA para modificar información", code: "MFA_REQUIRED" }, { status: 403 });
  }
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
          if (!strongPassword(password)) return Response.json({ error: `La nueva contraseña de ${user.name || user.username} debe tener 12 caracteres, mayúscula, minúscula, número y símbolo` }, { status: 400 });
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
        if (!email.includes("@") || !strongPassword(password)) return Response.json({ error: `El usuario ${user.name || email} necesita correo válido y contraseña de 12 caracteres con mayúscula, minúscula, número y símbolo` }, { status: 400 });
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
    const access = await recordScope(auth.admin, auth.profile);
    if (body.mode === "clear") {
      if (!isAdmin(auth.profile)) return Response.json({ error: "Solo un administrador puede vaciar todos los registros" }, { status: 403 });
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
        if (!scopeAllows(access, branch, period?.manager)) {
          await audit(auth.admin, auth.user.id, "ACCESS_DENIED", key, { mode: body.mode, branch, month });
          return Response.json({ error: `No tienes permiso para modificar ${branch}` }, { status: 403 });
        }
        let deleteQuery = auth.admin.from("funnel_records").delete().eq("branch", branch).eq("month", month);
        if (access.manager) deleteQuery = deleteQuery.ilike("manager", access.manager);
        const { error } = await deleteQuery;
        if (error) return Response.json({ error: error.message }, { status: 400 });
        deleted++;
      }
      await audit(auth.admin, auth.user.id, "RECORD_PERIODS_REPLACED", key, { periods: deleted });
      return Response.json({ ok: true });
    }
    const rows = JSON.parse(value || "[]");
    if (!Array.isArray(rows)) return Response.json({ error: "Registros inválidos" }, { status: 400 });
    const validationError = validateRecordRows(rows);
    if (validationError) {
      await audit(auth.admin, auth.user.id, "RECORDS_VALIDATION_FAILED", key, { error: validationError });
      return Response.json({ error: validationError }, { status: 400 });
    }
    const unauthorized = rows.find(row => !scopeAllows(access, row?.sucursal, row?.manager));
    if (unauthorized) {
      await audit(auth.admin, auth.user.id, "ACCESS_DENIED", key, {
        mode: body.mode || "replace",
        branch: unauthorized?.sucursal,
        manager: unauthorized?.manager
      });
      return Response.json({ error: `No tienes permiso para modificar ${unauthorized?.sucursal || "esa sucursal"}` }, { status: 403 });
    }
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
      if (!isAdmin(auth.profile)) return Response.json({ error: "Solo un administrador puede reemplazar la base completa" }, { status: 403 });
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
  if (auth && mfaRequired(auth)) {
    await audit(auth.admin, auth.user.id, "MFA_REQUIRED", "DELETE");
    return Response.json({ error: "Se requiere verificación MFA para eliminar información", code: "MFA_REQUIRED" }, { status: 403 });
  }
  if (!auth) return Response.json({ error: "Sesión inválida" }, { status: 401 });
  const url = new URL(request.url), key = String(url.searchParams.get("key") || "").slice(0, 160);
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "shared";
  if (scope === "shared" && !isAdmin(auth.profile)) return Response.json({ error: "Sin permiso" }, { status: 403 });
  if (key === RECORDS_KEY) {
    if (!isAdmin(auth.profile)) return Response.json({ error: "Solo un administrador puede eliminar todos los registros" }, { status: 403 });
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
