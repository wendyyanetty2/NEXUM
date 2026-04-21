-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 002: Row Level Security (RLS)
-- Ejecutar DESPUÉS de 001_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ── Función auxiliar: verificar si es super-admin ────────────────
CREATE OR REPLACE FUNCTION es_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE auth_id = auth.uid()
      AND es_super_admin = TRUE
      AND activo = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Función auxiliar: obtener empresas del usuario actual ────────
CREATE OR REPLACE FUNCTION mis_empresas()
RETURNS SETOF UUID AS $$
  SELECT empresa_operadora_id
  FROM usuarios_empresas ue
  JOIN usuarios u ON u.id = ue.usuario_id
  WHERE u.auth_id = auth.uid()
    AND ue.activo = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Función auxiliar: obtener id del usuario actual ──────────────
CREATE OR REPLACE FUNCTION mi_usuario_id()
RETURNS UUID AS $$
  SELECT id FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ════════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- ════════════════════════════════════════════════════════════════
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Super-admin: acceso total
CREATE POLICY "super_admin_usuarios_todo"
  ON usuarios FOR ALL
  USING (es_super_admin())
  WITH CHECK (es_super_admin());

-- Usuario normal: solo ver su propio perfil
CREATE POLICY "usuario_ver_propio"
  ON usuarios FOR SELECT
  USING (auth_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- TABLA: empresas_operadoras
-- ════════════════════════════════════════════════════════════════
ALTER TABLE empresas_operadoras ENABLE ROW LEVEL SECURITY;

-- Super-admin: acceso total
CREATE POLICY "super_admin_empresas_todo"
  ON empresas_operadoras FOR ALL
  USING (es_super_admin())
  WITH CHECK (es_super_admin());

-- Usuario asignado: solo ver sus empresas
CREATE POLICY "usuario_ver_sus_empresas"
  ON empresas_operadoras FOR SELECT
  USING (id IN (SELECT mis_empresas()));

-- ════════════════════════════════════════════════════════════════
-- TABLA: usuarios_empresas
-- ════════════════════════════════════════════════════════════════
ALTER TABLE usuarios_empresas ENABLE ROW LEVEL SECURITY;

-- Super-admin: acceso total
CREATE POLICY "super_admin_ue_todo"
  ON usuarios_empresas FOR ALL
  USING (es_super_admin())
  WITH CHECK (es_super_admin());

-- Usuario: ver solo sus propias asignaciones
CREATE POLICY "usuario_ver_sus_asignaciones"
  ON usuarios_empresas FOR SELECT
  USING (usuario_id = mi_usuario_id());

-- ════════════════════════════════════════════════════════════════
-- TABLA: configuracion_global
-- ════════════════════════════════════════════════════════════════
ALTER TABLE configuracion_global ENABLE ROW LEVEL SECURITY;

-- Super-admin: acceso total
CREATE POLICY "super_admin_config_todo"
  ON configuracion_global FOR ALL
  USING (es_super_admin())
  WITH CHECK (es_super_admin());

-- Todos los autenticados: solo lectura
CREATE POLICY "autenticado_ver_config"
  ON configuracion_global FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ════════════════════════════════════════════════════════════════
-- TABLA: historial_cambios
-- ════════════════════════════════════════════════════════════════
ALTER TABLE historial_cambios ENABLE ROW LEVEL SECURITY;

-- Super-admin: acceso total
CREATE POLICY "super_admin_historial_todo"
  ON historial_cambios FOR ALL
  USING (es_super_admin())
  WITH CHECK (es_super_admin());

-- Usuario: ver historial de sus empresas
CREATE POLICY "usuario_ver_historial_empresa"
  ON historial_cambios FOR SELECT
  USING (empresa_id IN (SELECT mis_empresas()));

-- Todos los autenticados: pueden insertar (registrar acciones)
CREATE POLICY "autenticado_insertar_historial"
  ON historial_cambios FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ════════════════════════════════════════════════════════════════
-- CATÁLOGOS GLOBALES (lectura para todos, escritura solo super-admin)
-- ════════════════════════════════════════════════════════════════

-- catalogo_tipos_documento
ALTER TABLE catalogo_tipos_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_tipos_documento"
  ON catalogo_tipos_documento FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_tipos_documento"
  ON catalogo_tipos_documento FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());

-- catalogo_tipos_operacion
ALTER TABLE catalogo_tipos_operacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_tipos_operacion"
  ON catalogo_tipos_operacion FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_tipos_operacion"
  ON catalogo_tipos_operacion FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());

-- catalogo_cuentas_pcge
ALTER TABLE catalogo_cuentas_pcge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_cuentas_pcge"
  ON catalogo_cuentas_pcge FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_cuentas_pcge"
  ON catalogo_cuentas_pcge FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());

-- catalogo_estados
ALTER TABLE catalogo_estados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_estados"
  ON catalogo_estados FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_estados"
  ON catalogo_estados FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());

-- catalogo_monedas
ALTER TABLE catalogo_monedas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_monedas"
  ON catalogo_monedas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_monedas"
  ON catalogo_monedas FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());

-- catalogo_bancos
ALTER TABLE catalogo_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leer_bancos"
  ON catalogo_bancos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_bancos"
  ON catalogo_bancos FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());
