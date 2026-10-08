-- =====================================================================
--  SISERO · Checador de asistencia
--  Base de datos para Supabase. Pégalo completo en  SQL Editor → New query
--  y presiona RUN una sola vez.
--  Antes de correrlo, cambia TU_CORREO@gmail.com (al final) por el correo
--  con el que vas a entrar al panel de administrador.
-- =====================================================================

-- ---------- Tablas ----------------------------------------------------

create table if not exists public.servicios (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null unique,
  cliente         text,
  direccion       text,
  lat             double precision,
  lng             double precision,
  radio_m         integer not null default 150 check (radio_m between 20 and 5000),
  elementos_turno integer not null default 1 check (elementos_turno >= 0),
  activo          boolean not null default true,
  creado          timestamptz not null default now()
);

create table if not exists public.empleados (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  numero           text unique,
  puesto           text not null,
  telefono         text,
  servicio_base_id uuid references public.servicios(id) on delete set null,
  foto_path        text,
  activo           boolean not null default true,
  creado           timestamptz not null default now()
);

-- Cada celular entra con su correo; aquí se le asigna su servicio.
create table if not exists public.dispositivos (
  email           text primary key check (email = lower(email)),
  servicio_id     uuid not null references public.servicios(id) on delete restrict,
  descripcion     text,
  activo          boolean not null default true,
  ultimo_registro timestamptz,
  creado          timestamptz not null default now()
);

create table if not exists public.administradores (
  email  text primary key check (email = lower(email)),
  creado timestamptz not null default now()
);

create table if not exists public.registros (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null unique,          -- evita duplicados por doble toque o reintentos
  empleado_id      uuid not null references public.empleados(id) on delete restrict,
  servicio_id      uuid not null references public.servicios(id) on delete restrict,  -- dónde checó (lo pone el celular)
  servicio_base_id uuid references public.servicios(id) on delete set null,           -- su servicio base en ese momento
  tipo             text not null check (tipo in ('Entrada','Salida')),
  fecha_hora       timestamptz not null default now(),
  hora_recibido    timestamptz not null default now(),
  diferido         boolean not null default false, -- se guardó sin señal y se subió después
  lat              double precision,
  lng              double precision,
  precision_m      double precision,
  distancia_m      integer,
  fuera_zona       boolean,
  foto_path        text,
  dispositivo      text not null
);

create index if not exists idx_reg_fecha    on public.registros (fecha_hora);
create index if not exists idx_reg_emp      on public.registros (empleado_id, fecha_hora);
create index if not exists idx_reg_servicio on public.registros (servicio_id, fecha_hora);

-- ---------- Funciones de apoyo ----------------------------------------

create or replace function public.mi_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where email = mi_email())
$$;

create or replace function public.mi_servicio() returns uuid
language sql stable security definer set search_path = public as $$
  select servicio_id from dispositivos where email = mi_email() and activo
$$;

create or replace function public.distancia_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns integer language sql immutable as $$
  select round(2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::integer
$$;

-- ---------- Funciones del checador ------------------------------------

-- Qué servicio tiene este celular (null si no está dado de alta).
create or replace function public.checador_info() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('email', d.email, 'servicio_id', s.id, 'servicio', s.nombre,
                           'lat', s.lat, 'lng', s.lng, 'radio_m', s.radio_m)
  from dispositivos d join servicios s on s.id = d.servicio_id
  where d.email = mi_email() and d.activo
$$;

-- Elementos activos con su último registro (para sugerir entrada o salida).
create or replace function public.checador_elementos()
returns table (id uuid, nombre text, numero text, puesto text, foto_path text,
               base_id uuid, base_nombre text, ultimo_tipo text, ultimo_hora timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if mi_servicio() is null then
    raise exception 'CELULAR_NO_AUTORIZADO';
  end if;
  return query
    select e.id, e.nombre, e.numero, e.puesto, e.foto_path, e.servicio_base_id, s.nombre,
           u.tipo, u.fecha_hora
    from empleados e
    left join servicios s on s.id = e.servicio_base_id
    left join lateral (
      select r.tipo, r.fecha_hora from registros r
      where r.empleado_id = e.id order by r.fecha_hora desc limit 1
    ) u on true
    where e.activo
    order by e.nombre;
end $$;

-- Guarda un registro. El servicio lo pone el celular, nunca el guardia.
create or replace function public.registrar_asistencia(
  p_client_id   text,
  p_empleado    uuid,
  p_tipo        text,
  p_lat         double precision,
  p_lng         double precision,
  p_precision   double precision,
  p_foto_path   text,
  p_hora_celular timestamptz
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := mi_email();
  v_disp    dispositivos%rowtype;
  v_serv    servicios%rowtype;
  v_emp     empleados%rowtype;
  v_ultimo  registros%rowtype;
  v_hora    timestamptz;
  v_dist    integer;
  v_reg     registros%rowtype;
begin
  select * into v_disp from dispositivos where email = v_email and activo;
  if not found then raise exception 'CELULAR_NO_AUTORIZADO'; end if;
  if p_tipo not in ('Entrada','Salida') then raise exception 'TIPO_INVALIDO'; end if;

  -- Reintento del mismo registro: se devuelve el que ya existe.
  select * into v_reg from registros where client_id = p_client_id;
  if found then
    return json_build_object('estado','ok','id',v_reg.id,'fecha_hora',v_reg.fecha_hora,'repetido',true);
  end if;

  select * into v_emp from empleados where id = p_empleado and activo;
  if not found then raise exception 'ELEMENTO_NO_ENCONTRADO'; end if;
  select * into v_serv from servicios where id = v_disp.servicio_id;

  -- Hora: la del celular si se guardó sin señal (máximo 24 h atrás), si no la del servidor.
  v_hora := now();
  if p_hora_celular is not null and p_hora_celular < now() - interval '2 minutes'
     and p_hora_celular > now() - interval '24 hours' then
    v_hora := p_hora_celular;
  end if;

  -- Un registro a la vez por elemento.
  perform pg_advisory_xact_lock(hashtext(p_empleado::text));

  -- Duplicado: mismo tipo en los últimos 30 minutos.
  select * into v_ultimo from registros where empleado_id = p_empleado
  order by fecha_hora desc limit 1;
  if found and v_ultimo.tipo = p_tipo and abs(extract(epoch from (v_hora - v_ultimo.fecha_hora))) < 30 * 60 then
    return json_build_object('estado','duplicado','tipo',v_ultimo.tipo,'fecha_hora',v_ultimo.fecha_hora,
                             'servicio',(select nombre from servicios where id = v_ultimo.servicio_id));
  end if;

  if p_lat is not null and p_lng is not null and v_serv.lat is not null and v_serv.lng is not null then
    v_dist := distancia_m(p_lat, p_lng, v_serv.lat, v_serv.lng);
  end if;

  insert into registros (client_id, empleado_id, servicio_id, servicio_base_id, tipo, fecha_hora,
                         diferido, lat, lng, precision_m, distancia_m, fuera_zona, foto_path, dispositivo)
  values (p_client_id, p_empleado, v_serv.id, v_emp.servicio_base_id, p_tipo, v_hora,
          v_hora < now() - interval '2 minutes', p_lat, p_lng, p_precision, v_dist,
          case when v_dist is null then null else v_dist > v_serv.radio_m end,
          p_foto_path, v_email)
  returning * into v_reg;

  update dispositivos set ultimo_registro = now() where email = v_email;

  return json_build_object('estado','ok','id',v_reg.id,'fecha_hora',v_reg.fecha_hora,
                           'distancia_m',v_reg.distancia_m,'fuera_zona',v_reg.fuera_zona,
                           'cubre', v_emp.servicio_base_id is distinct from v_serv.id);
end $$;

-- ---------- Vista y reporte para el administrador ---------------------

create or replace view public.v_registros with (security_invoker = on) as
select r.*, e.nombre as empleado, e.numero, e.puesto,
       s.nombre as servicio, b.nombre as servicio_base,
       (r.servicio_base_id is distinct from r.servicio_id) as cubre
from registros r
join empleados e on e.id = r.empleado_id
join servicios s on s.id = r.servicio_id
left join servicios b on b.id = r.servicio_base_id;

-- Un renglón por turno: cada entrada con su siguiente salida (máximo 24 h después).
create or replace function public.reporte_turnos(p_desde date, p_hasta date, p_servicio uuid default null)
returns table (empleado text, numero text, puesto text, servicio text, servicio_base text, cubre boolean,
               fecha date, entrada timestamptz, entrada_foto text, entrada_fuera boolean, entrada_dist integer,
               salida timestamptz, salida_foto text, salida_fuera boolean, salida_dist integer, minutos integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'SOLO_ADMIN'; end if;
  return query
  with r as (
    select x.*,
           lead(x.tipo)        over w as sig_tipo,
           lead(x.fecha_hora)  over w as sig_hora,
           lead(x.foto_path)   over w as sig_foto,
           lead(x.fuera_zona)  over w as sig_fuera,
           lead(x.distancia_m) over w as sig_dist,
           lag(x.tipo)         over w as ant_tipo,
           lag(x.fecha_hora)   over w as ant_hora
    from registros x
    where x.fecha_hora >= (p_desde - 2)::timestamp at time zone 'America/Mexico_City'
      and x.fecha_hora <  (p_hasta + 2)::timestamp at time zone 'America/Mexico_City'
    window w as (partition by x.empleado_id order by x.fecha_hora)
  ), t as (
    select r.empleado_id, r.servicio_id, r.servicio_base_id, r.fecha_hora as h_ent,
           r.foto_path as f_ent, r.fuera_zona as z_ent, r.distancia_m as d_ent,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '24 hours' then r.sig_hora end as h_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '24 hours' then r.sig_foto end as f_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '24 hours' then r.sig_fuera end as z_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '24 hours' then r.sig_dist end as d_sal,
           (r.fecha_hora at time zone 'America/Mexico_City')::date as dia
    from r where r.tipo = 'Entrada'
    union all
    -- Salidas sin entrada previa
    select r.empleado_id, r.servicio_id, r.servicio_base_id, null, null, null, null,
           r.fecha_hora, r.foto_path, r.fuera_zona, r.distancia_m,
           (r.fecha_hora at time zone 'America/Mexico_City')::date
    from r where r.tipo = 'Salida'
      and not (r.ant_tipo = 'Entrada' and r.fecha_hora - r.ant_hora < interval '24 hours')
  )
  select e.nombre, e.numero, e.puesto, s.nombre, b.nombre,
         (t.servicio_base_id is distinct from t.servicio_id),
         t.dia, t.h_ent, t.f_ent, t.z_ent, t.d_ent, t.h_sal, t.f_sal, t.z_sal, t.d_sal,
         case when t.h_ent is not null and t.h_sal is not null
              then (extract(epoch from (t.h_sal - t.h_ent)) / 60)::integer end
  from t
  join empleados e on e.id = t.empleado_id
  join servicios s on s.id = t.servicio_id
  left join servicios b on b.id = t.servicio_base_id
  where t.dia between p_desde and p_hasta
    and (p_servicio is null or t.servicio_id = p_servicio)
  order by e.nombre, coalesce(t.h_ent, t.h_sal);
end $$;

-- ---------- Seguridad (RLS) -------------------------------------------

alter table public.servicios       enable row level security;
alter table public.empleados       enable row level security;
alter table public.dispositivos    enable row level security;
alter table public.administradores enable row level security;
alter table public.registros       enable row level security;

drop policy if exists admin_todo on public.servicios;
create policy admin_todo on public.servicios for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists admin_todo on public.empleados;
create policy admin_todo on public.empleados for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists admin_todo on public.dispositivos;
create policy admin_todo on public.dispositivos for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists admin_lee on public.administradores;
create policy admin_lee on public.administradores for select to authenticated using (es_admin());
-- Registros: el administrador consulta y corrige; los celulares solo registran por la función.
drop policy if exists admin_lee on public.registros;
create policy admin_lee on public.registros for select to authenticated using (es_admin());
drop policy if exists admin_corrige on public.registros;
create policy admin_corrige on public.registros for update to authenticated using (es_admin()) with check (es_admin());
drop policy if exists admin_borra on public.registros;
create policy admin_borra on public.registros for delete to authenticated using (es_admin());

revoke all on function public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz) from public, anon;
revoke all on function public.checador_elementos() from public, anon;
revoke all on function public.checador_info() from public, anon;
revoke all on function public.reporte_turnos(date,date,uuid) from public, anon;
grant execute on function public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz) to authenticated;
grant execute on function public.checador_elementos() to authenticated;
grant execute on function public.checador_info() to authenticated;
grant execute on function public.reporte_turnos(date,date,uuid) to authenticated;

-- ---------- Fotos (Storage) -------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos subir" on storage.objects;
create policy "fotos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (
    public.es_admin() or (public.mi_servicio() is not null and name like 'registros/%')));

drop policy if exists "fotos ver" on storage.objects;
create policy "fotos ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (
    public.es_admin() or (public.mi_servicio() is not null and name like 'altas/%')));

drop policy if exists "fotos cambiar" on storage.objects;
create policy "fotos cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_admin());

drop policy if exists "fotos borrar" on storage.objects;
create policy "fotos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_admin());

-- ---------- Tiempo real (la pantalla de Asistencia se actualiza sola) --

do $$ begin
  alter publication supabase_realtime add table public.registros;
exception when duplicate_object then null; end $$;

-- ---------- Tu usuario de administrador -------------------------------

insert into public.administradores (email) values (lower('TU_CORREO@gmail.com'))
on conflict do nothing;
