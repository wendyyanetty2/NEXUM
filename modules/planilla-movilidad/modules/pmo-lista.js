// ═══════════════════════════════════════════════════════════════
// Planilla de Movilidad — Tab Listado
// ═══════════════════════════════════════════════════════════════

// ── Catálogos constantes ──────────────────────────────────────────
const PM_TRABAJADORES = [
  { nombre: 'Segundo Alexis Valencia Ñañez',      dni: '73093007' },
  { nombre: 'Jorge Samuel Segura Ramos',           dni: '74918847' },
  { nombre: 'Jeiber Vargas Tuesta',                dni: '73766403' },
  { nombre: 'Segundo Jacobo Valencia Lozada',      dni: '16752234' },
  { nombre: 'Edver Johanys Valencia Ñañez',        dni: '73093007' },
  { nombre: 'Jose Augusto Fernandez Lozada',       dni: '17622309' },
  { nombre: 'Jhon Kenedi Romaina Tangoa',          dni: '60128333' },
  { nombre: 'Jose Alfonso Cornejo Quispitongo',    dni: '16735292' },
  { nombre: 'Manuel Luis Lizarraga Lizarraga',     dni: '40492603' },
  { nombre: 'Wendy Jannette Karina Ortega Gutierrez', dni: '75130993' },
];

const PM_MOTIVOS = [
  'Desplazamiento por servicio a ejecutar',
  'Compra de materiales',
  'Desplazamiento a reuniones con clientes',
  'Desplazamiento a reuniones o proveedores',
  'Traslado para entrega de documentos',
  'Traslado para recepción de documentos',
  'Trámites administrativos',
  'Visitas Técnicas',
];

const PM_DISTRITOS = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Cercado de Lima',
  'Chaclacayo','Chorrillos','Cieneguilla','Comas','El Agustino',
  'Independencia','Jesús María','La Molina','La Victoria','Lince',
  'Los Olivos','Lurigancho','Lurín','Magdalena del Mar','Miraflores',
  'Pachacámac','Pucusana','Pueblo Libre','Puente Piedra','Punta Hermosa',
  'Punta Negra','Rímac','San Bartolo','San Borja','San Isidro',
  'San Juan de Lurigancho','San Juan de Miraflores','San Luis',
  'San Martín de Porres','San Miguel','Santa Anita','Santa María del Mar',
  'Santa Rosa','Santiago de Surco','Surquillo','Villa El Salvador',
  'Villa María del Triunfo','Ventanilla','Callao',
];

const PM_PROYECTOS = [
  'Mall Bellavista','Clínica La Victoria','Clínica San Pablo',
  'Clínica San Gabriel','Clinica Santa Martha','Clinica San Juan Bautista',
  'Clinica Jesus del Norte','Instituto San Pablo','Clínica San Pablo - Huaraz',
  'Supermercados Peruanos','Torre - San Pablo','JVÑ GENERAL SERVICES SAC',
];

const PM_ESTADOS_COLOR = {
  BORRADOR: { bg:'#718096', label:'BORRADOR' },
  ENVIADO:  { bg:'#2C5282', label:'ENVIADO'  },
  APROBADO: { bg:'#276749', label:'APROBADO' },
};

// ── Render principal del listado ──────────────────────────────────
async function renderTabLista(area) {
  const hoy  = new Date();
  const mesD = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  area.innerHTML = `
    <div class="fadeIn">
      <!-- Barra acciones -->
      <div id="pm-barra-acciones" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <h3 style="margin:0;font-size:15px">Planillas registradas</h3>
        <button onclick="activarTab('pm-nueva')"
          style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">
          ➕ Nueva planilla
        </button>
      </div>

      <!-- Filtros -->
      <div id="pm-filtros" class="card" style="margin-bottom:16px;padding:14px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;align-items:end">
          <div>
            <label class="label-filtro">Mes</label>
            <input type="month" id="pml-mes" value="${mesD}" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Trabajador</label>
            <select id="pml-trabajador" class="input-buscar w-full">
              <option value="">Todos</option>
              ${PM_TRABAJADORES.map(t => `<option value="${t.dni}">${escapar(t.nombre.split(' ').slice(0,2).join(' '))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="pml-estado" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ENVIADO">Enviado</option>
              <option value="APROBADO">Aprobado</option>
            </select>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="cargarListaPlanillas()" class="btn btn-primario w-full">🔍 Filtrar</button>
            <button onclick="_pmlLimpiarFiltros()" class="btn btn-secundario" title="Limpiar">✕</button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card" style="padding:0;overflow:hidden">
        <div id="pml-tabla-wrap">
          <div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando…</span></div>
        </div>
      </div>
    </div>`;

  await cargarListaPlanillas();
}

function _pmlLimpiarFiltros() {
  const hoy = new Date();
  const el = document.getElementById('pml-mes');
  if (el) el.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const et = document.getElementById('pml-trabajador');
  if (et) et.value = '';
  const ee = document.getElementById('pml-estado');
  if (ee) ee.value = '';
  cargarListaPlanillas();
}

async function cargarListaPlanillas() {
  const wrap = document.getElementById('pml-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando…</span></div>';

  const mes       = document.getElementById('pml-mes')?.value        || '';
  const trabajador = document.getElementById('pml-trabajador')?.value || '';
  const estado    = document.getElementById('pml-estado')?.value     || '';

  let q = _supabase
    .from('planillas_movilidad')
    .select('*', { count: 'exact' })
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('created_at', { ascending: false });

  if (mes)        q = q.eq('mes', mes);
  if (trabajador) q = q.eq('trabajador_dni', trabajador);
  if (estado)     q = q.eq('estado', estado);

  const { data, count, error } = await q;
  if (error) {
    wrap.innerHTML = `<div class="alerta-error" style="margin:16px">${escapar(error.message)}</div>`;
    return;
  }

  const lista = data || [];
  if (!lista.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:48px;color:var(--color-texto-suave)">
        <div style="font-size:40px;margin-bottom:12px">🚗</div>
        <p style="font-weight:500">Sin planillas para los filtros seleccionados</p>
        <p class="text-sm">Crea una nueva planilla con el botón ➕</p>
      </div>`;
    return;
  }

  const totalGastos = lista.reduce((s, r) => s + Number(r.total_gastos || 0), 0);

  wrap.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--color-borde);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span style="font-size:13px;color:var(--color-texto-suave)">${count || lista.length} planilla(s)</span>
      <span style="font-size:13px;font-weight:700;color:var(--color-secundario)">Total: ${formatearMoneda(totalGastos)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tabla" style="font-size:12px">
        <thead>
          <tr>
            <th>N° Planilla</th>
            <th>Mes</th>
            <th>Trabajador</th>
            <th>DNI</th>
            <th style="text-align:right">Total</th>
            <th style="text-align:center">Estado</th>
            <th style="text-align:center">Firma</th>
            <th style="text-align:center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const ec = PM_ESTADOS_COLOR[r.estado] || { bg:'#718096', label: r.estado };
            return `
              <tr onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''">
                <td style="font-family:monospace;font-weight:700;color:var(--color-secundario)">${escapar(r.numero_planilla)}</td>
                <td style="white-space:nowrap">${escapar(r.mes)}</td>
                <td style="max-width:200px">
                  <div style="font-weight:500;font-size:12px">${escapar(r.trabajador_nombre)}</div>
                </td>
                <td style="font-family:monospace;font-size:11px">${escapar(r.trabajador_dni)}</td>
                <td style="text-align:right;font-weight:700;color:var(--color-secundario)">${formatearMoneda(r.total_gastos)}</td>
                <td style="text-align:center">
                  <span style="background:${ec.bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">
                    ${ec.label}
                  </span>
                </td>
                <td style="text-align:center;font-size:16px">${r.firma_trabajador ? '✅' : '⬜'}</td>
                <td style="text-align:center;white-space:nowrap">
                  <button onclick="_pmlVerDetalle('${r.id}')" title="Ver detalle"
                    style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">👁️</button>
                  ${r.estado === 'BORRADOR' ? `
                  <button onclick="_pmlEditar('${r.id}')" title="Editar"
                    style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>` : ''}
                  <button onclick="_pmlExportarPDF('${r.id}')" title="Exportar PDF"
                    style="padding:4px 8px;background:rgba(197,134,48,.1);color:#b7791f;border:none;border-radius:4px;cursor:pointer;font-size:13px">📄</button>
                  ${r.estado !== 'APROBADO' ? `
                  <button onclick="_pmlCambiarEstado('${r.id}','${r.estado}')" title="Avanzar estado"
                    style="padding:4px 8px;background:rgba(39,103,73,.1);color:#276749;border:none;border-radius:4px;cursor:pointer;font-size:13px">▶️</button>` : ''}
                  <button onclick="_pmlEliminar('${r.id}','${escapar(r.numero_planilla)}')" title="Eliminar"
                    style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Ver detalle ───────────────────────────────────────────────────
async function _pmlVerDetalle(id) {
  const [resP, resD] = await Promise.all([
    _supabase.from('planillas_movilidad').select('*').eq('id', id).single(),
    _supabase.from('planilla_movilidad_detalles').select('*').eq('planilla_id', id).order('orden'),
  ]);

  const p = resP.data;
  const detalles = resD.data || [];
  if (!p) { mostrarToast('No se pudo cargar la planilla', 'error'); return; }

  const ec = PM_ESTADOS_COLOR[p.estado] || { bg:'#718096', label: p.estado };
  const total = detalles.reduce((s, d) => s + Number(d.monto || 0), 0);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
  overlay.innerHTML = `
    <div style="background:var(--color-bg-card);border-radius:12px;max-width:820px;width:100%;
      max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid var(--color-borde)">

      <!-- Header -->
      <div style="background:#2C5282;padding:16px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0">
        <div style="flex:1">
          <div style="color:#fff;font-weight:700;font-size:15px">🚗 ${escapar(empresa_activa.nombre)}</div>
          <div style="color:rgba(255,255,255,.8);font-size:12px">
            PLANILLA POR GASTOS DE MOVILIDAD — N° ${escapar(p.numero_planilla)}
          </div>
        </div>
        <span style="background:${ec.bg};color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${ec.label}</span>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="background:rgba(255,255,255,.2);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;color:#fff;font-size:18px">✕</button>
      </div>

      <!-- Info cabecera -->
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-borde);display:grid;grid-template-columns:1fr 1fr;gap:12px;flex-shrink:0">
        <div style="font-size:12px">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Trabajador</div>
          <div style="font-weight:700">${escapar(p.trabajador_nombre)}</div>
          <div style="color:var(--color-texto-suave)">DNI: ${escapar(p.trabajador_dni)}</div>
        </div>
        <div style="font-size:12px">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Período</div>
          <div style="font-weight:700">${escapar(p.mes)}</div>
          <div style="color:var(--color-texto-suave)">Emitido: ${formatearFecha(p.fecha_emision)}</div>
        </div>
      </div>

      <!-- Tabla de detalles -->
      <div style="flex:1;overflow-y:auto;padding:0">
        ${detalles.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:var(--color-primario);color:#fff;position:sticky;top:0">
            <tr>
              <th style="padding:8px 10px;text-align:left">N°</th>
              <th style="padding:8px 10px;text-align:left">Fecha</th>
              <th style="padding:8px 10px;text-align:left">Motivo</th>
              <th style="padding:8px 10px;text-align:left">Origen</th>
              <th style="padding:8px 10px;text-align:left">Destino</th>
              <th style="padding:8px 10px;text-align:left">Proyecto</th>
              <th style="padding:8px 10px;text-align:right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((d, i) => `
              <tr style="border-bottom:1px solid var(--color-borde);${i%2===0?'background:var(--color-bg-card)':'background:var(--color-fondo-2)'}">
                <td style="padding:7px 10px;color:var(--color-texto-suave)">${i+1}</td>
                <td style="padding:7px 10px;white-space:nowrap">${formatearFecha(d.fecha)}</td>
                <td style="padding:7px 10px;max-width:200px">${escapar(d.motivo)}</td>
                <td style="padding:7px 10px;font-size:11px;color:var(--color-texto-suave)">${escapar(d.origen||'—')}</td>
                <td style="padding:7px 10px;font-size:11px;color:var(--color-texto-suave)">${escapar(d.destino||'—')}</td>
                <td style="padding:7px 10px;font-size:11px">${escapar(d.proyecto||'—')}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;color:var(--color-secundario)">${formatearMoneda(d.monto)}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : `<p class="text-center text-muted text-sm" style="padding:24px">Sin filas de detalle registradas</p>`}
      </div>

      <!-- Footer total + acciones -->
      <div style="padding:14px 20px;border-top:1px solid var(--color-borde);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;flex-wrap:wrap;gap:8px">
        <div>
          <span style="font-size:12px;color:var(--color-texto-suave)">${detalles.length} fila(s) · Firma: ${p.firma_trabajador ? '✅ Sí' : '⬜ No'}</span>
          ${p.notas ? `<div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">📝 ${escapar(p.notas)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-weight:700;font-size:15px;color:var(--color-secundario)">Total: ${formatearMoneda(total)}</span>
          <button onclick="_pmlExportarPDF('${p.id}');this.closest('[style*=fixed]').remove()"
            style="padding:7px 14px;border:none;border-radius:6px;background:#b7791f;color:#fff;cursor:pointer;font-size:12px;font-family:var(--font)">
            📄 Exportar PDF
          </button>
          <button onclick="this.closest('[style*=fixed]').remove()"
            style="padding:7px 14px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
            Cerrar
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Editar planilla ───────────────────────────────────────────────
async function _pmlEditar(id) {
  const [resP, resD] = await Promise.all([
    _supabase.from('planillas_movilidad').select('*').eq('id', id).single(),
    _supabase.from('planilla_movilidad_detalles').select('*').eq('planilla_id', id).order('orden'),
  ]);
  if (!resP.data) { mostrarToast('No se encontró la planilla', 'error'); return; }

  // Cambiar al tab Nueva y cargar datos
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
  const btn = document.getElementById('tab-pm-nueva');
  if (btn) btn.classList.add('activo');

  const area = document.getElementById('contenido-tab');
  renderTabNueva(area, resP.data, resD.data || []);
}

// ── Cambiar estado ────────────────────────────────────────────────
async function _pmlCambiarEstado(id, estadoActual) {
  const siguiente = estadoActual === 'BORRADOR' ? 'ENVIADO' : 'APROBADO';
  const labels = { ENVIADO: 'Enviado', APROBADO: 'Aprobado' };

  if (!await confirmar(`¿Marcar planilla como ${labels[siguiente]}?`, { btnOk: 'Sí, avanzar', btnColor: '#276749' })) return;

  const { error } = await _supabase
    .from('planillas_movilidad')
    .update({ estado: siguiente, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast(`✓ Estado actualizado a ${labels[siguiente]}`, 'exito');
  cargarListaPlanillas();
}

// ── Eliminar planilla ─────────────────────────────────────────────
async function _pmlEliminar(id, numPlanilla) {
  if (!await confirmar(`¿Eliminar planilla ${numPlanilla}?`, { btnOk: 'Sí, eliminar', btnColor: '#C53030' })) return;

  const { error } = await _supabase.from('planillas_movilidad').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('✓ Planilla eliminada', 'exito');
  cargarListaPlanillas();
}

// ── Exportar PDF (print) ──────────────────────────────────────────
async function _pmlExportarPDF(id) {
  const [resP, resD] = await Promise.all([
    _supabase.from('planillas_movilidad').select('*').eq('id', id).single(),
    _supabase.from('planilla_movilidad_detalles').select('*').eq('planilla_id', id).order('orden'),
  ]);
  const p = resP.data;
  const detalles = resD.data || [];
  if (!p) { mostrarToast('No se pudo cargar la planilla', 'error'); return; }

  const total = detalles.reduce((s, d) => s + Number(d.monto || 0), 0);

  const printArea = document.getElementById('pm-print-area');
  if (!printArea) return;

  printArea.innerHTML = `
    <style>
      @media print {
        @page { size: A4; margin: 15mm; }
        body * { visibility: hidden; }
        #pm-print-area, #pm-print-area * { visibility: visible; }
        #pm-print-area { position: absolute; top: 0; left: 0; width: 100%; }
      }
      .pm-doc { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
      .pm-header { text-align: center; border: 2px solid #000; padding: 10px; margin-bottom: 8px; }
      .pm-header h2 { font-size: 13px; font-weight: bold; margin: 0 0 4px; }
      .pm-header h3 { font-size: 11px; font-weight: bold; margin: 0; }
      .pm-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; border: 1px solid #999; padding: 8px; }
      .pm-info-row { display: flex; gap: 6px; }
      .pm-info-lbl { font-weight: bold; min-width: 80px; }
      .pm-tabla { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .pm-tabla th { background: #2C5282; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; border: 1px solid #2C5282; }
      .pm-tabla td { padding: 5px 8px; border: 1px solid #ccc; font-size: 10px; }
      .pm-tabla tr:nth-child(even) td { background: #f5f5f5; }
      .pm-total { text-align: right; font-size: 13px; font-weight: bold; border: 2px solid #2C5282; padding: 8px; margin-bottom: 16px; }
      .pm-firma { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 24px; }
      .pm-firma-box { border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 10px; }
      .pm-numero { position: absolute; top: 16px; right: 16px; font-size: 10px; color: #666; }
    </style>
    <div class="pm-doc">
      <div style="position:relative">
        <div class="pm-header">
          <h2>${escapar(empresa_activa.nombre)}</h2>
          <h2>RUC: ${escapar(empresa_activa.ruc || '—')}</h2>
          <h3 style="margin-top:6px">PLANILLA POR GASTOS DE MOVILIDAD - POR TRABAJADOR</h3>
          <div style="font-size:11px;margin-top:2px">N° ${escapar(p.numero_planilla)}</div>
        </div>

        <div class="pm-info">
          <div>
            <div class="pm-info-row"><span class="pm-info-lbl">Trabajador:</span> <span>${escapar(p.trabajador_nombre)}</span></div>
            <div class="pm-info-row"><span class="pm-info-lbl">DNI:</span> <span>${escapar(p.trabajador_dni)}</span></div>
          </div>
          <div>
            <div class="pm-info-row"><span class="pm-info-lbl">Período:</span> <span>${escapar(p.mes)}</span></div>
            <div class="pm-info-row"><span class="pm-info-lbl">Fecha emisión:</span> <span>${formatearFecha(p.fecha_emision)}</span></div>
          </div>
        </div>

        <table class="pm-tabla">
          <thead>
            <tr>
              <th style="width:24px">N°</th>
              <th style="width:72px">Fecha</th>
              <th>Motivo del Desplazamiento</th>
              <th style="width:90px">Origen</th>
              <th style="width:90px">Destino</th>
              <th>Proyecto</th>
              <th style="width:72px;text-align:right">Monto S/</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((d, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${formatearFecha(d.fecha)}</td>
                <td>${escapar(d.motivo)}</td>
                <td>${escapar(d.origen||'')}</td>
                <td>${escapar(d.destino||'')}</td>
                <td>${escapar(d.proyecto||'')}</td>
                <td style="text-align:right">${Number(d.monto||0).toFixed(2)}</td>
              </tr>`).join('')}
            ${Array.from({length: Math.max(0, 10 - detalles.length)}, () =>
              '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
            ).join('')}
          </tbody>
        </table>

        <div class="pm-total">TOTAL GASTOS: S/ ${Number(total).toFixed(2)}</div>

        <div class="pm-firma">
          <div class="pm-firma-box">
            <div style="margin-bottom:40px"></div>
            <strong>${escapar(p.trabajador_nombre)}</strong><br>
            DNI: ${escapar(p.trabajador_dni)}<br>
            Firma del Trabajador
          </div>
          <div class="pm-firma-box">
            <div style="margin-bottom:40px"></div>
            <strong>V°B° Autorización</strong><br>
            Jefe / Responsable
          </div>
        </div>

        ${p.notas ? `<div style="margin-top:12px;font-size:10px;color:#666"><strong>Notas:</strong> ${escapar(p.notas)}</div>` : ''}
      </div>
    </div>`;

  printArea.style.display = 'block';
  setTimeout(() => {
    window.print();
    setTimeout(() => { printArea.style.display = 'none'; }, 1000);
  }, 200);
}
