-- Ejecuta este archivo completo una sola vez:
-- Supabase > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists public.funnel_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role text not null default 'capturista',
  active boolean not null default true,
  branch text,
  branches jsonb not null default '[]'::jsonb,
  brands jsonb not null default '[]'::jsonb,
  manager text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funnel_records (
  id text primary key,
  month text not null,
  branch text not null,
  manager text not null,
  advisor text not null,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists funnel_records_period_idx on public.funnel_records(month, branch);
create index if not exists funnel_records_team_idx on public.funnel_records(manager, advisor);

create table if not exists public.funnel_storage (
  storage_key text not null,
  scope text not null check (scope in ('shared','personal')),
  owner_id uuid references auth.users(id) on delete cascade,
  owner_key text generated always as (coalesce(owner_id::text, '*')) stored,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint funnel_storage_unique unique(storage_key, scope, owner_key),
  constraint funnel_storage_owner_check check (
    (scope = 'shared' and owner_id is null) or
    (scope = 'personal' and owner_id is not null)
  )
);

create table if not exists public.funnel_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  storage_key text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_funnel_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.funnel_profiles(id,email,name)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'name',''))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_funnel_user_created on auth.users;
create trigger on_funnel_user_created
after insert on auth.users
for each row execute procedure public.handle_new_funnel_user();

-- Reemplazo transaccional:
-- actualiza registros existentes, crea nuevos y elimina físicamente los que
-- ya no vienen en la plataforma.
create or replace function public.replace_funnel_records(p_records jsonb, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'p_records debe ser un arreglo JSON';
  end if;

  delete from public.funnel_records current_record
  where not exists (
    select 1
    from jsonb_array_elements(p_records) item
    where coalesce(item->>'id','') = current_record.id
  );

  insert into public.funnel_records(id,month,branch,manager,advisor,payload,updated_by,updated_at)
  select
    coalesce(nullif(item->>'id',''), encode(digest(item::text,'sha256'),'hex')),
    coalesce(item->>'month',''),
    coalesce(item->>'sucursal',''),
    coalesce(item->>'manager','SIN ASIGNAR'),
    coalesce(item->>'vendor','SIN ASIGNAR'),
    item,
    p_user_id,
    now()
  from jsonb_array_elements(p_records) item
  on conflict(id) do update set
    month=excluded.month,
    branch=excluded.branch,
    manager=excluded.manager,
    advisor=excluded.advisor,
    payload=excluded.payload,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;
end;
$$;

alter table public.funnel_profiles enable row level security;
alter table public.funnel_records enable row level security;
alter table public.funnel_storage enable row level security;
alter table public.funnel_audit_log enable row level security;

-- La aplicación accede por las funciones protegidas de Vercel utilizando
-- service_role. Ninguna tabla queda expuesta directamente al navegador.
revoke all on public.funnel_profiles from anon, authenticated;
revoke all on public.funnel_records from anon, authenticated;
revoke all on public.funnel_storage from anon, authenticated;
revoke all on public.funnel_audit_log from anon, authenticated;
revoke all on function public.replace_funnel_records(jsonb,uuid) from anon, authenticated;

-- Después de crear el primer usuario en Authentication > Users:
-- update public.funnel_profiles
-- set role='admin', name='Administrador'
-- where email='TU_CORREO@EMPRESA.COM';
