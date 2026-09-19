/* ============================================================
   NEXUM — Verificación del esquema usado por Reparar estados / vinculación
   (2026-09-19). NO borra ni cambia datos. Es seguro correrlo varias veces:
   solo agrega las 3 columnas si faltan (015, 020 y 021) y muestra el resultado.
   Pegar completo en Supabase > SQL Editor > Run.
   ============================================================ */

ALTER TABLE tesoreria_mbd
  ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT;            -- 015

ALTER TABLE tesoreria_mbd
  ADD COLUMN IF NOT EXISTS titular_comprobante TEXT;         -- 020 («A quién se depositó»)

ALTER TABLE empresas_operadoras
  ADD COLUMN IF NOT EXISTS margen_conciliacion NUMERIC(10,2) NOT NULL DEFAULT 3.00;  -- 021

-- Resultado: deben salir las 3 filas
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE (table_name = 'tesoreria_mbd'      AND column_name IN ('tipo_comprobante', 'titular_comprobante'))
   OR (table_name = 'empresas_operadoras' AND column_name = 'margen_conciliacion')
ORDER BY table_name, column_name;
