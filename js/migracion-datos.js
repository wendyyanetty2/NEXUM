/* ============================================================
   NEXUM — Migración de datos Tesorería ↔ Contabilidad (punto 2.4)

   Cuando se consolida manualmente un movimiento bancario en
   Tesorería (guardarMBD) y el N° Factura/DOC escrito coincide con
   un comprobante YA registrado en Compras/Ventas/RH, el sistema lo
   reconoce y:
     - completa automáticamente los campos vacíos (Proveedor, RUC/DNI, Monto)
     - si el campo YA tiene un valor distinto al de Contabilidad, no lo
       sobrescribe solo — se junta en una alerta de fusión y Wendy
       elige, campo por campo, con cuál quedarse.
   ============================================================ */

// ── Busca un comprobante existente en Contabilidad que coincida con
//    el N° Factura/DOC + tipo escritos en Tesorería. Solo lectura. ──
async function _migBuscarComprobante(nroFacturaDoc, tipoDoc) {
  if (!nroFacturaDoc || !tipoDoc || typeof empresa_activa === 'undefined' || !empresa_activa?.id) return null;

  if (tipoDoc === 'COMPRA' || tipoDoc === 'VENTA') {
    const [serie, ...resto] = nroFacturaDoc.split('-');
    const nro = resto.join('-');
    const tabla = tipoDoc === 'COMPRA' ? 'contabilidad_compras' : 'contabilidad_ventas';
    const campoProveedor = tipoDoc === 'COMPRA' ? 'proveedor' : 'cliente';
    const { data } = await _supabase.from(tabla).select('*')
      .eq('empresa_id', empresa_activa.id).eq('serie_cdp', serie).eq('nro_cp_inicial', nro).limit(1).maybeSingle();
    if (!data) return null;
    return { proveedor: data[campoProveedor] || '', ruc: data.nro_doc_identidad || '', monto: Number(data.total_cp) || 0, origen: tabla };
  }

  if (tipoDoc === 'RH') {
    // nro_factura_doc puede ser el UUID del RH o el "numero_rh" legible
    let q = _supabase.from('rh_registros').select('*').eq('empresa_operadora_id', empresa_activa.id);
    const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nroFacturaDoc);
    q = esUUID ? q.eq('id', nroFacturaDoc) : q.eq('numero_rh', nroFacturaDoc);
    const { data } = await q.limit(1).maybeSingle();
    if (!data) return null;
    return { proveedor: data.nombre_emisor || '', ruc: data.nro_doc_emisor || '', monto: Number(data.monto_neto) || 0, origen: 'rh_registros' };
  }

  return null;
}

// ── Compara los valores del formulario de Tesorería contra el
//    comprobante encontrado y arma la lista de campos a autocompletar
//    vs los que están en conflicto (ambos con valor, distintos). ────
function _migCompararCampos(formVals, comprobante) {
  const campos = [
    { key: 'proveedor', label: 'Proveedor / Empresa / Personal', formVal: formVals.proveedor },
    { key: 'ruc',       label: 'RUC / DNI',                       formVal: formVals.ruc },
    { key: 'monto',     label: 'Monto',                           formVal: formVals.monto },
  ];
  const autocompletar = {};
  const conflictos = [];
  campos.forEach(c => {
    const valComp = comprobante[c.key];
    const vacioForm = c.key === 'monto' ? !formVals.monto : !(formVals[c.key] || '').trim();
    if (!valComp && valComp !== 0) return;
    if (vacioForm) {
      autocompletar[c.key] = valComp;
    } else {
      // Monto: en Tesorería los cargos (salidas de dinero) se guardan en negativo,
      // mientras que el comprobante siempre es positivo (salvo nota de crédito) —
      // se compara en valor absoluto para no marcar conflicto solo por el signo.
      const igual = c.key === 'monto'
        ? Math.abs(Math.abs(Number(formVals.monto)) - Math.abs(Number(valComp))) < 0.01
        : (formVals[c.key] || '').trim().toLowerCase() === String(valComp).trim().toLowerCase();
      if (!igual) conflictos.push({ ...c, valComp });
    }
  });
  return { autocompletar, conflictos };
}

// ── Modal de fusión: por cada campo en conflicto, Wendy elige cuál
//    valor usar. Devuelve un objeto { campo: valorElegido } o null
//    si cancela (en cuyo caso no se toca nada). ─────────────────────
function _migModalFusion(conflictos, formVals) {
  return new Promise(resolve => {
    const mc = document.getElementById('modal-container');
    if (!mc) { resolve(null); return; }
    mc.innerHTML = `
      <div class="modal-overlay" style="display:flex">
        <div class="modal" style="max-width:560px;width:95%">
          <div class="modal-header">
            <h3>⚠️ Datos distintos entre Tesorería y Contabilidad</h3>
          </div>
          <div class="modal-body">
            <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:14px">
              Este comprobante ya existe en Contabilidad con valores distintos a los que escribiste aquí. Elige cuál usar en cada campo:
            </p>
            ${conflictos.map((c, i) => `
              <div style="border:1px solid var(--color-borde);border-radius:8px;padding:10px 12px;margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:var(--color-texto-suave);margin-bottom:8px">${escapar(c.label)}</div>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;cursor:pointer">
                  <input type="radio" name="mig-${i}" value="tesoreria" checked>
                  Mantener lo escrito aquí: <strong>${escapar(String(c.formVal))}</strong>
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                  <input type="radio" name="mig-${i}" value="contabilidad">
                  Usar el de Contabilidad: <strong>${escapar(String(c.valComp))}</strong>
                </label>
              </div>`).join('')}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" id="mig-cancelar">Cancelar guardado</button>
            <button class="btn btn-primario" id="mig-aplicar">Aplicar selección y guardar</button>
          </div>
        </div>
      </div>`;
    document.getElementById('mig-cancelar').onclick = () => { mc.innerHTML = ''; resolve(null); };
    document.getElementById('mig-aplicar').onclick = () => {
      const elegido = {};
      conflictos.forEach((c, i) => {
        const sel = document.querySelector(`input[name="mig-${i}"]:checked`)?.value;
        elegido[c.key] = sel === 'contabilidad' ? c.valComp : c.formVal;
      });
      mc.innerHTML = '';
      resolve(elegido);
    };
  });
}
