"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import FunnelKpiApp from "./FunnelKpiOriginal";

const SESSION_KEY = "funnel-kpi-session-v1";

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
}

export default function Home() {
  const supabase = useMemo(browserClient, []);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activate = async (accessToken: string) => {
    const response = await fetch("/api/storage?key=profile&scope=personal", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("Tu perfil no está activo o no tiene acceso.");
    const payload = await response.json();
    installStorageBridge(accessToken, JSON.parse(payload.value));
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

  if (!ready) return <div className="bridge-loading"><div>CR3</div><span>Conectando con Supabase…</span></div>;
  if (!authenticated) return <main className="supabase-login"><form onSubmit={login}><div className="login-mark">CR3</div><span>Plataforma de inteligencia comercial</span><h1>Iniciar sesión</h1><label>Correo electrónico<input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p>{error}</p>}<button disabled={busy}>{busy ? "Validando…" : "Ingresar"}</button><small>El acceso y los permisos se administran desde Supabase.</small></form></main>;
  return <FunnelKpiApp />;
}
