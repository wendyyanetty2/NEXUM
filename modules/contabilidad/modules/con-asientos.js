// ═══════════════════════════════════════════════════════════════
// Contabilidad — Asientos
// ═══════════════════════════════════════════════════════════════

let asientos_lista    = [];
let asientos_filtrada = [];
let asientos_pag      = 1;
const ASI_POR_PAG     = 20;
let asi_plan_cuentas  = [];

async function renderTabAsientos(area) {
  const hoy   = new Date();
  const periodoDefecto = hoy.toISOString().slice(0, 7);

  area.innerHTML = `
    <div class="fadeIn">
      <div class="grid-3" id="asi-stats" style="margin-bottom:20px;gap:12px"></div>

      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Periodo</label>
            <input type="month" id="asi-periodo" value="${periodoDefecto}" onchange="filtrarAsientos()" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Tipo</label>
            <select id="asi-tipo-f" onchange="filtrarAsientos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="MANUAL">Manual</option>
              <option value="APERTURA">Apertura</option>
              <option value="CIERRE">Cierre</option>
              <option value="DESDE_TESORERIA">Desde Tesorería</option>
              <option value="DESDE_TRIBUTARIA">Desde Tributaria</option>
              <option value="DESDE_PLANILLA">Desde Planilla</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="asi-estado-f" onchange="filtrarAsientos()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="VALIDADO">Validado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="asi-buscar" oninput="filtrarAsientos()" class="input-buscar w-full"
                   placeholder="Glosa, número…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="asi-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm" onclick="exportarAsientosExcel()">⬇ Excel</button>
            <button class="btn btn-primario btn-sm"   onclick="abrirModalAsiento(null)">+ Nuevo asiento</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Número</th><th>Fecha</th><th>Glosa</th><th>Tipo</th>
            <th class="text-right">Debe</th><th class="text-right">Haber</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-asientos"></tbody>
        </table>
      </div>
      <div id="pag-asientos" class="paginacion"></div>
    </div>

    <!-- Modal asiento -->
    <div class="modal-overlay" id="modal-asiento" style="display:none">
      <div class="modal" style="max-width:900px;width:95vw">
        <div class="modal-header">
          <h3 id="modal-asi-titulo">Nuevo asiento</h3>
          <button class="modal-cerrar" onclick="cerrarModalAsiento()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-asi" class="alerta-error"></div>
          <input type="hidden" id="asi-id">
          <div class="grid-2" style="margin-bottom:16px">
            <div class="campo">
              <label>Periodo <span class="req">*</span></label>
              <input type="month" id="asi-periodo-f" value="${periodoDefecto}">
            </div>
            <div class="campo">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" id="asi-fecha-f" value="${hoy.toISOString().slice(0,10)}">
            </div>
            <div class="campo">
              <label>Número de asiento</label>
              <input type="text" id="asi-numero-f" placeholder="A-2024-001 (opcional)">
            </div>
            <div class="campo">
              <label>Tipo</label>
              <select id="asi-tipo-modal">
                <option value="MANUAL">Manual</option>
                <option value="APERTURA">Apertura</option>
                <option value="CIERRE">Cierre</option>
                <option value="DESDE_TESORERIA">Desde Tesorería</option>
                <option value="DESDE_TRIBUTARIA">Desde Tributaria</option>
                <option value="DESDE_PLANILLA">Desde Planilla</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Glosa <span class="req">*</span></label>
              <input type="text" id="asi-glosa-f" placeholder="Descripción del asiento">
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <strong style="font-size:13px">Líneas del asiento</strong>
            <button class="btn btn-secundario btn-sm" onclick="agregarLineaAsiento()">+ Agregar línea</button>
          </div>
          <div class="table-wrap" style="margin-bottom:12px">
            <table class="tabla" id="tabla-lineas-asiento">
              <thead><tr>
                <th style="width:120px">Código</th>
                <th style="min-width:200px">Nombre cuenta</th>
                <th>Descripción</th>
                <th style="width:130px" class="text-right">Debe</th>
                <th style="width:130px" class="text-right">Haber</th>
                <th style="width:36px"></th>
              </tr></thead>
              <tbody id="tbody-lineas"></tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:32px;padding:10px 8px;border-top:1px solid var(--color-borde)">
            <span style="font-size:13px">Total Debe: <strong id="total-debe-modal" class="text-mono">S/ 0.00</strong></span>
            <span style="font-size:13px">Total Haber: <strong id="total-haber-modal" class="text-mono">S/ 0.00</strong></span>
            <span id="alerta-cuadre" style="font-size:12px;color:var(--color-rojo,#e53e3e);display:none">⚠ No cuadra</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalAsiento()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarAsiento()" id="btn-guardar-asi">Guardar</button>
        </div>
      </div>
    </div>`;

  await Promise.all([cargarAsientos(), cargarPlanParaAsientos()]);
}

async function cargarAsientos() {
  const periodo = document.getElementById('asi-periodo')?.value || '';
  let query = _supabase
    .from('asientos')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha', { ascending: false })
    .order('numero_asiento', { ascending: false });
  if (periodo) query = query.eq('periodo', periodo);
  const { data, error } = await query.limit(500);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  asientos_lista = data || [];
  _renderStatsAsientos();
  filtrarAsientos();
}

async function cargarPlanParaAsientos() {
  const { data } = await _supabase
    .from('plan_cuentas')
    .select('codigo, nombre')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('acepta_movimientos', true)
    .eq('activo', true)
    .order('codigo');
  asi_plan_cuentas = data || [];
}

function _renderStatsAsientos() {
  const totalDebe  = asientos_lista.reduce((s, a) => s + parseFloat(a.total_debe || 0), 0);
  const totalHaber = asientos_lista.reduce((s, a) => s + parseFloat(a.total_haber || 0), 0);
  const diff       = totalDebe - totalHaber;
  const grid       = document.getElementById('asi-stats');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono azul">📝</div>
      <div class="stat-info"><div class="numero">${asientos_lista.length}</div><div class="etiqueta">Total asientos</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">⬆</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(totalDebe)}</div><div class="etiqueta">Total Debe</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono ${Math.abs(diff) < 0.01 ? 'verde' : 'rojo'}">⬇</div>
      <div class="stat-info">
        <div class="numero ${Math.abs(diff) < 0.01 ? '' : 'text-rojo'}">${formatearMoneda(totalHaber)}</div>
        <div class="etiqueta">Total Haber ${Math.abs(diff) >= 0.01 ? '(dif: ' + formatearMoneda(Math.abs(diff)) + ')' : ''}</div>
      </div>
    </div>`;
}

function filtrarAsientos() {
  const q      = (document.getElementById('asi-buscar')?.value || '').toLowerCase();
  const tipo   = document.getElementById('asi-tipo-f')?.value || '';
  const estado = document.getElementById('asi-estado-f')?.value || '';
  asientos_filtrada = asientos_lista.filter(a =>
    (!q || (a.glosa||'').toLowerCase().includes(q) || (a.numero_asiento||'').toLowerCase().includes(q)) &&
    (!tipo   || a.tipo === tipo) &&
    (!estado || a.estado === estado)
  );
  const ctr = document.getElementById('asi-contador');
  if (ctr) ctr.textContent = `${asientos_filtrada.length} asiento(s)`;
  asientos_pag = 1;
  renderTablaAsientos();
}

function renderTablaAsientos() {
  const inicio = (asientos_pag - 1) * ASI_POR_PAG;
  const pagina = asientos_filtrada.slice(inicio, inicio + ASI_POR_PAG);
  const tbody  = document.getElementById('tbody-asientos');
  if (!tbody) return;
  const coloresEstado = { BORRADOR: 'badge-warning', VALIDADO: 'badge-activo', ANULADO: 'badge-inactivo' };
  tbody.innerHTML = pagina.length ? pagina.map(a => `
    <tr>
      <td class="text-mono text-sm">${escapar(a.numero_asiento || '—')}</td>
      <td>${formatearFecha(a.fecha)}</td>
      <td>${escapar((a.glosa||'').slice(0,50))}${(a.glosa||'').length>50?'…':''}</td>
      <td class="text-sm">${a.tipo}</td>
      <td class="text-right text-mono">${formatearMoneda(a.total_debe)}</td>
      <td class="text-right text-mono">${formatearMoneda(a.total_haber)}</td>
      <td><span class="badge ${coloresEstado[a.estado] || 'badge-info'}" style="font-size:11px">${a.estado}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalAsiento('${a.id}')" title="Ver/Editar">✏️</button>
        ${a.estado === 'BORRADOR' ? `<button class="btn-icono" onclick="validarAsiento('${a.id}')" title="Validar">✅</button>` : ''}
        ${a.estado !== 'ANULADO'  ? `<button class="btn-icono peligro" onclick="anularAsiento('${a.id}')" title="Anular">🚫</button>` : ''}
        ${a.estado === 'BORRADOR' ? `<button class="btn-icono peligro" onclick="eliminarAsiento('${a.id}')" title="Eliminar">🗑️</button>` : ''}
      </td>
    </tr>`).join('') :
    '<tr><td colspan="8" class="text-center text-muted">Sin asientos registrados</td></tr>';
  const total = asientos_filtrada.length;
  const pags  = Math.ceil(total / ASI_POR_PAG);
  const pagEl = document.getElementById('pag-asientos');
  if (pagEl) pagEl.innerHTML = total > ASI_POR_PAG ? `
    <span class="pag-info">${inicio+1}–${Math.min(inicio+ASI_POR_PAG,total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagAsi(-1)" ${asientos_pag<=1?'disabled':''}>‹</button>
    <span>${asientos_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagAsi(1)"  ${asientos_pag>=pags?'disabled':''}>›</button>` : '';
}

function cambiarPagAsi(dir) { asientos_pag += dir; renderTablaAsientos(); }

let _lineas_counter = 0;

function agregarLineaAsiento(datos) {
  const tbody = document.getElementById('tbody-lineas');
  if (!tbody) return;
  const idx = _lineas_counter++;
  const codigo = datos?.cuenta_codigo || '';
  const nombre = datos?.cuenta_nombre || '';
  const desc   = datos?.descripcion   || '';
  const debe   = datos?.debe   != null ? datos.debe  : '';
  const haber  = datos?.haber  != null ? datos.haber : '';
  const datalistId = `dl-cuentas-${idx}`;
  const tr = document.createElement('tr');
  tr.dataset.idx = idx;
  tr.innerHTML = `
    <td>
      <input type="text" class="input-buscar w-full linea-codigo" list="${datalistId}"
             value="${escapar(codigo)}" placeholder="Código"
             oninput="autocompletarCuenta(this,${idx})" style="min-width:90px">
      <datalist id="${datalistId}">${asi_plan_cuentas.map(c => `<option value="${escapar(c.codigo)}">${escapar(c.nombre)}</option>`).join('')}</datalist>
    </td>
    <td><input type="text" class="input-buscar w-full linea-nombre" value="${escapar(nombre)}" placeholder="Nombre" readonly style="background:var(--color-bg-alt,#f7fafc)"></td>
    <td><input type="text" class="input-buscar w-full linea-desc" value="${escapar(desc)}" placeholder="Descripción"></td>
    <td><input type="number" class="input-buscar w-full linea-debe text-right" value="${debe}" min="0" step="0.01" placeholder="0.00" oninput="recalcularTotalesAsiento()"></td>
    <td><input type="number" class="input-buscar w-full linea-haber text-right" value="${haber}" min="0" step="0.01" placeholder="0.00" oninput="recalcularTotalesAsiento()"></td>
    <td><button class="btn-icono peligro" onclick="this.closest('tr').remove();recalcularTotalesAsiento()">✕</button></td>`;
  tbody.appendChild(tr);
  recalcularTotalesAsiento();
}

function autocompletarCuenta(input, idx) {
  const codigo = input.value.trim();
  const cuenta = asi_plan_cuentas.find(c => c.codigo === codigo);
  const tr = input.closest('tr');
  if (!tr) return;
  const nombreInput = tr.querySelector('.linea-nombre');
  if (nombreInput) nombreInput.value = cuenta ? cuenta.nombre : '';
}

function recalcularTotalesAsiento() {
  const tbody = document.getElementById('tbody-lineas');
  if (!tbody) return;
  let totalDebe = 0, totalHaber = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    totalDebe  += parseFloat(tr.querySelector('.linea-debe')?.value  || 0);
    totalHaber += parseFloat(tr.querySelector('.linea-haber')?.value || 0);
  });
  const elDebe  = document.getElementById('total-debe-modal');
  const elHaber = document.getElementById('total-haber-modal');
  const alCuadre = document.getElementById('alerta-cuadre');
  if (elDebe)   elDebe.textContent  = formatearMoneda(totalDebe);
  if (elHaber)  elHaber.textContent = formatearMoneda(totalHaber);
  if (alCuadre) alCuadre.style.display = Math.abs(totalDebe - totalHaber) > 0.005 ? 'inline' : 'none';
}

async function abrirModalAsiento(id) {
  _lineas_counter = 0;
  document.getElementById('alerta-asi').classList.remove('visible');
  document.getElementById('tbody-lineas').innerHTML = '';
  document.getElementById('alerta-cuadre').style.display = 'none';
  if (id) {
    const a = asientos_lista.find(x => x.id === id);
    if (!a) return;
    document.getElementById('modal-asi-titulo').textContent = 'Editar asiento';
    document.getElementById('asi-id').value        = a.id;
    document.getElementById('asi-periodo-f').value = a.periodo;
    document.getElementById('asi-fecha-f').value   = a.fecha;
    document.getElementById('asi-numero-f').value  = a.numero_asiento || '';
    document.getElementById('asi-tipo-modal').value = a.tipo;
    document.getElementById('asi-glosa-f').value   = a.glosa;
    const { data: lineas } = await _supabase
      .from('asiento_detalle')
      .select('*')
      .eq('asiento_id', id)
      .order('orden');
    (lineas || []).forEach(l => agregarLineaAsiento(l));
    if (!(lineas||[]).length) { agregarLineaAsiento(); agregarLineaAsiento(); }
  } else {
    document.getElementById('modal-asi-titulo').textContent = 'Nuevo asiento';
    document.getElementById('asi-id').value        = '';
    document.getElementById('asi-numero-f').value  = '';
    document.getElementById('asi-tipo-modal').value = 'MANUAL';
    document.getElementById('asi-glosa-f').value   = '';
    agregarLineaAsiento();
    agregarLineaAsiento();
  }
  recalcularTotalesAsiento();
  document.getElementById('modal-asiento').style.display = 'flex';
}

function cerrarModalAsiento() { document.getElementById('modal-asiento').style.display = 'none'; }

function _leerLineas() {
  const tbody = document.getElementById('tbody-lineas');
  const lineas = [];
  let orden = 1;
  tbody.querySelectorAll('tr').forEach(tr => {
    const codigo = tr.querySelector('.linea-codigo')?.value.trim();
    if (!codigo) return;
    lineas.push({
      orden:         orden++,
      cuenta_codigo: codigo,
      cuenta_nombre: tr.querySelector('.linea-nombre')?.value.trim() || null,
      descripcion:   tr.querySelector('.linea-desc')?.value.trim()   || null,
      debe:          parseFloat(tr.querySelector('.linea-debe')?.value  || 0),
      haber:         parseFloat(tr.querySelector('.linea-haber')?.value || 0),
    });
  });
  return lineas;
}

async function guardarAsiento() {
  const periodo = document.getElementById('asi-periodo-f').value;
  const fecha   = document.getElementById('asi-fecha-f').value;
  const glosa   = document.getElementById('asi-glosa-f').value.trim();
  const alerta  = document.getElementById('alerta-asi');
  const btn     = document.getElementById('btn-guardar-asi');
  alerta.classList.remove('visible');
  if (!periodo) { alerta.textContent = 'El periodo es obligatorio.';  alerta.classList.add('visible'); return; }
  if (!fecha)   { alerta.textContent = 'La fecha es obligatoria.';    alerta.classList.add('visible'); return; }
  if (!glosa)   { alerta.textContent = 'La glosa es obligatoria.';    alerta.classList.add('visible'); return; }
  const lineas = _leerLineas();
  if (!lineas.length) { alerta.textContent = 'Agrega al menos una línea con código de cuenta.'; alerta.classList.add('visible'); return; }
  const totalDebe  = lineas.reduce((s, l) => s + l.debe,  0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  if (Math.abs(totalDebe - totalHaber) > 0.005) {
    alerta.textContent = `El asiento no cuadra: Debe ${formatearMoneda(totalDebe)} ≠ Haber ${formatearMoneda(totalHaber)}`;
    alerta.classList.add('visible'); return;
  }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('asi-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    periodo,
    fecha,
    numero_asiento: document.getElementById('asi-numero-f').value.trim() || null,
    glosa,
    tipo:           document.getElementById('asi-tipo-modal').value,
    total_debe:     totalDebe,
    total_haber:    totalHaber,
    usuario_id:     perfil_usuario?.id || null,
  };
  let asientoId = id;
  if (id) {
    const { error } = await _supabase.from('asientos').update(payload).eq('id', id);
    if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    await _supabase.from('asiento_detalle').delete().eq('asiento_id', id);
  } else {
    const { data, error } = await _supabase.from('asientos').insert(payload).select('id').single();
    if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    asientoId = data.id;
  }
  const lineasConId = lineas.map(l => ({ ...l, asiento_id: asientoId }));
  const { error: errDetalle } = await _supabase.from('asiento_detalle').insert(lineasConId);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (errDetalle) { alerta.textContent = 'Error en detalle: ' + errDetalle.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Asiento actualizado' : 'Asiento creado', 'exito');
  cerrarModalAsiento();
  await cargarAsientos();
}

async function validarAsiento(id) {
  if (!await confirmar('¿Validar este asiento? Ya no podrá editarse.', { btnOk: 'Validar', btnColor: 'var(--color-primario)' })) return;
  const { error } = await _supabase.from('asientos').update({ estado: 'VALIDADO' }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Asiento validado', 'exito');
  await cargarAsientos();
}

async function anularAsiento(id) {
  if (!await confirmar('¿Anular este asiento?', { btnOk: 'Anular', btnColor: '#e53e3e' })) return;
  const { error } = await _supabase.from('asientos').update({ estado: 'ANULADO' }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Asiento anulado', 'exito');
  await cargarAsientos();
}

async function eliminarAsiento(id) {
  if (!await confirmar('¿Eliminar este asiento? Se eliminarán también sus líneas.', { btnOk: 'Eliminar' })) return;
  const { error } = await _supabase.from('asientos').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Asiento eliminado', 'exito');
  await cargarAsientos();
}

async function exportarAsientosExcel() {
  if (!asientos_filtrada.length) { mostrarToast('No hay asientos para exportar', 'atencion'); return; }
  const ids = asientos_filtrada.map(a => a.id);
  const { data: detalles } = await _supabase
    .from('asiento_detalle')
    .select('*')
    .in('asiento_id', ids)
    .order('asiento_id')
    .order('orden');
  const detallesMap = {};
  (detalles || []).forEach(d => {
    if (!detallesMap[d.asiento_id]) detallesMap[d.asiento_id] = [];
    detallesMap[d.asiento_id].push(d);
  });
  const rows = [];
  asientos_filtrada.forEach(a => {
    const lineas = detallesMap[a.id] || [];
    if (!lineas.length) {
      rows.push({ Número: a.numero_asiento||'', Periodo: a.periodo, Fecha: a.fecha, Glosa: a.glosa, Tipo: a.tipo, Estado: a.estado, 'Total Debe': a.total_debe, 'Total Haber': a.total_haber, Cuenta: '', 'Nombre Cuenta': '', Descripción: '', Debe: '', Haber: '' });
    } else {
      lineas.forEach((l, i) => {
        rows.push({
          Número: i === 0 ? (a.numero_asiento||'') : '', Periodo: i === 0 ? a.periodo : '', Fecha: i === 0 ? a.fecha : '', Glosa: i === 0 ? a.glosa : '', Tipo: i === 0 ? a.tipo : '', Estado: i === 0 ? a.estado : '',
          'Total Debe': i === 0 ? a.total_debe : '', 'Total Haber': i === 0 ? a.total_haber : '',
          Cuenta: l.cuenta_codigo, 'Nombre Cuenta': l.cuenta_nombre||'', Descripción: l.descripcion||'', Debe: l.debe, Haber: l.haber,
        });
      });
    }
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asientos');
  XLSX.writeFile(wb, `asientos_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
