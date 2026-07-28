-- Corrección para proyectos que ya ejecutaron la primera versión de schema.sql.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

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
    where coalesce(nullif(item->>'id',''), md5(item::text)) = current_record.id
  );

  insert into public.funnel_records(id,month,branch,manager,advisor,payload,updated_by,updated_at)
  select
    coalesce(nullif(item->>'id',''), md5(item::text)),
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

revoke all on function public.replace_funnel_records(jsonb,uuid) from anon, authenticated;
