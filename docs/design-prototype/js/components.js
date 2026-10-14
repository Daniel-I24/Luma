/* ============================================================
   LUMA DESIGN SYSTEM — COMPONENTS
   Datos de demostración y lógica de los componentes del DS:
   bottom sheet, feed vertical, IA/combos, checkout, tracker.
   ============================================================ */

/* ── DATOS DE NEGOCIOS (datos de demo para el design system) ── */
const BUSINESSES = {
  1: {
    id: 1,
    name: 'La Casona Gourmet',
    category: 'Hamburguesería · Americana',
    emoji: '🍔',
    rating: 4.8,
    reviews: 243,
    status: 'open',
    statusText: 'Abierto',
    schedule: '11:00 AM – 10:00 PM',
    promo: '2×1 en Hamburguesas Artesanales',
    distance: '450 m',
    walkTime: '6 min',
    phone: '+57 300 123 4567',
    aiRecommended: true
  },
  2: {
    id: 2,
    name: 'Sabor Criollo',
    category: 'Cocina Tradicional',
    emoji: '🍛',
    rating: 4.5,
    reviews: 118,
    status: 'closing',
    statusText: 'Cierra Pronto',
    schedule: '12:00 PM – 03:30 PM',
    promo: '15% OFF en Platos Ejecutivos',
    distance: '1.2 km',
    walkTime: '15 min',
    phone: '+57 300 987 6543',
    aiRecommended: false
  },
  3: {
    id: 3,
    name: 'Pizzería Roma',
    category: 'Pizza · Italiana',
    emoji: '🍕',
    rating: 4.7,
    reviews: 189,
    status: 'open',
    statusText: 'Abierto',
    schedule: '12:00 PM – 11:00 PM',
    promo: null,
    distance: '780 m',
    walkTime: '10 min',
    phone: '+57 321 555 0001',
    aiRecommended: false
  },
  4: {
    id: 4,
    name: 'Café Central',
    category: 'Café · Desayunos',
    emoji: '☕',
    rating: 4.9,
    reviews: 402,
    status: 'open',
    statusText: 'Abierto',
    schedule: '7:00 AM – 6:00 PM',
    promo: 'Café + Croissant $8.500',
    distance: '230 m',
    walkTime: '3 min',
    phone: '+57 310 222 3344',
    aiRecommended: true
  },
  5: {
    id: 5,
    name: 'Sushi Nori',
    category: 'Japonesa · Sushi',
    emoji: '🍣',
    rating: 4.6,
    reviews: 97,
    status: 'closed',
    statusText: 'Cerrado',
    schedule: '6:00 PM – 11:30 PM',
    promo: null,
    distance: '2.1 km',
    walkTime: '26 min',
    phone: '+57 312 900 1122',
    aiRecommended: false
  }
};

/* ── DATOS DEL FEED (demo) ──────────────────────────────────── */
const FEED_ITEMS = [
  {
    id: 1,
    emoji: '🍔',
    bg: 'linear-gradient(135deg, #1a0a00, #3d1a00)',
    title: 'Combo Hamburguesa Doble + Papas Rústicas',
    business: 'La Casona Gourmet',
    businessEmoji: '🍔',
    price: '$18.900',
    originalPrice: '$24.000',
    discount: '-21%',
    expiry: 'Hoy hasta las 10pm',
    distance: '450 m'
  },
  {
    id: 2,
    emoji: '🍕',
    bg: 'linear-gradient(135deg, #1a0005, #3d000f)',
    title: 'Pizza Familiar Especial de la Casa',
    business: 'Pizzería Roma',
    businessEmoji: '🍕',
    price: '$32.000',
    originalPrice: '$40.000',
    discount: '-20%',
    expiry: 'Hasta el domingo',
    distance: '780 m'
  },
  {
    id: 3,
    emoji: '☕',
    bg: 'linear-gradient(135deg, #0a0500, #1f1000)',
    title: 'Desayuno Premium: Café + Tostadas + Huevo',
    business: 'Café Central',
    businessEmoji: '☕',
    price: '$12.500',
    originalPrice: null,
    discount: null,
    expiry: 'Disponible hoy',
    distance: '230 m'
  }
];

/* ── DATOS DE COMBOS IA (demo) ──────────────────────────────── */
const AI_COMBOS = {
  desayuno: {
    name: 'Combo Desayuno Energético',
    items: [
      { emoji: '☕', name: 'Café Especial de la Casa', price: '$4.500' },
      { emoji: '🥚', name: 'Omelette con Vegetales',  price: '$7.000' },
      { emoji: '🍞', name: 'Tostadas Artesanales',    price: '$3.000' }
    ],
    total: '$12.500', originalTotal: '$16.800', savings: '$4.300',
    restaurant: 'Café Central', distance: '230 m', prepTime: '12 min'
  },
  media_manana: {
    name: 'Snack Media Mañana',
    items: [
      { emoji: '🥐', name: 'Croissant de Mantequilla', price: '$3.800' },
      { emoji: '🧃', name: 'Jugo Natural de Naranja',  price: '$4.500' },
      { emoji: '🍌', name: 'Fruta de Temporada',       price: '$2.000' }
    ],
    total: '$8.500', originalTotal: '$11.200', savings: '$2.700',
    restaurant: 'Café Central', distance: '230 m', prepTime: '8 min'
  },
  almuerzo: {
    name: 'Combo Almuerzo Ejecutivo',
    items: [
      { emoji: '🍲', name: 'Sopa del Día',  price: '$5.000' },
      { emoji: '🍛', name: 'Bandeja Paisa', price: '$16.000' },
      { emoji: '🥤', name: 'Jugo Natural',  price: '$3.500' }
    ],
    total: '$22.000', originalTotal: '$28.500', savings: '$6.500',
    restaurant: 'Sabor Criollo', distance: '1.2 km', prepTime: '20 min'
  },
  media_tarde: {
    name: 'Merienda Tarde',
    items: [
      { emoji: '🍰', name: 'Brownie de Chocolate', price: '$5.500' },
      { emoji: '🥛', name: 'Latte de Vainilla',    price: '$6.000' },
      { emoji: '🫐', name: 'Bowl de Frutas',        price: '$4.500' }
    ],
    total: '$14.500', originalTotal: '$17.800', savings: '$3.300',
    restaurant: 'Café Central', distance: '230 m', prepTime: '10 min'
  },
  cena: {
    name: 'Cena para Dos',
    items: [
      { emoji: '🍕', name: 'Pizza Mediana 2 Sabores',  price: '$28.000' },
      { emoji: '🥤', name: '2 Bebidas a Elección',     price: '$10.000' },
      { emoji: '🍮', name: 'Postre para Compartir',    price: '$9.000' }
    ],
    total: '$45.000', originalTotal: '$54.500', savings: '$9.500',
    restaurant: 'Pizzería Roma', distance: '780 m', prepTime: '25 min'
  },
  nocturna: {
    name: 'Salida Nocturna',
    items: [
      { emoji: '🍣', name: 'Sushi Roll Especial x8', price: '$32.000' },
      { emoji: '🥢', name: 'Gyozas (6 uds)',         price: '$14.000' },
      { emoji: '🍵', name: 'Té Verde Caliente',      price: '$5.000' }
    ],
    total: '$49.000', originalTotal: '$58.000', savings: '$9.000',
    restaurant: 'Sushi Nori', distance: '2.1 km', prepTime: '30 min'
  }
};

/* ── FAVORITOS (persiste en localStorage) ───────────────────── */
const Favorites = (() => {
  let favs = new Set();
  try {
    favs = new Set(JSON.parse(localStorage.getItem('luma-favs') || '[]'));
  } catch {}

  function toggle(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    try { localStorage.setItem('luma-favs', JSON.stringify([...favs])); } catch {}
    return favs.has(id);
  }

  function has(id) { return favs.has(id); }
  return { toggle, has };
})();

/* ── BOTTOM SHEET — NEGOCIO SELECCIONADO ───────────────────── */
function openBusinessSheet(bizId) {
  const biz = BUSINESSES[bizId];
  if (!biz) return;

  document.querySelectorAll('.map-marker').forEach(m => m.classList.remove('selected'));
  const marker = document.querySelector(`[data-biz-id="${bizId}"]`);
  if (marker) marker.classList.add('selected');

  document.getElementById('sheet-biz-name').textContent     = biz.name;
  document.getElementById('sheet-biz-category').textContent = biz.category;
  document.getElementById('sheet-biz-emoji').textContent    = biz.emoji;
  document.getElementById('sheet-biz-rating').textContent   = biz.rating;
  document.getElementById('sheet-biz-reviews').textContent  = `(${biz.reviews} reseñas)`;
  document.getElementById('sheet-biz-distance').textContent = `${biz.distance} · ${biz.walkTime} caminando`;
  document.getElementById('sheet-biz-schedule').textContent = `Hoy: ${biz.schedule}`;

  const statusEl = document.getElementById('sheet-biz-status');
  statusEl.className = `status-badge status-${biz.status}`;
  statusEl.innerHTML = `<span class="status-dot"></span>${biz.statusText}`;

  const promoEl = document.getElementById('sheet-biz-promo');
  if (biz.promo) {
    promoEl.style.display = 'flex';
    document.getElementById('sheet-biz-promo-text').textContent = biz.promo;
  } else {
    promoEl.style.display = 'none';
  }

  const favBtn = document.getElementById('sheet-fav-btn');
  if (favBtn) {
    favBtn.classList.toggle('favorited', Favorites.has(biz.id));
    favBtn.dataset.bizId = biz.id;
  }

  document.getElementById('sheet-view-btn').dataset.bizId = biz.id;
  document.getElementById('business-sheet').classList.add('open');
  document.getElementById('sheet-overlay').classList.add('active');
}

function closeBusinessSheet() {
  document.getElementById('business-sheet').classList.remove('open');
  document.getElementById('sheet-overlay').classList.remove('active');
  document.querySelectorAll('.map-marker').forEach(m => m.classList.remove('selected'));
}

function toggleSheetFavorite(btn) {
  const bizId = parseInt(btn.dataset.bizId);
  const isFav = Favorites.toggle(bizId);
  btn.classList.toggle('favorited', isFav);
  showToast(isFav ? '❤️ Guardado en favoritos' : '🗑️ Eliminado de favoritos', isFav ? 'success' : 'error');
}

/* ── FEED VERTICAL ──────────────────────────────────────────── */
let currentFeedIndex = 0;

function renderFeedItem(item) {
  return `
    <div class="feed-item" style="background:${item.bg};height:100%;">
      <div class="feed-media">${item.emoji}</div>
      <div class="feed-gradient"></div>
      <div class="feed-top-overlay">
        <span style="font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.01em;">Luma</span>
        <span style="color:rgba(255,255,255,0.6);font-size:11px;margin-left:6px;font-weight:500;">Descubre</span>
      </div>
      <div class="feed-content">
        <div class="feed-business">
          <div class="feed-biz-avatar">${item.businessEmoji}</div>
          <span class="feed-biz-name">${item.business}</span>
        </div>
        <div class="feed-title">${item.title}</div>
        <div class="feed-meta">
          <span class="feed-price">${item.price}</span>
          ${item.originalPrice ? `<span class="feed-price-orig">${item.originalPrice}</span>` : ''}
          ${item.discount      ? `<span class="feed-badge">${item.discount}</span>` : ''}
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
          <span style="font-size:11px;color:rgba(255,255,255,0.65);">📍 ${item.distance}</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.65);">⏱ ${item.expiry}</span>
        </div>
        <button class="btn btn-primary btn-full" onclick="navigateToCheckout()"
                style="border-radius:14px;height:46px;font-size:14px;">
          Ordenar Ahora
        </button>
      </div>
      <div class="feed-actions">
        <div class="feed-action-btn" onclick="toggleFeedFav(this)">
          <div class="feed-action-icon">🤍</div>
          <span class="feed-action-label">Guardar</span>
        </div>
        <div class="feed-action-btn">
          <div class="feed-action-icon">⭐</div>
          <span class="feed-action-label">Reseñar</span>
        </div>
        <div class="feed-action-btn">
          <div class="feed-action-icon">↗️</div>
          <span class="feed-action-label">Compartir</span>
        </div>
        <div class="feed-action-btn" onclick="navigateToScreen('restaurant')">
          <div class="feed-action-icon">🏪</div>
          <span class="feed-action-label">Negocio</span>
        </div>
      </div>
    </div>`;
}

function initFeed() {
  const container = document.getElementById('feed-container');
  if (!container) return;

  container.innerHTML = FEED_ITEMS.map(item =>
    `<div class="feed-slide" style="height:100%;flex-shrink:0;width:100%;">${renderFeedItem(item)}</div>`
  ).join('');

  currentFeedIndex = 0;
  updateFeedDots();

  let startY = 0;
  container.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  container.addEventListener('touchend', e => {
    const diff = startY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) diff > 0 ? nextFeedItem() : prevFeedItem();
  });
  container.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.deltaY > 30) nextFeedItem();
    else if (e.deltaY < -30) prevFeedItem();
  }, { passive: false });
}

function nextFeedItem() {
  if (currentFeedIndex < FEED_ITEMS.length - 1) scrollFeedTo(++currentFeedIndex);
}

function prevFeedItem() {
  if (currentFeedIndex > 0) scrollFeedTo(--currentFeedIndex);
}

function scrollFeedTo(index) {
  document.querySelectorAll('.feed-slide').forEach((slide, i) => {
    slide.style.transform  = `translateY(${(i - index) * 100}%)`;
    slide.style.transition = 'transform 0.4s cubic-bezier(0.2,0,0,1)';
  });
  currentFeedIndex = index;
  updateFeedDots();
}

function updateFeedDots() {
  document.querySelectorAll('.feed-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentFeedIndex);
  });
}

function toggleFeedFav(btn) {
  const icon = btn.querySelector('.feed-action-icon');
  const isNow = icon.textContent === '🤍';
  icon.textContent  = isNow ? '❤️' : '🤍';
  icon.style.transform = 'scale(1.4)';
  setTimeout(() => { icon.style.transform = 'scale(1)'; }, 300);
  showToast(isNow ? '❤️ Guardado en favoritos' : '🗑️ Eliminado', isNow ? 'success' : 'error');
}

/* ── IA / COMBOS ────────────────────────────────────────────── */
function selectMoment(momentKey) {
  document.querySelectorAll('.moment-chip').forEach(c => c.classList.remove('active'));
  const chip = document.querySelector(`.moment-chip[data-moment="${momentKey}"]`);
  if (chip) chip.classList.add('active');
  const combo = AI_COMBOS[momentKey];
  if (combo) renderAICombo(combo);
}

function renderAICombo(combo) {
  const container = document.getElementById('ai-combo-container');
  if (!container) return;

  container.innerHTML = `
    <div class="ai-combo-card animate-in">
      <div class="ai-combo-header">
        <div class="ai-combo-icon">✨</div>
        <div>
          <span class="ai-combo-label">Luma IA — Combo Personalizado</span>
          <div class="ai-combo-name">${combo.name}</div>
        </div>
      </div>
      <div class="ai-combo-items">
        ${combo.items.map(i => `
          <div class="ai-combo-item">
            <span class="ai-combo-item-emoji">${i.emoji}</span>
            <span class="ai-combo-item-name">${i.name}</span>
            <span class="ai-combo-item-price">${i.price}</span>
          </div>`).join('')}
      </div>
      <div style="padding:10px 16px 0;display:flex;gap:12px;border-top:1px solid var(--color-border-subtle);">
        <span style="font-size:12px;color:var(--color-text-tertiary);">📍 ${combo.restaurant} · ${combo.distance}</span>
        <span style="font-size:12px;color:var(--color-text-tertiary);">⏱ ${combo.prepTime} prep.</span>
      </div>
      <div class="ai-combo-footer">
        <div>
          <div class="ai-combo-total-label">Total del combo</div>
          <div class="ai-combo-total-price">${combo.total}</div>
          <div class="ai-combo-savings">Ahorrás ${combo.savings} 🎉</div>
        </div>
        <button class="btn btn-primary btn-md" onclick="acceptAICombo('${combo.name}')">Pedir Combo</button>
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 14px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="regenerateCombo()">Cambiar combo</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="navigateToCheckout()">Personalizar</button>
      </div>
    </div>`;
}

function acceptAICombo(name) {
  showToast(`🛒 "${name}" agregado al carrito`, 'success');
  setTimeout(() => navigateToCheckout(), 700);
}

function regenerateCombo() {
  const container = document.getElementById('ai-combo-container');
  if (!container) return;
  container.innerHTML = `
    <div class="ai-combo-card" style="padding:32px 16px;text-align:center;opacity:0.6;">
      <div style="font-size:32px;margin-bottom:12px;">✨</div>
      <div style="font-size:14px;color:var(--color-text-secondary);">Generando nuevo combo...</div>
    </div>`;
  setTimeout(() => {
    const keys   = Object.keys(AI_COMBOS);
    const random = keys[Math.floor(Math.random() * keys.length)];
    renderAICombo(AI_COMBOS[random]);
  }, 900);
}

/* ── CHECKOUT ───────────────────────────────────────────────── */
let selectedPayment = 'card';

function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.method === method);
  });
}

function confirmOrder() {
  const btn = document.getElementById('confirm-order-btn');
  if (!btn) return;
  btn.classList.add('btn-loading');
  btn.textContent = '';
  setTimeout(() => {
    btn.classList.remove('btn-loading');
    navigateToScreen('tracking');
    showToast('✅ Pedido confirmado con éxito', 'success');
    startOrderTracking();
  }, 1800);
}

/* ── ORDER TRACKER ──────────────────────────────────────────── */
const ORDER_STEPS = [
  { label: 'Confirmado' },
  { label: 'Preparando' },
  { label: 'Listo'      },
  { label: 'Recoge'     },
  { label: 'Completado' }
];

let orderStep     = 0;
let orderInterval = null;

function startOrderTracking() {
  orderStep = 0;
  updateTrackingUI();
  clearInterval(orderInterval);
  orderInterval = setInterval(() => {
    if (orderStep < ORDER_STEPS.length - 1) {
      orderStep++;
      updateTrackingUI();
    } else {
      clearInterval(orderInterval);
    }
  }, 3500);
}

function updateTrackingUI() {
  const etaEl    = document.getElementById('tracking-eta');
  const statusEl = document.getElementById('tracking-status-text');

  if (etaEl) {
    const mins = Math.max(0, (ORDER_STEPS.length - 1 - orderStep) * 4);
    etaEl.textContent = mins > 0 ? `${mins} min` : '¡Listo!';
  }
  if (statusEl) statusEl.textContent = ORDER_STEPS[orderStep].label;

  document.querySelectorAll('.tracking-step-row').forEach((row, i) => {
    row.classList.remove('done', 'current');
    if (i < orderStep)       row.classList.add('done');
    else if (i === orderStep) row.classList.add('current');
  });
}

/* ── TOAST ──────────────────────────────────────────────────── */
let toastTimeout = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('luma-toast');
  if (!toast) return;
  toast.querySelector('.toast-icon').textContent = type === 'success' ? '✅' : '❌';
  toast.querySelector('.toast-text').textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ── HELPERS DE NAVEGACIÓN ──────────────────────────────────── */
function navigateToCheckout() {
  closeBusinessSheet();
  navigateToScreen('checkout');
}

function navigateToRestaurantFromSheet(btn) {
  closeBusinessSheet();
  openRestaurantProfile(parseInt(btn.dataset.bizId));
}

/* ── PERFIL DE RESTAURANTE ──────────────────────────────────── */
function openRestaurantProfile(bizId) {
  const biz = BUSINESSES[bizId] || BUSINESSES[1];

  document.getElementById('rest-name').textContent        = biz.name;
  document.getElementById('rest-category').textContent    = biz.category;
  document.getElementById('rest-emoji').textContent       = biz.emoji;
  document.getElementById('rest-rating-val').textContent  = biz.rating;
  document.getElementById('rest-reviews-val').textContent = biz.reviews;
  document.getElementById('rest-distance-val').textContent = biz.distance;

  const statusEl = document.getElementById('rest-status');
  statusEl.className = `status-badge status-${biz.status}`;
  statusEl.innerHTML = `<span class="status-dot"></span>${biz.statusText}`;

  const favBtn = document.getElementById('rest-hero-fav');
  if (favBtn) favBtn.classList.toggle('favorited', Favorites.has(biz.id));

  navigateToScreen('restaurant');
  selectProfileTab('menu');
}

function selectProfileTab(tabName) {
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  ['menu', 'promos', 'reviews', 'info'].forEach(s => {
    const el = document.getElementById(`rest-tab-${s}`);
    if (el) el.style.display = s === tabName ? 'block' : 'none';
  });
}
