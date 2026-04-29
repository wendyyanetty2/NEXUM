-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 011: Fuente única de datos
-- Consolida: registro_ventas, registro_compras y rh_registros
-- como tablas maestras para todos los módulos.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Campos de conciliación en registro_ventas ─────────────────
ALTER TABLE registro_ventas
  ADD COLUMN IF NOT EXISTS conciliado          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS movimiento_id       UUID REFERENCES movimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_conciliacion  DATE,
  ADD COLUMN IF NOT EXISTS lote_importacion_id UUID REFERENCES lotes_importacion(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento   DATE;

-- ── 2. Campos de conciliación en registro_compras ────────────────
ALTER TABLE registro_compras
  ADD COLUMN IF NOT EXISTS conciliado          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS movimiento_id       UUID REFERENCES movimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_conciliacion  DATE,
  ADD COLUMN IF NOT EXISTS lote_importacion_id UUID REFERENCES lotes_importacion(id) ON DELETE SET NULL;

-- ── 3. Campos extra en rh_registros ──────────────────────────────
ALTER TABLE rh_registros
  ADD COLUMN IF NOT EXISTS moneda              TEXT DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS conciliado          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS movimiento_id       UUID REFERENCES movimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_conciliacion  DATE,
  ADD COLUMN IF NOT EXISTS nro_doc_emisor      TEXT,  -- DNI/RUC del prestador (copia para búsqueda rápida)
  ADD COLUMN IF NOT EXISTS nombre_emisor       TEXT;  -- Nombre prestador (copia para display)

-- ── 4. Índices de conciliación ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rv_conciliado   ON registro_ventas(empresa_operadora_id, conciliado);
CREATE INDEX IF NOT EXISTS idx_rv_fecha_conc   ON registro_ventas(empresa_operadora_id, fecha_conciliacion);
CREATE INDEX IF NOT EXISTS idx_rv_lote         ON registro_ventas(lote_importacion_id);
CREATE INDEX IF NOT EXISTS idx_rc_conciliado   ON registro_compras(empresa_operadora_id, conciliado);
CREATE INDEX IF NOT EXISTS idx_rc_fecha_conc   ON registro_compras(empresa_operadora_id, fecha_conciliacion);
CREATE INDEX IF NOT EXISTS idx_rc_lote         ON registro_compras(lote_importacion_id);
CREATE INDEX IF NOT EXISTS idx_rh_conciliado   ON rh_registros(empresa_operadora_id, conciliado);
CREATE INDEX IF NOT EXISTS idx_rh_fecha_emis   ON rh_registros(empresa_operadora_id, fecha_emision);

-- ── 5. Constraints UNIQUE para detección de duplicados ───────────
-- Ventas: misma empresa no puede emitir dos veces el mismo CDP
CREATE UNIQUE INDEX IF NOT EXISTS idx_rv_dedup
  ON registro_ventas(empresa_operadora_id, tipo_documento_codigo, serie, numero)
  WHERE estado != 'ANULADO' AND serie IS NOT NULL AND numero IS NOT NULL;

-- Compras: distintos proveedores pueden tener mismo CDP; clave = ruc+cdp
CREATE UNIQUE INDEX IF NOT EXISTS idx_rc_dedup
  ON registro_compras(empresa_operadora_id, tipo_documento_codigo, serie, numero, ruc_proveedor)
  WHERE estado != 'ANULADO' AND serie IS NOT NULL AND numero IS NOT NULL AND ruc_proveedor IS NOT NULL;

-- RH: el mismo prestador no puede tener dos veces el mismo número de RH
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_dedup
  ON rh_registros(empresa_operadora_id, prestador_id, numero_rh)
  WHERE estado != 'ANULADO' AND numero_rh IS NOT NULL;
