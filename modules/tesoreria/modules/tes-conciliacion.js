// ═══════════════════════════════════════════════════════════════
// Tesorería — Conciliación v2 (Motor de Match Inteligente)
// ═══════════════════════════════════════════════════════════════

let conc_docs          = [];   // documentos normalizados (compras + ventas + RH)
let conc_bancos        = [];   // banco normalizados
let conc_matches       = [];   // [ { doc, banco, score, confianza, dias, alternos[] } ]
let conc_matches_grupo = [];   // [ { banco, docs:[rh1,rh2,...], score, confianza, diasMax } ]
let conc_sin_doc       = [];
let conc_sin_banco     = [];
let conc_rechazados    = new Set(); // "docId|bancoId" y "GRUPO_bancoId" rechazados
let conc_sel_doc       = null;
let conc_sel_banco     = null;
let conc_periodo       = null;

// ── Render principal ──────────────────────────────────────────────
async function renderTabConciliacion(area) {
  const hoy    = new Date();
  const mesStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  conc_periodo    = mesStr;
  conc_rechazados = new Set();

  area.innerHTML = `
    <div class="fadeIn">

      <div id="conc-resumen"
           style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:20px"></div>

      <div class="card" style="margin-bottom:16px;padding:14px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label class="label-filtro">Periodo (banco)</label>
            <input type="month" id="conc-mes" value="${mesStr}"
                   onchange="_concFiltrarPeriodo()" class="input-buscar">
          </div>
          <div>
            <label class="label-filtro">Naturaleza</label>
            <select id="conc-nat" onchange="_concCargarDatos()" class="input-buscar">
              <option value="">Todas</option>
              <option value="CARGO">CARGO (Compras / RH)</option>
              <option value="ABONO">ABONO (Ventas)</option>
              <option value="RH">RH (Recibos por Honorarios)</option>
            </select>
          </div>
          <button class="btn btn-secundario btn-sm" onclick="_concCargarDatos()">🔄 Actualizar</button>
          <button class="btn btn-primario btn-sm" id="btn-auto-conc" onclick="_concAutoMatch()">
            ⚡ Aprobar alta confianza
          </button>
        </div>
      </div>

      <!-- Sugerencias del motor -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3 style="font-size:14px">
            🔗 Matches sugeridos
            <span id="conc-badge-matches" class="badge badge-warning" style="font-size:11px;margin-left:6px">0</span>
          </h3>
          <span class="text-muted text-sm">
            Monto exacto · nivel de confianza por fecha y texto · el usuario decide
          </span>
        </div>
        <div id="conc-sugerencias">
          <div class="text-center text-muted text-sm" style="padding:24px">Cargando…</div>
        </div>
      </div>

      <!-- Sin match — manual -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;align-items:start">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-size:13px">📄 Documentos sin match
              <span id="conc-badge-docs" class="badge badge-inactivo" style="font-size:11px;margin-left:6px">0</span>
            </h3>
            <span style="font-size:11px;color:var(--color-texto-suave)">Clic para seleccionar</span>
          </div>
          <div class="table-wrap" style="max-height:340px;overflow-y:auto">
            <table class="tabla" style="font-size:12px">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Doc / Emisor</th><th class="text-right">Importe</th></tr></thead>
              <tbody id="conc-tbody-docs"></tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-size:13px">🏦 Banco sin match
              <span id="conc-badge-banco" class="badge badge-inactivo" style="font-size:11px;margin-left:6px">0</span>
            </h3>
            <span style="font-size:11px;color:var(--color-texto-suave)">Clic para seleccionar</span>
          </div>
          <div class="table-wrap" style="max-height:340px;overflow-y:auto">
            <table class="tabla" style="font-size:12px">
              <thead><tr><th>Fecha</th><th>Descripción</th><th class="text-right">Importe</th><th>Nat.</th><th title="Buscar comprobante manualmente">📂</th></tr></thead>
              <tbody id="conc-tbody-banco"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Panel de match manual -->
      <div id="conc-match-panel" style="display:none;margin-bottom:16px" class="card">
        <h3 style="margin-bottom:12px">🔗 Comparar para match manual</h3>
        <div style="display:grid;grid-template-columns:1fr 48px 1fr;gap:12px;align-items:center">
          <div id="conc-det-doc"   style="background:var(--color-fondo-2);border-radius:var(--radio);padding:14px;font-size:13px;min-height:88px"></div>
          <div style="font-size:28px;text-align:center;color:var(--color-texto-suave)">⟷</div>
          <div id="conc-det-banco" style="background:var(--color-fondo-2);border-radius:var(--radio);padding:14px;font-size:13px;min-height:88px"></div>
        </div>
        <div id="conc-dif-texto" class="text-sm" style="margin-top:10px;text-align:center"></div>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:center">
          <button class="btn btn-secundario" onclick="_concLimpiarSeleccion()">✕ Cancelar</button>
          <button class="btn btn-primario" id="btn-confirmar-match" onclick="_concConfirmarManual()" disabled>
            ✅ Confirmar match manual
          </button>
        </div>
      </div>

      <!-- Historial conciliados -->
      <div class="card">
        <h3 style="margin-bottom:12px">✅ Conciliados — <span id="conc-periodo-label"></span></h3>
        <div id="conc-historial">
          <div class="text-center text-muted text-sm" style="padding:16px">Cargando…</div>
        </div>
      </div>

    </div>`;

  await _concCargarDatos();
}

// ── Carga de datos ────────────────────────────────────────────────
async function _concCargarDatos() {
  const mes = document.getElementById('conc-mes')?.value || conc_periodo;
  conc_periodo = mes;
  const nat = document.getElementById('conc-nat')?.value || '';

  const [anio, m] = mes.split('-').map(Number);
  const desdeBanco = `${mes}-01`;
  const hastaBanco = `${mes}-${new Date(anio, m, 0).getDate()}`;

  // Docs: ventana ampliada 3 meses atrás para capturar RH con fecha diferida
  const prev3    = new Date(anio, m - 4, 1);
  const desdeDoc = `${prev3.getFullYear()}-${String(prev3.getMonth()+1).padStart(2,'0')}-01`;

  // ── Lado documentos: tablas maestras registro_compras / registro_ventas / rh_registros ──
  let qCompras = _supabase.from('registro_compras')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', false)
    .neq('estado', 'ANULADO')
    .gte('fecha_emision', desdeDoc)
    .lte('fecha_emision', hastaBanco);

  let qVentas = _supabase.from('registro_ventas')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', false)
    .neq('estado', 'ANULADO')
    .gte('fecha_emision', desdeDoc)
    .lte('fecha_emision', hastaBanco);

  let qRH = _supabase.from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', false)
    .eq('estado', 'EMITIDO')
    .gte('fecha_emision', desdeDoc)
    .lte('fecha_emision', hastaBanco);

  // Filtro naturaleza: compras/RH son CARGO, ventas son ABONO, RH solo recibos
  if (nat === 'ABONO') { qCompras = qCompras.eq('id', '__NINGUNO__'); qRH = qRH.eq('id', '__NINGUNO__'); }
  if (nat === 'CARGO') { qVentas  = qVentas.eq('id',  '__NINGUNO__'); }
  if (nat === 'RH')    { qCompras = qCompras.eq('id', '__NINGUNO__'); qVentas = qVentas.eq('id', '__NINGUNO__'); }

  // ── Lado banco: tesoreria_mbd — SOLO pendientes sin comprobante ──
  // Excluir EMITIDO y CANCELADO (ya tienen sustento o fueron descartados)
  let qBanco = _supabase.from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .in('entrega_doc', ['PENDIENTE', 'OBSERVADO'])
    .gte('fecha_deposito', desdeBanco)
    .lte('fecha_deposito', hastaBanco);

  // Filtro de naturaleza: derivado del signo del monto
  // CARGO = monto negativo (<0), ABONO = monto positivo (≥0)
  if (nat === 'CARGO' || nat === 'RH') qBanco = qBanco.lt('monto', 0);
  if (nat === 'ABONO')                 qBanco = qBanco.gte('monto', 0);

  const [resComp, resVent, resRH, resBanco] = await Promise.all([qCompras, qVentas, qRH, qBanco]);

  const comprasDocs = (resComp.data || []).map(rc => _concNormalizarCompra(rc));
  const ventasDocs  = (resVent.data || []).map(rv => _concNormalizarVenta(rv));
  const rhDocs      = (resRH.data   || []).map(rh => _concNormalizarRH(rh));
  conc_docs   = [...comprasDocs, ...ventasDocs, ...rhDocs];
  conc_bancos = (resBanco.data || []).map(b => _concNormalizarBanco(b));
  conc_sel_doc   = null;
  conc_sel_banco = null;

  const resultado = _concDetectarMatches(conc_docs, conc_bancos);
  conc_matches   = resultado.matches;
  conc_sin_doc   = resultado.sinDoc;
  conc_sin_banco = resultado.sinBanco;

  // Buscar grupos: suma de varios RH = un movimiento banco
  conc_matches_grupo = _concDetectarGruposRH(conc_sin_doc, conc_sin_banco);
  if (conc_matches_grupo.length) {
    const docsEnGrupo   = new Set(conc_matches_grupo.flatMap(g => g.docs.map(d => d.id)));
    const bancosEnGrupo = new Set(conc_matches_grupo.map(g => g.banco.id));
    conc_sin_doc   = conc_sin_doc.filter(d => !docsEnGrupo.has(d.id));
    conc_sin_banco = conc_sin_banco.filter(b => !bancosEnGrupo.has(b.id));
  }

  _concRenderResumen();
  _concRenderSugerencias();
  _concRenderSinMatch();
  _concLimpiarSeleccion();
  document.getElementById('conc-periodo-label').textContent = mes;
  await _concCargarHistorial(mes);
}

function _concFiltrarPeriodo() {
  const mes = document.getElementById('conc-mes')?.value;
  if (mes) conc_periodo = mes;
  _concCargarDatos();
}

// ── Normalización ─────────────────────────────────────────────────
function _concNormalizarCompra(rc) {
  return {
    id:          rc.id,
    _source:     'COMPRA',
    _raw:        rc,
    fecha:       rc.fecha_emision,
    naturaleza:  'CARGO',
    importe:     parseFloat(rc.total) || 0,
    moneda:      rc.moneda || 'PEN',
    descripcion: rc.nombre_proveedor || '',
    nombre:      rc.nombre_proveedor || '',
    documento:   rc.serie && rc.numero ? `${rc.serie}-${rc.numero}` : '',
    tipo:        'Compra',
  };
}

function _concNormalizarVenta(rv) {
  return {
    id:          rv.id,
    _source:     'VENTA',
    _raw:        rv,
    fecha:       rv.fecha_emision,
    naturaleza:  'ABONO',
    importe:     parseFloat(rv.total) || 0,
    moneda:      rv.moneda || 'PEN',
    descripcion: rv.nombre_cliente || '',
    nombre:      rv.nombre_cliente || '',
    documento:   rv.serie && rv.numero ? `${rv.serie}-${rv.numero}` : '',
    tipo:        'Venta',
  };
}

function _concNormalizarRH(rh) {
  return {
    id:          rh.id,
    _source:     'RH',
    _raw:        rh,
    fecha:       rh.fecha_emision,
    naturaleza:  'CARGO',
    importe:     parseFloat(rh.monto_neto) || 0,
    moneda:      rh.moneda || 'PEN',
    descripcion: rh.concepto || '',
    nombre:      rh.prestadores_servicios?.nombre || rh.nombre_emisor || '',
    documento:   rh.numero_rh || '',
    tipo:        'RH',
  };
}

function _concNormalizarBanco(m) {
  const monto = parseFloat(m.monto) || 0;
  return {
    id:          m.id,
    _source:     'BANCO',
    _raw:        m,
    fecha:       m.fecha_deposito,                         // tesoreria_mbd usa fecha_deposito
    naturaleza:  monto < 0 ? 'CARGO' : 'ABONO',           // derivado del signo del monto
    importe:     Math.abs(monto),                          // siempre positivo para comparar
    moneda:      m.moneda || 'PEN',
    descripcion: m.proveedor_empresa_personal              // proveedor como descripción principal
                 || m.descripcion
                 || m.nro_operacion_bancaria || '',
    nroOp:       m.nro_operacion_bancaria || '',
    entregaDoc:  m.entrega_doc || 'PENDIENTE',
    cuenta:      '',                                       // tesoreria_mbd no tiene cuenta bancaria directa
  };
}

// ── Detección de grupos RH (suma de varios RH = un banco) ────────
function _concDetectarGruposRH(sinDoc, sinBanco) {
  const grupos   = [];
  const rhsSin   = sinDoc.filter(d => d._source === 'RH');
  const cargosSin = sinBanco.filter(b => b.naturaleza === 'CARGO');

  const usadosRH    = new Set();
  const usadosBanco = new Set();

  for (const banco of cargosSin) {
    if (usadosBanco.has(banco.id)) return grupos; // protección
    if (conc_rechazados.has(`GRUPO_${banco.id}`)) continue;

    // Solo RH disponibles dentro de ±60 días del banco
    const bancoDate = new Date(banco.fecha);
    const candidatos = rhsSin.filter(rh => {
      if (usadosRH.has(rh.id)) return false;
      const dias = Math.abs(new Date(rh.fecha) - bancoDate) / 86400000;
      return dias <= 60;
    });

    if (candidatos.length < 2) continue;

    // Limitar a 25 candidatos para mantener rendimiento (C(25,4) ≈ 12.6k)
    const pool  = candidatos.slice(0, 25);
    const combo = _concComboRH(banco.importe, pool, 4);
    if (!combo) continue;

    const diasMax = Math.round(Math.max(...combo.map(rh =>
      Math.abs(new Date(rh.fecha) - bancoDate) / 86400000
    )));
    const score    = diasMax <= 7 ? 72 : diasMax <= 15 ? 65 : 55;
    const confianza = score >= 65 ? 'MEDIA' : 'BAJA';

    grupos.push({ banco, docs: combo, score, confianza, diasMax });
    usadosBanco.add(banco.id);
    combo.forEach(rh => usadosRH.add(rh.id));
  }

  return grupos;
}

function _concComboRH(target, items, maxSize) {
  for (let size = 2; size <= Math.min(maxSize, items.length); size++) {
    const combo = _concComboRec(items, size, target, 0, []);
    if (combo) return combo;
  }
  return null;
}

function _concComboRec(items, size, target, start, current) {
  if (current.length === size) {
    const suma = current.reduce((s, it) => s + it.importe, 0);
    return Math.abs(suma - target) <= 0.01 ? current : null;
  }
  const needed = size - current.length;
  for (let i = start; i <= items.length - needed; i++) {
    const resto = target - items[i].importe;
    if (resto < -0.01) continue;
    const result = _concComboRec(items, size, target, i + 1, [...current, items[i]]);
    if (result) return result;
  }
  return null;
}

// ── Motor de match ────────────────────────────────────────────────
function _concPuntuar(doc, banco) {
  const dias  = Math.abs(new Date(doc.fecha) - new Date(banco.fecha)) / 86400000;
  const esRH  = doc._source === 'RH';

  // No sugerir diferencias >31 días salvo RH
  if (dias > 31 && !esRH) return null;

  let score = 50; // base: monto coincide

  if      (dias === 0)   score += 40;
  else if (dias <= 3)    score += 32;
  else if (dias <= 7)    score += 22;
  else if (dias <= 15)   score += 12;
  else if (dias <= 31)   score += 6;
  else                   score += 2;  // RH diferida

  // Similitud de texto: nombre/doc del lado izquierdo vs descripción banco
  const tDoc   = ((doc.nombre||'') + ' ' + (doc.documento||'') + ' ' + (doc.descripcion||'')).toLowerCase();
  const tBanco = ((banco.descripcion||'')).toLowerCase();
  if (tDoc.length > 3 && tBanco.length > 3) {
    const palabras    = tDoc.split(/[\s,.\-/]+/).filter(p => p.length >= 4);
    const coinciden   = palabras.filter(p => tBanco.includes(p)).length;
    if      (coinciden >= 2) score += 25;
    else if (coinciden === 1) score += 12;
    // Número de doc (CDP/RH) encontrado en glosa banco
    const numDoc = doc.documento.toLowerCase();
    if (numDoc.length >= 6 && tBanco.includes(numDoc.slice(0,8))) score += 15;
  }

  let confianza;
  if      (esRH && dias > 5)  confianza = 'RH_DIFERIDA';
  else if (score >= 85)       confianza = 'ALTA';
  else if (score >= 65)       confianza = 'MEDIA';
  else                        confianza = 'BAJA';

  return { score, confianza, dias: Math.round(dias) };
}

function _concDetectarMatches(docs, bancos) {
  const usadosBanco = new Set();
  const usadosDocs  = new Set();
  const matches     = [];

  for (const doc of docs) {
    const imp = doc.importe;
    const candidatos = bancos
      .filter(b => {
        if (usadosBanco.has(b.id))                               return false;
        if (conc_rechazados.has(`${doc.id}|${b.id}`))            return false;
        if (b.naturaleza !== doc.naturaleza)                     return false;
        if (Math.abs(b.importe - imp) > 0.01)                   return false;
        return true;
      })
      .map(b => { const r = _concPuntuar(doc, b); return r ? { banco: b, ...r } : null; })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!candidatos.length) continue;
    const mejor = candidatos[0];
    matches.push({
      doc,
      banco:     mejor.banco,
      score:     mejor.score,
      confianza: mejor.confianza,
      dias:      mejor.dias,
      alternos:  candidatos.slice(1, 3).map(c => c.banco),
    });
    usadosBanco.add(mejor.banco.id);
    usadosDocs.add(doc.id);
  }

  const orden = { ALTA: 0, MEDIA: 1, BAJA: 2, RH_DIFERIDA: 3 };
  matches.sort((a, b) => (orden[a.confianza]??4) - (orden[b.confianza]??4));

  return {
    matches,
    sinDoc:   docs.filter(d => !usadosDocs.has(d.id)),
    sinBanco: bancos.filter(b => !usadosBanco.has(b.id)),
  };
}

// ── Resumen ───────────────────────────────────────────────────────
function _concRenderResumen() {
  const grid = document.getElementById('conc-resumen');
  if (!grid) return;

  const nAlta   = conc_matches.filter(m => m.confianza === 'ALTA').length;
  const nMedia  = conc_matches.filter(m => m.confianza === 'MEDIA').length;
  const nBaja   = conc_matches.filter(m => ['BAJA','RH_DIFERIDA'].includes(m.confianza)).length;
  const nSinDoc = conc_sin_doc.length;
  const nSinBan = conc_sin_banco.length;

  const tarjeta = (icono, bg, num, label, color) => `
    <div class="stat-card">
      <div class="stat-icono" style="background:${bg}">${icono}</div>
      <div class="stat-info">
        <div class="numero" style="font-size:18px;color:${color||'inherit'}">${num}</div>
        <div class="etiqueta">${label}</div>
      </div>
    </div>`;

  const nGrupo  = conc_matches_grupo.length;

  grid.innerHTML =
    tarjeta('⚡', '#F0FFF4', nAlta,   'Alta confianza', 'var(--color-exito)') +
    tarjeta('🔶', '#FFFBEB', nMedia,  'Media confianza', '#D69E2E') +
    tarjeta('🔷', '#EBF4FF', nBaja,   'Baja / RH diferida', '#3182CE') +
    (nGrupo ? tarjeta('🧮', '#FAF5FF', nGrupo, 'Grupos RH', '#6B46C1') : '') +
    tarjeta('📄', '#FFF5F5', nSinDoc, 'Docs sin match', 'var(--color-rojo)') +
    tarjeta('🏦', '#F7FAFC', nSinBan, 'Banco sin match', 'var(--color-texto-suave)');
}

// ── Sugerencias ───────────────────────────────────────────────────
function _concBadgeConfianza(confianza) {
  const cfg = {
    ALTA:        { bg:'#C6F6D5', color:'#276749', label:'Alta confianza' },
    MEDIA:       { bg:'#FEFCBF', color:'#744210', label:'Media confianza' },
    BAJA:        { bg:'#FED7AA', color:'#7B341E', label:'Baja confianza' },
    RH_DIFERIDA: { bg:'#BEE3F8', color:'#2A4365', label:'Fecha diferida (RH)' },
  };
  const c = cfg[confianza] || cfg.BAJA;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color}">${c.label}</span>`;
}

function _concRenderSugerencias() {
  const cont  = document.getElementById('conc-sugerencias');
  const badge = document.getElementById('conc-badge-matches');
  if (badge) badge.textContent = conc_matches.length + conc_matches_grupo.length;
  if (!cont) return;

  if (!conc_matches.length && !conc_matches_grupo.length) {
    cont.innerHTML = `
      <div class="text-center text-muted text-sm" style="padding:24px">
        No se encontraron matches automáticos para este período.<br>
        Usa las tablas de abajo para conciliar manualmente.
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div style="overflow-x:auto">
      <table class="tabla" style="font-size:12px">
        <thead>
          <tr>
            <th style="min-width:130px">Confianza</th>
            <th>Fecha doc.</th>
            <th>Documento / Emisor</th>
            <th class="text-right">Importe doc.</th>
            <th></th>
            <th>Fecha banco</th>
            <th>Descripción banco</th>
            <th class="text-right">Importe banco</th>
            <th class="text-center">Δ días</th>
            <th class="text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${conc_matches.map(match => {
            const { doc, banco, confianza, dias } = match;
            const esRH  = doc._source === 'RH';
            const alertaFecha = (confianza === 'RH_DIFERIDA')
              ? `<div style="font-size:10px;color:#2A4365;margin-top:2px">⚠️ RH emitido antes del pago</div>`
              : '';
            const rowBg = confianza === 'ALTA'
              ? 'rgba(198,246,213,.25)'
              : confianza === 'RH_DIFERIDA'
                ? 'rgba(190,227,248,.2)'
                : '';
            return `
              <tr style="background:${rowBg}">
                <td>${_concBadgeConfianza(confianza)}${alertaFecha}</td>
                <td style="white-space:nowrap">${formatearFecha(doc.fecha)}</td>
                <td class="text-sm">
                  <div style="font-weight:500">${escapar((doc.nombre || doc.documento || '—').slice(0,30))}</div>
                  <div style="color:var(--color-texto-suave);font-size:11px">${doc.tipo}${doc.documento ? ' · ' + escapar(doc.documento.slice(0,18)) : ''}</div>
                </td>
                <td class="text-right" style="font-weight:600;white-space:nowrap;color:${doc.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
                  ${doc.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(doc.importe, doc.moneda)}
                </td>
                <td style="text-align:center;font-size:16px;color:var(--color-texto-suave)">⟷</td>
                <td style="white-space:nowrap">${formatearFecha(banco.fecha)}</td>
                <td class="text-sm" title="${escapar(banco.descripcion||'')}">${escapar((banco.descripcion || '—').slice(0,30))}
                  ${banco.cuenta ? `<div style="font-size:11px;color:var(--color-texto-suave)">${escapar(banco.cuenta)}</div>` : ''}
                </td>
                <td class="text-right" style="font-weight:600;white-space:nowrap;color:${banco.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
                  ${banco.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(banco.importe, banco.moneda)}
                </td>
                <td class="text-center" style="white-space:nowrap">
                  <span style="font-size:11px;color:${dias===0?'var(--color-exito)':dias<=5?'#D69E2E':'var(--color-rojo)'}">
                    ${dias === 0 ? 'Mismo día' : `${dias} día${dias===1?'':'s'}`}
                  </span>
                </td>
                <td class="text-center" style="white-space:nowrap">
                  <button onclick="_concAprobarMatch('${doc.id}','${banco.id}')"
                    style="padding:3px 9px;background:var(--color-exito);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;margin-right:4px"
                    title="Aprobar este match">✓ Aprobar</button>
                  <button onclick="_concRechazarSugerencia('${doc.id}','${banco.id}')"
                    style="padding:3px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
                    title="Rechazar — pasar a sin match">✗</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${conc_matches_grupo.length ? `
    <div style="margin-top:20px">
      <p style="font-size:13px;font-weight:600;color:#6B46C1;margin-bottom:10px">
        🧮 Matches por suma de RH
        <span style="font-size:11px;font-weight:400;color:var(--color-texto-suave);margin-left:8px">
          Un movimiento bancario coincide con la suma de varios recibos por honorarios
        </span>
      </p>
      <div style="overflow-x:auto">
        <table class="tabla" style="font-size:12px">
          <thead>
            <tr>
              <th>Banco — Fecha / Monto</th>
              <th>Descripción banco</th>
              <th>RH que suman el monto</th>
              <th class="text-center">Δ días máx</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${conc_matches_grupo.map(g => {
              const docIds = g.docs.map(d => d.id).join(',');
              return `
                <tr style="background:rgba(237,233,254,.25)">
                  <td style="white-space:nowrap">
                    <div style="font-weight:600">${g.banco.fecha}</div>
                    <div style="color:var(--color-rojo);font-weight:700">−${formatearMoneda(g.banco.importe, g.banco.moneda)}</div>
                    <div style="font-size:11px;color:var(--color-texto-suave)">${escapar(g.banco.cuenta || '')}</div>
                  </td>
                  <td class="text-sm">${escapar((g.banco.descripcion || '—').slice(0,32))}</td>
                  <td>
                    ${g.docs.map(rh => `
                      <div style="padding:2px 0;border-bottom:1px solid var(--color-borde)">
                        <span style="font-weight:500">${escapar(rh.nombre.slice(0,22))}</span>
                        <span class="text-muted" style="margin-left:6px;font-size:11px">${rh.documento}</span>
                        <span style="float:right;color:var(--color-rojo);font-weight:600">−${formatearMoneda(rh.importe, rh.moneda)}</span>
                        <div style="clear:both"></div>
                        <span class="text-muted" style="font-size:11px">${rh.fecha}</span>
                      </div>`).join('')}
                    <div style="text-align:right;padding-top:3px;font-size:11px;color:#6B46C1;font-weight:600">
                      Σ = ${formatearMoneda(g.docs.reduce((s,d)=>s+d.importe,0), g.banco.moneda)}
                    </div>
                  </td>
                  <td class="text-center">
                    <span style="font-size:11px;color:${g.diasMax<=7?'var(--color-exito)':g.diasMax<=15?'#D69E2E':'var(--color-rojo)'}">
                      ${g.diasMax} día${g.diasMax===1?'':'s'}
                    </span>
                  </td>
                  <td class="text-center" style="white-space:nowrap">
                    <button onclick="_concAprobarGrupoRH('${g.banco.id}','${docIds}')"
                      style="padding:3px 9px;background:var(--color-exito);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;margin-right:4px"
                      title="Aprobar: conciliar estos ${g.docs.length} RH con el movimiento">✓ Aprobar</button>
                    <button onclick="_concRechazarGrupo('${g.banco.id}')"
                      style="padding:3px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
                      title="Rechazar sugerencia">✗</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}`;
}

// ── Sin match ─────────────────────────────────────────────────────
function _concRenderSinMatch() {
  const tbodyDocs  = document.getElementById('conc-tbody-docs');
  const tbodyBanco = document.getElementById('conc-tbody-banco');
  const badgeDocs  = document.getElementById('conc-badge-docs');
  const badgeBanco = document.getElementById('conc-badge-banco');

  if (badgeDocs)  badgeDocs.textContent  = conc_sin_doc.length;
  if (badgeBanco) badgeBanco.textContent = conc_sin_banco.length;

  if (tbodyDocs) {
    if (!conc_sin_doc.length) {
      tbodyDocs.innerHTML = '<tr><td colspan="4" class="text-center text-muted text-sm" style="padding:16px">Sin documentos pendientes</td></tr>';
    } else {
      tbodyDocs.innerHTML = conc_sin_doc.map(d => {
        const sel = d.id === conc_sel_doc;
        return `
          <tr onclick="_concSeleccionarDoc('${d.id}')"
              style="cursor:pointer;${sel?'background:var(--color-primario-claro,#EBF8FF);font-weight:500':''}">
            <td style="white-space:nowrap">${d.fecha || '—'}</td>
            <td><span class="badge ${d.tipo==='RH'?'badge-info':d.tipo==='Compra'?'badge-critico':'badge-activo'}" style="font-size:10px">${d.tipo}</span></td>
            <td class="text-sm">${escapar((d.nombre || d.documento || '—').slice(0,24))}</td>
            <td class="text-right ${d.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
              ${d.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(d.importe, d.moneda)}
            </td>
          </tr>`;
      }).join('');
    }
  }

  if (tbodyBanco) {
    if (!conc_sin_banco.length) {
      tbodyBanco.innerHTML = '<tr><td colspan="4" class="text-center text-muted text-sm" style="padding:16px">Sin movimientos bancarios pendientes</td></tr>';
    } else {
      tbodyBanco.innerHTML = conc_sin_banco.map(b => {
        const sel = b.id === conc_sel_banco;
        const nroOp = b.nro_operacion_bancaria || b.id?.slice(0,8) || '';
        return `
          <tr onclick="_concSeleccionarBanco('${b.id}')"
              style="cursor:pointer;${sel?'background:var(--color-primario-claro,#EBF8FF);font-weight:500':''}">
            <td style="white-space:nowrap">${formatearFecha(b.fecha)}</td>
            <td class="text-sm" title="${escapar(b.descripcion||'')}">${escapar((b.descripcion || '—').slice(0,26))}</td>
            <td class="text-right ${b.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
              ${b.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(b.importe, b.moneda)}
            </td>
            <td><span class="badge ${b.naturaleza==='CARGO'?'badge-critico':'badge-activo'}" style="font-size:10px">${b.naturaleza}</span></td>
            <td style="text-align:center" onclick="event.stopPropagation()">
              <button title="📂 Buscar comprobante manualmente (Compras, Ventas, RH, Planilla Movilidad)"
                onclick="_bmBuscarDoc('${b.id}','${escapar(nroOp)}',${b.importe||0},'${b.fecha||''}','tesoreria_mbd')"
                style="padding:3px 7px;background:rgba(85,60,154,.12);color:#553C9A;border:none;border-radius:4px;cursor:pointer;font-size:12px">📂</button>
            </td>
          </tr>`;
      }).join('');
    }
  }
}

// ── Selección manual ──────────────────────────────────────────────
function _concSeleccionarDoc(id) {
  conc_sel_doc = conc_sel_doc === id ? null : id;
  _concRenderSinMatch();
  _concActualizarPanelManual();
}

function _concSeleccionarBanco(id) {
  conc_sel_banco = conc_sel_banco === id ? null : id;
  _concRenderSinMatch();
  _concActualizarPanelManual();
}

function _concActualizarPanelManual() {
  const panel  = document.getElementById('conc-match-panel');
  const detDoc = document.getElementById('conc-det-doc');
  const detBan = document.getElementById('conc-det-banco');
  const difTxt = document.getElementById('conc-dif-texto');
  const btnOk  = document.getElementById('btn-confirmar-match');
  if (!panel) return;

  const mDoc   = conc_sin_doc.find(d => d.id === conc_sel_doc);
  const mBanco = conc_sin_banco.find(b => b.id === conc_sel_banco);

  if (!mDoc && !mBanco) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const tarjetaDoc = mDoc ? `
    <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:4px">${mDoc.tipo}</div>
    <div style="font-weight:600">${escapar(mDoc.nombre || mDoc.documento || '—')}</div>
    ${mDoc.documento ? `<div class="text-sm text-muted">${escapar(mDoc.documento)}</div>` : ''}
    <div class="text-sm" style="margin-top:4px">${mDoc.fecha || '—'}</div>
    <div style="font-size:16px;font-weight:700;margin-top:8px;color:${mDoc.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
      ${mDoc.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(mDoc.importe, mDoc.moneda)}
    </div>` : '<div class="text-muted text-sm">Sin selección</div>';

  const tarjetaBan = mBanco ? `
    <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:4px">BANCO${mBanco.cuenta ? ' · ' + mBanco.cuenta : ''}</div>
    <div style="font-weight:600">${escapar((mBanco.descripcion || '—').slice(0,40))}</div>
    <div class="text-sm" style="margin-top:4px">${mBanco.fecha || '—'}</div>
    <div style="font-size:16px;font-weight:700;margin-top:8px;color:${mBanco.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
      ${mBanco.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(mBanco.importe, mBanco.moneda)}
    </div>` : '<div class="text-muted text-sm">Sin selección</div>';

  if (detDoc) detDoc.innerHTML = tarjetaDoc;
  if (detBan) detBan.innerHTML = tarjetaBan;

  if (mDoc && mBanco && difTxt) {
    const diffMonto = Math.abs(mDoc.importe - mBanco.importe);
    const diffDias  = Math.abs(new Date(mDoc.fecha) - new Date(mBanco.fecha)) / 86400000;
    const natOk     = mDoc.naturaleza === mBanco.naturaleza;
    const montoOk   = diffMonto <= 0.01;

    if (!natOk) {
      difTxt.innerHTML = '<span style="color:var(--color-rojo)">⚠️ Naturalezas distintas (CARGO vs ABONO) — no se recomienda conciliar</span>';
    } else if (!montoOk) {
      difTxt.innerHTML = `<span style="color:var(--color-rojo)">⚠️ Montos distintos — diferencia: ${formatearMoneda(diffMonto)}</span>`;
    } else {
      const diasText = diffDias === 0 ? 'Mismo día' : `${Math.round(diffDias)} días de diferencia`;
      difTxt.innerHTML = `<span style="color:var(--color-exito)">✓ Montos coinciden · ${diasText}</span>`;
    }
  } else if (difTxt) {
    difTxt.innerHTML = '';
  }

  if (btnOk) btnOk.disabled = !(mDoc && mBanco);
}

function _concLimpiarSeleccion() {
  conc_sel_doc   = null;
  conc_sel_banco = null;
  const panel = document.getElementById('conc-match-panel');
  if (panel) panel.style.display = 'none';
}

// ── Aprobación ────────────────────────────────────────────────────
async function _concAprobarMatchInterno(doc, banco) {
  const hoy = new Date().toISOString().slice(0, 10);

  // 1. Actualizar tesoreria_mbd: marcar como EMITIDO + escribir N° comprobante
  const { error: errBanco } = await _supabase.from('tesoreria_mbd')
    .update({
      entrega_doc:   'EMITIDO',
      nro_factura_doc: doc.documento || null,   // número legible: E001-14, F001-xxx
      tipo_doc:        doc._source  || null,    // COMPRA / RH / VENTA
    })
    .eq('id', banco.id);
  if (errBanco) return errBanco.message;

  // 2. Marcar documento en su tabla maestra como conciliado
  const tablaDoc = doc._source === 'COMPRA' ? 'registro_compras'
                 : doc._source === 'VENTA'  ? 'registro_ventas'
                 : 'rh_registros';
  const { error: errDoc } = await _supabase.from(tablaDoc)
    .update({ conciliado: true, movimiento_id: banco.id, fecha_conciliacion: hoy })
    .eq('id', doc.id);
  if (errDoc) return errDoc.message;

  // 3. Auditoría en conciliaciones (fire-and-forget)
  _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        banco.id,
    doc_tipo:             doc._source,
    doc_id:               doc.id,
    score:                0,
    tipo_match:           'MANUAL',
    estado:               'APROBADO',
    usuario_id:           perfil_usuario?.id || null,
  }).then(() => {}).catch(() => {});

  return null;
}

async function _concAprobarMatch(docId, bancoId) {
  const match = conc_matches.find(m => m.doc.id === docId && m.banco.id === bancoId);
  if (!match) return;

  const err = await _concAprobarMatchInterno(match.doc, match.banco);
  if (err) { mostrarToast('Error al conciliar: ' + err, 'error'); return; }
  mostrarToast('✓ Match conciliado correctamente', 'exito');
  await _concCargarDatos();
}

function _concRechazarSugerencia(docId, bancoId) {
  const match = conc_matches.find(m => m.doc.id === docId && m.banco.id === bancoId);
  if (!match) return;
  conc_rechazados.add(`${docId}|${bancoId}`);
  conc_matches   = conc_matches.filter(m => !(m.doc.id === docId && m.banco.id === bancoId));
  conc_sin_doc   = [...conc_sin_doc,   match.doc];
  conc_sin_banco = [...conc_sin_banco, match.banco];
  _concRenderResumen();
  _concRenderSugerencias();
  _concRenderSinMatch();
}

async function _concConfirmarManual() {
  const mDoc   = conc_sin_doc.find(d => d.id === conc_sel_doc);
  const mBanco = conc_sin_banco.find(b => b.id === conc_sel_banco);
  if (!mDoc || !mBanco) return;

  const btn = document.getElementById('btn-confirmar-match');
  if (btn) { btn.disabled = true; btn.textContent = 'Conciliando…'; }

  const err = await _concAprobarMatchInterno(mDoc, mBanco);
  if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar match manual'; }

  if (err) { mostrarToast('Error al conciliar: ' + err, 'error'); return; }
  mostrarToast('✓ Match manual confirmado', 'exito');
  await _concCargarDatos();
}

// ── Auto-match (solo ALTA) ────────────────────────────────────────
async function _concAutoMatch() {
  const altas = conc_matches.filter(m => m.confianza === 'ALTA');
  if (!altas.length) {
    mostrarToast('No hay matches de alta confianza para aprobar automáticamente', 'atencion');
    return;
  }

  const btn = document.getElementById('btn-auto-conc');
  if (btn) { btn.disabled = true; btn.textContent = `Aprobando ${altas.length}…`; }

  let ok = 0; let errMsg = null;
  for (const match of altas) {
    const err = await _concAprobarMatchInterno(match.doc, match.banco);
    if (err) { errMsg = err; break; }
    ok++;
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚡ Aprobar alta confianza'; }
  if (errMsg) mostrarToast('Error parcial: ' + errMsg, 'atencion');
  else        mostrarToast(`✓ ${ok} matches de alta confianza aprobados`, 'exito');
  await _concCargarDatos();
}

// ── Aprobación / rechazo de grupos RH ────────────────────────────
async function _concAprobarGrupoRH(bancoId, docIdsStr) {
  const docIds = docIdsStr.split(',').filter(Boolean);
  const grupo  = conc_matches_grupo.find(g => g.banco.id === bancoId);
  if (!grupo || !docIds.length) return;

  const hoy = new Date().toISOString().slice(0, 10);

  // Reunir números de RH para anotarlos en el MBD
  const nrosRH = grupo.docs.map(d => d.documento).filter(Boolean).join(', ');

  const { error: errBanco } = await _supabase.from('tesoreria_mbd')
    .update({
      entrega_doc:     'EMITIDO',
      nro_factura_doc: nrosRH || null,
      tipo_doc:        'RH',
    })
    .eq('id', bancoId);
  if (errBanco) { mostrarToast('Error banco: ' + errBanco.message, 'error'); return; }

  const hoy = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(
    docIds.map(docId =>
      _supabase.from('rh_registros')
        .update({ conciliado: true, movimiento_id: bancoId, fecha_conciliacion: hoy })
        .eq('id', docId)
    )
  );
  const errRH = results.find(r => r.error);
  if (errRH) { mostrarToast('Error parcial RH: ' + errRH.error.message, 'atencion'); return; }

  mostrarToast(`✓ Grupo conciliado: ${docIds.length} RH contra 1 movimiento bancario`, 'exito');
  await _concCargarDatos();
}

function _concRechazarGrupo(bancoId) {
  conc_rechazados.add(`GRUPO_${bancoId}`);
  _concCargarDatos(); // recarga: los RH y el banco vuelven a sin_match; grupo no se resugerirá
}

// ── Historial ─────────────────────────────────────────────────────
async function _concCargarHistorial(mes) {
  const cont = document.getElementById('conc-historial');
  if (!cont) return;

  const [anio, m] = mes.split('-').map(Number);
  const desde = `${mes}-01`;
  const hasta  = `${mes}-${new Date(anio, m, 0).getDate()}`;

  const [resComp, resVent, resRH] = await Promise.all([
    _supabase.from('registro_compras')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('conciliado', true)
      .gte('fecha_conciliacion', desde)
      .lte('fecha_conciliacion', hasta)
      .order('fecha_conciliacion', { ascending: false })
      .limit(60),
    _supabase.from('registro_ventas')
      .select('*')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('conciliado', true)
      .gte('fecha_conciliacion', desde)
      .lte('fecha_conciliacion', hasta)
      .order('fecha_conciliacion', { ascending: false })
      .limit(60),
    _supabase.from('rh_registros')
      .select('*, prestadores_servicios(nombre)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('conciliado', true)
      .gte('fecha_conciliacion', desde)
      .lte('fecha_conciliacion', hasta)
      .order('fecha_conciliacion', { ascending: false })
      .limit(40),
  ]);

  const compras = resComp.data || [];
  const ventas  = resVent.data || [];
  const rh      = resRH.data   || [];

  if (!compras.length && !ventas.length && !rh.length) {
    cont.innerHTML = '<p class="text-center text-muted text-sm" style="padding:12px">Sin conciliaciones en este período</p>';
    return;
  }

  const thead = `<thead><tr>
    <th>Fecha concil.</th><th>Fecha doc.</th><th>Contraparte</th>
    <th>Documento</th><th class="text-right">Importe</th><th>Acc.</th>
  </tr></thead>`;

  const filaCompra = c => `
    <tr>
      <td style="white-space:nowrap">${c.fecha_conciliacion || '—'}</td>
      <td style="white-space:nowrap">${c.fecha_emision || '—'}</td>
      <td class="text-sm">${escapar((c.nombre_proveedor || '—').slice(0,32))}</td>
      <td class="text-sm">${escapar(c.serie && c.numero ? `${c.serie}-${c.numero}` : '—')}</td>
      <td class="text-right text-rojo" style="font-weight:500;white-space:nowrap">−${formatearMoneda(c.total, c.moneda)}</td>
      <td><button onclick="_concDeshacerMatch('${c.id}','COMPRA')"
        style="padding:2px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
        title="Deshacer conciliación">↩️</button></td>
    </tr>`;

  const filaVenta = v => `
    <tr>
      <td style="white-space:nowrap">${v.fecha_conciliacion || '—'}</td>
      <td style="white-space:nowrap">${v.fecha_emision || '—'}</td>
      <td class="text-sm">${escapar((v.nombre_cliente || '—').slice(0,32))}</td>
      <td class="text-sm">${escapar(v.serie && v.numero ? `${v.serie}-${v.numero}` : '—')}</td>
      <td class="text-right text-verde" style="font-weight:500;white-space:nowrap">+${formatearMoneda(v.total, v.moneda)}</td>
      <td><button onclick="_concDeshacerMatch('${v.id}','VENTA')"
        style="padding:2px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
        title="Deshacer conciliación">↩️</button></td>
    </tr>`;

  const filaRH = r => `
    <tr>
      <td style="white-space:nowrap">${r.fecha_conciliacion || '—'}</td>
      <td style="white-space:nowrap">${r.fecha_emision || '—'}</td>
      <td class="text-sm">${escapar((r.prestadores_servicios?.nombre || r.nombre_emisor || '—').slice(0,32))}</td>
      <td class="text-sm">${escapar(r.numero_rh || '—')}</td>
      <td class="text-right text-rojo" style="font-weight:500;white-space:nowrap">−${formatearMoneda(r.monto_neto, r.moneda)}</td>
      <td><button onclick="_concDeshacerMatch('${r.id}','RH')"
        style="padding:2px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
        title="Marcar como pendiente">↩️</button></td>
    </tr>`;

  const tablaCompras = compras.length ? `
    <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:6px">🛒 Compras conciliadas</p>
    <div class="table-wrap" style="margin-bottom:16px">
      <table class="tabla" style="font-size:12px">${thead}<tbody>${compras.map(filaCompra).join('')}</tbody></table>
    </div>` : '';

  const tablaVentas = ventas.length ? `
    <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:6px">💰 Ventas conciliadas</p>
    <div class="table-wrap" style="margin-bottom:16px">
      <table class="tabla" style="font-size:12px">${thead}<tbody>${ventas.map(filaVenta).join('')}</tbody></table>
    </div>` : '';

  const tablaRH = rh.length ? `
    <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:6px">🧾 RH conciliados</p>
    <div class="table-wrap">
      <table class="tabla" style="font-size:12px">${thead}<tbody>${rh.map(filaRH).join('')}</tbody></table>
    </div>` : '';

  cont.innerHTML = tablaCompras + tablaVentas + tablaRH;
}

async function _concDeshacerMatch(docId, tipo) {
  const msg = tipo === 'RH'
    ? '¿Marcar este RH como pendiente nuevamente?'
    : '¿Deshacer esta conciliación y devolver a pendientes?';
  if (!await confirmar(msg, { btnOk: 'Deshacer' })) return;

  const tabla = tipo === 'COMPRA' ? 'registro_compras'
              : tipo === 'VENTA'  ? 'registro_ventas'
              : 'rh_registros';

  // Recuperar movimiento_id para revertir el MBD también
  const { data: docData } = await _supabase.from(tabla)
    .select('movimiento_id')
    .eq('id', docId)
    .single();

  const movimientoId = docData?.movimiento_id;

  // Revertir documento en tabla maestra
  const { error: errDoc } = await _supabase.from(tabla)
    .update({ conciliado: false, movimiento_id: null, fecha_conciliacion: null })
    .eq('id', docId);
  if (errDoc) { mostrarToast('Error: ' + errDoc.message, 'error'); return; }

  // Revertir tesoreria_mbd — vuelve a PENDIENTE sin comprobante
  if (movimientoId) {
    await _supabase.from('tesoreria_mbd')
      .update({ entrega_doc: 'PENDIENTE', nro_factura_doc: null, tipo_doc: null })
      .eq('id', movimientoId);
  }

  mostrarToast('Conciliación deshecha — registro vuelve a pendientes', 'info');
  await _concCargarDatos();
}
