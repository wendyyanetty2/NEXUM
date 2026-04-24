/* ============================================================
   NEXUM — Tesorería: Módulo MBD (Movimientos Bancarios Diarios)
   ============================================================ */

const CONCEPTOS_MBD = [
  '1° Quincena','2° Quincena','AFP','Almuerzo','Alquiler',
  'Banca BCP','Cena','Certificación','Cochera','Combustible',
  'Comisión','Comisión BCP','Compras','Cursos','Declaración',
  'Depositos','Desayuno','EECC BCP','EPS','Examen Medico',
  'Impuesto BCP','Liquidación','Mantenimiento BCP','NPS',
  'Pago de Prestamo','Pago de Proyecto','Pago de Servicio',
  'Peaje','Planilla De Movilidad','Prestamo','Reembolso',
  'RH','SCTR','Seguro','Servicio','SSOMA','Tramites',
  'Transporte','Ventas'
];
const EMPRESAS_MBD = [
  'AFP','Banco BCP','Club Retamas','EPA SAC','EPS',
  'ESTADO DE CUENTA','FIBRAFORTE S.A.','GEOMECANICA','Hidromedick',
  'Huaraz','Impuesto BCP','Instituto','Jesús del Norte',
  'JVÑ GENERAL SERVICES SAC','La victoria','Mall bellavista',
  'MANTENIMIENTO BCP','Medicentro','MedickCenter',
  'PEVAL CORPORATION EIRL','San Gabriel','San Juan Bautista',
  'San Pablo','Santa Martha','SUPESA','TEMPLO - SAN PABLO','Torre San Pedro'
];
const TIPOS_DOC_MBD = [
  {val:'FA',lab:'FA — Factura'},{val:'BO',lab:'BO — Boletas'},
  {val:'BP',lab:'BP — Boletas de Pago'},{val:'RH',lab:'RH — Recibo por honorarios'},
  {val:'TK',lab:'TK — Ticket'},{val:'PM',lab:'PM — Planilla de Movilidad'},
  {val:'AT',lab:'AT — App de taxi'},{val:'DL',lab:'DL — Delivery'},
  {val:'PJ',lab:'PJ — Ticket de peaje'},{val:'SB',lab:'SB — Recibo de luz/agua/gas'},
  {val:'VB',lab:'VB — Voucher de banco'},{val:'OT',lab:'OT — Comprobante sin serie legible'}
];
const AUTORIZACIONES_MBD = [
  'Johanys Valencia','Alexis Valencia','Administración',
  'Wendy Ortega','Isabel Peche','Segundo Valencia',
  'Mantenimiento BCP','Impuesto BCP','Comisión BCP','Estado de Cuenta'
];

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
        <div style="display:flex;gap:8px;">
          <button onclick="importarExcelMBD()" style="${estiloBtnSecundario()}">📂 Importar Excel</button>
          <button onclick="exportarExcelMBD()" style="${estiloBtnSecundario()}">📥 Exportar Excel</button>
          <button onclick="abrirModalMBD()" style="${estiloBtnPrimario()}">+ Nuevo movimiento</button>
        </div>
      </div>
      <div id="mbd-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="mbd-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
    <input type="file" id="mbd-file-input" accept=".xlsx,.xls" style="display:none" onchange="procesarImportMBD(this)">
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
    (r.ruc_dni||'').toLowerCase().includes(buscar)
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
        <th>Doc.</th><th>N° Doc</th><th>Estado</th><th>Autorización</th>
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
                ${CONCEPTOS_MBD.map(c=>`<option value="${c}" ${item?.concepto===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label>Empresa</label>
              <select id="mbd-empresa">
                <option value="">— Seleccionar —</option>
                ${EMPRESAS_MBD.map(e=>`<option value="${e}" ${item?.empresa===e?'selected':''}>${e}</option>`).join('')}
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
                ${AUTORIZACIONES_MBD.map(a=>`<option value="${a}" ${item?.autorizacion===a?'selected':''}>${a}</option>`).join('')}
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
              <label>Obs. 3</label>
              <input type="text" id="mbd-obs3" value="${escapar(item?.observaciones_3||'')}">
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
    observaciones_3:          document.getElementById('mbd-obs3').value.trim()||null,
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

async function procesarImportMBD(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (rows.length < 2) { mostrarToast('El archivo no tiene datos.', 'atencion'); return; }

      const toDate = v => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().slice(0,10);
        const d = new Date(v);
        return isNaN(d) ? null : d.toISOString().slice(0,10);
      };
      const toNum = v => {
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      const registros = rows.slice(1).filter(r => r[4] !== null && r[4] !== undefined).map(r => ({
        empresa_id:               empresa_activa.id,
        nro_operacion_bancaria:   r[0]?.toString()||null,
        fecha_deposito:           toDate(r[1]),
        descripcion:              r[2]?.toString()||null,
        moneda:                   r[3]?.toString()||'S/',
        monto:                    toNum(r[4]),
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
        observaciones:            r[16]?.toString()||null,
        detalles_compra_servicio: r[17]?.toString()||null,
        observaciones_2:          r[18]?.toString()||null,
        observaciones_3:          r[19]?.toString()||null,
        observaciones_4:          r[20]?.toString()||null,
        creado_por:               perfil_usuario.id,
      })).filter(r => r.fecha_deposito && r.monto !== null);

      if (!registros.length) { mostrarToast('No se encontraron filas válidas.', 'atencion'); return; }

      const { error } = await _supabase.from('tesoreria_mbd').insert(registros);
      if (error) { mostrarToast('Error al importar: ' + error.message, 'error'); return; }
      mostrarToast(`${registros.length} movimiento(s) importado(s).`, 'exito');
      cargarMBD();
    } catch(err) {
      mostrarToast('Error al leer el archivo.', 'error');
    }
  };
  reader.readAsBinaryString(file);
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

  const cabecera = ['N° Op. Bancaria','Fecha Depósito','Descripción','Moneda','Monto',
    'Proveedor/Empresa/Personal','RUC/DNI','Cotización','OC','Proyecto','Concepto','Empresa',
    'Entrega FA/DOC/RRHH','N° Factura o DOC','Tipo DOC','Autorización','Observaciones',
    'Detalles Compra/Servicio','Observaciones 2','Observaciones 3','Observaciones 4'];

  const filas = data.map(r => [
    r.nro_operacion_bancaria, r.fecha_deposito, r.descripcion, r.moneda, r.monto,
    r.proveedor_empresa_personal, r.ruc_dni, r.cotizacion, r.oc, r.proyecto, r.concepto, r.empresa,
    r.entrega_doc, r.nro_factura_doc, r.tipo_doc, r.autorizacion, r.observaciones,
    r.detalles_compra_servicio, r.observaciones_2, r.observaciones_3, r.observaciones_4
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
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
    .badge-estado-pendiente{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#D69E2E;color:#fff}
    .badge-estado-observado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#C53030;color:#fff}
    .badge-estado-emitido{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#2F855A;color:#fff}
    .badge-estado-cancelado{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#4A5568;color:#fff}
  </style>`;
}
