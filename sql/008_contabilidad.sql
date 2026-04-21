-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 008: Contabilidad
-- ═══════════════════════════════════════════════════════════════

-- ── Plan de Cuentas PCGE por empresa ─────────────────────────────
CREATE TABLE IF NOT EXISTS plan_cuentas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  codigo               TEXT NOT NULL,
  nombre               TEXT NOT NULL,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('ACTIVO','PASIVO','PATRIMONIO','INGRESO','GASTO','ORDEN')),
  nivel                INTEGER NOT NULL DEFAULT 1,
  naturaleza           TEXT NOT NULL DEFAULT 'DEUDORA' CHECK (naturaleza IN ('DEUDORA','ACREEDORA')),
  cuenta_padre_codigo  TEXT,
  acepta_movimientos   BOOLEAN DEFAULT TRUE,
  activo               BOOLEAN DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_operadora_id, codigo)
);

-- ── Asientos contables (cabecera) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS asientos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  periodo              TEXT NOT NULL,
  fecha                DATE NOT NULL,
  numero_asiento       TEXT,
  glosa                TEXT NOT NULL,
  tipo                 TEXT DEFAULT 'MANUAL' CHECK (tipo IN ('MANUAL','APERTURA','CIERRE','DESDE_TESORERIA','DESDE_TRIBUTARIA','DESDE_PLANILLA')),
  estado               TEXT DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','VALIDADO','ANULADO')),
  total_debe           NUMERIC(14,2) DEFAULT 0,
  total_haber          NUMERIC(14,2) DEFAULT 0,
  referencia_id        UUID,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Líneas de asiento (debe / haber) ─────────────────────────────
CREATE TABLE IF NOT EXISTS asiento_detalle (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asiento_id    UUID NOT NULL REFERENCES asientos(id) ON DELETE CASCADE,
  orden         INTEGER DEFAULT 1,
  cuenta_codigo TEXT NOT NULL,
  cuenta_nombre TEXT,
  descripcion   TEXT,
  debe          NUMERIC(14,2) DEFAULT 0,
  haber         NUMERIC(14,2) DEFAULT 0
);

-- ── Trigger fecha_actualizacion en asientos ───────────────────────
CREATE TRIGGER trg_asientos_fecha
  BEFORE UPDATE ON asientos
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pc_operadora       ON plan_cuentas(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_pc_codigo          ON plan_cuentas(empresa_operadora_id, codigo);
CREATE INDEX IF NOT EXISTS idx_pc_tipo            ON plan_cuentas(tipo);
CREATE INDEX IF NOT EXISTS idx_asi_operadora      ON asientos(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_asi_periodo        ON asientos(empresa_operadora_id, periodo);
CREATE INDEX IF NOT EXISTS idx_asi_fecha          ON asientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asi_estado         ON asientos(estado);
CREATE INDEX IF NOT EXISTS idx_asi_numero         ON asientos(numero_asiento);
CREATE INDEX IF NOT EXISTS idx_asid_asiento       ON asiento_detalle(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asid_cuenta        ON asiento_detalle(cuenta_codigo);

-- ── RLS Plan de Cuentas ───────────────────────────────────────────
ALTER TABLE plan_cuentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_superadmin" ON plan_cuentas FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pc_usuario"    ON plan_cuentas FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── RLS Asientos ──────────────────────────────────────────────────
ALTER TABLE asientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asi_superadmin" ON asientos FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "asi_usuario"    ON asientos FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── RLS Asiento Detalle ───────────────────────────────────────────
ALTER TABLE asiento_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asid_superadmin" ON asiento_detalle FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "asid_usuario"    ON asiento_detalle FOR ALL USING (
  asiento_id IN (
    SELECT id FROM asientos WHERE empresa_operadora_id IN (SELECT mis_empresas())
  )
);
