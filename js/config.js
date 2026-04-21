/**
 * NEXUM v3.0 - Configuración global de Supabase
 * Credenciales públicas del cliente (anon key es segura en frontend)
 */

const NEXUM_CONFIG = {
  supabase: {
    url: 'https://ncfnhjyqehvdqzikjhmg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZm5oanlxZWh2ZHF6aWtqaG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzQ0NTAsImV4cCI6MjA5MjMxMDQ1MH0.n_fDdqDQFANPJ9ySD0KBztSCwodBFVn0hBFbW8WNySk'
  },
  app: {
    nombre: 'NEXUM',
    version: '3.0',
    claim: 'El vínculo que sustenta'
  },
  colores: {
    primario: '#2D3748',
    secundario: '#2C5282',
    critico: '#C53030',
    atencion: '#D69E2E',
    exito: '#2F855A'
  },
  roles: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CONTADOR: 'CONTADOR',
    ASISTENTE: 'ASISTENTE',
    CONSULTA: 'CONSULTA'
  }
};

// Inicializa el cliente de Supabase (cargado desde CDN en el HTML)
const _supabase = supabase.createClient(
  NEXUM_CONFIG.supabase.url,
  NEXUM_CONFIG.supabase.anonKey
);
