-- ============================================================
-- NEXUM v3.1 — Área, Cargo y Permisos Granulares por usuario
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar campos área y cargo a tabla usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS area   TEXT,
  ADD COLUMN IF NOT EXISTS cargo  TEXT;

-- 2. Agregar columna de permisos granulares en la asignación usuario-empresa
--    Formato JSON: { "tesoreria": { "ver": true, "editar": false, "eliminar": false }, ... }
--    Si es NULL, el sistema usa los permisos derivados del rol (comportamiento actual)
ALTER TABLE usuarios_empresas
  ADD COLUMN IF NOT EXISTS permisos_json JSONB;

-- Comentarios informativos
COMMENT ON COLUMN usuarios.area   IS 'Área del usuario: Gerencia, Contabilidad, RRHH, Operaciones, Otros';
COMMENT ON COLUMN usuarios.cargo  IS 'Cargo del usuario: Gerente, Supervisor, Analista, Secretaria, Contadora, Asistente';
COMMENT ON COLUMN usuarios_empresas.permisos_json IS 'Permisos granulares por módulo. Si NULL, se derivan del rol. Estructura: { modulo_id: { ver, editar, eliminar } }';
