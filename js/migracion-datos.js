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

// ── Busca TODOS los comprobantes de Contabilidad (Compras, Ventas y RH) que
//    tengan el N° Factura/DOC escrito en Tesorería. Solo lectura.
//    Un mismo N° puede repetirse: la factura E001-156 de un proveedor y un
//    RH E001-156 de otra persona, o el mismo N° de RH de dos emisores distintos
//    (Wendy, 2026-09-19). Antes se devolvía solo el primero que apareciera, así
//    que a veces se vinculaba al comprobante equivocado sin avisar.
//    El N° se busca tolerando mayúsculas/minúsculas, espacios y ceros a la izquierda.
//    Cada candidato: { tipoDoc, id, proveedor, ruc, monto, origen, nro, fecha }
//    (más los alias cat/nombre/total que usan las tarjetas de consolidacion-estados.js).
async function _migCandidatosComprobante(nroFacturaDoc) {
  if (!nroFacturaDoc || typeof empresa_activa === 'undefined' || !empresa_activa?.id) return [];
  const crudo = String(nroFacturaDoc).trim();
  const out = [];
  const agregar = c => out.push({ ...c, cat: c.tipoDoc, nombre: c.proveedor, total: c.monto });

  const i = crudo.indexOf('-');
  if (i > 0) {
    const serie = crudo.slice(0, i).trim().toUpperCase();
    const nro   = crudo.slice(i + 1).trim();
    const nros  = [...new Set([nro, nro.replace(/^0+(?=\d)/, '')])].filter(Boolean);
    for (const [tipoDoc, tabla, campoProveedor] of [['COMPRA', 'contabilidad_compras', 'proveedor'], ['VENTA', 'contabilidad_ventas', 'cliente']]) {
      const { data } = await _supabase.from(tabla).select('*')
        .eq('empresa_id', empresa_activa.id).eq('serie_cdp', serie).in('nro_cp_inicial', nros);
      (data || []).forEach(d => agregar({
        tipoDoc, id: d.id, proveedor: d[campoProveedor] || '', ruc: d.nro_doc_identidad || '',
        monto: Number(d.total_cp) || 0, origen: tabla, nro: [d.serie_cdp, d.nro_cp_inicial].filter(Boolean).join('-'), fecha: d.fecha_emision || null,
      }));
    }
  }

  // RH: nro_factura_doc puede ser el UUID del RH o el "numero_rh" legible
  const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(crudo);
  let q = _supabase.from('rh_registros').select('*, prestadores_servicios(nombre, dni)').eq('empresa_operadora_id', empresa_activa.id);
  q = esUUID ? q.eq('id', crudo) : q.in('numero_rh', [...new Set([crudo, crudo.toUpperCase()])]);
  const { data: rhs } = await q;
  (rhs || []).forEach(d => agregar({
    tipoDoc: 'RH', id: d.id, proveedor: d.prestadores_servicios?.nombre || d.nombre_emisor || '',
    ruc: d.prestadores_servicios?.dni || d.nro_doc_emisor || '',
    monto: Number(d.monto_neto) || 0, origen: 'rh_registros', nro: d.numero_rh || d.id, fecha: d.fecha_emision || null,
  }));

  // El mismo comprobante cargado dos veces (misma categoría + N° + RUC) es UNO solo.
  const vistos = new Set();
  return out.filter(c => {
    const k = `${c.tipoDoc}|${String(c.nro).trim().toUpperCase()}|${String(c.ruc).trim()}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ── Busca el comprobante de Contabilidad que corresponde al N° Factura/DOC
//    (+ categoría, si se conoce). Si no se sabe la categoría (tipoDoc vacío — ej.
//    al tipear el N° a mano sin haber vinculado todavía por 🔗/🔍) se prueba en
//    Compras, Ventas y RH, y se devuelve `tipoDoc` con la categoría hallada para
//    que el llamador la guarde junto con el resto.
//    Devuelve: el comprobante | null (no existe) | { cancelado: true } (había varios
//    comprobantes con ese N° y Wendy canceló el aviso).
//    `contexto` (opcional) = { ruc, nombre, monto, nroOperacion } del movimiento: si
//    su RUC identifica UN solo comprobante entre los que comparten el N°, se usa ese;
//    en cualquier otro caso con varios candidatos NO se adivina — se abre un aviso
//    interactivo (_conElegirComprobante) para que Wendy elija cuál vincular. ──────
async function _migBuscarComprobante(nroFacturaDoc, tipoDoc, contexto = null) {
  const todos = await _migCandidatosComprobante(nroFacturaDoc);
  if (tipoDoc) return todos.find(c => c.tipoDoc === tipoDoc) || null; // compatibilidad: búsqueda por categoría
  if (!todos.length) return null;
  if (todos.length === 1) return todos[0];

  const ruc = ((contexto && contexto.ruc) || '').toString().trim();
  if (ruc) {
    const porRuc = todos.filter(c => String(c.ruc || '').trim() === ruc);
    if (porRuc.length === 1) return porRuc[0];
  }
  if (typeof _conElegirComprobante !== 'function') return todos[0]; // sin la UI de elección, comportamiento anterior
  const elegido = await _conElegirComprobante(todos, { nro: nroFacturaDoc, ...(contexto || {}) });
  return elegido || { cancelado: true };
}

// ── Compara dos nombres tolerando orden distinto de palabras y acentos
//    (Wendy, 2026-09-18: el RH puede tener "ORTEGA GUTIERREZ ASLY MEYLIN
//    INGRID" y el banco "Asly Meylin Ingrid Ortega Gutierrez" — es la
//    misma persona, no debe marcarse como pago a tercero). ────────────
function _migNombreNormalizado(v) {
  return (v || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}
function _migNombresEquivalentes(a, b) {
  return _migNombreNormalizado(a) === _migNombreNormalizado(b);
}

// ── Compara los valores del formulario de Tesorería contra el
//    comprobante encontrado y arma la lista de campos a autocompletar
//    vs los que están en conflicto (ambos con valor, distintos). ────
// El Proveedor/Empresa/Personal SIEMPRE migra al nombre oficial del
// comprobante (Compras/Ventas/RH) — es el dato contable, la fuente de
// verdad, así que nunca entra al modal de fusión para este campo. Si lo
// que ya estaba escrito era otro nombre (pedido de Wendy, 2026-09-18,
// punto "Pagos a terceros": a quién se le DEPOSITÓ el dinero, dato del
// banco, puede legítimamente no coincidir con el emisor — representante
// legal, tercero autorizado, otra razón social de cobro), ese nombre se
// devuelve en `tercero` para que el llamador lo guarde en su propio
// campo (titular_comprobante), sin bloquear el guardado ni forzar una
// decisión.
function _migCompararCampos(formVals, comprobante) {
  const autocompletar = {};
  const conflictos = [];
  let tercero = null;

  const vacioProveedor = !(formVals.proveedor || '').trim();
  if (comprobante.proveedor) {
    if (vacioProveedor) {
      autocompletar.proveedor = comprobante.proveedor;
    } else if (!_migNombresEquivalentes(formVals.proveedor, comprobante.proveedor)) {
      tercero = formVals.proveedor;
      autocompletar.proveedor = comprobante.proveedor;
    }
  }

  const camposConflicto = [
    { key: 'ruc',   label: 'RUC / DNI', formVal: formVals.ruc },
    { key: 'monto', label: 'Monto',     formVal: formVals.monto },
  ];
  camposConflicto.forEach(c => {
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
  return { autocompletar, conflictos, tercero };
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
