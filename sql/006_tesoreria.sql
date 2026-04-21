-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 006: Tesorería
-- ═══════════════════════════════════════════════════════════════

-- ── Cuentas bancarias por empresa ────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  banco_codigo         TEXT NOT NULL,
  nombre_alias         TEXT NOT NULL,
  numero_cuenta        TEXT NOT NULL,
  cci                  TEXT,
  moneda               TEXT NOT NULL DEFAULT 'PEN' CHECK (moneda IN ('PEN','USD','EUR')),
  saldo_inicial        NUMERIC(14,2) DEFAULT 0,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Movimientos / transacciones bancarias ─────────────────────────
CREATE TABLE IF NOT EXISTS movimientos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id  UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  cuenta_bancaria_id    UUID REFERENCES cuentas_bancarias(id),
  fecha                 DATE NOT NULL,
  naturaleza            TEXT NOT NULL CHECK (naturaleza IN ('CARGO','ABONO')),
  importe               NUMERIC(14,2) NOT NULL,
  moneda                TEXT NOT NULL DEFAULT 'PEN',
  descripcion           TEXT,
  numero_operacion      TEXT,
  -- Clasificación
  tipo_operacion_codigo TEXT,
  tipo_documento_codigo TEXT,
  numero_documento      TEXT,
  empresa_cliente_id    UUID REFERENCES empresas_clientes(id),
  concepto_id           UUID REFERENCES conceptos(id),
  autorizacion_id       UUID REFERENCES autorizaciones(id),
  proyecto_id           UUID REFERENCES proyectos(id),
  medio_pago_id         UUID REFERENCES medios_pago(id),
  -- Impuestos
  tiene_igv             BOOLEAN DEFAULT FALSE,
  base_imponible        NUMERIC(14,2),
  igv                   NUMERIC(14,2),
  tiene_detraccion      BOOLEAN DEFAULT FALSE,
  codigo_detraccion     TEXT,
  porcentaje_detraccion NUMERIC(5,2),
  monto_detraccion      NUMERIC(14,2),
  -- Estado y auditoría
  estado                TEXT NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE','EMITIDO','OBSERVADO','ANULADO','EN_SIMULACION','APROBADO','REQUIERE_RH')),
  observaciones         TEXT,
  -- Conciliación
  conciliado            BOOLEAN DEFAULT FALSE,
  fecha_conciliacion    DATE,
  lote_importacion      TEXT,
  -- Auditoría
  usuario_id            UUID REFERENCES usuarios(id),
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lotes de importación (para rastrear uploads de Excel/EECC) ───
CREATE TABLE IF NOT EXISTS lotes_importacion (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id),
  cuenta_bancaria_id   UUID REFERENCES cuentas_bancarias(id),
  nombre_archivo       TEXT NOT NULL,
  tipo_fuente          TEXT CHECK (tipo_fuente IN ('BCP','BBVA','INTERBANK','SCOTIABANK','MANUAL','OTRO')),
  total_registros      INTEGER DEFAULT 0,
  registros_ok         INTEGER DEFAULT 0,
  registros_error      INTEGER DEFAULT 0,
  estado               TEXT DEFAULT 'PROCESANDO' CHECK (estado IN ('PROCESANDO','COMPLETADO','ERROR')),
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger actualizar fecha movimientos ─────────────────────────
CREATE TRIGGER trg_movimientos_fecha
  BEFORE UPDATE ON movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cb_operadora    ON cuentas_bancarias(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_mov_operadora   ON movimientos(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_mov_cuenta      ON movimientos(cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha       ON movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_estado      ON movimientos(estado);
CREATE INDEX IF NOT EXISTS idx_mov_operacion   ON movimientos(numero_operacion);
CREATE INDEX IF NOT EXISTS idx_mov_lote        ON movimientos(lote_importacion);

-- ── RLS Tesorería ─────────────────────────────────────────────────
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_superadmin" ON cuentas_bancarias FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "cb_usuario"    ON cuentas_bancarias FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_superadmin" ON movimientos FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "mov_usuario"    ON movimientos FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE lotes_importacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lotes_superadmin" ON lotes_importacion FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "lotes_usuario"    ON lotes_importacion FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));
