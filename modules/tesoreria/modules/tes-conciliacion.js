// ═══════════════════════════════════════════════════════════════
// Tesorería — Conciliación v2 (Motor de Match Inteligente)
// ═══════════════════════════════════════════════════════════════

let conc_docs       = [];          // documentos normalizados (SUNAT + RH)
let conc_bancos     = [];          // banco normalizados
let conc_matches    = [];          // [ { doc, banco, score, confianza, dias, alternos[] } ]
let conc_sin_doc    = [];
let conc_sin_banco  = [];
let conc_rechazados = new Set();   // "docId|bancoId" rechazados por usuario
let conc_sel_doc    = null;
let conc_sel_banco  = null;
let conc_periodo    = null;

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
              <thead><tr><th>Fecha</th><th>Descripción</th><th class="text-right">Importe</th><th>Nat.</th></tr></thead>
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

  // Lotes SUNAT de esta empresa
  const { data: lotes } = await _supabase
    .from('lotes_importacion')
    .select('id, tipo_fuente')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('tipo_fuente', ['SUNAT_COMPRAS', 'SUNAT_VENTAS']);

  const loteMap = {};
  (lotes || []).forEach(l => { loteMap[l.id] = l.tipo_fuente; });
  const loteIds = Object.keys(loteMap);

  // Query movimientos SUNAT (doc side)
  let qSunat = _supabase.from('movimientos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', false)
    .gte('fecha', desdeDoc)
    .lte('fecha', hastaBanco);
  qSunat = loteIds.length
    ? qSunat.in('lote_importacion', loteIds)
    : qSunat.eq('lote_importacion', '__NINGUNO__');
  if (nat === 'CARGO' || nat === 'ABONO') qSunat = qSunat.eq('naturaleza', nat);

  // Query banco (movimientos con cuenta bancaria, periodo seleccionado)
  let qBanco = _supabase.from('movimientos')
    .select('*, cuentas_bancarias(nombre_alias)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', false)
    .not('cuenta_bancaria_id', 'is', null)
    .gte('fecha', desdeBanco)
    .lte('fecha', hastaBanco);
  if (nat === 'CARGO' || nat === 'ABONO') qBanco = qBanco.eq('naturaleza', nat);

  // Query RH Recibidas pendientes (doc side — siempre CARGO)
  let qRH = _supabase.from('contabilidad_rh_recibidas')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .eq('estado_pago', 'PENDIENTE')
    .gte('fecha_emision', desdeDoc)
    .lte('fecha_emision', hastaBanco);
  // Excluir RH si el filtro es solo ABONO
  if (nat === 'ABONO') qRH = qRH.eq('id', '__NINGUNO__');

  const [resSunat, resBanco, resRH] = await Promise.all([qSunat, qBanco, qRH]);

  const sunatDocs = (resSunat.data || []).map(m => _concNormalizarDoc(m, loteMap));
  const rhDocs    = (resRH.data   || []).map(r => _concNormalizarRH(r));
  conc_docs   = [...sunatDocs, ...rhDocs];
  conc_bancos = (resBanco.data || []).map(b => _concNormalizarBanco(b));
  conc_sel_doc   = null;
  conc_sel_banco = null;

  const resultado = _concDetectarMatches(conc_docs, conc_bancos);
  conc_matches   = resultado.matches;
  conc_sin_doc   = resultado.sinDoc;
  conc_sin_banco = resultado.sinBanco;

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
function _concNormalizarDoc(m, loteMap) {
  const tipoFuente = loteMap[m.lote_importacion] || 'SUNAT';
  return {
    id:          m.id,
    _source:     'SUNAT',
    _raw:        m,
    fecha:       m.fecha,
    naturaleza:  m.naturaleza,
    importe:     parseFloat(m.importe) || 0,
    moneda:      m.moneda || 'PEN',
    descripcion: m.descripcion || '',
    nombre:      m.descripcion || '',
    documento:   m.numero_documento || '',
    tipo:        tipoFuente === 'SUNAT_COMPRAS' ? 'Compra' : 'Venta',
  };
}

function _concNormalizarRH(r) {
  return {
    id:          r.id,
    _source:     'RH',
    _raw:        r,
    fecha:       r.fecha_emision,
    naturaleza:  'CARGO',
    importe:     parseFloat(r.renta_neta) || 0,
    moneda:      r.moneda === 'DOLARES' ? 'USD' : 'PEN',
    descripcion: r.descripcion || '',
    nombre:      r.nombre_emisor || '',
    documento:   r.nro_rh || '',
    tipo:        'RH',
  };
}

function _concNormalizarBanco(m) {
  return {
    id:          m.id,
    _source:     'BANCO',
    _raw:        m,
    fecha:       m.fecha,
    naturaleza:  m.naturaleza,
    importe:     parseFloat(m.importe) || 0,
    moneda:      m.moneda || 'PEN',
    descripcion: m.descripcion || m.numero_operacion || '',
    cuenta:      m.cuentas_bancarias?.nombre_alias || '',
  };
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

  grid.innerHTML =
    tarjeta('⚡', '#F0FFF4', nAlta,  'Alta confianza', 'var(--color-exito)') +
    tarjeta('🔶', '#FFFBEB', nMedia, 'Media confianza', '#D69E2E') +
    tarjeta('🔷', '#EBF4FF', nBaja,  'Baja / RH diferida', '#3182CE') +
    tarjeta('📄', '#FFF5F5', nSinDoc,'Docs sin match', 'var(--color-rojo)') +
    tarjeta('🏦', '#F7FAFC', nSinBan,'Banco sin match', 'var(--color-texto-suave)');
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
  if (badge) badge.textContent = conc_matches.length;
  if (!cont) return;

  if (!conc_matches.length) {
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
                <td style="white-space:nowrap">${doc.fecha || '—'}</td>
                <td class="text-sm">
                  <div style="font-weight:500">${escapar((doc.nombre || doc.documento || '—').slice(0,30))}</div>
                  <div style="color:var(--color-texto-suave);font-size:11px">${doc.tipo}${doc.documento ? ' · ' + escapar(doc.documento.slice(0,18)) : ''}</div>
                </td>
                <td class="text-right" style="font-weight:600;white-space:nowrap;color:${doc.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
                  ${doc.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(doc.importe, doc.moneda)}
                </td>
                <td style="text-align:center;font-size:16px;color:var(--color-texto-suave)">⟷</td>
                <td style="white-space:nowrap">${banco.fecha || '—'}</td>
                <td class="text-sm">${escapar((banco.descripcion || '—').slice(0,30))}
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
    </div>`;
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
        return `
          <tr onclick="_concSeleccionarBanco('${b.id}')"
              style="cursor:pointer;${sel?'background:var(--color-primario-claro,#EBF8FF);font-weight:500':''}">
            <td style="white-space:nowrap">${b.fecha || '—'}</td>
            <td class="text-sm">${escapar((b.descripcion || '—').slice(0,26))}</td>
            <td class="text-right ${b.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
              ${b.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(b.importe, b.moneda)}
            </td>
            <td><span class="badge ${b.naturaleza==='CARGO'?'badge-critico':'badge-activo'}" style="font-size:10px">${b.naturaleza}</span></td>
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
  const promises = [
    _supabase.from('movimientos')
      .update({ conciliado: true, fecha_conciliacion: hoy })
      .eq('id', banco.id),
  ];

  if (doc._source === 'RH') {
    promises.push(
      _supabase.from('contabilidad_rh_recibidas')
        .update({ estado_pago: 'PAGADO', fecha_pago: hoy })
        .eq('id', doc.id)
    );
  } else {
    promises.push(
      _supabase.from('movimientos')
        .update({ conciliado: true, fecha_conciliacion: hoy })
        .eq('id', doc.id)
    );
  }

  const [r1, r2] = await Promise.all(promises);
  if (r1.error || r2?.error) {
    return (r1.error || r2?.error).message;
  }

  // Registrar en tabla conciliaciones si existe (migración 009)
  _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        banco.id,
    doc_tipo:             doc._source === 'RH' ? 'RH' : (doc.tipo === 'Compra' ? 'COMPRA' : 'VENTA'),
    doc_id:               doc.id,
    score:                0,
    tipo_match:           'MANUAL',
    estado:               'APROBADO',
    usuario_id:           perfil_usuario?.id || null,
  }).then(() => {}).catch(() => {});

  return null; // sin error
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

// ── Historial ─────────────────────────────────────────────────────
async function _concCargarHistorial(mes) {
  const cont = document.getElementById('conc-historial');
  if (!cont) return;

  const [anio, m] = mes.split('-').map(Number);
  const desde = `${mes}-01`;
  const hasta = `${mes}-${new Date(anio, m, 0).getDate()}`;

  const [resBanco, resRH] = await Promise.all([
    _supabase.from('movimientos')
      .select('*, cuentas_bancarias(nombre_alias)')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('conciliado', true)
      .not('cuenta_bancaria_id', 'is', null)
      .gte('fecha_conciliacion', desde)
      .lte('fecha_conciliacion', hasta)
      .order('fecha_conciliacion', { ascending: false })
      .limit(60),
    _supabase.from('contabilidad_rh_recibidas')
      .select('*')
      .eq('empresa_id', empresa_activa.id)
      .eq('estado_pago', 'PAGADO')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago', { ascending: false })
      .limit(40),
  ]);

  const banco = resBanco.data || [];
  const rh    = resRH.data    || [];

  if (!banco.length && !rh.length) {
    cont.innerHTML = '<p class="text-center text-muted text-sm" style="padding:12px">Sin conciliaciones en este período</p>';
    return;
  }

  const tablasBanco = banco.length ? `
    <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:6px">🏦 Movimientos bancarios conciliados</p>
    <div class="table-wrap" style="margin-bottom:16px">
      <table class="tabla" style="font-size:12px">
        <thead><tr>
          <th>Fecha concil.</th><th>Fecha mov.</th><th>Descripción</th>
          <th class="text-right">Importe</th><th>Nat.</th><th>Cuenta</th><th>Acc.</th>
        </tr></thead>
        <tbody>
          ${banco.map(b => `
            <tr>
              <td style="white-space:nowrap">${b.fecha_conciliacion || '—'}</td>
              <td style="white-space:nowrap">${b.fecha || '—'}</td>
              <td class="text-sm">${escapar((b.descripcion || b.numero_operacion || '—').slice(0,36))}</td>
              <td class="text-right ${b.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
                ${b.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(b.importe, b.moneda)}
              </td>
              <td><span class="badge ${b.naturaleza==='CARGO'?'badge-critico':'badge-activo'}" style="font-size:10px">${b.naturaleza}</span></td>
              <td class="text-sm">${escapar(b.cuentas_bancarias?.nombre_alias || '—')}</td>
              <td>
                <button onclick="_concDeshacerMatch('${b.id}','BANCO')"
                  style="padding:2px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
                  title="Deshacer conciliación">↩️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  const tablasRH = rh.length ? `
    <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:6px">🧾 RH conciliados (pagados)</p>
    <div class="table-wrap">
      <table class="tabla" style="font-size:12px">
        <thead><tr>
          <th>Fecha pago</th><th>N° RH</th><th>Emisor</th>
          <th class="text-right">Renta neta</th><th>Acc.</th>
        </tr></thead>
        <tbody>
          ${rh.map(r => `
            <tr>
              <td style="white-space:nowrap">${r.fecha_pago || '—'}</td>
              <td style="font-weight:600">${escapar(r.nro_rh || '—')}</td>
              <td class="text-sm">${escapar((r.nombre_emisor || '—').slice(0,30))}</td>
              <td class="text-right text-verde" style="font-weight:500;white-space:nowrap">
                ${formatearMoneda(r.renta_neta, r.moneda==='DOLARES'?'USD':'PEN')}
              </td>
              <td>
                <button onclick="_concDeshacerMatch('${r.id}','RH')"
                  style="padding:2px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:11px"
                  title="Marcar como pendiente">↩️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  cont.innerHTML = tablasBanco + tablasRH;
}

async function _concDeshacerMatch(id, tipo) {
  const msg = tipo === 'RH'
    ? '¿Marcar este RH como Pendiente de pago nuevamente?'
    : '¿Deshacer esta conciliación y marcar como pendiente?';
  if (!await confirmar(msg, { btnOk: 'Deshacer' })) return;

  let error;
  if (tipo === 'RH') {
    ({ error } = await _supabase
      .from('contabilidad_rh_recibidas')
      .update({ estado_pago: 'PENDIENTE', fecha_pago: null })
      .eq('id', id));
  } else {
    ({ error } = await _supabase
      .from('movimientos')
      .update({ conciliado: false, fecha_conciliacion: null })
      .eq('id', id));
  }

  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Conciliación deshecha — registro vuelve a pendientes', 'info');
  await _concCargarDatos();
}
