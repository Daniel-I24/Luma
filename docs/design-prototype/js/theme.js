/* ============================================================
   LUMA DESIGN SYSTEM — THEME ENGINE
   Motor de temas: Indigo, Midnight, Pearl, Sunset
   Gestión desde Perfil → Apariencia dentro del dispositivo.
   ============================================================ */

const ThemeEngine = (() => {

  const THEMES = {
    indigo: {
      name: 'Indigo',
      dot: '#14174A',
      desc: 'Principal'
    },
    midnight: {
      name: 'Midnight',
      dot: '#1a1c34',
      desc: 'Oscuro'
    },
    pearl: {
      name: 'Pearl',
      dot: '#e4e4e7',
      desc: 'Minimalista'
    },
    sunset: {
      name: 'Sunset',
      dot: '#c2410c',
      desc: 'Energético'
    }
  };

  let currentTheme = 'indigo';
  const listeners = [];

  function setTheme(themeName) {
    if (!THEMES[themeName]) return;
    currentTheme = themeName;

    // Aplicar al dispositivo
    const device = document.getElementById('luma-device');
    if (device) device.setAttribute('data-theme', themeName);

    // Status bar oscura en Midnight
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
      statusBar.classList.toggle('dark-status', themeName === 'midnight');
    }

    // Sincronizar selector de temas dentro del perfil
    document.querySelectorAll('.theme-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === themeName);
    });

    // Persistir preferencia
    try { localStorage.setItem('luma-theme', themeName); } catch {}

    // Notificar listeners registrados
    listeners.forEach(fn => fn(themeName));
  }

  function getTheme() { return currentTheme; }

  function onThemeChange(fn) { listeners.push(fn); }

  function init() {
    let saved = 'indigo';
    try { saved = localStorage.getItem('luma-theme') || 'indigo'; } catch {}
    setTheme(saved);
  }

  return { setTheme, getTheme, onThemeChange, init, THEMES };
})();
