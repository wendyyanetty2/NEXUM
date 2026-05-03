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
          
          <!-- BOTÓN AGREGADO PARA BORRADO MASIVO -->
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

/* ── LÓGICA DEL BOTÓN DE BORRADO MASIVO ── */
async function eliminarMesMBD() {
  const mes = document.getElementById('mbd-filtro-mes')?.value;
  const anio = document.getElementById('mbd-filtro-anio')?.value;
  if (!mes || !anio) return;

  const nomMes = new Date(anio, mes - 1, 1).toLocaleString('es-PE', { month: 'long' });
  const ok = await confirmar(`¿ESTÁS SEGURO? Se eliminarán permanentemente TODOS los movimientos de ${nomMes.toUpperCase()} ${anio}.`, { 
    btnOk: 'Sí, borrar todo', 
    btnColor: '#C53030' 
  });

  if (!ok) return;

  const { error } = await _supabase.rpc('eliminar_movimientos_mensuales', { 
    p_mes: parseInt(mes), 
    p_anio: parseInt(anio) 
  });

  if (error) {
    mostrarToast('Error al eliminar: ' + error.message, 'error');
  } else {
    mostrarToast(`✓ El mes de ${nomMes} ha sido limpiado correctamente.`, 'exito');
    cargarMBD();
  }
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
    (r.nro_operacion_bancaria||'').toLowerCase().includes(buscar) ||
    (r.autorizacion||'').toLowerCase().includes(buscar) ||
    (r.proyecto||'').toLowerCase().includes(buscar) ||
    (r.observaciones||'').toLowerCase().includes(buscar) ||
    (r.observaciones_2||'').toLowerCase().includes(buscar) ||
    (r.cotizacion||'').toLowerCase().includes(buscar) ||
    (r.oc||'').toLowerCase().includes(buscar)
  );

  renderResumenMBD(filas);

  if (!filas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin movimientos en este período.</p>';
    return;
  }

  const totS = filas.filter(r => r.moneda !== 'USD').reduce((s, r) => s + Number(r.monto), 0);
  const totD = filas.filter(r => r.moneda === 'USD').reduce((s, r) => s + Number(r.monto), 0);
  const cPend = filas.filter(r => r.entrega_doc === 'PENDIENTE').length;
  const cObs  = filas.filter(r => r.entrega_doc === 'OBSERVADO').length;

  const _TH = 'padding:8px 10px;text-align:left;font-weight:600;font-size:11px;color:var(--color-texto);border-bottom:2px solid var(--color-borde);white-space:nowrap;background:var(--color-bg-card);';
  const _TD = 'padding:6px 10px;border-bottom:1px solid var(--color-borde);vertical-align:middle;';

  wrap.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap;font-size:12px;color:var(--color-texto-suave);align-items:center">
      <span><strong>${filas.length}</strong> registros</span>
      ${cPend ? `<span style="color:#C53030;font-weight:600">🔴 ${cPend} PENDIENTES</span>` : ''}
      ${cObs  ? `<span style="color:#D69E2E;font-weight:600">🟡 ${cObs} OBSERVADOS</span>` : ''}
      <span>S/ ${formatearMoneda(totS,'PEN')}</span>
      ${totD ? `<span>USD ${formatearMoneda(totD,'USD')}</span>` : ''}
    </div>
    <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
    <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          <th style="${_TH}">N° Op.</th>
          <th style="${_TH}">Fecha</th>
          <th style="${_TH}min-width:160px">Descripción</th>
          <th style="${_TH}">Mon.</th>
          <th style="${_TH}text-align:right">Monto</th>
          <th style="${_TH}min-width:180px">Proveedor / Empresa / Personal</th>
          <th style="${_TH}">RUC / DNI</th>
          <th style="${_TH}">COTIZACIÓN</th>
          <th style="${_TH}">OC</th>
          <th style="${_TH}min-width:120px">Proyecto</th>
          <th style="${_TH}">Concepto</th>
          <th style="${_TH}min-width:140px">Empresa</th>
          <th style="${_TH}min-width:95px">Estado DOC</th>
          <th style="${_TH}">Nª Factura/DOC</th>
          <th style="${_TH}">Tipo DOC</th>
          <th style="${_TH}">Autorización</th>
          <th style="${_TH}min-width:140px">Observaciones</th>
          <th style="${_TH}min-width:140px">Detalles Compra/Serv.</th>
          <th style="${_TH}min-width:120px">Obs. 2</th>
          <th style="${_TH}text-align:center">Acc.</th>
        </tr>
      </thead>
      <tbody>
        ${filas.map(r => {
          const est = r.entrega_doc || 'PENDIENTE';
          const rowStyle = {
            PENDIENTE: 'background:rgba(197,48,48,.06);border-left:3px solid #C53030',
            OBSERVADO:  'background:rgba(214,158,46,.07);border-left:3px solid #D69E2E',
            EMITIDO:    'background:rgba(47,133,90,.04);border-left:3px solid #2F855A',
            CANCELADO:  'background:rgba(74,85,104,.05);border-left:3px solid #718096;opacity:.75',
          }[est] || '';
          const badgeBg = { PENDIENTE:'#C53030', OBSERVADO:'#D69E2E', EMITIDO:'#2F855A', CANCELADO:'#718096' }[est] || '#718096';
          return `<tr style="${rowStyle}" onmouseover="this.style.filter='brightness(.96)'" onmouseout="this.style.filter=''">
            <td style="${_TD}font-family:monospace;font-size:11px">${escapar(r.nro_operacion_bancaria||'—')}</td>
            <td style="${_TD}white-space:nowrap">${formatearFecha(r.fecha_deposito)}</td>
            <td style="${_TD}font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.descripcion||'')}">${escapar(r.descripcion||'—')}</td>
            <td style="${_TD}text-align:center">${escapar(r.moneda||'S/')}</td>
            <td style="${_TD}text-align:right;font-weight:700;color:${r.monto>=0?'var(--color-exito)':'var(--color-critico)'};white-space:nowrap">${formatearMoneda(r.monto, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="${_TD}max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.proveedor_empresa_personal||'')}">${escapar(r.proveedor_empresa_personal||'—')}</td>
            <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(r.ruc_dni||'—')}</td>
            <td style="${_TD}font-size:11px">${escapar(r.cotizacion||'—')}</td>
            <td style="${_TD}font-size:11px">${escapar(r.oc||'—')}</td>
            <td style="${_TD}font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.proyecto||'')}">${escapar(r.proyecto||'—')}</td>
            <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(r.concepto||'—')}</td>
            <td style="${_TD}font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.empresa||'')}">${escapar(r.empresa||'—')}</td>
            <td style="${_TD}"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${badgeBg};color:#fff;white-space:nowrap">${est}</span></td>
            <td style="${_TD}font-family:monospace;font-size:11px;white-space:nowrap">${escapar(r.nro_factura_doc||'—')}</td>
            <td style="${_TD}text-align:center"><span style="background:var(--color-secundario);color:#fff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:600">${escapar(r.tipo_doc||'—')}</span></td>
            <td style="${_TD}font-size:11px;white-space:nowrap">${escapar(r.autorizacion||'—')}</td>
            <td style="${_TD}font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.observaciones||'')}">${escapar(r.observaciones||'—')}</td>
            <td style="${_TD}font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.detalles_compra_servicio||'')}">${escapar(r.detalles_compra_servicio||'—')}</td>
            <td style="${_TD}font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapar(r.observaciones_2||'')}">${escapar(r.observaciones_2||'—')}</td>
            <td style="${_TD}text-align:center;white-space:nowrap">
              <button onclick="abrirModalMBD('${r.id}')" style="${estiloBtnIcono()}" title="Editar">✏️</button>
              <button onclick="_abrirModalDividirMBD('${r.id}')" style="padding:4px 7px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Dividir en comprobantes">✂️</button>
              <button onclick="eliminarMBD('${r.id}')" style="${estiloBtnIcono('danger')}" title="Eliminar">🗑️</button>
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

/* ── Dividir transferencia en N comprobantes (1→N) ──────────── */
let _dividirOriginal = null;
let _dividirFilas    = [];

async function _abrirModalDividirMBD(id) {
  const { data: r, error } = await _supabase.from('tesoreria_mbd').select('*').eq('id', id).single();
  if (error || !r) { mostrarToast('No se pudo cargar el movimiento.', 'error'); return; }
  _dividirOriginal = r;
  _dividirFilas = [
    { tipodoc: r.tipo_doc || '', nrodoc: r.nro_factura_doc || '', proveedor: r.proveedor_empresa_personal || '', ruc: r.ruc_dni || '', monto: '' },
    { tipodoc: '', nrodoc: '', proveedor: '', ruc: '', monto: '' },
  ];
  _renderModalDividir();
}

function _guardarFilasDividir() {
  _dividirFilas.forEach((f, i) => {
    f.tipodoc   = document.getElementById(`div-tipo-${i}`)?.value   || '';
    f.nrodoc    = (document.getElementById(`div-nro-${i}`)?.value   || '').trim();
    f.proveedor = (document.getElementById(`div-prov-${i}`)?.value  || '').trim();
    f.ruc       = (document.getElementById(`div-ruc-${i}`)?.value   || '').trim();
    f.monto     = document.getElementById(`div-monto-${i}`)?.value  || '';
  });
}

function _addFilaDividir() {
  _guardarFilasDividir();
  _dividirFilas.push({ tipodoc: '', nrodoc: '', proveedor: '', ruc: '', monto: '' });
  _renderModalDividir();
}

function _removeFilaDividir(i) {
  if (_dividirFilas.length <= 2) return;
  _guardarFilasDividir();
  _dividirFilas.splice(i, 1);
  _renderModalDividir();
}

function _actualizarSumaDividir() {
  if (!_dividirOriginal) return;
  const montoOrig = Number(_dividirOriginal.monto);
  const moneda    = _dividirOriginal.moneda === 'USD' ? 'USD' : 'PEN';
  let suma = 0;
  _dividirFilas.forEach((_, i) => { suma += parseFloat(document.getElementById(`div-monto-${i}`)?.value || 0); });
  suma = Math.round(suma * 100) / 100;
  const diff = Math.round((montoOrig - suma) * 100) / 100;
  const ok   = Math.abs(diff) < 0.01;

  const sumEl = document.getElementById('div-suma-info');
  const btnEl = document.getElementById('btn-div-confirmar');
  if (sumEl) {
    if (ok) {
      sumEl.innerHTML = `<span style="color:var(--color-exito);font-weight:700">✅ Suma: ${formatearMoneda(suma, moneda)} = transferencia original</span>`;
    } else if (suma > montoOrig) {
      sumEl.innerHTML = `<span style="color:var(--color-critico);font-weight:700">⚠️ Suma: ${formatearMoneda(suma, moneda)} — excede ${formatearMoneda(Math.abs(diff), moneda)} el total</span>`;
    } else {
      sumEl.innerHTML = `<span style="color:var(--color-atencion);font-weight:700">⏳ Suma: ${formatearMoneda(suma, moneda)} — faltan ${formatearMoneda(diff, moneda)}</span>`;
    }
  }
  if (btnEl) {
    btnEl.disabled = !ok;
    btnEl.textContent = ok
      ? `✂️ Confirmar división (${_dividirFilas.length} comprobantes)`
      : `✂️ Confirmar división`;
  }
}

function _renderModalDividir() {
  const r        = _dividirOriginal;
  const moneda  = r.moneda === 'USD' ? 'USD' : 'PEN';
  const n        = _dividirFilas.length;

  const mc = document.getElementById('modal-container');
  if (!mc) return;
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarModalDividir()">
      <div class="modal" style="max-width:720px;width:95%;max-height:92vh;overflow-y:auto">
        <div class="modal-header">
          <h3>✂️ Dividir transferencia en comprobantes</h3>
          <button class="modal-cerrar" onclick="_cerrarModalDividir()">✕</button>
        </div>
        <div class="modal-body">

          <!-- Banner transferencia original -->
          <div style="margin-bottom:16px;padding:12px 16px;background:rgba(44,82,130,.08);border-radius:8px;border-left:4px solid var(--color-secundario);display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px">Transferencia original</div>
              <span style="font-family:monospace;font-weight:700">${escapar(r.nro_operacion_bancaria || '—')}</span>
              <span style="margin-left:8px;font-size:12px;color:var(--color-texto-suave)">${formatearFecha(r.fecha_deposito)}</span>
              ${r.descripcion ? `<span style="margin-left:8px;font-size:12px">${escapar(r.descripcion)}</span>` : ''}
            </div>
            <strong style="font-size:20px;color:var(--color-exito)">${formatearMoneda(Number(r.monto), moneda)}</strong>
          </div>

          <div style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px;padding:8px 12px;background:rgba(214,158,46,.08);border-radius:6px;border-left:3px solid var(--color-atencion)">
            💡 La suma de los montos debe ser exactamente igual al total de la transferencia. Se eliminará la fila original y se crearán las filas por comprobante.
          </div>

          <!-- Filas de comprobantes -->
          ${_dividirFilas.map((f, i) => `
            <div style="background:var(--color-bg);border:1px solid var(--color-borde);border-radius:8px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-size:12px;font-weight:700;color:var(--color-texto-suave);text-transform:uppercase;letter-spacing:.5px">
                  📄 Comprobante ${i + 1}
                </span>
                ${n > 2 ? `<button onclick="_removeFilaDividir(${i})" style="background:none;border:none;cursor:pointer;color:var(--color-critico);font-size:18px;line-height:1;padding:2px 4px" title="Quitar">✕</button>` : ''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="campo" style="margin:0">
                  <label>Tipo de DOC <span style="color:var(--color-critico)">*</span></label>
                  <select id="div-tipo-${i}" onchange="_actualizarSumaDividir()">
                    <option value="">— Seleccionar —</option>
                    ${TIPOS_DOC_MBD.map(t => `<option value="${t.val}" ${f.tipodoc === t.val ? 'selected' : ''}>${t.lab}</option>`).join('')}
                  </select>
                </div>
                <div class="campo" style="margin:0">
                  <label>N° Comprobante <span style="color:var(--color-critico)">*</span></label>
                  <input type="text" id="div-nro-${i}" value="${escapar(f.nrodoc)}" placeholder="Ej: E001-17, 001-10-25">
                </div>
                <div class="campo" style="margin:0">
                  <label>Monto (${moneda}) <span style="color:var(--color-critico)">*</span></label>
                  <input type="number" id="div-monto-${i}" value="${escapar(String(f.monto))}" placeholder="0.00" step="0.01" min="0.01" oninput="_actualizarSumaDividir()" style="text-align:right">
                </div>
                <div class="campo" style="margin:0;grid-column:span 2">
                  <label>Proveedor / Trabajador / Personal</label>
                  <input type="text" id="div-prov-${i}" value="${escapar(f.proveedor)}" placeholder="Nombre completo">
                </div>
                <div class="campo" style="margin:0">
                  <label>DNI / RUC</label>
                  <input type="text" id="div-ruc-${i}" value="${escapar(f.ruc)}" placeholder="Documento de identidad">
                </div>
              </div>
            </div>`).join('')}

          <button onclick="_addFilaDividir()" style="${estiloBtnSecundario()};width:100%;margin-bottom:14px;font-size:13px">
            + Agregar comprobante
          </button>

          <!-- Indicador de suma -->
          <div id="div-suma-info" style="text-align:center;padding:10px 14px;border-radius:6px;background:var(--color-bg);font-size:13px;margin-bottom:4px">
            <span style="color:var(--color-texto-suave)">Ingresa los montos para verificar la suma</span>
          </div>

          <div id="div-alerta" class="alerta-error"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="_cerrarModalDividir()">Cancelar</button>
          <button class="btn btn-primario" id="btn-div-confirmar" disabled onclick="_confirmarDividirMBD()">
            ✂️ Confirmar división
          </button>
        </div>
      </div>
    </div>`;

  _actualizarSumaDividir();
}

function _cerrarModalDividir() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
  _dividirOriginal = null;
  _dividirFilas    = [];
}

async function _confirmarDividirMBD() {
  _guardarFilasDividir();
  const r      = _dividirOriginal;
  const alerta = document.getElementById('div-alerta');
  const btn    = document.getElementById('btn-div-confirmar');
  const moneda = r.moneda === 'USD' ? 'USD' : 'PEN';
  const n      = _dividirFilas.length;

  // Validar cada fila
  for (let i = 0; i < n; i++) {
    const f = _dividirFilas[i];
    if (!f.tipodoc) {
      if (alerta) { alerta.textContent = `Comprobante ${i+1}: selecciona el tipo de documento.`; alerta.classList.add('visible'); }
      return;
    }
    if (!f.nrodoc) {
      if (alerta) { alerta.textContent = `Comprobante ${i+1}: ingresa el número del comprobante.`; alerta.classList.add('visible'); }
      return;
    }
    if (!parseFloat(f.monto) || parseFloat(f.monto) <= 0) {
      if (alerta) { alerta.textContent = `Comprobante ${i+1}: ingresa un monto válido mayor a cero.`; alerta.classList.add('visible'); }
      return;
    }
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }

  // Construir las N filas hijas
  const nuevasFilas = _dividirFilas.map((f, i) => ({
    empresa_id:                 r.empresa_id,
    nro_operacion_bancaria:     r.nro_operacion_bancaria,
    fecha_deposito:             r.fecha_deposito,
    moneda:                     r.moneda,
    monto:                      parseFloat(f.monto),
    descripcion:                (r.descripcion || '') + (n > 1 ? ` (${i+1}/${n})` : ''),
    proveedor_empresa_personal: f.proveedor || r.proveedor_empresa_personal || null,
    ruc_dni:                    f.ruc || null,
    tipo_doc:                   f.tipodoc,
    nro_factura_doc:            f.nrodoc,
    entrega_doc:                'EMITIDO',
    concepto:                   r.concepto,
    empresa:                    r.empresa,
    proyecto:                   r.proyecto,
    autorizacion:               r.autorizacion,
    cotizacion:                 r.cotizacion,
    oc:                         r.oc,
    observaciones:              r.observaciones,
    detalles_compra_servicio:   r.detalles_compra_servicio,
    observaciones_2:            r.observaciones_2,
    fecha_actualizacion:        new Date().toISOString(),
  }));

  // 1. Insertar las filas nuevas
  const { error: errIns } = await _supabase.from('tesoreria_mbd').insert(nuevasFilas);
  if (errIns) {
    if (alerta) { alerta.textContent = 'Error al crear los comprobantes: ' + errIns.message; alerta.classList.add('visible'); }
    if (btn) { btn.disabled = false; btn.textContent = `✂️ Confirmar división (${n} comprobantes)`; }
    return;
  }

  // 2. Eliminar la fila original
  const { error: errDel } = await _supabase.from('tesoreria_mbd').delete().eq('id', r.id);
  if (errDel) {
    mostrarToast('Comprobantes creados, pero hubo un error al eliminar la fila original. Revisa duplicados.', 'atencion');
    _cerrarModalDividir();
    cargarMBD();
    return;
  }

  mostrarToast(`✅ Transferencia dividida en ${n} comprobantes registrados como EMITIDO.`, 'exito');
  _cerrarModalDividir();
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
      const esTieneEncabezado = cabeceras.some(h =>
        ['fecha', 'monto', 'fecha depósito', 'fecha deposito', 'n° de operación', 'n° operacion', 'descripcion'].includes(h)
      );
      const inicio = esTieneEncabezado ? 1 : 0;

      // Detectar formato con Medio de Pago (col 16) según cabecera, no por cantidad de cols
      // (el archivo exportado tiene 21 cols pero NO tiene Medio de Pago — col 16 = Observaciones)
      const formatoNuevo = cabeceras.some(h => h.includes('medio'));

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

  // Excluir campos internos, observaciones_3 y creado_por (no existen en tesoreria_mbd)
  const registros = validos.map(({ _fila, _ok, _error, observaciones_3, creado_por, ...r }) => r);
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

  // Columnas exactas del Excel REGISTRO (21 columnas, compatible con macro .xlsm)
  const cabecera = [
    'N° de operación','Fecha de Deposito','Descripcion','Moneda','Monto',
    'Proveedores / Empresa / Personal','RUC / DNI','COTIZACIÓN','OC','Proyecto',
    'Concepto','Empresa','Entrega de FA / DOC / RRHH','Nª Factura o DOC.',
    'Tipo de DOC','Autorización','Observaciones','Detalles Compra / Servicio',
    'Observaciones 2','Fecha de registro','Usuario',
  ];

  const _fmtFecha = iso => {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const filas = data.map(r => [
    r.nro_operacion_bancaria ? String(r.nro_operacion_bancaria).padStart(8,'0') : null,
    _fmtFecha(r.fecha_deposito),
    r.descripcion || null,
    r.moneda || 'S/',
    r.monto,
    r.proveedor_empresa_personal || null,
    r.ruc_dni || null,
    r.cotizacion || null,
    r.oc || null,
    r.proyecto || null,
    r.concepto || null,
    r.empresa || null,
    r.entrega_doc || 'PENDIENTE',
    r.nro_factura_doc || null,
    r.tipo_doc || null,
    r.autorizacion || null,
    r.observaciones || null,
    r.detalles_compra_servicio || null,
    r.observaciones_2 || null,
    _fmtFecha(r.fecha_creacion || r.fecha_actualizacion),
    perfil_usuario?.nombre || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  // Forzar N° Op y Fecha como texto para preservar formato exacto
  filas.forEach((_, rowIdx) => {
    const r = rowIdx + 1;
    [0, 1, 19].forEach(c => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) ws[cellRef].t = 's';
    });
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO');
  const nombreArchivo = `MBD_${empresa_activa.nombre_corto || empresa_activa.nombre}_${anio}${mes}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
  mostrarToast(`✓ Exportado: ${nombreArchivo}`, 'exito');
}

/* ── Panel PENDIENTES inteligente ─────────────────────────── */
async function renderPanelPendientesMBD() {
  const mes   = document.getElementById('mbd-filtro-mes')?.value;
  const anio  = document.getElementById('mbd-filtro-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const wrap = document.getElementById('mbd-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Analizando PENDIENTES…</span></div>';

  const { data, error } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .eq('entrega_doc', 'PENDIENTE')
    .gte('fecha_deposito', desde)
    .lte('fecha_deposito', hasta)
    .order('proveedor_empresa_personal')
    .order('fecha_deposito');

  if (error) { wrap.innerHTML = `<p style="color:#C53030;padding:20px">Error: ${escapar(error.message)}</p>`; return; }
  const filas = data || [];

  if (!filas.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:48px;color:var(--color-texto-suave)">
        <div style="font-size:48px;margin-bottom:12px">✅</div>
        <p style="font-weight:500;font-size:16px">¡Sin movimientos PENDIENTES en este período!</p>
        <button onclick="cargarMBD()" style="${estiloBtnSecundario()};margin-top:12px">← Volver al registro</button>
      </div>`;
    return;
  }

  // Agrupar por proveedor + RUC
  const grupos = {};
  filas.forEach(r => {
    const key = (r.proveedor_empresa_personal || 'SIN NOMBRE').trim() + '||' + (r.ruc_dni || '').trim();
    if (!grupos[key]) grupos[key] = {
      proveedor: r.proveedor_empresa_personal || 'SIN NOMBRE',
      ruc: r.ruc_dni || '',
      items: [],
    };
    grupos[key].items.push(r);
  });

  const totalGeneral = filas.reduce((s, r) => s + Number(r.monto), 0);
  const listaGrupos  = Object.values(grupos).sort((a, b) => a.items.length < b.items.length ? 1 : -1);

  _pendientesGrupos = {};
  listaGrupos.forEach((g, gi) => { _pendientesGrupos[`grp-${gi}`] = g; });

  wrap.innerHTML = `
    <div style="margin-bottom:16px;padding:14px 16px;background:rgba(197,48,48,.08);border-radius:8px;border-left:4px solid #C53030;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <strong style="color:#C53030;font-size:14px">🔴 ${filas.length} movimientos PENDIENTES</strong>
        <span style="margin-left:8px;font-size:12px;color:var(--color-texto-suave)">en ${listaGrupos.length} proveedor(es)</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <strong style="font-size:14px">Total: ${formatearMoneda(totalGeneral, 'PEN')}</strong>
        <button onclick="cargarMBD()" style="${estiloBtnSecundario()};font-size:12px;padding:6px 12px">← Volver al REGISTRO</button>
      </div>
    </div>

    ${listaGrupos.map((g, gi) => {
      const total      = g.items.reduce((s, r) => s + Number(r.monto), 0);
      const esMultiple = g.items.length > 1;
      const idGrupo   = `grp-${gi}`;
      return `
      <div style="border:1px solid ${esMultiple ? '#C53030' : 'var(--color-borde)'};border-radius:8px;margin-bottom:12px;overflow:hidden">
        <div style="background:${esMultiple ? 'rgba(197,48,48,.06)' : 'var(--color-bg-card)'};padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="font-size:13px">${escapar(g.proveedor)}</strong>
            ${g.ruc ? `<code style="font-size:11px;background:var(--color-fondo-alt,#F7FAFC);padding:2px 6px;border-radius:4px">${escapar(g.ruc)}</code>` : ''}
            ${esMultiple ? `<span style="font-size:11px;background:#C53030;color:#fff;padding:2px 8px;border-radius:8px;font-weight:600">⚠️ ${g.items.length} transferencias</span>` : ''}
          </div>
          <strong style="font-size:13px;color:${total < 0 ? 'var(--color-critico)' : 'var(--color-exito)'}">${formatearMoneda(total, 'PEN')}</strong>
        </div>

        ${esMultiple ? `
        <div style="padding:10px 16px;background:rgba(214,158,46,.06);border-top:1px solid var(--color-borde);font-size:12px;color:var(--color-texto)">
          💡 <strong>${g.items.length} transferencias</strong> a este proveedor suman <strong>${formatearMoneda(total, 'PEN')}</strong> → ¿Corresponden todas a 1 comprobante?
        </div>` : ''}

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--color-bg-card)">
                <th style="padding:6px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">N° Op.</th>
                <th style="padding:6px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">Fecha</th>
                <th style="padding:6px 10px;text-align:right;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">Monto</th>
                <th style="padding:6px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">Descripción</th>
                <th style="padding:6px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">Concepto</th>
                <th style="padding:6px 10px;text-align:left;font-weight:600;font-size:11px;border-bottom:1px solid var(--color-borde)">Obs. 2</th>
              </tr>
            </thead>
            <tbody>
              ${g.items.map(r => `
                <tr style="border-top:1px solid var(--color-borde)">
                  <td style="padding:6px 10px;font-family:monospace;font-size:11px">${escapar(r.nro_operacion_bancaria || '—')}</td>
                  <td style="padding:6px 10px;white-space:nowrap">${formatearFecha(r.fecha_deposito)}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:600;color:${r.monto < 0 ? 'var(--color-critico)' : 'var(--color-exito)'};white-space:nowrap">${formatearMoneda(r.monto, 'PEN')}</td>
                  <td style="padding:6px 10px;font-size:11px">${escapar(r.descripcion || '—')}</td>
                  <td style="padding:6px 10px;white-space:nowrap">${escapar(r.concepto || '—')}</td>
                  <td style="padding:6px 10px;font-size:11px;color:var(--color-texto-suave)">${escapar(r.observaciones_2 || '—')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--color-borde);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${esMultiple ? `
          <span style="font-size:12px;color:var(--color-texto-suave)">Vincular ${g.items.length} transferencias a 1 comprobante:</span>
          <button onclick="_abrirModalConciliacionMBD('${idGrupo}',[${g.items.map(r => `'${r.id}'`).join(',')}])"
            style="${estiloBtnPrimario()};padding:5px 14px;font-size:12px">
            🔗 Vincular ${g.items.length} transferencias
          </button>` : `
          <button onclick="_abrirModalConciliacionMBD('${idGrupo}',[${g.items.map(r => `'${r.id}'`).join(',')}])" style="${estiloBtnPrimario()};padding:5px 14px;font-size:12px">🔗 Conciliar</button>
          <button onclick="abrirModalMBD('${g.items[0].id}')" style="${estiloBtnSecundario()};padding:5px 12px;font-size:12px">✏️ Editar</button>`}
        </div>
      </div>`;
    }).join('')}
  `;
}

function _abrirModalConciliacionMBD(idGrupo, ids) {
  const g = _pendientesGrupos[idGrupo];
  if (!g) return;
  const total = g.items.reduce((s, r) => s + Number(r.monto), 0);
  const idsJson = JSON.stringify(ids);

  const mc = document.getElementById('modal-container');
  if (!mc) return;
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarModalConciliacion()">
      <div class="modal" style="max-width:640px;width:95%;max-height:92vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🔗 Confirmar vinculación de comprobante</h3>
          <button class="modal-cerrar" onclick="_cerrarModalConciliacion()">✕</button>
        </div>
        <div class="modal-body">

          <div style="margin-bottom:14px;padding:10px 14px;background:rgba(197,48,48,.07);border-radius:8px;border-left:4px solid #C53030;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span style="font-size:13px"><strong>${g.items.length} transferencia(s)</strong> serán vinculadas al comprobante</span>
            <strong style="font-size:14px;color:var(--color-exito)">${formatearMoneda(total, 'PEN')}</strong>
          </div>

          <div style="overflow-x:auto;max-height:160px;overflow-y:auto;margin-bottom:18px;border:1px solid var(--color-borde);border-radius:6px">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:var(--color-bg-card)">
                <th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:600;border-bottom:1px solid var(--color-borde)">N° Op.</th>
                <th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:600;border-bottom:1px solid var(--color-borde)">Fecha</th>
                <th style="padding:6px 10px;text-align:right;font-size:11px;font-weight:600;border-bottom:1px solid var(--color-borde)">Monto</th>
                <th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:600;border-bottom:1px solid var(--color-borde)">Descripción</th>
              </tr></thead>
              <tbody>
                ${g.items.map(r => `
                  <tr style="border-top:1px solid var(--color-borde)">
                    <td style="padding:5px 10px;font-family:monospace;font-size:11px">${escapar(r.nro_operacion_bancaria || '—')}</td>
                    <td style="padding:5px 10px;white-space:nowrap">${formatearFecha(r.fecha_deposito)}</td>
                    <td style="padding:5px 10px;text-align:right;font-weight:600;color:var(--color-exito);white-space:nowrap">${formatearMoneda(r.monto, 'PEN')}</td>
                    <td style="padding:5px 10px;font-size:11px;color:var(--color-texto-suave)">${escapar(r.descripcion || '—')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="campo">
              <label>Proveedor / Personal</label>
              <input type="text" id="conc-proveedor" value="${escapar(g.proveedor || '')}" placeholder="Nombre del proveedor">
            </div>
            <div class="campo">
              <label>RUC / DNI</label>
              <input type="text" id="conc-ruc" value="${escapar(g.ruc || '')}" placeholder="RUC o DNI">
            </div>
            <div class="campo">
              <label>Tipo de DOC <span style="color:#C53030">*</span></label>
              <select id="conc-tipo-doc">
                <option value="">— Seleccionar —</option>
                ${TIPOS_DOC_MBD.map(t => `<option value="${t.val}">${t.lab}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>N° Factura / Comprobante <span style="color:#C53030">*</span></label>
              <input type="text" id="conc-nro-doc" placeholder="Ej: F001-00123, E001-17">
            </div>
            <div class="campo" style="grid-column:span 2">
              <label>Estado FA/DOC/RH</label>
              <select id="conc-estado-doc">
                <option value="EMITIDO" selected>✅ EMITIDO — documento recibido y registrado</option>
                <option value="OBSERVADO">⚠️ OBSERVADO — pendiente de revisión</option>
              </select>
            </div>
          </div>
          <div id="conc-alerta" class="alerta-error" style="margin-top:10px"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="_cerrarModalConciliacion()">Cancelar</button>
          <button class="btn btn-primario" id="btn-conc-confirmar"
            onclick="_vincularGrupoMBD(${idsJson})">
            ✅ Confirmar vinculación (${ids.length} registro${ids.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>`;
}

function _cerrarModalConciliacion() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _vincularGrupoMBD(ids) {
  const tipoDoc   = document.getElementById('conc-tipo-doc')?.value;
  const nroDoc    = (document.getElementById('conc-nro-doc')?.value || '').trim();
  const estado    = document.getElementById('conc-estado-doc')?.value || 'EMITIDO';
  const proveedor = (document.getElementById('conc-proveedor')?.value || '').trim();
  const rucDni    = (document.getElementById('conc-ruc')?.value || '').trim();
  const alerta    = document.getElementById('conc-alerta');

  if (!nroDoc) {
    if (alerta) { alerta.textContent = 'Ingresa el N° de factura o comprobante.'; alerta.classList.add('visible'); }
    return;
  }
  if (!tipoDoc) {
    if (alerta) { alerta.textContent = 'Selecciona el tipo de documento.'; alerta.classList.add('visible'); }
    return;
  }

  const btn = document.getElementById('btn-conc-confirmar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const patch = {
    nro_factura_doc:            nroDoc,
    tipo_doc:                   tipoDoc,
    entrega_doc:                estado,
    fecha_actualizacion:        new Date().toISOString(),
  };
  if (proveedor) patch.proveedor_empresa_personal = proveedor;
  if (rucDni)    patch.ruc_dni                    = rucDni;

  const { error } = await _supabase.from('tesoreria_mbd').update(patch).in('id', ids);
  if (btn) { btn.disabled = false; btn.textContent = `✅ Confirmar vinculación (${ids.length} registro${ids.length !== 1 ? 's' : ''})`; }

  if (error) {
    if (alerta) { alerta.textContent = 'Error al vincular: ' + error.message; alerta.classList.add('visible'); }
    return;
  }

  mostrarToast(`✓ ${ids.length} transferencia(s) vinculadas a ${tipoDoc} ${nroDoc}`, 'exito');
  _cerrarModalConciliacion();
  renderPanelPendientesMBD();
}

/* ── Helpers de estilo ─────────────────────────────────────── */
function estiloSelect() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloInput() {
  return 'padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)';
}
function estiloBtnPrimario() {
  return 'padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500';
}
function estiloBtnSecundario() {
  return 'padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px';
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
    .badge-estado-pendiente{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#C53030;color:#fff}
    .badge-estado-observado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#D69E2E;color:#fff}
    .badge-estado-emitido{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#2F855A;color:#fff}
    .badge-estado-cancelado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#718096;color:#fff}
  </style>`;
}
