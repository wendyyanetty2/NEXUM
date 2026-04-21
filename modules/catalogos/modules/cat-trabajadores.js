// ═══════════════════════════════════════════════════════════════
// Catálogos — Trabajadores
// ═══════════════════════════════════════════════════════════════

let trabajadores_lista = [];
let trabajadores_pag   = 1;
const TRAB_POR_PAG     = 15;

async function renderTabTrabajadores(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="trab-buscar" type="text" class="input-buscar" placeholder="Buscar nombre o DNI…"
                 oninput="filtrarTrabajadores()" style="max-width:240px">
          <select id="trab-contrato" onchange="filtrarTrabajadores()" class="input-buscar" style="max-width:180px">
            <option value="">Todos los contratos</option>
            <option value="PLANILLA">Planilla</option>
            <option value="RECIBO_HONORARIOS">Recibo honorarios</option>
            <option value="CAS">CAS</option>
            <option value="OTRO">Otro</option>
          </select>
          <select id="trab-activo" onchange="filtrarTrabajadores()" class="input-buscar" style="max-width:130px">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Cesados</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarTrabajadoresExcel()">⬇ Excel</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalTrabajador(null)">+ Nuevo</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>DNI</th><th>Nombre completo</th><th>Cargo</th><th>Área</th>
            <th>Contrato</th><th>Sueldo base</th><th>AFP</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-trabajadores"></tbody>
        </table>
      </div>
      <div id="pag-trabajadores" class="paginacion"></div>
    </div>

    <!-- Modal trabajador -->
    <div class="modal-overlay" id="modal-trabajador" style="display:none">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3 id="modal-trab-titulo">Nuevo trabajador</h3>
          <button class="modal-cerrar" onclick="cerrarModalTrabajador()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-trab" class="alerta-error"></div>
          <input type="hidden" id="trab-id">

          <p class="text-muted text-sm mb-12" style="margin-bottom:12px">📋 Datos personales</p>
          <div class="grid-2">
            <div class="campo">
              <label>DNI <span class="req">*</span></label>
              <input type="text" id="trab-dni" maxlength="8" placeholder="8 dígitos">
            </div>
            <div class="campo">
              <label>Nombres <span class="req">*</span></label>
              <input type="text" id="trab-nombre" placeholder="Nombres">
            </div>
            <div class="campo">
              <label>Apellido paterno</label>
              <input type="text" id="trab-ap-pat" placeholder="Apellido paterno">
            </div>
            <div class="campo">
              <label>Apellido materno</label>
              <input type="text" id="trab-ap-mat" placeholder="Apellido materno">
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:12px 0 12px">🏢 Datos laborales</p>
          <div class="grid-2">
            <div class="campo">
              <label>Cargo</label>
              <input type="text" id="trab-cargo" placeholder="Cargo o puesto">
            </div>
            <div class="campo">
              <label>Área</label>
              <input type="text" id="trab-area" placeholder="Área o departamento">
            </div>
            <div class="campo">
              <label>Fecha de ingreso</label>
              <input type="date" id="trab-ingreso">
            </div>
            <div class="campo">
              <label>Tipo de contrato</label>
              <select id="trab-contratof">
                <option value="PLANILLA">Planilla</option>
                <option value="RECIBO_HONORARIOS">Recibo de honorarios</option>
                <option value="CAS">CAS</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div class="campo">
              <label>Sueldo base (S/.)</label>
              <input type="number" id="trab-sueldo" min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="trab-activof">
                <option value="true">Activo</option>
                <option value="false">Cesado</option>
              </select>
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:12px 0 12px">🏦 Datos bancarios y AFP</p>
          <div class="grid-2">
            <div class="campo">
              <label>Banco</label>
              <select id="trab-banco"></select>
            </div>
            <div class="campo">
              <label>Número de cuenta</label>
              <input type="text" id="trab-cuenta" placeholder="Nro de cuenta">
            </div>
            <div class="campo">
              <label>CCI</label>
              <input type="text" id="trab-cci" placeholder="20 dígitos">
            </div>
            <div class="campo">
              <label>AFP</label>
              <select id="trab-afp">
                <option value="">— ONP —</option>
                <option value="PRIMA">Prima AFP</option>
                <option value="INTEGRA">AFP Integra</option>
                <option value="PROFUTURO">Profuturo</option>
                <option value="HABITAT">AFP Habitat</option>
              </select>
            </div>
            <div class="campo">
              <label>CUSPP</label>
              <input type="text" id="trab-cuspp" placeholder="Código CUSPP (AFP)">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalTrabajador()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarTrabajador()" id="btn-guardar-trab">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarTrabajadores();
  await _cargarBancosTrab();
}

let trabajadores_filtrada = [];

async function cargarTrabajadores() {
  const { data } = await _supabase
    .from('trabajadores')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('apellido_paterno');
  trabajadores_lista = data || [];
  filtrarTrabajadores();
}

function filtrarTrabajadores() {
  const q        = (document.getElementById('trab-buscar')?.value || '').toLowerCase();
  const contrato = document.getElementById('trab-contrato')?.value || '';
  const activo   = document.getElementById('trab-activo')?.value || '';

  trabajadores_filtrada = trabajadores_lista.filter(t => {
    const nombre = `${t.nombre} ${t.apellido_paterno || ''} ${t.apellido_materno || ''}`.toLowerCase();
    const matchQ = !q || nombre.includes(q) || (t.dni || '').includes(q);
    const matchC = !contrato || t.tipo_contrato === contrato;
    const matchA = activo === '' || String(t.activo) === activo;
    return matchQ && matchC && matchA;
  });
  trabajadores_pag = 1;
  renderTablaTrabajadores();
}

function renderTablaTrabajadores() {
  const inicio = (trabajadores_pag - 1) * TRAB_POR_PAG;
  const pagina = trabajadores_filtrada.slice(inicio, inicio + TRAB_POR_PAG);
  const tbody  = document.getElementById('tbody-trabajadores');
  if (!tbody) return;
  tbody.innerHTML = pagina.length ? pagina.map(t => `
    <tr>
      <td>${escapar(t.dni || '—')}</td>
      <td>${escapar([t.apellido_paterno, t.apellido_materno, t.nombre].filter(Boolean).join(' '))}</td>
      <td>${escapar(t.cargo || '—')}</td>
      <td>${escapar(t.area || '—')}</td>
      <td><span class="badge badge-info" style="font-size:11px">${(t.tipo_contrato || '').replace('_', ' ')}</span></td>
      <td>${t.sueldo_base ? formatearMoneda(t.sueldo_base) : '—'}</td>
      <td>${escapar(t.afp || 'ONP')}</td>
      <td><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activo' : 'Cesado'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalTrabajador('${t.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarTrabajador('${t.id}','${escapar(t.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="9" class="text-center text-muted">Sin resultados</td></tr>';

  const total = trabajadores_filtrada.length;
  const pags  = Math.ceil(total / TRAB_POR_PAG);
  const pagEl = document.getElementById('pag-trabajadores');
  if (pagEl) pagEl.innerHTML = total > TRAB_POR_PAG ? `
    <span class="pag-info">${inicio + 1}–${Math.min(inicio + TRAB_POR_PAG, total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagTrab(-1)" ${trabajadores_pag <= 1 ? 'disabled' : ''}>‹</button>
    <span>${trabajadores_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagTrab(1)"  ${trabajadores_pag >= pags ? 'disabled' : ''}>›</button>` : '';
}

function cambiarPagTrab(dir) { trabajadores_pag += dir; renderTablaTrabajadores(); }

async function _cargarBancosTrab() {
  const { data } = await _supabase
    .from('catalogo_bancos')
    .select('codigo, nombre')
    .eq('activo', true)
    .order('nombre');
  const sel = document.getElementById('trab-banco');
  if (!sel || !data) return;
  sel.innerHTML = '<option value="">— Sin banco —</option>' +
    data.map(b => `<option value="${b.codigo}">${escapar(b.nombre)}</option>`).join('');
}

function abrirModalTrabajador(id) {
  document.getElementById('alerta-trab').classList.remove('visible');
  const campos = ['trab-id','trab-dni','trab-nombre','trab-ap-pat','trab-ap-mat',
    'trab-cargo','trab-area','trab-ingreso','trab-sueldo','trab-cuenta','trab-cci','trab-cuspp'];
  if (id) {
    const t = trabajadores_lista.find(x => x.id === id);
    document.getElementById('modal-trab-titulo').textContent = 'Editar trabajador';
    document.getElementById('trab-id').value       = t.id;
    document.getElementById('trab-dni').value      = t.dni || '';
    document.getElementById('trab-nombre').value   = t.nombre || '';
    document.getElementById('trab-ap-pat').value   = t.apellido_paterno || '';
    document.getElementById('trab-ap-mat').value   = t.apellido_materno || '';
    document.getElementById('trab-cargo').value    = t.cargo || '';
    document.getElementById('trab-area').value     = t.area || '';
    document.getElementById('trab-ingreso').value  = t.fecha_ingreso || '';
    document.getElementById('trab-sueldo').value   = t.sueldo_base || '';
    document.getElementById('trab-cuenta').value   = t.numero_cuenta || '';
    document.getElementById('trab-cci').value      = t.cci || '';
    document.getElementById('trab-cuspp').value    = t.cuspp || '';
    document.getElementById('trab-contratof').value = t.tipo_contrato || 'PLANILLA';
    document.getElementById('trab-activof').value  = String(t.activo);
    setTimeout(() => {
      const b = document.getElementById('trab-banco'); if (b) b.value = t.banco_codigo || '';
      const a = document.getElementById('trab-afp');   if (a) a.value = t.afp || '';
    }, 50);
  } else {
    document.getElementById('modal-trab-titulo').textContent = 'Nuevo trabajador';
    campos.forEach(i => document.getElementById(i).value = '');
    document.getElementById('trab-contratof').value = 'PLANILLA';
    document.getElementById('trab-activof').value   = 'true';
  }
  document.getElementById('modal-trabajador').style.display = 'flex';
}
function cerrarModalTrabajador() { document.getElementById('modal-trabajador').style.display = 'none'; }

async function guardarTrabajador() {
  const dni    = document.getElementById('trab-dni').value.trim();
  const nombre = document.getElementById('trab-nombre').value.trim();
  const alerta = document.getElementById('alerta-trab');
  const btn    = document.getElementById('btn-guardar-trab');
  alerta.classList.remove('visible');
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  if (dni && !validarDNI(dni)) { alerta.textContent = 'DNI debe tener 8 dígitos.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('trab-id').value;
  const sueldo = parseFloat(document.getElementById('trab-sueldo').value) || null;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    dni:              dni || null,
    nombre,
    apellido_paterno: document.getElementById('trab-ap-pat').value.trim() || null,
    apellido_materno: document.getElementById('trab-ap-mat').value.trim() || null,
    cargo:            document.getElementById('trab-cargo').value.trim() || null,
    area:             document.getElementById('trab-area').value.trim() || null,
    fecha_ingreso:    document.getElementById('trab-ingreso').value || null,
    sueldo_base:      sueldo,
    tipo_contrato:    document.getElementById('trab-contratof').value,
    banco_codigo:     document.getElementById('trab-banco').value || null,
    numero_cuenta:    document.getElementById('trab-cuenta').value.trim() || null,
    cci:              document.getElementById('trab-cci').value.trim() || null,
    afp:              document.getElementById('trab-afp').value || null,
    cuspp:            document.getElementById('trab-cuspp').value.trim() || null,
    activo:           document.getElementById('trab-activof').value === 'true',
  };
  const { error } = id
    ? await _supabase.from('trabajadores').update(payload).eq('id', id)
    : await _supabase.from('trabajadores').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Trabajador actualizado' : 'Trabajador creado', 'exito');
  cerrarModalTrabajador();
  await cargarTrabajadores();
}

async function eliminarTrabajador(id, nombre) {
  if (!await confirmar(`¿Eliminar trabajador "${nombre}"?`)) return;
  const { error } = await _supabase.from('trabajadores').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarTrabajadores();
}

function exportarTrabajadoresExcel() {
  if (!trabajadores_lista.length) { mostrarToast('No hay datos', 'atencion'); return; }
  const rows = trabajadores_lista.map(t => ({
    DNI: t.dni || '', Nombre: t.nombre || '',
    'Ap. Paterno': t.apellido_paterno || '', 'Ap. Materno': t.apellido_materno || '',
    Cargo: t.cargo || '', Área: t.area || '',
    'F. Ingreso': t.fecha_ingreso || '', Contrato: t.tipo_contrato || '',
    'Sueldo Base': t.sueldo_base || 0, AFP: t.afp || 'ONP',
    Banco: t.banco_codigo || '', Cuenta: t.numero_cuenta || '', CCI: t.cci || '',
    Estado: t.activo ? 'Activo' : 'Cesado',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
  XLSX.writeFile(wb, `trabajadores_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
