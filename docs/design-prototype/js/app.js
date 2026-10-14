/* ============================================================
   LUMA DESIGN SYSTEM — APP
   Navegación entre pantallas, microinteracciones e init.
   ============================================================ */

/* ── NAVEGACIÓN ─────────────────────────────────────────────── */
const SCREENS = ['map', 'feed', 'ai', 'restaurant', 'checkout', 'tracking', 'profile'];
let currentScreen = 'map';
let previousScreen = null;

function navigateToScreen(screenId) {
  if (screenId === currentScreen) return;

  const prev = document.getElementById(`screen-${currentScreen}`);
  if (prev) {
    prev.classList.remove('active');
    prev.style.transform = 'translateX(-15px)';
    setTimeout(() => { if (prev) prev.style.transform = ''; }, 300);
  }

  previousScreen = currentScreen;
  currentScreen = screenId;

  const next = document.getElementById(`screen-${screenId}`);
  if (next) {
    next.style.transform = 'translateX(20px)';
    next.classList.add('active');
    requestAnimationFrame(() => { next.style.transform = ''; });
  }

  updateNavBar(screenId);
  onScreenEnter(screenId);
}

function updateNavBar(screenId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });
}

function onScreenEnter(screenId) {
  switch (screenId) {
    case 'feed':
      initFeed();
      break;
    case 'ai': {
      const hour = new Date().getHours();
      let defaultMoment = 'almuerzo';
      if (hour < 10)      defaultMoment = 'desayuno';
      else if (hour < 12) defaultMoment = 'media_manana';
      else if (hour < 16) defaultMoment = 'almuerzo';
      else if (hour < 18) defaultMoment = 'media_tarde';
      else if (hour < 22) defaultMoment = 'cena';
      else                defaultMoment = 'nocturna';
      selectMoment(defaultMoment);
      break;
    }
  }
}

function goBack() {
  navigateToScreen(previousScreen || 'map');
}

/* ── STATUS BAR — RELOJ EN TIEMPO REAL ─────────────────────── */
function updateClock() {
  const el = document.getElementById('status-time');
  if (!el) return;
  const now = new Date();
  el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

/* ── MAP FILTER CHIPS ───────────────────────────────────────── */
function initMapFilters() {
  document.querySelectorAll('.map-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('chip-selected');
      chip.style.transform = 'scale(0.93)';
      setTimeout(() => { chip.style.transform = ''; }, 150);
    });
  });
}

/* ── RIPPLE EN BOTONES ──────────────────────────────────────── */
function addRipple(element) {
  element.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      background:rgba(255,255,255,0.25);
      transform:scale(0);animation:ripple-anim 0.5s ease-out;
      pointer-events:none;
    `;
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });
}

/* ── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  ThemeEngine.init();

  // Activar pantalla inicial
  const initialScreen = document.getElementById('screen-map');
  if (initialScreen) initialScreen.classList.add('active');

  // Reloj
  updateClock();
  setInterval(updateClock, 30000);

  // Filtros del mapa
  initMapFilters();

  // Navegación inferior
  document.querySelectorAll('.nav-item[data-screen]').forEach(item => {
    item.addEventListener('click', () => navigateToScreen(item.dataset.screen));
  });

  // Ripple en botones primarios y de acento
  document.querySelectorAll('.btn-primary, .btn-accent').forEach(addRipple);

  // Animación de entrada de marcadores del mapa
  document.querySelectorAll('.map-marker').forEach((marker, i) => {
    marker.style.opacity = '0';
    marker.style.transform = 'translate(-50%,-100%) scale(0.5)';
    setTimeout(() => {
      marker.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
      marker.style.opacity = '1';
      marker.style.transform = 'translate(-50%,-100%) scale(1)';
    }, 200 + i * 100);
  });

  // Keyframe para ripple
  const style = document.createElement('style');
  style.textContent = '@keyframes ripple-anim { to { transform:scale(2.5); opacity:0; } }';
  document.head.appendChild(style);

  // Posición inicial de slides del feed
  FEED_ITEMS.forEach((_, i) => {
    const slide = document.querySelectorAll('.feed-slide')[i];
    if (slide && i > 0) slide.style.transform = `translateY(${i * 100}%)`;
  });

  console.log('%c● Luma Design System v2.0', 'color:#14174A;font-weight:800;font-size:14px;');
  console.log('%cPantallas: map · feed · ai · restaurant · checkout · tracking · profile', 'color:#5C6EFC;font-size:12px;');
});

// Cerrar bottom sheet con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBusinessSheet();
});

/* ── AJUSTES — PANEL DE TEMA (colapsable) ───────────────────── */
function toggleThemePanel() {
  const panel   = document.getElementById('theme-panel');
  const chevron = document.getElementById('theme-chevron');
  const isOpen  = panel.style.maxHeight && panel.style.maxHeight !== '0px';
  panel.style.maxHeight    = isOpen ? '0px'   : '240px';
  chevron.style.transform  = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function applyThemeFromProfile(theme, label) {
  ThemeEngine.setTheme(theme);
  const el = document.getElementById('theme-current-label');
  if (el) el.textContent = label;
  showToast(`🎨 Tema: ${label.split(' — ')[0]}`, 'success');
}

/* ── AJUSTES — PANEL DE IDIOMA (colapsable) ─────────────────── */
function toggleLangPanel() {
  const panel   = document.getElementById('lang-panel');
  const chevron = document.getElementById('lang-chevron');
  const isOpen  = panel.style.maxHeight && panel.style.maxHeight !== '0px';
  panel.style.maxHeight   = isOpen ? '0px'   : '280px';
  chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function selectLanguage(el, langCode, langName) {
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.remove('active');
    const check = opt.querySelector('.lang-check');
    if (check) check.style.color = 'transparent';
  });

  el.classList.add('active');
  const check = el.querySelector('.lang-check');
  if (check) check.style.color = 'var(--color-action-primary)';

  const labelEl = document.getElementById('lang-current-label');
  if (labelEl) labelEl.textContent = langName;

  try { localStorage.setItem('luma-lang', langCode); } catch {}
  showToast(`🌐 Idioma: ${langName}`, 'success');
}
