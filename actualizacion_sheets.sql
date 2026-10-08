-- =====================================================================
--  SISERO · Actualización: copia automática a Google Sheets
--  Pégalo completo en Supabase → SQL Editor → New query y presiona RUN.
--  Antes de correrlo cambia LECTOR_CORREO@gmail.com (al final) por el correo
--  de la cuenta de solo lectura que usará la hoja de Google.
-- =====================================================================

-- Cuentas de solo lectura (no pueden crear, editar ni borrar nada)
create table if not exists public.lectores (
  email  text primary key check (email = lower(email)),
  creado timestamptz not null default now()
);
alter table public.lectores enable row level security;
drop policy if exists admin_todo on public.lectores;
create policy admin_todo on public.lectores for all to authenticated using (es_admin()) with check (es_admin());

create or replace function public.es_lector() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lectores where email = mi_email())
$$;

-- Registros recibidos después de una fecha (se usa la hora en que llegaron al servidor,
-- así también se copian los que se guardaron sin señal y se subieron tarde).
create or replace function public.exportar_registros(p_desde timestamptz, p_limite integer default 1000)
returns table (id uuid, recibido timestamptz, fecha text, hora text, tipo text, turno text,
               empleado text, numero text, puesto text, servicio text, servicio_base text,
               cubre boolean, ubicacion text, distancia_m integer, lat double precision, lng double precision,
               sin_senal boolean, foto_path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or es_lector()) then raise exception 'SIN_PERMISO'; end if;
  return query
    select r.id, r.hora_recibido,
           to_char(r.fecha_hora at time zone 'America/Mexico_City', 'DD/MM/YYYY'),
           to_char(r.fecha_hora at time zone 'America/Mexico_City', 'HH24:MI:SS'),
           r.tipo, r.turno, e.nombre, e.numero, e.puesto, s.nombre, b.nombre,
           (r.servicio_base_id is distinct from r.servicio_id),
           case when r.lat is null then 'Sin GPS' when r.fuera_zona then 'Fuera de zona'
                when r.distancia_m is null then 'Con GPS' else 'En servicio' end,
           r.distancia_m, r.lat, r.lng, r.diferido, r.foto_path
    from registros r
    join empleados e on e.id = r.empleado_id
    join servicios s on s.id = r.servicio_id
    left join servicios b on b.id = r.servicio_base_id
    where r.hora_recibido > coalesce(p_desde, '-infinity'::timestamptz)
    order by r.hora_recibido, r.id
    limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
end $$;

revoke all on function public.exportar_registros(timestamptz, integer) from public, anon;
grant execute on function public.exportar_registros(timestamptz, integer) to authenticated;

-- El lector puede generar enlaces de las fotos de los registros
drop policy if exists "fotos ver" on storage.objects;
create policy "fotos ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (
    public.es_admin()
    or (public.es_lector() and name like 'registros/%')
    or (public.mi_servicio() is not null and name like 'altas/%')));

-- Tu cuenta de solo lectura para Google Sheets
insert into public.lectores (email) values (lower('LECTOR_CORREO@gmail.com'))
on conflict do nothing;

notify pgrst, 'reload schema';
