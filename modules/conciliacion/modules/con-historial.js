// ═══════════════════════════════════════════════════════════════
// Conciliación — Tab Historial
// ═══════════════════════════════════════════════════════════════

async function renderTabHistorial(area) {
  area.innerHTML = `
    <div class="fadeIn">

      <div class="card" style="margin-bottom:16px;padding:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;align-items:end">
          <div>
            <label class="label-filtro">Periodo</label>
            <input type="month" id="hist-periodo" class="input-buscar w-full" onchange="cargarHistorialConciliacion()">
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="hist-estado" class="input-buscar w-full" onchange="cargarHistorialConciliacion()">
              <option value="">Todos</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
          </div>
          <div>
            <button class="btn btn-secundario w-full" onclick="cargarHistorialConciliacion()">
              🔍 Filtrar
            </button>
          </div>
        </div>
      </div>

      <div id="hist-resumen-periodos" class="card" style="margin-bottom:16px;display:none">
        <h3 style="margin-bottom:12px">Resumen por periodo</h3>
        <div id="hist-resumen-grid"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3>Registros de conciliación</h3>
          <span id="hist-total-badge" class="badge badge-info" style="font-size:12px"></span>
        </div>
        <div id="hist-tabla-wrap">
          <div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando…</span></div>
        </div>
        <div id="hist-paginacion" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px"></div>
      </div>

    </div>`;

  const hoy  = new Date();
  const yyyy = hoy.getFullYear();
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
  const el   = document.getElementById('hist-periodo');
  if (el) el.value = `${yyyy}-${mm}`;

  await cargarHistorialConciliacion();
}

let _hist_pag     = 1;
const HIST_POR_PAG = 20;

async function cargarHistorialConciliacion(pag) {
  if (pag) _hist_pag = pag;

  const periodoEl = document.getElementById('hist-periodo');
  const estadoEl  = document.getElementById('hist-estado');
  const periodo   = periodoEl?.value || '';
  const estado    = estadoEl?.value  || '';

  const wrap = document.getElementById('hist-tabla-wrap');
  if (wrap) wrap.innerHTML = '<div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando…</span></div>';

  let q = _supabase
    .from('conciliaciones')
    .select(`
      *,
      movimientos(fecha, descripcion, importe, moneda, naturaleza, numero_operacion)
    `, { count: 'exact' })
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha_conciliacion', { ascending: false });

  if (estado) q = q.eq('estado', estado);

  if (periodo) {
    const [yyyy, mm] = periodo.split('-');
    const inicio = `${yyyy}-${mm}-01T00:00:00`;
    const fin    = new Date(parseInt(yyyy), parseInt(mm), 0);
    fin.setHours(23, 59, 59);
    q = q.gte('fecha_conciliacion', inicio).lte('fecha_conciliacion', fin.toISOString());
  }

  const desde = (_hist_pag - 1) * HIST_POR_PAG;
  q = q.range(desde, desde + HIST_POR_PAG - 1);

  const { data, count, error } = await q;

  if (error) {
    if (wrap) wrap.innerHTML = `<div class="alerta-error">${escapar(error.message)}</div>`;
    return;
  }

  const lista = data || [];
  const total = count || 0;

  const badge = document.getElementById('hist-total-badge');
  if (badge) badge.textContent = `${total} registro${total !== 1 ? 's' : ''}`;

  if (!lista.length) {
    if (wrap) wrap.innerHTML = '<p class="text-center text-muted text-sm" style="padding:24px">Sin registros para los filtros seleccionados</p>';
    _renderPaginacionHist(total);
    await _renderResumenPeriodos(periodo);
    return;
  }

  const colorTipoMatch = { EXACTO: 'badge-activo', POSIBLE: 'badge-warning', MANUAL: 'badge-info' };
  const colorEstado    = { APROBADO: 'badge-activo', RECHAZADO: 'badge-inactivo' };
  const colorDocTipo   = { COMPRA: 'badge-info', VENTA: 'badge-activo', RH: 'badge-warning', OTRO: 'badge-inactivo' };

  if (wrap) wrap.innerHTML = `
    <div class="table-wrap">
      <table class="tabla" style="font-size:12px">
        <thead>
          <tr>
            <th>Fecha conciliación</th>
            <th>Movimiento</th>
            <th>Monto</th>
            <th>Tipo doc</th>
            <th>Match</th>
            <th>Score</th>
            <th>Estado</th>
            <th>Clasificación</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const mov = r.movimientos;
            return `
              <tr>
                <td style="white-space:nowrap">${formatearFecha(r.fecha_conciliacion?.slice(0,10))}</td>
                <td class="text-sm">
                  <div style="font-weight:500">${escapar((mov?.descripcion || '').slice(0, 40))}</div>
                  <div class="text-muted" style="font-size:11px">${formatearFecha(mov?.fecha)} · ${escapar(mov?.numero_operacion || '—')}</div>
                </td>
                <td style="white-space:nowrap">
                  <span class="${(mov?.naturaleza || '') === 'CARGO' ? 'text-rojo' : 'text-verde'}">
                    ${(mov?.naturaleza || '') === 'CARGO' ? '-' : '+'}${mov ? formatearMoneda(Math.abs(mov.importe || 0), mov.moneda) : '—'}
                  </span>
                </td>
                <td><span class="badge ${colorDocTipo[r.doc_tipo] || 'badge-info'}" style="font-size:10px">${r.doc_tipo}</span></td>
                <td><span class="badge ${colorTipoMatch[r.tipo_match] || 'badge-info'}" style="font-size:10px">${r.tipo_match}</span></td>
                <td>
                  ${r.score > 0
                    ? `<span style="background:${r.score >= 80 ? '#dcfce7' : '#fef9c3'};color:${r.score >= 80 ? '#166534' : '#854d0e'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${r.score}</span>`
                    : '<span class="text-muted">—</span>'}
                </td>
                <td><span class="badge ${colorEstado[r.estado] || 'badge-info'}" style="font-size:10px">${r.estado}</span></td>
                <td class="text-sm text-muted">${escapar(r.clasificacion_manual || '—')}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  _renderPaginacionHist(total);
  await _renderResumenPeriodos(periodo);
}

function _renderPaginacionHist(total) {
  const pagCont = document.getElementById('hist-paginacion');
  if (!pagCont) return;

  const totalPags = Math.ceil(total / HIST_POR_PAG);
  if (totalPags <= 1) { pagCont.innerHTML = ''; return; }

  const pagInfo = document.createElement('span');
  pagInfo.className   = 'pag-info';
  pagInfo.textContent = `Página ${_hist_pag} de ${totalPags}`;

  pagCont.innerHTML = '';

  const btnAnt = document.createElement('button');
  btnAnt.className   = 'btn-pag';
  btnAnt.textContent = '‹ Anterior';
  btnAnt.disabled    = _hist_pag === 1;
  btnAnt.onclick     = () => cargarHistorialConciliacion(_hist_pag - 1);

  const btnSig = document.createElement('button');
  btnSig.className   = 'btn-pag';
  btnSig.textContent = 'Siguiente ›';
  btnSig.disabled    = _hist_pag >= totalPags;
  btnSig.onclick     = () => cargarHistorialConciliacion(_hist_pag + 1);

  pagCont.appendChild(btnAnt);
  pagCont.appendChild(pagInfo);
  pagCont.appendChild(btnSig);
}

async function _renderResumenPeriodos(periodoFiltro) {
  const resumenWrap = document.getElementById('hist-resumen-periodos');
  const resumenGrid = document.getElementById('hist-resumen-grid');
  if (!resumenWrap || !resumenGrid) return;

  let q = _supabase
    .from('conciliaciones')
    .select('tipo_match, estado, fecha_conciliacion')
    .eq('empresa_operadora_id', empresa_activa.id);

  if (periodoFiltro) {
    const [yyyy, mm] = periodoFiltro.split('-');
    const inicio = `${yyyy}-${mm}-01T00:00:00`;
    const fin    = new Date(parseInt(yyyy), parseInt(mm), 0);
    fin.setHours(23, 59, 59);
    q = q.gte('fecha_conciliacion', inicio).lte('fecha_conciliacion', fin.toISOString());
  }

  const { data } = await q;
  const lista = data || [];

  if (!lista.length) { resumenWrap.style.display = 'none'; return; }

  const exactos  = lista.filter(r => r.tipo_match === 'EXACTO' && r.estado === 'APROBADO').length;
  const posibles = lista.filter(r => r.tipo_match === 'POSIBLE' && r.estado === 'APROBADO').length;
  const manuales = lista.filter(r => r.tipo_match === 'MANUAL'  && r.estado === 'APROBADO').length;
  const rechazados = lista.filter(r => r.estado === 'RECHAZADO').length;
  const total    = lista.length;

  resumenWrap.style.display = 'block';
  resumenGrid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      <div style="text-align:center;padding:12px;background:var(--color-fondo-2);border-radius:var(--radio)">
        <div style="font-size:22px;font-weight:700;color:#22c55e">${exactos}</div>
        <div class="text-sm text-muted">Exactos aprobados</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--color-fondo-2);border-radius:var(--radio)">
        <div style="font-size:22px;font-weight:700;color:#f59e0b">${posibles}</div>
        <div class="text-sm text-muted">Posibles aprobados</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--color-fondo-2);border-radius:var(--radio)">
        <div style="font-size:22px;font-weight:700;color:#3b82f6">${manuales}</div>
        <div class="text-sm text-muted">Clasificados manual</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--color-fondo-2);border-radius:var(--radio)">
        <div style="font-size:22px;font-weight:700;color:#ef4444">${rechazados}</div>
        <div class="text-sm text-muted">Rechazados</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--color-fondo-2);border-radius:var(--radio)">
        <div style="font-size:22px;font-weight:700">${total}</div>
        <div class="text-sm text-muted">Total procesados</div>
      </div>
    </div>`;

  if (periodoFiltro) {
    const btnExp = document.createElement('div');
    btnExp.style.marginTop = '12px';
    btnExp.innerHTML = `
      <button class="btn btn-sm btn-secundario" onclick="_exportarHistorialPeriodo('${periodoFiltro}')">
        📥 Exportar historial de ${periodoFiltro}
      </button>`;
    resumenGrid.appendChild(btnExp);
  }
}

async function _exportarHistorialPeriodo(periodo) {
  const [yyyy, mm] = periodo.split('-');
  const inicio = `${yyyy}-${mm}-01T00:00:00`;
  const fin    = new Date(parseInt(yyyy), parseInt(mm), 0);
  fin.setHours(23, 59, 59);

  const { data, error } = await _supabase
    .from('conciliaciones')
    .select(`
      *,
      movimientos(fecha, descripcion, importe, moneda, naturaleza, numero_operacion, numero_documento)
    `)
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha_conciliacion', inicio)
    .lte('fecha_conciliacion', fin.toISOString())
    .order('fecha_conciliacion');

  if (error) { mostrarToast('Error al exportar: ' + error.message, 'error'); return; }
  if (!data?.length) { mostrarToast('Sin datos para exportar', 'atencion'); return; }

  const filas = [
    ['Fecha Conciliación','Fecha Movimiento','Descripción','N° Operación','Monto','Moneda','Naturaleza','N° Documento','Tipo Doc','Tipo Match','Score','Estado','Clasificación Manual'],
    ...data.map(r => {
      const mov = r.movimientos;
      return [
        r.fecha_conciliacion?.slice(0, 10) || '',
        mov?.fecha                          || '',
        mov?.descripcion                    || '',
        mov?.numero_operacion               || '',
        mov ? (mov.naturaleza === 'CARGO' ? -Math.abs(mov.importe) : Math.abs(mov.importe)) : '',
        mov?.moneda                         || '',
        mov?.naturaleza                     || '',
        mov?.numero_documento               || '',
        r.doc_tipo                          || '',
        r.tipo_match                        || '',
        r.score                             || 0,
        r.estado                            || '',
        r.clasificacion_manual              || '',
      ];
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial');
  XLSX.writeFile(wb, `Conciliacion_Historial_${periodo}_${empresa_activa.ruc || ''}.xlsx`);
  mostrarToast('Exportación completada', 'exito');
}
