-- Supabase expone el esquema `public` por su API de datos. Con RLS activo y sin políticas, esa API (claves anon y authenticated)
-- no ve nada; el backend se conecta como dueño de las tablas, que no pasa por RLS. Inofensivo en un PostgreSQL común.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
