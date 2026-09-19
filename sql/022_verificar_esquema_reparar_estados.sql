/* NEXUM — Verificación de esquema (2026-09-19). NO borra ni cambia datos; se puede correr varias veces.
   Busca la tabla en CUALQUIER esquema y agrega las columnas si faltan. Pegar completo en SQL Editor > Run. */

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'tesoreria_mbd' LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT', r.schemaname, r.tablename);
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS titular_comprobante TEXT', r.schemaname, r.tablename);
  END LOOP;
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'empresas_operadoras' LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS margen_conciliacion NUMERIC(10,2) NOT NULL DEFAULT 3.00', r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Resultado: si tesoreria_mbd existe deben salir 3 filas. Si sale vacío, estás en OTRO proyecto de Supabase
-- (el de la app es ncfnhjyqehvdqzikjhmg) y abajo se listan las tablas que sí hay aquí.
SELECT table_schema, table_name, column_name FROM information_schema.columns
WHERE (table_name = 'tesoreria_mbd' AND column_name IN ('tipo_comprobante','titular_comprobante'))
   OR (table_name = 'empresas_operadoras' AND column_name = 'margen_conciliacion')
ORDER BY table_name, column_name;
