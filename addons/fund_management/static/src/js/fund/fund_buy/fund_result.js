// ===== Utils =====
// Store transaction type globally
let currentTransactionType = 'buy'; // 'buy' or 'sell'

function parseVNDString(value) {
  return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
}

function formatVND(value) {
  if (value === null || value === undefined) {
    return '0đ';
  }
  const numeric = Number(String(value).replace(/[^\d]/g, '')) || 0;
  return `${numeric.toLocaleString('vi-VN')}đ`;
}

/**
 * MROUND25 - Làm tròn theo quy tắc: dưới 25đ làm tròn xuống, từ 25đ làm tròn lên (step 50đ)
 * Đồng bộ với mround.py trong backend
 */
function mround25(value, step = 50) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || step <= 0) return num;

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
 * Tính giá trị sau đáo hạn theo công thức chuẩn:
 * U = L × N / 365 × G + L (Giá trị bán 1 = Giá trị sau đáo hạn)
 * 
 * @param {Object} navData - Dữ liệu NAV từ API
 * @returns {number} Giá trị sau đáo hạn (Giá trị bán 1)
 */
function calculateMaturityValue(navData) {
  if (!navData) return 0;

  const purchaseValue = Number(navData.nav_purchase_value) || 0; // L: Giá trị mua
  const interestRate = Number(navData.interest_rate) || 0; // N: Lãi suất (%)
  const days = Number(navData.nav_days) || 0; // G: Số ngày

  if (purchaseValue <= 0 || days <= 0) {
    return 0;
  }

  // U: Giá trị bán 1 = L × N / 365 × G + L (đây là Giá trị sau đáo hạn)
  const sellValue1 = purchaseValue * (interestRate / 100) / 365 * days + purchaseValue;

  return mround25(sellValue1, 50);
}

function renderTransferInfo() {
  const fallback = {
    beneficiary: '...',
    accountNumber: '...',
    bankName: '...',
    description: '...',
  };

  const beneficiary = sessionStorage.getItem('payos_account_holder') || fallback.beneficiary;
  const accountNumber = sessionStorage.getItem('payos_account_number') || fallback.accountNumber;
  const bankName = sessionStorage.getItem('payos_bank_name') || fallback.bankName;
  const description =
    sessionStorage.getItem('payos_transfer_description') ||
    sessionStorage.getItem('payos_transfer_reference') ||
    fallback.description;
  const amountRaw =
    sessionStorage.getItem('payos_transfer_amount') ||
    sessionStorage.getItem('selectedTotalAmount') ||
    '0';

  const transferMap = {
    'transfer-beneficiary': beneficiary,
    'transfer-account-number': accountNumber,
    'transfer-bank-name': bankName,
    'transfer-description': description,
    'transfer-amount': formatVND(amountRaw),
  };

  Object.entries(transferMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '...';
  });
}

// ===== Gán dữ liệu từ sessionStorage vào DOM =====
// ===== Gán dữ liệu từ sessionStorage vào DOM =====
// ===== Gán dữ liệu từ sessionStorage vào DOM =====
// ===== Gán dữ liệu từ Backend vào DOM =====
async function renderResultPageData() {
  const formatNumber = (val) => Number(String(val).replace(/[^\d]/g, '')) || 0;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val !== undefined && val !== null) ? val : '--';
  };

  try {
    // 1. Get Transaction ID
    const txId = sessionStorage.getItem('transaction_id');
    if (!txId) {
      // console.warn("Result Page: No transaction_id found in sessionStorage.");
      renderNoDataState();
      return;
    }

    // 2. Fetch Data
    const res = await fetch(`/api/transaction/detail?transaction_id=${txId}`);
    if (!res.ok) throw new Error("Lỗi kết nối server");

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || "Không tải được dữ liệu lệnh");
    }

    const data = json.data;

    // Store transaction type globally
    currentTransactionType = data.transaction_type || 'buy';

    // Update page title and button text based on transaction type
    updateUIForTransactionType(currentTransactionType);

    // 3. Render Common Data
    setEl('result-fund-name', data.fund_ticker || data.fund_name);
    setEl('result-amount', formatVND(data.amount));
    setEl('result-fee', formatVND(data.fee));
    setEl('result-order-date', data.created_at);

    // Map Status
    const statusMap = {
      'pending': 'Chờ xử lý',
      'completed': 'Hoàn thành',
      'cancelled': 'Đã huỷ'
    };
    setEl('result-status', statusMap[data.status] || data.status);

    // 4. Render Layout based on Order Mode
    const isNormal = data.order_mode === 'normal';

    // Use body class for CSS-based visibility control
    document.body.classList.remove('normal-order-mode', 'negotiated-order-mode');

    if (isNormal) {
      // --- NORMAL: Type, Price, Units ---
      document.body.classList.add('normal-order-mode');

      setEl('result-order-type', data.order_type_detail);

      let priceDisplay = formatVND(data.price);
      if (['ATO', 'ATC', 'MP', 'MTL'].includes(data.order_type_detail)) {
        priceDisplay = data.order_type_detail;
      }
      setEl('result-order-price', priceDisplay);
      setEl('result-units', data.units ? data.units.toLocaleString('vi-VN') : '--');

    } else {
      // --- NEGOTIATED: Term, Rate, Maturity ---
      document.body.classList.add('negotiated-order-mode');

      setEl('result-term-months', data.term_months ? `${data.term_months} tháng` : '--');
      setEl('result-interest-rate', data.interest_rate ? `${data.interest_rate}%` : '--');
      setEl('result-maturity-date', data.nav_maturity_date || '--');
      setEl('result-sell-date', data.nav_sell_date || '--');
      // Fix: Recalculate maturity value to ensure mround compliance
      const derivedMaturityValue = calculateMaturityValue(data);
    }

  } catch (error) {
    // console.warn("Result Page: Error loading transaction data:", error.message);
    renderNoDataState();
  }
}

/**
 * Hiển thị trạng thái không có dữ liệu cho UI
 */
function renderNoDataState() {
  // Show user-visible feedback
  const statusEl = document.getElementById('result-status');
  if (statusEl) {
    statusEl.textContent = 'Không có dữ liệu';
    statusEl.classList.add('text-warning');
  }

  // Also log what's in sessionStorage for debugging
  /* console.log('[Debug] sessionStorage contents:', {
    transaction_id: sessionStorage.getItem('transaction_id'),
    order_token: sessionStorage.getItem('order_token'),
    selectedFundId: sessionStorage.getItem('selectedFundId')
  }); */
}

// ===== Update UI based on transaction type (buy/sell) =====
function updateUIForTransactionType(transactionType) {
  const isSell = transactionType === 'sell';

  // Update page title
  document.title = isSell ? 'Kết quả lệnh bán' : 'Kết quả lệnh mua';

  // Update success title
  const successTitle = document.querySelector('.fm-success-title');
  if (successTitle) {
    successTitle.textContent = isSell ? 'Đặt lệnh bán thành công!' : 'Đặt lệnh thành công!';
  }

  // Update "Add More" button text
  const addMoreBtn = document.getElementById('add-more-btn');
  if (addMoreBtn) {
    addMoreBtn.textContent = '';
    addMoreBtn.insertAdjacentHTML('beforeend', isSell
      ? '<i class="fas fa-minus me-2"></i>Bán thêm'
      : '<i class="fas fa-plus me-2"></i>Mua thêm');
  }

  // Update amount label
  const amountLabel = document.querySelector('.fm-detail-row.highlight .fm-detail-label');
  if (amountLabel) {
    amountLabel.textContent = isSell ? 'Số tiền nhận về' : 'Số tiền đầu tư';
  }

  // Update amount value color for sell
  const amountValue = document.getElementById('result-amount');
  if (amountValue && isSell) {
    amountValue.classList.remove('text-success');
    amountValue.classList.add('text-danger');
  }

  // console.log('[Result] UI updated for transaction type:', transactionType);
}

// ===== Xử lý nút "Hoàn tất" - KHÔNG tạo lệnh mới, chỉ chuyển đến sổ lệnh =====
function setupFinishButton() {
  const finishBtn = document.getElementById('finish-btn');
  if (!finishBtn) {
    return;
  }

  finishBtn.addEventListener('click', () => {
    // Clear session data
    sessionStorage.removeItem('selectedAmount');
    sessionStorage.removeItem('selectedUnits');
    sessionStorage.removeItem('selectedTotalAmount');
    sessionStorage.removeItem('selected_term_months');
    sessionStorage.removeItem('selected_interest_rate');
    sessionStorage.removeItem('result_fund_name');
    sessionStorage.removeItem('result_order_date');
    sessionStorage.removeItem('result_amount');
    sessionStorage.removeItem('result_total_amount');
    sessionStorage.removeItem('result_units');
    sessionStorage.removeItem('nav_data');

    // Chuyển đến màn hình sổ lệnh để NĐT xem lệnh hoặc tạo lệnh mới
    window.location.href = '/transaction_management/pending';
  });
}

// ===== Xử lý nút "Đặt lệnh khác" - mua hoặc bán thêm =====
function setupAddMoreButton() {
  const addMoreBtn = document.getElementById('add-more-btn');
  if (!addMoreBtn) {
    return;
  }

  addMoreBtn.addEventListener('click', () => {
    // Clear toàn bộ session data để đặt lệnh mới
    sessionStorage.removeItem('selectedFundId');
    sessionStorage.removeItem('selectedFundName');
    sessionStorage.removeItem('selectedAmount');
    sessionStorage.removeItem('selectedUnits');
    sessionStorage.removeItem('selectedTotalAmount');
    sessionStorage.removeItem('selectedInvestmentAmount');
    sessionStorage.removeItem('selected_term_months');
    sessionStorage.removeItem('selected_interest_rate');
    sessionStorage.removeItem('result_fund_name');
    sessionStorage.removeItem('result_order_date');
    sessionStorage.removeItem('result_amount');
    sessionStorage.removeItem('result_total_amount');
    sessionStorage.removeItem('result_units');
    sessionStorage.removeItem('nav_data');
    sessionStorage.removeItem('fund_sell_data');

    // Chuyển về trang đặt lệnh dựa theo loại giao dịch
    const redirectUrl = currentTransactionType === 'sell' ? '/fund_sell' : '/fund_buy';
    window.location.href = redirectUrl;
  });
}

// ===== Xử lý nút "Huỷ lệnh" - huỷ lệnh vừa đặt =====
function setupCancelOrderButton() {
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (!cancelBtn) {
    return;
  }

  cancelBtn.addEventListener('click', async () => {
    // Lấy transaction_id từ session
    const transactionId = sessionStorage.getItem('transaction_id');

    // Xác nhận huỷ lệnh
    const orderTypeName = currentTransactionType === 'sell' ? 'bán' : 'mua';
    const confirmResult = await (typeof Swal !== 'undefined'
      ? Swal.fire({
        title: 'Xác nhận huỷ lệnh?',
        text: `Bạn có chắc chắn muốn huỷ lệnh ${orderTypeName} này không?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Huỷ lệnh',
        cancelButtonText: 'Quay lại',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      })
      : { isConfirmed: confirm(`Bạn có chắc chắn muốn huỷ lệnh ${orderTypeName} này không?`) }
    );

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      // Hiển thị loading
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Đang huỷ lệnh...',
          text: 'Vui lòng chờ trong giây lát',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          willOpen: () => {
            Swal.showLoading();
          }
        });
      }

      // Gọi API huỷ lệnh
      console.log('Cancel order - transaction_id from session:', transactionId);

      if (!transactionId) {
        throw new Error('Không tìm thấy mã lệnh để huỷ. Vui lòng thử lại.');
      }

      const formData = new FormData();
      formData.append('transaction_id', transactionId);

      const res = await fetch('/cancel_transaction', {
        method: 'POST',
        body: formData
      });

      console.log('Cancel order - API response status:', res.status);

      if (!res.ok) {
        throw new Error(`Lỗi HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log('Cancel order - API result:', result);

      if (!result.success) {
        throw new Error(result.message || 'Không thể huỷ lệnh');
      }

      // Clear session data
      sessionStorage.removeItem('selectedFundId');
      sessionStorage.removeItem('selectedFundName');
      sessionStorage.removeItem('selectedAmount');
      sessionStorage.removeItem('selectedUnits');
      sessionStorage.removeItem('selectedTotalAmount');
      sessionStorage.removeItem('selected_term_months');
      sessionStorage.removeItem('selected_interest_rate');
      sessionStorage.removeItem('result_fund_name');
      sessionStorage.removeItem('result_order_date');
      sessionStorage.removeItem('result_amount');
      sessionStorage.removeItem('result_total_amount');
      sessionStorage.removeItem('result_units');
      sessionStorage.removeItem('transaction_id');
      sessionStorage.removeItem('nav_data');

      // Đóng loading và hiển thị thông báo
      const orderTypeName = currentTransactionType === 'sell' ? 'bán' : 'mua';
      if (typeof Swal !== 'undefined') {
        Swal.close();
        await Swal.fire({
          title: 'Đã huỷ lệnh!',
          text: `Lệnh ${orderTypeName} đã được huỷ thành công.`,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745'
        });
      } else {
        alert(`Lệnh ${orderTypeName} đã được huỷ thành công.`);
      }

      // Chuyển về trang đặt lệnh
      const redirectUrl = currentTransactionType === 'sell' ? '/fund_sell' : '/fund_buy';
      window.location.href = redirectUrl;

    } catch (error) {
      console.error('Lỗi huỷ lệnh:', error);
      if (typeof Swal !== 'undefined') {
        Swal.close();
        await Swal.fire({
          title: 'Lỗi huỷ lệnh!',
          text: error.message || 'Không thể huỷ lệnh. Vui lòng thử lại.',
          icon: 'error',
          confirmButtonText: 'Đóng',
          confirmButtonColor: '#dc3545'
        });
      } else {
        alert('Lỗi: ' + (error.message || 'Không thể huỷ lệnh'));
      }
    }
  });
}

// ===== Xử lý nút "Xem hợp đồng" và "Tải hợp đồng" =====
function setupContractButtons() {
  const viewContractBtn = document.getElementById('view-contract-btn');
  const downloadContractBtn = document.getElementById('download-contract-btn');

  // Hàm lấy contract info từ API
  async function getContractInfo() {
    const transactionId = sessionStorage.getItem('transaction_id');
    if (!transactionId) {
      throw new Error('Không tìm thấy mã giao dịch');
    }

    const res = await fetch(`/api/contract/get?transaction_id=${transactionId}`);
    const result = await res.json();

    if (!result.success) {
      throw new Error(result.message || 'Không thể lấy hợp đồng');
    }

    return result.contract;
  }

  // Xem hợp đồng
  if (viewContractBtn) {
    viewContractBtn.addEventListener('click', async () => {
      try {
        viewContractBtn.disabled = true;
        viewContractBtn.textContent = '';
        viewContractBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-spinner fa-spin"></i>Đang tải...');

        const contract = await getContractInfo();

        // Mở PDF trong tab mới
        window.open(contract.view_url, '_blank');

      } catch (error) {
        console.error('Lỗi xem hợp đồng:', error);
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Không thể xem hợp đồng',
            text: error.message,
            icon: 'warning',
            confirmButtonText: 'Đóng'
          });
        } else {
          alert(error.message);
        }
      } finally {
        viewContractBtn.disabled = false;
        viewContractBtn.textContent = '';
        viewContractBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-eye"></i>Xem');
      }
    });
  }

  // Tải hợp đồng
  if (downloadContractBtn) {
    downloadContractBtn.addEventListener('click', async () => {
      try {
        downloadContractBtn.disabled = true;
        downloadContractBtn.textContent = '';
        downloadContractBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-spinner fa-spin"></i>Đang tải...');

        const contract = await getContractInfo();

        // Download PDF
        const link = document.createElement('a');
        link.href = contract.download_url;
        link.download = contract.filename || 'hop-dong.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error('Lỗi tải hợp đồng:', error);
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Không thể tải hợp đồng',
            text: error.message,
            icon: 'warning',
            confirmButtonText: 'Đóng'
          });
        } else {
          alert(error.message);
        }
      } finally {
        downloadContractBtn.disabled = false;
        downloadContractBtn.textContent = '';
        downloadContractBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-download"></i>Tải xuống');
      }
    });
  }
}

// ===== Xử lý nút "Xác nhận" - Redirect đến /transaction_management/pending =====
function setupConfirmRedirectButton() {
  const confirmBtn = document.getElementById('confirm-redirect-btn');
  if (!confirmBtn) {
    return;
  }

  confirmBtn.addEventListener('click', () => {
    // Clear session data
    sessionStorage.removeItem('selectedAmount');
    sessionStorage.removeItem('selectedUnits');
    sessionStorage.removeItem('selectedTotalAmount');
    sessionStorage.removeItem('selected_term_months');
    sessionStorage.removeItem('selected_interest_rate');
    sessionStorage.removeItem('result_fund_name');
    sessionStorage.removeItem('result_order_date');
    sessionStorage.removeItem('result_amount');
    sessionStorage.removeItem('result_total_amount');
    sessionStorage.removeItem('result_units');
    sessionStorage.removeItem('nav_data');
    sessionStorage.removeItem('transaction_id');

    // Redirect
    window.location.href = '/transaction_management/pending';
  });
}

// ======= Gộp lại DOMContentLoaded =======
document.addEventListener('DOMContentLoaded', () => {
  try {
    renderResultPageData();
  } catch (e) {
    console.error('Error rendering result data:', e);
  }

  try {
    renderTransferInfo();
  } catch (e) {
    console.error('Error rendering transfer info:', e);
  }

  console.log('Initializing Result Page Buttons...');
  setupConfirmRedirectButton();
  setupFinishButton();
  setupAddMoreButton();
  setupCancelOrderButton();
  setupContractButtons();
});
