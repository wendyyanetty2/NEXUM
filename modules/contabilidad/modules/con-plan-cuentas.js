// ═══════════════════════════════════════════════════════════════
// Contabilidad — Plan de cuentas PCGE
// ═══════════════════════════════════════════════════════════════

let plan_lista     = [];
let plan_filtrada  = [];

const PCGE_BASE = [
  // Elemento 1
  { codigo: '1', nombre: 'ACTIVO DISPONIBLE Y EXIGIBLE',            tipo: 'ACTIVO',     nivel: 1, naturaleza: 'DEUDORA',   cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '10', nombre: 'Efectivo y equivalentes de efectivo',     tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '1',  acepta_movimientos: true  },
  { codigo: '12', nombre: 'Cuentas por cobrar comerciales - terceros', tipo: 'ACTIVO',   nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '1',  acepta_movimientos: true  },
  { codigo: '16', nombre: 'Cuentas por cobrar diversas - terceros',  tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '1',  acepta_movimientos: true  },
  { codigo: '18', nombre: 'Servicios y otros contratados por anticipado', tipo: 'ACTIVO', nivel: 2, naturaleza: 'DEUDORA',  cuenta_padre_codigo: '1',  acepta_movimientos: true  },
  { codigo: '19', nombre: 'Estimación de cuentas de cobranza dudosa', tipo: 'ACTIVO',    nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '1',  acepta_movimientos: true  },
  // Elemento 2
  { codigo: '2', nombre: 'ACTIVO REALIZABLE',                        tipo: 'ACTIVO',     nivel: 1, naturaleza: 'DEUDORA',   cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '20', nombre: 'Mercaderías',                             tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '2',  acepta_movimientos: true  },
  { codigo: '24', nombre: 'Materias primas',                         tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '2',  acepta_movimientos: true  },
  { codigo: '25', nombre: 'Materiales auxiliares, suministros y repuestos', tipo: 'ACTIVO', nivel: 2, naturaleza: 'DEUDORA', cuenta_padre_codigo: '2', acepta_movimientos: true  },
  { codigo: '29', nombre: 'Desvalorización de existencias',          tipo: 'ACTIVO',     nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '2',  acepta_movimientos: true  },
  // Elemento 3
  { codigo: '3', nombre: 'ACTIVO INMOVILIZADO',                      tipo: 'ACTIVO',     nivel: 1, naturaleza: 'DEUDORA',   cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '33', nombre: 'Inmuebles, maquinaria y equipo',          tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '3',  acepta_movimientos: true  },
  { codigo: '34', nombre: 'Intangibles',                             tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '3',  acepta_movimientos: true  },
  { codigo: '37', nombre: 'Activos diferidos',                       tipo: 'ACTIVO',     nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '3',  acepta_movimientos: true  },
  { codigo: '39', nombre: 'Depreciación y amortización acumulados',  tipo: 'ACTIVO',     nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '3',  acepta_movimientos: true  },
  // Elemento 4
  { codigo: '4', nombre: 'PASIVO',                                   tipo: 'PASIVO',     nivel: 1, naturaleza: 'ACREEDORA', cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '40', nombre: 'Tributos y aportes por pagar',            tipo: 'PASIVO',     nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  { codigo: '41', nombre: 'Remuneraciones y participaciones por pagar', tipo: 'PASIVO',  nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  { codigo: '42', nombre: 'Cuentas por pagar comerciales - terceros', tipo: 'PASIVO',    nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  { codigo: '45', nombre: 'Obligaciones financieras',                tipo: 'PASIVO',     nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  { codigo: '46', nombre: 'Cuentas por pagar diversas - terceros',   tipo: 'PASIVO',     nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  { codigo: '47', nombre: 'Cuentas por pagar diversas - relacionadas', tipo: 'PASIVO',   nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '4',  acepta_movimientos: true  },
  // Elemento 5
  { codigo: '5', nombre: 'PATRIMONIO',                               tipo: 'PATRIMONIO', nivel: 1, naturaleza: 'ACREEDORA', cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '50', nombre: 'Capital',                                 tipo: 'PATRIMONIO', nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '5',  acepta_movimientos: true  },
  { codigo: '58', nombre: 'Reservas',                                tipo: 'PATRIMONIO', nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '5',  acepta_movimientos: true  },
  { codigo: '59', nombre: 'Resultados acumulados',                   tipo: 'PATRIMONIO', nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '5',  acepta_movimientos: true  },
  // Elemento 6
  { codigo: '6', nombre: 'GASTOS',                                   tipo: 'GASTO',      nivel: 1, naturaleza: 'DEUDORA',   cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '60', nombre: 'Compras',                                 tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '62', nombre: 'Gastos de personal',                      tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '63', nombre: 'Gastos de servicios de terceros',         tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '64', nombre: 'Gastos por tributos',                     tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '65', nombre: 'Otros gastos de gestión',                 tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '67', nombre: 'Gastos financieros',                      tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  { codigo: '69', nombre: 'Costo de ventas',                         tipo: 'GASTO',      nivel: 2, naturaleza: 'DEUDORA',   cuenta_padre_codigo: '6',  acepta_movimientos: true  },
  // Elemento 7
  { codigo: '7', nombre: 'INGRESOS',                                 tipo: 'INGRESO',    nivel: 1, naturaleza: 'ACREEDORA', cuenta_padre_codigo: null, acepta_movimientos: false },
  { codigo: '70', nombre: 'Ventas',                                  tipo: 'INGRESO',    nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '7',  acepta_movimientos: true  },
  { codigo: '75', nombre: 'Otros ingresos de gestión',               tipo: 'INGRESO',    nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '7',  acepta_movimientos: true  },
  { codigo: '77', nombre: 'Ingresos financieros',                    tipo: 'INGRESO',    nivel: 2, naturaleza: 'ACREEDORA', cuenta_padre_codigo: '7',  acepta_movimientos: true  },
];

async function renderTabPlanCuentas(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="pc-buscar" type="text" class="input-buscar" placeholder="Buscar código o nombre…"
                 oninput="filtrarPlanCuentas()" style="max-width:240px">
          <select id="pc-tipo" onchange="filtrarPlanCuentas()" class="input-buscar" style="max-width:160px">
            <option value="">Todos los tipos</option>
            <option value="ACTIVO">Activo</option>
            <option value="PASIVO">Pasivo</option>
            <option value="PATRIMONIO">Patrimonio</option>
            <option value="INGRESO">Ingreso</option>
            <option value="GASTO">Gasto</option>
            <option value="ORDEN">Orden</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secundario btn-sm" onclick="exportarPlanExcel()">⬇ Excel</button>
          <button class="btn btn-secundario btn-sm" id="btn-importar-pcge" onclick="importarPCGEBase()" style="display:none">📥 Importar PCGE base</button>
          <button class="btn btn-primario btn-sm"   onclick="abrirModalCuenta(null)">+ Nueva cuenta</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Código</th><th>Nombre</th><th>Tipo</th><th>Naturaleza</th>
            <th>Nivel</th><th>Acepta mov.</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody id="tbody-plan"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal cuenta -->
    <div class="modal-overlay" id="modal-cuenta-pc" style="display:none">
      <div class="modal" style="max-width:540px">
        <div class="modal-header">
          <h3 id="modal-pc-titulo">Nueva cuenta</h3>
          <button class="modal-cerrar" onclick="cerrarModalCuenta()">✕</button>
        </div>
        <div class="modal-body">
          <div id="alerta-pc" class="alerta-error"></div>
          <input type="hidden" id="pc-id">
          <div class="grid-2">
            <div class="campo">
              <label>Código <span class="req">*</span></label>
              <input type="text" id="pc-codigo" placeholder="Ej: 1011">
            </div>
            <div class="campo">
              <label>Nivel</label>
              <select id="pc-nivel">
                <option value="1">1 — Elemento</option>
                <option value="2" selected>2 — Cuenta</option>
                <option value="3">3 — Subcuenta</option>
                <option value="4">4 — Divisionaria</option>
              </select>
            </div>
            <div class="campo col-2">
              <label>Nombre <span class="req">*</span></label>
              <input type="text" id="pc-nombre" placeholder="Nombre de la cuenta">
            </div>
            <div class="campo">
              <label>Tipo <span class="req">*</span></label>
              <select id="pc-tipo-f">
                <option value="ACTIVO">Activo</option>
                <option value="PASIVO">Pasivo</option>
                <option value="PATRIMONIO">Patrimonio</option>
                <option value="INGRESO">Ingreso</option>
                <option value="GASTO">Gasto</option>
                <option value="ORDEN">Orden</option>
              </select>
            </div>
            <div class="campo">
              <label>Naturaleza</label>
              <select id="pc-naturaleza">
                <option value="DEUDORA">Deudora</option>
                <option value="ACREEDORA">Acreedora</option>
              </select>
            </div>
            <div class="campo">
              <label>Cuenta padre (código)</label>
              <input type="text" id="pc-padre" placeholder="Ej: 10">
            </div>
            <div class="campo" style="display:flex;align-items:center;gap:8px;padding-top:20px">
              <input type="checkbox" id="pc-acepta" checked style="width:auto">
              <label style="margin:0">Acepta movimientos</label>
            </div>
            <div class="campo" style="display:flex;align-items:center;gap:8px;padding-top:20px">
              <input type="checkbox" id="pc-activo" checked style="width:auto">
              <label style="margin:0">Activa</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCuenta()">Cancelar</button>
          <button class="btn btn-primario"   onclick="guardarCuenta()" id="btn-guardar-pc">Guardar</button>
        </div>
      </div>
    </div>`;

  await cargarPlanCuentas();
}

async function cargarPlanCuentas() {
  const { data, error } = await _supabase
    .from('plan_cuentas')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('codigo');
  if (error) { mostrarToast('Error al cargar plan de cuentas: ' + error.message, 'error'); return; }
  plan_lista = data || [];
  if (!plan_lista.length) {
    const btn = document.getElementById('btn-importar-pcge');
    if (btn) btn.style.display = 'inline-flex';
  }
  filtrarPlanCuentas();
}

function filtrarPlanCuentas() {
  const q    = (document.getElementById('pc-buscar')?.value || '').toLowerCase();
  const tipo = document.getElementById('pc-tipo')?.value || '';
  plan_filtrada = plan_lista.filter(c =>
    (!q || c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)) &&
    (!tipo || c.tipo === tipo)
  );
  renderTablaPlan();
}

function renderTablaPlan() {
  const tbody = document.getElementById('tbody-plan');
  if (!tbody) return;
  const coloresTipo = {
    ACTIVO: 'badge-info', PASIVO: 'badge-warning', PATRIMONIO: 'badge-primario',
    INGRESO: 'badge-activo', GASTO: 'badge-critico', ORDEN: 'badge-inactivo',
  };
  tbody.innerHTML = plan_filtrada.length ? plan_filtrada.map(c => `
    <tr>
      <td class="text-mono"><strong>${escapar(c.codigo)}</strong></td>
      <td style="padding-left:${(c.nivel - 1) * 16}px">${escapar(c.nombre)}</td>
      <td><span class="badge ${coloresTipo[c.tipo] || 'badge-info'}" style="font-size:11px">${c.tipo}</span></td>
      <td class="text-sm">${c.naturaleza}</td>
      <td class="text-center">${c.nivel}</td>
      <td class="text-center">${c.acepta_movimientos ? '<span class="badge badge-activo">Sí</span>' : '<span class="badge badge-inactivo">No</span>'}</td>
      <td><span class="badge ${c.activo ? 'badge-activo' : 'badge-inactivo'}">${c.activo ? 'Activa' : 'Inactiva'}</span></td>
      <td>
        <button class="btn-icono" onclick="abrirModalCuenta('${c.id}')">✏️</button>
        <button class="btn-icono peligro" onclick="eliminarCuentaPlan('${c.id}','${escapar(c.codigo)}','${escapar(c.nombre)}')">🗑️</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="8" class="text-center text-muted">Sin cuentas registradas</td></tr>';
}

async function importarPCGEBase() {
  if (!await confirmar('¿Importar el plan de cuentas PCGE base? Se agregarán los elementos y cuentas principales.', { btnOk: 'Importar', btnColor: 'var(--color-primario)' })) return;
  const rows = PCGE_BASE.map(c => ({ ...c, empresa_operadora_id: empresa_activa.id, activo: true }));
  const { error } = await _supabase.from('plan_cuentas').insert(rows);
  if (error) { mostrarToast('Error al importar: ' + error.message, 'error'); return; }
  mostrarToast('Plan PCGE importado correctamente', 'exito');
  const btn = document.getElementById('btn-importar-pcge');
  if (btn) btn.style.display = 'none';
  await cargarPlanCuentas();
}

function abrirModalCuenta(id) {
  document.getElementById('alerta-pc').classList.remove('visible');
  if (id) {
    const c = plan_lista.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-pc-titulo').textContent = 'Editar cuenta';
    document.getElementById('pc-id').value        = c.id;
    document.getElementById('pc-codigo').value    = c.codigo;
    document.getElementById('pc-nombre').value    = c.nombre;
    document.getElementById('pc-tipo-f').value    = c.tipo;
    document.getElementById('pc-naturaleza').value = c.naturaleza;
    document.getElementById('pc-nivel').value     = String(c.nivel);
    document.getElementById('pc-padre').value     = c.cuenta_padre_codigo || '';
    document.getElementById('pc-acepta').checked  = c.acepta_movimientos;
    document.getElementById('pc-activo').checked  = c.activo;
  } else {
    document.getElementById('modal-pc-titulo').textContent = 'Nueva cuenta';
    ['pc-id','pc-codigo','pc-nombre','pc-padre'].forEach(i => { document.getElementById(i).value = ''; });
    document.getElementById('pc-tipo-f').value    = 'ACTIVO';
    document.getElementById('pc-naturaleza').value = 'DEUDORA';
    document.getElementById('pc-nivel').value     = '2';
    document.getElementById('pc-acepta').checked  = true;
    document.getElementById('pc-activo').checked  = true;
  }
  document.getElementById('modal-cuenta-pc').style.display = 'flex';
}

function cerrarModalCuenta() { document.getElementById('modal-cuenta-pc').style.display = 'none'; }

async function guardarCuenta() {
  const codigo = document.getElementById('pc-codigo').value.trim();
  const nombre = document.getElementById('pc-nombre').value.trim();
  const alerta = document.getElementById('alerta-pc');
  const btn    = document.getElementById('btn-guardar-pc');
  alerta.classList.remove('visible');
  if (!codigo) { alerta.textContent = 'El código es obligatorio.'; alerta.classList.add('visible'); return; }
  if (!nombre) { alerta.textContent = 'El nombre es obligatorio.'; alerta.classList.add('visible'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const id = document.getElementById('pc-id').value;
  const payload = {
    empresa_operadora_id: empresa_activa.id,
    codigo,
    nombre,
    tipo:               document.getElementById('pc-tipo-f').value,
    naturaleza:         document.getElementById('pc-naturaleza').value,
    nivel:              parseInt(document.getElementById('pc-nivel').value),
    cuenta_padre_codigo: document.getElementById('pc-padre').value.trim() || null,
    acepta_movimientos: document.getElementById('pc-acepta').checked,
    activo:             document.getElementById('pc-activo').checked,
  };
  const { error } = id
    ? await _supabase.from('plan_cuentas').update(payload).eq('id', id)
    : await _supabase.from('plan_cuentas').insert(payload);
  btn.disabled = false; btn.textContent = 'Guardar';
  if (error) { alerta.textContent = error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Cuenta actualizada' : 'Cuenta creada', 'exito');
  cerrarModalCuenta();
  await cargarPlanCuentas();
}

async function eliminarCuentaPlan(id, codigo, nombre) {
  const { count } = await _supabase
    .from('asiento_detalle')
    .select('id', { count: 'exact', head: true })
    .eq('cuenta_codigo', codigo);
  if (count > 0) { mostrarToast('No se puede eliminar: la cuenta tiene asientos registrados.', 'atencion'); return; }
  if (!await confirmar(`¿Eliminar la cuenta "${codigo} — ${nombre}"?`, { btnOk: 'Eliminar' })) return;
  const { error } = await _supabase.from('plan_cuentas').delete().eq('id', id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('Cuenta eliminada', 'exito');
  await cargarPlanCuentas();
}

function exportarPlanExcel() {
  if (!plan_lista.length) { mostrarToast('No hay cuentas para exportar', 'atencion'); return; }
  const rows = plan_lista.map(c => ({
    Código: c.codigo,
    Nombre: c.nombre,
    Tipo: c.tipo,
    Naturaleza: c.naturaleza,
    Nivel: c.nivel,
    'Cuenta Padre': c.cuenta_padre_codigo || '',
    'Acepta Movimientos': c.acepta_movimientos ? 'Sí' : 'No',
    Estado: c.activo ? 'Activa' : 'Inactiva',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan de Cuentas');
  XLSX.writeFile(wb, `plan_cuentas_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
