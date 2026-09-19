/**
 * NEXUM v3.0 - Utilidades generales
 * Formato peruano: DD/MM/YYYY, S/. 1,234.56
 */

// ── Formato de fecha ───────────────────────────────────────────────────────────
function formatearFecha(fecha) {
  if (!fecha) return '—';
  // Fechas solo-date (YYYY-MM-DD, 10 chars) se interpretan como UTC en JS,
  // causando desfase de un día en zonas UTC negativas (ej. Perú UTC-5).
  // Al agregar T00:00:00 forzamos interpretación en hora local.
  const str = (typeof fecha === 'string' && fecha.length === 10)
    ? fecha + 'T00:00:00'
    : fecha;
  const d = new Date(str);
  if (isNaN(d)) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function fechaHoy() {
  return formatearFecha(new Date());
}

// ── Formato de moneda ──────────────────────────────────────────────────────────
function formatearMoneda(monto, moneda = 'PEN') {
  if (monto === null || monto === undefined) return '—';
  const num = parseFloat(monto);
  if (isNaN(num)) return '—';
  const formateado = num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return moneda === 'USD' ? `$ ${formateado}` : `S/ ${formateado}`;
}

// ── Toast de notificaciones ────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
  const colores = {
    exito:    { bg: '#2F855A', icono: '✓' },
    error:    { bg: '#C53030', icono: '✕' },
    atencion: { bg: '#D69E2E', icono: '⚠' },
    info:     { bg: '#2C5282', icono: 'ℹ' }
  };
  const conf = colores[tipo] || colores.info;

  const contenedor = document.getElementById('toast-contenedor') || crearContenedorToast();
  const toast = document.createElement('div');
  toast.className = 'nexum-toast';
  toast.style.cssText = `
    background:${conf.bg}; color:#fff; padding:12px 18px; border-radius:8px;
    display:flex; align-items:center; gap:10px; font-size:14px;
    box-shadow:0 4px 12px rgba(0,0,0,0.25); max-width:360px;
    animation: slideIn 0.3s ease; pointer-events:auto;
  `;
  toast.innerHTML = `<span style="font-size:18px">${conf.icono}</span><span>${mensaje}</span>`;
  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 280);
  }, duracion);
}

function crearContenedorToast() {
  const div = document.createElement('div');
  div.id = 'toast-contenedor';
  div.style.cssText = `
    position:fixed; top:20px; right:20px; z-index:9999;
    display:flex; flex-direction:column; gap:8px; pointer-events:none;
  `;
  document.body.appendChild(div);
  return div;
}

// ── Modal de confirmación ──────────────────────────────────────────────────────
function confirmar(mensaje, { btnOk = 'Confirmar', btnColor = '#C53030' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center; z-index:9998;
    `;
    overlay.innerHTML = `
      <div style="background:var(--color-bg-card); border-radius:12px; padding:28px 32px; max-width:380px;
                  box-shadow:var(--sombra-lg); text-align:center; border:1px solid var(--color-borde);">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <p style="color:var(--color-texto); font-size:15px; margin-bottom:24px; line-height:1.5; white-space:pre-line;">${mensaje}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="btn-cancelar" style="padding:10px 24px; border:1px solid var(--color-borde);
            border-radius:8px; background:var(--color-bg-card); color:var(--color-texto); cursor:pointer; font-size:14px; font-family:var(--font);">
            Cancelar
          </button>
          <button id="btn-confirmar" style="padding:10px 24px; border:none;
            border-radius:8px; background:${btnColor}; color:#fff; cursor:pointer; font-size:14px; font-family:var(--font); font-weight:500;">
            ${btnOk}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-confirmar').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#btn-cancelar').onclick  = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// ── Sanitizar texto para XSS ──────────────────────────────────────────────────
function escapar(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Validar RUC peruano (11 dígitos) ──────────────────────────────────────────
function validarRUC(ruc) {
  return /^\d{11}$/.test(ruc);
}

// ── Validar DNI peruano (8 dígitos) ───────────────────────────────────────────
function validarDNI(dni) {
  return /^\d{8}$/.test(dni);
}

// ── Truncar texto largo ────────────────────────────────────────────────────────
function truncar(texto, largo = 30) {
  if (!texto) return '—';
  return texto.length > largo ? texto.substring(0, largo) + '…' : texto;
}

// ── Blindaje contra autocompletado no deseado (Chrome / LastPass / 1Password / Bitwarden / Dashlane) ──
// Los campos del sistema (buscadores, montos, RUC, N° doc, etc.) no deben autocompletarse
// con datos guardados del navegador. Se excluye el formulario de login/recuperar, donde
// SÍ queremos que el navegador ofrezca el correo/contraseña guardados.
(function blindarAutocompletado() {
  const FORMULARIOS_EXCLUIDOS = ['form-login', 'form-recuperar'];
  const TIPOS_EXCLUIDOS = ['password','checkbox','radio','hidden','file','submit','button',
    'range','color','date','month','week','time','datetime-local'];

  function blindarInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.dataset.afBlindado) return;
    const form = input.closest('form');
    if (form && FORMULARIOS_EXCLUIDOS.includes(form.id)) return;
    const tipo = (input.type || 'text').toLowerCase();
    if (TIPOS_EXCLUIDOS.includes(tipo)) return;

    input.dataset.afBlindado = '1';
    // Chrome ignora "autocomplete=off" en campos que su heurística de direcciones/
    // contactos reconoce (nombre, email, teléfono) — es un comportamiento del propio
    // navegador, no de un gestor de contraseñas. "new-password" sí lo respeta en la
    // práctica porque Chrome lo trata como campo sensible y no ofrece autocompletar
    // datos de perfil guardados. Se fuerza siempre, aunque el input ya traiga
    // autocomplete="off" puesto manualmente, para blindar parejo todo el sistema.
    input.setAttribute('autocomplete', 'new-password');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-bwignore', 'true');
    input.setAttribute('data-form-type', 'other');

    if (!input.readOnly && !input.disabled) {
      input.setAttribute('readonly', 'readonly');
      input.addEventListener('focus', () => input.removeAttribute('readonly'), { once: true });
    }

    // Red de seguridad final: en Chrome, "autocomplete=off/new-password" y el
    // truco de readonly no siempre alcanzan — el propio navegador puede seguir
    // insertando un valor guardado (correo, nombre) sin que el usuario haya
    // tecleado nada. Cuando el navegador autocompleta, el evento "input" que
    // dispara trae inputType "insertReplacementText" (o ninguno); cuando el
    // usuario escribe de verdad, siempre es "insertText". Si detectamos ese
    // patrón, se borra el valor al instante.
    //
    // Se EXCLUYEN los campos con list="..." (datalist): ahí el autocompletado
    // de proveedor/cuenta contable SÍ es una función propia de NEXUM y debe
    // funcionar normal — no es el autorrelleno no deseado del navegador.
    if (!input.hasAttribute('list')) {
      input.addEventListener('input', (e) => {
        const pareceAutocompletadoNavegador =
          e.inputType === 'insertReplacementText' || e.inputType === 'insertFromDrop' || !e.inputType;
        if (pareceAutocompletadoNavegador && input.value) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  }

  function blindarTodos(raiz) {
    if (raiz.tagName === 'INPUT') blindarInput(raiz);
    if (raiz.querySelectorAll) raiz.querySelectorAll('input').forEach(blindarInput);
  }

  document.addEventListener('DOMContentLoaded', () => blindarTodos(document));

  new MutationObserver(mutaciones => {
    for (const m of mutaciones) {
      m.addedNodes.forEach(nodo => { if (nodo.nodeType === 1) blindarTodos(nodo); });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

// ── Animaciones CSS dinámicas ──────────────────────────────────────────────────
(function inyectarAnimaciones() {
  if (document.getElementById('nexum-animations')) return;
  const style = document.createElement('style');
  style.id = 'nexum-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(120%); opacity: 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fadeIn { animation: fadeIn 0.25s ease; }
  `;
  document.head.appendChild(style);
})();


/* ============================================================
   NEXUM — NUNCA mostrar códigos internos (UUID)      (Wendy, 2026-09-19)
   Los códigos UUID existen SOLO por dentro (ids de la base de datos y del
   programa). En pantalla, botones, mensajes, reportes y descargas se debe ver
   siempre el dato legible: nombre, N° de comprobante, etc. Tres piezas:
     1) nexumNroLegible / nexumPrecargarNumerosRH — traducen un código de RH al N° del RH.
     2) Seguro de pantalla: si por cualquier motivo un UUID llega a un texto visible, se
        reemplaza por el N° legible (si se conoce) o por "(sin N° legible)".
     3) Seguro de Excel: lo mismo en cada celda de cada archivo descargado, salvo la hoja
        técnica oculta RAW_DATA del Histórico (necesaria para restaurar).
   ============================================================ */
const NEXUM_TEXTO_SIN_NUMERO = '(sin N° legible)';
const _NEXUM_UUID_EXACTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const _NEXUM_UUID_BUSCAR = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const _NEXUM_UUID_TODOS  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const _nexumRHNumeros = new Map(); // código (minúsculas) → N° legible del RH

function nexumEsUUID(v) { return _NEXUM_UUID_EXACTO.test(String(v ?? '').trim()); }

// Sustituye cada UUID de un texto por el N° legible del RH (si ya se conoce) o por un aviso neutro.
function nexumLimpiarTexto(s) {
  if (typeof s !== 'string' || s.length < 36 || s.indexOf('-') < 0 || !_NEXUM_UUID_BUSCAR.test(s)) return s;
  return s.replace(_NEXUM_UUID_TODOS, m => _nexumRHNumeros.get(m.toLowerCase()) || NEXUM_TEXTO_SIN_NUMERO);
}

// N° de comprobante listo para mostrar: si es un código de RH, su N° legible; si no se conoce, un aviso
// neutro (nunca el código).
function nexumNroLegible(v) {
  if (v == null) return v;
  return nexumEsUUID(v) ? (_nexumRHNumeros.get(String(v).trim().toLowerCase()) || NEXUM_TEXTO_SIN_NUMERO) : v;
}

// Carga en memoria el N° de RH de los códigos indicados (los que aún no se conocen) para que
// nexumNroLegible / los seguros los traduzcan. Acepta códigos sueltos o un arreglo.
async function nexumPrecargarNumerosRH(valores) {
  try {
    const ids = [...new Set([].concat(valores || []).map(v => String(v ?? '').trim()).filter(nexumEsUUID))]
      .filter(id => !_nexumRHNumeros.has(id.toLowerCase()));
    if (!ids.length || typeof _supabase === 'undefined') return;
    for (let i = 0; i < ids.length; i += 80) {
      const { data } = await _supabase.from('rh_registros').select('id,numero_rh').in('id', ids.slice(i, i + 80));
      (data || []).forEach(r => { if (r.numero_rh) _nexumRHNumeros.set(String(r.id).toLowerCase(), r.numero_rh); });
    }
  } catch (e) { /* solo mejora la lectura: si falla, se muestra el aviso neutro */ }
}

// Ir a Conciliación a buscar un comprobante SIN poner su código en la barra de direcciones.
function nexumIrAConciliar(tipo, id) {
  try { sessionStorage.setItem('nexum_buscar_comprobante', JSON.stringify({ tipo, id })); window.location.href = '/modules/conciliacion/index.html'; }
  catch (e) { window.location.href = `/modules/conciliacion/index.html?buscar=${encodeURIComponent(id)}&tipo=${encodeURIComponent(tipo)}`; }
}

// Libro de Excel sin códigos: cada celda de texto se limpia, salvo la hoja técnica RAW_DATA.
function nexumLimpiarLibro(wb) {
  Object.keys((wb && wb.Sheets) || {}).forEach(nombre => {
    if (nombre === 'RAW_DATA') return;
    const ws = wb.Sheets[nombre];
    Object.keys(ws).forEach(ref => {
      if (ref[0] === '!') return;
      const c = ws[ref];
      if (c && c.t === 's' && typeof c.v === 'string') {
        const limpio = nexumLimpiarTexto(c.v);
        if (limpio !== c.v) { c.v = limpio; if (c.w !== undefined) c.w = limpio; }
      }
    });
  });
}

(function nexumBlindarExcel() {
  if (typeof XLSX === 'undefined' || !XLSX.writeFile || XLSX._nexumBlindado) return;
  const original = XLSX.writeFile;
  XLSX.writeFile = function (wb, ...resto) {
    try { nexumLimpiarLibro(wb); } catch (e) { console.warn('[nexum] no se pudo limpiar el libro', e); }
    return original.call(this, wb, ...resto);
  };
  XLSX._nexumBlindado = true;
})();

(function nexumBlindarPantalla() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const SALTAR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  const limpiarTextoNodo = n => {
    const t = n.nodeValue;
    if (!t || t.length < 36) return;
    const limpio = nexumLimpiarTexto(t);
    if (limpio !== t) n.nodeValue = limpio;
  };
  function limpiarNodo(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { if (!(raiz.parentNode && SALTAR[raiz.parentNode.tagName])) limpiarTextoNodo(raiz); return; }
    if (raiz.nodeType !== 1 || SALTAR[raiz.tagName]) return;
    const w = document.createTreeWalker(raiz, 4 /* NodeFilter.SHOW_TEXT */, null);
    const lista = [];
    while (w.nextNode()) { const n = w.currentNode; if (!(n.parentNode && SALTAR[n.parentNode.tagName])) lista.push(n); }
    lista.forEach(limpiarTextoNodo);
    const conTitulo = raiz.querySelectorAll ? raiz.querySelectorAll('[title]') : [];
    [raiz, ...conTitulo].forEach(el => {
      const t = el.getAttribute && el.getAttribute('title');
      if (t && t.length >= 36) { const limpio = nexumLimpiarTexto(t); if (limpio !== t) el.setAttribute('title', limpio); }
    });
  }
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') { if (!(m.target.parentNode && SALTAR[m.target.parentNode.tagName])) limpiarTextoNodo(m.target); }
      else m.addedNodes.forEach(limpiarNodo);
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', () => limpiarNodo(document.body));
})();
