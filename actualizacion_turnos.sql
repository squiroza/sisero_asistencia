-- =====================================================================
--  SISERO · Actualización: TURNOS
--  Pégalo completo en Supabase → SQL Editor → New query y presiona RUN.
--  Se puede correr más de una vez sin problema. No borra ningún registro.
-- =====================================================================

-- ---------- Columnas nuevas -------------------------------------------
alter table public.empleados add column if not exists turno text;
alter table public.registros add column if not exists turno text;

do $$ begin
  alter table public.empleados add constraint empleados_turno_chk
    check (turno is null or turno in ('12x12 D','12x12 N','24x24','12x24','12x36'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.registros add constraint registros_turno_chk
    check (turno is null or turno in ('12x12 D','12x12 N','24x24','12x24','12x36'));
exception when duplicate_object then null; end $$;

-- Turno sugerido: los esquemas 24x24, 12x24 y 12x36 se respetan;
-- en 12x12 (o sin turno asignado) decide la hora: 05:00–16:59 = D, resto = N.
create or replace function public.turno_sugerido(p_asignado text, p_hora timestamptz)
returns text language sql stable as $$
  select case
    when p_asignado in ('24x24','12x24','12x36') then p_asignado
    when extract(hour from p_hora at time zone 'America/Mexico_City') between 5 and 16 then '12x12 D'
    else '12x12 N'
  end
$$;

-- ---------- Checador: elementos con su turno --------------------------
drop function if exists public.checador_elementos();
create function public.checador_elementos()
returns table (id uuid, nombre text, numero text, puesto text, foto_path text,
               base_id uuid, base_nombre text, turno text,
               ultimo_tipo text, ultimo_hora timestamptz, ultimo_turno text)
language plpgsql stable security definer set search_path = public as $$
begin
  if mi_servicio() is null then
    raise exception 'CELULAR_NO_AUTORIZADO';
  end if;
  return query
    select e.id, e.nombre, e.numero, e.puesto, e.foto_path, e.servicio_base_id, s.nombre, e.turno,
           u.tipo, u.fecha_hora, u.turno
    from empleados e
    left join servicios s on s.id = e.servicio_base_id
    left join lateral (
      select r.tipo, r.fecha_hora, r.turno from registros r
      where r.empleado_id = e.id order by r.fecha_hora desc limit 1
    ) u on true
    where e.activo
    order by e.nombre;
end $$;

-- ---------- Checador: registrar con turno -----------------------------
drop function if exists public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz);
drop function if exists public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz,text);
create function public.registrar_asistencia(
  p_client_id    text,
  p_empleado     uuid,
  p_tipo         text,
  p_lat          double precision,
  p_lng          double precision,
  p_precision    double precision,
  p_foto_path    text,
  p_hora_celular timestamptz,
  p_turno        text default null
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
  v_turno   text;
  v_reg     registros%rowtype;
begin
  select * into v_disp from dispositivos where email = v_email and activo;
  if not found then raise exception 'CELULAR_NO_AUTORIZADO'; end if;
  if p_tipo not in ('Entrada','Salida') then raise exception 'TIPO_INVALIDO'; end if;

  select * into v_reg from registros where client_id = p_client_id;
  if found then
    return json_build_object('estado','ok','id',v_reg.id,'fecha_hora',v_reg.fecha_hora,'turno',v_reg.turno,'repetido',true);
  end if;

  select * into v_emp from empleados where id = p_empleado and activo;
  if not found then raise exception 'ELEMENTO_NO_ENCONTRADO'; end if;
  select * into v_serv from servicios where id = v_disp.servicio_id;

  v_hora := now();
  if p_hora_celular is not null and p_hora_celular < now() - interval '2 minutes'
     and p_hora_celular > now() - interval '24 hours' then
    v_hora := p_hora_celular;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_empleado::text));

  select * into v_ultimo from registros where empleado_id = p_empleado
  order by fecha_hora desc limit 1;
  if found and v_ultimo.tipo = p_tipo and abs(extract(epoch from (v_hora - v_ultimo.fecha_hora))) < 30 * 60 then
    return json_build_object('estado','duplicado','tipo',v_ultimo.tipo,'fecha_hora',v_ultimo.fecha_hora,
                             'servicio',(select nombre from servicios where id = v_ultimo.servicio_id));
  end if;

  -- Turno: la salida hereda el de su entrada; la entrada usa el elegido o el sugerido.
  if p_tipo = 'Salida' and v_ultimo.tipo = 'Entrada'
     and v_hora - v_ultimo.fecha_hora < interval '30 hours' and v_ultimo.turno is not null then
    v_turno := v_ultimo.turno;
  elsif p_turno in ('12x12 D','12x12 N','24x24','12x24','12x36') then
    v_turno := p_turno;
  else
    v_turno := turno_sugerido(v_emp.turno, v_hora);
  end if;

  if p_lat is not null and p_lng is not null and v_serv.lat is not null and v_serv.lng is not null then
    v_dist := distancia_m(p_lat, p_lng, v_serv.lat, v_serv.lng);
  end if;

  insert into registros (client_id, empleado_id, servicio_id, servicio_base_id, tipo, fecha_hora,
                         diferido, lat, lng, precision_m, distancia_m, fuera_zona, foto_path, dispositivo, turno)
  values (p_client_id, p_empleado, v_serv.id, v_emp.servicio_base_id, p_tipo, v_hora,
          v_hora < now() - interval '2 minutes', p_lat, p_lng, p_precision, v_dist,
          case when v_dist is null then null else v_dist > v_serv.radio_m end,
          p_foto_path, v_email, v_turno)
  returning * into v_reg;

  update dispositivos set ultimo_registro = now() where email = v_email;

  return json_build_object('estado','ok','id',v_reg.id,'fecha_hora',v_reg.fecha_hora,'turno',v_reg.turno,
                           'distancia_m',v_reg.distancia_m,'fuera_zona',v_reg.fuera_zona,
                           'cubre', v_emp.servicio_base_id is distinct from v_serv.id);
end $$;

-- ---------- Vista del panel (ahora incluye el turno) ------------------
drop view if exists public.v_registros;
create view public.v_registros with (security_invoker = on) as
select r.*, e.nombre as empleado, e.numero, e.puesto,
       s.nombre as servicio, b.nombre as servicio_base,
       (r.servicio_base_id is distinct from r.servicio_id) as cubre
from registros r
join empleados e on e.id = r.empleado_id
join servicios s on s.id = r.servicio_id
left join servicios b on b.id = r.servicio_base_id;

-- ---------- Reporte por turno (con turno y turnos de 24 h) ------------
drop function if exists public.reporte_turnos(date,date,uuid);
create function public.reporte_turnos(p_desde date, p_hasta date, p_servicio uuid default null)
returns table (empleado text, numero text, puesto text, servicio text, servicio_base text, cubre boolean,
               turno text, fecha date, entrada timestamptz, entrada_foto text, entrada_fuera boolean, entrada_dist integer,
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
      and x.fecha_hora <  (p_hasta + 3)::timestamp at time zone 'America/Mexico_City'
    window w as (partition by x.empleado_id order by x.fecha_hora)
  ), t as (
    select r.empleado_id, r.servicio_id, r.servicio_base_id, r.turno, r.fecha_hora as h_ent,
           r.foto_path as f_ent, r.fuera_zona as z_ent, r.distancia_m as d_ent,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '30 hours' then r.sig_hora end as h_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '30 hours' then r.sig_foto end as f_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '30 hours' then r.sig_fuera end as z_sal,
           case when r.sig_tipo = 'Salida' and r.sig_hora - r.fecha_hora < interval '30 hours' then r.sig_dist end as d_sal,
           (r.fecha_hora at time zone 'America/Mexico_City')::date as dia
    from r where r.tipo = 'Entrada'
    union all
    select r.empleado_id, r.servicio_id, r.servicio_base_id, r.turno, null, null, null, null,
           r.fecha_hora, r.foto_path, r.fuera_zona, r.distancia_m,
           (r.fecha_hora at time zone 'America/Mexico_City')::date
    from r where r.tipo = 'Salida'
      and not (r.ant_tipo = 'Entrada' and r.fecha_hora - r.ant_hora < interval '30 hours')
  )
  select e.nombre, e.numero, e.puesto, s.nombre, b.nombre,
         (t.servicio_base_id is distinct from t.servicio_id),
         t.turno, t.dia, t.h_ent, t.f_ent, t.z_ent, t.d_ent, t.h_sal, t.f_sal, t.z_sal, t.d_sal,
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

-- ---------- Permisos --------------------------------------------------
revoke all on function public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz,text) from public, anon;
revoke all on function public.checador_elementos() from public, anon;
revoke all on function public.reporte_turnos(date,date,uuid) from public, anon;
grant execute on function public.registrar_asistencia(text,uuid,text,double precision,double precision,double precision,text,timestamptz,text) to authenticated;
grant execute on function public.checador_elementos() to authenticated;
grant execute on function public.reporte_turnos(date,date,uuid) to authenticated;

-- Avisa a la API que hay funciones nuevas
notify pgrst, 'reload schema';
