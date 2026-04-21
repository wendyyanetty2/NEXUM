// ═══════════════════════════════════════════════════════════════
// Tributaria — Registro de compras
// ═══════════════════════════════════════════════════════════════

let compras_lista    = [];
let compras_filtrada = [];
let compras_pag      = 1;
const COMPRAS_POR_PAG = 20;
let compras_proveedores = [];
let compras_tipos_doc   = [];

async function renderTabCompras(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="grid-3" id="compras-resumen" style="margin-bottom:20px;gap:12px"></div>

      <div class="card" style="padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:10px">
          <div>
            <label class="label-filtro">Periodo (YYYY-MM)</label>
            <input type="month" id="c-periodo" onchange="filtrarCompras()" class="input-buscar w-full"
                   value="${new Date().toISOString().slice(0,7)}">
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="c-estado-f" onchange="filtrarCompras()" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="EMITIDO">Emitido</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
          <div>
            <label class="label-filtro">Buscar</label>
            <input type="text" id="c-buscar" oninput="filtrarCompras()" class="input-buscar w-full"
                   placeholder="RUC, proveedor, número…">
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span id="c-contador" class="text-muted text-sm"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm" onclick="exportarComprasExcel()">⬇ Excel</button>
            <button class="btn btn-primario btn-sm"   onclick="abrirModalCompra(null)">+ Nueva compra</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>F. Emisión</th><th>F. Vencimiento</th><th>Tipo Doc.</th><th>Serie-Número</th>
            <th>Proveedor</th><th>RUC</th><th>Base</th><th>IGV</th>
            <th>Total</th><th>Detracción</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-compras"></tbody>
          <tfoot id="tfoot-compras"></tfoot>
        </table>
      </div>
      <div id="pag-compras" class="paginacion"></div>
    </div>

    <!-- Modal compra -->
    <div class="modal-overlay" id="modal-compra" style="display:none">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3 id="modal-c-titulo">Nueva compra</h3>
          <button class="modal-cerrar" onclick="cerrarModalCompra()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-c" class="alerta-error"></div>
          <input type="hidden" id="c-id">
          <div class="grid-2">
            <div class="campo">
              <label>Periodo <span class="req">*</span></label>
              <input type="month" id="c-periodo-f">
            </div>
            <div class="campo">
              <label>Fecha de emisión <span class="req">*</span></label>
              <input type="date" id="c-fecha-f">
            </div>
            <div class="campo">
              <label>Fecha de vencimiento</label>
              <input type="date" id="c-vto-f">
            </div>
            <div class="campo">
              <label>Tipo de documento <span class="req">*</span></label>
              <select id="c-tipo-doc-f"></select>
            </div>
            <div class="campo" style="display:flex;gap:8px">
              <div style="flex:1">
                <label>Serie</label>
                <input type="text" id="c-serie" placeholder="F001" maxlength="4">
              </div>
              <div style="flex:2">
                <label>Número</label>
                <input type="text" id="c-numero" placeholder="00000001">
              </div>
            </div>
            <div class="campo">
              <label>Proveedor</label>
              <select id="c-proveedor-f"></select>
            </div>
            <div class="campo">
              <label>RUC proveedor</label>
              <input type="text" id="c-ruc-prov" placeholder="RUC (11 dígitos)">
            </div>
            <div class="campo col-2">
              <label>Nombre del proveedor</label>
              <input type="text" id="c-nombre-prov" placeholder="Razón social">
            </div>
            <div class="campo">
              <label>Base imponible (S/.)</label>
              <input type="number" id="c-base" min="0" step="0.01" oninput="calcularTotalesCompra()" placeholder="0.00">
            </div>
            <div class="campo">
              <label>IGV (18%)</label>
              <input type="number" id="c-igv" min="0" step="0.01" placeholder="0.00" readonly
                     style="background:var(--color-bg-alt,#f7fafc)">
            </div>
            <div class="campo">
              <label>Total <span class="req">*</span></label>
              <input type="number" id="c-total" min="0" step="0.01" oninput="calcularBaseDesdeCompra()" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="c-moneda-f">
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div class="campo">
              <label>Tipo de cambio</label>
              <input type="number" id="c-tc" value="1" min="0" step="0.0001">
            </div>
          </div>

          <p class="text-muted text-sm" style="margin:12px 0 12px">💰 Detracción</p>
          <div class="grid-2">
            <div class="campo" style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="c-tiene-detrac" onchange="toggleDetraccionC()" style="width:auto">
              <label style="margin:0">Sujeto a detracción</label>
            </div>
            <div id="c-detrac-campos" style="display:none;grid-column:span 2">
              <div class="grid-2">
                <div class="campo">
                  <label>Código detracción</label>
                  <input type="text" id="c-cod-detrac" placeholder="Código SUNAT">
                </div>
                <div class="campo">
                  <label>Monto detracción</label>
                  <input type="number" id="c-mto-detrac" min="0" step="0.01" placeholder="0.00">
                </div>
              </div>
            </div>
            <div class="campo" style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="c-deducible" checked style="width:auto">
              <label style="margin:0">Deducible para Renta</label>
            </div>
            <div class="campo">
              <label>Estado</label>
              <select id="c-estado-modal">
                <option value="EMITIDO">Emitido</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Observaciones</label>
              <input type="text" id="c-obs" placeholder="Observaciones opcionales">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCompra()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarCompra()" id="btn-guardar-c">Guardar</button>
        </div>
      </div>
    </div>`;

  await Promise.all([cargarCompras(), cargarCatalogosCompras()]);
}

async function cargarCompras() {
  const { data } = await _supabase
    .from('registro_compras')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false })
    .limit(1000);
  compras_lista = data || [];
  filtrarCompras();
}

async function cargarCatalogosCompras() {
  const [resProvs, resTiposDoc] = await Promise.all([
    _supabase.from('empresas_clientes').select('id,nombre,ruc_dni').eq('empresa_operadora_id', empresa_activa.id).eq('activo', true).order('nombre'),
    _supabase.from('catalogo_tipos_documento').select('codigo,nombre').eq('activo', true).order('nombre'),
  ]);
  compras_proveedores = resProvs.data || [];
  compras_tipos_doc   = resTiposDoc.data || [];
}

function filtrarCompras() {
  const periodo = document.getElementById('c-periodo')?.value || '';
  const estado  = document.getElementById('c-estado-f')?.value || '';
  const q       = (document.getElementById('c-buscar')?.value || '').toLowerCase();

  compras_filtrada = compras_lista.filter(c =>
    (!periodo || c.periodo === periodo) &&
    (!estado  || c.estado === estado) &&
    (!q || (c.nombre_proveedor||'').toLowerCase().includes(q) ||
           (c.ruc_proveedor||'').includes(q) ||
           (c.numero||'').includes(q))
  );
  const ctr = document.getElementById('c-contador');
  if (ctr) ctr.textContent = `${compras_filtrada.length} registro(s)`;
  compras_pag = 1;
  _renderResumenCompras();
  renderTablaCompras();
}

function _renderResumenCompras() {
  const activos = compras_filtrada.filter(c => c.estado !== 'ANULADO');
  const base    = activos.reduce((s, c) => s + parseFloat(c.base_imponible || 0), 0);
  const igv     = activos.reduce((s, c) => s + parseFloat(c.igv || 0), 0);
  const detrac  = activos.filter(c => c.tiene_detraccion).reduce((s, c) => s + parseFloat(c.monto_detraccion || 0), 0);
  const grid    = document.getElementById('compras-resumen');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icono azul">🧾</div>
      <div class="stat-info"><div class="numero">${activos.length}</div><div class="etiqueta">Comprobantes registrados</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono verde">💰</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(igv)}</div><div class="etiqueta">IGV crédito fiscal</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icono amarillo">🔄</div>
      <div class="stat-info"><div class="numero">${formatearMoneda(detrac)}</div><div class="etiqueta">Detracciones</div></div>
    </div>`;
}

function renderTablaCompras() {
  const inicio = (compras_pag - 1) * COMPRAS_POR_PAG;
  const pagina = compras_filtrada.slice(inicio, inicio + COMPRAS_POR_PAG);
  const tbody  = document.getElementById('tbody-compras');
  if (!tbody) return;
  const colores = { EMITIDO: 'badge-activo', BORRADOR: 'badge-warning', ANULADO: 'badge-inactivo' };
  tbody.innerHTML = pagina.length ? pagina.map(c => `
    <tr ${c.estado === 'ANULADO' ? 'style="opacity:0.55"' : ''}>
      <td>${formatearFecha(c.fecha_emision)}</td>
      <td class="text-sm">${c.fecha_vencimiento ? formatearFecha(c.fecha_vencimiento) : '—'}</td>
      <td class="text-sm">${escapar(c.tipo_documento_codigo || '—')}</td>
      <td class="text-mono text-sm">${escapar((c.serie||'') + '-' + (c.numero||''))}</td>
      <td class="text-sm">${escapar((c.nombre_proveedor||'—').slice(0,28))}</td>
      <td class="text-mono text-sm">${escapar(c.ruc_proveedor || '—')}</td>
      <td class="text-right">${formatearMoneda(c.base_imponible || 0)}</td>
      <td class="text-right">${formatearMoneda(c.igv || 0)}</td>
      <td class="text-right font-medium">${formatearMoneda(c.total || 0)}</td>
      <td class="text-center">${c.tiene_detraccion ? '<span class="badge badge-warning" style="font-size:10px">'+formatearMoneda(c.monto_detraccion||0)+'</span>' : '—'}</td>
      <td><span class="badge ${colores[c.estado]||'badge-info'}" style="font-size:11px">${c.estado}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalCompra('${c.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="anularCompra('${c.id}')">🚫</button>
        <button class="btn-icono peligro" onclick="eliminarCompra('${c.id}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="12" class="text-center text-muted">Sin registros de compras</td></tr>';

  const activos  = compras_filtrada.filter(c => c.estado !== 'ANULADO');
  const sumBase  = activos.reduce((s, c) => s + parseFloat(c.base_imponible || 0), 0);
  const sumIgv   = activos.reduce((s, c) => s + parseFloat(c.igv || 0), 0);
  const sumTotal = activos.reduce((s, c) => s + parseFloat(c.total || 0), 0);
  const tfoot = document.getElementById('tfoot-compras');
  if (tfoot && compras_filtrada.length) {
    tfoot.innerHTML = `<tr style="font-weight:600;background:var(--color-bg-alt,#f7fafc)">
      <td colspan="6" class="text-right">TOTALES</td>
      <td class="text-right">${formatearMoneda(sumBase)}</td>
      <td class="text-right">${formatearMoneda(sumIgv)}</td>
      <td class="text-right">${formatearMoneda(sumTotal)}</td>
      <td colspan="3"></td>
    </tr>`;
  }

  const total = compras_filtrada.length;
  const pags  = Math.ceil(total / COMPRAS_POR_PAG);
  const pagEl = document.getElementById('pag-compras');
  if (pagEl) pagEl.innerHTML = total > COMPRAS_POR_PAG ? `
    <span class="pag-info">${inicio+1}–${Math.min(inicio+COMPRAS_POR_PAG,total)} de ${total}</span>
    <button class="btn-pag" onclick="cambiarPagCompras(-1)" ${compras_pag<=1?'disabled':''}>‹</button>
    <span>${compras_pag} / ${pags}</span>
    <button class="btn-pag" onclick="cambiarPagCompras(1)"  ${compras_pag>=pags?'disabled':''}>›</button>` : '';
}

function cambiarPagCompras(dir) { compras_pag += dir; renderTablaCompras(); }

function calcularTotalesCompra() {
  const base = parseFloat(document.getElementById('c-base')?.value) || 0;
  const el_igv  = document.getElementById('c-igv');
  const el_tot  = document.getElementById('c-total');
  if (el_igv) el_igv.value = (base * 0.18).toFixed(2);
  if (el_tot) el_tot.value = (base * 1.18).toFixed(2);
}
function calcularBaseDesdeCompra() {
  const total = parseFloat(document.getElementById('c-total')?.value) || 0;
  const base  = total / 1.18;
  const el_base = document.getElementById('c-base');
  const el_igv  = document.getElementById('c-igv');
  if (el_base) el_base.value = base.toFixed(2);
  if (el_igv)  el_igv.value  = (total - base).toFixed(2);
}
function toggleDetraccionC() {
  const checked = document.getElementById('c-tiene-detrac')?.checked;
  const campos  = document.getElementById('c-detrac-campos');
  if (campos) campos.style.display = checked ? 'contents' : 'none';
}

function _poblarSelectsCompra(compra) {
  const selProv = document.getElementById('c-proveedor-f');
  if (selProv) {
    selProv.innerHTML = '<option value="">— Sin proveedor —</option>' +
      compras_proveedores.map(p => `<option value="${p.id}" data-ruc="${p.ruc_dni||''}" data-nombre="${escapar(p.nombre)}">${escapar(p.nombre)}</option>`).join('');
    selProv.onchange = () => {
      const opt = selProv.options[selProv.selectedIndex];
      document.getElementById('c-ruc-prov').value    = opt.dataset.ruc || '';
      document.getElementById('c-nombre-prov').value = opt.dataset.nombre || '';
    };
    if (compra?.proveedor_id) selProv.value = compra.proveedor_id;
  }
  const selDoc = document.getElementById('c-tipo-doc-f');
  if (selDoc) {
    selDoc.innerHTML = '<option value="">— Seleccionar —</option>' +
      compras_tipos_doc.map(t => `<option value="${t.codigo}">${t.codigo} — ${escapar(t.nombre)}</option>`).join('');
    if (compra?.tipo_documento_codigo) setTimeout(() => selDoc.value = compra.tipo_documento_codigo, 50);
  }
}

function abrirModalCompra(id) {
  document.getElementById('alerta-c').classList.remove('visible');
  document.getElementById('c-detrac-campos').style.display = 'none';
  const hoy = new Date().toISOString().slice(0, 10);
  const periodoActual = document.getElementById('c-periodo')?.value || new Date().toISOString().slice(0,7);
  if (id) {
    const c = compras_lista.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-c-titulo').textContent = 'Editar compra';
    document.getElementById('c-id').value           = c.id;
    document.getElementById('c-periodo-f').value    = c.periodo;
    document.getElementById('c-fecha-f').value      = c.fecha_emision;
    document.getElementById('c-vto-f').value        = c.fecha_vencimiento || '';
    document.getElementById('c-serie').value        = c.serie || '';
    document.getElementById('c-numero').value       = c.numero || '';
    document.getElementById('c-ruc-prov').value     = c.ruc_proveedor || '';
    document.getElementById('c-nombre-prov').value  = c.nombre_proveedor || '';
    document.getElementById('c-base').value         = c.base_imponible || '';
    document.getElementById('c-igv').value          = c.igv || '';
    document.getElementById('c-total').value        = c.total || '';
    document.getElementById('c-moneda-f').value     = c.moneda || 'PEN';
    document.getElementById('c-tc').value           = c.tipo_cambio || '1';
    document.getElementById('c-tiene-detrac').checked = c.tiene_detraccion;
    document.getElementById('c-deducible').checked  = c.deducible_renta !== false;
    document.getElementById('c-estado-modal').value = c.estado;
    document.getElementById('c-obs').value          = c.observaciones || '';
    if (c.tiene_detraccion) {
      document.getElementById('c-detrac-campos').style.display = 'contents';
      document.getElementById('c-cod-detrac').value = c.codigo_detraccion || '';
      document.getElementById('c-mto-detrac').value = c.monto_detraccion || '';
    }
    _poblarSelectsCompra(c);
  } else {
    document.getElementById('modal-c-titulo').textContent = 'Nueva compra';
    document.getElementById('c-id').value        = '';
    document.getElementById('c-periodo-f').value = periodoActual;
    document.getElementById('c-fecha-f').value   = hoy;
    ['c-vto-f','c-serie','c-numero','c-ruc-prov','c-nombre-prov','c-base','c-igv','c-total','c-obs'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('c-moneda-f').value     = 'PEN';
    document.getElementById('c-tc').value           = '1';
    document.getElementById('c-tiene-detrac').checked = false;
    document.getElementById('c-deducible').checked  = true;
    document.getElementById('c-estado-modal').value = 'EMITIDO';
    _poblarSelectsCompra(null);
  }
  document.getElementById('modal-compra').style.display = 'flex';
}
function cerrarModalCompra() { document.getElementById('modal-compra').style.display = 'none'; }

async function guardarCompra() {
  const periodo = document.getElementById('c-periodo-f').value;
  const fecha   = document.getElementById('c-fecha-f').value;
  const total   = parseFloat(document.getElementById('c-total').value);
  const alerta  = document.getElementById('alerta-c');
  const btn     = document.getElementById('btn-guardar-c');
  alerta.classList.remove('visible');
  if (!periodo) { alerta.textContent = 'El periodo es obligatorio.';      alerta.classList.add('visible'); return; }
  if (!fecha)   { alerta.textContent = 'La fecha es obligatoria.';        alerta.classList.add('visible'); return; }
  if (!total)   { alerta.textContent = 'El total debe ser mayor a cero.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id     = document.getElementById('c-id').value;
  const tieneD = document.getElementById('c-tiene-detrac').checked;
  const payload = {
    empresa_operadora_id:   empresa_activa.id,
    periodo,
    fecha_emision:          fecha,
    fecha_vencimiento:      document.getElementById('c-vto-f').value || null,
    tipo_documento_codigo:  document.getElementById('c-tipo-doc-f').value || null,
    serie:                  document.getElementById('c-serie').value.trim() || null,
    numero:                 document.getElementById('c-numero').value.trim() || null,
    proveedor_id:           document.getElementById('c-proveedor-f').value || null,
    ruc_proveedor:          document.getElementById('c-ruc-prov').value.trim() || null,
    nombre_proveedor:       document.getElementById('c-nombre-prov').value.trim() || null,
    base_imponible:         parseFloat(document.getElementById('c-base').value) || 0,
    igv:                    parseFloat(document.getElementById('c-igv').value) || 0,
    total,
    moneda:                 document.getElementById('c-moneda-f').value,
    tipo_cambio:            parseFloat(document.getElementById('c-tc').value) || 1,
    tiene_detraccion:       tieneD,
    codigo_detraccion:      tieneD ? (document.getElementById('c-cod-detrac').value || null) : null,
    monto_detraccion:       tieneD ? (parseFloat(document.getElementById('c-mto-detrac').value) || null) : null,
    deducible_renta:        document.getElementById('c-deducible').checked,
    estado:                 document.getElementById('c-estado-modal').value,
    observaciones:          document.getElementById('c-obs').value.trim() || null,
    usuario_id:             perfil_usuario?.id || null,
  };
  const { error } = id
    ? await _supabase.from('registro_compras').update(payload).eq('id', id)
    : await _supabase.from('registro_compras').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Compra actualizada' : 'Compra registrada', 'exito');
  cerrarModalCompra();
  await cargarCompras();
}

async function anularCompra(id) {
  if (!await confirmar('¿Anular este comprobante?')) return;
  const { error } = await _supabase.from('registro_compras').update({ estado: 'ANULADO' }).eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Comprobante anulado', 'exito');
  await cargarCompras();
}

async function eliminarCompra(id) {
  if (!await confirmar('¿Eliminar este registro permanentemente?')) return;
  const { error } = await _supabase.from('registro_compras').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Eliminado', 'exito');
  await cargarCompras();
}

function exportarComprasExcel() {
  if (!compras_filtrada.length) { mostrarToast('No hay datos para exportar', 'atencion'); return; }
  const rows = compras_filtrada.map(c => ({
    Periodo:         c.periodo,
    'F. Emisión':    c.fecha_emision,
    'F. Vencimiento': c.fecha_vencimiento || '',
    'Tipo Doc.':     c.tipo_documento_codigo || '',
    Serie:           c.serie || '',
    Número:          c.numero || '',
    'RUC Proveedor': c.ruc_proveedor || '',
    Proveedor:       c.nombre_proveedor || '',
    'Base Imponible': c.base_imponible || 0,
    IGV:             c.igv || 0,
    Total:           c.total || 0,
    Moneda:          c.moneda,
    'Tiene Detracción': c.tiene_detraccion ? 'Sí' : 'No',
    'Monto Detracción': c.monto_detraccion || 0,
    'Deducible Renta': c.deducible_renta ? 'Sí' : 'No',
    Estado:          c.estado,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RegistroCompras');
  XLSX.writeFile(wb, `registro_compras_${empresa_activa.nombre}_${new Date().toISOString().slice(0,7)}.xlsx`);
}
