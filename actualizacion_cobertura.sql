-- =====================================================================
--  SISERO · Actualización: ELEMENTOS REQUERIDOS POR DÍA
--  Pégalo en Supabase → SQL Editor → New query y presiona RUN.
--  Se puede correr más de una vez. No borra nada.
-- =====================================================================

-- 7 números: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo (0 = no abre)
alter table public.servicios add column if not exists requeridos integer[];

do $$ begin
  alter table public.servicios add constraint servicios_requeridos_chk
    check (requeridos is null or (array_length(requeridos, 1) = 7 and 0 <= all(requeridos)));
exception when duplicate_object then null; end $$;

-- Los servicios que ya existen toman su número anterior para los 7 días
update public.servicios
set requeridos = array_fill(elementos_turno, array[7])
where requeridos is null;

notify pgrst, 'reload schema';
