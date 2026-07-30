# Seguridad de la plataforma con Supabase Free y Vercel Hobby

Fecha de revisión: 30 de julio de 2026.

## Resultado de los riesgos del reporte

| ID | Control | Estado en el proyecto | ¿Puede hacerse gratis? | Limitación de licencia |
|---|---|---|---|---|
| R-01 | Autorización por sucursal, marca y gerente en el servidor | Corregido en `/api/storage` para lectura, importación, reemplazo y borrado de registros. Las operaciones globales son exclusivas del administrador. | Sí | Ninguna. |
| R-02 | MFA para administradores y capturistas | Pendiente de agregar el enrolamiento a la interfaz y activarlo. | Sí, con MFA básico TOTP de Supabase | MFA por teléfono y controles avanzados requieren plan de pago. |
| R-03 | Evitar altas automáticas | Corregido: una cuenta de Auth sin perfil activo queda rechazada. | Sí | Se debe desactivar también el registro público en Supabase Auth. |
| R-04 | Respaldos y restauración comprobada | La plataforma conserva el respaldo JSON manual. | Parcial | Los respaldos diarios administrados con retención de 7 días son de Supabase Pro. PITR tiene costo adicional. |
| R-05 | Contraseñas robustas | Corregido: 12 caracteres, mayúscula, minúscula, número y símbolo. | Parcial | La detección automática de contraseñas filtradas requiere Supabase Pro. |
| R-06 | Cabeceras de seguridad | Corregido: CSP, HSTS, nosniff, anti-frame, referrer y permissions policy. | Sí | Ninguna. |
| R-07 | CAPTCHA y limitación de abuso | Pendiente de configuración externa. | Sí, con límites | Supabase permite CAPTCHA; Vercel Hobby incluye una regla de rate limit. Más reglas y mayor operación requieren Pro. |
| R-08 | Validación de importaciones en servidor | Mejorado: límite de payload, máximo de filas por lote, esquema básico, periodo y alcance autorizado. | Sí | Ninguna. |
| R-09 | Auditoría, alertas y retención | La bitácora propia registra cambios, denegaciones y borrados. | Parcial | Supabase Free y Vercel Hobby conservan logs administrados por aproximadamente una hora. Retención amplia y Log Drains requieren pago. |
| R-10 | Dependencias y build seguro | Se agregó Dependabot y un workflow semanal con `pnpm audit` y build. | Sí | Sujeto a los límites gratuitos de GitHub Actions. |

## Configuración gratuita que todavía debe hacerse en los paneles

### Supabase

1. **Authentication > Providers > Email**
   - Desactivar `Allow new users to sign up`.
   - Mantener confirmación de correo si se usan invitaciones.
2. **Authentication > Bot and Abuse Protection**
   - Activar Cloudflare Turnstile o hCaptcha.
3. **Authentication > Rate Limits**
   - Revisar límites de inicio de sesión, recuperación y OTP.
4. **Authentication > Password Security**
   - Configurar longitud mínima de 12 y requerir mayúsculas, minúsculas, números y símbolos.
5. **Database > Security Advisor**
   - Confirmar que no existan tablas públicas sin RLS.
6. Activar MFA básico para administradores y capturistas cuando la pantalla de enrolamiento esté disponible.

### Vercel

1. **Firewall**
   - Crear la única regla gratuita de rate limit para `/api/storage`.
   - Recomendación inicial: ventana de 60 segundos, límite conservador y primero modo `Log`.
2. **Environment Variables**
   - Marcar `SUPABASE_SERVICE_ROLE_KEY` como `Sensitive`.
   - No exponerla con prefijo `NEXT_PUBLIC_`.
3. **Git**
   - Proteger la rama `main` y exigir que el workflow de seguridad termine correctamente antes de integrar cambios.

## Controles que no quedan cubiertos completamente con licencias gratuitas

- Respaldos diarios administrados y descargables con retención.
- Point-in-Time Recovery.
- Protección contra contraseñas filtradas.
- Retención amplia de logs y Log Drains.
- Varias reglas de WAF/rate limit y colaboración con RBAC de equipo.
- SLA, soporte de producción y controles avanzados de organización.

## Consideración comercial importante

Vercel declara que Hobby es para uso personal y no comercial. Como esta plataforma
se utiliza para la operación de una empresa, el plan correcto para producción es
**Vercel Pro**, aunque técnicamente la aplicación pueda ejecutar en Hobby.

Para una operación empresarial mínima se recomienda:

- **Supabase Pro**, principalmente por respaldos, retención de logs, continuidad y no suspensión por inactividad.
- **Vercel Pro**, por uso comercial, colaboración, mayor retención de logs y capacidad operativa.

## Fuentes oficiales

- Supabase Pricing: https://supabase.com/pricing
- Supabase Production Checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase Password Security: https://supabase.com/docs/guides/auth/password-security
- Supabase CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel WAF Rate Limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
