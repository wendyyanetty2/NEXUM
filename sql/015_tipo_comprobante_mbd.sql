/* ============================================================
   NEXUM — Tesorería: código de tipo de comprobante en MBD
   Separa la categoría de vinculación (tipo_doc: COMPRA/VENTA/RH/PM,
   usada por la consolidación de estados y la detección de "ya
   vinculado") del código real del comprobante (FA/BO/RH/PM/OT…),
   que es lo que se muestra al usuario.
   ============================================================ */

ALTER TABLE tesoreria_mbd
  ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT;
