/* ============================================================
   NEXUM — Tesorería: titular del comprobante (pago a terceros)
   Campo propio y separado para cuando el Proveedor/Empresa/Personal
   (a quién se le depositó, dato del banco) no coincide con el emisor
   del comprobante vinculado (representante legal, tercero autorizado,
   otra razón social de cobro). Se calcula solo, nunca se escribe a
   mano, y nunca se mezcla con Observaciones/Obs.2/Obs.4 (Wendy,
   2026-09-18).
   ============================================================ */

ALTER TABLE tesoreria_mbd
  ADD COLUMN IF NOT EXISTS titular_comprobante TEXT;
