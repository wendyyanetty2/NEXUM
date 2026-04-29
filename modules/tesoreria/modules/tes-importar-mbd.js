/* ============================================================
   NEXUM — Tesorería: Módulo MBD (Movimientos Bancarios Diarios)
   ============================================================ */

const TIPOS_DOC_MBD = [
  {val:'FA',lab:'FA — Factura'},{val:'BO',lab:'BO — Boletas'},
  {val:'BP',lab:'BP — Boletas de Pago'},{val:'RH',lab:'RH — Recibo por honorarios'},
  {val:'TK',lab:'TK — Ticket'},{val:'PM',lab:'PM — Planilla de Movilidad'},
  {val:'AT',lab:'AT — App de taxi'},{val:'DL',lab:'DL — Delivery'},
  {val:'PJ',lab:'PJ — Ticket de peaje'},{val:'SB',lab:'SB — Recibo de luz/agua/gas'},
  {val:'VB',lab:'VB — Voucher de banco'},{val:'OT',lab:'OT — Comprobante sin serie legible'}
];

let _mbdCatalogos = { conceptos: [], empresas: [], autorizaciones: [], mediosPago: [] };

async function _mbdCargarCatalogos() {
  const eid = empresa_activa.id;
  const [rc, re, ra, rm] = await Promise.all([
    _supabase.from('conceptos').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('empresas_clientes').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('autorizaciones').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('medios_pago').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
  ]);
  _mbdCatalogos.conceptos     = (rc.data || []).map(r => r.nombre);
  _mbdCatalogos.empresas      = (re.data || []).map(r => r.nombre);
  _mbdCatalogos.autorizaciones= (ra.data || []).map(r => r.nombre);
  _mbdCatalogos.mediosPago    = (rm.data || []).map(r => r.nombre);
}

function renderTabImportarMBD(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="mbd-filtro-mes" style="${estiloSelect()}">
            ${Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
              return `<option value="${m}" ${m===mesActual?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
            }).join('')}
          </select>
          <select id="mbd-filtro-anio" style="${estiloSelect()}">
            ${[anioActual-1, anioActual, anioActual+1].map(a=>`<option value="${a}" ${a===anioActual?'selected':''}>${a}</option>`).join('')}
          </select>
          <input id="mbd-buscar" type="text" placeholder="Buscar…" style="${estiloInput()};width:180px">
          <button onclick="cargarMBD()" style="${estiloBtnSecundario()}">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="importarExcelMBD()" style="${estiloBtnSecundario()}">📂 Importar Excel</button>
          <button onclick="exportarExcelMBD()" style="${estiloBtnSecundario()}">📥 Exportar Excel</button>
          <button onclick="abrirModalMBD()" style="${estiloBtnPrimario()}">+ Nuevo movimiento</button>
        </div>
      </div>
      <div id="mbd-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="mbd-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>

      <div id="mbd-preview-wrap" style="display:none;margin-top:16px;border:1px solid var(--color-borde);border-radius:var(--radio);padding:16px;background:var(--color-fondo-2)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <h3 style="margin:0">👁️ Vista previa — <span id="mbd-prev-count">0</span> registros</h3>
          <span id="mbd-prev-resumen" style="font-size:13px;color:var(--color-texto-suave)"></span>
        </div>
        <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
          <table class="tabla-nexum">
            <thead><tr>
              <th>#</th><th>Fecha</th><th>Monto</th><th>Mon.</th>
              <th>Proveedor / Personal</th><th>Concepto</th><th>Tipo Doc</th><th>Medio Pago</th><th>Estado</th>
            </tr></thead>
            <tbody id="mbd-prev-tbody"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="cancelarPreviewMBD()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">Cancelar</button>
          <button onclick="confirmarImportMBD()" id="btn-confirmar-mbd" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">✅ Confirmar e importar</button>
        </div>
      </div>
    </div>
    <input type="file" id="mbd-file-input" accept=".xlsx,.xls,.xlsm" style="display:none" onchange="procesarImportMBD(this)">
  `;

  document.getElementById('mbd-buscar').addEventListener('keydown', e => { if (e.key === 'Enter') cargarMBD(); });
  cargarMBD();
}

async function cargarMBD() {
  const mes   = document.getElementById('mbd-filtro-mes')?.value;
  const anio  = document.getElementById('mbd-filtro-anio')?.value;
  const buscar = document.getElementById('mbd-buscar')?.value.trim().toLowerCase();
  const wrap  = document.getElementById('mbd-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  let q = _supabase.from('tesoreria_mbd').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', desde)
    .lte('fecha_deposito', hasta)
    .order('fecha_deposito', { ascending: false });

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error al cargar: ${escapar(error.message)}</p>`; return; }

  let filas = data || [];
  if (buscar) filas = filas.filter(r =>
    (r.descripcion||'').toLowerCase().includes(buscar) ||
    (r.proveedor_empresa_personal||'').toLowerCase().includes(buscar) ||
    (r.concepto||'').toLowerCase().includes(buscar) ||
    (r.empresa||'').toLowerCase().includes(buscar) ||
    (r.nro_factura_doc||'').toLowerCase().includes(buscar) ||
    (r.ruc_dni||'').toLowerCase().includes(buscar) ||
    (r.observaciones_3||'').toLowerCase().includes(buscar)
  );

  renderResumenMBD(filas);

  if (!filas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin movimientos en este período.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Fecha</th><th>N° Op.</th><th>Monto</th><th>Mon.</th>
        <th>Proveedor / Empresa</th><th>Concepto</th><th>Empresa</th>
        <th>Doc.</th><th>N° Doc</th><th>Medio Pago</th><th>Estado</th><th>Autorización</th>
        <th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => `
          <tr>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_deposito)}</td>
            <td>${escapar(r.nro_operacion_bancaria||'—')}</td>
            <td style="text-align:right;font-weight:600;color:${r.monto>=0?'var(--color-exito)':'var(--color-critico)'}">${formatearMoneda(r.monto, r.moneda==='USD'?'USD':'PEN')}</td>
            <td>${escapar(r.moneda||'S/')}</td>
            <td>${escapar(truncar(r.proveedor_empresa_personal||'—',25))}</td>
            <td>${escapar(r.concepto||'—')}</td>
            <td>${escapar(truncar(r.empresa||'—',20))}</td>
            <td><span class="badge-doc">${escapar(r.tipo_doc||'—')}</span></td>
            <td>${escapar(r.nro_factura_doc||'—')}</td>
            <td>${r.observaciones_3 ? `<span class="badge-medio">${escapar(r.observaciones_3)}</span>` : '—'}</td>
            <td><span class="badge-estado-${(r.entrega_doc||'').toLowerCase().replace(/\s/g,'-')}">${escapar(r.entrega_doc||'—')}</span></td>
            <td>${escapar(truncar(r.autorizacion||'—',18))}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalMBD('${r.id}')" style="${estiloBtnIcono()}" title="Editar">✏️</button>
              <button onclick="eliminarMBD('${r.id}')" style="${estiloBtnIcono('danger')}" title="Eliminar">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} registro(s)</p>
    ${estilosBadge()}
  `;
}

function renderResumenMBD(filas) {
  const div = document.getElementById('mbd-resumen');
  if (!div) return;
  const totalS = filas.filter(r=>r.moneda!=='USD').reduce((s,r)=>s+Number(r.monto),0);
  const totalD = filas.filter(r=>r.moneda==='USD').reduce((s,r)=>s+Number(r.monto),0);
  const pendientes = filas.filter(r=>r.entrega_doc==='PENDIENTE').length;
  div.innerHTML = `
    <div style="${estiloCard('var(--color-exito)')}">
      <div style="font-size:11px;opacity:.8">TOTAL SOLES</div>
      <div style="font-size:20px;font-weight:700">${formatearMoneda(totalS,'PEN')}</div>
    </div>
    ${totalD ? `<div style="${estiloCard('#2B6CB0')}">
      <div style="font-size:11px;opacity:.8">TOTAL USD</div>
      <div style="font-size:20px;font-weight:700">${formatearMoneda(totalD,'USD')}</div>
    </div>` : ''}
    <div style="${estiloCard(pendientes>0?'var(--color-atencion)':'#4A5568')}">
      <div style="font-size:11px;opacity:.8">PENDIENTES DE DOC</div>
      <div style="font-size:20px;font-weight:700">${pendientes}</div>
    </div>
    <div style="${estiloCard('#4A5568')}">
      <div style="font-size:11px;opacity:.8">TOTAL MOVIMIENTOS</div>
      <div style="font-size:20px;font-weight:700">${filas.length}</div>
    </div>
  `;
}

let _mbdDatos = [];

async function abrirModalMBD(id = null) {
  let item = null;
  await _mbdCargarCatalogos();
  if (id) {
    const { data } = await _supabase.from('tesoreria_mbd').select('*').eq('id', id).single();
    item = data;
  }

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalMBD()">
      <div class="modal" style="max-width:780px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📊 ${id ? 'Editar' : 'Nuevo'} Movimiento Bancario</h3>
          <button class="modal-cerrar" onclick="cerrarModalMBD()">✕</button>
        </div>
        <div class="modal-body">
          <div id="mbd-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="campo">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" id="mbd-fecha" value="${item?.fecha_deposito||new Date().toISOString().slice(0,10)}">
            </div>
            <div class="campo">
              <label>Monto <span class="req">*</span></label>
              <input type="number" id="mbd-monto" step="0.01" placeholder="0.00" value="${item?.monto||''}">
            </div>
            <div class="campo">
              <label>Moneda</label>
              <select id="mbd-moneda">
                <option value="S/" ${item?.moneda==='S/'?'selected':''}>S/ — Soles</option>
                <option value="USD" ${item?.moneda==='USD'?'selected':''}>USD — Dólares</option>
              </select>
            </div>
            <div class="campo">
              <label>N° Operación Bancaria</label>
              <input type="text" id="mbd-nro-op" value="${item?.nro_operacion_bancaria||''}" placeholder="Opcional">
            </div>
            <div class="campo" style="grid-column:span 2">
              <label>Descripción</label>
              <input type="text" id="mbd-descripcion" value="${escapar(item?.descripcion||'')}" placeholder="Descripción del movimiento">
            </div>
            <div class="campo" style="grid-column:span 2">
              <label>Proveedor / Empresa / Personal</label>
              <input type="text" id="mbd-proveedor" value="${escapar(item?.proveedor_empresa_personal||'')}" placeholder="Nombre">
            </div>
            <div class="campo">
              <label>RUC / DNI</label>
              <input type="text" id="mbd-ruc-dni" value="${escapar(item?.ruc_dni||'')}" placeholder="Documento">
            </div>
            <div class="campo">
              <label>Concepto</label>
              <select id="mbd-concepto">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.conceptos.map(c=>`<option value="${c}" ${item?.concepto===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Empresa / Proveedor</label>
              <select id="mbd-empresa">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.empresas.map(e=>`<option value="${e}" ${item?.empresa===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Tipo DOC</label>
              <select id="mbd-tipo-doc">
                <option value="">— Seleccionar —</option>
                ${TIPOS_DOC_MBD.map(t=>`<option value="${t.val}" ${item?.tipo_doc===t.val?'selected':''}>${t.lab}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Estado Entrega DOC</label>
              <select id="mbd-entrega-doc">
                ${['PENDIENTE','OBSERVADO','EMITIDO','CANCELADO'].map(e=>`<option value="${e}" ${(item?.entrega_doc||'PENDIENTE')===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>N° Factura / DOC</label>
              <input type="text" id="mbd-nro-factura" value="${escapar(item?.nro_factura_doc||'')}" placeholder="Serie-Número">
            </div>
            <div class="campo">
              <label>Autorización</label>
              <select id="mbd-autorizacion">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.autorizaciones.map(a=>`<option value="${a}" ${item?.autorizacion===a?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Medio de Pago</label>
              <select id="mbd-medio-pago">
                <option value="">— Seleccionar —</option>
                ${_mbdCatalogos.mediosPago.map(m=>`<option value="${m}" ${item?.observaciones_3===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Cotización</label>
              <input type="text" id="mbd-cotizacion" value="${escapar(item?.cotizacion||'')}">
            </div>
            <div class="campo">
              <label>OC</label>
              <input type="text" id="mbd-oc" value="${escapar(item?.oc||'')}">
            </div>
            <div class="campo">
              <label>Proyecto</label>
              <input type="text" id="mbd-proyecto" value="${escapar(item?.proyecto||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Detalles Compra / Servicio</label>
              <input type="text" id="mbd-detalles" value="${escapar(item?.detalles_compra_servicio||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Observaciones</label>
              <input type="text" id="mbd-obs" value="${escapar(item?.observaciones||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Obs. 2</label>
              <input type="text" id="mbd-obs2" value="${escapar(item?.observaciones_2||'')}">
            </div>
            <div class="campo" style="grid-column:span 3">
              <label>Obs. 4</label>
              <input type="text" id="mbd-obs4" value="${escapar(item?.observaciones_4||'')}">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalMBD()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarMBD('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function cerrarModalMBD() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarMBD(id) {
  const alerta = document.getElementById('mbd-alerta');
  alerta.classList.remove('visible');

  const fecha  = document.getElementById('mbd-fecha').value;
  const monto  = parseFloat(document.getElementById('mbd-monto').value);

  if (!fecha) { alerta.textContent = 'La fecha es requerida.'; alerta.classList.add('visible'); return; }
  if (isNaN(monto)) { alerta.textContent = 'Ingrese un monto válido.'; alerta.classList.add('visible'); return; }

  const payload = {
    empresa_id:               empresa_activa.id,
    fecha_deposito:           fecha,
    monto,
    moneda:                   document.getElementById('mbd-moneda').value,
    nro_operacion_bancaria:   document.getElementById('mbd-nro-op').value.trim()||null,
    descripcion:              document.getElementById('mbd-descripcion').value.trim()||null,
    proveedor_empresa_personal: document.getElementById('mbd-proveedor').value.trim()||null,
    ruc_dni:                  document.getElementById('mbd-ruc-dni').value.trim()||null,
    concepto:                 document.getElementById('mbd-concepto').value||null,
    empresa:                  document.getElementById('mbd-empresa').value||null,
    tipo_doc:                 document.getElementById('mbd-tipo-doc').value||null,
    entrega_doc:              document.getElementById('mbd-entrega-doc').value,
    nro_factura_doc:          document.getElementById('mbd-nro-factura').value.trim()||null,
    autorizacion:             document.getElementById('mbd-autorizacion').value||null,
    cotizacion:               document.getElementById('mbd-cotizacion').value.trim()||null,
    oc:                       document.getElementById('mbd-oc').value.trim()||null,
    proyecto:                 document.getElementById('mbd-proyecto').value.trim()||null,
    detalles_compra_servicio: document.getElementById('mbd-detalles').value.trim()||null,
    observaciones:            document.getElementById('mbd-obs').value.trim()||null,
    observaciones_2:          document.getElementById('mbd-obs2').value.trim()||null,
    observaciones_3:          document.getElementById('mbd-medio-pago').value||null,
    observaciones_4:          document.getElementById('mbd-obs4').value.trim()||null,
    creado_por:               perfil_usuario.id,
    fecha_actualizacion:      new Date().toISOString(),
  };

  let error;
  if (id) {
    ({ error } = await _supabase.from('tesoreria_mbd').update(payload).eq('id', id));
  } else {
    ({ error } = await _supabase.from('tesoreria_mbd').insert(payload));
  }

  if (error) { alerta.textContent = 'Error al guardar: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Movimiento actualizado.' : 'Movimiento registrado.', 'exito');
  cerrarModalMBD();
  cargarMBD();
}

async function eliminarMBD(id) {
  const ok = await confirmar('¿Eliminar este movimiento?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('tesoreria_mbd').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Movimiento eliminado.', 'exito');
  cargarMBD();
}

function importarExcelMBD() {
  document.getElementById('mbd-file-input').click();
}

let _mbdDatosPreview = [];

function procesarImportMBD(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false, raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (rows.length < 2) { mostrarToast('El archivo no tiene datos.', 'atencion'); return; }

      const cabeceras = (rows[0] || []).map(h => (h || '').toString().trim().toLowerCase());
      const esTieneEncabezado = cabeceras.some(h => ['fecha', 'monto', 'fecha depósito', 'fecha deposito'].includes(h));
      const inicio = esTieneEncabezado ? 1 : 1;

      // Detectar formato nuevo (20 cols con Medio de Pago) vs antiguo (19 cols)
      const tieneMedioPago = cabeceras.some(h => h.includes('medio'));
      const maxCols = Math.max(...rows.slice(inicio, inicio+5).map(r => (r||[]).length));
      const formatoNuevo = tieneMedioPago || maxCols >= 20;

      const toDate = v => {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') {
          const d = new Date(Math.round((v - 25569) * 86400 * 1000));
          if (isNaN(d.getTime())) return null;
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        }
        if (v instanceof Date) return v.toISOString().slice(0,10);
        const s = v.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
        const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0,10);
      };
      const toNum = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

      _mbdDatosPreview = rows.slice(inicio).map((r, i) => {
        const fecha = toDate(r[1]);
        const monto = toNum(r[4]);
        const ok    = !!fecha && monto !== null;
        // Columnas 16+ dependen del formato
        const medioPago    = formatoNuevo ? r[16]?.toString()||null : null;
        const observaciones= formatoNuevo ? r[17]?.toString()||null : r[16]?.toString()||null;
        const detalles     = formatoNuevo ? r[18]?.toString()||null : r[17]?.toString()||null;
        const obs2         = formatoNuevo ? r[19]?.toString()||null : r[18]?.toString()||null;
        return {
          _fila: i + inicio + 2,
          _ok: ok,
          _error: !fecha ? 'Sin fecha' : monto === null ? 'Sin monto' : null,
          empresa_id:               empresa_activa.id,
          nro_operacion_bancaria:   r[0] !== null && r[0] !== undefined && r[0] !== ''
            ? String(typeof r[0] === 'number' ? Math.round(r[0]) : r[0]).padStart(8,'0')
            : null,
          fecha_deposito:           fecha,
          descripcion:              r[2]?.toString()||null,
          moneda:                   r[3]?.toString()||'S/',
          monto,
          proveedor_empresa_personal: r[5]?.toString()||null,
          ruc_dni:                  r[6]?.toString()||null,
          cotizacion:               r[7]?.toString()||null,
          oc:                       r[8]?.toString()||null,
          proyecto:                 r[9]?.toString()||null,
          concepto:                 r[10]?.toString()||null,
          empresa:                  r[11]?.toString()||null,
          entrega_doc:              r[12]?.toString()||'PENDIENTE',
          nro_factura_doc:          r[13]?.toString()||null,
          tipo_doc:                 r[14]?.toString()||null,
          autorizacion:             r[15]?.toString()||null,
          observaciones_3:          medioPago,
          observaciones:            observaciones,
          detalles_compra_servicio: detalles,
          observaciones_2:          obs2,
          creado_por:               perfil_usuario.id,
        };
      }).filter(r => r._fila > 0);

      const validos  = _mbdDatosPreview.filter(r => r._ok).length;
      const errores  = _mbdDatosPreview.length - validos;
      const prevWrap = document.getElementById('mbd-preview-wrap');
      const prevCnt  = document.getElementById('mbd-prev-count');
      const prevRes  = document.getElementById('mbd-prev-resumen');
      const prevBody = document.getElementById('mbd-prev-tbody');
      if (!prevWrap || !prevBody) return;

      if (prevCnt) prevCnt.textContent = _mbdDatosPreview.length;
      if (prevRes) prevRes.textContent = `✅ ${validos} válidos  ⚠️ ${errores} con error (se omitirán)`;

      const muestra = _mbdDatosPreview.slice(0, 20);
      prevBody.innerHTML = muestra.map(r => `
        <tr ${!r._ok ? 'style="background:rgba(197,48,48,.05)"' : ''}>
          <td style="font-size:11px;color:var(--color-texto-suave)">${r._fila}</td>
          <td style="white-space:nowrap">${r.fecha_deposito || `<span style="color:#C53030">${r._error}</span>`}</td>
          <td style="text-align:right;font-weight:600">${r.monto !== null ? formatearMoneda(r.monto, r.moneda==='USD'?'USD':'PEN') : '<span style="color:#C53030">—</span>'}</td>
          <td>${escapar(r.moneda||'S/')}</td>
          <td style="font-size:12px">${escapar((r.proveedor_empresa_personal||'—').slice(0,22))}</td>
          <td style="font-size:12px">${escapar(r.concepto||'—')}</td>
          <td style="font-size:12px">${escapar(r.tipo_doc||'—')}</td>
          <td style="font-size:12px">${escapar(r.observaciones_3||'—')}</td>
          <td>${r._ok
            ? '<span style="font-size:10px;background:#2F855A;color:#fff;padding:2px 6px;border-radius:8px">OK</span>'
            : `<span style="font-size:10px;background:#C53030;color:#fff;padding:2px 6px;border-radius:8px" title="${escapar(r._error||'')}">Error</span>`
          }</td>
        </tr>`).join('');

      if (_mbdDatosPreview.length > 20) {
        prevBody.innerHTML += `<tr><td colspan="9" style="text-align:center;color:var(--color-texto-suave);padding:8px;font-size:12px">… y ${_mbdDatosPreview.length - 20} filas más</td></tr>`;
      }

      if (!validos) { mostrarToast('No hay filas válidas para importar.', 'atencion'); return; }
      prevWrap.style.display = 'block';
      prevWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch(err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function cancelarPreviewMBD() {
  _mbdDatosPreview = [];
  const w = document.getElementById('mbd-preview-wrap');
  if (w) w.style.display = 'none';
}

async function confirmarImportMBD() {
  const validos = _mbdDatosPreview.filter(r => r._ok);
  if (!validos.length) { mostrarToast('No hay registros válidos.', 'atencion'); return; }

  const btn = document.getElementById('btn-confirmar-mbd');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  const registros = validos.map(({ _fila, _ok, _error, ...r }) => r);
  const CHUNK = 50;
  let ok = 0, errCount = 0;
  for (let i = 0; i < registros.length; i += CHUNK) {
    const { error } = await _supabase.from('tesoreria_mbd').insert(registros.slice(i, i + CHUNK));
    if (error) errCount += Math.min(CHUNK, registros.length - i);
    else ok += Math.min(CHUNK, registros.length - i);
  }

  if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar e importar'; }
  cancelarPreviewMBD();

  if (errCount > 0) mostrarToast(`Importado: ${ok} OK, ${errCount} errores.`, 'atencion');
  else mostrarToast(`✓ ${ok} movimiento(s) importado(s).`, 'exito');
  cargarMBD();
}

async function exportarExcelMBD() {
  const mes  = document.getElementById('mbd-filtro-mes')?.value;
  const anio = document.getElementById('mbd-filtro-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data } = await _supabase.from('tesoreria_mbd').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_deposito', desde).lte('fecha_deposito', hasta)
    .order('fecha_deposito');

  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cabecera = [
    'N° operacion Bancaria','Fecha de Deposito','Descripcion','Moneda','Monto',
    'Proveedores / Empresa / Personal','RUC / DNI','COTIZACIÓN','OC','Proyecto',
    'Concepto','Empresa','Entrega de FA / DOC / RRHH','Nª Factura o DOC.',
    'Tipo de DOC','Autorización','Medio de Pago','Observaciones',
    'Detalles Compra / Servicio','Observaciones 2'
  ];

  const filas = data.map(r => [
    r.nro_operacion_bancaria ? String(r.nro_operacion_bancaria).padStart(8,'0') : null,
    r.fecha_deposito, r.descripcion, r.moneda, r.monto,
    r.proveedor_empresa_personal, r.ruc_dni, r.cotizacion, r.oc, r.proyecto,
    r.concepto, r.empresa, r.entrega_doc, r.nro_factura_doc, r.tipo_doc,
    r.autorizacion, r.observaciones_3, r.observaciones,
    r.detalles_compra_servicio, r.observaciones_2
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  // Forzar N° Op como texto para preservar ceros a la izquierda
  filas.forEach((_, rowIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 0 });
    if (ws[cellRef]) ws[cellRef].t = 's';
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, `MBD_${empresa_activa.nombre_corto}_${anio}${mes}.xlsx`);
  mostrarToast('Archivo exportado.', 'exito');
}

/* ── Helpers de estilo ─────────────────────────────────────── */
function estiloSelect() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloInput() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloBtnPrimario() {
  return 'padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500';
}
function estiloBtnSecundario() {
  return 'padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px';
}
function estiloBtnIcono(tipo) {
  const bg = tipo === 'danger' ? 'rgba(197,48,48,.1)' : 'rgba(44,82,130,.1)';
  const co = tipo === 'danger' ? '#C53030' : 'var(--color-secundario)';
  return `padding:4px 8px;background:${bg};color:${co};border:none;border-radius:4px;cursor:pointer;font-size:13px`;
}
function estiloCard(color) {
  return `background:${color};color:#fff;padding:12px 16px;border-radius:8px;min-width:140px`;
}
function estilosBadge() {
  return `<style>
    .badge-doc{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:var(--color-secundario);color:#fff}
    .badge-medio{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#553C9A;color:#fff}
    .badge-estado-pendiente{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#D69E2E;color:#fff}
    .badge-estado-observado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#C53030;color:#fff}
    .badge-estado-emitido{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#2F855A;color:#fff}
    .badge-estado-cancelado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#4A5568;color:#fff}
  </style>`;
}
