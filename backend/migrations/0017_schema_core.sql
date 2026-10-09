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

-- Ruta de búsqueda para que el backend encuentre las tablas sin prefijo de schema: en la base actual (cualquiera sea su nombre;
-- en Supabase es «postgres») para las conexiones nuevas, y en esta misma conexión para las que ya están abiertas.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path = "core-presupuestos", public', current_database());
END $$;
SET search_path = "core-presupuestos", public;
