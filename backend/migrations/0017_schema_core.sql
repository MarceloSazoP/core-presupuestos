-- Crear el schema core-presupuestos y trasladar todas las tablas de public.
-- Esto permite aislar el proyecto en Supabase si hay otros proyectos en la misma BD.
CREATE SCHEMA IF NOT EXISTS "core-presupuestos";

-- Trasladar todas las tablas públicas al schema
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA "core-presupuestos"', t);
  END LOOP;
END $$;

-- Reasignar la búsqueda de rutas para que el backend encuentre las tablas sin prefijo de schema
ALTER DATABASE "core-presupuestos" SET search_path = "core-presupuestos", public;
