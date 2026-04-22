// ═══════════════════════════════════════════════════════════════
// Tesorería — Conciliación (SUNAT vs Banco)
// ═══════════════════════════════════════════════════════════════

let conc_movs_sunat  = [];
let conc_movs_banco  = [];
let conc_sel_sunat   = null; // ID seleccionado lado SUNAT
let conc_sel_banco   = null; // ID seleccionado lado Banco
let conc_periodo     = null; // Filtro mes activo 'YYYY-MM'

async function renderTabConciliacion(area) {
  const hoy    = new Date();
  const mesStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  conc_periodo = mesStr;

  area.innerHTML = `
    <div class="fadeIn">

      <!-- Resumen rápido -->
      <div id="conc-resumen"
           style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px"></div>

      <!-- Filtros -->
      <div class="card" style="margin-bottom:16px;padding:14px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label class="label-filtro">Periodo</label>
            <input type="month" id="conc-mes" value="${mesStr}" onchange="_concFiltrarPeriodo()"
                   class="input-buscar">
          </div>
          <div>
            <label class="label-filtro">Naturaleza</label>
            <select id="conc-nat" onchange="_concCargarDatos()" class="input-buscar">
              <option value="">Todas</option>
              <option value="CARGO">CARGO (Compras)</option>
              <option value="ABONO">ABONO (Ventas)</option>
            </select>
          </div>
          <button class="btn btn-secundario btn-sm" onclick="_concCargarDatos()">🔄 Actualizar</button>
          <button class="btn btn-primario btn-sm" id="btn-auto-conc" onclick="_concAutoMatch()">
            ⚡ Auto-conciliar
          </button>
          <span class="text-muted text-sm" id="conc-info-match" style="align-self:center"></span>
        </div>
      </div>

      <!-- Panel principal: dos columnas -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">

        <!-- SUNAT -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-size:14px">📑 SUNAT — Pendientes
              <span id="conc-badge-sunat" class="badge badge-warning" style="font-size:11px;margin-left:6px"></span>
            </h3>
            <span class="text-muted text-sm">Clic para seleccionar</span>
          </div>
          <div class="table-wrap" style="max-height:480px;overflow-y:auto">
            <table class="tabla" style="font-size:12px">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>CDP</th>
                  <th>Importe</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody id="conc-tbody-sunat"></tbody>
            </table>
          </div>
        </div>

        <!-- Banco -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-size:14px">🏦 Banco — Pendientes
              <span id="conc-badge-banco" class="badge badge-warning" style="font-size:11px;margin-left:6px"></span>
            </h3>
            <span class="text-muted text-sm">Clic para seleccionar</span>
          </div>
          <div class="table-wrap" style="max-height:480px;overflow-y:auto">
            <table class="tabla" style="font-size:12px">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Importe</th>
                  <th>Naturaleza</th>
                </tr>
              </thead>
              <tbody id="conc-tbody-banco"></tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Panel de match seleccionado -->
      <div id="conc-match-panel" style="display:none" class="card"
           style="margin-top:16px;border:2px solid var(--color-primario)">
        <h3 style="margin-bottom:12px">🔗 Match seleccionado</h3>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center">
          <div id="conc-match-sunat" style="background:var(--color-fondo-2);border-radius:var(--radio);padding:12px;font-size:13px"></div>
          <div style="font-size:24px;text-align:center">⟷</div>
          <div id="conc-match-banco" style="background:var(--color-fondo-2);border-radius:var(--radio);padding:12px;font-size:13px"></div>
        </div>
        <div id="conc-match-diferencia" class="text-sm" style="margin-top:8px;text-align:center"></div>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:center">
          <button class="btn btn-secundario" onclick="_concLimpiarSeleccion()">✕ Cancelar</button>
          <button class="btn btn-primario"   onclick="_concConfirmarMatch()" id="btn-confirmar-match">
            ✅ Confirmar match
          </button>
        </div>
      </div>

      <!-- Historial de conciliaciones -->
      <div class="card" style="margin-top:16px">
        <h3 style="margin-bottom:12px">✅ Movimientos conciliados — <span id="conc-periodo-label"></span></h3>
        <div id="conc-historial">
          <div class="text-center text-muted text-sm" style="padding:16px">Cargando…</div>
        </div>
      </div>

    </div>`;

  await _concCargarDatos();
}

// ── Cargar datos ──────────────────────────────────────────────────
async function _concCargarDatos() {
  const mes = document.getElementById('conc-mes')?.value || conc_periodo;
  conc_periodo = mes;
  const nat = document.getElementById('conc-nat')?.value || '';

  const desde = `${mes}-01`;
  const hasta = `${mes}-31`;

  // IDs de lotes SUNAT de esta empresa
  const { data: lotesSunat } = await _supabase
    .from('lotes_importacion')
    .select('id')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('tipo_fuente', ['SUNAT_COMPRAS', 'SUNAT_VENTAS']);

  const loteIds = (lotesSunat || []).map(l => l.id);

  const filtros = (q) => {
    q = q.eq('empresa_operadora_id', empresa_activa.id)
         .eq('conciliado', false)
         .gte('fecha', desde)
         .lte('fecha', hasta);
    if (nat) q = q.eq('naturaleza', nat);
    return q;
  };

  let qSunat = _supabase.from('movimientos').select('*').order('fecha', { ascending: false });
  qSunat = filtros(qSunat);
  if (loteIds.length) qSunat = qSunat.in('lote_importacion', loteIds);
  else                qSunat = qSunat.eq('lote_importacion', 'NO_EXISTE'); // ningún resultado

  let qBanco = _supabase.from('movimientos')
    .select('*, cuentas_bancarias(nombre_alias)')
    .not('cuenta_bancaria_id', 'is', null)
    .order('fecha', { ascending: false });
  qBanco = filtros(qBanco);

  const [resSunat, resBanco, resConciliados] = await Promise.all([
    qSunat,
    qBanco,
    _concCargarConciliados(mes),
  ]);

  conc_movs_sunat = resSunat.data  || [];
  conc_movs_banco = resBanco.data  || [];
  conc_sel_sunat  = null;
  conc_sel_banco  = null;

  _concRenderResumen();
  _concRenderTablaSunat();
  _concRenderTablaBanco();
  _concLimpiarSeleccion();
  document.getElementById('conc-periodo-label').textContent = mes;
}

function _concFiltrarPeriodo() {
  const mes = document.getElementById('conc-mes')?.value;
  if (mes) conc_periodo = mes;
  _concCargarDatos();
}

// ── Resumen ───────────────────────────────────────────────────────
function _concRenderResumen() {
  const grid = document.getElementById('conc-resumen');
  if (!grid) return;

  const totalSunat = conc_movs_sunat.reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const totalBanco = conc_movs_banco.reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const diff       = Math.abs(totalSunat - totalBanco);
  const coinciden  = _concAutoDetectarMatches().length;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono" style="background:#EBF8FF">📑</div>
      <div class="stat-info">
        <div class="numero" style="font-size:18px">${conc_movs_sunat.length}</div>
        <div class="etiqueta">SUNAT pendientes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icono" style="background:#F0FFF4">🏦</div>
      <div class="stat-info">
        <div class="numero" style="font-size:18px">${conc_movs_banco.length}</div>
        <div class="etiqueta">Banco pendientes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icono" style="background:#FFFBEB">⚡</div>
      <div class="stat-info">
        <div class="numero" style="font-size:18px;color:var(--color-primario)">${coinciden}</div>
        <div class="etiqueta">Matches posibles</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icono" style="background:${diff < 0.01 ? '#F0FFF4' : '#FFF5F5'}">⚖️</div>
      <div class="stat-info">
        <div class="numero" style="font-size:18px;color:${diff < 0.01 ? 'var(--color-exito)' : 'var(--color-rojo)'}">
          ${formatearMoneda(diff)}
        </div>
        <div class="etiqueta">Diferencia S/</div>
      </div>
    </div>`;
}

// ── Tablas ────────────────────────────────────────────────────────
function _concRenderTablaSunat() {
  const tbody = document.getElementById('conc-tbody-sunat');
  const badge = document.getElementById('conc-badge-sunat');
  if (badge) badge.textContent = conc_movs_sunat.length;

  if (!tbody) return;
  if (!conc_movs_sunat.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted text-sm" style="padding:16px">Sin pendientes SUNAT</td></tr>';
    return;
  }

  // Pre-calcular qué SUNAT tienen match posible con banco
  const posibles = new Set(_concAutoDetectarMatches().map(p => p.sunat));

  tbody.innerHTML = conc_movs_sunat.map(m => {
    const sel     = m.id === conc_sel_sunat;
    const match   = posibles.has(m.id);
    return `
      <tr onclick="_concSeleccionarSunat('${m.id}')"
          style="cursor:pointer;transition:background 0.15s;
                 ${sel  ? 'background:var(--color-primario-claro,#EBF8FF);font-weight:500' : ''}
                 ${match && !sel ? 'background:#FFFBEB' : ''}"
          title="${match ? '⚡ Match posible encontrado' : ''}">
        <td style="white-space:nowrap">${m.fecha || '—'}</td>
        <td class="text-mono" style="font-size:11px;white-space:nowrap">
          ${match ? '⚡ ' : ''}${escapar((m.numero_documento || m.descripcion || '').slice(0, 18))}
        </td>
        <td class="text-right ${m.naturaleza === 'CARGO' ? 'text-rojo' : 'text-verde'}" style="font-weight:500;white-space:nowrap">
          ${m.naturaleza === 'CARGO' ? '−' : '+'}${formatearMoneda(m.importe, m.moneda)}
        </td>
        <td>
          <span class="badge ${m.naturaleza === 'CARGO' ? 'badge-critico' : 'badge-activo'}" style="font-size:10px">
            ${m.naturaleza}
          </span>
        </td>
      </tr>`;
  }).join('');
}

function _concRenderTablaBanco() {
  const tbody = document.getElementById('conc-tbody-banco');
  const badge = document.getElementById('conc-badge-banco');
  if (badge) badge.textContent = conc_movs_banco.length;

  if (!tbody) return;
  if (!conc_movs_banco.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted text-sm" style="padding:16px">Sin movimientos bancarios pendientes</td></tr>';
    return;
  }

  const posibles = new Set(_concAutoDetectarMatches().map(p => p.banco));

  tbody.innerHTML = conc_movs_banco.map(m => {
    const sel   = m.id === conc_sel_banco;
    const match = posibles.has(m.id);
    return `
      <tr onclick="_concSeleccionarBanco('${m.id}')"
          style="cursor:pointer;transition:background 0.15s;
                 ${sel  ? 'background:var(--color-primario-claro,#EBF8FF);font-weight:500' : ''}
                 ${match && !sel ? 'background:#FFFBEB' : ''}"
          title="${match ? '⚡ Match posible encontrado' : ''}">
        <td style="white-space:nowrap">${m.fecha || '—'}</td>
        <td class="text-sm">${match ? '⚡ ' : ''}${escapar((m.descripcion || m.numero_operacion || '—').slice(0, 24))}</td>
        <td class="text-right ${m.naturaleza === 'CARGO' ? 'text-rojo' : 'text-verde'}" style="font-weight:500;white-space:nowrap">
          ${m.naturaleza === 'CARGO' ? '−' : '+'}${formatearMoneda(m.importe, m.moneda)}
        </td>
        <td>
          <span class="badge ${m.naturaleza === 'CARGO' ? 'badge-critico' : 'badge-activo'}" style="font-size:10px">
            ${m.naturaleza}
          </span>
        </td>
      </tr>`;
  }).join('');
}

// ── Selección manual ──────────────────────────────────────────────
function _concSeleccionarSunat(id) {
  conc_sel_sunat = conc_sel_sunat === id ? null : id;
  _concRenderTablaSunat();
  _concActualizarPanelMatch();
}

function _concSeleccionarBanco(id) {
  conc_sel_banco = conc_sel_banco === id ? null : id;
  _concRenderTablaBanco();
  _concActualizarPanelMatch();
}

function _concActualizarPanelMatch() {
  const panel = document.getElementById('conc-match-panel');
  if (!panel) return;

  if (!conc_sel_sunat && !conc_sel_banco) {
    panel.style.display = 'none';
    return;
  }

  const mSunat = conc_movs_sunat.find(m => m.id === conc_sel_sunat);
  const mBanco = conc_movs_banco.find(m => m.id === conc_sel_banco);

  const panelSunat = document.getElementById('conc-match-sunat');
  const panelBanco = document.getElementById('conc-match-banco');
  const panelDiff  = document.getElementById('conc-match-diferencia');
  const btnConf    = document.getElementById('btn-confirmar-match');

  if (panelSunat) panelSunat.innerHTML = mSunat
    ? `<div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:4px">SUNAT</div>
       <div style="font-weight:600">${escapar(mSunat.numero_documento || mSunat.descripcion || '—')}</div>
       <div class="text-sm" style="margin-top:4px">${mSunat.fecha}</div>
       <div style="font-size:16px;font-weight:700;margin-top:6px;color:${mSunat.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
         ${mSunat.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(mSunat.importe, mSunat.moneda)}
       </div>`
    : '<div class="text-muted text-sm">Sin selección</div>';

  if (panelBanco) panelBanco.innerHTML = mBanco
    ? `<div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:4px">BANCO</div>
       <div style="font-weight:600">${escapar(mBanco.descripcion || mBanco.numero_operacion || '—')}</div>
       <div class="text-sm" style="margin-top:4px">${mBanco.fecha}</div>
       <div style="font-size:16px;font-weight:700;margin-top:6px;color:${mBanco.naturaleza==='CARGO'?'var(--color-rojo)':'var(--color-verde)'}">
         ${mBanco.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(mBanco.importe, mBanco.moneda)}
       </div>`
    : '<div class="text-muted text-sm">Sin selección</div>';

  if (panelDiff && mSunat && mBanco) {
    const diff = Math.abs(parseFloat(mSunat.importe) - parseFloat(mBanco.importe));
    const natMatch = mSunat.naturaleza === mBanco.naturaleza;
    const diffDias = Math.abs(new Date(mSunat.fecha) - new Date(mBanco.fecha)) / 86400000;
    const ok = diff < 0.01 && natMatch && diffDias <= 5;
    panelDiff.innerHTML = ok
      ? '<span style="color:var(--color-exito)">✅ Importes y naturaleza coinciden</span>'
      : `<span style="color:var(--color-rojo)">
          ⚠️ Diferencia: ${formatearMoneda(diff)}
          ${!natMatch ? ' | Naturaleza distinta' : ''}
          ${diffDias > 5 ? ` | ${Math.round(diffDias)} días de diferencia` : ''}
        </span>`;
  } else if (panelDiff) {
    panelDiff.innerHTML = '';
  }

  if (btnConf) btnConf.disabled = !(mSunat && mBanco);
  panel.style.display = mSunat || mBanco ? 'block' : 'none';
}

function _concLimpiarSeleccion() {
  conc_sel_sunat = null;
  conc_sel_banco = null;
  const panel = document.getElementById('conc-match-panel');
  if (panel) panel.style.display = 'none';
}

// ── Auto-match ────────────────────────────────────────────────────
function _concAutoDetectarMatches() {
  const matches = [];
  const bancoPareados = new Set();

  for (const ms of conc_movs_sunat) {
    const impS = parseFloat(ms.importe);
    for (const mb of conc_movs_banco) {
      if (bancoPareados.has(mb.id)) continue;
      if (ms.naturaleza !== mb.naturaleza) continue;
      const impB   = parseFloat(mb.importe);
      const diff   = Math.abs(impS - impB);
      const dias   = Math.abs(new Date(ms.fecha) - new Date(mb.fecha)) / 86400000;
      if (diff < 0.01 && dias <= 5) {
        matches.push({ sunat: ms.id, banco: mb.id, diff, dias });
        bancoPareados.add(mb.id);
        break;
      }
    }
  }
  return matches;
}

async function _concAutoMatch() {
  const matches = _concAutoDetectarMatches();
  if (!matches.length) {
    mostrarToast('No se encontraron matches exactos (mismo importe ±0.01, fecha ±5 días)', 'atencion');
    return;
  }

  const btn = document.getElementById('btn-auto-conc');
  if (btn) { btn.disabled = true; btn.textContent = `Conciliando ${matches.length}…`; }

  let ok = 0;
  for (const { sunat, banco } of matches) {
    const [r1, r2] = await Promise.all([
      _supabase.from('movimientos').update({ conciliado: true }).eq('id', sunat),
      _supabase.from('movimientos').update({ conciliado: true }).eq('id', banco),
    ]);
    if (!r1.error && !r2.error) ok++;
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚡ Auto-conciliar'; }
  mostrarToast(`✓ ${ok} de ${matches.length} matches conciliados`, 'exito');
  await _concCargarDatos();
}

// ── Confirmar match manual ────────────────────────────────────────
async function _concConfirmarMatch() {
  if (!conc_sel_sunat || !conc_sel_banco) return;

  const btn = document.getElementById('btn-confirmar-match');
  if (btn) { btn.disabled = true; btn.textContent = 'Conciliando…'; }

  const [r1, r2] = await Promise.all([
    _supabase.from('movimientos').update({ conciliado: true }).eq('id', conc_sel_sunat),
    _supabase.from('movimientos').update({ conciliado: true }).eq('id', conc_sel_banco),
  ]);

  if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar match'; }

  if (r1.error || r2.error) {
    mostrarToast('Error al conciliar: ' + (r1.error?.message || r2.error?.message), 'error');
    return;
  }

  mostrarToast('✓ Match confirmado y conciliado', 'exito');
  await _concCargarDatos();
}

// ── Historial conciliados ─────────────────────────────────────────
async function _concCargarConciliados(mes) {
  const desde = `${mes}-01`;
  const hasta = `${mes}-31`;

  const { data: lotesSunat } = await _supabase
    .from('lotes_importacion')
    .select('id')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('tipo_fuente', ['SUNAT_COMPRAS', 'SUNAT_VENTAS']);

  const loteIds = (lotesSunat || []).map(l => l.id);

  let q = _supabase
    .from('movimientos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('conciliado', true)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .limit(100);

  if (loteIds.length) q = q.in('lote_importacion', loteIds);

  const { data } = await q;
  const cont = document.getElementById('conc-historial');
  if (!cont) return;

  const lista = data || [];
  if (!lista.length) {
    cont.innerHTML = '<p class="text-center text-muted text-sm" style="padding:12px">Sin conciliaciones en este período</p>';
    return;
  }

  cont.innerHTML = `
    <div class="table-wrap">
      <table class="tabla" style="font-size:12px">
        <thead>
          <tr><th>Fecha</th><th>CDP / Descripción</th><th>Importe</th><th>Naturaleza</th><th>Acción</th></tr>
        </thead>
        <tbody>
          ${lista.map(m => `
            <tr>
              <td style="white-space:nowrap">${m.fecha || '—'}</td>
              <td class="text-sm">${escapar((m.numero_documento || m.descripcion || '—').slice(0, 40))}</td>
              <td class="text-right ${m.naturaleza === 'CARGO' ? 'text-rojo' : 'text-verde'}" style="font-weight:500">
                ${m.naturaleza === 'CARGO' ? '−' : '+'}${formatearMoneda(m.importe, m.moneda)}
              </td>
              <td>
                <span class="badge ${m.naturaleza === 'CARGO' ? 'badge-critico' : 'badge-activo'}" style="font-size:10px">
                  ${m.naturaleza}
                </span>
              </td>
              <td>
                <button class="btn-icono" title="Deshacer conciliación"
                        onclick="_concDeshacerMatch('${m.id}')">↩️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _concDeshacerMatch(id) {
  if (!await confirmar('¿Deshacer esta conciliación y marcarla como pendiente?', { btnOk: 'Deshacer' })) return;
  const { error } = await _supabase.from('movimientos').update({ conciliado: false }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Conciliación deshecha', 'info');
  await _concCargarDatos();
}
