-- Tareas en la grilla de ítems (Contrato BD §14): actividades sin cantidad ni unidad. Las líneas existentes quedan como ITEM.
ALTER TABLE quote_items
  ADD COLUMN kind text NOT NULL DEFAULT 'ITEM' CHECK (kind IN ('ITEM','TASK')),
  ADD CONSTRAINT quote_items_task_check CHECK (kind = 'ITEM' OR quantity = 1);
