/**
 * Fund Sell Page - Supports both Normal Sell and Contract Sell
 * 
 * Normal Sell: Đặt lệnh bán trực tiếp lên sàn (LO, MTL, ATO, ATC)
 * Contract Sell: Bán theo hợp đồng/investment hiện có
 */

document.addEventListener('DOMContentLoaded', async () => {
  initOrderModeTabs();
  initRealtimeClock();

  // Initialize based on current mode
  const savedMode = sessionStorage.getItem('sell_order_mode') || 'normal';
  await setOrderMode(savedMode);

  // Init Confirm Page if applicable
  initSellConfirmPage();
});

// =============================================================================
// GLOBAL STATE
// =============================================================================
let currentSellMode = 'normal';
let normalSellFundData = [];
let contractSellData = [];
let currentNavPrice = 0;

// =============================================================================
// ORDER MODE TABS
// =============================================================================
function initOrderModeTabs() {
  const tabNormal = document.getElementById('tab-normal-sell');
  const tabContract = document.getElementById('tab-contract-sell');

  if (!tabNormal || !tabContract) {
    console.debug('[SellMode] Tabs not found, skipping...');
    return;
  }

  if (tabNormal) tabNormal.addEventListener('click', () => setOrderMode('normal'));
  if (tabContract) tabContract.addEventListener('click', () => setOrderMode('contract'));

  console.log('[SellMode] Tabs initialized');
}

async function setOrderMode(mode) {
  currentSellMode = mode;
  sessionStorage.setItem('sell_order_mode', mode);

  const tabNormal = document.getElementById('tab-normal-sell');
  const tabContract = document.getElementById('tab-contract-sell');
  const normalForm = document.getElementById('normal-sell-form-container');
  const contractForm = document.getElementById('contract-sell-form-container');
  const summaryOrderType = document.getElementById('summary-order-type');

  // Update tab active states
  if (tabNormal) tabNormal.classList.toggle('active', mode === 'normal');
  if (tabContract) tabContract.classList.toggle('active', mode === 'contract');

  // Toggle form visibility
  if (mode === 'normal') {
    if (normalForm) normalForm.classList.remove('d-none');
    if (contractForm) contractForm.classList.add('d-none');
    if (summaryOrderType) summaryOrderType.textContent = 'Bán thường';
    await initNormalSellForm();
  } else {
    if (normalForm) normalForm.classList.add('d-none');
    if (contractForm) contractForm.classList.remove('d-none');
    if (summaryOrderType) summaryOrderType.textContent = 'Bán theo hợp đồng';
    await initContractSellForm();
  }

  console.log('[SellMode] Changed to:', mode);
}

// =============================================================================
// NORMAL SELL FORM
// =============================================================================
async function initNormalSellForm() {
  const fundSelect = document.getElementById('normal-sell-select');
  const fundSearch = document.getElementById('fund-search');
  const quantityInput = document.getElementById('normal-sell-quantity');
  const valueDisplay = document.getElementById('normal-sell-value');
  const unitsDisplay = document.getElementById('normal-sell-units');
  const navDisplay = document.getElementById('normal-sell-nav');
  const confirmBtn = document.getElementById('confirm-sell-btn');

  if (!fundSelect || !quantityInput) {
    console.debug('[NormalSell] Required elements not found');
    return;
  }

  try {
    // Load funds with holdings (only funds user owns for sell)
    const response = await fetch('/api/fund/normal-order/market-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { for_sell: true } })
    });

    const result = await response.json();
    if (result.result && result.result.success) {
      normalSellFundData = result.result.funds || [];
      currentNavPrice = result.result.nav_price || 10000;

      // Populate fund select
      populateFundSelect(fundSelect, normalSellFundData);

      // Setup fund search
      if (fundSearch) {
        setupFundSearch(fundSearch, fundSelect, normalSellFundData);
      }
    } else {
      console.warn('[NormalSell] Failed to load market info:', result);
      // Fallback: load from /data_funds
      await loadFallbackFundData(fundSelect);
    }

    // Setup event handlers
    fundSelect.addEventListener('change', async () => {
      const selected = normalSellFundData.find(f => f.id == fundSelect.value);
      updateFundInfo(selected);
      calculateNormalSellValue();

      // Refresh order type availability for new fund's market
      await refreshOrderTypeAvailability();
    });

    quantityInput.addEventListener('input', () => {
      formatQuantityInput(quantityInput);
      calculateNormalSellValue();
    });

    // Order type selection
    initOrderTypeButtons();

    // Price input
    const priceInput = document.getElementById('normal-sell-price');
    if (priceInput) {
      priceInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        const amount = parseInt(rawValue) || 0;
        e.target.value = amount > 0 ? amount.toLocaleString('vi-VN') : '';
        calculateNormalSellValue();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', handleNormalSellSubmit);
    }

    // Update summary date
    updateSummaryDate();

  } catch (err) {
    console.error('[NormalSell] Init error:', err);
  }
}

function populateFundSelect(selectEl, funds) {
  selectEl.textContent = '';
  selectEl.insertAdjacentHTML('beforeend', '<option value="" disabled selected>-- Chọn quỹ để bán --</option>');

  funds.forEach(fund => {
    const option = document.createElement('option');
    option.value = fund.id;
    option.dataset.id = fund.id;
    option.dataset.nav = fund.nav || fund.current_nav || 0;
    option.dataset.holdings = fund.holdings || fund.units || 0;
    option.textContent = `${fund.name || fund.fund_name} (${fund.ticker || fund.code})`;
    selectEl.appendChild(option);
  });
}

function setupFundSearch(searchInput, selectEl, funds) {
  // Create dropdown for search results
  let dropdown = document.getElementById('fund-search-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'fund-search-dropdown';
    dropdown.className = 'position-absolute w-100 bg-white border rounded-3 shadow-sm mt-1 d-none';
    dropdown.style.zIndex = '1000';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(dropdown);
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
      dropdown.classList.add('d-none');
      return;
    }

    const matches = funds.filter(f =>
      (f.name || f.fund_name || '').toLowerCase().includes(query) ||
      (f.ticker || f.code || '').toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      dropdown.textContent = '';
      dropdown.insertAdjacentHTML('beforeend', '<div class="p-2 text-muted">Không tìm thấy quỹ</div>');
    } else {
      dropdown.textContent = '';
      dropdown.insertAdjacentHTML('beforeend', matches.map(f => `
        <div class="p-2 border-bottom hover-bg-light" style="cursor: pointer;" data-id="${f.id}">
          <strong>${f.name || f.fund_name}</strong>
          <span class="text-muted">(${f.ticker || f.code})</span>
          <span class="float-end text-success">${(f.holdings || f.units || 0).toLocaleString('vi-VN')} CCQ</span>
        </div>
      `).join(''));

      dropdown.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          selectEl.value = item.dataset.id;
          selectEl.dispatchEvent(new Event('change'));
          searchInput.value = '';
          dropdown.classList.add('d-none');
        });
      });
    }

    dropdown.classList.remove('d-none');
  });

  // Hide dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('d-none');
    }
  });
}

function updateFundInfo(fund) {
  const unitsDisplay = document.getElementById('normal-sell-holdings');
  const availableDisplay = document.getElementById('normal-sell-available');
  const navDisplay = document.getElementById('normal-sell-nav');
  const summaryNav = document.getElementById('summary-nav');
  if (fund) {
    // Show Normal Holdings if available (Normal Sell Tab context), otherwise Total
    const holdings = (fund.normal_units !== undefined) ? fund.normal_units : (fund.holdings || fund.units || 0);
    const nav = fund.nav || fund.current_nav || currentNavPrice;

    // Calculate Available (Prioritize Normal Available)
    let available = 0;
    if (fund.normal_available_units !== undefined) {
      available = fund.normal_available_units;
    } else if (fund.available_units !== undefined) {
      available = fund.available_units;
    } else {
      available = (fund.holdings || fund.units || 0); // Fallback to whatever holdings we have
    }

    if (unitsDisplay) unitsDisplay.textContent = holdings.toLocaleString('vi-VN');
    if (availableDisplay) availableDisplay.textContent = available.toLocaleString('vi-VN');
    if (navDisplay) navDisplay.textContent = nav.toLocaleString('vi-VN');
    if (summaryNav) summaryNav.textContent = nav.toLocaleString('vi-VN') + 'đ';

    currentNavPrice = nav;
  } else {
    if (unitsDisplay) unitsDisplay.textContent = '--';
    if (availableDisplay) availableDisplay.textContent = '--';
    if (navDisplay) navDisplay.textContent = '--';
    if (summaryNav) summaryNav.textContent = '--';
  }
}

function formatQuantityInput(input) {
  let raw = input.value.replace(/[^0-9]/g, '');
  let qty = parseInt(raw) || 0;

  // Update value with thousand separators
  if (raw) {
    input.value = parseInt(raw).toLocaleString('vi-VN');
  } else {
    input.value = '';
  }
  input.dataset.rawValue = qty;
}

function calculateNormalSellValue() {
  const fundSelect = document.getElementById('normal-sell-select');
  const quantityInput = document.getElementById('normal-sell-quantity');
  const valueDisplay = document.getElementById('normal-sell-value');
  const summaryUnits = document.getElementById('summary-units');
  const summaryTotal = document.getElementById('summary-total');
  const confirmBtn = document.getElementById('confirm-sell-btn');

  const selected = normalSellFundData.find(f => f.id == fundSelect?.value);
  const quantity = parseInt((quantityInput?.value || '').replace(/[^0-9]/g, '')) || 0;
  const nav = selected?.nav || selected?.current_nav || currentNavPrice || 0;

  // Calculate Max Units (Prioritize Normal Available)
  let maxUnits = 0;
  if (selected?.normal_available_units !== undefined) {
    maxUnits = selected.normal_available_units;
  } else if (selected?.available_units !== undefined) {
    maxUnits = selected.available_units;
  } else {
    maxUnits = (selected?.holdings || selected?.units || 0);
  }

  const totalValue = quantity * nav;

  if (valueDisplay) valueDisplay.value = totalValue.toLocaleString('vi-VN');
  if (summaryUnits) summaryUnits.textContent = quantity.toLocaleString('vi-VN') + ' CCQ';
  if (summaryTotal) summaryTotal.textContent = totalValue.toLocaleString('vi-VN') + 'đ';

  // Show available balance hint
  const maxUnitsEl = document.getElementById('available-balance-hint');
  if (!maxUnitsEl && quantityInput) {
    const hint = document.createElement('div');
    hint.id = 'available-balance-hint';
    hint.className = 'form-text text-end';
    quantityInput.parentNode.appendChild(hint);
  }
  const hintEl = document.getElementById('available-balance-hint');
  if (hintEl) {
    hintEl.textContent = '';
    hintEl.insertAdjacentHTML('beforeend', `Khả dụng: <strong>${maxUnits.toLocaleString('vi-VN')}</strong> CCQ`);
    if (quantity > maxUnits) {
      hintEl.classList.add('text-danger');
      hintEl.classList.remove('text-muted');
    } else {
      hintEl.classList.remove('text-danger');
      hintEl.classList.add('text-muted');
    }
  }

  // Enable/disable confirm button
  const isValid = selected && quantity > 0 && quantity <= maxUnits;
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    confirmBtn.style.opacity = isValid ? '1' : '0.6';
    confirmBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  }
}

// =============================================================================
// ORDER TYPE SELECTION
// =============================================================================
let selectedOrderType = 'LO';
let orderTypeAvailability = {}; // Store order type availability

async function initOrderTypeButtons() {
  const buttons = document.querySelectorAll('.order-type-options-grid .order-type-option');
  const priceGroup = document.getElementById('normal-sell-price-group');
  const priceInput = document.getElementById('normal-sell-price');
  const refPriceEl = document.getElementById('normal-sell-ref-price');

  if (buttons.length === 0) {
    console.log('[OrderType] No order type buttons found');
    return;
  }

  // Fetch order type availability from backend
  await fetchOrderTypeAvailability();

  // Apply availability to buttons
  applyOrderTypeAvailability(buttons);

  // Set initial state
  updatePriceVisibility('LO');
  if (refPriceEl) refPriceEl.textContent = currentNavPrice.toLocaleString('vi-VN');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;

      // Remove active from all, add to clicked
      buttons.forEach(b => {
        b.classList.remove('active', 'btn-outline-primary');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.add('active', 'btn-outline-primary');
      btn.classList.remove('btn-outline-secondary');

      const orderType = btn.dataset.value;
      selectedOrderType = orderType;

      updatePriceVisibility(orderType);

      console.log('[OrderType] Selected:', orderType);
    });
  });
}

async function fetchOrderTypeAvailability() {
  try {
    // Get fund to determine market
    const fundSelect = document.getElementById('normal-sell-select');
    const fundId = fundSelect?.value || null;

    const response = await fetch('/api/fund/normal-order/order-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { fund_id: fundId ? parseInt(fundId) : null }
      })
    });

    const result = await response.json();
    if (result.result && result.result.success) {
      const orderTypes = result.result.order_types || [];
      orderTypes.forEach(ot => {
        orderTypeAvailability[ot.code] = {
          valid: ot.valid,
          reason: ot.reason || ''
        };
      });
      console.log('[OrderType] Availability loaded:', orderTypeAvailability);
    }
  } catch (err) {
    console.warn('[OrderType] Failed to fetch availability:', err);
  }
}

function applyOrderTypeAvailability(buttons) {
  buttons.forEach(btn => {
    const code = btn.dataset.value;
    const availability = orderTypeAvailability[code];

    // ATC validation handled by backend now

    if (availability && !availability.valid) {
      // Lock this button
      btn.disabled = true;
      btn.classList.add('locked');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';

      // Add reason text if not exists
      let reasonEl = btn.querySelector('.ot-reason');
      if (!reasonEl && availability.reason) {
        reasonEl = document.createElement('span');
        reasonEl.className = 'ot-reason';
        reasonEl.textContent = '';
        reasonEl.insertAdjacentHTML('beforeend', `<i class="fas fa-lock"></i> ${availability.reason}`);
        btn.appendChild(reasonEl);
      }
    } else {
      // Unlock this button
      btn.disabled = false;
      btn.classList.remove('locked');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      const reasonEl = btn.querySelector('.ot-reason');
      if (reasonEl) reasonEl.remove();
    }
  });

  // If current selected is now disabled, select first available
  const activeBtn = document.querySelector('.order-type-options-grid .order-type-option.active');
  if (activeBtn && activeBtn.disabled) {
    const firstAvailable = document.querySelector('.order-type-options-grid .order-type-option:not(:disabled)');
    if (firstAvailable) {
      firstAvailable.click();
    }
  }
}

async function refreshOrderTypeAvailability() {
  await fetchOrderTypeAvailability();
  const buttons = document.querySelectorAll('.order-type-options-grid .order-type-option');
  applyOrderTypeAvailability(buttons);
}

function updatePriceVisibility(orderType) {
  const priceGroup = document.getElementById('normal-sell-price-group');
  const priceInput = document.getElementById('normal-sell-price');

  const isLimitOrder = orderType === 'LO' || orderType === 'PLO';

  if (priceGroup) {
    if (isLimitOrder) {
      priceGroup.classList.remove('d-none');
      if (priceInput) priceInput.required = true;
    } else {
      priceGroup.classList.add('d-none');
      if (priceInput) {
        priceInput.required = false;
        priceInput.value = '';
      }
    }
  }
}

async function handleNormalSellSubmit() {
  const fundSelect = document.getElementById('normal-sell-select');
  const quantityInput = document.getElementById('normal-sell-quantity');
  const priceInput = document.getElementById('normal-sell-price');
  const confirmBtn = document.getElementById('confirm-sell-btn');

  const selected = normalSellFundData.find(f => f.id == fundSelect?.value);
  const quantity = parseInt((quantityInput?.value || '').replace(/[^0-9]/g, '')) || 0;

  // Get selected order type
  const activeOrderTypeBtn = document.querySelector('.order-type-options-grid .order-type-option.active');
  const orderType = activeOrderTypeBtn?.dataset?.value || 'LO';

  // Get price (for LO orders)
  let price = parseInt((priceInput?.value || '').replace(/[^0-9]/g, '')) || 0;
  const isLimitOrder = orderType === 'LO' || orderType === 'PLO';

  // Use NAV price for market orders
  if (!isLimitOrder || price <= 0) {
    price = currentNavPrice;
  }

  if (!selected || quantity <= 0) {
    Swal.fire({ icon: 'warning', title: 'Thông tin không hợp lệ', text: 'Vui lòng chọn quỹ và nhập số lượng.' });
    return;
  }

  // Validate price for limit orders
  if (isLimitOrder && price <= 0) {
    Swal.fire({ icon: 'warning', title: 'Giá không hợp lệ', text: 'Vui lòng nhập giá bán cho lệnh giới hạn.' });
    return;
  }

  // Calculate Max Units (Prioritize Normal Available)
  let maxUnits = 0;
  if (selected?.normal_available_units !== undefined) {
    maxUnits = selected.normal_available_units;
  } else if (selected?.available_units !== undefined) {
    maxUnits = selected.available_units;
  } else {
    maxUnits = (selected?.holdings || selected?.units || 0);
  }

  if (quantity > maxUnits) {
    Swal.fire({ icon: 'warning', title: 'Số lượng không hợp lệ', text: `Số lượng bán không được vượt quá ${maxUnits.toLocaleString('vi-VN')} CCQ (Khả dụng).` });
    return;
  }

  // Store data for confirm page
  const dataToConfirm = {
    fund_id: selected.id,
    fund_name: selected.name || selected.fund_name,
    fund_ticker: selected.ticker || selected.code,
    transaction_type: 'sell',
    quantity: quantity,
    price: price,
    order_type: orderType,
    estimated_value: quantity * price,
    current_nav: selected.nav || selected.current_nav || currentNavPrice,
    is_contract_sell: false
  };

  sessionStorage.setItem('fund_sell_data', JSON.stringify(dataToConfirm));
  window.location.href = '/fund_sell_confirm';
}

async function loadFallbackFundData(selectEl) {
  try {
    const response = await fetch('/data_funds');
    const funds = await response.json();
    normalSellFundData = funds;
    populateFundSelect(selectEl, funds);
  } catch (err) {
    console.error('[NormalSell] Fallback load failed:', err);
  }
}

// =============================================================================
// CONTRACT SELL FORM
// =============================================================================
async function initContractSellForm() {
  const contractSelect = document.getElementById('contract-sell-select');
  const contractInfoCard = document.getElementById('contract-info-card');
  const confirmCheck = document.getElementById('contract-confirm-check');
  const confirmBtn = document.getElementById('confirm-sell-btn');

  if (!contractSelect) {
    console.log('[ContractSell] Required elements not found');
    return;
  }

  try {
    // Load contracts
    const response = await fetch('/data_contracts');
    const data = await response.json();

    if (Array.isArray(data)) {
      contractSellData = data;
    } else {
      console.error('[ContractSell] Invalid data format or server error:', data);
      if (data.error) console.error('Server Error:', data.error);
      contractSellData = []; // Fallback to empty array
    }

    // Populate contract select
    contractSelect.textContent = '';
    contractSelect.insertAdjacentHTML('beforeend', '<option value="" disabled selected>-- Chọn hợp đồng --</option>');

    if (contractSellData.length === 0) {
      // Optional: Show "No contracts found" or similar
    }

    contractSellData.forEach(contract => {
      const option = document.createElement('option');
      option.value = contract.id;
      const termInfo = contract.term_months ? `${contract.term_months}T` : 'Lệnh thường';
      const rateInfo = contract.interest_rate ? `${contract.interest_rate}%` : '';
      option.textContent = `${contract.fund_name} (${contract.fund_ticker}) - ${termInfo}${rateInfo ? ' - ' + rateInfo : ''}`;
      contractSelect.appendChild(option);
    });

    contractSelect.addEventListener('change', () => {
      const selected = contractSellData.find(c => c.id == contractSelect.value);
      updateContractInfo(selected);
    });

    // Quantity Input Listener
    const qtyInput = document.getElementById('contract-sell-quantity');
    if (qtyInput) {
      qtyInput.addEventListener('input', () => {
        formatQuantityInput(qtyInput);
        calculateContractSellValue();
      });
    }

    if (confirmCheck) {
      confirmCheck.addEventListener('change', () => {
        calculateContractSellValue();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', handleContractSellSubmit);
    }

  } catch (err) {
    console.error('[ContractSell] Init error:', err);
  }
}

function updateContractInfo(contract) {
  const infoCard = document.getElementById('contract-info-card');
  const codeEl = document.getElementById('contract-code');

  const amountEl = document.getElementById('contract-amount');
  const rateEl = document.getElementById('contract-rate');
  const detailsDiv = document.getElementById('contract-sell-details');
  const ownedEl = document.getElementById('contract-owned-units');
  const qtyInput = document.getElementById('contract-sell-quantity');
  const priceEl = document.getElementById('contract-sell-price');

  if (!contract) {
    if (infoCard) infoCard.classList.add('d-none');
    if (detailsDiv) detailsDiv.classList.add('d-none');
    return;
  }

  if (infoCard) infoCard.classList.remove('d-none');

  // Basic Info
  if (codeEl) codeEl.textContent = contract.code || contract.contract_name || `INV-${contract.id}`;

  // New Fields: Buy Date & Maturity Date & Resell Date
  const buyDateEl = document.getElementById('contract-buy-date');
  const maturityDateEl = document.getElementById('contract-maturity-date');
  const sellDateEl = document.getElementById('contract-sell-date');

  if (buyDateEl) buyDateEl.textContent = contract.created_at || '--/--/----';
  if (maturityDateEl) maturityDateEl.textContent = contract.maturity_date || '--/--/----';
  if (sellDateEl) sellDateEl.textContent = contract.nav_sell_date || '--/--/----';

  if (amountEl) amountEl.textContent = (contract.amount || 0).toLocaleString('vi-VN') + 'đ';
  if (rateEl) rateEl.textContent = (contract.interest_rate || 0) + '%';

  // Sell Details
  const units = contract.units || 0;
  const available = contract.available_units !== undefined ? contract.available_units : units;

  // Use maturity price as default, fallback to current nav
  const price = contract.maturity_sell_price || contract.current_nav || 0;

  if (ownedEl) ownedEl.value = units.toLocaleString('vi-VN');

  const availableEl = document.getElementById('contract-sell-available');
  if (availableEl) availableEl.textContent = available.toLocaleString('vi-VN');

  if (priceEl) priceEl.value = price.toLocaleString('vi-VN');

  // Default sell quantity: Empty (User must enter)
  if (qtyInput) {
    qtyInput.value = '';
    qtyInput.dataset.max = available;
  }

  if (detailsDiv) detailsDiv.classList.remove('d-none');

  // Trigger calculation
  calculateContractSellValue();
}

function calculateContractSellValue() {
  const contractSelect = document.getElementById('contract-sell-select');
  const qtyInput = document.getElementById('contract-sell-quantity');
  const priceEl = document.getElementById('contract-sell-price');
  const confirmCheck = document.getElementById('contract-confirm-check');
  const confirmBtn = document.getElementById('confirm-sell-btn');
  const summaryUnits = document.getElementById('summary-units');
  const summaryNav = document.getElementById('summary-nav');
  const summaryTotal = document.getElementById('summary-total');
  const qtyError = document.getElementById('contract-qty-error');

  if (!contractSelect || !qtyInput || !contractSellData) return;

  const selected = contractSellData.find(c => c.id == contractSelect.value);
  if (!selected) return;

  // Use available_units for validation
  const maxUnits = selected.available_units !== undefined ? selected.available_units : (selected.units || 0);
  let sellQty = parseInt((qtyInput.value || '').replace(/[^0-9]/g, '')) || 0;
  const price = parseInt((priceEl.value || '').replace(/[^0-9]/g, '')) || 0;

  // Validation
  let isValid = true;
  if (sellQty > maxUnits) {
    isValid = false;
    if (qtyError) qtyError.classList.remove('d-none');
  } else {
    if (qtyError) qtyError.classList.add('d-none');
  }

  if (confirmCheck && !confirmCheck.checked) isValid = false;

  // Update Summary
  if (summaryUnits) summaryUnits.textContent = sellQty.toLocaleString('vi-VN') + ' CCQ';
  if (summaryNav) summaryNav.textContent = price.toLocaleString('vi-VN') + 'đ';
  const total = sellQty * price;
  if (summaryTotal) summaryTotal.textContent = total.toLocaleString('vi-VN') + 'đ';

  // Update Button
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
    confirmBtn.style.opacity = isValid ? '1' : '0.6';
    confirmBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  }
}

async function handleContractSellSubmit() {
  const contractSelect = document.getElementById('contract-sell-select');
  const qtyInput = document.getElementById('contract-sell-quantity');
  const priceEl = document.getElementById('contract-sell-price');

  const selected = contractSellData.find(c => c.id == contractSelect?.value);
  const sellQty = parseInt((qtyInput?.value || '').replace(/[^0-9]/g, '')) || 0;
  const price = parseInt((priceEl?.value || '').replace(/[^0-9]/g, '')) || 0;

  if (!selected) {
    Swal.fire({ icon: 'warning', title: 'Chưa chọn hợp đồng', text: 'Vui lòng chọn hợp đồng cần tất toán.' });
    return;
  }

  // Validate against Available
  if (sellQty <= 0 || sellQty > maxUnits) {
    Swal.fire({ icon: 'warning', title: 'Số lượng không hợp lệ', text: `Số lượng bán không được vượt quá ${maxUnits.toLocaleString('vi-VN')} CCQ (Khả dụng).` });
    return;
  }

  // Store data for confirm page
  const dataToConfirm = {
    fund_id: selected.fund_id,
    fund_name: selected.fund_name,
    fund_ticker: selected.fund_ticker,
    quantity: sellQty, // Use input quantity
    price: price,      // Use displayed price
    current_nav: selected.current_nav,
    estimated_value: sellQty * price,
    investment_id: selected.investment_id,
    original_amount: selected.amount,
    original_units: selected.units, // Total available
    is_contract_sell: true
  };

  sessionStorage.setItem('fund_sell_data', JSON.stringify(dataToConfirm));
  window.location.href = '/fund_sell_confirm';
}

// =============================================================================
// OTP & ORDER CREATION LOGIC
// =============================================================================
async function triggerSmartOTPForSell(orderParams, onSuccess, onCleanup) {
  try {
    // 1. Check OTP Config
    let otpType = 'smart';
    let bypassOtp = false;

    try {
      const configResponse = await fetch('/api/otp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
      });
      const configResult = await configResponse.json();
      const configData = configResult.result?.result || configResult.result || {};

      if (configData.otp_type) otpType = configData.otp_type;
      if (configData.has_valid_write_token) bypassOtp = true;

    } catch (e) {
      console.warn('[SmartOTP] Config check failed, defaulting to Smart OTP', e);
    }

    // Define actual Create Order function
    const createOrder = async (debugMode = false) => {
      // Inject debug flag if needed
      if (debugMode) orderParams.debug = true;

      const response = await fetch('/api/fund/normal-order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: orderParams
        })
      });

      const resultMsg = await response.json();
      const result = resultMsg.result; // Odoo JSON-RPC often wraps result

      if (result && result.success) {
        // SUCCESS
        if (result.order_id) {
          sessionStorage.setItem('transaction_id', result.order_id);
        }

        await Swal.fire({
          icon: 'success',
          title: 'Thành công',
          text: result.message || 'Lệnh bán đã được gửi.',
          timer: 2000,
          showConfirmButton: false
        });

        // Callback or Direct Redirect
        if (onSuccess) onSuccess(result);
        window.location.href = '/fund_result';

      } else {
        // FAIL
        const errMsg = result?.message || resultMsg.error?.data?.message || 'Lỗi tạo lệnh bán';
        throw new Error(errMsg);
      }
    };

    // 2. Logic Flow
    if (bypassOtp) {
      console.log('[SmartOTP] Valid token exists, bypassing OTP...');
      await createOrder();
    } else {
      // Open OTP Modal
      if (window.FundManagementSmartOTP && typeof window.FundManagementSmartOTP.open === 'function') {
        window.FundManagementSmartOTP.open({
          otpType: otpType,
          onConfirm: async (otp, debugMode) => {
            // Verify OTP first
            try {
              const verifyRes = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'call',
                  params: { otp, debug: debugMode }
                })
              });
              const verifyData = await verifyRes.json();
              const verifyResult = verifyData.result;

              if (!verifyResult || verifyResult.success !== true) {
                throw new Error(verifyResult?.message || 'Mã OTP không đúng');
              }

              // OTP Correct -> Create Order
              await createOrder(debugMode);

            } catch (err) {
              throw err; // Throw back to Modal to show error
            }
          },
          onClose: () => {
            if (onCleanup) onCleanup();
          }
        });
      } else {
        console.warn('[SmartOTP] Component missing, proceeding directly...');
        await createOrder();
      }
    }

  } catch (err) {
    console.error('[SmartOTP] Error:', err);
    Swal.fire({ icon: 'error', title: 'Lỗi', text: err.message });
    if (onCleanup) onCleanup();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function initRealtimeClock() {
  const clockEl = document.getElementById('summary-date');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleDateString('vi-VN');
  }

  update();
  setInterval(update, 60000);
}

function updateSummaryDate() {
  const summaryDate = document.getElementById('summary-date');
  if (summaryDate) {
    summaryDate.textContent = new Date().toLocaleDateString('vi-VN');
  }
}


// =============================================================================
// CONFIRM PAGE LOGIC
// =============================================================================
async function initSellConfirmPage() {
  const valueEl = document.getElementById('sell-confirm-value');
  const finalBtn = document.getElementById('sell-confirm-final-submit');

  if (!valueEl) return; // Not on confirm page logic

  console.log('[SellConfirm] Init confirm page...');

  // Load data
  const dataRaw = sessionStorage.getItem('fund_sell_data');
  if (!dataRaw) {
    console.warn('[SellConfirm] No data found, redirecting...');
    window.location.href = '/fund_sell';
    return;
  }

  const data = JSON.parse(dataRaw);
  console.log('[SellConfirm] Data:', data);

  // Populate UI
  const typeEl = document.getElementById('sell-confirm-type');
  const nameEl = document.getElementById('sell-confirm-name');
  const dateEl = document.getElementById('sell-confirm-date');
  const feeEl = document.getElementById('sell-confirm-fee');

  if (valueEl) valueEl.textContent = (data.estimated_value || 0).toLocaleString('vi-VN') + 'đ';
  if (typeEl) typeEl.textContent = 'Bán';
  if (nameEl) nameEl.textContent = data.is_contract_sell ? (data.fund_ticker + ' (Hợp đồng)') : data.fund_name;
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('vi-VN');

  // Details
  const normalDetails = document.getElementById('confirm-normal-details');
  const contractDetails = document.getElementById('confirm-contract-details');

  if (data.is_contract_sell && contractDetails) {
    if (normalDetails) normalDetails.classList.add('d-none');
    contractDetails.classList.remove('d-none');
    // Populate contract specific fields
    const cCode = document.getElementById('sell-confirm-contract-code');
    const cMat = document.getElementById('sell-confirm-maturity');
    // Add quantity/price display for contract sell as well?
    // The XML for contract details only has code/maturity.
    // We should probably show quantity/price too. 
    // Reuse normal-details elements or add dynamic rows?
    // Let's reuse normal details rows if possible or add them dynamically.
    // Actually, let's keep it simple: Show quantity/nav in Normal Details section (it's present in XML).
    // And UNHIDE it.
    if (normalDetails) normalDetails.classList.remove('d-none');

    if (cCode) cCode.textContent = `INV-${data.investment_id}`; // or contract code
    // Maturity date logic?
  } else {
    if (normalDetails) normalDetails.classList.remove('d-none');
    if (contractDetails) contractDetails.classList.add('d-none');
  }

  // Common details
  const qtyEl = document.getElementById('sell-confirm-quantity');
  const navEl = document.getElementById('sell-confirm-nav');

  if (qtyEl) qtyEl.textContent = (data.quantity || 0).toLocaleString('vi-VN') + ' CCQ';
  if (navEl) navEl.textContent = (data.price || 0).toLocaleString('vi-VN') + 'đ';

  // Handle Submit
  if (finalBtn) {
    finalBtn.addEventListener('click', async () => {
      finalBtn.disabled = true;
      finalBtn.textContent = '';
      finalBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');

      // PREPARE PARAMS
      const params = {
        fund_id: parseInt(data.fund_id),
        transaction_type: 'sell',
        units: data.quantity,
        price: data.price,
        order_type_detail: data.is_contract_sell ? 'LO' : (data.order_type || 'LO'),
        is_contract_sell: !!data.is_contract_sell,
      };

      // TRIGGER OTP
      await triggerSmartOTPForSell(
        params,
        null, // Success handles redirect internally
        () => {
          // Cleanup / Error
          finalBtn.disabled = false;
          finalBtn.textContent = '';
          finalBtn.insertAdjacentHTML('beforeend', 'Xác nhận bán <i class="fas fa-check ms-2"></i>');
        }
      );
    });
  }
}
