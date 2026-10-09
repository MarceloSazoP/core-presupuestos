-- La 0017 fijaba la ruta de búsqueda solo en la base llamada «postgres» (la de Supabase). En una base con otro nombre (desarrollo,
-- pruebas) las tablas quedaban en "core-presupuestos" sin que el backend las encontrara. Se fija en la base actual; en Supabase
-- repite lo mismo. El SET deja bien también esta conexión, que vuelve al pool.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path = "core-presupuestos", public', current_database());
END $$;
SET search_path = "core-presupuestos", public;
