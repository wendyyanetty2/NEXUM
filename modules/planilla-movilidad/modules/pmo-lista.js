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

// ── Trabajadores desde Catálogos (DB) ────────────────────────────
let _pmoCachedTrabajadores = null;

async function _pmoObtenerTrabajadores() {
  if (_pmoCachedTrabajadores) return _pmoCachedTrabajadores;
  try {
    const { data } = await _supabase
      .from('trabajadores')
      .select('nombre, apellido_paterno, apellido_materno, dni')
      .eq('empresa_operadora_id', empresa_activa.id)
      .order('apellido_paterno');
    if (data && data.length) {
      _pmoCachedTrabajadores = data.map(t => ({
        nombre: [t.nombre, t.apellido_paterno, t.apellido_materno]
                  .filter(Boolean).join(' ').trim(),
        dni: (t.dni || '').toString().trim(),
      }));
      return _pmoCachedTrabajadores;
    }
  } catch(e) { console.warn('pmo: no se pudo cargar trabajadores desde DB', e); }
  // Fallback al catálogo estático
  return PM_TRABAJADORES;
}

// ── Render principal del listado ──────────────────────────────────
async function renderTabLista(area) {
  const hoy  = new Date();
  const mesD = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const trabajadores = await _pmoObtenerTrabajadores();

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
              ${trabajadores.map(t => `<option value="${escapar(t.dni)}">${escapar(t.nombre.split(' ').slice(0,2).join(' '))}</option>`).join('')}
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
// Tab Reporte de Planilla de Movilidad
// ═══════════════════════════════════════════════════════════════

async function renderTabReporte(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="card" style="margin-bottom:16px;padding:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-texto-suave);margin-bottom:10px">🔍 Filtros del reporte</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;align-items:end">
          <div>
            <label class="label-filtro">Desde</label>
            <input type="month" id="prep-desde" class="input-buscar w-full" value="${new Date().getFullYear()}-01">
          </div>
          <div>
            <label class="label-filtro">Hasta</label>
            <input type="month" id="prep-hasta" class="input-buscar w-full" value="${new Date().toISOString().slice(0,7)}">
          </div>
          <div>
            <label class="label-filtro">Estado</label>
            <select id="prep-estado" class="input-buscar w-full">
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ENVIADO">Enviado</option>
              <option value="APROBADO">Aprobado</option>
            </select>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="_prepCargar()" class="btn btn-primario w-full">🔍 Generar</button>
            <button onclick="_prepExportar()" class="btn btn-secundario" title="Exportar Excel">⬇</button>
          </div>
        </div>
      </div>
      <div id="prep-contenido">
        <div class="text-center text-muted" style="padding:48px">
          Selecciona el rango y haz clic en <strong>Generar</strong>
        </div>
      </div>
    </div>`;
}

async function _prepCargar() {
  const desde  = document.getElementById('prep-desde')?.value  || '';
  const hasta  = document.getElementById('prep-hasta')?.value  || '';
  const estado = document.getElementById('prep-estado')?.value || '';
  const cont   = document.getElementById('prep-contenido');
  if (!cont) return;

  cont.innerHTML = '<div class="cargando" style="padding:32px"><div class="spinner"></div><span>Cargando…</span></div>';

  let q = _supabase
    .from('planillas_movilidad')
    .select('*, planilla_movilidad_detalles(*)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('mes');
  if (desde)  q = q.gte('mes', desde);
  if (hasta)  q = q.lte('mes', hasta);
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) { cont.innerHTML = `<div class="alerta-error" style="margin:16px">${escapar(error.message)}</div>`; return; }
  const lista = data || [];

  if (!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:48px;color:var(--color-texto-suave)">
      <div style="font-size:40px;margin-bottom:12px">🚗</div>
      <p>Sin planillas para el período seleccionado</p></div>`;
    return;
  }

  // KPIs
  const totalGastos  = lista.reduce((s,p) => s + Number(p.total_gastos||0), 0);
  const totalFilas   = lista.reduce((s,p) => s + (p.planilla_movilidad_detalles||[]).length, 0);
  const aprobadas    = lista.filter(p => p.estado === 'APROBADO').length;
  const enviadas     = lista.filter(p => p.estado === 'ENVIADO').length;
  const borradores   = lista.filter(p => p.estado === 'BORRADOR').length;

  // Agrupar por trabajador
  const porTrab = {};
  lista.forEach(p => {
    const key = p.trabajador_dni || p.trabajador_nombre;
    if (!porTrab[key]) porTrab[key] = { nombre: p.trabajador_nombre, dni: p.trabajador_dni, total: 0, planillas: 0, filas: 0 };
    porTrab[key].total    += Number(p.total_gastos||0);
    porTrab[key].planillas += 1;
    porTrab[key].filas    += (p.planilla_movilidad_detalles||[]).length;
  });
  const trabRows = Object.values(porTrab).sort((a,b) => b.total - a.total);

  // Agrupar por mes
  const porMes = {};
  lista.forEach(p => {
    if (!porMes[p.mes]) porMes[p.mes] = { total: 0, planillas: 0 };
    porMes[p.mes].total    += Number(p.total_gastos||0);
    porMes[p.mes].planillas += 1;
  });

  cont.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      <div class="card" style="padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--color-secundario)">${formatearMoneda(totalGastos)}</div>
        <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">Total gastos</div>
      </div>
      <div class="card" style="padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--color-texto)">${lista.length}</div>
        <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">Planillas</div>
      </div>
      <div class="card" style="padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--color-texto)">${totalFilas}</div>
        <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">Desplazamientos</div>
      </div>
      <div class="card" style="padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:700">
          <span style="color:#276749">✅${aprobadas}</span>
          <span style="color:#2C5282;margin:0 4px">📨${enviadas}</span>
          <span style="color:#718096">📝${borradores}</span>
        </div>
        <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px">Aprobadas / Enviadas / Borradores</div>
      </div>
    </div>

    <!-- Por trabajador -->
    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--color-borde);font-weight:600;font-size:13px">
        👤 Gastos por trabajador
      </div>
      <div style="overflow-x:auto">
        <table class="tabla" style="font-size:12px">
          <thead>
            <tr>
              <th>Trabajador</th><th>DNI</th>
              <th style="text-align:center">Planillas</th>
              <th style="text-align:center">Desplazamientos</th>
              <th style="text-align:right">Total S/</th>
              <th style="text-align:right">Promedio/planilla</th>
            </tr>
          </thead>
          <tbody>
            ${trabRows.map(t => `
              <tr>
                <td style="font-weight:500">${escapar(t.nombre)}</td>
                <td style="font-family:monospace;font-size:11px">${escapar(t.dni)}</td>
                <td style="text-align:center">${t.planillas}</td>
                <td style="text-align:center">${t.filas}</td>
                <td style="text-align:right;font-weight:700;color:var(--color-secundario)">${formatearMoneda(t.total)}</td>
                <td style="text-align:right;color:var(--color-texto-suave)">${formatearMoneda(t.total / t.planillas)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--color-primario);color:#fff">
              <td colspan="4" style="padding:8px 12px;font-weight:700">TOTAL GENERAL</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700">${formatearMoneda(totalGastos)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Por mes -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--color-borde);font-weight:600;font-size:13px">
        📅 Gastos por mes
      </div>
      <div style="overflow-x:auto">
        <table class="tabla" style="font-size:12px">
          <thead>
            <tr>
              <th>Mes</th>
              <th style="text-align:center">N° Planillas</th>
              <th style="text-align:right">Total S/</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,v]) => `
              <tr>
                <td style="font-weight:500">${escapar(mes)}</td>
                <td style="text-align:center">${v.planillas}</td>
                <td style="text-align:right;font-weight:700;color:var(--color-secundario)">${formatearMoneda(v.total)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // Guardar datos para exportar
  window._prepDatosUltimos = lista;
}

async function _prepExportar() {
  const lista = window._prepDatosUltimos;
  if (!lista?.length) { mostrarToast('Primero genera el reporte', 'atencion'); return; }

  const hojaResumen = lista.map(p => ({
    'N° Planilla': p.numero_planilla, 'Mes': p.mes,
    'F. Emisión': p.fecha_emision || '', 'Trabajador': p.trabajador_nombre,
    'DNI': p.trabajador_dni, 'Total S/': Number(p.total_gastos||0),
    'Estado': p.estado, 'Firma': p.firma_trabajador ? 'Sí' : 'No',
    'Filas': (p.planilla_movilidad_detalles||[]).length,
  }));

  const hojaDetalle = [];
  lista.forEach(p => {
    (p.planilla_movilidad_detalles||[]).forEach(d => {
      hojaDetalle.push({
        'N° Planilla': p.numero_planilla, 'Trabajador': p.trabajador_nombre,
        'DNI': p.trabajador_dni, 'Mes': p.mes, 'Fecha': d.fecha,
        'Motivo': d.motivo||'', 'Desde': d.origen||'', 'Hasta': d.destino||'',
        'Proyecto': d.proyecto||'', 'Empresa Cliente': d.empresa_cliente||'',
        'Monto S/': Number(d.monto||0), 'Estado Planilla': p.estado,
      });
    });
  });

  const wb = typeof XLSX !== 'undefined' ? XLSX.utils.book_new() : null;
  if (!wb) { mostrarToast('Librería Excel no disponible', 'error'); return; }

  [
    { nombre: 'Resumen', datos: hojaResumen },
    { nombre: 'Detalle Desplazamientos', datos: hojaDetalle },
  ].forEach(h => {
    if (h.datos.length) {
      const ws = XLSX.utils.json_to_sheet(h.datos);
      XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0,31));
    }
  });

  const desde = document.getElementById('prep-desde')?.value || 'todo';
  const hasta = document.getElementById('prep-hasta')?.value || '';
  XLSX.writeFile(wb, `planilla_movilidad_${empresa_activa.nombre.replace(/\s+/g,'_')}_${desde}${hasta?'_'+hasta:''}.xlsx`);
  mostrarToast('✓ Excel exportado', 'exito');
}

// ═══════════════════════════════════════════════════════════════
// Importar desde Word (.docx) o JSON
// ═══════════════════════════════════════════════════════════════

let _pmiDatosPendientes = null;  // datos parseados del archivo
let _pmiFuenteArchivo   = '';    // 'word' | 'json'

function renderTabImportarJSON(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">📥 Importar planilla</h3>
          <button onclick="activarTab('pm-lista')"
            style="padding:6px 12px;background:none;border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;color:var(--color-texto)">
            ← Volver al listado
          </button>
        </div>

        <div style="padding:14px 16px;background:rgba(44,82,130,.06);border-radius:8px;border:1px solid rgba(44,82,130,.2);margin-bottom:20px;font-size:13px">
          <div style="font-weight:700;color:var(--color-secundario);margin-bottom:8px">ℹ️ Instrucciones</div>
          <ul style="margin:0;padding-left:18px;line-height:1.8;color:var(--color-texto-suave)">
            <li>Se aceptan archivos <strong>.docx</strong> (Word) y <strong>.json</strong></li>
            <li>El nombre del archivo Word debe seguir el formato:<br>
                <code>N° 001-12-25 Nombre Completo Trabajador.docx</code></li>
            <li>Verás una vista previa antes de importar — podrás editar todos los campos</li>
          </ul>
        </div>

        <div id="pm-import-zona"
          style="border:2px dashed var(--color-borde);border-radius:10px;padding:44px 20px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--color-fondo-2)"
          onclick="document.getElementById('pm-import-file').click()"
          ondragover="event.preventDefault();this.style.borderColor='var(--color-secundario)';this.style.background='rgba(44,82,130,.06)'"
          ondragleave="this.style.borderColor='var(--color-borde)';this.style.background='var(--color-fondo-2)'"
          ondrop="_pmiOnDrop(event)">
          <div style="font-size:48px;margin-bottom:12px">📂</div>
          <div style="font-size:14px;font-weight:600;color:var(--color-texto);margin-bottom:4px">Arrastra tu archivo aquí</div>
          <div style="font-size:12px;color:var(--color-texto-suave)">o haz clic para seleccionar &nbsp;·&nbsp; Formatos: <strong>.docx</strong> o .json</div>
          <input type="file" id="pm-import-file"
            accept=".docx,.json,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.docx')) {
    _pmiFuenteArchivo = 'word';
    _pmiLeerDocx(file);
  } else if (nombre.endsWith('.json')) {
    _pmiFuenteArchivo = 'json';
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
  } else {
    mostrarToast('Solo se aceptan archivos .docx (Word) o .json', 'atencion');
  }
}

// ── Leer Word (.docx) con mammoth.js ─────────────────────────────
async function _pmiLeerDocx(file) {
  const preview = document.getElementById('pm-import-preview');
  if (preview) preview.innerHTML = `
    <div class="cargando" style="padding:28px">
      <div class="spinner"></div><span>Procesando documento Word…</span>
    </div>`;

  try {
    // Cargar mammoth.js dinámicamente si no está disponible
    if (!window.mammoth) {
      await new Promise((resolve, reject) => {
        const s    = document.createElement('script');
        s.src      = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
        s.onload   = resolve;
        s.onerror  = () => reject(new Error('No se pudo cargar el lector de Word (mammoth.js). Verifica tu conexión.'));
        document.head.appendChild(s);
      });
    }

    const ab     = await file.arrayBuffer();
    const result = await window.mammoth.convertToHtml({ arrayBuffer: ab });
    const data   = _pmiParsearDocxHtml(result.value, file.name);

    _pmiDatosPendientes = data;
    _pmiMostrarPreview(data);

  } catch (err) {
    if (preview) preview.innerHTML =
      `<div class="alerta-error" style="margin-top:4px">⚠️ ${escapar(err.message)}</div>`;
    mostrarToast('Error al leer el Word: ' + err.message, 'error');
  }
}

// ── Parsear HTML generado por mammoth ────────────────────────────
function _pmiParsearDocxHtml(html, fileName) {
  const div   = document.createElement('div');
  div.innerHTML = html;
  const texto = div.textContent || '';

  // ── Metadata desde el nombre del archivo ────────────────────────
  // Formato: "N° 001-12-25 Nombre Completo Trabajador.docx"
  let numPlanilla = '';
  let trabNombre  = '';
  const fnBase    = fileName.replace(/\.docx$/i, '').replace(/^N[°o]?\s*/i, '').trim();
  const fnMatch   = fnBase.match(/^(\d{3}-\d{2}-\d{2})\s+(.+)$/);
  if (fnMatch) {
    numPlanilla = fnMatch[1];
    trabNombre  = fnMatch[2].trim();
  }

  // ── Metadata desde el cuerpo del documento ───────────────────────
  let trabDni   = '';
  let fechaEmis = '';
  let mes       = '';
  let firma     = false;

  // DNI: 8 dígitos tras la palabra "DNI"
  const dniMatch = texto.match(/DNI[:\s]*(\d{8})/i);
  if (dniMatch) trabDni = dniMatch[1];

  // Trabajador (fallback si no vino del filename)
  if (!trabNombre) {
    const tm = texto.match(/[Tt]rabajador[:\s]+([A-ZÁÉÍÓÚÑ][^\n\r]{4,60})/);
    if (tm) trabNombre = tm[1].trim();
  }

  // Fecha emisión DD/MM/YYYY
  const fEmisMatch = texto.match(/[Ff]echa\s+emisi[oó]n[:\s]*(\d{2})\/(\d{2})\/(\d{4})/);
  if (fEmisMatch) fechaEmis = `${fEmisMatch[3]}-${fEmisMatch[2]}-${fEmisMatch[1]}`;

  // Período YYYY-MM o YYYY-MM-DD
  const mesMatch = texto.match(/[Pp]er[ií]odo[:\s]*(\d{4}-\d{2})/);
  if (mesMatch) mes = mesMatch[1];
  if (!mes && fechaEmis) mes = fechaEmis.slice(0, 7);

  // Firma
  firma = /S[IÍ].*[Ff]irmado|[Ff]irmado.*S[IÍ]/i.test(texto);

  // ── Parsear tabla de detalles ─────────────────────────────────────
  const tables  = Array.from(div.querySelectorAll('table'));
  let detalles  = [];

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    // Detectar fila cabecera: debe tener "motivo" o "desplazamiento" y "fecha"
    const headerCells = Array.from(rows[0].querySelectorAll('th,td'))
      .map(td => td.textContent.trim().toLowerCase());

    const esTablaDetalle =
      headerCells.some(h => h.includes('motivo') || h.includes('desplazamiento')) &&
      headerCells.some(h => h.includes('fecha'));

    if (!esTablaDetalle) continue;

    // Mapear columnas por keywords
    const col = { fecha: -1, motivo: -1, origen: -1, destino: -1, proyecto: -1, empresa: -1, monto: -1 };
    headerCells.forEach((h, i) => {
      if (h.includes('fecha'))                                       col.fecha    = i;
      if (h.includes('motivo') || h.includes('desplazamiento'))     col.motivo   = i;
      if (h.includes('desde')  || h === 'origen')                   col.origen   = i;
      if (h.includes('hasta')  || h === 'destino')                  col.destino  = i;
      if (h.includes('proyecto'))                                    col.proyecto = i;
      if (h.includes('empresa') || h.includes('cliente'))           col.empresa  = i;
      if (h.includes('monto')  || h.includes('s/') || h.includes('importe')) col.monto = i;
    });
    // Monto por defecto: última columna
    if (col.monto < 0) col.monto = headerCells.length - 1;

    // Filas de datos
    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('td')).map(td => td.textContent.trim());
      if (cells.length < 2) continue;

      const montoRaw = cells[col.monto] || '';
      if (/total/i.test(montoRaw)) continue;               // fila de total
      const monto = parseFloat(montoRaw.replace(/[^\d.]/g, ''));
      if (isNaN(monto) || monto === 0) continue;           // fila vacía

      // Parsear fecha (DD/MM/YYYY → YYYY-MM-DD)
      let fecha = col.fecha >= 0 ? cells[col.fecha] || '' : '';
      const fmatch = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (fmatch) fecha = `${fmatch[3]}-${fmatch[2]}-${fmatch[1]}`;
      const isoMatch = fecha.match(/(\d{4}-\d{2}-\d{2})/);
      if (!isoMatch && !fmatch) continue; // fecha no reconocida

      detalles.push({
        fecha,
        motivo:          col.motivo   >= 0 ? (cells[col.motivo]   || '').trim() : '',
        origen:          col.origen   >= 0 ? (cells[col.origen]   || '').trim() || null : null,
        destino:         col.destino  >= 0 ? (cells[col.destino]  || '').trim() || null : null,
        proyecto:        col.proyecto >= 0 ? (cells[col.proyecto] || '').trim() || null : null,
        empresa_cliente: col.empresa  >= 0 ? (cells[col.empresa]  || '').trim() || null : null,
        monto,
        moneda: 'PEN',
      });
    }

    if (detalles.length) break;
  }

  // Fallback: buscar fechas + monto en texto plano
  if (!detalles.length) {
    const re = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)(?:\s|$)/gm;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const [d, mo, y] = m[1].split('/');
      detalles.push({
        fecha:  `${y}-${mo}-${d}`,
        motivo: m[2].trim(),
        origen: null, destino: null, proyecto: null, empresa_cliente: null,
        monto:  parseFloat(m[3].replace(',', '.')), moneda: 'PEN',
      });
    }
  }

  // Si no encontramos DNI, buscar en catálogo por nombre
  if (!trabDni && trabNombre) {
    const nombreLow = trabNombre.toLowerCase();
    const mt = PM_TRABAJADORES.find(t => t.nombre.toLowerCase() === nombreLow) ||
               PM_TRABAJADORES.find(t => nombreLow.includes(t.nombre.split(' ')[0].toLowerCase()));
    if (mt) trabDni = mt.dni;
  }

  return {
    documento_metadata: {
      titulo:          'PLANILLA POR GASTOS DE MOVILIDAD - POR TRABAJADOR',
      numero_planilla: numPlanilla,
      fecha_emision:   fechaEmis || new Date().toISOString().slice(0, 10),
    },
    empresa: {
      razon_social: empresa_activa?.nombre || '',
      ruc:          empresa_activa?.ruc    || '',
    },
    trabajador: {
      nombre_completo: trabNombre,
      dni:             trabDni,
    },
    detalle_movilidad: detalles,
    resumen_financiero: {
      total_gastos: detalles.reduce((s, d) => s + d.monto, 0),
      moneda: 'PEN',
    },
    estado_validacion: {
      firma_trabajador_presente: firma,
    },
  };
}

// ── Vista previa (genérica: JSON y Word) ──────────────────────────
function _pmiMostrarPreview(data) {
  const preview = document.getElementById('pm-import-preview');
  if (!preview) return;

  const meta      = data.documento_metadata || {};
  const empresa   = data.empresa            || {};
  const trab      = data.trabajador         || {};
  const detalles  = Array.isArray(data.detalle_movilidad) ? data.detalle_movilidad : [];
  const firma     = !!(data.estado_validacion?.firma_trabajador_presente);
  const total     = detalles.reduce((s, d) => s + Number(d.monto || 0), 0);
  const trabNombre = trab.nombre_completo || trab.nombre || '';
  const etiqueta  = _pmiFuenteArchivo === 'word' ? '📄 WORD IMPORTADO' : '📋 JSON IMPORTADO';

  if (!trabNombre) {
    preview.innerHTML = `<div class="alerta-error" style="margin-top:4px">⚠️ No se pudo detectar el trabajador. Verifica el nombre del archivo o la estructura del documento.</div>`;
    return;
  }
  if (!detalles.length) {
    preview.innerHTML = `<div class="alerta-error" style="margin-top:4px">⚠️ No se encontraron filas de desplazamiento en el documento. Asegúrate de que la tabla tenga encabezados con "Fecha" y "Motivo".</div>`;
    return;
  }

  preview.innerHTML = `
    <div style="border:1px solid var(--color-borde);border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

      <div style="background:var(--color-secundario);padding:12px 18px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700;font-size:14px">Vista previa — Planilla ${escapar(meta.numero_planilla || '(sin número)')}</div>
          <div style="font-size:11px;opacity:.85">Fecha: ${escapar(meta.fecha_emision || '—')}</div>
        </div>
        <span style="background:rgba(255,255,255,.22);padding:3px 12px;border-radius:10px;font-size:11px;font-weight:700">${etiqueta}</span>
      </div>

      <div style="padding:14px 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid var(--color-borde);font-size:12px">
        <div>
          <div style="color:var(--color-texto-suave);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Trabajador</div>
          <div style="font-weight:600">${escapar(trabNombre)}</div>
          <div style="color:var(--color-texto-suave)">DNI: ${escapar(trab.dni || '—')}</div>
        </div>
        <div>
          <div style="color:var(--color-texto-suave);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Empresa</div>
          <div style="font-weight:600">${escapar(empresa.razon_social || empresa_activa?.nombre || '—')}</div>
          <div style="color:var(--color-texto-suave)">RUC: ${escapar(empresa.ruc || empresa_activa?.ruc || '—')}</div>
        </div>
      </div>

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
                <td style="padding:5px 8px;max-width:200px">${escapar(d.motivo || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.origen || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.destino || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.proyecto || '—')}</td>
                <td style="padding:5px 8px">${escapar(d.empresa_cliente || '—')}</td>
                <td style="padding:5px 8px;text-align:right;font-weight:600;color:var(--color-secundario)">${Number(d.monto||0).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

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

  // Resolver DNI: catálogo → JSON → fallback vacío
  const dniDirecto = (trab.dni || '').toString().trim();
  const trabNombre = (trab.nombre_completo || trab.nombre || '').trim();
  const trabMatch  = PM_TRABAJADORES.find(t => t.dni === dniDirecto) ||
                     PM_TRABAJADORES.find(t => t.nombre.toLowerCase() === trabNombre.toLowerCase()) ||
                     PM_TRABAJADORES.find(t => trabNombre.toLowerCase().startsWith(t.nombre.split(' ')[0].toLowerCase()));
  const trabDni    = trabMatch?.dni || dniDirecto;

  // Período desde fecha_emision
  const fechaStr = (meta.fecha_emision || '').slice(0, 10);
  const mes      = fechaStr.slice(0, 7);

  const planillaData = {
    id:                null,
    numero_planilla:   meta.numero_planilla || '',
    mes,
    fecha_emision:     fechaStr || new Date().toISOString().slice(0, 10),
    trabajador_nombre: trabNombre,
    trabajador_dni:    trabDni,
    firma_trabajador:  firma,
    notas:             null,
    estado:            'BORRADOR',
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
