// ═══════════════════════════════════════════════════════════════
// Tributaria — Registro de Recibos por Honorarios (RH)
// ═══════════════════════════════════════════════════════════════

let rh_lista     = [];
let rh_filtrada  = [];
let rh_pag       = 1;
const RH_POR_PAG = 20;

async function renderTabRH(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Stats -->
      <div class="grid-3" id="rh-resumen" style="margin-bottom:20px;gap:12px"></div>

      <!-- Filtros -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Periodo</label>
            <input type="month" id="rh-periodo-f" onchange="filtrarRH()" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="rh-estado-f" onchange="filtrarRH()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="EMITIDO">Emitido</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="rh-buscar" oninput="filtrarRH()" class="input-buscar w-full"
                   placeholder="Nombre, N° RH…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="rh-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm" onclick="limpiarFiltrosRH()">🔄 Limpiar</button>
            <button class="btn btn-secundario btn-sm" onclick="exportarRHExcel()">⬇ Excel</button>
            <button class="btn btn-secundario btn-sm" onclick="importarRegistroRHSUNAT()">📊 Importar SUNAT</button>
            <button class="btn btn-primario btn-sm"   onclick="abrirModalRH(null)">+ Nuevo RH</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Fecha</th><th>N° RH</th><th>Prestador</th><th>Concepto</th>
            <th>Bruto</th><th>Retención</th><th>Neto</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-rh"></tbody>
        </table>
      </div>
      <div id="pag-rh" class="paginacion"></div>
    </div>

    <!-- Modal RH -->
    <div class="modal-overlay" id="modal-rh" style="display:none">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3 id="modal-rh-titulo">Nuevo Recibo por Honorarios</h3>
          <button class="modal-cerrar" onclick="cerrarModalRH()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-rh" class="alerta-error"></div>
          <input type="hidden" id="rh-id">

          <div class="grid-2">
            <div class="campo">
              <label>Prestador (DNI/RUC) <span class="req">*</span></label>
              <input type="text" id="rh-dni" placeholder="DNI o RUC del prestador"
                     autocomplete="off" data-form-type="other"
                     oninput="_rhBuscarPrestador(this.value)">
              <div id="rh-prestador-nombre" class="text-muted text-sm" style="margin-top:4px"></div>
            </div>
            <div class="campo">
              <label>N° Recibo RH</label>
              <input type="text" id="rh-numero" placeholder="E001-68"
                     autocomplete="off" data-form-type="other">
            </div>
            <div class="campo">
              <label>Fecha de emisión <span class="req">*</span></label>
              <input type="date" id="rh-fecha">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="rh-estado-m">
                <option value="EMITIDO">Emitido</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Concepto del servicio <span class="req">*</span></label>
              <input type="text" id="rh-concepto" placeholder="Descripción del servicio prestado"
                     autocomplete="off" data-form-type="other">
            </div>
            <div class="campo">
              <label>Monto bruto (S/.) <span class="req">*</span></label>
              <input type="number" id="rh-bruto" min="0" step="0.01" placeholder="0.00"
                     oninput="_rhCalcularNeto()">
            </div>
            <div class="campo">
              <label style="display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="rh-tiene-reten" onchange="_rhToggleRetencion()" checked>
                Tiene retención (8%)
              </label>
              <div id="rh-reten-campos" style="margin-top:8px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                  <div class="campo" style="margin-bottom:0">
                    <label style="font-size:11px">% Retención</label>
                    <input type="number" id="rh-pct-reten" value="8" min="0" max="100" step="0.01"
                           oninput="_rhCalcularNeto()">
                  </div>
                  <div class="campo" style="margin-bottom:0">
                    <label style="font-size:11px">Monto retención</label>
                    <input type="number" id="rh-mto-reten" min="0" step="0.01" readonly
                           style="background:var(--color-bg-alt,#f7fafc)">
                  </div>
                </div>
              </div>
            </div>
            <div class="campo">
              <label>Monto neto a pagar (S/.)</label>
              <input type="number" id="rh-neto" min="0" step="0.01" readonly
                     style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo col-2">
              <label>Observaciones</label>
              <input type="text" id="rh-obs" placeholder="Observaciones adicionales"
                     autocomplete="off" data-form-type="other">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalRH()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarRH()" id="btn-guardar-rh">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarRH();
}

async function cargarRH() {
  const { data } = await _supabase
    .from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni, ruc)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false })
    .limit(500);
  rh_lista = data || [];
  filtrarRH();
  _renderResumenRH();
}

function _renderResumenRH() {
  const grid = document.getElementById('rh-resumen');
  if (!grid) return;
  const total  = rh_lista.filter(r => r.estado !== 'ANULADO').reduce((s, r) => s + parseFloat(r.monto_bruto||0), 0);
  const reten  = rh_lista.filter(r => r.estado !== 'ANULADO').reduce((s, r) => s + parseFloat(r.monto_retencion||0), 0);
  const neto   = rh_lista.filter(r => r.estado !== 'ANULADO').reduce((s, r) => s + parseFloat(r.monto_neto||0), 0);
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono azul">💼</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(total)}</div><div class="etiqueta">Total bruto</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono rojo">🏛️</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(reten)}</div><div class="etiqueta">Retenciones</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">💵</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(neto)}</div><div class="etiqueta">Neto a pagar</div></div>
    </div>`;
}

function filtrarRH() {
  const q       = (document.getElementById('rh-buscar')?.value || '').toLowerCase();
  const periodo = document.getElementById('rh-periodo-f')?.value || '';
  const estado  = document.getElementById('rh-estado-f')?.value || '';

  rh_filtrada = rh_lista.filter(r => {
    const matchQ  = !q || (r.prestadores_servicios?.nombre||'').toLowerCase().includes(q)
                       || (r.numero_rh||'').includes(q)
                       || (r.concepto||'').toLowerCase().includes(q);
    const matchP  = !periodo || (r.periodo||'') === periodo;
    const matchE  = !estado  || r.estado === estado;
    return matchQ && matchP && matchE;
  });

  const ctr = document.getElementById('rh-contador');
  if (ctr) ctr.textContent = `${rh_filtrada.length} registro(s)`;
  rh_pag = 1;
  _renderTablaRH();
}

function limpiarFiltrosRH() {
  ['rh-buscar','rh-periodo-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['rh-estado-f'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  filtrarRH();
}

function _renderTablaRH() {
  const inicio = (rh_pag - 1) * RH_POR_PAG;
  const pagina = rh_filtrada.slice(inicio, inicio + RH_POR_PAG);
  const tbody  = document.getElementById('tbody-rh');
  if (!tbody) return;

  const colores = { EMITIDO: 'badge-activo', BORRADOR: 'badge-warning', ANULADO: 'badge-inactivo' };

  tbody.innerHTML = pagina.length ? pagina.map(r => `
    <tr>
      <td>${formatearFecha(r.fecha_emision)}</td>
      <td class="text-mono text-sm">${escapar(r.numero_rh || '—')}</td>
      <td class="text-sm">
        <div style="font-weight:500">${escapar(r.prestadores_servicios?.nombre || '—')}</div>
        <div class="text-muted" style="font-size:11px">${escapar(r.prestadores_servicios?.dni || '')}</div>
      </td>
      <td class="text-sm">${escapar((r.concepto||'').slice(0,45))}${(r.concepto||'').length>45?'…':''}</td>
      <td class="text-right">${formatearMoneda(r.monto_bruto)}</td>
      <td class="text-right text-rojo">${r.monto_retencion > 0 ? '-'+formatearMoneda(r.monto_retencion) : '—'}</td>
      <td class="text-right text-verde font-medium">${formatearMoneda(r.monto_neto)}</td>
      <td><span class="badge ${colores[r.estado]||'badge-info'}" style="font-size:11px">${r.estado}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalRH('${r.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarRH('${r.id}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="9" class="text-center text-muted">Sin registros de RH</td></tr>';

  const total = rh_filtrada.length;
  const pags  = Math.ceil(total / RH_POR_PAG);
  const pagEl = document.getElementById('pag-rh');
  if (pagEl) pagEl.innerHTML = total > RH_POR_PAG ? `
    <span class="pag-info">${inicio+1}–${Math.min(inicio+RH_POR_PAG,total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagRH(-1)" ${rh_pag<=1?'disabled':''}>‹</button>
    <span>${rh_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagRH(1)"  ${rh_pag>=pags?'disabled':''}>›</button>` : '';
}

function cambiarPagRH(dir) { rh_pag += dir; _renderTablaRH(); }

// ── Helpers del modal ─────────────────────────────────────────────
function _rhToggleRetencion() {
  const checked = document.getElementById('rh-tiene-reten')?.checked;
  const c = document.getElementById('rh-reten-campos');
  if (c) c.style.display = checked ? '' : 'none';
  _rhCalcularNeto();
}
function _rhCalcularNeto() {
  const bruto = parseFloat(document.getElementById('rh-bruto')?.value) || 0;
  const tiene = document.getElementById('rh-tiene-reten')?.checked;
  const pct   = tiene ? (parseFloat(document.getElementById('rh-pct-reten')?.value) || 0) : 0;
  const reten = bruto * pct / 100;
  const neto  = bruto - reten;
  const mtoEl = document.getElementById('rh-mto-reten');
  const netoEl= document.getElementById('rh-neto');
  if (mtoEl)  mtoEl.value  = reten.toFixed(2);
  if (netoEl) netoEl.value = neto.toFixed(2);
}

let _rh_prestador_id_cache = null;
async function _rhBuscarPrestador(dni) {
  _rh_prestador_id_cache = null;
  const el = document.getElementById('rh-prestador-nombre');
  if (!el) return;
  if (!dni || dni.length < 8) { el.textContent = ''; return; }
  const { data } = await _supabase
    .from('prestadores_servicios')
    .select('id, nombre')
    .eq('dni', dni.trim())
    .maybeSingle();
  if (data) {
    _rh_prestador_id_cache = data.id;
    el.textContent = '✓ ' + data.nombre;
    el.style.color = 'var(--color-verde)';
  } else {
    el.textContent = '— No encontrado. Se creará al guardar.';
    el.style.color = 'var(--color-texto-suave)';
  }
}

function abrirModalRH(id) {
  document.getElementById('alerta-rh').classList.remove('visible');
  _rh_prestador_id_cache = null;

  if (id) {
    const r = rh_lista.find(x => x.id === id);
    if (!r) return;
    document.getElementById('modal-rh-titulo').textContent = 'Editar RH';
    document.getElementById('rh-id').value        = r.id;
    document.getElementById('rh-dni').value       = r.prestadores_servicios?.dni || '';
    document.getElementById('rh-numero').value    = r.numero_rh || '';
    document.getElementById('rh-fecha').value     = r.fecha_emision;
    document.getElementById('rh-estado-m').value  = r.estado;
    document.getElementById('rh-concepto').value  = r.concepto;
    document.getElementById('rh-bruto').value     = r.monto_bruto;
    document.getElementById('rh-tiene-reten').checked = r.tiene_retencion;
    document.getElementById('rh-pct-reten').value = r.porcentaje_retencion || 8;
    document.getElementById('rh-mto-reten').value = r.monto_retencion;
    document.getElementById('rh-neto').value      = r.monto_neto;
    document.getElementById('rh-obs').value       = r.observaciones || '';
    _rh_prestador_id_cache = r.prestador_id;
    const el = document.getElementById('rh-prestador-nombre');
    if (el) { el.textContent = '✓ ' + (r.prestadores_servicios?.nombre || ''); el.style.color = 'var(--color-verde)'; }
    _rhToggleRetencion();
  } else {
    document.getElementById('modal-rh-titulo').textContent = 'Nuevo Recibo por Honorarios';
    document.getElementById('rh-id').value        = '';
    document.getElementById('rh-dni').value       = '';
    document.getElementById('rh-numero').value    = '';
    document.getElementById('rh-fecha').value     = new Date().toISOString().slice(0,10);
    document.getElementById('rh-estado-m').value  = 'EMITIDO';
    document.getElementById('rh-concepto').value  = '';
    document.getElementById('rh-bruto').value     = '';
    document.getElementById('rh-tiene-reten').checked = true;
    document.getElementById('rh-pct-reten').value = '8';
    document.getElementById('rh-mto-reten').value = '';
    document.getElementById('rh-neto').value      = '';
    document.getElementById('rh-obs').value       = '';
    document.getElementById('rh-prestador-nombre').textContent = '';
    _rhToggleRetencion();
  }
  document.getElementById('modal-rh').style.display = 'flex';
}
function cerrarModalRH() { document.getElementById('modal-rh').style.display = 'none'; }

async function guardarRH() {
  const alerta = document.getElementById('alerta-rh');
  alerta.classList.remove('visible');
  const dniVal    = document.getElementById('rh-dni').value.trim();
  const fecha     = document.getElementById('rh-fecha').value;
  const concepto  = document.getElementById('rh-concepto').value.trim();
  const bruto     = parseFloat(document.getElementById('rh-bruto').value);
  const btn       = document.getElementById('btn-guardar-rh');

  if (!dniVal)    { alerta.textContent = 'Ingresa el DNI o RUC del prestador.'; alerta.classList.add('visible'); return; }
  if (!fecha)     { alerta.textContent = 'La fecha es obligatoria.'; alerta.classList.add('visible'); return; }
  if (!concepto)  { alerta.textContent = 'El concepto del servicio es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!bruto || bruto <= 0) { alerta.textContent = 'El monto bruto debe ser mayor a 0.'; alerta.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Guardando…';

  // Obtener o crear prestador
  let prestadorId = _rh_prestador_id_cache;
  if (!prestadorId) {
    const { data: ps } = await _supabase
      .from('prestadores_servicios')
      .select('id')
      .eq('dni', dniVal)
      .maybeSingle();
    if (ps) {
      prestadorId = ps.id;
    } else {
      const { data: nuevo, error: errPS } = await _supabase
        .from('prestadores_servicios')
        .insert({ dni: dniVal, nombre: dniVal, ruc: dniVal.length === 11 ? dniVal : null, activo: true })
        .select()
        .single();
      if (errPS) { alerta.textContent = 'Error creando prestador: ' + errPS.message; alerta.classList.add('visible'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
      prestadorId = nuevo.id;
    }
  }

  const tiene  = document.getElementById('rh-tiene-reten')?.checked || false;
  const pctR   = tiene ? (parseFloat(document.getElementById('rh-pct-reten').value) || 0) : 0;
  const mtoR   = bruto * pctR / 100;
  const neto   = bruto - mtoR;
  const rhId   = document.getElementById('rh-id').value;

  const payload = {
    empresa_operadora_id: empresa_activa.id,
    prestador_id:         prestadorId,
    periodo:              fecha.slice(0,7),
    fecha_emision:        fecha,
    numero_rh:            document.getElementById('rh-numero').value.trim() || null,
    concepto,
    monto_bruto:          bruto,
    tiene_retencion:      tiene,
    porcentaje_retencion: pctR,
    monto_retencion:      mtoR,
    monto_neto:           neto,
    estado:               document.getElementById('rh-estado-m').value,
    observaciones:        document.getElementById('rh-obs').value.trim() || null,
    usuario_id:           perfil_usuario?.id || null,
  };

  const { error } = rhId
    ? await _supabase.from('rh_registros').update(payload).eq('id', rhId)
    : await _supabase.from('rh_registros').insert(payload);

  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(rhId ? 'RH actualizado' : 'RH registrado', 'exito');
  cerrarModalRH();
  await cargarRH();
}

async function eliminarRH(id) {
  if (!await confirmar('¿Eliminar este registro de RH?', { btnOk: 'Eliminar' })) return;
  const { error } = await _supabase.from('rh_registros').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarRH();
}

function exportarRHExcel() {
  if (!rh_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = rh_filtrada.map(r => ({
    Fecha:       r.fecha_emision,
    Periodo:     r.periodo,
    'N° RH':     r.numero_rh || '',
    DNI:         r.prestadores_servicios?.dni || '',
    Prestador:   r.prestadores_servicios?.nombre || '',
    Concepto:    r.concepto || '',
    'M. Bruto':  r.monto_bruto,
    'Retención': r.monto_retencion,
    'M. Neto':   r.monto_neto,
    '% Reten.':  r.porcentaje_retencion,
    Estado:      r.estado,
    Observaciones: r.observaciones || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RegistroRH');
  XLSX.writeFile(wb, `registro_rh_${empresa_activa.nombre}_${new Date().toISOString().slice(0,7)}.xlsx`);
}
