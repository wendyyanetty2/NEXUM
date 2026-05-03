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
let _pendientesGrupos = {};

async function _mbdCargarCatalogos() {
  const eid = empresa_activa.id;
  const [rc, re, ra, rm] = await Promise.all([
    _supabase.from('conceptos').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('empresas_clientes').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('autorizaciones').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('medios_pago').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
  ]);
  _mbdCatalogos.conceptos      = (rc.data || []).map(r => r.nombre);
  _mbdCatalogos.empresas       = (re.data || []).map(r => r.nombre);
  _mbdCatalogos.autorizaciones = (ra.data || []).map(r => r.nombre);
  _mbdCatalogos.mediosPago     = (rm.data || []).map(r => r.nombre);
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
          <select id="mbd-filtro-estado" style="${estiloSelect()}">
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">🔴 PENDIENTE</option>
            <option value="OBSERVADO">🟡 OBSERVADO</option>
            <option value="EMITIDO">🟢 EMITIDO</option>
            <option value="CANCELADO">⚫ CANCELADO</option>
          </select>
          <button onclick="cargarMBD()" style="${estiloBtnSecundario()}">🔍 Filtrar</button>
          <button onclick="eliminarMesMBD()" style="padding:8px 14px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">🗑️ Borrar Mes</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="renderPanelPendientesMBD()" style="padding:8px 14px;background:rgba(197,48,48,.1);color:#C53030;border:1px solid #C53030;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">🔴 Panel PENDIENTES</button>
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
          <button onclick="cancelarPreviewMBD()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">Cancelar</button>
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
    .order('fecha_deposito', { ascending: true })
    .order('nro_operacion_bancaria', { ascending: true });

  const estadoFiltro = document.getElementById('mbd-filtro-estado')?.value;
  if (estadoFiltro) q = q.eq('entrega_doc', estadoFiltro);

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
    (r.nro_operacion_bancaria||'').toLowerCase().includes(buscar)
  );

  renderResumenMBD(filas);

  if (!filas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin movimientos en este período.</p>';
    return;
  }

  const _TH = 'padding:8px 10px;text-align:left;font-weight:600;font-size:11px;color:var(--color-texto);border-bottom:2px solid var(--color-borde);white-space:nowrap;background:var(--color-bg-card);';
  const _TD = 'padding:6px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;';

  wrap.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
    <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          <th style="${_TH}">N° Op.</th>
          <th style="${_TH}">Fecha</th>
          <th style="${_TH}min-width:160px">Descripción</th>
          <th style="${_TH}">Mon.</th>
          <th style="${_TH}text-align:right">Monto</th>
          <th style="${_TH}min-width:180px">Proveedor</th>
          <th style="${_TH}">RUC / DNI</th>
          <th style="${_TH}">Estado DOC</th>
          <th style="${_TH}text-align:center">Acc.</th>
        </tr>
      </thead>
      <tbody>
        ${filas.map(r => {
          const est = r.entrega_doc || 'PENDIENTE';
          const badgeBg = { PENDIENTE:'#C53030', OBSERVADO:'#D69E2E', EMITIDO:'#2F855A', CANCELADO:'#718096' }[est] || '#718096';
          return `<tr>
            <td style="${_TD}">${escapar(r.nro_operacion_bancaria||'—')}</td>
            <td style="${_TD}">${formatearFecha(r.fecha_deposito)}</td>
            <td style="${_TD}">${escapar(r.descripcion||'—')}</td>
            <td style="${_TD}">${escapar(r.moneda||'S/')}</td>
            <td style="${_TD}text-align:right;font-weight:700">${formatearMoneda(r.monto, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="${_TD}">${escapar(r.proveedor_empresa_personal||'—')}</td>
            <td style="${_TD}">${escapar(r.ruc_dni||'—')}</td>
            <td style="${_TD}"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${badgeBg};color:#fff">${est}</span></td>
            <td style="${_TD}text-align:center">
              <button onclick="abrirModalMBD('${r.id}')" style="${estiloBtnIcono()}">✏️</button>
              <button onclick="eliminarMBD('${r.id}')" style="${estiloBtnIcono('danger')}">🗑️</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
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
    <div style="${estiloCard(pendientes>0?'var(--color-atencion)':'#4A5568')}">
      <div style="font-size:11px;opacity:.8">PENDIENTES DOC</div>
      <div style="font-size:20px;font-weight:700">${pendientes}</div>
    </div>
  `;
}

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
      <div class="modal" style="max-width:700px;width:95%">
        <div class="modal-header"><h3>${id ? 'Editar' : 'Nuevo'} Movimiento</h3><button onclick="cerrarModalMBD()">✕</button></div>
        <div class="modal-body">
          <div id="mbd-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="campo"><label>Fecha</label><input type="date" id="mbd-fecha" value="${item?.fecha_deposito||new Date().toISOString().slice(0,10)}"></div>
            <div class="campo"><label>Monto</label><input type="number" id="mbd-monto" step="0.01" value="${item?.monto||''}"></div>
            <div class="campo"><label>Moneda</label><select id="mbd-moneda"><option value="S/" ${item?.moneda==='S/'?'selected':''}>Soles</option><option value="USD" ${item?.moneda==='USD'?'selected':''}>Dólares</option></select></div>
            <div class="campo"><label>Estado</label><select id="mbd-entrega-doc">${['PENDIENTE','OBSERVADO','EMITIDO','CANCELADO'].map(e=>`<option value="${e}" ${(item?.entrega_doc||'PENDIENTE')===e?'selected':''}>${e}</option>`).join('')}</select></div>
            <div class="campo" style="grid-column:span 2"><label>Descripción</label><input type="text" id="mbd-descripcion" value="${escapar(item?.descripcion||'')}"></div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-primario" onclick="guardarMBD('${id||''}')">Guardar</button></div>
      </div>
    </div>
  `;
}

async function guardarMBD(id) {
  const payload = {
    empresa_id: empresa_activa.id,
    fecha_deposito: document.getElementById('mbd-fecha').value,
    monto: parseFloat(document.getElementById('mbd-monto').value),
    moneda: document.getElementById('mbd-moneda').value,
    descripcion: document.getElementById('mbd-descripcion').value.trim(),
    entrega_doc: document.getElementById('mbd-entrega-doc').value,
    fecha_actualizacion: new Date().toISOString(),
  };
  const { error } = id ? await _supabase.from('tesoreria_mbd').update(payload).eq('id', id) : await _supabase.from('tesoreria_mbd').insert(payload);
  if (error) { alert(error.message); return; }
  cerrarModalMBD(); cargarMBD();
}

function cerrarModalMBD() { document.getElementById('modal-container').innerHTML = ''; }

/* ── IMPORTACIÓN EXCEL CON LIMPIEZA ── */
function importarExcelMBD() { document.getElementById('mbd-file-input').click(); }

let _mbdDatosPreview = [];
function procesarImportMBD(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    _mbdDatosPreview = rows.slice(1).map((r, i) => ({
      _fila: i + 2,
      _ok: !!r[1] && !!r[4],
      empresa_id: empresa_activa.id,
      nro_operacion_bancaria: String(r[0]||''),
      fecha_deposito: r[1], 
      descripcion: String(r[2]||''),
      moneda: String(r[3]||'S/'),
      monto: parseFloat(r[4]||0),
      proveedor_empresa_personal: String(r[5]||''),
      ruc_dni: String(r[6]||''),
      entrega_doc: 'PENDIENTE'
    }));

    document.getElementById('mbd-preview-wrap').style.display = 'block';
    document.getElementById('mbd-prev-count').textContent = _mbdDatosPreview.length;
    const tbody = document.getElementById('mbd-prev-tbody');
    tbody.innerHTML = _mbdDatosPreview.slice(0, 5).map(r => `<tr><td>${r._fila}</td><td>${r.fecha_deposito}</td><td>${r.monto}</td><td>${r.moneda}</td><td>${r.proveedor_empresa_personal}</td><td>-</td><td>-</td><td>-</td><td>${r._ok?'OK':'ERR'}</td></tr>`).join('');
  };
  reader.readAsArrayBuffer(file);
}

function cancelarPreviewMBD() { document.getElementById('mbd-preview-wrap').style.display = 'none'; }

async function confirmarImportMBD() {
  const validos = _mbdDatosPreview.filter(r => r._ok);
  if (!validos.length) return;

  const btn = document.getElementById('btn-confirmar-mbd');
  btn.disabled = true; btn.textContent = 'Procesando...';

  // LIMPIEZA CRÍTICA: Quitamos campos internos y 'creado_por' para evitar Error 400
  const registros = validos.map(({ _fila, _ok, _error, creado_por, ...r }) => r);

  const CHUNK = 50;
  let ok = 0;
  for (let i = 0; i < registros.length; i += CHUNK) {
    const batch = registros.slice(i, i + CHUNK);
    const { error } = await _supabase.from('tesoreria_mbd').insert(batch);
    if (error) { console.error("Error batch:", error); } else { ok += batch.length; }
  }

  cancelarPreviewMBD();
  alert(`Se importaron ${ok} registros.`);
  cargarMBD();
}

/* ── ESTILOS Y AUXILIARES ── */
function estiloSelect() { return 'padding:6px; border:1px solid #ccc; border-radius:4px;'; }
function estiloInput() { return 'padding:6px; border:1px solid #ccc; border-radius:4px;'; }
function estiloBtnPrimario() { return 'padding:8px 16px; background:#2b6cb0; color:#fff; border:none; border-radius:4px; cursor:pointer;'; }
function estiloBtnSecundario() { return 'padding:8px 16px; background:#edf2f7; color:#2d3748; border:1px solid #cbd5e0; border-radius:4px; cursor:pointer;'; }
function estiloBtnIcono(t) { return `padding:4px 8px; background:${t==='danger'?'#fff5f5':'#ebf8ff'}; color:${t==='danger'?'#c53030':'#2b6cb0'}; border:none; cursor:pointer;`; }
function estiloCard(c) { return `background:${c}; color:#fff; padding:12px; border-radius:8px; min-width:120px;`; }
