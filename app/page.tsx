"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";
import FunnelKpiApp from "./FunnelKpiOriginal";

const SESSION_KEY = "funnel-kpi-session-v1";
const RECORDS_KEY = "funnel-kpi-v2-records";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const profileRequiresMfa = (profile: any) =>
  profile?.role === "admin" ||
  profile?.role === "capturista" ||
  profile?.role === "bdc_operador" ||
  profile?.permissions?.canCapture === true;

function browserClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function installStorageBridge(accessToken: string, profile: any, supabase: any) {
  const session = {
    id: profile.id, username: profile.email, name: profile.name || profile.email,
    role: profile.role || "capturista", sucursal: profile.branch || null,
    branches: profile.branches || [], brands: profile.brands || [], manager: profile.manager || null,
    customViews: profile.permissions?.views || [], customCanCapture: Boolean(profile.permissions?.canCapture),
    captureFields: profile.permissions?.captureFields || [], active: profile.active !== false
  };
  let currentAccessToken = accessToken;
  const request = async (url: string, init: RequestInit = {}) => {
    const send = (token: string) => fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), authorization: `Bearer ${token}` }
    });
    let response = await send(currentAccessToken);
    if (response.status === 401) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session?.access_token) {
        currentAccessToken = refreshed.session.access_token;
        response = await send(currentAccessToken);
      }
    }
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
          const query = new URLSearchParams({ key, scope: shared ? "shared" : "personal", page: String(page), limit: "1000" });
          const payload = await request(`/api/storage?${query}`);
          records.push(...JSON.parse(payload.value || "[]"));
          if (!payload.hasMore) break;
        }
        return { value: JSON.stringify(records) };
      }
      const query = new URLSearchParams({ key, scope: shared ? "shared" : "personal" });
      try {
        return await request(`/api/storage?${query}`);
      } catch (error: any) {
        if (String(error?.message || "").includes("No encontrado")) return null;
        throw error;
      }
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
  const [captchaToken, setCaptchaToken] = useState("");
  const [mfaStage, setMfaStage] = useState<"none" | "enroll" | "challenge">("none");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [pendingProfile, setPendingProfile] = useState<any>(null);
  const captchaContainer = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || authenticated || !captchaContainer.current) return;

    const renderCaptcha = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !captchaContainer.current || captchaWidgetId.current) return;
      captchaWidgetId.current = turnstile.render(captchaContainer.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (token: string) => {
          setCaptchaToken(token);
          setError("");
        },
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => {
          setCaptchaToken("");
          setError("No fue posible validar la protección anti-bots. Recarga la página.");
        }
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-funnel-turnstile="true"]');
    if ((window as any).turnstile) renderCaptcha();
    else if (existing) existing.addEventListener("load", renderCaptcha, { once: true });
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.funnelTurnstile = "true";
      script.addEventListener("load", renderCaptcha, { once: true });
      document.head.appendChild(script);
    }

    return () => existing?.removeEventListener("load", renderCaptcha);
  }, [authenticated, ready]);

  const resetCaptcha = () => {
    setCaptchaToken("");
    const turnstile = (window as any).turnstile;
    if (turnstile && captchaWidgetId.current) turnstile.reset(captchaWidgetId.current);
  };

  const loadProfile = async (accessToken: string) => {
    const response = await fetch("/api/storage?key=profile&scope=personal", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Tu perfil no está activo o no tiene acceso.");
    }
    const payload = await response.json();
    return JSON.parse(payload.value);
  };

  const activate = async (accessToken: string, suppliedProfile?: any) => {
    const profile = suppliedProfile || await loadProfile(accessToken);
    const session = installStorageBridge(accessToken, profile, supabase);
    setPlatformSession(session);
    setAuthenticated(true);
    setMfaStage("none");
    setMfaCode("");
  };

  const secureActivate = async (accessToken: string) => {
    const profile = await loadProfile(accessToken);
    if (!profileRequiresMfa(profile)) {
      await activate(accessToken, profile);
      return;
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel === "aal2") {
      await activate(accessToken, profile);
      return;
    }

    setPendingProfile(profile);
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verified = factors?.totp?.[0];
    if (verified) {
      setMfaFactorId(verified.id);
      setMfaStage("challenge");
      return;
    }

    for (const factor of factors?.all || []) {
      if (factor.factor_type === "totp" && factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Funnel CR3"
    });
    if (enrollmentError || !enrollment) throw enrollmentError || new Error("No fue posible iniciar el registro MFA.");
    setMfaFactorId(enrollment.id);
    setMfaQr(enrollment.totp.qr_code);
    setMfaSecret(enrollment.totp.secret);
    setMfaStage("enroll");
  };

  const verifyMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Ingresa el código de seis dígitos de tu aplicación Authenticator.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode
    });
    if (verifyError) {
      setError("El código no es válido o ya venció. Genera uno nuevo e inténtalo otra vez.");
      setMfaCode("");
      setBusy(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      setError("No fue posible actualizar la sesión después de MFA.");
      setBusy(false);
      return;
    }
    await activate(data.session.access_token, pendingProfile);
    setBusy(false);
  };

  const cancelMfa = async () => {
    if (mfaStage === "enroll" && mfaFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    }
    await supabase.auth.signOut();
    setMfaStage("none");
    setMfaCode("");
    setMfaFactorId("");
    setMfaQr("");
    setMfaSecret("");
    setPendingProfile(null);
    resetCaptcha();
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      try { if (data.session?.access_token) await secureActivate(data.session.access_token); }
      finally { setReady(true); }
    });
  }, [supabase]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Completa la validación anti-bots antes de ingresar.");
      return;
    }
    setBusy(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: TURNSTILE_SITE_KEY ? { captchaToken } : undefined
    });
    if (loginError || !data.session) setError(loginError?.message || "No fue posible iniciar sesión.");
    if (loginError || !data.session) resetCaptcha();
    else {
      try { await secureActivate(data.session.access_token); }
      catch (activationError: any) {
        setError(activationError.message);
        await supabase.auth.signOut();
        resetCaptcha();
      }
    }
    setBusy(false);
  };

  if (!ready) return <div className="bridge-loading"><img src="/logo-cr3-drive.png" alt="Grupo CR3 Drive" /><span>Conectando con Supabase…</span></div>;
  if (!authenticated && mfaStage !== "none") return (
    <main className="supabase-login">
      <form onSubmit={verifyMfa} className="mfa-form">
        <div className="login-logos">
          <img className="login-cr3-logo" src="/logo-cr3-drive.png" alt="Grupo CR3 Drive" />
          <span aria-hidden="true" />
          <img className="login-brand-logos" src="/logos-marcas-negros.png" alt="Chevrolet, Buick, GMC y Cadillac" />
        </div>
        <div className="login-eyebrow">Verificación de seguridad</div>
        <h1>{mfaStage === "enroll" ? "Protege tu cuenta" : "Código de acceso"}</h1>
        {mfaStage === "enroll" ? (
          <>
            <p className="login-intro">
              Escanea este código con Microsoft Authenticator, Google Authenticator o una aplicación TOTP.
            </p>
            <div className="mfa-qr-shell">
              <img src={mfaQr} alt="Código QR para configurar autenticación multifactor" />
            </div>
            <details className="mfa-manual-secret">
              <summary>No puedo escanear el código</summary>
              <p>Captura manualmente esta clave en tu aplicación:</p>
              <code>{mfaSecret}</code>
            </details>
          </>
        ) : (
          <p className="login-intro">
            Introduce el código vigente de tu aplicación Authenticator para continuar.
          </p>
        )}
        <label>
          Código de seis dígitos
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={mfaCode}
            onChange={event => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="mfa-code-input"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="login-submit" disabled={busy || mfaCode.length !== 6}>
          {busy ? "Verificando…" : mfaStage === "enroll" ? "Activar MFA e ingresar" : "Verificar e ingresar"}
        </button>
        <button type="button" className="mfa-cancel" onClick={cancelMfa} disabled={busy}>
          Cancelar y cerrar sesión
        </button>
        <small>No compartas el código QR, la clave manual ni los códigos temporales.</small>
      </form>
    </main>
  );
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
        {TURNSTILE_SITE_KEY ? (
          <div className="turnstile-shell">
            <div ref={captchaContainer} />
          </div>
        ) : (
          <p className="captcha-configuration-note">
            Protección anti-bots pendiente de configurar.
          </p>
        )}
        {error && <p className="login-error">{error}</p>}
        <button className="login-submit" disabled={busy}>{busy ? "Validando…" : "Ingresar"}</button>
        <small>El acceso y los permisos se administran desde Supabase.</small>
      </form>
    </main>
  );
  return <FunnelKpiApp authenticatedSession={platformSession} />;
}
