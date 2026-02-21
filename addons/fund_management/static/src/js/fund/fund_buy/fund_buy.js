// Helper function để resolve PDF URL (có thể được gọi từ mọi nơi)
function resolvePdfUrl() {
  const fromMeta = document.querySelector('meta[name="contract-pdf-url"]')?.getAttribute('content');
  if (fromMeta) {
    return fromMeta;
  }
  if (window.Contract && window.Contract.pdfUrl) {
    return window.Contract.pdfUrl;
  }
  return '/fund_management/static/src/pdf/terms2.pdf';
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return '0 đ';
  }
  return `${numeric.toLocaleString('vi-VN')} đ`;
}

function formatPercent(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return '0%';
  }
  return `${numeric.toFixed(fractionDigits)}%`;
}

/**
 * Làm tròn theo quy tắc: dưới 25đ làm tròn xuống, từ 25đ làm tròn lên (step 50đ)
 * Ví dụ: 
 *   mround25(1024) = 1000 (24 < 25 -> xuống)
 *   mround25(1025) = 1050 (25 >= 25 -> lên)
 *   mround25(1049) = 1050 (49 >= 25 -> lên)
 *   mround25(1074) = 1050 (74 >= 25 -> 74-50=24 < 25 -> xuống 1050)
 */
function mround25(value, step = 50) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;

  const remainder = num % step;
  const threshold = step / 2; // 25đ khi step = 50

  if (remainder < threshold) {
    // Dưới 25đ -> làm tròn xuống
    return Math.floor(num / step) * step;
  } else {
    // Từ 25đ trở lên -> làm tròn lên
    return Math.ceil(num / step) * step;
  }
}

/**
 * Cập nhật hint số tiền đầu tư tối thiểu = giá CCQ * 100 CCQ
 */
function updateMinInvestmentHint(navPrice) {
  const MIN_UNITS = 100;
  const hintEl = document.getElementById('min-investment-hint');
  if (!hintEl) return;

  if (navPrice > 0) {
    const minAmount = navPrice * MIN_UNITS;
    hintEl.textContent = `Số tiền đầu tư tối thiểu: ${minAmount.toLocaleString('vi-VN')}đ`;
  } else {
    hintEl.textContent = 'Số tiền đầu tư tối thiểu: đang tính...';
  }
}

function createDebugBadge(text, tone = 'neutral') {
  return `<span class="debug-badge debug-badge--${tone}">${text}</span>`;
}

function createDebugCard({ title, subtitle, items }) {
  const list = (items || []).map((item) => `
    <li>
      <div class="label">${item.label}</div>
      <div class="value">${item.value || '-'}</div>
      ${item.note ? `<div class="note">${item.note}</div>` : ''}
    </li>
  `).join('');

  return `
    <section class="debug-card">
      <header>
        <div>
          <p class="subtitle">${subtitle || ''}</p>
          <h4>${title}</h4>
        </div>
      </header>
      <ul>
        ${list}
      </ul>
    </section>
  `;
}

function createFormulaTimeline(formulas) {
  const steps = formulas.map((formula, idx) => `
    <div class="timeline-step">
      <div class="timeline-index">${idx + 1}</div>
      <div>
        <p class="title">${formula.title}</p>
        <p class="expression">${formula.expression}</p>
        <p class="result">${formula.result}</p>
      </div>
    </div>
  `).join('');

  return `
    <section class="debug-card">
      <header>
        <p class="subtitle">Diễn giải từng bước</p>
        <h4>Hành trình phép tính</h4>
      </header>
      <div class="timeline">
        ${steps}
      </div>
    </section>
  `;
}

function buildDebugModal(sectionHtml) {
  return `
    <style>
      .debug-wrap {
        display: flex;
        flex-direction: column;
        gap: 18px;
        text-align: left;
        font-size: 14px;
      }
      .debug-card {
        border-radius: 16px;
        padding: 20px;
        background: linear-gradient(135deg, #f8fbff 0%, #fff 100%);
        border: 1px solid #e2e8f0;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
      }
      .debug-card header {
        margin-bottom: 16px;
      }
      .debug-card h4 {
        margin: 4px 0 0;
        font-size: 18px;
        color: #0f172a;
      }
      .debug-card .subtitle {
        margin: 0;
        letter-spacing: .08em;
        color: #64748b;
        font-size: 11px;
      }
      .debug-card ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      .debug-card li {
        display: grid;
        gap: 4px;
      }
      .debug-card .label {
        font-weight: 600;
        color: #1e293b;
      }
      .debug-card .value {
        font-size: 16px;
        color: #0f172a;
      }
      .debug-card .note {
        font-size: 12px;
        color: #64748b;
      }
      .debug-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 13px;
      }
      .debug-badge--success {
        color: #166534;
        background: rgba(34,197,94,.12);
      }
      .debug-badge--warning {
        color: #92400e;
        background: rgba(251,191,36,.2);
      }
      .debug-badge--neutral {
        color: #1d4ed8;
        background: rgba(59,130,246,.15);
      }
      .timeline {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .timeline-step {
        display: grid;
        grid-template-columns: 36px 1fr;
        gap: 12px;
        position: relative;
      }
      .timeline-step::before {
        content: '';
        position: absolute;
        left: 17px;
        top: 42px;
        bottom: -14px;
        width: 2px;
        background: #e2e8f0;
      }
      .timeline-step:last-child::before {
        display: none;
      }
      .timeline-index {
        height: 36px;
        width: 36px;
        border-radius: 50%;
        background: #0f172a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }
      .timeline-step .title {
        margin: 0;
        font-weight: 600;
        color: #0f172a;
      }
      .timeline-step .expression {
        margin: 4px 0;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        color: #475569;
        font-size: 13px;
      }
      .timeline-step .result {
        margin: 0;
        color: #0f172a;
        font-weight: 500;
      }
    </style>
    <div class="debug-wrap">
      ${sectionHtml.join('')}
    </div>
  `;
}

const SESSION_EXPIRED_ERROR_CODE = 'SESSION_EXPIRED';

function isSessionExpiredPayload(payload) {
  if (!payload || !payload.error) {
    return false;
  }
  const message = String(payload.error.message || '').toLowerCase();
  return message.includes('session expired');
}

function createSessionExpiredError() {
  const err = new Error(SESSION_EXPIRED_ERROR_CODE);
  err.code = SESSION_EXPIRED_ERROR_CODE;
  return err;
}

async function showSessionExpiredDialog() {
  const redirect = window.location.pathname + window.location.search || '/fund_buy';
  const loginUrl = `/web/login?redirect=${encodeURIComponent(redirect)}`;
  await Swal.fire({
    icon: 'warning',
    title: 'Phiên đăng nhập đã hết hạn',
    text: 'Vui lòng đăng nhập lại để tiếp tục xác thực Smart OTP.',
    confirmButtonText: 'Đăng nhập lại'
  });
  window.location.href = loginUrl;
}

async function assertSessionActive(payload) {
  if (isSessionExpiredPayload(payload)) {
    await showSessionExpiredDialog();
    throw createSessionExpiredError();
  }
}

// =============================================================================
// SESSION CLEANUP - Clear stale order data to prevent crossover
// =============================================================================
const ORDER_SESSION_KEYS = [
  'selectedFundId', 'selectedFundName', 'selectedUnits', 'selectedAmount',
  'selectedInvestmentAmount', 'selectedTotalAmount',
  'selected_term_months', 'selected_interest_rate',
  'selected_order_type', 'selected_price', 'is_market_order',
  'transaction_id', 'nav_data',
  'result_fund_name', 'result_order_date', 'result_amount', 'result_total_amount',
  'result_units', 'result_order_type', 'result_status',
  'backup_term_months', 'backup_interest_rate',
  'order_token', // Previous token
  'debug_skip_min_ccq', 'debug_skip_max_ccq', 'debug_skip_lot_size'
];

function shouldSkipMinCcq() {
  return sessionStorage.getItem('debug_skip_min_ccq') === 'true';
}

function shouldSkipMaxCcq() {
  return sessionStorage.getItem('debug_skip_max_ccq') === 'true';
}

function shouldSkipLotSize() {
  return sessionStorage.getItem('debug_skip_lot_size') === 'true';
}

function initFundBuyDebugToggle() {
  const toggleBtn = document.getElementById('debug-mode-buy-toggle');
  if (!toggleBtn) return;

  // Sync initial state
  const isDebug = sessionStorage.getItem('debug_mode_buy') === 'true';
  toggleBtn.classList.toggle('active', isDebug);

  toggleBtn.addEventListener('click', () => {
    const nextState = !(sessionStorage.getItem('debug_mode_buy') === 'true');
    sessionStorage.setItem('debug_mode_buy', nextState);
    sessionStorage.setItem('debug_skip_min_ccq', nextState);
    sessionStorage.setItem('debug_skip_max_ccq', nextState);
    sessionStorage.setItem('debug_skip_lot_size', nextState);

    toggleBtn.classList.toggle('active', nextState);

    Swal.fire({
      icon: 'info',
      title: nextState ? 'Debug Mode ON' : 'Debug Mode OFF',
      text: nextState ? 'Bỏ qua các ràng buộc số lượng tối thiểu/tối đa và lô 100.' : 'Đã khôi phục các ràng buộc đặt lệnh.',
      timer: 1500,
      showConfirmButton: false
    });
  });
}

function clearOrderSession() {
  console.log('[Session] Clearing order session data');
  ORDER_SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));
}

function generateOrderToken() {
  // Generate unique token for this order flow
  const token = crypto.randomUUID ? crypto.randomUUID() :
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('order_token', token);
  console.log('[Session] Generated order_token:', token);
  return token;
}

document.addEventListener('DOMContentLoaded', () => {

  initFundSelect();
  initShareQuantityInput();
  initPaymentButton();
  initFundBuyDebugToggle(); // Debug toggle (replaces old initDebugButton)
  initOrderModeTabs(); // Order Mode Tabs (Thường vs Thỏa thuận)

  const amountInput = document.getElementById('amount-input');
  if (amountInput) {
    formatAmountInputWithRaw(amountInput);
  }

  // Thêm format cho input số tiền đầu tư
  const investmentAmountInput = document.getElementById('investment-amount-input');
  if (investmentAmountInput) {
    formatAmountInputWithRaw(investmentAmountInput);
  }

  initInterestRateSelect();
  initInvestmentCalculator();
  initTermSelect();
  initShareQuantityCalculation();
  initInvestmentAmountCalculation(); // Thêm function mới
  loadTermRates(); // Load kỳ hạn từ API

  initRealtimeClock(); // Realtime Order Time

});

// =============================================================================
// ORDER MODE TABS - Chuyển đổi giữa Đặt lệnh thường / Đặt lệnh thỏa thuận
// =============================================================================
let currentOrderMode = 'negotiated'; // Default

function initOrderModeTabs() {
  const tabNegotiated = document.getElementById('tab-negotiated');
  const tabNormal = document.getElementById('tab-normal');
  const negotiatedForm = document.getElementById('negotiated-order-form');
  const normalFormContainer = document.getElementById('normal-order-form-container');

  if (!tabNegotiated || !tabNormal) {
    console.log('[OrderMode] Tabs not found, skipping...');
    return;
  }

  // Tab click handlers
  tabNegotiated.addEventListener('click', () => setOrderMode('negotiated'));
  tabNormal.addEventListener('click', () => setOrderMode('normal'));

  // Load saved mode from session
  const savedMode = sessionStorage.getItem('current_order_mode');
  if (savedMode && ['negotiated', 'normal'].includes(savedMode)) {
    setOrderMode(savedMode);
  }

  console.log('[OrderMode] Initialized, current mode:', currentOrderMode);
}

function setOrderMode(mode) {
  currentOrderMode = mode;
  sessionStorage.setItem('current_order_mode', mode);

  const tabNegotiated = document.getElementById('tab-negotiated');
  const tabNormal = document.getElementById('tab-normal');
  const negotiatedForm = document.getElementById('negotiated-order-form');
  const normalFormContainer = document.getElementById('normal-order-form-container');

  // Update tab active states
  if (tabNegotiated && tabNormal) {
    tabNegotiated.classList.toggle('active', mode === 'negotiated');
    tabNormal.classList.toggle('active', mode === 'normal');
  }

  // Toggle body class for CSS-based field hiding
  document.body.classList.toggle('normal-order-mode', mode === 'normal');

  // Toggle form visibility
  if (mode === 'normal') {
    if (negotiatedForm) negotiatedForm.classList.add('d-none');
    if (normalFormContainer) {
      normalFormContainer.classList.remove('d-none');
      // Load NormalOrderForm if not already loaded
      initNormalOrderContent();
    }
  } else {
    if (negotiatedForm) negotiatedForm.classList.remove('d-none');
    if (normalFormContainer) normalFormContainer.classList.add('d-none');
  }

  console.log('[OrderMode] Changed to:', mode);
}

function initNormalOrderContent() {
  const container = document.getElementById('normal-order-form-container');
  if (!container || container.dataset.initialized === 'true') return;

  if (container.dataset.mounting === 'true') return;
  container.dataset.mounting = 'true';

  const mountComponent = () => {
    if (window.NormalOrderFormMount && typeof window.NormalOrderFormMount.mount === 'function') {
      window.NormalOrderFormMount.mount('normal-order-form-container')
        .then(() => {
          container.dataset.initialized = 'true';
          delete container.dataset.mounting;
          delete container.dataset.retryCount;
        })
        .catch(error => {
          console.error('[NormalOrder] Failed to mount OWL component:', error);
          container.innerHTML = '<div class="alert alert-danger">Lỗi tải form đặt lệnh: ' + error.message + '</div>';
          delete container.dataset.mounting;
        });
    } else {
      let retryCount = Number(container.dataset.retryCount || 0);
      if (retryCount < 50) {
        container.dataset.retryCount = retryCount + 1;
        setTimeout(mountComponent, 100);
      } else {
        console.error('[NormalOrder] OWL module load timeout');
      }
    }
  };
  mountComponent();
}

// Legacy fallback - keep for compatibility
function _unused_initNormalOrderContentLegacy() {
  const container = document.getElementById('normal-order-form-container');
  if (!container || container.dataset.initialized === 'true') return;

  // Get fund info
  const fundSelect = document.getElementById('fund-select');
  const fundId = fundSelect?.options[fundSelect.selectedIndex]?.dataset?.id;
  const navPrice = window.currentNavPrice || parseFloat(document.getElementById('current-nav')?.textContent?.replace(/[^0-9]/g, '')) || 10000;

  // Render with proper wrapper classes matching SCSS
  container.innerHTML = `
    <div class="normal-order-form-container">
      <div class="normal-order-form">
        <div class="purchasing-power-card">
          <div class="pp-header">
            <i class="fas fa-wallet"></i>
            <span class="pp-label">Sức mua</span>
          </div>
          <div class="pp-body">
            <div class="pp-amount" id="normal-pp-amount">0 VNĐ</div>
            <div class="pp-units">
              <span class="pp-buy" title="Số lượng có thể mua">
                <i class="fas fa-arrow-up text-success"></i>
                <span id="normal-max-buy">0</span> CCQ
              </span>
            </div>
          </div>
        </div>
        
        <div class="form-group order-type-group">
          <label>Loại lệnh</label>
          <div class="order-type-options-grid">
            <button type="button" class="order-type-option active" data-value="MTL">
              <span class="ot-code">MTL</span>
              <span class="ot-desc">Lệnh thị trường</span>
            </button>
            <button type="button" class="order-type-option" data-value="LO">
              <span class="ot-code">LO</span>
              <span class="ot-desc">Lệnh giới hạn</span>
            </button>
            <button type="button" class="order-type-option" data-value="ATO">
              <span class="ot-code">ATO</span>
              <span class="ot-desc">Lệnh mở cửa</span>
            </button>
            <button type="button" class="order-type-option" data-value="ATC">
              <span class="ot-code">ATC</span>
              <span class="ot-desc">Lệnh đóng cửa</span>
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>Số tiền đầu tư</label>
          <div class="input-group">
            <input type="text" class="form-control investment-amount" id="normal-investment-amount" placeholder="Nhập số tiền..."/>
            <span class="input-group-text">VNĐ</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>Số lượng CCQ (Lô 100)</label>
          <input type="text" class="form-control ccq-quantity" id="normal-share-quantity" readonly placeholder="0"/>
          <div class="form-text">Số lượng theo lô 100 CCQ</div>
        </div>
        
        <div class="estimated-total-row">
          <span class="label">Giá trị ước tính:</span>
          <span class="value" id="normal-estimated-total">0 VNĐ</span>
        </div>
        
        <button type="button" class="btn btn-primary btn-submit-normal" id="normal-submit-btn" disabled>
          Tiếp tục <i class="fas fa-arrow-right ms-2"></i>
        </button>
        
        <div class="normal-order-info-box">
          <h5><i class="fas fa-info-circle"></i> Lưu ý</h5>
          <ul>
            <li>Lệnh thường sẽ được gửi trực tiếp lên sàn</li>
            <li>Không cần ký hợp đồng cam kết mua lại</li>
            <li>Khớp lệnh theo giá thị trường</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  container.dataset.initialized = 'true';

  // Setup event handlers
  initNormalOrderHandlers();
  initNormalOrderTypeGrid();
  loadPurchasingPower();
}

// Initialize order type grid click handlers
function initNormalOrderTypeGrid() {
  const buttons = document.querySelectorAll('.order-type-options-grid .order-type-option');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function initNormalOrderHandlers() {
  const amountInput = document.getElementById('normal-investment-amount');
  const orderTypeSelect = document.getElementById('normal-order-type');
  const submitBtn = document.getElementById('normal-submit-btn');

  if (amountInput) {
    amountInput.addEventListener('input', (e) => {
      const rawValue = e.target.value.replace(/[^0-9]/g, '');
      const amount = parseInt(rawValue) || 0;
      e.target.value = amount > 0 ? amount.toLocaleString('vi-VN') : '';
      calculateNormalQuantity();
    });
  }

  if (orderTypeSelect) {
    orderTypeSelect.addEventListener('change', updateOrderTypeHint);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitNormalOrder);
  }
}

function calculateNormalQuantity() {
  const amountInput = document.getElementById('normal-investment-amount');
  const quantityInput = document.getElementById('normal-share-quantity');
  const estimatedEl = document.getElementById('normal-estimated-total');
  const submitBtn = document.getElementById('normal-submit-btn');

  const amount = parseInt((amountInput?.value || '').replace(/[^0-9]/g, '')) || 0;
  const navPrice = window.currentNavPrice || 10000;
  const LOT_SIZE = 100;

  if (navPrice > 0 && amount > 0) {
    const rawQty = Math.floor(amount / navPrice);
    const lotQty = Math.floor(rawQty / LOT_SIZE) * LOT_SIZE;

    if (quantityInput) quantityInput.value = lotQty.toLocaleString('vi-VN');
    if (estimatedEl) estimatedEl.textContent = `${(lotQty * navPrice).toLocaleString('vi-VN')} VNĐ`;
    if (submitBtn) submitBtn.disabled = lotQty <= 0;
  } else {
    if (quantityInput) quantityInput.value = '';
    if (estimatedEl) estimatedEl.textContent = '0 VNĐ';
    if (submitBtn) submitBtn.disabled = true;
  }
}

function updateOrderTypeHint() {
  const orderType = document.getElementById('normal-order-type')?.value || 'MTL';
  const hintEl = document.getElementById('normal-order-type-hint');

  const hints = {
    'MTL': 'Khớp ngay với giá tốt nhất, phần dư chuyển thành lệnh giới hạn',
    'ATO': 'Khớp tại giá mở cửa (9h00-9h15, chỉ sàn HOSE)',
    'ATC': 'Khớp tại giá đóng cửa (14h30-14h45)',
    'LO': 'Đặt lệnh với giá cố định'
  };

  if (hintEl) {
    hintEl.innerHTML = `<i class="fas fa-info-circle"></i> ${hints[orderType] || ''}`;
  }
}

async function loadPurchasingPower() {
  try {
    const response = await fetch('/api/fund/normal-order/market-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
    });

    const result = await response.json();
    if (result.result && result.result.success) {
      const purchasingPower = result.result.purchasing_power || 0;
      // const holdings = balance.holdings || 0; // Info not yet available in new endpoint

      const navPrice = window.currentNavPrice || 10000;
      const LOT_SIZE = 100;

      const maxBuy = navPrice > 0 ? Math.floor(Math.floor(purchasingPower / navPrice) / LOT_SIZE) * LOT_SIZE : 0;
      // const maxSell = Math.floor(holdings / LOT_SIZE) * LOT_SIZE;

      const ppAmountEl = document.getElementById('normal-pp-amount');
      const maxBuyEl = document.getElementById('normal-max-buy');
      // const maxSellEl = document.getElementById('normal-max-sell');

      if (ppAmountEl) ppAmountEl.textContent = `${purchasingPower.toLocaleString('vi-VN')} VNĐ`;
      if (maxBuyEl) maxBuyEl.textContent = maxBuy.toLocaleString('vi-VN');
      // if (maxSellEl) maxSellEl.textContent = maxSell.toLocaleString('vi-VN');
    }
  } catch (e) {
    console.warn('[NormalOrder] Failed to load purchasing power:', e);
  }
}

async function submitNormalOrder() {
  const submitBtn = document.getElementById('normal-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
  }

  try {
    const fundSelect = document.getElementById('fund-select');
    const fundId = fundSelect?.options[fundSelect.selectedIndex]?.dataset?.id;
    const quantity = parseInt((document.getElementById('normal-share-quantity')?.value || '').replace(/[^0-9]/g, '')) || 0;
    const orderType = document.getElementById('normal-order-type')?.value || 'MTL';
    const price = window.currentNavPrice || 10000;

    const response = await fetch('/api/fund/normal-order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          fund_id: parseInt(fundId),
          transaction_type: 'buy',
          units: quantity,
          price: price,
          order_type_detail: orderType
        }
      })
    });

    const result = await response.json();

    if (result.result && result.result.success) {
      sessionStorage.setItem('normal_order_id', result.result.order_id);
      sessionStorage.setItem('result_order_mode', 'normal');

      Swal.fire({
        icon: 'success',
        title: 'Đặt lệnh thành công!',
        text: result.result.message,
        timer: 2000,
        showConfirmButton: false
      });

      setTimeout(() => {
        window.location.href = '/fund_result';
      }, 2000);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Đặt lệnh thất bại',
        text: result.result?.message || 'Có lỗi xảy ra'
      });
    }
  } catch (error) {
    console.error('[NormalOrder] Submit error:', error);
    Swal.fire({ icon: 'error', title: 'Lỗi hệ thống', text: 'Vui lòng thử lại' });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Đặt lệnh';
    }
  }
}


function format_date_today() {
  const today = new Date();
  const formatted = today.toLocaleDateString("vi-VN"); // ra dạng 25/08/2025
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = formatted;
  }
}


// Load kỳ hạn từ nav_management API
async function loadTermRates() {
  try {
    const response = await fetch('/nav_management/api/term_rates', {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin'
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        populateTermSelect(result.rates);
        // Lưu rate map vào biến global để sử dụng
        window.termRateMap = result.rate_map;
      } else {
        showFallbackTermSelect();
      }
    } else {
      showFallbackTermSelect();
    }
  } catch (error) {
    showFallbackTermSelect();
  }
}

// Populate term select với dữ liệu từ API
function populateTermSelect(rates) {
  const termSelect = document.getElementById('term-select');
  if (!termSelect) {
    return;
  }
  termSelect.innerHTML = '<option value="" selected="selected" disabled="disabled">-- Chọn kỳ hạn --</option>';

  rates.forEach(rate => {
    const option = document.createElement('option');
    option.value = rate.term_months;
    option.dataset.rate = rate.interest_rate;
    option.textContent = `${rate.term_months} tháng`;
    termSelect.appendChild(option);
  });

  // Trigger tính toán lại sau khi load dữ liệu
  const amountInput = document.getElementById('amount-input');
  if (amountInput) {
    amountInput.dispatchEvent(new Event('input'));
  }
}

// Fallback nếu API lỗi
function showFallbackTermSelect() {
  const termSelect = document.getElementById('term-select');
  if (!termSelect) {
    return;
  }
  termSelect.innerHTML = `
    <option value="" selected="selected" disabled="disabled">-- Chọn kỳ hạn --</option>
    <option value="1" data-rate="4.80">1 tháng (4.80%)</option>
    <option value="2" data-rate="5.80">2 tháng (5.80%)</option>
    <option value="3" data-rate="6.20">3 tháng (6.20%)</option>
    <option value="4" data-rate="6.50">4 tháng (6.50%)</option>
    <option value="5" data-rate="7.00">5 tháng (7.00%)</option>
    <option value="6" data-rate="7.70">6 tháng (7.70%)</option>
    <option value="7" data-rate="8.00">7 tháng (8.00%)</option>
    <option value="8" data-rate="8.50">8 tháng (8.50%)</option>
    <option value="9" data-rate="8.60">9 tháng (8.60%)</option>
    <option value="10" data-rate="8.70">10 tháng (8.70%)</option>
    <option value="11" data-rate="8.90">11 tháng (8.90%)</option>
    <option value="12" data-rate="9.10">12 tháng (9.10%)</option>
  `;

  // Trigger tính toán lại sau khi load fallback
  const amountInput = document.getElementById('amount-input');
  if (amountInput) {
    amountInput.dispatchEvent(new Event('input'));
  }
}

// Xử lý chọn chứng chỉ quỹ
function initFundSelect() {
  const fundSelect = document.getElementById('fund-select');
  let fundSearch = document.getElementById('fund-search');
  const fundNameDisplay = document.getElementById('summary-fund-name');
  const navDisplay = document.getElementById('current-nav');
  const currentId = document.getElementById('current-id');
  const amountInput = document.getElementById('amount-input');
  const amountDisplay = document.getElementById('summary-amount');

  const selectedTickerFromStorage = sessionStorage.getItem('selectedTicker');

  // Ẩn hẳn dropdown nếu còn hiển thị do cache/template cũ
  try {
    if (fundSelect) {
      fundSelect.style.display = 'none';
      fundSelect.setAttribute('aria-hidden', 'true');
      fundSelect.setAttribute('tabindex', '-1');
    }
  } catch (_) { }

  // Fallback: nếu input tìm kiếm chưa có trong template, tạo động để đảm bảo luôn nhập được
  try {
    if (fundSelect && !fundSearch) {
      const parent = fundSelect.parentElement;
      if (parent) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'fund-search';
        input.className = 'form-control mb-2';
        input.placeholder = 'Tìm theo tên/mã CCQ...';
        parent.insertBefore(input, fundSelect);
        fundSearch = input;
      }
    }
  } catch (_) { }

  fetch('/data_fund')
    .then(res => res.json())
    .then(fundData => {
      fundSelect.innerHTML = '<option disabled selected>-- Chọn quỹ đầu tư --</option>';

      fundData.forEach(fund => {
        const option = document.createElement('option');
        option.value = fund.ticker;
        option.textContent = `${fund.name} (${fund.ticker})`;
        option.dataset.id = fund.id;
        option.dataset.name = fund.name;
        option.dataset.nav = fund.current_nav; // Giữ lại cho hiển thị, nhưng không dùng để tính toán
        fundSelect.appendChild(option);
      });

      // Tìm kiếm realtime nâng cao (autocomplete + danh sách gợi ý giống ô search)
      if (fundSearch) {
        // Tạo suggestion panel
        const panel = document.createElement('div');
        panel.id = 'fund-suggest-panel';
        panel.style.position = 'absolute';
        panel.style.zIndex = '1050';
        panel.style.left = '0';
        panel.style.right = '0';
        panel.style.maxHeight = '280px';
        panel.style.overflowY = 'auto';
        panel.style.background = '#fff';
        panel.style.border = '1px solid #e5e7eb';
        panel.style.borderTop = 'none';
        panel.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)';
        panel.style.display = 'none';

        // wrapper để định vị tuyệt đối theo input
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        fundSearch.parentElement.insertBefore(wrapper, fundSearch);
        wrapper.appendChild(fundSearch);
        wrapper.appendChild(panel);

        let activeIdx = -1; // index đang chọn bằng phím

        const renderPanel = (items) => {
          panel.innerHTML = '';
          activeIdx = -1;
          items.forEach((f, idx) => {
            const row = document.createElement('div');
            row.style.padding = '8px 12px';
            row.style.cursor = 'pointer';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.onmouseenter = () => highlight(idx);
            row.onclick = () => choose(f);

            const badge = document.createElement('span');
            badge.textContent = f.ticker;
            badge.style.minWidth = '56px';
            badge.style.textAlign = 'center';
            badge.style.padding = '2px 8px';
            badge.style.borderRadius = '999px';
            badge.style.background = '#f3f4f6';
            badge.style.fontWeight = '600';

            const name = document.createElement('div');
            name.textContent = f.name || '';
            name.style.flex = '1';
            name.style.whiteSpace = 'nowrap';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';

            const price = document.createElement('div');
            price.textContent = (Number(f.current_nav || 0)).toLocaleString('vi-VN');
            price.style.color = '#64748b';

            row.appendChild(badge);
            row.appendChild(name);
            row.appendChild(price);
            panel.appendChild(row);
          });
          panel.style.display = items.length ? 'block' : 'none';
        };

        const highlight = (idx) => {
          const children = Array.from(panel.children);
          children.forEach((el, i) => {
            el.style.background = i === idx ? '#f1f5f9' : '#fff';
          });
          activeIdx = idx;
        };

        const choose = (fund) => {
          // set select & trigger change
          fundSelect.value = fund.ticker;
          fundSelect.dispatchEvent(new Event('change'));
          if (fundSearch) {
            fundSearch.value = `${fund.name} (${fund.ticker})`;
          }
          panel.style.display = 'none';
        };

        const doFilter = () => {
          const q = (fundSearch.value || '').trim().toLowerCase();
          const source = fundData;
          // Filter theo query nếu có, nếu không có query thì hiển thị tất cả
          const matches = (q ? source
            .filter(f => (f.name || '').toLowerCase().includes(q) || (f.ticker || '').toLowerCase().includes(q))
            : source)
            .slice(0, 10);
          renderPanel(matches);
          if (matches.length > 0) {
            panel.style.display = 'block';
          } else {
            panel.style.display = 'none';
          }
        };

        fundSearch.addEventListener('input', doFilter);

        // Reset search on click/focus to show full list
        fundSearch.addEventListener('click', () => {
          fundSearch.value = '';
          doFilter();
        });

        fundSearch.addEventListener('keydown', (e) => {
          const visible = panel.style.display !== 'none';
          if (!visible && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
            // Nếu panel đang ẩn và không phải phím điều hướng, hiển thị lại
            doFilter();
            return;
          }
          if (!visible) return;
          const children = Array.from(panel.children);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlight(Math.min(children.length - 1, activeIdx + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlight(Math.max(0, activeIdx - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && children[activeIdx]) {
              children[activeIdx].click();
            } else {
              const matches = fundData
                .filter(f => (f.name || '').toLowerCase().includes((fundSearch.value || '').toLowerCase()) || (f.ticker || '').toLowerCase().includes((fundSearch.value || '').toLowerCase()))
                .slice(0, 1);
              if (matches[0]) choose(matches[0]);
            }
          } else if (e.key === 'Escape') {
            panel.style.display = 'none';
          }
        });

        document.addEventListener('click', (ev) => {
          if (!panel.contains(ev.target) && ev.target !== fundSearch) {
            panel.style.display = 'none';
          }
        });

        // Hiển thị gợi ý khi focus - luôn hiển thị panel để có thể chọn lại mà không cần xóa text
        fundSearch.addEventListener('focus', () => {
          // Hiển thị panel với filter theo text hiện tại (nếu có) hoặc tất cả options (nếu không có text)
          // Người dùng có thể tiếp tục gõ để filter thêm mà không cần xóa text cũ
          doFilter();
        });
      }

      // 👉 Tự động chọn nếu có dữ liệu
      const selectedTicker = selectedTickerFromStorage;
      if (selectedTicker) {
        // Đợi DOM update option xong
        setTimeout(() => {
          fundSelect.value = selectedTicker;
          fundSelect.dispatchEvent(new Event('change'));
          const selected = fundData.find(f => f.ticker === selectedTicker);
          if (selected && fundSearch) {
            fundSearch.value = `${selected.name} (${selected.ticker})`;
          }
          sessionStorage.removeItem('selectedTicker'); // cleanup
        }, 0);
      }

      fundSelect.addEventListener('change', async () => {
        const selected = fundData.find(f => f.ticker === fundSelect.value);
        if (selected) {
          fundNameDisplay.textContent = selected.name;
          currentId.textContent = selected.id;
          if (fundSearch) {
            fundSearch.value = `${selected.name} (${selected.ticker})`;
          }

          // Lấy opening_avg_price hôm nay + chi phí vốn (đã cộng)
          try {
            // Ưu tiên dùng API nav_management (public)
            let openingPrice = Number(selected.current_nav); // Giữ lại cho hiển thị, nhưng không dùng để tính toán
            let capitalCostPercent = 0;
            let finalPrice = null; // chỉ gán khi đã cộng chi phí vốn

            // Thử JSON nav_management trước
            try {
              const nmJson = await fetch('/nav_management/api/opening_price_today', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
                body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { fund_id: selected.id } })
              });
              if (nmJson.ok) {
                const r = await nmJson.json();
                if (r && r.result && r.result.success) {
                  const d = r.result.data || {};
                  openingPrice = Number(d.opening_avg_price || openingPrice);
                  if (d.opening_price_with_capital_cost != null) {
                    finalPrice = Number(d.opening_price_with_capital_cost);
                    capitalCostPercent = Number(d.capital_cost_percent || 0);
                  }
                }
              }
            } catch (_) { }

            // Fallback HTTP GET nếu JSON thất bại
            if (!finalPrice || finalPrice <= 0) {
              try {
                const nmHttp = await fetch(`/nav_management/api/opening_price_today_http?fund_id=${encodeURIComponent(selected.id)}`);
                if (nmHttp.ok) {
                  const j = await nmHttp.json();
                  if (j && j.success) {
                    const d = j.data || {};
                    openingPrice = Number(d.opening_avg_price || openingPrice);
                    if (d.opening_price_with_capital_cost != null) {
                      finalPrice = Number(d.opening_price_with_capital_cost);
                      capitalCostPercent = Number(d.capital_cost_percent || 0);
                    }
                  }
                }
              } catch (_) { }
            }

            // Nếu chưa có finalPrice → cộng chi phí vốn từ nav_management fund_config
            if (!finalPrice || finalPrice <= 0) {
              try {
                const configResponse = await fetch('/nav_management/api/fund_config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                  credentials: 'same-origin',
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { fund_id: selected.id } })
                });
                const configResult = await configResponse.json();
                if (configResult && configResult.result && configResult.result.success) {
                  capitalCostPercent = Number(configResult.result.data.capital_cost_percent || 0);
                  finalPrice = openingPrice * (1 + capitalCostPercent / 100);
                }
              } catch (_) { }
            }

            // Cuối cùng, đảm bảo MROUND(step=50) và render
            finalPrice = Math.round(Number((finalPrice != null ? finalPrice : openingPrice)) / 50) * 50;

            // Kiểm tra nếu MM chưa có hàng tồn kho (giá = 0)
            if (finalPrice <= 0) {
              navDisplay.textContent = 'Chưa có dữ liệu';
              navDisplay.style.color = '#dc3545'; // Màu đỏ cảnh báo
            } else {
              navDisplay.textContent = finalPrice.toLocaleString('vi-VN') + 'đ';
              navDisplay.style.color = ''; // Reset về màu mặc định
            }

            // Lưu giá trị vào global
            window.currentNavPrice = finalPrice;
            window.currentNavBase = openingPrice;
            window.capitalCostPercent = capitalCostPercent;

            // Cập nhật hint số tiền đầu tư tối thiểu = giá CCQ * 100 CCQ
            updateMinInvestmentHint(finalPrice);

          } catch (error) {
            // Fallback về giá NAV hiện tại của fund
            const fallbackPrice = Number(selected.current_nav); // Giữ lại cho hiển thị, nhưng không dùng để tính toán
            if (navDisplay) {
              if (fallbackPrice <= 0) {
                navDisplay.textContent = 'Chưa có dữ liệu';
                navDisplay.style.color = '#dc3545';
              } else {
                navDisplay.textContent = fallbackPrice.toLocaleString('vi-VN') + 'đ';
                navDisplay.style.color = '';
              }
            }

            // Lưu giá trị fallback vào biến global
            window.currentNavPrice = fallbackPrice;
            window.currentNavBase = fallbackPrice;
            window.capitalCostPercent = 0;

            // Cập nhật hint số tiền đầu tư tối thiểu
            updateMinInvestmentHint(fallbackPrice);
          }

          // Reset số cổ phiếu về 0
          const shareInput = document.getElementById('share-quantity-input');
          if (shareInput) {
            shareInput.value = '';
            shareInput.dispatchEvent(new Event('input')); // Gọi lại tính toán nếu cần
          }

        } else {
          fundNameDisplay.textContent = '';
          currentId.textContent = 'Không xác định';
          navDisplay.textContent = 'Không xác định';
        }
      });

      amountInput.addEventListener('input', () => {
        const val = parseInt(amountInput.dataset.raw || '0');
        amountDisplay.textContent = val.toLocaleString('vi-VN') + 'đ';
      });
    })
    .catch(err => {
      if (navDisplay) {
        navDisplay.textContent = 'Không thể tải dữ liệu';
      }
    });
}

// Kiểm tra lãi/lỗ dựa trên chặn trên/dưới - Định nghĩa ở global scope để có thể gọi từ mọi nơi
async function checkProfitability(fundId, amount, months, rate) {
  const paymentBtn = document.getElementById('payment-btn');
  if (!paymentBtn) {
    return;
  }

  try {

    // Lấy cấu hình chặn trên/dưới từ nav_management
    const capResponse = await fetch('/nav_management/api/cap_config');
    const capData = await capResponse.json();

    if (!capData.success || !capData.cap_upper || !capData.cap_lower) {
      console.warn('Không thể lấy cấu hình chặn trên/dưới, cho phép thanh toán');
      paymentBtn.disabled = false;
      paymentBtn.style.opacity = '1';
      return;
    }

    // Lấy NAV hiện tại của quỹ
    const nav = window.currentNavPrice || 0;
    if (nav <= 0) {
      console.warn('Không có NAV hiện tại, cho phép thanh toán');
      paymentBtn.disabled = false;
      paymentBtn.style.opacity = '1';
      return;
    }

    // Số ngày theo kỳ hạn - tính giống Python backend
    const today = new Date();
    const maturityDate = calculateMaturityDate(today, months);
    const days = calculateDaysBetween(today, maturityDate);

    // Đọc số lượng CCQ từ input (fallback 1 nếu thiếu)
    const qtyInput = document.getElementById('share-quantity-input');
    const units = qtyInput ? (parseFloat(qtyInput.value) || 0) : 0;

    // Lấy giá CCQ tại thời điểm mua (J) từ currentNavPrice
    const pricePerUnit = nav; // J: Giá CCQ tại thời điểm mua

    // Lấy phí mua (K) từ fee-input hoặc summary-fee (số tiền tuyệt đối)
    const feeInput = document.getElementById('fee-input');
    const summaryFee = document.getElementById('summary-fee');
    let feeAmount = 0;
    if (feeInput && feeInput.value) {
      feeAmount = parseFloat(feeInput.value.replace(/[^0-9]/g, '')) || 0;
    } else if (summaryFee && summaryFee.textContent) {
      feeAmount = parseFloat(summaryFee.textContent.replace(/[^0-9]/g, '')) || 0;
    }

    // L: Giá trị mua = I * J + K (I = units, J = pricePerUnit, K = feeAmount)
    const purchaseValue = (units * pricePerUnit) + feeAmount;

    // Giá trị bán 1 (U) = Giá trị mua * Lãi suất / 365 * Số ngày + Giá trị mua
    const sellValue1 = purchaseValue * (rate / 100) / 365 * days + purchaseValue;

    // Giá bán 1 (S) = ROUND(Giá trị bán 1 / Số lượng CCQ, 0)
    const sellPrice1 = (units > 0) ? Math.round(sellValue1 / units) : 0;

    // Giá bán 2 (T) = MROUND(Giá bán 1, 50)
    const sellPrice2 = sellPrice1 ? (Math.round(sellPrice1 / 50) * 50) : 0;

    // Tính lãi suất quy đổi (O) = (Giá bán 2 / Giá mua - 1) * 365 / Số ngày * 100
    // J = Giá CCQ tại thời điểm mua = pricePerUnit
    const r_new = (pricePerUnit > 0 && days > 0 && sellPrice2 > 0) ? ((sellPrice2 / pricePerUnit - 1) * 365 / days * 100) : 0;

    // Tính chênh lệch lãi suất
    const delta = r_new - rate;

    // Kiểm tra lãi/lỗ
    const capUpper = parseFloat(capData.cap_upper);
    const capLower = parseFloat(capData.cap_lower);

    const isProfitable = delta >= capLower && delta <= capUpper;

    console.log(`📊 Kiểm tra lãi/lỗ:`);
    console.log(`   - NAV: ${nav}`);
    console.log(`   - Số lượng CCQ: ${units}`);
    console.log(`   - Giá CCQ tại thời điểm mua (J): ${pricePerUnit}`);
    console.log(`   - Phí mua (K): ${feeAmount}`);
    console.log(`   - Giá trị mua (L = I * J + K): ${purchaseValue}`);
    console.log(`   - Lãi suất gốc: ${rate}%`);
    console.log(`   - Giá trị bán 1 (U): ${sellValue1}`);
    console.log(`   - Giá bán 1 (S): ${sellPrice1}`);
    console.log(`   - Giá bán 2 (T): ${sellPrice2}`);
    console.log(`   - Lãi suất quy đổi (O): ${r_new}%`);
    console.log(`   - Chênh lệch: ${delta}%`);
    console.log(`   - Chặn trên: ${capUpper}%, Chặn dưới: ${capLower}%`);
    console.log(`   - Có lãi: ${isProfitable}`);

    if (isProfitable) {
      paymentBtn.disabled = false;
      paymentBtn.style.opacity = '1';
      paymentBtn.title = 'Đầu tư có lãi - Có thể thanh toán';
    } else {
      paymentBtn.disabled = true;
      paymentBtn.style.opacity = '0.5';
      paymentBtn.title = `Đầu tư không có lãi (chênh lệch: ${delta.toFixed(2)}% ngoài khoảng ${capLower}%-${capUpper}%)`;
    }

  } catch (error) {
    console.error('Lỗi kiểm tra lãi/lỗ:', error);
    // Nếu có lỗi, cho phép thanh toán để không block user
    paymentBtn.disabled = false;
    paymentBtn.style.opacity = '1';
  }
}

// Xử lý nút thanh toán
function initPaymentButton() {
  const paymentBtn = document.getElementById('payment-btn');
  const backBtn = document.getElementById('back-btn');
  const fundSelect = document.getElementById('fund-select');
  const amountInput = document.getElementById('amount-input');

  if (!paymentBtn || !backBtn || !fundSelect || !amountInput) {
    return;
  }

  // Kiểm tra lãi/lỗ và enable/disable button
  function checkProfitabilityAndUpdateButton() {

    const selectedOption = fundSelect.options[fundSelect.selectedIndex];
    if (!selectedOption) {
      paymentBtn.disabled = true;
      paymentBtn.style.opacity = '0.5';
      return;
    }
    const fundId = selectedOption.dataset.id;
    const investmentAmountInput = document.getElementById('investment-amount-input');
    const shareQuantityInput = document.getElementById('share-quantity-input');

    // Lấy số tiền từ investment amount input hoặc tính từ share quantity
    let amount = parseFloat(investmentAmountInput.value.replace(/[^0-9]/g, "")) || 0;
    if (amount === 0) {
      const shares = parseFloat(shareQuantityInput.value) || 0;
      const nav = window.currentNavPrice || 0;
      amount = shares * nav;
    }


    // Debug mode: bỏ qua check min amount nếu option được chọn
    const MIN_UNITS = 100;
    const nav = window.currentNavPrice || 0;
    const minAmount = (MIN_UNITS * nav);
    if (!fundId || amount < minAmount) {
      paymentBtn.disabled = true;
      paymentBtn.style.opacity = '0.5';
      return;
    }

    // Không auto-chặn theo sức mua ở bước này; kiểm tra tại thời điểm bấm thanh toán

    // Lấy thông tin lãi suất và kiểm tra lãi/lỗ
    const termSelect = document.getElementById('term-select');
    const selectedTermOption = termSelect.options[termSelect.selectedIndex];
    const months = parseInt(selectedTermOption.value, 10) || 0;
    const rate = parseFloat(selectedTermOption.dataset.rate) || 0;

    if (months === 0 || rate === 0) {
      paymentBtn.disabled = true;
      paymentBtn.style.opacity = '0.5';
      return;
    }

    // Tính toán lãi/lỗ dựa trên chặn trên/dưới
    checkProfitability(fundId, amount, months, rate);
  }

  paymentBtn.addEventListener('click', async () => {
    // Nếu đang ở chế độ lệnh thường, trigger event để component xử lý
    if (typeof currentOrderMode !== 'undefined' && currentOrderMode === 'normal') {
      document.dispatchEvent(new CustomEvent('trigger-normal-submit'));
      return;
    }

    const fundName = document.getElementById('summary-fund-name').textContent;
    const units = document.getElementById('summary-units').textContent;
    const investmentAmount = document.getElementById('summary-investment-amount').textContent.replace(/[^0-9]/g, '');
    const amount = document.getElementById('summary-amount').textContent.replace(/[^0-9]/g, '');
    const totalAmount = document.getElementById('summary-total').textContent.replace(/[^0-9]/g, '');
    const selectedOption = fundSelect.options[fundSelect.selectedIndex];
    const fundId = selectedOption.dataset.id;
    const fundSelectedText = selectedOption?.textContent.trim();

    if (!fundSelectedText || fundSelect.selectedIndex === 0) {
      Swal.fire({
        title: "Thiếu thông tin!",
        text: "Vui lòng chọn sản phẩm chứng chỉ quỹ để tiếp tục.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Sử dụng giá trị lệnh thực tế từ form (đã được MROUND 50)
    let finalAmount = parseInt(amount.replace(/[^0-9]/g, '')) || 0;
    if (finalAmount === 0) {
      // Fallback: sử dụng investment amount nếu amount input trống
      finalAmount = parseInt(investmentAmount.replace(/[^0-9]/g, '')) || 0;
    }

    if (finalAmount <= 0) {
      Swal.fire({
        title: "Thiếu thông tin!",
        text: "Vui lòng nhập số tiền đầu tư hoặc số lượng CCQ hợp lệ để tiếp tục.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Validate CCQ units
    const unitsInt = parseInt(units.replace(/[^0-9]/g, '')) || 0;

    // Min 100 CCQ validation (skip if debug option enabled)
    if (unitsInt < 100) {
      Swal.fire({
        title: "Số lượng CCQ quá thấp!",
        text: "Số lượng CCQ tối thiểu là 100 CCQ/lệnh.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Max 500,000 CCQ validation (skip if debug option enabled)
    if (unitsInt > 500000) {
      Swal.fire({
        title: "Số lượng CCQ quá cao!",
        text: "Số lượng CCQ tối đa là 500,000 CCQ/lệnh.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }
    // Lot size 100 CCQ validation (skip if debug option enabled)
    if (unitsInt > 0 && unitsInt % 100 !== 0) {
      Swal.fire({
        title: "Số lượng CCQ không hợp lệ!",
        text: "Số lượng CCQ phải theo lô 100 CCQ).",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Kiểm tra trạng thái lệnh từ widget (skip if debug option enabled)
    const profitStatus = document.getElementById('profit-status');
    const isLossOrder = profitStatus && profitStatus.textContent.includes('[Lỗ]');

    if (isLossOrder) {
      Swal.fire({
        title: "Lệnh không có lãi!",
        text: "Lệnh này không có lãi theo quy định. Vui lòng điều chỉnh số tiền đầu tư hoặc kỳ hạn.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#dc3545"
      });
      return;
    }

    // Nếu đang chọn kỳ hạn là "Tùy chỉnh", kiểm tra khoảng ngày
    const termValue = document.getElementById('term-select')?.value;
    if (!termValue) {
      Swal.fire({
        title: "Chưa chọn kỳ hạn!",
        text: "Vui lòng chọn kỳ hạn đầu tư.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return; // 🛑 Dừng lại nếu chưa chọn
    }

    sessionStorage.setItem('selectedFundId', fundId);
    sessionStorage.setItem('selectedFundName', fundName);
    sessionStorage.setItem('selectedUnits', units);
    sessionStorage.setItem('selectedInvestmentAmount', investmentAmount);
    sessionStorage.setItem('selectedAmount', amount);
    sessionStorage.setItem('selectedTotalAmount', totalAmount);

    // Lưu kỳ hạn và lãi suất đã chọn để hiển thị/submit ở bước sau
    const termSelect = document.getElementById('term-select');
    let selectedTerm = 0;
    let selectedRate = 0;

    if (termSelect && termSelect.selectedIndex >= 0) {
      const selectedOption = termSelect.options[termSelect.selectedIndex];
      selectedTerm = parseInt(selectedOption.value || '0', 10);
      selectedRate = parseFloat(selectedOption.dataset.rate || '0');

    }

    sessionStorage.setItem('selected_term_months', String(selectedTerm));
    sessionStorage.setItem('selected_interest_rate', String(selectedRate));

    // Mở điều khoản
    //    const termsModal = new bootstrap.Modal(document.getElementById('termsModal'));

    // Kiểm tra sức mua từ tài khoản đầu tư chứng khoán
    let hasSufficientFunds = false;
    const totalToPay = parseInt((document.getElementById('summary-total')?.textContent || '0').replace(/[^0-9]/g, ''), 10) || finalAmount;

    try {
      const resp = await fetch('/my-account/get_balance', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({})
      });
      const j = await resp.json().catch(() => ({}));
      const bal = (j && j.status === 'success') ? (Number(j.balance?.available_cash || j.balance?.purchasing_power || 0) || 0) : 0;

      // Kiểm tra sức mua
      if (bal > 0 && totalToPay <= bal) {
        hasSufficientFunds = true;
      }
    } catch (e) {
      console.error('Lỗi kiểm tra sức mua:', e);
      // Mặc định cho phép tiếp tục nếu không kiểm tra được
      hasSufficientFunds = true;
    }

    // Nếu KHÔNG đủ sức mua → Redirect sang trang thanh toán PayOS
    if (!hasSufficientFunds) {
      await Swal.fire({
        icon: 'warning',
        title: 'Không đủ sức mua',
        text: 'Số dư tài khoản không đủ. Bạn sẽ được chuyển đến trang thanh toán.',
        confirmButtonText: 'Tiếp tục thanh toán',
        confirmButtonColor: '#36A2EB'
      });
      // Redirect sang fund_confirm để thanh toán PayOS
      window.location.href = '/fund_confirm';
      return;
    }

    // Nếu ĐỦ sức mua → Tiếp tục hiển thị hợp đồng, OTP và tạo lệnh

    // Smart OTP trước khi hiển thị hợp đồng/ký tên
    // Hiển thị modal signature để ký tên
    const showSignature = () => {
      try {
        const signatureModalElement = document.getElementById('signatureModal');
        if (!signatureModalElement) {
          window.location.href = '/fund_confirm';
          return;
        }

        // Kiểm tra xem Bootstrap có sẵn không
        if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
          window.location.href = '/fund_confirm';
          return;
        }

        // Kiểm tra xem modal đã được khởi tạo chưa
        let signatureModal = bootstrap.Modal.getInstance(signatureModalElement);
        if (!signatureModal) {
          signatureModal = new bootstrap.Modal(signatureModalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
          });
        }

        // Load PDF contract vào viewer nếu có
        const pdfViewer = document.getElementById('contract-pdf-viewer');
        if (pdfViewer) {
          const pdfUrl = resolvePdfUrl();
          if (pdfUrl) {
            pdfViewer.src = pdfUrl + '#toolbar=0';
          }
        }

        signatureModal.show();
      } catch (error) {
        console.error('Lỗi hiển thị modal:', error);
        // Fallback: chuyển sang trang fund_confirm
        window.location.href = '/fund_confirm';
      }
    };

    // Hiển thị modal ký hợp đồng
    // OTP và tạo lệnh được xử lý trong signature_sign.js sau khi ký xong
    showSignature();
  });

  backBtn.addEventListener('click', () => {
    window.location.href = '/fund_widget';
  });

  // Thêm event listeners để kiểm tra lãi/lỗ khi có thay đổi
  fundSelect.addEventListener('change', checkProfitabilityAndUpdateButton);
  amountInput.addEventListener('input', checkProfitabilityAndUpdateButton);

  // Thêm event listener cho investment amount input
  const investmentAmountInput = document.getElementById('investment-amount-input');
  if (investmentAmountInput) {
    investmentAmountInput.addEventListener('input', checkProfitabilityAndUpdateButton);
  }

  // Thêm event listener cho share quantity input
  const shareQuantityInput = document.getElementById('share-quantity-input');
  if (shareQuantityInput) {
    shareQuantityInput.addEventListener('input', checkProfitabilityAndUpdateButton);
  }

  // Thêm event listener cho term select
  const termSelect = document.getElementById('term-select');
  if (termSelect) {
    termSelect.addEventListener('change', checkProfitabilityAndUpdateButton);
  }

  // Kiểm tra lần đầu khi trang load
  setTimeout(checkProfitabilityAndUpdateButton, 1000);
}

//Tính toán phí mua
//function initFeeCalculation() {
//  const amountInput = document.getElementById('amount-input');
//  const feeInput = document.getElementById('fee-input');
//  const summaryAmount = document.getElementById('summary-amount');
//  const summaryFee = document.getElementById('summary-fee');
//  const summaryTotal = document.getElementById('summary-total');
//
//  amountInput.addEventListener('input', () => {
//      // Lấy số gốc không có dấu
//      let raw = amountInput.value.replace(/[^0-9]/g, '');
//
//      // Giới hạn tối đa 12 chữ số
//      if (raw.length > 12) {
//        raw = raw.slice(0, 12);
//      }
//
//      // Lưu lại vào dataset
//      amountInput.dataset.raw = raw;
//
//      // Format lại input để hiển thị
//      amountInput.value = raw ? Number(raw).toLocaleString('vi-VN') : '';
//
//      // Tính toán phí
//      const amount = parseInt(raw || '0');
//      let fee = 0;
//
//      if (amount < 10000000) fee = amount * 0.003;
//      else if (amount < 20000000) fee = amount * 0.002;
//      else fee = amount * 0.001;
//
//      const total = amount + fee;
//      feeInput.value = Math.floor(fee).toLocaleString('vi-VN') + 'đ';
//      summaryAmount.textContent = amount.toLocaleString('vi-VN') + 'đ';
//      summaryFee.textContent = Math.floor(fee).toLocaleString('vi-VN') + 'đ';
//      summaryTotal.textContent = Math.floor(total).toLocaleString('vi-VN') + 'đ';
//    });
//}

// Xử lý tính toán số lượng CCQ từ số tiền đầu tư
function initInvestmentAmountCalculation() {
  const investmentAmountInput = document.getElementById('investment-amount-input');
  const shareQuantityInput = document.getElementById('share-quantity-input');
  const amountInput = document.getElementById('amount-input');
  const feeInput = document.getElementById('fee-input');
  const maturityPriceDisplay = document.getElementById('maturity-price');

  const summaryInvestmentAmount = document.getElementById('summary-investment-amount');
  const summaryAmount = document.getElementById('summary-amount');
  const summaryFee = document.getElementById('summary-fee');
  const summaryTotal = document.getElementById('summary-total');
  const summaryUnits = document.getElementById('summary-units');

  if (!investmentAmountInput) {
    return;
  }

  // Flag để tránh vòng lặp vô hạn
  let isUpdatingFromInvestment = false;

  investmentAmountInput.addEventListener('input', () => {
    if (isUpdatingFromInvestment) return;
    isUpdatingFromInvestment = true;
    // Lấy số tiền đầu tư (raw number, không dấu)
    let rawAmount = investmentAmountInput.value.replace(/[^0-9]/g, '');

    // Giới hạn cứng 12 chữ số
    if (rawAmount.length > 12) {
      rawAmount = rawAmount.slice(0, 12);
      investmentAmountInput.value = rawAmount;
    }

    const investmentAmount = parseFloat(rawAmount || '0');

    // Tính số lượng CCQ từ số tiền đầu tư
    const nav = window.currentNavPrice || 0;

    if (nav > 0 && investmentAmount > 0) {
      // Tính số lượng CCQ = Số tiền đầu tư / Giá CCQ
      const sharesRaw = investmentAmount / nav;
      // Làm tròn số CCQ theo lô 100 gần nhất
      const shares = Math.round(sharesRaw / 100) * 100;
      // Cập nhật số lượng CCQ (đảm bảo không âm)
      shareQuantityInput.value = shares > 0 ? shares.toLocaleString('vi-VN') : '';

      // Tính lại số tiền đầu tư theo số CCQ đã làm tròn
      let actualAmount = shares * nav;
      // Chuẩn hóa MROUND25 cho số tiền
      actualAmount = mround25(actualAmount, 50);
      const formattedAmount = actualAmount ? actualAmount.toLocaleString('vi-VN') : '';
      amountInput.value = formattedAmount;

      // Tính phí dựa trên actualAmount thực tế
      let fee = 0;
      if (actualAmount < 10000000) fee = actualAmount * 0.003;
      else if (actualAmount < 20000000) fee = actualAmount * 0.002;
      else fee = actualAmount * 0.001;

      const total = actualAmount + fee;

      // Summary MROUND25
      const investmentAmountRounded = mround25(investmentAmount, 50);
      const actualAmountRounded = mround25(actualAmount, 50);
      const feeRounded = mround25(fee, 50);
      const totalRounded = mround25(total, 50);

      if (feeInput) feeInput.value = feeRounded.toLocaleString('vi-VN') + 'đ';
      if (summaryInvestmentAmount) summaryInvestmentAmount.textContent = investmentAmountRounded.toLocaleString('vi-VN') + 'đ';
      summaryAmount.textContent = actualAmountRounded.toLocaleString('vi-VN') + 'đ';
      summaryFee.textContent = feeRounded.toLocaleString('vi-VN') + 'đ';
      summaryTotal.textContent = totalRounded.toLocaleString('vi-VN') + 'đ';
      summaryUnits.textContent = shares;

      // Cập nhật trạng thái sức mua nếu đã có dữ liệu
      const purchasingPower = window.__stockPurchasingPower__ || 0;
      const statusEl = document.getElementById('purchasing-power-status');
      const statusSumEl = document.getElementById('summary-purchasing-power-status');
      if (purchasingPower > 0) {
        const hasEnough = totalRounded <= purchasingPower;
        if (statusEl) {
          statusEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
          statusEl.classList.remove('text-success', 'text-danger');
          statusEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
        }
        if (statusSumEl) {
          statusSumEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
          statusSumEl.classList.remove('text-success', 'text-danger');
          statusSumEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
        }
      }

      // Tính giá mua khi đáo hạn
      calculateMaturityPrice(shares, nav);
    } else {
      // Reset các giá trị nếu không có dữ liệu hợp lệ
      shareQuantityInput.value = '';
      amountInput.value = '';
      if (feeInput) feeInput.value = '0đ';
      if (summaryInvestmentAmount) summaryInvestmentAmount.textContent = '0đ';
      if (summaryAmount) summaryAmount.textContent = '0đ';
      if (summaryFee) summaryFee.textContent = '0đ';
      if (summaryTotal) summaryTotal.textContent = '0đ';
      if (summaryUnits) summaryUnits.textContent = '0';
      if (maturityPriceDisplay) maturityPriceDisplay.textContent = '...';
    }
    isUpdatingFromInvestment = false;
  });

  // Commit khi Enter/blur: làm tròn shares theo lô 100 và cập nhật lại số tiền đầu tư tương ứng
  const commitFromInvestment = () => {
    if (isUpdatingFromInvestment) return;
    const nav = window.currentNavPrice || 0;
    let rawAmount = investmentAmountInput.value.replace(/[^0-9]/g, '');
    const investmentAmount = parseFloat(rawAmount || '0');
    if (nav <= 0 || investmentAmount <= 0) return;
    // Tính shares và MROUND25 cho shares
    // Tính shares từ amount
    let shares = Math.floor(investmentAmount / nav);

    // Validate min/max/lot cho shares (skip if debug options enabled)
    // Validate min/max/lot cho shares (skip if debug options enabled)
    if (!shouldSkipMinCcq() && shares < 100) shares = 100;
    if (!shouldSkipMaxCcq() && shares > 500000) shares = 500000;
    if (!shouldSkipLotSize()) shares = Math.round(shares / 100) * 100;

    // Cập nhật số CCQ đã làm tròn
    shareQuantityInput.value = shares > 0 ? shares.toLocaleString('vi-VN') : '';

    // Tính lại investment amount thực tế theo shares đã chuẩn hóa
    const actualAmount = shares * nav;

    // Cập nhật Investment Input (hiển thị số tiền thực tế cần đầu tư)
    investmentAmountInput.value = actualAmount.toLocaleString('vi-VN');
    amountInput.value = actualAmount.toLocaleString('vi-VN');

    // Kích hoạt lại luồng tính toán để cập nhật fee/summary
    shareQuantityInput.dispatchEvent(new Event('input'));

    // Validate số lượng CCQ tối thiểu sau khi tính
    validateCCQUnits(shares);
  };

  // Validate số lượng CCQ tối thiểu/tối đa (skip if debug options enabled)
  function validateCCQUnits(shares) {
    const MIN_UNITS = 100;
    const MAX_UNITS = 500000;
    const LOT_SIZE = 100;

    if (shares === 0) return;

    // Skip min validation if debug option enabled
    if (!shouldSkipMinCcq() && shares < MIN_UNITS) {
      const nav = window.currentNavPrice || 0;
      const minAmount = nav > 0 ? (MIN_UNITS * nav) : 0;
      Swal.fire({
        title: "Số lượng CCQ quá thấp!",
        text: `Số lượng CCQ tối thiểu là ${MIN_UNITS.toLocaleString('vi-VN')} CCQ. Vui lòng nhập số tiền tối thiểu ${minAmount.toLocaleString('vi-VN')}đ.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Skip max validation if debug option enabled
    if (!shouldSkipMaxCcq() && shares > MAX_UNITS) {
      Swal.fire({
        title: "Số lượng CCQ quá cao!",
        text: `Số lượng CCQ tối đa là ${MAX_UNITS.toLocaleString('vi-VN')} CCQ/lệnh.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Skip lot size validation if debug option enabled
    if (!shouldSkipLotSize() && shares % LOT_SIZE !== 0) {
      Swal.fire({
        title: "Số lượng CCQ không hợp lệ!",
        text: `Số lượng CCQ phải theo lô ${LOT_SIZE} CCQ.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
    }
  }

  investmentAmountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitFromInvestment();
      investmentAmountInput.blur();
    }
  });
  investmentAmountInput.addEventListener('blur', commitFromInvestment);
}

// Cập nhật hiển thị giá trị đáo hạn
function updateFinalValueDisplay(finalValue, isProfitable, delta = 0) {
  const finalValueField = document.getElementById('final-value');
  const paymentBtn = document.getElementById('payment-btn');

  // Kiểm tra null để tránh lỗi
  if (!finalValueField) {
    console.error('Element with id "final-value" not found');
    return;
  }

  // Hiển thị giá trị
  finalValueField.textContent = finalValue.toLocaleString("vi-VN") + " đ";

  // Reset về màu mặc định (không tô màu)
  finalValueField.style.color = '';
  finalValueField.style.backgroundColor = '';
  finalValueField.style.borderColor = '';

  // Điều khiển button thanh toán dựa trên trạng thái lãi/lỗ
  if (paymentBtn) {
    if (isProfitable === false) {
      // Nếu lỗ - disable button
      paymentBtn.disabled = true;
      paymentBtn.style.opacity = '0.5';
      paymentBtn.style.cursor = 'not-allowed';
    } else {
      // Nếu lãi hoặc không xác định - enable button
      paymentBtn.disabled = false;
      paymentBtn.style.opacity = '1';
      paymentBtn.style.cursor = 'pointer';
    }
  }
}

// Tính giá mua khi đáo hạn theo công thức từ nav_management
function calculateMaturityPrice(shares, nav) {
  const maturityPriceDisplay = document.getElementById('maturity-price');
  const termSelect = document.getElementById('term-select');
  const selectedOption = termSelect.options[termSelect.selectedIndex];
  const months = parseInt(selectedOption.value, 10) || 0;
  const rate = parseFloat(selectedOption.dataset.rate) || 0;

  if (months > 0 && rate > 0 && shares > 0) {
    // Công thức NAV mới: Tính toán đầy đủ theo công thức từ nav_management
    // Tính ngày đáo hạn từ ngày hiện tại + kỳ hạn (giống Python backend)
    const today = new Date();
    const maturityDate = calculateMaturityDate(today, months);

    // Tính số ngày thực tế giữa ngày mua và ngày đáo hạn (giống Python backend)
    const days = calculateDaysBetween(today, maturityDate);

    // Lấy giá CCQ tại thời điểm mua (J) từ nav
    const pricePerUnit = nav; // J: Giá CCQ tại thời điểm mua

    // Lấy phí mua (K) từ fee-input hoặc summary-fee (số tiền tuyệt đối)
    const feeInput = document.getElementById('fee-input');
    const summaryFee = document.getElementById('summary-fee');
    let feeAmount = 0;
    if (feeInput && feeInput.value) {
      feeAmount = parseFloat(feeInput.value.replace(/[^0-9]/g, '')) || 0;
    } else if (summaryFee && summaryFee.textContent) {
      feeAmount = parseFloat(summaryFee.textContent.replace(/[^0-9]/g, '')) || 0;
    }

    // L: Giá trị mua = I * J + K (I = shares, J = pricePerUnit, K = feeAmount)
    const purchaseValue = (shares * pricePerUnit) + feeAmount;

    // U: Giá trị bán 1 = L * N / 365 * G + L
    const sellValue1 = purchaseValue * (rate / 100) / 365 * days + purchaseValue;

    // S: Giá bán 1 = ROUND(U / I, 0)
    const sellPrice1 = Math.round(sellValue1 / shares);

    // T: Giá bán 2 = MROUND25(S, 50) - dưới 25đ làm tròn xuống, từ 25đ làm tròn lên
    const sellPrice2 = mround25(sellPrice1, 50);

    if (maturityPriceDisplay) maturityPriceDisplay.textContent = sellPrice2.toLocaleString('vi-VN') + 'đ';
  } else {
    if (maturityPriceDisplay) maturityPriceDisplay.textContent = '...';
  }
}

// xử lý nhập số cổ phiếu và tính toán tổng chi phí dựa trên NAV và biểu phí, tính phí mua
function initShareQuantityCalculation() {
  const shareInput = document.getElementById('share-quantity-input');
  const investmentAmountInput = document.getElementById('investment-amount-input');
  const amountInput = document.getElementById('amount-input');
  const feeInput = document.getElementById('fee-input');
  const maturityPriceDisplay = document.getElementById('maturity-price');

  const summaryInvestmentAmount = document.getElementById('summary-investment-amount');
  const summaryAmount = document.getElementById('summary-amount');
  const summaryFee = document.getElementById('summary-fee');
  const summaryTotal = document.getElementById('summary-total');
  const summaryUnits = document.getElementById('summary-units');

  if (!shareInput) {
    return;
  }

  // Flag để tránh vòng lặp vô hạn
  let isUpdatingFromShares = false;

  shareInput.addEventListener('input', () => {
    if (isUpdatingFromShares) return;
    isUpdatingFromShares = true;
    // Lấy số lượng CCQ (raw number, không dấu)
    let rawShares = shareInput.value.replace(/[^0-9]/g, '');

    // Giới hạn cứng 6 chữ số
    if (rawShares.length > 6) {
      rawShares = rawShares.slice(0, 6);
      shareInput.value = rawShares;
    }

    const shares = parseFloat(rawShares || '0');

    // Tính số tiền đầu tư từ số lượng CCQ
    const nav = window.currentNavPrice || 0;

    if (nav > 0 && shares > 0) {
      // Tính số tiền đầu tư = Số lượng CCQ * Giá CCQ
      const investmentAmount = shares * nav;

      // Cập nhật số tiền đầu tư
      investmentAmountInput.value = investmentAmount.toLocaleString('vi-VN');

      // Tính số tiền mua CCQ thực tế (MROUND 50)
      const actualAmount = Math.round(investmentAmount / 50) * 50;
      const formattedAmount = actualAmount.toLocaleString('vi-VN');
      amountInput.value = formattedAmount;

      // Tính phí dựa trên actualAmount thực tế
      let fee = 0;
      if (actualAmount < 10000000) fee = actualAmount * 0.003;
      else if (actualAmount < 20000000) fee = actualAmount * 0.002;
      else fee = actualAmount * 0.001;

      const total = actualAmount + fee;

      // Summary MROUND 50
      const investmentAmountRounded = Math.round(investmentAmount / 50) * 50;
      const actualAmountRounded = Math.round(actualAmount / 50) * 50;
      const feeRounded = Math.round(fee / 50) * 50;
      const totalRounded = Math.round(total / 50) * 50;

      if (feeInput) feeInput.value = feeRounded.toLocaleString('vi-VN') + 'đ';
      if (summaryInvestmentAmount) summaryInvestmentAmount.textContent = investmentAmountRounded.toLocaleString('vi-VN') + 'đ';
      if (summaryAmount) summaryAmount.textContent = actualAmountRounded.toLocaleString('vi-VN') + 'đ';
      if (summaryFee) summaryFee.textContent = feeRounded.toLocaleString('vi-VN') + 'đ';
      summaryTotal.textContent = totalRounded.toLocaleString('vi-VN') + 'đ';
      summaryUnits.textContent = shares;

      // Cập nhật trạng thái sức mua nếu đã có dữ liệu
      const purchasingPower = window.__stockPurchasingPower__ || 0;
      const statusEl = document.getElementById('purchasing-power-status');
      const statusSumEl = document.getElementById('summary-purchasing-power-status');
      if (purchasingPower > 0) {
        const hasEnough = totalRounded <= purchasingPower;
        if (statusEl) {
          statusEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
          statusEl.classList.remove('text-success', 'text-danger');
          statusEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
        }
        if (statusSumEl) {
          statusSumEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
          statusSumEl.classList.remove('text-success', 'text-danger');
          statusSumEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
        }
      }

      // Tính giá mua khi đáo hạn
      calculateMaturityPrice(shares, nav);
    } else {
      // Reset các giá trị nếu không có dữ liệu hợp lệ
      investmentAmountInput.value = '';
      amountInput.value = '';
      if (feeInput) feeInput.value = '0đ';
      if (summaryInvestmentAmount) summaryInvestmentAmount.textContent = '0đ';
      if (summaryAmount) summaryAmount.textContent = '0đ';
      if (summaryFee) summaryFee.textContent = '0đ';
      if (summaryTotal) summaryTotal.textContent = '0đ';
      if (summaryUnits) summaryUnits.textContent = '0';
      if (maturityPriceDisplay) maturityPriceDisplay.textContent = '...';
    }
    isUpdatingFromShares = false;
  });


  // Thêm validation cho lô 100 và tối thiểu 100 (có thông báo lỗi trước khi làm tròn)
  shareInput.addEventListener('blur', () => {
    // Strip non-numeric chars (thousands separators) before parsing
    let value = parseInt(shareInput.value.replace(/[^0-9]/g, ''), 10);
    let originalValue = value;
    let hasError = false;

    // Nếu không phải số hợp lệ hoặc <= 0 thì mặc định về tối thiểu (skip if debug mode)
    if (isNaN(value) || value <= 0) {
      value = shouldSkipMinCcq() ? 100 : 20000;
      // Không cần alert ở đây vì người dùng có thể xóa hết input
    }

    // Nếu nhỏ hơn tối thiểu 100 (skip if debug option enabled)
    if (!shouldSkipMinCcq() && value < 100) {
      Swal.fire({
        title: "Số lượng quá thấp",
        text: "Số lượng CCQ mua tối thiểu là 100.",
        icon: "warning",
        confirmButtonColor: "#F26522"
      });
      value = 100;
      hasError = true;
    }
    // Nếu lớn hơn tối đa 500,000 (skip if debug option enabled)
    else if (!shouldSkipMaxCcq() && value > 500000) {
      Swal.fire({
        title: "Số lượng quá cao",
        text: "Số lượng CCQ mua tối đa là 500.000.",
        icon: "warning",
        confirmButtonColor: "#F26522"
      });
      value = 500000;
      hasError = true;
    }
    // Check lô 100 (skip if debug option enabled)
    else if (!shouldSkipLotSize() && value % 100 !== 0) {
      Swal.fire({
        title: "Số lượng không hợp lệ",
        text: "Số lượng CCQ phải theo lô 100.",
        icon: "warning",
        confirmButtonColor: "#F26522"
      });
      value = Math.round(value / 100) * 100;
      hasError = true;
    }

    // Cập nhật giá trị (đã làm tròn và đảm bảo tối thiểu/tối đa)
    shareInput.value = value.toLocaleString('vi-VN');
    shareInput.dispatchEvent(new Event('input'));
  });
}

function initRealtimeClock() {
  const clockEl = document.getElementById('buy-order-date');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    // Format: HH:mm:ss dd/MM/yyyy
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false }); // HH:mm:ss
    const dateStr = now.toLocaleDateString('vi-VN'); // dd/MM/yyyy
    clockEl.textContent = `${timeStr} ${dateStr}`;
  }

  update(); // run immediately
  setInterval(update, 1000); // update every second
}


// Nạp sức mua từ stock_trading và chỉ hiển thị trạng thái (không hiển thị số dư)
function initPurchasingPowerCheck() {
  fetch('/my-account/get_balance', {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({})
  }).then(async (res) => {
    const statusEl = document.getElementById('purchasing-power-status');
    const statusSumEl = document.getElementById('summary-purchasing-power-status');
    if (!res.ok) { if (statusEl) statusEl.textContent = 'Không xác định'; if (statusSumEl) statusSumEl.textContent = 'Không xác định'; return; }
    const data = await res.json();
    if (!data || data.status !== 'success') { if (statusEl) statusEl.textContent = 'Không xác định'; if (statusSumEl) statusSumEl.textContent = 'Không xác định'; return; }
    const bal = Math.max(0, Number((data.balance && (data.balance.available_cash || data.balance.purchasing_power)) || 0));
    window.__stockPurchasingPower__ = bal;

    // Sau khi có sức mua, cập nhật trạng thái ngay theo tổng cần thanh toán
    const totalEl = document.getElementById('summary-total');
    const total = totalEl ? parseFloat((totalEl.textContent || '0').replace(/[^0-9]/g, '')) || 0 : 0;
    const hasEnough = bal > 0 ? (total <= bal) : true;
    if (statusEl) {
      statusEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
      statusEl.classList.remove('text-success', 'text-danger');
      statusEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
    }
    if (statusSumEl) {
      statusSumEl.textContent = hasEnough ? 'Đủ sức mua' : 'Không đủ sức mua';
      statusSumEl.classList.remove('text-success', 'text-danger');
      statusSumEl.classList.add(hasEnough ? 'text-success' : 'text-danger');
    }
  }).catch(() => {
    const statusEl = document.getElementById('purchasing-power-status');
    const statusSumEl = document.getElementById('summary-purchasing-power-status');
    if (statusEl) { statusEl.textContent = 'Không xác định'; statusEl.classList.remove('text-success', 'text-danger'); }
    if (statusSumEl) { statusSumEl.textContent = 'Không xác định'; statusSumEl.classList.remove('text-success', 'text-danger'); }
  });
}

// Xử lý cập nhật số ccq theo giá tiền. đã bỏ ko sử dụng
function initUnitsCalculation() {
  const amountInput = document.getElementById('amount-input');
  const navDisplay = document.getElementById('current-nav');
  const summaryUnits = document.getElementById('summary-units');

  amountInput.addEventListener('input', () => {
    const amount = parseFloat(amountInput.dataset.raw || '0');
    // Sử dụng giá trị lệnh thực tế từ form thay vì currentNavPrice
    const actualAmountInput = document.getElementById('amount-input');
    let actualAmount = 0;

    if (actualAmountInput && actualAmountInput.value) {
      actualAmount = parseFloat(actualAmountInput.value.replace(/[^0-9]/g, "")) || 0;
    }

    // Tính units từ actualAmount thực tế
    const units = (actualAmount > 0) ? (actualAmount / (window.currentNavPrice || 1)).toFixed(2) : 0;
    summaryUnits.textContent = units;
  });
}

// Lưu giá trị raw để tính toán và validate
function formatAmountInputWithRaw(inputElement) {
  if (!inputElement) {
    return;
  }
  inputElement.addEventListener('input', () => {
    const raw = inputElement.value.replace(/[^0-9]/g, '');
    inputElement.dataset.raw = raw;  // lưu raw value
    inputElement.value = raw ? Number(raw).toLocaleString('vi-VN') : '';
  });

  // Validate khi blur
  inputElement.addEventListener('blur', () => {
    const raw = inputElement.value.replace(/[^0-9]/g, '');
    let amount = parseFloat(raw) || 0;
    const nav = window.currentNavPrice || 0;

    if (amount <= 0 || nav <= 0) return;

    // Convert sang số lượng CCQ tương ứng
    let shares = amount / nav;
    let originalShares = shares;
    let hasChanged = false;

    // 1. Check Min: 100 CCQ (skip if debug option enabled)
    if (!shouldSkipMinCcq() && shares < 100) {
      Swal.fire({
        title: "Số tiền đầu tư quá thấp",
        text: `Tương đương ${shares.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} CCQ. Tối thiểu cần 100 CCQ.`,
        icon: "warning",
        confirmButtonColor: "#F26522"
      });
      shares = 100;
      hasChanged = true;
    }
    // 2. Check Max: 500,000 CCQ (skip if debug option enabled)
    else if (!shouldSkipMaxCcq() && shares > 500000) {
      Swal.fire({
        title: "Số tiền đầu tư quá cao",
        text: `Tương đương ${shares.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} CCQ. Tối đa cho phép 500.000 CCQ.`,
        icon: "warning",
        confirmButtonColor: "#F26522"
      });
      shares = 500000;
      hasChanged = true;
    }
    // 3. Check Lot: 100 CCQ (skip if debug option enabled)
    else if (!shouldSkipLotSize()) {
      // Làm tròn shares để check lot
      let roundedShares = Math.round(shares);
      if (roundedShares % 100 !== 0) {
        Swal.fire({
          title: "Số tiền lẻ lô",
          text: `Số lượng CCQ quy đổi (${shares.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}) phải theo lô 100.`,
          icon: "warning",
          confirmButtonColor: "#F26522"
        });
        shares = Math.round(shares / 100) * 100;
        hasChanged = true;
      }
    }

    if (hasChanged) {
      // Tính lại số tiền theo shares đã correct (làm tròn lên theo lô 50đ của amount nếu cần)
      let newAmount = shares * nav;
      // Có thể cần làm tròn amount
      newAmount = Math.ceil(newAmount);

      inputElement.value = newAmount.toLocaleString('vi-VN');
      inputElement.dataset.raw = newAmount;
      inputElement.dispatchEvent(new Event('input'));
    }
  });
}


// Xác nhận điều khoản. Đã bỏ ko sử dụng
function initTermsModalActions() {
  const agreeCheckbox = document.getElementById('agreeTermsCheckbox');
  const openSignatureBtn = document.getElementById('open-signature-btn');

  if (!agreeCheckbox || !openSignatureBtn) return;

  openSignatureBtn.addEventListener('click', (e) => {
    if (!agreeCheckbox.checked) {
      e.preventDefault();
      Swal.fire("Bạn chưa đồng ý", "Vui lòng tick vào ô đồng ý điều khoản để tiếp tục.", "warning");
      return;
    }

    // Hiển thị modal ký tên
    try {
      const signatureModalElement = document.getElementById('signatureModal');
      if (!signatureModalElement) {
        console.warn('[Terms] Modal element not found, redirecting to fund_confirm');
        window.location.href = '/fund_confirm';
        return;
      }

      if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        console.error('[Terms] Bootstrap Modal is not available, redirecting to fund_confirm');
        window.location.href = '/fund_confirm';
        return;
      }

      let signatureModal = bootstrap.Modal.getInstance(signatureModalElement);
      if (!signatureModal) {
        signatureModal = new bootstrap.Modal(signatureModalElement, {
          backdrop: true,
          keyboard: true,
          focus: true
        });
      }

      // Load PDF contract vào viewer nếu có
      const pdfViewer = document.getElementById('contract-pdf-viewer');
      if (pdfViewer) {
        const pdfUrl = resolvePdfUrl();
        if (pdfUrl) {
          pdfViewer.src = pdfUrl + '#toolbar=0';
        }
      }

      signatureModal.show();
    } catch (error) {
      console.error('[Terms] Error showing signature modal:', error);
      window.location.href = '/fund_confirm';
    }
  });
}

// Edit format của input số CCQ
function initShareQuantityInput() {
  const input = document.getElementById('share-quantity-input');
  if (!input) return;

  // Tạo nút tăng/giảm theo lô 100 nếu chưa có
  try {
    const wrapper = input.parentElement;
    if (wrapper && !wrapper.querySelector('.share-input-group')) {
      // Tạo group: [-] [input] [+]
      const group = document.createElement('div');
      group.className = 'share-input-group';
      group.style.display = 'inline-flex';
      group.style.alignItems = 'center';
      group.style.gap = '8px';

      const btnDec = document.createElement('button');
      btnDec.type = 'button';
      btnDec.textContent = '-';
      btnDec.className = 'btn btn-light btn-sm share-stepper';
      btnDec.addEventListener('click', () => {
        const current = parseInt(input.value.replace(/[^0-9]/g, ''), 10) || 0;
        const nextRaw = Math.max(0, current - 100); // step 100
        const next = nextRaw > 0 ? Math.round(nextRaw / 100) * 100 : 0; // chuẩn hóa theo lô 100
        input.value = next > 0 ? next.toLocaleString('vi-VN') : '';
        // Cập nhật amount-input ngay để thuật toán đáo hạn dùng đúng dữ liệu như nhập tay
        const amountEl = document.getElementById('amount-input');
        const nav = window.currentNavPrice || 0;
        const investmentAmount = (next > 0 && nav > 0) ? (next * nav) : 0;
        const actualAmount = Math.round(investmentAmount / 100) * 100; // Changed to 100-lot rounding
        if (amountEl) {
          amountEl.value = actualAmount ? actualAmount.toLocaleString('vi-VN') : '';
          amountEl.dispatchEvent(new Event('input'));
        }
        input.dispatchEvent(new Event('input'));
      });

      const btnInc = document.createElement('button');
      btnInc.type = 'button';
      btnInc.textContent = '+';
      btnInc.className = 'btn btn-light btn-sm share-stepper';
      btnInc.addEventListener('click', () => {
        const current = parseInt(input.value.replace(/[^0-9]/g, ''), 10) || 0;
        const nextRaw = current + 100; // step 100
        const next = Math.round(nextRaw / 100) * 100; // chuẩn hóa theo lô 100
        input.value = next.toLocaleString('vi-VN');
        // Cập nhật amount-input ngay để thuật toán đáo hạn dùng đúng dữ liệu như nhập tay
        const amountEl = document.getElementById('amount-input');
        const nav = window.currentNavPrice || 0;
        const investmentAmount = (next > 0 && nav > 0) ? (next * nav) : 0;
        const actualAmount = Math.round(investmentAmount / 100) * 100; // Changed to 100-lot rounding
        if (amountEl) {
          amountEl.value = actualAmount ? actualAmount.toLocaleString('vi-VN') : '';
          amountEl.dispatchEvent(new Event('input'));
        }
        input.dispatchEvent(new Event('input'));
      });

      // Di chuyển input vào giữa 2 nút
      wrapper.insertBefore(group, input);
      group.appendChild(btnDec);
      group.appendChild(input);
      group.appendChild(btnInc);
      // style input nhỏ gọn
      input.classList.add('text-end');
      input.style.maxWidth = '180px';
    }
  } catch (_) { }

  // Trong lúc nhập: cho nhập nhưng chỉ số, format realtime
  input.addEventListener('input', () => {
    let raw = input.value.replace(/[^0-9]/g, '');
    if (raw && parseInt(raw, 10) < 0) raw = '';

    // Lưu vị trí con trỏ để UX tốt hơn (đơn giản hoá: để cuối nếu xoá hết)
    // Nếu đang nhập, format lại
    if (raw) {
      input.value = Number(raw).toLocaleString('vi-VN');
    } else {
      input.value = '';
    }
  });

  // Sau khi rời khỏi input: hiển thị popup nếu số lượng không hợp lệ
  input.addEventListener('blur', () => {
    const raw = input.value.replace(/[^0-9]/g, '');
    const value = parseInt(raw, 10) || 0;
    if (value === 0) return; // Bỏ qua nếu chưa nhập

    const MIN_UNITS = 100;
    const MAX_UNITS = 500000;
    const LOT_SIZE = 100;

    // Skip min validation if debug option enabled
    if (!shouldSkipMinCcq() && value < MIN_UNITS) {
      Swal.fire({
        title: "Số lượng CCQ quá thấp!",
        text: `Số lượng CCQ tối thiểu là ${MIN_UNITS.toLocaleString('vi-VN')} CCQ/lệnh.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Skip max validation if debug option enabled
    if (!shouldSkipMaxCcq() && value > MAX_UNITS) {
      Swal.fire({
        title: "Số lượng CCQ quá cao!",
        text: `Số lượng CCQ tối đa là ${MAX_UNITS.toLocaleString('vi-VN')} CCQ/lệnh.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
      return;
    }

    // Skip lot size validation if debug option enabled
    if (!shouldSkipLotSize() && value % LOT_SIZE !== 0) {
      Swal.fire({
        title: "Số lượng CCQ không hợp lệ!",
        text: `Số lượng CCQ phải theo lô ${LOT_SIZE} CCQ.`,
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#36A2EB"
      });
    }
  });
}

//Lấy giá trị lãi suất từ cấu hình nav.term.rate
function initInterestRateSelect() {
  const select = document.getElementById('term-select');
  const rateField = document.getElementById('interest-rate');
  if (!select || !rateField) return;

  // Bảng lãi suất fallback theo kỳ hạn (tháng)
  let rateMap = null; // sẽ nạp 1 lần khi focus hoặc khi gọi updateRate lần đầu
  function getRateForMonths(months) {
    if (rateMap && rateMap[String(months)] != null) return parseFloat(rateMap[String(months)]);
    return 0;
  }

  // Hàm cập nhật lãi suất
  async function updateRate() {
    const selectedOption = select.options[select.selectedIndex];
    const months = parseInt(selectedOption.value, 10) || 0;
    let rate = parseFloat(selectedOption.dataset.rate);
    if (Number.isNaN(rate)) {
      try {
        if (!rateMap) {
          const r = await fetch('/nav_management/api/term_rates', { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          if (r.ok) {
            const j = await r.json();
            if (j && j.success) rateMap = j.rate_map || {};
          }
        }
      } catch (e) { }
      rate = getRateForMonths(months);
      if (!Number.isNaN(rate) && rate) {
        selectedOption.dataset.rate = Number(rate).toFixed(2);
      }
    }
    rateField.textContent = rate ? rate.toFixed(2) + " %" : "...";
    // cập nhật tóm tắt
    const sumTerm = document.getElementById('summary-term');
    const sumInterest = document.getElementById('summary-interest');
    if (sumTerm) sumTerm.textContent = months ? months + ' tháng' : '...';
    if (sumInterest) sumInterest.textContent = rate ? rate.toFixed(2) + ' %' : '...';
  }
  // Gọi ngay lần đầu load
  updateRate();
  // Lắng nghe sự kiện thay đổi select
  select.addEventListener('change', updateRate);
}

// Tính giá trị ước tính user nhận được
function initInvestmentCalculator() {
  const select = document.getElementById('term-select');
  const rateField = document.getElementById('interest-rate');
  const investmentAmountInput = document.getElementById('investment-amount-input');
  const shareQuantityInput = document.getElementById('share-quantity-input');
  const actualAmountInput = document.getElementById('amount-input');
  const finalValueField = document.getElementById('final-value');
  const resaleDateField = document.getElementById('resale-date');
  const maturityDateField = document.getElementById('maturity-date');

  if (!select || !rateField || !investmentAmountInput || !finalValueField) return;

  const summaryMaturityDate = document.getElementById('summary-maturity-date');
  const summaryResaleDate = document.getElementById('summary-resale-date');
  const summaryFinalValue = document.getElementById('summary-final-value');

  async function calculate() {
    const selectedOption = select.options[select.selectedIndex];
    const months = parseInt(selectedOption.value, 10) || 0;
    let rate = parseFloat(selectedOption.dataset.rate);

    // Sử dụng dữ liệu từ nav_management nếu có
    if (Number.isNaN(rate) && window.termRateMap) {
      rate = parseFloat(window.termRateMap[String(months)]) || 0;
      console.log(`📊 Sử dụng lãi suất từ nav_management: ${months} tháng = ${rate}%`);
    }

    // Fallback cuối cùng nếu vẫn không có dữ liệu
    if (Number.isNaN(rate) || rate === 0) {
      const fallbackMap = {
        1: 4.80, 2: 5.80, 3: 6.20, 4: 6.50, 5: 7.00, 6: 7.70,
        7: 8.00, 8: 8.50, 9: 8.60, 10: 8.70, 11: 8.90, 12: 9.1,
      };
      rate = fallbackMap[months] || 0;
    }

    // Lấy số tiền từ investment amount input hoặc tính từ share quantity
    let amount = parseFloat(investmentAmountInput.value.replace(/[^0-9]/g, "")) || 0;
    if (amount === 0) {
      // Lấy shareQuantityInput từ DOM thay vì sử dụng biến đã khai báo
      const shareQuantityInput = document.getElementById('share-quantity-input');
      const rawShares = shareQuantityInput.value.replace(/[^0-9]/g, '');
      const shares = parseFloat(rawShares) || 0;
      const nav = window.currentNavPrice || 0;
      amount = shares * nav;
    }

    // Sử dụng giá trị lệnh thực tế từ form thay vì current nav
    const actualAmountInput = document.getElementById('amount-input');
    if (actualAmountInput && actualAmountInput.value) {
      const actualAmount = parseFloat(actualAmountInput.value.replace(/[^0-9]/g, "")) || 0;
      if (actualAmount > 0) {
        amount = actualAmount; // Sử dụng giá trị lệnh đã tính toán
      }
    }

    if (amount <= 0 || months === 0 || rate === 0) {
      finalValueField.textContent = "...";
      if (resaleDateField) resaleDateField.textContent = "...";
      if (maturityDateField) maturityDateField.textContent = "...";
      if (summaryMaturityDate) summaryMaturityDate.textContent = "--/--/----";
      if (summaryResaleDate) summaryResaleDate.textContent = "--/--/----";
      if (summaryFinalValue) summaryFinalValue.textContent = "--";
      return;
    }

    try {
      // Lấy cấu hình chặn trên/dưới từ nav_management
      const capResponse = await fetch('/nav_management/api/cap_config');
      const capData = await capResponse.json();

      // Lấy NAV hiện tại của quỹ
      const currentNav = window.currentNavPrice || 0;

      let finalValue = amount * (1 + rate / 100);
      let isProfitable = true;
      let delta = 0;

      if (capData.success && capData.cap_upper && capData.cap_lower && currentNav > 0) {
        // Công thức NAV mới: Tính toán đầy đủ theo công thức từ nav_management
        // Tính ngày đáo hạn từ ngày hiện tại + kỳ hạn (giống Python backend)
        const today = new Date();
        const maturityDate = calculateMaturityDate(today, months);

        // Tính số ngày thực tế giữa ngày mua và ngày đáo hạn (giống Python backend)
        const days = calculateDaysBetween(today, maturityDate);

        // Cập nhật ngày đáo hạn và ngày bán lại (trừ 2 ngày làm việc)
        if (maturityDateField) maturityDateField.textContent = formatDateDDMMYYYY(maturityDate);
        if (resaleDateField) resaleDateField.textContent = formatDateDDMMYYYY(subtractBusinessDays(maturityDate, 2));

        if (summaryMaturityDate) summaryMaturityDate.textContent = formatDateDDMMYYYY(maturityDate);
        if (summaryResaleDate) summaryResaleDate.textContent = formatDateDDMMYYYY(subtractBusinessDays(maturityDate, 2));

        // Lấy số lượng CCQ thực tế từ form
        const shareQuantityInput = document.getElementById('share-quantity-input');
        const rawShares = shareQuantityInput.value.replace(/[^0-9]/g, '');
        let shares = parseFloat(rawShares) || 0;

        // Lấy giá CCQ tại thời điểm mua (J) từ currentNavPrice
        const pricePerUnit = currentNav; // J: Giá CCQ tại thời điểm mua

        // Lấy phí mua (K) từ fee-input hoặc summary-fee (số tiền tuyệt đối)
        const feeInput = document.getElementById('fee-input');
        const summaryFee = document.getElementById('summary-fee');
        let feeAmount = 0;
        if (feeInput && feeInput.value) {
          feeAmount = parseFloat(feeInput.value.replace(/[^0-9]/g, '')) || 0;
        } else if (summaryFee && summaryFee.textContent) {
          feeAmount = parseFloat(summaryFee.textContent.replace(/[^0-9]/g, '')) || 0;
        }

        // Tính lại amount nếu chưa có (từ shares và pricePerUnit)
        if (amount === 0 && shares > 0 && pricePerUnit > 0) {
          amount = shares * pricePerUnit;
          amount = Math.round(amount / 50) * 50; // MROUND 50
        }

        // L: Giá trị mua = I * J + K (I = shares, J = pricePerUnit, K = feeAmount)
        const purchaseValue = (shares * pricePerUnit) + feeAmount;

        // U: Giá trị bán 1 = L * N / 365 * G + L
        //    = purchaseValue * (rate / 100) / 365 * days + purchaseValue
        const sellValue1 = purchaseValue * (rate / 100) / 365 * days + purchaseValue;

        // S: Giá bán 1 = ROUND(U / I, 0)
        const sellPrice1 = shares > 0 ? Math.round(sellValue1 / shares) : 0;

        // T: Giá bán 2 = MROUND25(S, 50) - sử dụng mround25 mới
        const sellPrice2 = sellPrice1 > 0 ? mround25(sellPrice1, 50) : 0;

        // V: Giá trị bán 2 = I * T
        const sellValue2 = shares * sellPrice2;



        // Tính lãi suất quy đổi (O) = (T / J - 1) * 365 / G * 100
        // J = Giá CCQ tại thời điểm mua = pricePerUnit
        const r_new = (pricePerUnit > 0 && days > 0 && sellPrice2 > 0) ? ((sellPrice2 / pricePerUnit - 1) * 365 / days * 100) : 0;

        // Q: Chênh lệch lãi suất = O - N
        delta = r_new - rate;

        // X: Phí bán (mặc định 0 nếu chưa có cấu hình)
        const sellFee = 0; // Có thể lấy từ cấu hình sau

        // Y: Thuế (mặc định 0 nếu chưa có cấu hình)
        const tax = 0; // Có thể lấy từ cấu hình sau

        // Z: Khách hàng thực nhận = U - X - Y
        const customerReceive = sellValue1 - sellFee - tax;

        console.log(`🔍 Debug tính toán NAV mới:`);
        console.log(`   - I (Số lượng CCQ): ${shares}`);
        console.log(`   - J (Giá CCQ tại thời điểm mua): ${pricePerUnit.toLocaleString('vi-VN')} đ`);
        console.log(`   - K (Phí mua - số tiền): ${feeAmount.toLocaleString('vi-VN')} đ`);
        console.log(`   - L (Giá trị mua = I * J + K): ${purchaseValue.toLocaleString('vi-VN')} đ`);
        console.log(`   - N (Lãi suất): ${rate}%`);
        console.log(`   - G (Số ngày): ${days}`);
        console.log(`   - U (Giá trị bán 1 = L * N / 365 * G + L): ${sellValue1.toLocaleString('vi-VN')} đ`);
        console.log(`   - S (Giá bán 1 = ROUND(U / I, 0)): ${sellPrice1.toLocaleString('vi-VN')} đ/CCQ`);
        console.log(`   - T (Giá bán 2 = MROUND(S, 50)): ${sellPrice2.toLocaleString('vi-VN')} đ/CCQ`);
        console.log(`   - V (Giá trị bán 2 = I * T): ${sellValue2.toLocaleString('vi-VN')} đ`);
        console.log(`   - O (Lãi suất quy đổi = (T / J - 1) * 365 / G * 100): ${r_new.toFixed(4)}%`);
        console.log(`   - Q (Chênh lệch lãi suất = O - N): ${delta.toFixed(4)}%`);
        console.log(`   - X (Phí bán): ${sellFee.toLocaleString('vi-VN')} đ`);
        console.log(`   - Y (Thuế): ${tax.toLocaleString('vi-VN')} đ`);
        console.log(`   - Z (Khách hàng thực nhận = U - X - Y): ${customerReceive.toLocaleString('vi-VN')} đ`);

        // Kiểm tra lãi/lỗ
        const capUpper = parseFloat(capData.cap_upper);
        const capLower = parseFloat(capData.cap_lower);

        // Kiểm tra lãi/lỗ dựa trên chênh lệch lãi suất
        isProfitable = delta >= capLower && delta <= capUpper;

        console.log(`🔍 Kiểm tra lãi/lỗ:`);
        console.log(`   - capUpper: ${capUpper}`);
        console.log(`   - capLower: ${capLower}`);
        console.log(`   - delta: ${delta}`);
        console.log(`   - isProfitable: ${isProfitable}`);

        // Sử dụng giá trị khách hàng thực nhận (Z) làm giá trị đáo hạn
        finalValue = customerReceive;

        console.log(`🧮 Tính toán giá trị đáo hạn với công thức NAV mới:`);
        console.log(`   - Số tiền đầu tư (amount-input): ${amount.toLocaleString('vi-VN')} đ`);
        console.log(`   - Số lượng CCQ: ${shares}`);
        console.log(`   - Giá CCQ tại thời điểm mua: ${pricePerUnit.toLocaleString('vi-VN')} đ`);
        console.log(`   - Phí mua: ${feeAmount.toLocaleString('vi-VN')} đ`);
        console.log(`   - Giá trị mua (L): ${purchaseValue.toLocaleString('vi-VN')} đ`);
        console.log(`   - Lãi suất gốc: ${rate}% cho ${months} tháng`);
        console.log(`   - Giá trị bán 1 (U): ${sellValue1.toLocaleString('vi-VN')} đ`);
        console.log(`   - Giá bán 1 (S): ${sellPrice1.toLocaleString('vi-VN')} đ/CCQ`);
        console.log(`   - Giá bán 2 (T): ${sellPrice2.toLocaleString('vi-VN')} đ/CCQ`);
        console.log(`   - Giá trị bán 2 (V): ${sellValue2.toLocaleString('vi-VN')} đ`);
        console.log(`   - Lãi suất quy đổi (O): ${r_new.toFixed(4)}%`);
        console.log(`   - Chênh lệch lãi suất (Q): ${delta.toFixed(4)}%`);
        console.log(`   - Phí bán (X): ${sellFee.toLocaleString('vi-VN')} đ`);
        console.log(`   - Thuế (Y): ${tax.toLocaleString('vi-VN')} đ`);
        console.log(`   - Khách hàng thực nhận (Z): ${finalValue.toLocaleString('vi-VN')} đ`);
        console.log(`   - Chặn trên: ${capUpper}%, Chặn dưới: ${capLower}%`);
        console.log(`   - Có lãi: ${isProfitable}`);
      } else {
        // Sử dụng công thức NAV mới ngay cả khi không kiểm tra lãi/lỗ
        const today = new Date();
        const maturityDate = calculateMaturityDate(today, months);

        // Tính số ngày thực tế giữa ngày mua và ngày đáo hạn (giống Python backend)
        const days = calculateDaysBetween(today, maturityDate);

        // Cập nhật ngày đáo hạn và ngày bán lại (trừ 2 ngày làm việc)
        if (maturityDateField) maturityDateField.textContent = formatDateDDMMYYYY(maturityDate);
        if (resaleDateField) resaleDateField.textContent = formatDateDDMMYYYY(subtractBusinessDays(maturityDate, 2));

        // Lấy số lượng CCQ thực tế từ form
        const shareQuantityInput = document.getElementById('share-quantity-input');
        let shares = parseFloat(shareQuantityInput.value.replace(/[^0-9]/g, '')) || 0;
        if (shares === 0 && currentNav > 0) {
          shares = amount / currentNav;
        }

        // Lấy giá CCQ tại thời điểm mua (J) từ currentNavPrice
        const pricePerUnit = currentNav; // J: Giá CCQ tại thời điểm mua

        // Lấy phí mua (K) từ fee-input hoặc summary-fee (số tiền tuyệt đối)
        const feeInput = document.getElementById('fee-input');
        const summaryFee = document.getElementById('summary-fee');
        let feeAmount = 0;
        if (feeInput && feeInput.value) {
          feeAmount = parseFloat(feeInput.value.replace(/[^0-9]/g, '')) || 0;
        } else if (summaryFee && summaryFee.textContent) {
          feeAmount = parseFloat(summaryFee.textContent.replace(/[^0-9]/g, '')) || 0;
        }

        // L: Giá trị mua = I * J + K (I = shares, J = pricePerUnit, K = feeAmount)
        const purchaseValue = (shares * pricePerUnit) + feeAmount;

        // U: Giá trị bán 1 = L * N / 365 * G + L
        const sellValue1 = purchaseValue * (rate / 100) / 365 * days + purchaseValue;

        // X: Phí bán (mặc định 0)
        const sellFee = 0;

        // Y: Thuế (mặc định 0)
        const tax = 0;

        // Z: Khách hàng thực nhận = U - X - Y
        finalValue = sellValue1 - sellFee - tax;

        // Không thể kiểm tra lãi/lỗ khi không có dữ liệu cap
        isProfitable = null;
        delta = 0;

        console.log(`🧮 Tính toán giá trị đáo hạn (công thức NAV mới):`);
        console.log(`   - Số tiền đầu tư: ${amount.toLocaleString('vi-VN')} đ`);
        console.log(`   - Số lượng CCQ: ${shares}`);
        console.log(`   - Giá CCQ tại thời điểm mua: ${pricePerUnit.toLocaleString('vi-VN')} đ`);
        console.log(`   - Phí mua: ${feeAmount.toLocaleString('vi-VN')} đ`);
        console.log(`   - L (Giá trị mua = I * J + K): ${purchaseValue.toLocaleString('vi-VN')} đ`);
        console.log(`   - Lãi suất: ${rate}% cho ${months} tháng (${days} ngày)`);
        console.log(`   - U (Giá trị bán 1): ${sellValue1.toLocaleString('vi-VN')} đ`);
        console.log(`   - X (Phí bán): ${sellFee.toLocaleString('vi-VN')} đ`);
        console.log(`   - Y (Thuế): ${tax.toLocaleString('vi-VN')} đ`);
        console.log(`   - Z (Khách hàng thực nhận): ${finalValue.toLocaleString('vi-VN')} đ`);
        console.log(`   - Không thể kiểm tra lãi/lỗ: ${isProfitable}`);
      }

      // MROUND25 - sử dụng quy tắc làm tròn mới (<25 xuống, >=25 lên)
      finalValue = mround25(finalValue, 50);

      // Định dạng VNĐ với màu sắc và chỉ báo trực quan
      updateFinalValueDisplay(finalValue, isProfitable, delta);

      // Update Summary Final Value with the correct Z value
      if (summaryFinalValue) summaryFinalValue.textContent = finalValue.toLocaleString('vi-VN') + ' đ';

      // Cập nhật giá mua khi đáo hạn
      const investmentAmountInput = document.getElementById('investment-amount-input');
      const investmentAmount = parseFloat(investmentAmountInput.value.replace(/[^0-9]/g, "")) || 0;
      const shareQuantityInputForMaturity = document.getElementById('share-quantity-input');
      const shares = parseFloat(shareQuantityInputForMaturity.value.replace(/[^0-9]/g, '')) || 0;

      if (shares > 0) {
        calculateMaturityPrice(shares, window.currentNavPrice || 0);
      }

    } catch (error) {
      console.error('Lỗi kiểm tra lãi/lỗ:', error);
      // Fallback về tính toán cơ bản theo công thức NAV mới
      const today = new Date();
      const maturityDate = calculateMaturityDate(today, months);

      // Tính số ngày thực tế giữa ngày mua và ngày đáo hạn (giống Python backend)
      const days = calculateDaysBetween(today, maturityDate);

      // Lấy số lượng CCQ thực tế từ form
      const shareQuantityInput = document.getElementById('share-quantity-input');
      let shares = parseFloat(shareQuantityInput.value.replace(/[^0-9]/g, '')) || 0;
      if (shares === 0 && window.currentNavPrice > 0) {
        shares = amount / window.currentNavPrice;
      }

      // Lấy giá CCQ tại thời điểm mua (J)
      const pricePerUnit = window.currentNavPrice || 0;

      // Lấy phí mua (K) từ fee-input hoặc summary-fee
      const feeInput = document.getElementById('fee-input');
      const summaryFee = document.getElementById('summary-fee');
      let feeAmount = 0;
      if (feeInput && feeInput.value) {
        feeAmount = parseFloat(feeInput.value.replace(/[^0-9]/g, '')) || 0;
      } else if (summaryFee && summaryFee.textContent) {
        feeAmount = parseFloat(summaryFee.textContent.replace(/[^0-9]/g, '')) || 0;
      }

      // L: Giá trị mua = I * J + K
      const purchaseValue = (shares * pricePerUnit) + feeAmount;

      // U: Giá trị bán 1 = L * N / 365 * G + L
      let finalValue = purchaseValue * (rate / 100) / 365 * days + purchaseValue;

      // X: Phí bán (mặc định 0)
      const sellFee = 0;

      // Y: Thuế (mặc định 0)
      const tax = 0;

      // Z: Khách hàng thực nhận = U - X - Y
      finalValue = finalValue - sellFee - tax;

      // MROUND25 - sử dụng quy tắc làm tròn mới
      finalValue = mround25(finalValue, 50);

      // Hiển thị với trạng thái không xác định
      updateFinalValueDisplay(finalValue, null, 0);

      // Update Summary Final Value with the correct Z value (fallback)
      if (summaryFinalValue) summaryFinalValue.textContent = finalValue.toLocaleString('vi-VN') + ' đ';

      // Reset ngày đáo hạn/bán lại
      if (resaleDateField) resaleDateField.textContent = "...";
      if (maturityDateField) maturityDateField.textContent = "...";

      // Reset về trạng thái mặc định
      const finalValueField = document.getElementById('final-value');
      const profitStatus = document.getElementById('profit-status');
      const paymentBtn = document.getElementById('payment-btn');

      finalValueField.style.color = '#6c757d';
      finalValueField.style.backgroundColor = '#f8f9fa';
      finalValueField.style.borderColor = '#dee2e6';

      profitStatus.textContent = '⚠️ Không thể kiểm tra lãi/lỗ';
      profitStatus.style.color = '#6c757d';

      if (paymentBtn) {
        paymentBtn.disabled = false;
        paymentBtn.style.opacity = '1';
        paymentBtn.style.cursor = 'pointer';
        paymentBtn.title = 'Không thể kiểm tra lãi/lỗ - Cho phép thanh toán';
      }
    }
  }

  // Event listeners
  select.addEventListener('change', calculate);
  investmentAmountInput.addEventListener('input', calculate);
  shareQuantityInput.addEventListener('input', calculate);
  if (actualAmountInput) {
    const commitAmount = () => {
      const raw = actualAmountInput.value.replace(/[^0-9]/g, '');
      const num = parseInt(raw || '0', 10) || 0;
      const committed = mround25(num, 50); // sử dụng mround25 mới
      actualAmountInput.value = committed ? committed.toLocaleString('vi-VN') : '';
      calculate();
    };
    actualAmountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitAmount();
        actualAmountInput.blur();
      }
    });
    actualAmountInput.addEventListener('blur', commitAmount);
  }

  // Khởi tạo lần đầu
  calculate();
}

// Trừ đi N ngày làm việc (bỏ qua T7/CN) - giống Python WORKDAY
function subtractBusinessDays(date, n) {
  const d = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }
  return d;
}

// Tính ngày đáo hạn từ ngày mua và kỳ hạn (tháng) - giống Python backend
// Sử dụng relativedelta logic: cộng tháng và điều chỉnh nếu rơi vào cuối tuần
function calculateMaturityDate(purchaseDate, termMonths) {
  if (!purchaseDate || !termMonths) return null;

  const maturityDate = new Date(purchaseDate);
  // Cộng tháng: xử lý trường hợp tháng có số ngày khác nhau (giống relativedelta)
  const currentMonth = maturityDate.getMonth();
  const currentYear = maturityDate.getFullYear();
  const currentDay = maturityDate.getDate();

  // Tính tháng và năm mới
  let newMonth = currentMonth + termMonths;
  let newYear = currentYear;

  // Xử lý tràn năm
  while (newMonth >= 12) {
    newMonth -= 12;
    newYear += 1;
  }
  while (newMonth < 0) {
    newMonth += 12;
    newYear -= 1;
  }

  // Tạo ngày đáo hạn, xử lý trường hợp ngày không hợp lệ (ví dụ: 31/02 -> 28/02 hoặc 29/02)
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const adjustedDay = Math.min(currentDay, daysInNewMonth);

  maturityDate.setFullYear(newYear, newMonth, adjustedDay);

  // Kiểm tra nếu rơi vào cuối tuần (Saturday=6, Sunday=0) - giống Python backend
  // Python weekday return_type=2: Monday=1, Sunday=7, Saturday=6
  // JavaScript getDay(): Sunday=0, Monday=1, ..., Saturday=6
  const weekday = maturityDate.getDay();
  if (weekday === 0 || weekday === 6) {
    // Chuyển sang thứ 2 tuần sau
    // Sunday (0) -> Monday (+1), Saturday (6) -> Monday (+2)
    const daysToAdd = weekday === 0 ? 1 : 2;
    maturityDate.setDate(maturityDate.getDate() + daysToAdd);
  }

  return maturityDate;
}

// Tính số ngày giữa 2 ngày (chỉ tính phần ngày, không tính giờ) - giống Python backend
// Python: (maturity_dt - purchase_dt).days
function calculateDaysBetween(date1, date2) {
  if (!date1 || !date2) return 0;

  // Chuyển về cùng múi giờ và chỉ lấy phần ngày (bỏ qua giờ/phút/giây)
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

  // Tính số milliseconds và chuyển sang ngày
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

function pad2(x) { return String(x).padStart(2, '0'); }
function formatDateDDMMYYYY(d) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Gọi API ẩn kỳ hạn (sử dụng nav_management)
function initTermSelect() {
  const selectEl = document.getElementById("term-select");
  if (!selectEl) return;

  let calculated = false; // chỉ fetch 1 lần

  selectEl.addEventListener("focus", () => {
    if (calculated) return; // tránh fetch nhiều lần
    calculated = true;

    fetch("/api/fund/calc", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    })
      .then(res => {
        if (!res.ok) throw new Error("API fund calc lỗi: " + res.status);
        return res.json();
      })
      .then(data => {
        data.forEach(item => {
          const option = selectEl.querySelector(`option[value="${item.month}"]`);
          if (option) {
            if (item.hide) {
              option.style.display = "none"; // Ẩn option
            } else {
              option.style.display = "block"; // Hiện option

              // Cập nhật lại data-rate và text hiển thị
              const rateStr = item.interest_rate2.toFixed(2); // giữ 2 số thập phân
              option.dataset.rate = rateStr;

              // Ví dụ: "3 tháng - 6.25%"
              option.textContent = `${item.month} tháng - ${rateStr}%`;
            }
          }
        });
      })
      .catch(err => {
        // Không cần làm gì thêm vì đã có fallback từ loadTermRates()
      });
  });
}

// Xử lý khi thay đổi kỳ hạn
function handleTermChange(termValue) {
  const termSelect = document.getElementById('term-select');
  const interestRateField = document.getElementById('interest-rate');
  const summaryTerm = document.getElementById('summary-term');
  const summaryInterest = document.getElementById('summary-interest');

  if (!termSelect || !termValue) return;

  const selectedOption = termSelect.options[termSelect.selectedIndex];
  const interestRate = parseFloat(selectedOption.dataset.rate) || 0;

  // Cập nhật hiển thị lãi suất
  if (interestRateField) {
    interestRateField.textContent = interestRate.toFixed(2) + '%';
  }

  // Cập nhật summary
  if (summaryTerm) {
    summaryTerm.textContent = `${termValue} tháng`;
  }
  if (summaryInterest) {
    summaryInterest.textContent = interestRate.toFixed(2) + '%';
  }

  // Trigger tính toán lại
  const shareInput = document.getElementById('share-quantity-input');
  if (shareInput) {
    shareInput.dispatchEvent(new Event('input'));
  }

  // Trigger tính toán giá trị đáo hạn
  const investmentAmountInput = document.getElementById('investment-amount-input');
  if (investmentAmountInput) {
    investmentAmountInput.dispatchEvent(new Event('input'));
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const matchBtn = document.getElementById("match-btn");

  matchBtn.addEventListener("click", async function () {
    try {
      const response = await fetch("/match_transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const data = await response.json();
      console.log("Kết quả khớp lệnh:", data);

      if (data.success) {
        let html = "<h3>Các cặp đã khớp:</h3><ul style='text-align:left'>";
        data.matched_pairs.forEach(pair => {
          html += `<li>
            ✅ BUY #${pair.buy_id} (NAV=${pair.buy_nav})
            <br/>⇄
            SELL #${pair.sell_id} (NAV=${pair.sell_nav})
        </li><hr/>`;
        });
        html += "</ul>";

        if (data.remaining.buys.length || data.remaining.sells.length) {
          html += "<h3>Các lệnh chưa khớp:</h3><ul style='text-align:left'>";
          data.remaining.buys.forEach(b => {
            html += `<li>❌ BUY #${b.id} (NAV=${b.nav}, amount=${b.amount})</li>`;
          });
          data.remaining.sells.forEach(s => {
            html += `<li>❌ SELL #${s.id} (NAV=${s.nav}, amount=${s.amount})</li>`;
          });
          html += "</ul>";
        }
        Swal.fire({
          icon: "success",
          title: "Kết quả khớp lệnh",
          html: html,
          width: 600,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Lỗi",
          text: data.message,
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      Swal.fire({
        icon: "error",
        title: "Lỗi kết nối",
        text: "Có lỗi khi gọi API khớp lệnh!",
      });
    }
  });
});
