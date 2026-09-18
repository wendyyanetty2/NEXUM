// ═══════════════════════════════════════════════════════════════
// Copiar catálogo desde otra empresa (Wendy, 2026-09-18): traer a la
// empresa activa los registros de Clientes/Proveedores, Conceptos o
// Autorizaciones que ya existen en otra empresa (ej. JVÑ → PEVAL) y
// todavía no están aquí. SOLO inserta lo que falta — nunca modifica ni
// borra nada existente; los duplicados que sobren los revisa y elimina
// Wendy a mano desde la tabla, como en cualquier otro registro.
// ═══════════════════════════════════════════════════════════════

// Qué campos se copian de cada tabla (nunca id, empresa_operadora_id
// ni fechas — esos los pone el insert).
const _CAT_COPIAR_CAMPOS = {
  empresas_clientes: ['nombre', 'ruc_dni', 'tipo', 'direccion', 'email', 'telefono', 'activo'],
  conceptos:         ['nombre', 'tipo', 'activo'],
  autorizaciones:    ['nombre', 'cargo', 'activo'],
};

function _catNombreNorm(v) {
  return (v || '').toString().trim().toLowerCase();
}

async function abrirModalCopiarCatalogo(tabla, etiqueta, recargarFn) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <h3>📥 Copiar ${escapar(etiqueta)} desde otra empresa</h3>
          <button class="modal-cerrar" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <div class="modal-body">
          <div id="catcop-alerta" class="alerta-error"></div>
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px">
            Se copiarán a esta empresa solo los registros que todavía no existan aquí (comparando por nombre). Nada se modifica ni se borra.
          </p>
          <div class="campo">
            <label>Empresa de origen</label>
            <select id="catcop-origen"><option value="">Cargando…</option></select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="document.getElementById('modal-container').innerHTML=''">Cancelar</button>
          <button class="btn btn-primario" id="catcop-btn" onclick="_catEjecutarCopia('${tabla}','${escapar(etiqueta)}','${recargarFn}')">Copiar</button>
        </div>
      </div>
    </div>`;

  const empresas = await cargarEmpresasDelUsuario();
  const sel = document.getElementById('catcop-origen');
  const otras = (empresas || []).filter(e => e.id !== empresa_activa.id);
  if (!otras.length) {
    sel.innerHTML = '<option value="">No tienes acceso a otra empresa</option>';
    return;
  }
  sel.innerHTML = otras.map(e => `<option value="${e.id}">${escapar(e.nombre)}</option>`).join('');
}

async function _catEjecutarCopia(tabla, etiqueta, recargarFn) {
  const origenId = document.getElementById('catcop-origen')?.value;
  const alerta = document.getElementById('catcop-alerta');
  const btn = document.getElementById('catcop-btn');
  alerta.classList.remove('visible');
  if (!origenId) { alerta.textContent = 'Selecciona la empresa de origen.'; alerta.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Copiando…';

  const campos = _CAT_COPIAR_CAMPOS[tabla];
  const [{ data: origenRows, error: errOrigen }, { data: actualesRows, error: errActual }] = await Promise.all([
    _supabase.from(tabla).select('*').eq('empresa_operadora_id', origenId),
    _supabase.from(tabla).select('nombre').eq('empresa_operadora_id', empresa_activa.id),
  ]);

  btn.disabled = false; btn.textContent = 'Copiar';
  if (errOrigen || errActual) {
    alerta.textContent = 'Error al leer: ' + (errOrigen || errActual).message;
    alerta.classList.add('visible');
    return;
  }

  const existentes = new Set((actualesRows || []).map(r => _catNombreNorm(r.nombre)));
  const vistosEnLote = new Set();
  const faltantes = (origenRows || []).filter(r => {
    const n = _catNombreNorm(r.nombre);
    if (!n || existentes.has(n) || vistosEnLote.has(n)) return false;
    vistosEnLote.add(n);
    return true;
  });

  if (!faltantes.length) {
    mostrarToast(`Ya tienes todos los registros de esa empresa en ${etiqueta}.`, 'info');
    document.getElementById('modal-container').innerHTML = '';
    return;
  }

  const payload = faltantes.map(r => {
    const fila = { empresa_operadora_id: empresa_activa.id };
    campos.forEach(c => { fila[c] = r[c] ?? null; });
    return fila;
  });

  const { error } = await _supabase.from(tabla).insert(payload);
  if (error) { alerta.textContent = 'Error al copiar: ' + error.message; alerta.classList.add('visible'); return; }

  mostrarToast(`✓ ${faltantes.length} registro(s) copiado(s) a ${etiqueta}.`, 'exito');
  document.getElementById('modal-container').innerHTML = '';
  if (typeof window[recargarFn] === 'function') window[recargarFn]();
}
