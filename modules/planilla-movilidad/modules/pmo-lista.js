// ═══════════════════════════════════════════════════════════════
// Planilla de Movilidad — Tab Listado + catálogos compartidos
// ═══════════════════════════════════════════════════════════════

// ── Catálogos (sincronizados con hoja "Base de Datos" del Excel) ──
const PM_EMPRESAS = [
  { nombre: 'PEVAL CORPORACION E.I.R.L.',    ruc: '20611965479' },
  { nombre: 'JVÑ GENERAL SERVICES S.A.C.',   ruc: '20603607342' },
];

const PM_TRABAJADORES = [
  { nombre: 'Segundo Alexis Valencia Ñañez',         dni: '73093007' },
  { nombre: 'Jorge Samuel Segura Ramos',              dni: '74918847' },
  { nombre: 'Jeiber Vargas Tuesta',                   dni: '73766403' },
  { nombre: 'Segundo Jacobo Valencia Lozada',         dni: '16752234' },
  { nombre: 'Edver Johanys Valencia Ñañez',           dni: '73093008' },
  { nombre: 'Jose Augusto Fernandez Lozada',          dni: '17622309' },
  { nombre: 'Jhon Kenedi Romaina Tangoa',             dni: '60128333' },
  { nombre: 'Jose Alfonso Cornejo Quispitongo',       dni: '16735292' },
  { nombre: 'Manuel Luis Lizarraga Lizarraga',        dni: '40492603' },
  { nombre: 'Wendy Jannette Karina Ortega Gutierrez', dni: '75130993' },
];

const PM_MOTIVOS = [
  'Desplazamiento por servicio a ejecutar',
  'Desplazamiento a reuniones con clientes.',
  'Desplazamiento a reuniones o proveedores.',
  'Traslado para entrega de documentos.',
  'Traslado para recepción de documentos.',
  'Trámites administrativos.',
  'Visitas Técnicas',
  'Compra de materiales',
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
  'Mall Bellavista',
  'Clínica La Victoria',
  'Clínica San Pablo',
  'Clínica San Gabriel',
  'Clínica Santa Martha',
  'Clínica San Juan Bautista',
  'Clínica Jesús del Norte',
  'Instituto San Pablo',
  'Clínica San Pablo - Huaraz',
  'Supermercados Peruanos',
  'Torre - San Pablo',
  'JVÑ GENERAL SERVICES SAC',
];

// Empresas/clientes disponibles para la columna "Empresa Cliente" de cada fila
const PM_EMPRESAS_CLIENTE = [
  'JVÑ GENERAL SERVICES SAC',
  'PEVAL CORPORACION E.I.R.L.',
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

  const mes        = document.getElementById('pml-mes')?.value        || '';
  const trabajador = document.getElementById('pml-trabajador')?.value || '';
  const estado     = document.getElementById('pml-estado')?.value     || '';

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
                  <button onclick="_pmlExportarWord('${r.id}')" title="Exportar Word (.doc)"
                    style="padding:4px 8px;background:rgba(44,82,130,.12);color:#2C5282;border:none;border-radius:4px;cursor:pointer;font-size:13px">📝</button>
                  <button onclick="_pmlExportarPDF('${r.id}')" title="Exportar PDF (imprimir)"
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
    <div style="background:var(--color-bg-card);border-radius:12px;max-width:900px;width:100%;
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
              <th style="padding:8px 10px;text-align:left">Motivo del Desplazamiento</th>
              <th style="padding:8px 10px;text-align:left">Desde</th>
              <th style="padding:8px 10px;text-align:left">Hasta</th>
              <th style="padding:8px 10px;text-align:left">Proyecto</th>
              <th style="padding:8px 10px;text-align:left">Empresa</th>
              <th style="padding:8px 10px;text-align:right">Monto S/</th>
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
                <td style="padding:7px 10px;font-size:11px">${escapar(d.empresa_cliente||'—')}</td>
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
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-weight:700;font-size:15px;color:var(--color-secundario)">Total: ${formatearMoneda(total)}</span>
          <button onclick="_pmlExportarWord('${p.id}');this.closest('[style*=fixed]').remove()"
            style="padding:7px 14px;border:none;border-radius:6px;background:#2C5282;color:#fff;cursor:pointer;font-size:12px;font-family:var(--font);font-weight:500">
            📝 Exportar Word
          </button>
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

// ── Exportar Word (.doc) ──────────────────────────────────────────
async function _pmlExportarWord(id) {
  const [resP, resD] = await Promise.all([
    _supabase.from('planillas_movilidad').select('*').eq('id', id).single(),
    _supabase.from('planilla_movilidad_detalles').select('*').eq('planilla_id', id).order('orden'),
  ]);
  const p = resP.data;
  const detalles = resD.data || [];
  if (!p) { mostrarToast('No se pudo cargar la planilla', 'error'); return; }

  const total   = detalles.reduce((s, d) => s + Number(d.monto || 0), 0);
  const empresa = empresa_activa;

  // Filas vacías para completar hasta al menos 10 líneas
  const filaVacia = '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  const filasDetalle = detalles.map((d, i) => `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td style="text-align:center">${d.fecha ? new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric'}) : ''}</td>
      <td>${(d.motivo||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
      <td style="text-align:center">${(d.origen||'').replace(/&/g,'&amp;')}</td>
      <td style="text-align:center">${(d.destino||'').replace(/&/g,'&amp;')}</td>
      <td>${(d.proyecto||'').replace(/&/g,'&amp;')}</td>
      <td style="text-align:right">${Number(d.monto||0).toFixed(2)}</td>
    </tr>`).join('');
  const filasRelleno = Array.from({length: Math.max(0, 10 - detalles.length)}, () => filaVacia).join('');

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
  <style>
    @page { size:21.0cm 29.7cm; margin:1.5cm 1.8cm; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:11pt; color:#000; margin:0; }
    .encabezado { border:2pt solid #1a3a5c; padding:10pt 14pt; text-align:center; margin-bottom:8pt; }
    .encabezado .empresa  { font-size:13pt; font-weight:bold; margin:0 0 2pt; }
    .encabezado .ruc      { font-size:10pt; margin:0 0 6pt; }
    .encabezado .titulo   { font-size:12pt; font-weight:bold; text-transform:uppercase; margin:0 0 2pt; }
    .encabezado .nro      { font-size:10pt; font-weight:bold; margin:0; }
    .datos { width:100%; border-collapse:collapse; margin-bottom:8pt; border:1pt solid #999; }
    .datos td { padding:5pt 8pt; border:1pt solid #ccc; font-size:10pt; vertical-align:top; }
    .datos td.lbl { font-weight:bold; background:#eef2f7; width:100pt; white-space:nowrap; }
    table.detalle { width:100%; border-collapse:collapse; margin-bottom:6pt; }
    table.detalle th { background:#1a3a5c; color:#fff; padding:5pt 6pt; font-size:9pt; border:1pt solid #1a3a5c; text-align:center; }
    table.detalle td { padding:4pt 6pt; border:1pt solid #ccc; font-size:9pt; vertical-align:middle; }
    table.detalle tr:nth-child(even) td { background:#f0f4f8; }
    .total-row { text-align:right; font-weight:bold; font-size:12pt; border:2pt solid #1a3a5c;
                 padding:6pt 10pt; margin-bottom:20pt; background:#eef2f7; }
    .firmas { width:100%; border-collapse:collapse; margin-top:28pt; }
    .firmas td { width:50%; text-align:center; padding:0 24pt; vertical-align:bottom; }
    .linea-firma { border-top:1pt solid #000; padding-top:4pt; font-size:9pt; margin-top:40pt; }
    .notas { font-size:9pt; color:#555; margin-top:10pt; }
  </style>
</head>
<body>

  <div class="encabezado">
    <p class="empresa">${(empresa.nombre||'').replace(/&/g,'&amp;')}</p>
    <p class="ruc">RUC: ${(empresa.ruc||'').replace(/&/g,'&amp;')}</p>
    <p class="titulo">PLANILLA POR GASTOS DE MOVILIDAD - POR TRABAJADOR</p>
    <p class="nro">N° ${(p.numero_planilla||'').replace(/&/g,'&amp;')}</p>
  </div>

  <table class="datos">
    <tr>
      <td class="lbl">Trabajador:</td>
      <td>${(p.trabajador_nombre||'').replace(/&/g,'&amp;')}</td>
      <td class="lbl">DNI:</td>
      <td>${(p.trabajador_dni||'').replace(/&/g,'&amp;')}</td>
    </tr>
    <tr>
      <td class="lbl">Período:</td>
      <td>${(p.mes||'').replace(/&/g,'&amp;')}</td>
      <td class="lbl">Fecha emisión:</td>
      <td>${p.fecha_emision ? new Date(p.fecha_emision+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'}) : ''}</td>
    </tr>
    <tr>
      <td class="lbl">Estado:</td>
      <td>${(p.estado||'').replace(/&/g,'&amp;')}</td>
      <td class="lbl">Firma:</td>
      <td>${p.firma_trabajador ? 'SÍ — Firmado' : 'Pendiente'}</td>
    </tr>
  </table>

  <table class="detalle">
    <thead>
      <tr>
        <th style="width:24pt">N°</th>
        <th style="width:60pt">Fecha</th>
        <th style="width:auto">Motivo del Desplazamiento</th>
        <th style="width:70pt">Desde</th>
        <th style="width:70pt">Hasta</th>
        <th style="width:90pt">Proyecto</th>
        <th style="width:55pt;text-align:right">Monto S/</th>
      </tr>
    </thead>
    <tbody>
      ${filasDetalle}
      ${filasRelleno}
    </tbody>
  </table>

  <div class="total-row">TOTAL GASTOS: &nbsp;&nbsp; S/ ${Number(total).toFixed(2)}</div>

  <table class="firmas">
    <tr>
      <td>
        <div class="linea-firma">
          <strong>${(p.trabajador_nombre||'').replace(/&/g,'&amp;')}</strong><br>
          DNI: ${(p.trabajador_dni||'').replace(/&/g,'&amp;')}<br>
          Firma del Trabajador
        </div>
      </td>
      <td>
        <div class="linea-firma">
          <strong>V°B° Autorización</strong><br>
          <br>
          Jefe / Responsable
        </div>
      </td>
    </tr>
  </table>

  ${p.notas ? `<p class="notas"><strong>Notas:</strong> ${(p.notas||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : ''}

</body>
</html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const nombre = (p.trabajador_nombre || 'Trabajador').split(' ').slice(0, 2).join('-');
  a.href     = url;
  a.download = `Planilla-Movilidad-${(p.numero_planilla||'').replace(/\//g,'-')}-${nombre}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast('📝 Documento Word descargado', 'exito');
}

// ═══════════════════════════════════════════════════════════════
// Importar desde JSON
// ═══════════════════════════════════════════════════════════════

let _pmiDatosPendientes = null;  // datos parseados del archivo

function renderTabImportarJSON(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">📥 Importar planilla desde JSON</h3>
          <button onclick="activarTab('pm-lista')"
            style="padding:6px 12px;background:none;border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;color:var(--color-texto)">
            ← Volver al listado
          </button>
        </div>

        <div style="padding:14px 16px;background:rgba(44,82,130,.06);border-radius:8px;border:1px solid rgba(44,82,130,.2);margin-bottom:20px;font-size:13px">
          <div style="font-weight:700;color:var(--color-secundario);margin-bottom:8px">ℹ️ Instrucciones</div>
          <ul style="margin:0;padding-left:18px;line-height:1.8;color:var(--color-texto-suave)">
            <li>El archivo debe ser un <strong>.json</strong> con la estructura de <em>Plantilla_Formato de Movilidad</em></li>
            <li>Campos requeridos: <code>documento_metadata</code>, <code>trabajador</code>, <code>detalle_movilidad</code></li>
            <li>Verás una vista previa antes de importar — podrás editar todos los datos antes de guardar</li>
          </ul>
        </div>

        <div id="pm-import-zona"
          style="border:2px dashed var(--color-borde);border-radius:10px;padding:44px 20px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--color-fondo-2)"
          onclick="document.getElementById('pm-import-file').click()"
          ondragover="event.preventDefault();this.style.borderColor='var(--color-secundario)';this.style.background='rgba(44,82,130,.06)'"
          ondragleave="this.style.borderColor='var(--color-borde)';this.style.background='var(--color-fondo-2)'"
          ondrop="_pmiOnDrop(event)">
          <div style="font-size:48px;margin-bottom:12px">📂</div>
          <div style="font-size:14px;font-weight:600;color:var(--color-texto);margin-bottom:4px">Arrastra tu archivo .json aquí</div>
          <div style="font-size:12px;color:var(--color-texto-suave)">o haz clic para seleccionarlo</div>
          <input type="file" id="pm-import-file" accept=".json,application/json"
            style="display:none" onchange="_pmiCargarArchivo(this.files[0])">
        </div>

        <div id="pm-import-preview" style="margin-top:20px"></div>
      </div>
    </div>`;
}

function _pmiOnDrop(e) {
  e.preventDefault();
  const zona = document.getElementById('pm-import-zona');
  if (zona) { zona.style.borderColor = 'var(--color-borde)'; zona.style.background = 'var(--color-fondo-2)'; }
  const file = e.dataTransfer?.files?.[0];
  if (file) _pmiCargarArchivo(file);
}

function _pmiCargarArchivo(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json')) {
    mostrarToast('Solo se aceptan archivos .json', 'atencion');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      _pmiDatosPendientes = data;
      _pmiMostrarPreview(data);
    } catch(err) {
      mostrarToast('Error al parsear el JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function _pmiMostrarPreview(data) {
  const preview = document.getElementById('pm-import-preview');
  if (!preview) return;

  const meta     = data.documento_metadata || {};
  const empresa  = data.empresa            || {};
  const trab     = data.trabajador         || {};
  const detalles = Array.isArray(data.detalle_movilidad) ? data.detalle_movilidad : [];
  const firma    = !!(data.estado_validacion?.firma_trabajador_presente);
  const total    = detalles.reduce((s, d) => s + Number(d.monto || 0), 0);
  const trabNombre = trab.nombre_completo || trab.nombre || '';

  if (!trabNombre) {
    preview.innerHTML = `<div class="alerta-error" style="margin-top:4px">⚠️ El JSON no tiene "trabajador.nombre_completo". Verifica la estructura del archivo.</div>`;
    return;
  }
  if (!detalles.length) {
    preview.innerHTML = `<div class="alerta-error" style="margin-top:4px">⚠️ El JSON no contiene filas en "detalle_movilidad".</div>`;
    return;
  }

  preview.innerHTML = `
    <div style="border:1px solid var(--color-borde);border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

      <!-- Header -->
      <div style="background:var(--color-secundario);padding:12px 18px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700;font-size:14px">Vista previa — Planilla ${escapar(meta.numero_planilla || '(sin número)')}</div>
          <div style="font-size:11px;opacity:.85">Fecha: ${escapar(meta.fecha_emision || '—')}</div>
        </div>
        <span style="background:rgba(255,255,255,.22);padding:3px 12px;border-radius:10px;font-size:11px;font-weight:700">JSON IMPORTADO</span>
      </div>

      <!-- Info cabecera -->
      <div style="padding:14px 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid var(--color-borde);font-size:12px">
        <div>
          <div style="color:var(--color-texto-suave);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Trabajador</div>
          <div style="font-weight:600">${escapar(trabNombre)}</div>
          <div style="color:var(--color-texto-suave)">DNI: ${escapar(trab.dni || '—')}</div>
        </div>
        <div>
          <div style="color:var(--color-texto-suave);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Empresa emisora</div>
          <div style="font-weight:600">${escapar(empresa.razon_social || empresa_activa?.nombre || '—')}</div>
          <div style="color:var(--color-texto-suave)">RUC: ${escapar(empresa.ruc || empresa_activa?.ruc || '—')}</div>
        </div>
      </div>

      <!-- Tabla detalles -->
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead style="background:var(--color-primario);color:#fff">
            <tr>
              <th style="padding:7px 8px;text-align:center">#</th>
              <th style="padding:7px 8px;text-align:left;white-space:nowrap">Fecha</th>
              <th style="padding:7px 8px;text-align:left">Motivo</th>
              <th style="padding:7px 8px;text-align:left">Desde</th>
              <th style="padding:7px 8px;text-align:left">Hasta</th>
              <th style="padding:7px 8px;text-align:left">Proyecto</th>
              <th style="padding:7px 8px;text-align:left">Empresa</th>
              <th style="padding:7px 8px;text-align:right;white-space:nowrap">Monto S/</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((d, i) => `
              <tr style="border-bottom:1px solid var(--color-borde);${i%2===0?'':'background:var(--color-fondo-2)'}">
                <td style="padding:5px 8px;text-align:center;color:var(--color-texto-suave)">${i+1}</td>
                <td style="padding:5px 8px;white-space:nowrap">${escapar(d.fecha || '—')}</td>
                <td style="padding:5px 8px;max-width:180px">${escapar(d.motivo || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.origen || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.destino || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.proyecto || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.empresa_cliente || '—')}</td>
                <td style="padding:5px 8px;text-align:right;font-weight:600;color:var(--color-secundario)">${Number(d.monto||0).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer: total + botón importar -->
      <div style="padding:14px 18px;border-top:1px solid var(--color-borde);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="font-size:12px;color:var(--color-texto-suave)">
          ${detalles.length} fila(s) &nbsp;·&nbsp; Firma: ${firma ? '✅ Sí' : '⬜ No'}
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="font-size:15px;font-weight:700;color:var(--color-secundario)">Total: S/ ${Number(total).toFixed(2)}</span>
          <button onclick="_pmiImportarAlFormulario()"
            style="padding:9px 22px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:var(--font);font-weight:600">
            ✅ Importar y editar planilla
          </button>
        </div>
      </div>
    </div>`;
}

function _pmiImportarAlFormulario() {
  const data = _pmiDatosPendientes;
  if (!data) { mostrarToast('No hay datos para importar', 'atencion'); return; }

  const meta     = data.documento_metadata || {};
  const trab     = data.trabajador         || {};
  const detalles = Array.isArray(data.detalle_movilidad) ? data.detalle_movilidad : [];
  const firma    = !!(data.estado_validacion?.firma_trabajador_presente);

  // Resolver DNI: primero del JSON, luego buscar por nombre exacto
  const dniDirecto = (trab.dni || '').toString().trim();
  const trabMatch  = PM_TRABAJADORES.find(t => t.dni === dniDirecto) ||
                     PM_TRABAJADORES.find(t =>
                       t.nombre.toLowerCase() === (trab.nombre_completo || '').toLowerCase().trim()
                     );
  const trabDni    = trabMatch?.dni || dniDirecto;
  const trabNombre = trab.nombre_completo || trab.nombre || '';

  // Determinar período desde fecha_emision
  const fechaStr = (meta.fecha_emision || '').slice(0, 10);
  const mes      = fechaStr.slice(0, 7);

  const planillaData = {
    id:               null,          // siempre crea nueva
    numero_planilla:  meta.numero_planilla || '',
    mes,
    fecha_emision:    fechaStr || new Date().toISOString().slice(0, 10),
    trabajador_nombre: trabNombre,
    trabajador_dni:   trabDni,
    firma_trabajador: firma,
    notas:            null,
    estado:           'BORRADOR',
  };

  const detallesData = detalles.map((d, i) => ({
    orden:           i + 1,
    fecha:           (d.fecha || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    motivo:          d.motivo          || '',
    origen:          d.origen          || null,
    destino:         d.destino         || null,
    proyecto:        d.proyecto        || null,
    empresa_cliente: d.empresa_cliente || null,
    monto:           Number(d.monto    || 0),
  }));

  // Activar el tab "Nueva planilla" con los datos pre-cargados
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
  const btn = document.getElementById('tab-pm-nueva');
  if (btn) btn.classList.add('activo');

  _pmiDatosPendientes = null;
  const area = document.getElementById('contenido-tab');
  renderTabNueva(area, planillaData, detallesData);
  mostrarToast('✓ Datos importados — revisa los campos y guarda la planilla', 'exito');
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
      .pm-header { text-align: center; border: 2px solid #1a3a5c; padding: 10px; margin-bottom: 8px; }
      .pm-header h2 { font-size: 13px; font-weight: bold; margin: 0 0 2px; }
      .pm-header h3 { font-size: 11px; font-weight: bold; margin: 0; }
      .pm-info { width:100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #999; }
      .pm-info td { padding: 4px 8px; border: 1px solid #ccc; font-size: 10px; }
      .pm-info td.lbl { font-weight: bold; background: #eef2f7; width: 80px; }
      .pm-tabla { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .pm-tabla th { background: #1a3a5c; color: #fff; padding: 5px 6px; text-align: left; font-size: 9px; border: 1px solid #1a3a5c; }
      .pm-tabla td { padding: 4px 6px; border: 1px solid #ccc; font-size: 9px; vertical-align: middle; }
      .pm-tabla tr:nth-child(even) td { background: #f0f4f8; }
      .pm-total { text-align: right; font-size: 12px; font-weight: bold; border: 2px solid #1a3a5c; padding: 6px 10px; margin-bottom: 16px; background: #eef2f7; }
      .pm-firma { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 24px; }
      .pm-firma-box { border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 9px; }
    </style>
    <div class="pm-doc">
      <div class="pm-header">
        <h2>${escapar(empresa_activa.nombre)}</h2>
        <h2>RUC: ${escapar(empresa_activa.ruc || '—')}</h2>
        <h3 style="margin-top:4px">PLANILLA POR GASTOS DE MOVILIDAD - POR TRABAJADOR</h3>
        <div style="font-size:11px;margin-top:2px;font-weight:bold">N° ${escapar(p.numero_planilla)}</div>
      </div>

      <table class="pm-info">
        <tr>
          <td class="lbl">Trabajador:</td>
          <td>${escapar(p.trabajador_nombre)}</td>
          <td class="lbl">DNI:</td>
          <td>${escapar(p.trabajador_dni)}</td>
        </tr>
        <tr>
          <td class="lbl">Período:</td>
          <td>${escapar(p.mes)}</td>
          <td class="lbl">Fecha emisión:</td>
          <td>${formatearFecha(p.fecha_emision)}</td>
        </tr>
      </table>

      <table class="pm-tabla">
        <thead>
          <tr>
            <th style="width:18px">N°</th>
            <th style="width:56px">Fecha</th>
            <th>Motivo del Desplazamiento</th>
            <th style="width:70px">Desde</th>
            <th style="width:70px">Hasta</th>
            <th style="width:90px">Proyecto</th>
            <th style="width:80px">Empresa</th>
            <th style="width:55px;text-align:right">Monto S/</th>
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
              <td>${escapar(d.empresa_cliente||'')}</td>
              <td style="text-align:right">${Number(d.monto||0).toFixed(2)}</td>
            </tr>`).join('')}
          ${Array.from({length: Math.max(0, 10 - detalles.length)}, () =>
            '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
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

      ${p.notas ? `<div style="margin-top:10px;font-size:9px;color:#666"><strong>Notas:</strong> ${escapar(p.notas)}</div>` : ''}
    </div>`;

  printArea.style.display = 'block';
  setTimeout(() => {
    window.print();
    setTimeout(() => { printArea.style.display = 'none'; }, 1000);
  }, 200);
}
