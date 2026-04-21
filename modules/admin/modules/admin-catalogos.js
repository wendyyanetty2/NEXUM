/**
 * NEXUM v3.0 — Admin: Catálogos globales (solo lectura para no super-admin)
 */

async function renderTabCatalogos(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <p class="text-muted" style="margin-bottom:16px">
        Los catálogos globales son compartidos por todas las empresas.
        ${perfil_usuario?.es_super_admin
          ? 'Como super-admin puedes editar su estado activo/inactivo.'
          : 'Solo el super-admin puede modificarlos.'}
      </p>

      <!-- Sub-tabs de catálogos -->
      <div style="display:flex; gap:4px; margin-bottom:20px; flex-wrap:wrap;">
        ${['monedas','bancos','tipos_doc','tipos_op','estados'].map((c, i) => `
          <button class="tab-btn ${i===0?'activo':''}" id="ctab-${c}" onclick="activarCatalogo('${c}')">
            ${nombreCatalogo(c)}
          </button>`).join('')}
      </div>

      <div id="contenido-catalogo">
        <div class="cargando"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  activarCatalogo('monedas');
}

function nombreCatalogo(c) {
  return { monedas:'💰 Monedas', bancos:'🏦 Bancos', tipos_doc:'📄 Tipos doc.',
           tipos_op:'⚡ Tipos operación', estados:'🔘 Estados' }[c] || c;
}

function activarCatalogo(cat) {
  document.querySelectorAll('#contenido-tab .tab-btn').forEach(b => {
    if (b.id?.startsWith('ctab-')) b.classList.remove('activo');
  });
  const btn = document.getElementById('ctab-' + cat);
  if (btn) btn.classList.add('activo');

  const area = document.getElementById('contenido-catalogo');
  const tablas = {
    monedas:    { tabla: 'catalogo_monedas',          cols: ['codigo','nombre','simbolo'], headers: ['Código','Nombre','Símbolo'] },
    bancos:     { tabla: 'catalogo_bancos',            cols: ['codigo','nombre','nombre_corto'], headers: ['Código','Nombre','Nombre corto'] },
    tipos_doc:  { tabla: 'catalogo_tipos_documento',   cols: ['codigo','nombre'], headers: ['Código','Nombre'] },
    tipos_op:   { tabla: 'catalogo_tipos_operacion',   cols: ['codigo','nombre','naturaleza'], headers: ['Código','Nombre','Naturaleza'] },
    estados:    { tabla: 'catalogo_estados',            cols: ['codigo','nombre','modulo','color'], headers: ['Código','Nombre','Módulo','Color'] }
  };
  cargarCatalogo(cat, tablas[cat], area);
}

async function cargarCatalogo(cat, config, area) {
  area.innerHTML = `<div class="cargando"><div class="spinner"></div></div>`;

  const { data, error } = await _supabase
    .from(config.tabla)
    .select('*')
    .order('codigo');

  if (error) { area.innerHTML = `<div class="alerta-error visible">Error al cargar catálogo.</div>`; return; }

  const esSA = perfil_usuario?.es_super_admin;

  area.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
      <span class="text-muted text-sm">${data.length} registros</span>
      <button class="btn btn-secundario btn-sm" onclick="exportarCatalogoExcel('${cat}', '${config.tabla}')">
        ⬇️ Exportar Excel
      </button>
    </div>
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            ${config.headers.map(h => `<th>${h}</th>`).join('')}
            <th>Estado</th>
            ${esSA ? '<th>Acción</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${config.cols.map(col => {
                if (col === 'color') return `
                  <td data-label="Color">
                    <div style="display:flex; align-items:center; gap:8px">
                      <div style="width:18px;height:18px;border-radius:4px;background:${escapar(row[col] || '#ccc')}"></div>
                      <span>${escapar(row[col] || '—')}</span>
                    </div>
                  </td>`;
                return `<td data-label="${col}">${escapar(row[col] || '—')}</td>`;
              }).join('')}
              <td data-label="Estado">
                <span class="badge ${row.activo ? 'badge-activo' : 'badge-inactivo'}">
                  ${row.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              ${esSA ? `
                <td>
                  <button class="btn btn-${row.activo ? 'atencion' : 'exito'} btn-sm"
                          onclick="toggleCatalogo('${config.tabla}','${row.id}',${row.activo})">
                    ${row.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function toggleCatalogo(tabla, id, estadoActual) {
  const nuevoEstado = !estadoActual;
  const { error } = await _supabase.from(tabla).update({ activo: nuevoEstado }).eq('id', id);
  if (error) { mostrarToast('Error al actualizar', 'error'); return; }
  await registrarHistorial(tabla, id, 'EDITAR', { activo: estadoActual }, { activo: nuevoEstado });
  mostrarToast(`Registro ${nuevoEstado ? 'activado' : 'desactivado'}`, 'exito');

  // Refrescar la pestaña actual
  const tabActiva = document.querySelector('[id^="ctab-"].activo');
  if (tabActiva) activarCatalogo(tabActiva.id.replace('ctab-', ''));
}

async function exportarCatalogoExcel(cat, tabla) {
  const { data } = await _supabase.from(tabla).select('*').order('codigo');
  if (!data?.length) { mostrarToast('No hay datos', 'atencion'); return; }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), nombreCatalogo(cat).replace(/[^\w\s]/g,'').trim());
  XLSX.writeFile(wb, `NEXUM_${tabla}_${fechaHoy().replace(/\//g,'-')}.xlsx`);
  mostrarToast('Excel exportado', 'exito');
}
