-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 017: Trazabilidad de Históricos/Respaldos
-- Ejecutar en Supabase SQL Editor (requiere 013 ya aplicada)
-- ═══════════════════════════════════════════════════════════════
-- Esta migración NO agrega una tabla nueva de datos: extiende
-- periodos_contables (ya creada en 013, sin uso hasta ahora) para
-- que sirva también como registro de auditoría de los Históricos
-- que se generan/descargan desde Reportes y de las limpiezas que
-- se ejecuten sobre cada período.
--
-- IMPORTANTE: esta tabla NO guarda los datos del histórico, solo
-- la "huella" (cuándo se generó, quién, qué módulos, cuántos
-- registros tenía cada tabla) — el archivo en sí queda solo en la
-- PC de quien lo descarga. Esto es lo que permite verificar, antes
-- de limpiar un período, que existe un respaldo válido y que su
-- conteo coincide con lo que hay ahora mismo en Supabase.

ALTER TABLE periodos_contables
  ADD COLUMN IF NOT EXISTS historico_generado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS historico_generado_por        UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS historico_archivo_nombre       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS historico_version              VARCHAR(20),
  ADD COLUMN IF NOT EXISTS historico_modulos              JSONB,
  ADD COLUMN IF NOT EXISTS historico_conteo_registros     JSONB,
  ADD COLUMN IF NOT EXISTS limpiado_en                    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS limpiado_por                   UUID REFERENCES usuarios(id);

COMMENT ON COLUMN periodos_contables.historico_conteo_registros IS
  'Conteo de filas por tabla al momento de generar el histórico, ej: {"tesoreria_mbd": 340, "movimientos": 312, ...}. Se usa para validar antes de permitir limpieza.';
COMMENT ON COLUMN periodos_contables.historico_modulos IS
  'Lista de módulos/tablas incluidos en ese histórico, ej: ["tesoreria_mbd","movimientos","contabilidad_compras",...].';
