-- Módulo Citas APV. Ejecuta este archivo una sola vez en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.funnel_sales_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_at timestamptz not null,
  branch text not null,
  manager text not null default '',
  advisor text not null,
  client_name text not null,
  phone text not null,
  email text not null default '',
  vehicle_interest text not null default '',
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','attended','no_show','cancelled')),
  attended_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnel_sales_appointments_date_idx on public.funnel_sales_appointments(appointment_at);
create index if not exists funnel_sales_appointments_scope_idx on public.funnel_sales_appointments(branch,manager,advisor);

create table if not exists public.funnel_public_links (
  link_key text primary key,
  token_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.funnel_sales_appointments enable row level security;
alter table public.funnel_public_links enable row level security;
revoke all on public.funnel_sales_appointments from anon, authenticated;
revoke all on public.funnel_public_links from anon, authenticated;

