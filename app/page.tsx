"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";
import FunnelKpiApp from "./FunnelKpiOriginal";

const SESSION_KEY = "funnel-kpi-session-v1";
const RECORDS_KEY = "funnel-kpi-v2-records";

function browserClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function installStorageBridge(accessToken: string, profile: any) {
  const session = {
    id: profile.id, username: profile.email, name: profile.name || profile.email,
    role: profile.role || "capturista", sucursal: profile.branch || null,
    branches: profile.branches || [], brands: profile.brands || [], manager: profile.manager || null,
    customViews: profile.permissions?.views || [], customCanCapture: Boolean(profile.permissions?.canCapture),
    captureFields: profile.permissions?.captureFields || [], active: profile.active !== false
  };
  const request = async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "No fue posible completar la operación");
    }
    return response.json();
  };
  (window as any).storage = {
    async get(key: string, shared = true) {
      if (key === SESSION_KEY) return { value: JSON.stringify(session) };
      if (key === RECORDS_KEY) {
        const records: any[] = [];
        for (let page = 0; page < 1000; page++) {
          const query = new URLSearchParams({ key, scope: shared ? "shared" : "personal", page: String(page), limit: "500" });
          const payload = await request(`/api/storage?${query}`);
          records.push(...JSON.parse(payload.value || "[]"));
          if (!payload.hasMore) break;
        }
        return { value: JSON.stringify(records) };
      }
      const query = new URLSearchParams({ key, scope: shared ? "shared" : "personal" });
      const response = await fetch(`/api/storage?${query}`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("No fue posible leer la información");
      return response.json();
    },
    async set(key: string, value: string, shared = true) {
      if (key === SESSION_KEY) return { ok: true };
      return request("/api/storage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, value, scope: shared ? "shared" : "personal" }) });
    },
    async replaceRecords(records: any[]) {
      await request("/api/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: RECORDS_KEY, value: "[]", scope: "shared", mode: "clear" })
      });
      for (let start = 0; start < records.length; start += 250) {
        await request("/api/storage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: RECORDS_KEY,
            value: JSON.stringify(records.slice(start, start + 250)),
            scope: "shared",
            mode: "append"
          })
        });
      }
      return { ok: true };
    },
    async importRecords(records: any[]) {
      const periods = Array.from(new Map(records.map(record => [
        `${String(record?.sucursal || "")}||${String(record?.month || "")}`,
        { sucursal: String(record?.sucursal || ""), month: String(record?.month || "") }
      ])).values()).filter(period => period.sucursal && period.month);
      await request("/api/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: RECORDS_KEY,
          value: JSON.stringify(periods),
          scope: "shared",
          mode: "delete-periods"
        })
      });
      for (let start = 0; start < records.length; start += 250) {
        await request("/api/storage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: RECORDS_KEY,
            value: JSON.stringify(records.slice(start, start + 250)),
            scope: "shared",
            mode: "append"
          })
        });
      }
      return { ok: true };
    },
    async delete(key: string, shared = true) {
      if (key === SESSION_KEY) {
        await browserClient().auth.signOut();
        window.location.reload();
        return { ok: true };
      }
      const query = new URLSearchParams({ key, scope: shared ? "shared" : "personal" });
      return request(`/api/storage?${query}`, { method: "DELETE" });
    }
  };
  return session;
}

export default function Home() {
  const supabase = useMemo(browserClient, []);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [platformSession, setPlatformSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activate = async (accessToken: string) => {
    const response = await fetch("/api/storage?key=profile&scope=personal", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Tu perfil no está activo o no tiene acceso.");
    }
    const payload = await response.json();
    const session = installStorageBridge(accessToken, JSON.parse(payload.value));
    setPlatformSession(session);
    setAuthenticated(true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      try { if (data.session?.access_token) await activate(data.session.access_token); }
      finally { setReady(true); }
    });
  }, [supabase]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError || !data.session) setError(loginError?.message || "No fue posible iniciar sesión.");
    else {
      try { await activate(data.session.access_token); }
      catch (activationError: any) { setError(activationError.message); await supabase.auth.signOut(); }
    }
    setBusy(false);
  };

  if (!ready) return <div className="bridge-loading"><img src="/logo-cr3-drive.png" alt="Grupo CR3 Drive" /><span>Conectando con Supabase…</span></div>;
  if (!authenticated) return (
    <main className="supabase-login">
      <form onSubmit={login}>
        <div className="login-logos">
          <img className="login-cr3-logo" src="/logo-cr3-drive.png" alt="Grupo CR3 Drive" />
          <span aria-hidden="true" />
          <img className="login-brand-logos" src="/logos-marcas-negros.png" alt="Chevrolet, Buick, GMC y Cadillac" />
        </div>
        <div className="login-eyebrow">Plataforma Funnel de Inteligencia Comercial</div>
        <h1>Iniciar sesión</h1>
        <p className="login-intro">Consulta, captura y analiza el desempeño comercial de tus sucursales.</p>
        <label>
          Correo electrónico
          <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label>
          Contraseña
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="login-submit" disabled={busy}>{busy ? "Validando…" : "Ingresar"}</button>
        <small>El acceso y los permisos se administran desde Supabase.</small>
      </form>
    </main>
  );
  return <FunnelKpiApp authenticatedSession={platformSession} />;
}
