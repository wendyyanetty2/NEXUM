/* ============================================================
   NEXUM — Contabilidad: Registro de Ventas SUNAT (PLE)
   ============================================================ */

const TIPOS_DOC_ID_V = {'1':'DNI','4':'Carnet Extranjería','6':'RUC','7':'Pasaporte','0':'Otros'};

function renderTabVentas(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();
  const periodoActual = `${anioActual}${mesActual}`;

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="v-periodo" value="${periodoActual}" placeholder="YYYYMM"
            style="width:100px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <input type="text" id="v-buscar" placeholder="Buscar cliente, serie…"
            style="width:200px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <button onclick="cargarVentas()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="exportarExcelVentas()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar PLE</button>
          <button onclick="abrirModalVenta()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nueva venta</button>
        </div>
      </div>
      <div id="v-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="v-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  document.getElementById('v-buscar').addEventListener('keydown', e => { if(e.key==='Enter') cargarVentas(); });
  cargarVentas();
}

async function cargarVentas() {
  const periodo = document.getElementById('v-periodo')?.value.trim();
  const buscar  = document.getElementById('v-buscar')?.value.trim().toLowerCase();
  const wrap    = document.getElementById('v-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  let q = _supabase.from('contabilidad_ventas').select('*')
    .eq('empresa_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false });
  if (periodo) q = q.eq('periodo', periodo);

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  let filas = data || [];
  if (buscar) filas = filas.filter(r =>
    (r.cliente||'').toLowerCase().includes(buscar) ||
    (r.serie_cdp||'').toLowerCase().includes(buscar) ||
    (r.nro_doc_identidad||'').toLowerCase().includes(buscar)
  );

  const totalBI    = filas.reduce((s,r) => s + Number(r.bi_gravada||0), 0);
  const totalIGV   = filas.reduce((s,r) => s + Number(r.igv_ipm||0), 0);
  const totalCP    = filas.reduce((s,r) => s + Number(r.total_cp||0), 0);
  const resumen    = document.getElementById('v-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">BASE IMPONIBLE</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBI)}</div>
    </div>
    <div style="background:#2C7A7B;color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">IGV / IPM</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalIGV)}</div>
    </div>
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">TOTAL</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalCP)}</div>
    </div>
    <div style="background:#4A5568;color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">COMPROBANTES</div>
      <div style="font-size:18px;font-weight:700">${filas.length}</div>
    </div>
  `;

  if (!filas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin registros en este período.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Período</th><th>Fecha Emisión</th><th>Tipo CP</th><th>Serie</th><th>N° Inicial</th>
        <th>Tipo Doc ID</th><th>N° Documento</th><th>Cliente</th>
        <th style="text-align:right">B.I. Gravada</th>
        <th style="text-align:right">IGV/IPM</th>
        <th style="text-align:right">Total CP</th>
        <th>Moneda</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => `
          <tr>
            <td>${escapar(r.periodo)}</td>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="text-align:center">${escapar(String(r.tipo_cp_doc))}</td>
            <td>${escapar(r.serie_cdp)}</td>
            <td style="text-align:right">${escapar(String(r.nro_cp_inicial))}</td>
            <td>${escapar(TIPOS_DOC_ID_V[r.tipo_doc_identidad]||r.tipo_doc_identidad)}</td>
            <td>${escapar(r.nro_doc_identidad)}</td>
            <td>${escapar(truncar(r.cliente,28))}</td>
            <td style="text-align:right">${formatearMoneda(r.bi_gravada, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right">${formatearMoneda(r.igv_ipm, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right;font-weight:600">${formatearMoneda(r.total_cp, r.moneda==='USD'?'USD':'PEN')}</td>
            <td>${escapar(r.moneda)}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalVenta('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Editar">✏️</button>
              <button onclick="eliminarVenta('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Eliminar">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} comprobante(s)</p>
  `;
}

async function abrirModalVenta(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('contabilidad_ventas').select('*').eq('id', id).single();
    item = data;
  }
  const hoy = new Date().toISOString().slice(0,10);
  const periodo = item?.periodo || (() => { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalVenta()">
      <div class="modal" style="max-width:860px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📋 ${id?'Editar':'Nueva'} Venta — Registro PLE</h3>
          <button class="modal-cerrar" onclick="cerrarModalVenta()">✕</button>
        </div>
        <div class="modal-body">
          <div id="v-alerta" class="alerta-error"></div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del comprobante</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>RUC Empresa <span class="req">*</span></label>
              <input type="text" id="v-ruc" value="${escapar(item?.ruc||empresa_activa.ruc||'')}" maxlength="11"></div>
            <div class="campo" style="grid-column:span 2"><label>Razón Social <span class="req">*</span></label>
              <input type="text" id="v-razon" value="${escapar(item?.razon_social||empresa_activa.nombre||'')}"></div>
            <div class="campo"><label>Período <span class="req">*</span></label>
              <input type="text" id="v-periodo-m" value="${periodo}" placeholder="YYYYMM" maxlength="6"></div>
            <div class="campo"><label>CAR SUNAT</label>
              <input type="text" id="v-car" value="${escapar(item?.car_sunat||'')}"></div>
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="v-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>Fecha Vcto/Pago</label>
              <input type="date" id="v-fecha-vcto" value="${item?.fecha_vcto_pago||''}"></div>
            <div class="campo"><label>Tipo CP/Doc <span class="req">*</span></label>
              <input type="number" id="v-tipo-cp" value="${item?.tipo_cp_doc||1}" placeholder="1=FA,7=NC…"></div>
            <div class="campo"><label>Serie CDP <span class="req">*</span></label>
              <input type="text" id="v-serie" value="${escapar(item?.serie_cdp||'')}" placeholder="F001"></div>
            <div class="campo"><label>N° CP Inicial <span class="req">*</span></label>
              <input type="number" id="v-nro-ini" value="${item?.nro_cp_inicial||''}"></div>
            <div class="campo"><label>N° CP Final</label>
              <input type="number" id="v-nro-fin" value="${item?.nro_cp_final||''}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del cliente</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>Tipo Doc ID <span class="req">*</span></label>
              <select id="v-tipo-id">
                ${Object.entries(TIPOS_DOC_ID_V).map(([k,v])=>`<option value="${k}" ${(item?.tipo_doc_identidad||'6')===k?'selected':''}>${k} — ${v}</option>`).join('')}
              </select></div>
            <div class="campo"><label>N° Doc Identidad <span class="req">*</span></label>
              <input type="text" id="v-nro-id" value="${escapar(item?.nro_doc_identidad||'')}"></div>
            <div class="campo" style="grid-column:span 2"><label>Cliente <span class="req">*</span></label>
              <input type="text" id="v-cliente" value="${escapar(item?.cliente||'')}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Importes</p>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>BI Gravada <span class="req">*</span></label>
              <input type="number" id="v-bi" step="0.01" value="${item?.bi_gravada||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>IGV/IPM <span class="req">*</span></label>
              <input type="number" id="v-igv" step="0.01" value="${item?.igv_ipm||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Mto Exonerado</label>
              <input type="number" id="v-exon" step="0.01" value="${item?.mto_exonerado||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Mto Inafecto</label>
              <input type="number" id="v-inaf" step="0.01" value="${item?.mto_inafecto||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Dscto BI</label>
              <input type="number" id="v-dscto-bi" step="0.01" value="${item?.dscto_bi||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>ISC</label>
              <input type="number" id="v-isc" step="0.01" value="${item?.isc||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>ICBPER</label>
              <input type="number" id="v-icb" step="0.01" value="${item?.icbper||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Otros Tributos</label>
              <input type="number" id="v-otros" step="0.01" value="${item?.otros_tributos||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Valor Exp.</label>
              <input type="number" id="v-exp" step="0.01" value="${item?.valor_fact_exportacion||0}"></div>
            <div class="campo"><label style="font-weight:700;color:var(--color-secundario)">Total CP <span class="req">*</span></label>
              <input type="number" id="v-total" step="0.01" value="${item?.total_cp||0}" style="font-weight:600"></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="campo"><label>Moneda <span class="req">*</span></label>
              <select id="v-moneda">
                <option value="PEN" ${(item?.moneda||'PEN')==='PEN'?'selected':''}>PEN — Soles</option>
                <option value="USD" ${item?.moneda==='USD'?'selected':''}>USD — Dólares</option>
              </select></div>
            <div class="campo"><label>Tipo Cambio <span class="req">*</span></label>
              <input type="number" id="v-tc" step="0.0001" value="${item?.tipo_cambio||1}"></div>
            <div class="campo"><label>Est. Comp.</label>
              <input type="number" id="v-est" value="${item?.est_comp||1}"></div>
            <div class="campo"><label>Tipo Op.</label>
              <input type="text" id="v-tipo-op" value="${escapar(item?.tipo_operacion||'')}"></div>
          </div>

          <details style="margin-bottom:12px">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase">Doc. Modificado / Adicionales</summary>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px">
              <div class="campo"><label>Fecha Emisión Mod.</label>
                <input type="date" id="v-fecha-mod" value="${item?.fecha_emision_mod||''}"></div>
              <div class="campo"><label>Tipo CP Mod.</label>
                <input type="number" id="v-tipo-mod" value="${item?.tipo_cp_modificado||''}"></div>
              <div class="campo"><label>Serie CP Mod.</label>
                <input type="text" id="v-serie-mod" value="${escapar(item?.serie_cp_modificado||'')}"></div>
              <div class="campo"><label>N° CP Mod.</label>
                <input type="number" id="v-nro-mod" value="${item?.nro_cp_modificado||''}"></div>
              <div class="campo"><label>ID Proyecto</label>
                <input type="text" id="v-proyecto" value="${escapar(item?.id_proyecto||'')}"></div>
              <div class="campo"><label>Tipo Nota</label>
                <input type="number" id="v-tipo-nota" value="${item?.tipo_nota||''}"></div>
              <div class="campo"><label>Valor FOB</label>
                <input type="number" id="v-fob" step="0.01" value="${item?.valor_fob_embarcado||0}"></div>
              <div class="campo"><label>Valor Op. Gratuitas</label>
                <input type="number" id="v-gratuitas" step="0.01" value="${item?.valor_op_gratuitas||0}"></div>
              <div class="campo"><label>DAM/CP</label>
                <input type="text" id="v-dam" value="${escapar(item?.dam_cp||'')}"></div>
              <div class="campo"><label>CLU</label>
                <input type="text" id="v-clu" value="${escapar(item?.clu||'')}"></div>
              <div class="campo"><label>Dscto IGV/IPM</label>
                <input type="number" id="v-dscto-igv" step="0.01" value="${item?.dscto_igv_ipm||0}"></div>
              <div class="campo"><label>BI Grav. IVAP</label>
                <input type="number" id="v-ivap-bi" step="0.01" value="${item?.bi_grav_ivap||0}"></div>
              <div class="campo"><label>IVAP</label>
                <input type="number" id="v-ivap" step="0.01" value="${item?.ivap||0}"></div>
            </div>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalVenta()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarVenta('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcTotalVenta() {
  const bi    = parseFloat(document.getElementById('v-bi')?.value)||0;
  const igv   = parseFloat(document.getElementById('v-igv')?.value)||0;
  const exon  = parseFloat(document.getElementById('v-exon')?.value)||0;
  const inaf  = parseFloat(document.getElementById('v-inaf')?.value)||0;
  const isc   = parseFloat(document.getElementById('v-isc')?.value)||0;
  const icb   = parseFloat(document.getElementById('v-icb')?.value)||0;
  const otros = parseFloat(document.getElementById('v-otros')?.value)||0;
  const dscBI = parseFloat(document.getElementById('v-dscto-bi')?.value)||0;
  const total = bi + igv + exon + inaf + isc + icb + otros - dscBI;
  const el = document.getElementById('v-total');
  if (el) el.value = total.toFixed(2);
}

function cerrarModalVenta() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarVenta(id) {
  const alerta = document.getElementById('v-alerta');
  alerta.classList.remove('visible');

  const ruc    = document.getElementById('v-ruc').value.trim();
  const razon  = document.getElementById('v-razon').value.trim();
  const periodo = document.getElementById('v-periodo-m').value.trim();
  const fecha  = document.getElementById('v-fecha').value;
  const tipoCp = parseInt(document.getElementById('v-tipo-cp').value);
  const serie  = document.getElementById('v-serie').value.trim();
  const nroIni = parseInt(document.getElementById('v-nro-ini').value);
  const tipoId = document.getElementById('v-tipo-id').value;
  const nroId  = document.getElementById('v-nro-id').value.trim();
  const cliente = document.getElementById('v-cliente').value.trim();

  if (!ruc||!razon||!periodo||!fecha||isNaN(tipoCp)||!serie||isNaN(nroIni)||!tipoId||!nroId||!cliente) {
    alerta.textContent = 'Complete todos los campos requeridos (*)'; alerta.classList.add('visible'); return;
  }
  if (!/^\d{6}$/.test(periodo)) {
    alerta.textContent = 'El período debe tener formato YYYYMM (6 dígitos)'; alerta.classList.add('visible'); return;
  }

  const n = id => parseFloat(document.getElementById(id)?.value)||0;
  const payload = {
    empresa_id: empresa_activa.id,
    ruc, razon_social: razon, periodo, car_sunat: document.getElementById('v-car').value.trim()||null,
    fecha_emision: fecha,
    fecha_vcto_pago: document.getElementById('v-fecha-vcto').value||null,
    tipo_cp_doc: tipoCp, serie_cdp: serie, nro_cp_inicial: nroIni,
    nro_cp_final: parseInt(document.getElementById('v-nro-fin').value)||null,
    tipo_doc_identidad: tipoId, nro_doc_identidad: nroId, cliente,
    bi_gravada: n('v-bi'), igv_ipm: n('v-igv'), dscto_bi: n('v-dscto-bi'),
    dscto_igv_ipm: n('v-dscto-igv'), mto_exonerado: n('v-exon'), mto_inafecto: n('v-inaf'),
    isc: n('v-isc'), bi_grav_ivap: n('v-ivap-bi'), ivap: n('v-ivap'),
    icbper: n('v-icb'), otros_tributos: n('v-otros'), total_cp: n('v-total'),
    valor_fact_exportacion: n('v-exp'), valor_fob_embarcado: n('v-fob'),
    valor_op_gratuitas: n('v-gratuitas'),
    moneda: document.getElementById('v-moneda').value,
    tipo_cambio: parseFloat(document.getElementById('v-tc').value)||1,
    est_comp: parseInt(document.getElementById('v-est').value)||1,
    tipo_operacion: document.getElementById('v-tipo-op').value.trim()||null,
    fecha_emision_mod: document.getElementById('v-fecha-mod').value||null,
    tipo_cp_modificado: parseInt(document.getElementById('v-tipo-mod').value)||null,
    serie_cp_modificado: document.getElementById('v-serie-mod').value.trim()||null,
    nro_cp_modificado: parseInt(document.getElementById('v-nro-mod').value)||null,
    id_proyecto: document.getElementById('v-proyecto').value.trim()||null,
    tipo_nota: parseInt(document.getElementById('v-tipo-nota').value)||null,
    dam_cp: document.getElementById('v-dam').value.trim()||null,
    clu: document.getElementById('v-clu').value.trim()||null,
    creado_por: perfil_usuario.id,
    fecha_actualizacion: new Date().toISOString(),
  };

  let error;
  if (id) ({ error } = await _supabase.from('contabilidad_ventas').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('contabilidad_ventas').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Venta actualizada.' : 'Venta registrada.', 'exito');
  cerrarModalVenta();
  cargarVentas();
}

async function eliminarVenta(id) {
  const ok = await confirmar('¿Eliminar este comprobante de venta?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('contabilidad_ventas').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarVentas();
}

async function exportarExcelVentas() {
  const periodo = document.getElementById('v-periodo')?.value.trim();
  let q = _supabase.from('contabilidad_ventas').select('*')
    .eq('empresa_id', empresa_activa.id).order('fecha_emision');
  if (periodo) q = q.eq('periodo', periodo);
  const { data } = await q;
  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = [
    'Ruc','Razon Social','Periodo','CAR SUNAT','Fecha de emisión','Fecha Vcto/Pago',
    'Tipo CP/Doc.','Serie del CDP','Nro CP Nro Inicial (Rango)','Nro Final (Rango)',
    'Tipo Doc Identidad','Nro Doc Identidad','Apellidos Nombres/ Razón Social',
    'Valor Facturado Exportación','BI Gravada','Dscto BI','IGV / IPM','Dscto IGV / IPM',
    'Mto Exonerado','Mto Inafecto','ISC','BI Grav IVAP','IVAP','ICBPER','Otros Tributos',
    'Total CP','Moneda','Tipo Cambio','Fecha Emisión Doc Modificado','Tipo CP Modificado',
    'Serie CP Modificado','Nro CP Modificado','ID Proyecto Operadores Atribución',
    'Tipo de Nota','Est. Comp','Valor FOB Embarcado','Valor OP Gratuitas','Tipo Operación','DAM / CP','CLU'
  ];
  const filas = data.map(r => [
    r.ruc, r.razon_social, r.periodo, r.car_sunat, r.fecha_emision, r.fecha_vcto_pago,
    r.tipo_cp_doc, r.serie_cdp, r.nro_cp_inicial, r.nro_cp_final,
    r.tipo_doc_identidad, r.nro_doc_identidad, r.cliente,
    r.valor_fact_exportacion, r.bi_gravada, r.dscto_bi, r.igv_ipm, r.dscto_igv_ipm,
    r.mto_exonerado, r.mto_inafecto, r.isc, r.bi_grav_ivap, r.ivap, r.icbper, r.otros_tributos,
    r.total_cp, r.moneda, r.tipo_cambio, r.fecha_emision_mod, r.tipo_cp_modificado,
    r.serie_cp_modificado, r.nro_cp_modificado, r.id_proyecto,
    r.tipo_nota, r.est_comp, r.valor_fob_embarcado, r.valor_op_gratuitas, r.tipo_operacion, r.dam_cp, r.clu
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, `RV_${empresa_activa.nombre_corto}_${periodo||'todos'}.xlsx`);
  mostrarToast('Exportado en formato PLE.', 'exito');
}
