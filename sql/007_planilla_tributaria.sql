-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 007: Planilla y Tributaria
-- ═══════════════════════════════════════════════════════════════

-- ══════════════════════════════
-- PLANILLA
-- ══════════════════════════════

-- ── Periodos de planilla ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planilla_periodos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  anio                 INTEGER NOT NULL,
  mes                  INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo                 TEXT CHECK (tipo IN ('MENSUAL','QUINCENAL_1','QUINCENAL_2','GRATIFICACION','CTS','LIQUIDACION')) DEFAULT 'MENSUAL',
  estado               TEXT DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','CALCULADO','PAGADO','ANULADO')),
  fecha_pago           DATE,
  total_remuneraciones NUMERIC(14,2) DEFAULT 0,
  total_aportes        NUMERIC(14,2) DEFAULT 0,
  total_descuentos     NUMERIC(14,2) DEFAULT 0,
  total_neto           NUMERIC(14,2) DEFAULT 0,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_operadora_id, anio, mes, tipo)
);

-- ── Detalle de planilla por trabajador ───────────────────────────
CREATE TABLE IF NOT EXISTS planilla_detalle (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo_id           UUID NOT NULL REFERENCES planilla_periodos(id) ON DELETE CASCADE,
  trabajador_id        UUID NOT NULL REFERENCES trabajadores(id),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id),
  dias_trabajados      INTEGER DEFAULT 30,
  sueldo_base          NUMERIC(10,2) NOT NULL,
  remuneracion_bruta   NUMERIC(10,2) NOT NULL,
  -- Descuentos
  descuento_afp        NUMERIC(10,2) DEFAULT 0,
  descuento_onp        NUMERIC(10,2) DEFAULT 0,
  descuento_essalud    NUMERIC(10,2) DEFAULT 0,
  descuento_renta5ta   NUMERIC(10,2) DEFAULT 0,
  otros_descuentos     NUMERIC(10,2) DEFAULT 0,
  -- Neto
  remuneracion_neta    NUMERIC(10,2) NOT NULL,
  -- Aportes empleador
  aporte_essalud       NUMERIC(10,2) DEFAULT 0,
  aporte_senati        NUMERIC(10,2) DEFAULT 0,
  -- Estado pago
  pagado               BOOLEAN DEFAULT FALSE,
  fecha_pago           DATE,
  numero_operacion     TEXT
);

-- ══════════════════════════════
-- TRIBUTARIA
-- ══════════════════════════════

-- ── Registro de ventas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registro_ventas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  periodo              TEXT NOT NULL,  -- YYYY-MM
  fecha_emision        DATE NOT NULL,
  tipo_documento_codigo TEXT,
  serie                TEXT,
  numero               TEXT,
  cliente_id           UUID REFERENCES empresas_clientes(id),
  ruc_cliente          TEXT,
  nombre_cliente       TEXT,
  base_imponible       NUMERIC(14,2) DEFAULT 0,
  igv                  NUMERIC(14,2) DEFAULT 0,
  total                NUMERIC(14,2) NOT NULL,
  moneda               TEXT DEFAULT 'PEN',
  tipo_cambio          NUMERIC(8,4) DEFAULT 1,
  estado               TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR','EMITIDO','ANULADO')),
  observaciones        TEXT,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Registro de compras ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registro_compras (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  periodo              TEXT NOT NULL,  -- YYYY-MM
  fecha_emision        DATE NOT NULL,
  fecha_vencimiento    DATE,
  tipo_documento_codigo TEXT,
  serie                TEXT,
  numero               TEXT,
  proveedor_id         UUID REFERENCES empresas_clientes(id),
  ruc_proveedor        TEXT,
  nombre_proveedor     TEXT,
  base_imponible       NUMERIC(14,2) DEFAULT 0,
  igv                  NUMERIC(14,2) DEFAULT 0,
  total                NUMERIC(14,2) NOT NULL,
  moneda               TEXT DEFAULT 'PEN',
  tipo_cambio          NUMERIC(8,4) DEFAULT 1,
  tiene_detraccion     BOOLEAN DEFAULT FALSE,
  monto_detraccion     NUMERIC(14,2),
  codigo_detraccion    TEXT,
  deducible_renta      BOOLEAN DEFAULT TRUE,
  estado               TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR','EMITIDO','ANULADO')),
  observaciones        TEXT,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pp_operadora    ON planilla_periodos(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_pd_periodo      ON planilla_detalle(periodo_id);
CREATE INDEX IF NOT EXISTS idx_rv_operadora    ON registro_ventas(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_rv_periodo      ON registro_ventas(periodo);
CREATE INDEX IF NOT EXISTS idx_rc_operadora    ON registro_compras(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_rc_periodo      ON registro_compras(periodo);

-- ── RLS Planilla ──────────────────────────────────────────────────
ALTER TABLE planilla_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_sa" ON planilla_periodos FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pp_u"  ON planilla_periodos FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE planilla_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd_sa" ON planilla_detalle FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pd_u"  ON planilla_detalle FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── RLS Tributaria ────────────────────────────────────────────────
ALTER TABLE registro_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rv_sa" ON registro_ventas FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "rv_u"  ON registro_ventas FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE registro_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_sa" ON registro_compras FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "rc_u"  ON registro_compras FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));
