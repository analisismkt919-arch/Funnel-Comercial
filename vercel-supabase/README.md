# Funnel KPI CR3 — GitHub + Supabase + Vercel

Esta carpeta contiene la versión completa de la plataforma preparada para:

- GitHub como repositorio.
- Vercel como alojamiento.
- Supabase Auth para inicio de sesión.
- Supabase PostgreSQL para registros, catálogos, BDC, industria, metas y configuración.
- Eliminación permanente sincronizada.

## 1. Crear el proyecto en Supabase

1. Crea un proyecto en https://supabase.com.
2. Abre **SQL Editor → New query**.
3. Copia el contenido de `supabase/schema.sql`.
4. Presiona **Run**.

El script crea:

- `funnel_profiles`: usuarios, roles, marcas y sucursales permitidas.
- `funnel_records`: registros individuales del funnel.
- `funnel_storage`: equipos, metas, BDC, industria, catálogos y configuración.
- `funnel_audit_log`: historial de cambios y eliminaciones.
- `replace_funnel_records`: reemplazo transaccional que elimina físicamente los registros borrados.

## 2. Crear al administrador

1. En Supabase abre **Authentication → Users → Add user**.
2. Crea el usuario con correo y contraseña.
3. En SQL Editor ejecuta:

```sql
update public.funnel_profiles
set role='admin', name='Administrador'
where email='TU_CORREO@EMPRESA.COM';
```

Si el usuario de Authentication fue creado antes de ejecutar el esquema y aparece
“Tu perfil no está activo o no tiene acceso”, ejecuta:

```sql
insert into public.funnel_profiles (id,email,name,role,active)
select id,email,'Administrador','admin',true
from auth.users
where email='TU_CORREO@EMPRESA.COM'
on conflict (id) do update
set email=excluded.email, name=excluded.name, role='admin', active=true;
```

## 3. Obtener las variables

En **Project Settings → API** copia:

- Project URL.
- Publishable/anon key.
- service_role key.

La `service_role` es privada. Nunca debe colocarse en código, GitHub ni variables que comiencen con `NEXT_PUBLIC_`.

## 4. Subir a GitHub

Sube **el contenido de esta carpeta** a la raíz de un repositorio nuevo.

No subas:

- `.env`
- `.env.local`
- `node_modules`
- `.next`

Ya están contemplados en `.gitignore`.

## 5. Desplegar en Vercel

1. En Vercel selecciona **Add New → Project**.
2. Conecta el repositorio de GitHub.
3. Vercel detectará **Next.js**.
4. En **Settings → Environment Variables** agrega:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

5. Pulsa **Deploy**.

## 6. Cómo funciona el borrado permanente

Cuando se guarda la captura general:

1. Vercel recibe el arreglo completo vigente.
2. Supabase actualiza los registros conservados.
3. Inserta los registros nuevos.
4. Ejecuta `DELETE` sobre los registros que ya no existen en la plataforma.
5. Registra la acción en `funnel_audit_log`.

Cuando se elimina por completo una configuración compartida, `/api/storage` ejecuta un `DELETE` real en `funnel_storage`.

Esto significa que el registro deja de existir en las tablas activas de Supabase. Las copias de seguridad administradas por Supabase, si están habilitadas en tu plan, conservan su propia política independiente.

## 7. Migrar información de la plataforma actual

La base de Sites/Cloudflare y Supabase son servicios distintos. Para migrar:

1. Ingresa como administrador a la plataforma anterior.
2. Presiona **Respaldo completo**. Se descargará un archivo JSON.
3. Ingresa a la versión de Vercel/Supabase como administrador.
4. Presiona **Migrar respaldo** y selecciona ese JSON.
5. Al terminar, la plataforma se recargará con registros, equipos, catálogos,
   metas, bloqueos, BDC e Industria.
6. Revisa los usuarios de acceso, que se administran por separado en Supabase.

La primera vez que inicia, la plataforma crea en Supabase los catálogos base que todavía no existan.

## 8. Actualizaciones futuras

Flujo recomendado:

1. Modificar el proyecto local.
2. Hacer commit y push a GitHub.
3. Vercel crea un deployment automático.
4. La base Supabase permanece intacta entre deployments.

Nunca se debe guardar información productiva dentro del repositorio.

## Desarrollo local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abre http://localhost:3000.

## Comprobación antes de publicar

```bash
npm run build
```
