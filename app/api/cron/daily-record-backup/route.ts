import { createHash } from "node:crypto";
import { adminSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_PREFIX = "funnel-record-daily::";
const DATA_PREFIX = "funnel-record-data::";
// El proceso se ejecuta el día 3 de cada mes y conserva dos años de cortes mensuales.
const RETENTION_DAYS = 732;
const TIME_ZONE = "America/Mexico_City";

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function readAllRecords(admin: any) {
  const records: any[] = [];
  for (let page = 0; page < 1000; page++) {
    const from = page * 1000;
    const { data, error } = await admin.from("funnel_records").select("payload").range(from, from + 999);
    if (error) throw error;
    records.push(...(data || []).map((row: any) => row.payload));
    if ((data || []).length < 1000) break;
  }
  return records;
}

async function readApplicationConfiguration(admin: any) {
  const storage: any[] = [];
  for (let page = 0; page < 1000; page++) {
    const from = page * 1000;
    const { data, error } = await admin.from("funnel_storage")
      .select("storage_key,scope,owner_id,value,updated_by,updated_at")
      .range(from, from + 999);
    if (error) throw error;
    storage.push(...(data || []).filter((row: any) => {
      const key = String(row.storage_key || "");
      return !key.startsWith(DAILY_PREFIX) && !key.startsWith(DATA_PREFIX) && !key.startsWith("funnel-record-backup::");
    }));
    if ((data || []).length < 1000) break;
  }
  storage.sort((a, b) => `${a.storage_key}|${a.scope}|${a.owner_id || ""}`.localeCompare(`${b.storage_key}|${b.scope}|${b.owner_id || ""}`));

  const { data: profiles, error: profilesError } = await admin.from("funnel_profiles")
    .select("id,email,name,role,active,branch,branches,brands,manager,permissions,created_at,updated_at")
    .order("id");
  if (profilesError) throw profilesError;
  return { version: 1, storage, profiles: profiles || [] };
}

async function removeExpiredBackups(admin: any, today: string) {
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data: manifests, error } = await admin.from("funnel_storage")
    .select("storage_key,value")
    .like("storage_key", `${DAILY_PREFIX}%`)
    .eq("scope", "shared")
    .is("owner_id", null);
  if (error) throw error;

  const expired = (manifests || [])
    .filter((row: any) => String(row.storage_key).slice(DAILY_PREFIX.length) < cutoffDate)
    .map((row: any) => row.storage_key);
  for (let start = 0; start < expired.length; start += 100) {
    const { error: deleteError } = await admin.from("funnel_storage").delete().in("storage_key", expired.slice(start, start + 100));
    if (deleteError) throw deleteError;
  }

  const active = (manifests || []).filter((row: any) => !expired.includes(row.storage_key));
  const referenced = new Set(active.flatMap((row: any) => [row.value?.dataKey, row.value?.platformDataKey]).filter(Boolean));
  const { data: blobs, error: blobError } = await admin.from("funnel_storage")
    .select("storage_key")
    .like("storage_key", `${DATA_PREFIX}%`)
    .eq("scope", "shared")
    .is("owner_id", null);
  if (blobError) throw blobError;
  const unused = (blobs || []).map((row: any) => row.storage_key).filter((key: string) => !referenced.has(key));
  for (let start = 0; start < unused.length; start += 100) {
    const { error: deleteError } = await admin.from("funnel_storage").delete().in("storage_key", unused.slice(start, start + 100));
    if (deleteError) throw deleteError;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const admin = adminSupabase();
    const records = await readAllRecords(admin);
    const platform = await readApplicationConfiguration(admin);
    // Una falla o una base vacía nunca debe producir un respaldo que parezca válido.
    if (!records.length) {
      return Response.json({ error: "No se creó el respaldo porque no existen registros" }, { status: 409 });
    }

    const date = localDate();
    const checksum = createHash("sha256").update(JSON.stringify(records)).digest("hex");
    const dataKey = `${DATA_PREFIX}${checksum}`;
    const platformChecksum = createHash("sha256").update(JSON.stringify(platform)).digest("hex");
    const platformDataKey = `${DATA_PREFIX}${platformChecksum}`;
    const dailyKey = `${DAILY_PREFIX}${date}`;
    const now = new Date().toISOString();

    const { data: existingBlob, error: blobReadError } = await admin.from("funnel_storage")
      .select("storage_key")
      .eq("storage_key", dataKey)
      .eq("scope", "shared")
      .is("owner_id", null)
      .maybeSingle();
    if (blobReadError) throw blobReadError;
    if (!existingBlob) {
      const { error: blobWriteError } = await admin.from("funnel_storage").insert({
        storage_key: dataKey,
        scope: "shared",
        owner_id: null,
        value: records,
        updated_by: null,
        updated_at: now
      });
      if (blobWriteError) throw blobWriteError;
    }

    const { data: existingPlatformBlob, error: platformReadError } = await admin.from("funnel_storage")
      .select("storage_key")
      .eq("storage_key", platformDataKey)
      .eq("scope", "shared")
      .is("owner_id", null)
      .maybeSingle();
    if (platformReadError) throw platformReadError;
    if (!existingPlatformBlob) {
      const { error: platformWriteError } = await admin.from("funnel_storage").insert({
        storage_key: platformDataKey,
        scope: "shared",
        owner_id: null,
        value: platform,
        updated_by: null,
        updated_at: now
      });
      if (platformWriteError) throw platformWriteError;
    }

    const manifest = {
      __dailyRecordBackup: true,
      date,
      timeZone: TIME_ZONE,
      count: records.length,
      checksum,
      dataKey,
      platformChecksum,
      platformDataKey,
      storageItems: platform.storage.length,
      profiles: platform.profiles.length
    };
    const { error: manifestError } = await admin.from("funnel_storage").upsert({
      storage_key: dailyKey,
      scope: "shared",
      owner_id: null,
      value: manifest,
      updated_by: null,
      updated_at: now
    });
    if (manifestError) throw manifestError;

    await admin.from("funnel_audit_log").insert({
      user_id: null,
      action: "MONTHLY_RECORD_BACKUP_CREATED",
      storage_key: dailyKey,
      detail: {
        count: records.length,
        storageItems: platform.storage.length,
        profiles: platform.profiles.length,
        checksum,
        reusedData: Boolean(existingBlob),
        reusedPlatformData: Boolean(existingPlatformBlob)
      }
    });
    await removeExpiredBackups(admin, date);

    return Response.json({
      ok: true,
      date,
      count: records.length,
      storageItems: platform.storage.length,
      profiles: platform.profiles.length,
      reusedData: Boolean(existingBlob),
      reusedPlatformData: Boolean(existingPlatformBlob),
      retentionDays: RETENTION_DAYS
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "No fue posible crear el respaldo diario" }, { status: 500 });
  }
}
