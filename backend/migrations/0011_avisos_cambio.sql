-- Avisos de cambio en vivo (Contrato BD §20): Postgres avisa cuando cambia un presupuesto, su levantamiento, sus fotos o notas de voz, o su cliente.
CREATE FUNCTION notify_quote_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; q uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_TABLE_NAME = 'quotes' THEN
    PERFORM pg_notify('quote_changed', r.id::text);
  ELSIF TG_TABLE_NAME = 'customers' THEN
    FOR q IN SELECT id FROM quotes WHERE customer_id = r.id LOOP PERFORM pg_notify('quote_changed', q::text); END LOOP;
  ELSE
    PERFORM pg_notify('quote_changed', r.quote_id::text);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER quotes_notify AFTER INSERT OR UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER customers_notify AFTER UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER quote_items_notify AFTER INSERT OR UPDATE OR DELETE ON quote_items FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER quote_surveys_notify AFTER INSERT OR UPDATE OR DELETE ON quote_surveys FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER survey_measurements_notify AFTER INSERT OR UPDATE OR DELETE ON survey_measurements FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER survey_photos_notify AFTER INSERT OR UPDATE OR DELETE ON survey_photos FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
CREATE TRIGGER survey_voice_notes_notify AFTER INSERT OR UPDATE OR DELETE ON survey_voice_notes FOR EACH ROW EXECUTE FUNCTION notify_quote_change();
