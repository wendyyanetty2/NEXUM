// ═══════════════════════════════════════════════════════════════
// Tributaria — Registro de ventas
// ═══════════════════════════════════════════════════════════════

let ventas_lista    = [];
let ventas_filtrada = [];
let ventas_pag      = 1;
const VENTAS_POR_PAG = 20;
let ventas_clientes  = [];
let ventas_tipos_doc = [];

async function renderTabVentas(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Resumen del periodo -->
      <div class="grid-3" id="ventas-resumen" style="margin-bottom:20px;gap:12px"></div>

      <!-- Filtros -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Periodo (YYYY-MM)</label>
            <input type="month" id="v-periodo" onchange="filtrarVentas()" class="input-buscar w-full"
                   value="${new Date().toISOString().slice(0,7)}">
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="v-estado-f" onchange="filtrarVentas()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="EMITIDO">Emitido</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="v-buscar" oninput="filtrarVentas()" class="input-buscar w-full"
                   placeholder="RUC, cliente, número…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="v-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secundario btn-sm" onclick="exportarVentasExcel()">⬇ Excel</button>
            <button class="btn btn-secundario btn-sm" onclick="importarRegistroVentasSUNAT()">📊 Importar SUNAT</button>
            <button class="btn btn-sm" onclick="eliminarMesVentas()"
              style="background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:var(--radio);padding:6px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
              🗑️ Eliminar mes
            </button>
            <button class="btn btn-primario btn-sm" onclick="abrirModalVenta(null)">+ Nueva venta</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Fecha</th><th>Tipo Doc.</th><th>Serie-Número</th>
            <th>Cliente</th><th>RUC</th><th>Base Imponible</th>
            <th>IGV</th><th>Total</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-ventas"></tbody>
          <tfoot id="tfoot-ventas"></tfoot>
        </table>
      </div>
      <div id="pag-ventas" class="paginacion"></div>
    </div>

    <!-- Modal venta -->
    <div class="modal-overlay" id="modal-venta" style="display:none">
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <h3 id="modal-v-titulo">Nueva venta</h3>
          <button class="modal-cerrar" onclick="cerrarModalVenta()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-v" class="alerta-error"></div>
          <input type="hidden" id="v-id">
          <div class="grid-2">
            <div class="campo">
              <label>Periodo <span class="req">*</span></label>
              <input type="month" id="v-periodo-f">
            </div>
            <div class="campo">
              <label>Fecha de emisión <span class="req">*</span></label>
              <input type="date" id="v-fecha-f">
            </div>
            <div class="campo">
              <label>Tipo de documento <span class="req">*</span></label>
              <select id="v-tipo-doc-f"></select>
            </div>
            <div class="campo" style="display:flex;gap:8px">
              <div style="flex:1">
                <label>Serie <span class="req">*</span></label>
                <input type="text" id="v-serie" placeholder="F001" maxlength="4">
              </div>
              <div style="flex:2">
                <label>Número <span class="req">*</span></label>
                <input type="text" id="v-numero" placeholder="00000001">
              </div>
            </div>
            <div class="campo">
              <label>Cliente</label>
              <select id="v-cliente-f"></select>
            </div>
            <div class="campo">
              <label>RUC / DNI cliente</label>
              <input type="text" id="v-ruc-cli" placeholder="RUC o DNI">
            </div>
            <div class="campo col-2">
              <label>Nombre del cliente</label>
              <input type="text" id="v-nombre-cli" placeholder="Razón social o nombre">
            </div>
            <div class="campo">
              <label>Base imponible (S/.)</label>
              <input type="number" id="v-base" min="0" step="0.01" oninput="calcularTotalesVenta()" placeholder="0.00">
            </div>
            <div class="campo">
              <label>IGV (18%) — S/.</label>
              <input type="number" id="v-igv" min="0" step="0.01" placeholder="0.00" readonly
                     style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Total <span class="req">*</span></label>
              <input type="number" id="v-total" min="0" step="0.01" oninput="calcularBaseDesdeTotal()" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="v-moneda-f">
                <option value="PEN">PEN — Soles</option>
                <option value="USD">USD — Dólares</option>
                <option value="EUR">EUR — Euros</option>
              </select>
            </div>
            <div class="campo">
              <label>Tipo de cambio</label>
              <input type="number" id="v-tc" value="1" min="0" step="0.0001">
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="v-estado-modal">
                <option value="EMITIDO">Emitido</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Observaciones</label>
              <input type="text" id="v-obs" placeholder="Observaciones opcionales">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalVenta()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarVenta()" id="btn-guardar-v">Guardar</button>
        </div>
      </div>
    </div>`;

  await Promise.all([cargarVentas(), cargarCatalogosVentas()]);
}

async function cargarVentas() {
  const { data } = await _supabase
    .from('registro_ventas')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false })
    .limit(1000);
  ventas_lista = data || [];
  filtrarVentas();
}

async function cargarCatalogosVentas() {
  const [resClientes, resTiposDoc] = await Promise.all([
    _supabase.from('empresas_clientes').select('id,nombre,ruc_dni').eq('empresa_operadora_id', empresa_activa.id).eq('activo', true).order('nombre'),
    _supabase.from('catalogo_tipos_documento').select('codigo,nombre').eq('activo', true).order('nombre'),
  ]);
  ventas_clientes  = resClientes.data || [];
  ventas_tipos_doc = resTiposDoc.data || [];
}

function filtrarVentas() {
  const periodo = document.getElementById('v-periodo')?.value || '';
  const estado  = document.getElementById('v-estado-f')?.value || '';
  const q       = (document.getElementById('v-buscar')?.value || '').toLowerCase();

  ventas_filtrada = ventas_lista.filter(v =>
    (!periodo || v.periodo === periodo) &&
    (!estado  || v.estado === estado) &&
    (!q || (v.nombre_cliente||'').toLowerCase().includes(q) ||
           (v.ruc_cliente||'').includes(q) ||
           (v.numero||'').includes(q) ||
           (v.serie||'').includes(q))
  );

  const ctr = document.getElementById('v-contador');
  if (ctr) ctr.textContent = `${ventas_filtrada.length} registro(s)`;
  ventas_pag = 1;
  _renderResumenVentas();
  renderTablaVentas();
}

function _renderResumenVentas() {
  const activas  = ventas_filtrada.filter(v => v.estado !== 'ANULADO');
  const base     = activas.reduce((s, v) => s + parseFloat(v.base_imponible || 0), 0);
  const igv      = activas.reduce((s, v) => s + parseFloat(v.igv || 0), 0);
  const total    = activas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
  const grid = document.getElementById('ventas-resumen');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono azul">📋</div>
      <div class="stat-info"><div class="numero">${activas.length}</div><div class="etiqueta">Comprobantes emitidos</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">💰</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(base)}</div><div class="etiqueta">Base imponible</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono amarillo">🧾</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(igv)}</div><div class="etiqueta">IGV total</div></div>
    </div>`;
}

function renderTablaVentas() {
  const inicio = (ventas_pag - 1) * VENTAS_POR_PAG;
  const pagina = ventas_filtrada.slice(inicio, inicio + VENTAS_POR_PAG);
  const tbody  = document.getElementById('tbody-ventas');
  if (!tbody) return;

  const colores = { EMITIDO: 'badge-activo', BORRADOR: 'badge-warning', ANULADO: 'badge-inactivo' };
  tbody.innerHTML = pagina.length ? pagina.map(v => `
    <tr ${v.estado === 'ANULADO' ? 'style="opacity:0.55"' : ''}>
      <td>${formatearFecha(v.fecha_emision)}</td>
      <td class="text-sm">${escapar(v.tipo_documento_codigo || '—')}</td>
      <td class="text-mono">${escapar((v.serie || '') + '-' + (v.numero || ''))}</td>
      <td class="text-sm">${escapar((v.nombre_cliente || '—').slice(0,30))}</td>
      <td class="text-mono text-sm">${escapar(v.ruc_cliente || '—')}</td>
      <td class="text-right">${formatearMoneda(v.base_imponible || 0)}</td>
      <td class="text-right">${formatearMoneda(v.igv || 0)}</td>
      <td class="text-right font-medium">${formatearMoneda(v.total || 0)}</td>
      <td><span class="badge ${colores[v.estado] || 'badge-info'}" style="font-size:11px">${v.estado}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalVenta('${v.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="anularVenta('${v.id}')">🚫</button>
        <button class="btn-icono peligro" onclick="eliminarVenta('${v.id}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="10" class="text-center text-muted">Sin registros de ventas</td></tr>';

  // Totales al pie
  const activas  = ventas_filtrada.filter(v => v.estado !== 'ANULADO');
  const sumBase  = activas.reduce((s, v) => s + parseFloat(v.base_imponible || 0), 0);
  const sumIgv   = activas.reduce((s, v) => s + parseFloat(v.igv || 0), 0);
  const sumTotal = activas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
  const tfoot = document.getElementById('tfoot-ventas');
  if (tfoot && ventas_filtrada.length) {
    tfoot.innerHTML = `<tr style="font-weight:600;background:var(--color-bg-alt,#f7fafc)">
      <td colspan="5" class="text-right">TOTALES (${activas.length} comprobantes)</td>
      <td class="text-right">${formatearMoneda(sumBase)}</td>
      <td class="text-right">${formatearMoneda(sumIgv)}</td>
      <td class="text-right">${formatearMoneda(sumTotal)}</td>
      <td colspan="2"></td>
    </tr>`;
  }

  const total = ventas_filtrada.length;
  const pags  = Math.ceil(total / VENTAS_POR_PAG);
  const pagEl = document.getElementById('pag-ventas');
  if (pagEl) pagEl.innerHTML = total > VENTAS_POR_PAG ? `
    <span class="pag-info">${inicio+1}–${Math.min(inicio+VENTAS_POR_PAG,total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagVentas(-1)" ${ventas_pag<=1?'disabled':''}>‹</button>
    <span>${ventas_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagVentas(1)"  ${ventas_pag>=pags?'disabled':''}>›</button>` : '';
}

function cambiarPagVentas(dir) { ventas_pag += dir; renderTablaVentas(); }

function calcularTotalesVenta() {
  const base = parseFloat(document.getElementById('v-base')?.value) || 0;
  const igv  = base * 0.18;
  const total = base + igv;
  const igvEl  = document.getElementById('v-igv');
  const totEl  = document.getElementById('v-total');
  if (igvEl)  igvEl.value  = igv.toFixed(2);
  if (totEl)  totEl.value  = total.toFixed(2);
}

function calcularBaseDesdeTotal() {
  const total = parseFloat(document.getElementById('v-total')?.value) || 0;
  const base  = total / 1.18;
  const igv   = total - base;
  const baseEl = document.getElementById('v-base');
  const igvEl  = document.getElementById('v-igv');
  if (baseEl) baseEl.value = base.toFixed(2);
  if (igvEl)  igvEl.value  = igv.toFixed(2);
}

function _poblarSelectsVenta(venta) {
  const selCli = document.getElementById('v-cliente-f');
  if (selCli) {
    selCli.innerHTML = '<option value="">— Sin cliente —</option>' +
      ventas_clientes.map(c => `<option value="${c.id}" data-ruc="${c.ruc_dni||''}" data-nombre="${escapar(c.nombre)}">${escapar(c.nombre)}</option>`).join('');
    selCli.onchange = () => {
      const opt = selCli.options[selCli.selectedIndex];
      document.getElementById('v-ruc-cli').value    = opt.dataset.ruc || '';
      document.getElementById('v-nombre-cli').value = opt.dataset.nombre || '';
    };
    if (venta?.cliente_id) selCli.value = venta.cliente_id;
  }
  const selDoc = document.getElementById('v-tipo-doc-f');
  if (selDoc) {
    selDoc.innerHTML = '<option value="">— Seleccionar —</option>' +
      ventas_tipos_doc.map(t => `<option value="${t.codigo}">${t.codigo} — ${escapar(t.nombre)}</option>`).join('');
    if (venta?.tipo_documento_codigo) selDoc.value = venta.tipo_documento_codigo;
  }
}

function abrirModalVenta(id) {
  document.getElementById('alerta-v').classList.remove('visible');
  const hoy = new Date().toISOString().slice(0, 10);
  const periodoActual = document.getElementById('v-periodo')?.value || new Date().toISOString().slice(0,7);
  if (id) {
    const v = ventas_lista.find(x => x.id === id);
    if (!v) return;
    document.getElementById('modal-v-titulo').textContent = 'Editar venta';
    document.getElementById('v-id').value            = v.id;
    document.getElementById('v-periodo-f').value     = v.periodo;
    document.getElementById('v-fecha-f').value       = v.fecha_emision;
    document.getElementById('v-serie').value         = v.serie || '';
    document.getElementById('v-numero').value        = v.numero || '';
    document.getElementById('v-ruc-cli').value       = v.ruc_cliente || '';
    document.getElementById('v-nombre-cli').value    = v.nombre_cliente || '';
    document.getElementById('v-base').value          = v.base_imponible || '';
    document.getElementById('v-igv').value           = v.igv || '';
    document.getElementById('v-total').value         = v.total || '';
    document.getElementById('v-moneda-f').value      = v.moneda || 'PEN';
    document.getElementById('v-tc').value            = v.tipo_cambio || '1';
    document.getElementById('v-estado-modal').value  = v.estado;
    document.getElementById('v-obs').value           = v.observaciones || '';
    _poblarSelectsVenta(v);
  } else {
    document.getElementById('modal-v-titulo').textContent = 'Nueva venta';
    document.getElementById('v-id').value         = '';
    document.getElementById('v-periodo-f').value  = periodoActual;
    document.getElementById('v-fecha-f').value    = hoy;
    document.getElementById('v-serie').value      = 'F001';
    ['v-numero','v-ruc-cli','v-nombre-cli','v-base','v-igv','v-total','v-obs'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('v-moneda-f').value     = 'PEN';
    document.getElementById('v-tc').value           = '1';
    document.getElementById('v-estado-modal').value = 'EMITIDO';
    _poblarSelectsVenta(null);
  }
  document.getElementById('modal-venta').style.display = 'flex';
}
function cerrarModalVenta() { document.getElementById('modal-venta').style.display = 'none'; }

async function guardarVenta() {
  const periodo = document.getElementById('v-periodo-f').value;
  const fecha   = document.getElementById('v-fecha-f').value;
  const total   = parseFloat(document.getElementById('v-total').value);
  const alerta  = document.getElementById('alerta-v');
  const btn     = document.getElementById('btn-guardar-v');
  alerta.classList.remove('visible');
  if (!periodo) { alerta.textContent = 'El periodo es obligatorio.';     alerta.classList.add('visible'); return; }
  if (!fecha)   { alerta.textContent = 'La fecha es obligatoria.';       alerta.classList.add('visible'); return; }
  if (!total)   { alerta.textContent = 'El total debe ser mayor a cero.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('v-id').value;
  const payload = {
    empresa_operadora_id:   empresa_activa.id,
    periodo,
    fecha_emision:          fecha,
    tipo_documento_codigo:  document.getElementById('v-tipo-doc-f').value || null,
    serie:                  document.getElementById('v-serie').value.trim() || null,
    numero:                 document.getElementById('v-numero').value.trim() || null,
    cliente_id:             document.getElementById('v-cliente-f').value || null,
    ruc_cliente:            document.getElementById('v-ruc-cli').value.trim() || null,
    nombre_cliente:         document.getElementById('v-nombre-cli').value.trim() || null,
    base_imponible:         parseFloat(document.getElementById('v-base').value) || 0,
    igv:                    parseFloat(document.getElementById('v-igv').value) || 0,
    total,
    moneda:                 document.getElementById('v-moneda-f').value,
    tipo_cambio:            parseFloat(document.getElementById('v-tc').value) || 1,
    estado:                 document.getElementById('v-estado-modal').value,
    observaciones:          document.getElementById('v-obs').value.trim() || null,
    usuario_id:             perfil_usuario?.id || null,
  };
  const { error } = id
    ? await _supabase.from('registro_ventas').update(payload).eq('id', id)
    : await _supabase.from('registro_ventas').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Venta actualizada' : 'Venta registrada', 'exito');
  cerrarModalVenta();
  await cargarVentas();
}

async function anularVenta(id) {
  if (!await confirmar('¿Anular este comprobante? El registro se mantendrá como ANULADO.', { btnOk: 'Anular', btnColor: '#D69E2E' })) return;
  const { error } = await _supabase.from('registro_ventas').update({ estado: 'ANULADO' }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Comprobante anulado', 'exito');
  await cargarVentas();
}

async function eliminarVenta(id) {
  if (!await confirmar('¿Eliminar este registro permanentemente?', { btnOk: 'Eliminar' })) return;
  const { error } = await _supabase.from('registro_ventas').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarVentas();
}

function exportarVentasExcel() {
  if (!ventas_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = ventas_filtrada.map(v => ({
    Periodo:        v.periodo,
    'F. Emisión':   v.fecha_emision,
    'Tipo Doc.':    v.tipo_documento_codigo || '',
    Serie:          v.serie || '',
    Número:         v.numero || '',
    'RUC Cliente':  v.ruc_cliente || '',
    Cliente:        v.nombre_cliente || '',
    'Base Imponible': v.base_imponible || 0,
    IGV:            v.igv || 0,
    Total:          v.total || 0,
    Moneda:         v.moneda,
    'Tipo Cambio':  v.tipo_cambio || 1,
    Estado:         v.estado,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RegistroVentas');
  XLSX.writeFile(wb, `registro_ventas_${empresa_activa.nombre}_${new Date().toISOString().slice(0,7)}.xlsx`);
}

async function eliminarMesVentas() {
  const periodo = document.getElementById('v-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo primero', 'atencion'); return; }
  const ok1 = await confirmar(
    `¿Eliminar TODOS los registros de ventas de ${periodo}?\nEsta acción no se puede deshacer.`,
    { btnOk: 'Sí, eliminar mes', btnColor: '#C53030' }
  );
  if (!ok1) return;
  const ok2 = await confirmar(
    `CONFIRMACIÓN FINAL: ¿Borrar ventas ${periodo} permanentemente?`,
    { btnOk: 'Confirmar', btnColor: '#C53030' }
  );
  if (!ok2) return;
  const { error } = await _supabase
    .from('registro_ventas')
    .delete()
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('periodo', periodo);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Registro de ventas ${periodo} eliminado. Puedes volver a subir el archivo.`, 'exito');
  await cargarVentas();
}
