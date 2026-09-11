-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 018: Coincidencia MBD ↔ EECC
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════
-- Permite que "Importar MBD" (últimos 20 movimientos) y "Importar EECC"
-- (cierre del mes completo) terminen en el MISMO registro de
-- tesoreria_mbd sin duplicarse, aunque el N° de operación bancaria
-- venga con los 2 primeros dígitos distintos entre ambas fuentes
-- (ej. 04597853 en MBD vs 00597853 en EECC — mismo movimiento real).
--
-- nro_operacion_alt: guarda el N° de operación "de la otra fuente"
--   cuando una importación encuentra coincidencia con un registro ya
--   creado por la otra — así no se pierde ninguno de los dos números
--   originales.
-- origen_importacion: de dónde se creó el registro originalmente
--   (MBD, EECC o MANUAL), para poder reportar en el cierre mensual
--   cuántos movimientos vinieron de cada fuente.
-- lote_importacion: referencia al lote de "Importar EECC" (para que
--   el historial de importaciones y "eliminar este lote" sigan
--   funcionando igual que antes, ahora sobre tesoreria_mbd).

ALTER TABLE tesoreria_mbd
  ADD COLUMN IF NOT EXISTS nro_operacion_alt   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS origen_importacion  VARCHAR(10) DEFAULT 'MANUAL' CHECK (origen_importacion IN ('MBD','EECC','MANUAL')),
  ADD COLUMN IF NOT EXISTS lote_importacion    UUID REFERENCES lotes_importacion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mbd_lote ON tesoreria_mbd(lote_importacion);

COMMENT ON COLUMN tesoreria_mbd.nro_operacion_alt IS
  'N° de operación bancaria de la otra fuente (MBD/EECC) cuando ambas importaciones coinciden en el mismo movimiento real pero con distinto N° reportado por el banco.';
