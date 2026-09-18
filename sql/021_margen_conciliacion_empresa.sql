/* ============================================================
   NEXUM — Margen de conciliación configurable por empresa
   Diferencia (de más o de menos) entre lo vinculado y el total del
   comprobante que se acepta como referencia antes de bloquear el
   vínculo (badge EXCESIVO/PARCIAL y el bloqueo al vincular usan la
   misma regla — ver js/consolidacion-estados.js, _conCobertura).
   Antes era fijo en S/0.01; ahora es editable por empresa desde
   Administración > Empresas (solo super admin), con S/3.00 por
   defecto (Wendy, 2026-09-18).
   ============================================================ */

ALTER TABLE empresas_operadoras
  ADD COLUMN IF NOT EXISTS margen_conciliacion NUMERIC(10,2) NOT NULL DEFAULT 3.00;
