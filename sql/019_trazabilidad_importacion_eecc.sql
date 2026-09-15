-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 019: Trazabilidad de importación EECC/MBD
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════
-- Pedido por Wendy (2026-09-15): la integridad de la información
-- financiera es la prioridad absoluta al importar estados de cuenta.
-- Estas columnas permiten reconstruir, para cada lote importado, qué
-- se encontró, qué se decidió y qué pasó realmente — sin necesidad de
-- adivinar ni recalcular después.
--
-- tipo_reporte:          si el Excel era el reporte diario (últimos 20
--                        movimientos), el EECC mensual completo, o manual.
-- registros_duplicados:  filas del archivo que coincidían de forma
--                        confiable con un registro ya existente.
-- registros_revision:    filas que quedaron como "REQUIERE REVISIÓN"
--                        (coincidencia dudosa) y requirieron decisión manual.
-- registros_modificados: registros existentes que SÍ se tocaron (fecha
--                        actualizada y/o N° de operación alterno guardado),
--                        siempre tras aprobación explícita — nunca en silencio.
-- detalle_validacion:    snapshot completo del resumen de integridad mostrado
--                        antes de confirmar (conteos + importe por moneda de
--                        nuevos/duplicados/revisión), para auditoría posterior.

ALTER TABLE lotes_importacion
  ADD COLUMN IF NOT EXISTS tipo_reporte          VARCHAR(10) CHECK (tipo_reporte IN ('DIARIO','MENSUAL','MANUAL')),
  ADD COLUMN IF NOT EXISTS registros_duplicados  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registros_revision    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registros_modificados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detalle_validacion    JSONB;

COMMENT ON COLUMN lotes_importacion.detalle_validacion IS
  'Snapshot del resumen de integridad mostrado antes de confirmar la importación: conteos (nuevos/duplicados/revisión/diferencias de fecha/N° operación) e importe por moneda de cada grupo.';
