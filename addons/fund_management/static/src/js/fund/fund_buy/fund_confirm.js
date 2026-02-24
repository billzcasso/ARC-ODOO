// ===== Hàm: Lấy ngày giờ định dạng đẹp =====
function getFormattedDateTime() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');

  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

// ===== Session Token Validation =====
function validateOrderToken() {
  const token = sessionStorage.getItem('order_token');
  if (!token) {
    console.warn('[Session] No order_token found - possible stale session');
    return false;
  }
  console.log(`[Session] Validating order_token: ${token}`);
  return true;
}

// Tạo lệnh mua từ trang confirm (fallback khi không có modal ký)
async function createBuyOrderFromConfirm() {
  // ===== CRITICAL: Validate session token first =====
  // CHECK REMOVED to prevent false positive Session Expired errors
  // if (!validateOrderToken()) {
  //   if (typeof Swal !== 'undefined') {
  //     await Swal.fire({
  //       title: "Phiên đã hết hạn",
  //       text: "Vui lòng quay lại trang đặt lệnh và thử lại.",
  //       icon: "warning",
  //       confirmButtonText: "Quay lại",
  //       confirmButtonColor: "#F26522"
  //     });
  //   } else {
  //     alert("Phiên đã hết hạn. Vui lòng quay lại trang đặt lệnh.");
  //   }
  //   window.location.href = '/fund_buy';
  //   return;
  // }

  // Helper để hiển thị thông báo (hỗ trợ cả Swal và native alert)
  const showLoading = () => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: "Đang tạo lệnh...",
        text: "Vui lòng chờ trong giây lát",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        }
      });
    }
  };

  const closeLoading = () => {
    if (typeof Swal !== 'undefined') {
      Swal.close();
    }
  };

  const showSuccess = async (message) => {
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: "Đặt lệnh thành công!",
        text: message,
        icon: "success",
        confirmButtonText: "Xem kết quả",
        confirmButtonColor: "#28a745"
      });
    } else {
      alert(message);
    }
  };

  const showError = async (message) => {
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: "Lỗi tạo lệnh!",
        text: message,
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc3545"
      });
    } else {
      alert('Lỗi: ' + message);
    }
  };

  try {
    showLoading();

    // Get order_token for backend validation
    const orderToken = sessionStorage.getItem('order_token');

    // Lấy dữ liệu từ sessionStorage
    const fundId = sessionStorage.getItem('selectedFundId');
    const units = sessionStorage.getItem('selectedUnits');
    const amount = sessionStorage.getItem('selectedAmount');
    const termMonths = sessionStorage.getItem('selected_term_months');
    const interestRate = sessionStorage.getItem('selected_interest_rate');
    const fundName = sessionStorage.getItem('selectedFundName');
    const totalAmount = sessionStorage.getItem('selectedTotalAmount');

    if (!fundId || !units || !amount) {
      throw new Error('Thiếu thông tin lệnh. Vui lòng quay lại và thử lại.');
    }

    // Check for Normal Order keys (BUT prioritize Negotiated if Term exists)
    const orderType = sessionStorage.getItem('selected_order_type');
    const price = sessionStorage.getItem('selected_price');
    const isMarketOrder = sessionStorage.getItem('is_market_order') === 'true';

    // FIX: If termMonths exists, it is a Negotiated Order. Only treat as Normal if NO Term.
    // FIX: Detect Normal Order based on strict type check
    const normalTypes = ['LO', 'ATO', 'ATC', 'MP', 'MTL', 'MOK', 'MAK', 'PLO'];
    const isNormalOrder = orderType && normalTypes.includes(orderType);

    if (isNormalOrder) {
      // --- NORMAL ORDER FLOW ---
      const rpcParams = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          fund_id: parseInt(fundId),
          transaction_type: 'buy', // Default to buy on this page
          units: parseInt(units),
          price: parseFloat(price) || 0,
          order_type_detail: orderType,
          debug: localStorage.getItem('fund_confirm_debug_bypass_pp') === 'true' // Pass Debug Flag
        }
      };

      const res = await fetch('/api/fund/normal-order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcParams)
      });

      const resultJson = await res.json();

      if (resultJson.result && resultJson.result.success) {
        const result = resultJson.result;

        // Save Result Info
        sessionStorage.setItem('result_fund_name', fundName || '');
        sessionStorage.setItem('result_order_date', getFormattedDateTime());
        sessionStorage.setItem('result_amount', amount);
        sessionStorage.setItem('result_total_amount', totalAmount || amount);
        sessionStorage.setItem('result_units', units);

        // Save Transaction ID
        if (result.order_id) {
          sessionStorage.setItem('transaction_id', String(result.order_id));
          console.log('[fund_confirm] Saved transaction_id:', result.order_id);
        } else {
          console.warn('[fund_confirm] No order_id returned from server!');
        }

        closeLoading();
        await showSuccess("Lệnh mua CCQ đã được tạo thành công.");
        window.location.href = '/fund_result';
      } else {
        // Handle Errors
        const msg = resultJson.result?.message || resultJson.error?.data?.message || 'Không thể tạo lệnh mua';

        // Check for Insufficient Purchasing Power
        if (msg.toLowerCase().includes('sức mua') || msg.toLowerCase().includes('không đủ tiền') || msg.toLowerCase().includes('purchasing power')) {
          closeLoading();
          // Trigger PayOS Payment
          await createPayOSPayment();

          // Scroll to Payment/QR Section
          const paySection = document.getElementById('payos-payment-info');
          if (paySection) {
            paySection.scrollIntoView({ behavior: 'smooth' });
            // Highlight it
            paySection.style.border = '2px solid #F26522';
            setTimeout(() => paySection.style.border = '', 3000);
          }

          // Notify User
          await Swal.fire({
            title: "Thanh toán bổ sung",
            text: "Sức mua hiện tại không đủ. Vui lòng quét mã QR hoặc thanh toán qua PayOS để hoàn tất lệnh.",
            icon: "info",
            confirmButtonText: "Đã hiểu",
            confirmButtonColor: "#F26522"
          });
        } else {
          throw new Error(msg);
        }
      }

    } else {
      // --- NEGOTIATED ORDER FLOW (Legacy) ---
      const formData = new FormData();
      formData.append('fund_id', fundId);
      formData.append('amount', String(amount).replace(/[^0-9]/g, ''));
      formData.append('units', String(units).replace(/[^0-9]/g, ''));
      formData.append('transaction_type', 'buy');
      formData.append('order_mode', 'negotiated'); // Explicitly set Order Mode

      if (termMonths) formData.append('term_months', termMonths);
      if (interestRate) formData.append('interest_rate', interestRate);

      console.log("Creating Negotiated Order:", {
        fundId, amount, units, termMonths, interestRate
      });

      // Gửi debug mode và các options cụ thể để backend bypass validation
      const debugMode = localStorage.getItem('fund_buy_debug_mode') === 'true';
      if (debugMode) {
        formData.append('debug', 'true');

        try {
          const debugOptions = JSON.parse(localStorage.getItem('fund_buy_debug_options') || '{}');
          if (debugOptions.skipMinCcq) formData.append('skip_min_ccq', 'true');
          if (debugOptions.skipMaxCcq) formData.append('skip_max_ccq', 'true');
          if (debugOptions.skipLotSize) formData.append('skip_lot_size', 'true');
        } catch (e) {
          console.warn('Lỗi parsing debug options:', e);
        }
      }

      const res = await fetch('/create_investment', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Lỗi HTTP ${res.status}: ${errorText}`);
      }

      const result = await res.json();

      if (result.success) {
        // Lưu thông tin kết quả
        sessionStorage.setItem('result_fund_name', fundName || '');
        sessionStorage.setItem('result_order_date', getFormattedDateTime());
        sessionStorage.setItem('result_amount', amount);
        sessionStorage.setItem('result_total_amount', totalAmount || amount);
        sessionStorage.setItem('result_units', units);

        // LƯU TRANSACTION_ID để có thể huỷ lệnh
        const txId = result.tx_id || result.transaction_id || result.id || result.order_id;
        if (txId) {
          sessionStorage.setItem('transaction_id', String(txId));
          console.log('Saved transaction_id to session:', txId);
        }

        // LƯU NAV DATA
        if (result.nav_data) {
          sessionStorage.setItem('nav_data', JSON.stringify(result.nav_data));
        }

        closeLoading();
        await showSuccess("Lệnh mua CCQ đã được tạo thành công.");
        window.location.href = '/fund_result';
      } else {
        throw new Error(result.message || 'Không thể tạo lệnh mua');
      }
    }
  } catch (error) {
    console.error('Lỗi tạo lệnh:', error);
    closeLoading();
    await showError(error.message || "Không thể tạo lệnh mua. Vui lòng thử lại.");
  }
}

// ===== Hàm: Hiển thị thông tin xác nhận từ sessionStorage =====
function renderConfirmInfo() {
  // DEBUG: Log all session data available
  console.log('[renderConfirmInfo] Session data:', {
    selectedFundName: sessionStorage.getItem('selectedFundName'),
    selectedAmount: sessionStorage.getItem('selectedAmount'),
    selectedUnits: sessionStorage.getItem('selectedUnits'),
    order_token: sessionStorage.getItem('order_token'),
    selected_order_type: sessionStorage.getItem('selected_order_type'),
    selected_term_months: sessionStorage.getItem('selected_term_months')
  });

  const fundName = sessionStorage.getItem('selectedFundName') || 'Không rõ';
  const amount = sessionStorage.getItem('selectedAmount') || '0';
  const totalAmount = sessionStorage.getItem('selectedTotalAmount') || '0';
  const units = sessionStorage.getItem('selectedUnits') || '0';

  // Negotiated fields
  const termMonths = sessionStorage.getItem('selected_term_months');
  const interestRate = sessionStorage.getItem('selected_interest_rate');

  // Normal fields
  const orderType = sessionStorage.getItem('selected_order_type');
  const price = sessionStorage.getItem('selected_price');

  // Tính phí mua
  const amountNum = Number(amount) || 0;
  const totalAmountNum = Number(totalAmount) || 0;
  const purchaseFee = totalAmountNum - amountNum;

  const confirmFundName = document.getElementById('confirm-fund-name');
  const confirmAmount = document.getElementById('confirm-amount');
  const confirmTotalAmount = document.getElementById('confirm-total-amount');
  const confirmUnits = document.getElementById('confirm-units');
  const confirmFee = document.getElementById('confirm-fee');

  if (confirmFundName) confirmFundName.textContent = fundName;
  if (confirmAmount) confirmAmount.textContent = Number(amount).toLocaleString('vi-VN') + 'đ';
  if (confirmTotalAmount) confirmTotalAmount.textContent = Number(totalAmount).toLocaleString('vi-VN') + 'đ';
  if (confirmUnits) confirmUnits.textContent = Number(units).toLocaleString('vi-VN');
  if (confirmFee) confirmFee.textContent = purchaseFee.toLocaleString('vi-VN') + 'đ';

  // Toggle Views
  const rowTerm = document.getElementById('row-term');
  const rowRate = document.getElementById('row-rate');
  const rowType = document.getElementById('row-order-type');
  const rowPrice = document.getElementById('row-order-price');

  if (orderType) {
    // Normal Order View
    if (rowTerm) rowTerm.style.display = 'none';
    if (rowRate) rowRate.style.display = 'none';
    if (rowType) {
      rowType.style.display = 'flex'; // or block/flex based on css
      const elType = document.getElementById('confirm-order-type');
      if (elType) elType.textContent = orderType;
    }
    if (rowPrice) {
      rowPrice.style.display = 'flex';
      const elPrice = document.getElementById('confirm-order-price');
      // If Market Order (price=0 or special), show "Market" or similar if price is 0?
      // Actually user input logic handles formatted price.
      if (elPrice) elPrice.textContent = Number(price) > 0 ? Number(price).toLocaleString('vi-VN') + 'đ' : (orderType === 'LO' ? '0đ' : orderType);
    }
  } else {
    // Negotiated View
    if (rowType) rowType.style.display = 'none';
    if (rowPrice) rowPrice.style.display = 'none';

    if (rowTerm) {
      rowTerm.style.display = 'flex';
      const elTerm = document.getElementById('confirm-term-months');
      if (elTerm) elTerm.textContent = termMonths ? `${termMonths} tháng` : '...';
    }
    if (rowRate) {
      rowRate.style.display = 'flex';
      const elRate = document.getElementById('confirm-interest-rate');
      if (elRate) elRate.textContent = interestRate ? `${Number(interestRate).toFixed(2)} %` : '...';
    }
  }
}

// ===== Hàm: Gán ngày giờ vào các thẻ cần hiển thị =====
function renderCurrentDateTime() {
  const currentDateTime = getFormattedDateTime();
  const confirmDate = document.getElementById('confirm-order-date');
  const buyDate = document.getElementById('buy-order-date');

  if (confirmDate) confirmDate.textContent = currentDateTime;
  if (buyDate) buyDate.textContent = currentDateTime;
}

// ===== Hàm: Bắt sự kiện nút thanh toán và quay lại =====
function setupConfirmPageEvents() {
  const paymenConftBtn = document.getElementById('payment-confirm-btn');
  const backPaymentBtn = document.getElementById('back-payment-btn');

  if (paymenConftBtn) {
    paymenConftBtn.addEventListener('click', async () => {
      const fundName = document.getElementById('confirm-fund-name')?.textContent || '';
      const orderDate = document.getElementById('confirm-order-date')?.textContent || '';
      const amount = document.getElementById('confirm-amount')?.textContent || '';
      const totalAmount = document.getElementById('confirm-total-amount')?.textContent || '';
      const orderType = document.getElementById('confirm-order-type')?.textContent || '';
      const units = document.getElementById('confirm-units')?.textContent || '';
      const termMonths = document.getElementById('confirm-term-months')?.textContent || '';
      const interestRate = document.getElementById('confirm-interest-rate')?.textContent || '';

      sessionStorage.setItem('result_fund_name', fundName);
      sessionStorage.setItem('result_order_date', orderDate);
      sessionStorage.setItem('result_amount', amount);
      sessionStorage.setItem('result_total_amount', totalAmount);
      sessionStorage.setItem('result_order_type', orderType);
      sessionStorage.setItem('result_units', units);

      // Lưu lại dữ liệu kỳ hạn và lãi suất từ sessionStorage gốc
      const originalTermMonths = sessionStorage.getItem('selected_term_months');
      const originalInterestRate = sessionStorage.getItem('selected_interest_rate');

      // Giữ nguyên dữ liệu gốc từ fund_buy
      if (originalTermMonths) {
        sessionStorage.setItem('selected_term_months', originalTermMonths);
      }
      if (originalInterestRate) {
        sessionStorage.setItem('selected_interest_rate', originalInterestRate);
      }

      // Backup: Lưu thêm vào các key khác để đảm bảo không mất dữ liệu
      sessionStorage.setItem('backup_term_months', originalTermMonths || '0');
      sessionStorage.setItem('backup_interest_rate', originalInterestRate || '0');

      // Check Normal Order Mode
      // FIX: If termMonths exists, it MUST be Negotiated (ignore stale orderType)
      const hasTerm = !!sessionStorage.getItem('selected_term_months');
      const isNormalOrder = !!sessionStorage.getItem('selected_order_type') && !hasTerm;

      if (isNormalOrder) {
        // NORMAL ORDER: DIRECT EXECUTION (Skip Signature, Check PP/Payment)
        await startNormalOrderProcess();
      } else {
        // NEGOTIATED ORDER: SIGNATURE MODAL
        // Hiển thị modal ký hợp đồng trước khi tạo lệnh
        const signatureModalElement = document.getElementById('signatureModal');
        if (signatureModalElement) {
          // Đóng PayOS trước (nếu có)
          try {
            let signatureModal = bootstrap.Modal.getInstance(signatureModalElement);
            if (!signatureModal) {
              signatureModal = new bootstrap.Modal(signatureModalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
              });
            }
            signatureModal.show();
          } catch (error) {
            console.error('Lỗi hiển thị modal ký:', error);
            // Fallback: tạo lệnh trực tiếp
            await createBuyOrderFromConfirm();
          }
        } else {
          // Fallback: tạo lệnh trực tiếp nếu không có modal
          await createBuyOrderFromConfirm();
        }
      }
    });
  }

  if (backPaymentBtn) {
    backPaymentBtn.addEventListener('click', () => {
      window.location.href = '/fund_buy';
    });
  }
}

// ===== Constants =====
const QR_CONFIG = {
  GENERATOR_API: 'https://api.qrserver.com/v1/create-qr-code/',
  DEFAULT_SIZE: '250x250',
  FALLBACK_SIZE: '300x300',
  MAX_WIDTH: '250px',
  BORDER: '2px solid #dee2e6',
  IMAGE_CLASSES: 'img-fluid rounded shadow-sm mx-auto d-block',
  TEXT_CLASSES: 'small text-muted mt-2 mb-0',
  TEXT_CONTENT: 'Quét mã QR để thanh toán qua PayOS',
  ALT_TEXT: 'QR PayOS'
};

const PAYOS_CONFIG = {
  DESCRIPTION_MAX_LENGTH: 25,
  ACCOUNT_NUMBER_DIGITS: 4,
  VIETQR_MIN_LENGTH: 50,
  VIETQR_PREFIX: '000201',
  ROUTES: {
    CONFIRM: '/fund_confirm',
    SUCCESS: '/payment/success'
  }
};

const QR_CODE_TYPES = {
  DATA_URL: 'data:',
  HTTP_URL: 'http',
  BASE64: 'base64',
  VIETQR: 'vietqr'
};

// ===== Helper Functions =====
// Các hàm parse VietQR đã bị loại bỏ vì không sử dụng mock data
// Chỉ sử dụng dữ liệu từ PayOS API response

function detectQRCodeType(qrCode) {
  if (!qrCode) return null;
  // Ưu tiên: Kiểm tra URL hình ảnh (có logo VietQR từ PayOS)
  if (qrCode.startsWith(QR_CODE_TYPES.HTTP_URL) || qrCode.startsWith('https://')) {
    return QR_CODE_TYPES.HTTP_URL;
  }
  if (qrCode.startsWith(QR_CODE_TYPES.DATA_URL)) return QR_CODE_TYPES.DATA_URL;
  // VietQR string (cần tạo QR code)
  if (qrCode.startsWith(PAYOS_CONFIG.VIETQR_PREFIX) ||
    (qrCode.startsWith('00') && qrCode.length > PAYOS_CONFIG.VIETQR_MIN_LENGTH && !qrCode.startsWith(QR_CODE_TYPES.HTTP_URL))) {
    return QR_CODE_TYPES.VIETQR;
  }
  return QR_CODE_TYPES.BASE64;
}

function generateQRCodeImageUrl(data, size = QR_CONFIG.DEFAULT_SIZE) {
  return `${QR_CONFIG.GENERATOR_API}?size=${size}&data=${encodeURIComponent(data)}`;
}

function createQRImageElement(src) {
  const qrImg = document.createElement('img');
  qrImg.src = src;
  qrImg.alt = QR_CONFIG.ALT_TEXT;
  qrImg.className = QR_CONFIG.IMAGE_CLASSES;
  qrImg.style.maxWidth = QR_CONFIG.MAX_WIDTH;
  qrImg.style.border = QR_CONFIG.BORDER;
  qrImg.style.display = 'block';
  return qrImg;
}

function createQRTextElement() {
  const qrText = document.createElement('p');
  qrText.className = QR_CONFIG.TEXT_CLASSES;
  qrText.textContent = QR_CONFIG.TEXT_CONTENT;
  return qrText;
}

// ===== Normal Order Process FLOW =====

async function startNormalOrderProcess() {
  try {
    // Read Status from previous step (normal_order_form.js)
    const ppStatus = sessionStorage.getItem('normal_order_pp_status');

    // Check Debug Bypass
    const isDebugBypass = localStorage.getItem('fund_confirm_debug_bypass_pp') === 'true';

    // If Status is 'insufficient' AND user asks to Bypass -> Proceed to OTP
    if (ppStatus === 'insufficient' && isDebugBypass) {
      console.log("Debug Mode: Bypassing Insufficient PP Check");
      await triggerSmartOTPForNormalOrder();
      return;
    }

    // If Status is 'insufficient' (and NOT bypassing), show Payment UI
    if (ppStatus === 'insufficient') {
      // Scroll to Payment/QR Section
      const paySection = document.getElementById('payos-payment-info');
      if (paySection) {
        paySection.scrollIntoView({ behavior: 'smooth' });
        paySection.style.border = '2px solid #F26522';
        setTimeout(() => paySection.style.border = '', 3000);
      }

      // Trigger QR Generation (if not already)
      await createPayOSPayment();

      // Notify via Toast
      Swal.fire({
        title: "Thanh toán bổ sung",
        text: "Sức mua hiện tại không đủ. Vui lòng thanh toán để hoàn tất lệnh.",
        icon: "info",
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      // --- DEBUG: BYPASS TOGGLE UI ---
      const debugContainer = document.getElementById('payos-payment-info');
      if (debugContainer) {
        // Check if Toggle already exists (to prevent dupes)
        if (!document.getElementById('debug-bypass-pp-toggle')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'form-check form-switch mt-3';

          const input = document.createElement('input');
          input.className = 'form-check-input';
          input.type = 'checkbox';
          input.id = 'debug-bypass-pp-toggle';
          input.style.cursor = 'pointer';

          // Check stored state (Must be false here, otherwise we wouldn't be in this block)
          input.checked = false;

          const label = document.createElement('label');
          label.className = 'form-check-label text-danger';
          label.htmlFor = 'debug-bypass-pp-toggle';
          label.style.cursor = 'pointer';
          label.textContent = '';
          label.insertAdjacentHTML('beforeend', '<i class="fas fa-bug"></i> <b>Debug Mode:</b> Bypass Purchasing Power Check');

          wrapper.appendChild(input);
          wrapper.appendChild(label);
          debugContainer.appendChild(wrapper);

          // Toggle Handler: Just update storage. Do NOT auto-trigger.
          // User must click "Payment Confirm" again to bypass.
          input.addEventListener('change', () => {
            localStorage.setItem('fund_confirm_debug_bypass_pp', input.checked);
            if (input.checked) {
              Swal.fire({
                text: "Debug Mode Enabled. Click 'Xác nhận' again to proceed.",
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false,
                icon: 'success'
              });
            }
          });
        }
      }

      return; // Stop here
    }

    // Otherwise (Status OK), proceed to OTP
    await triggerSmartOTPForNormalOrder();

  } catch (err) {
    console.error("Error in startNormalOrderProcess:", err);
    Swal.fire("Lỗi hệ thống", "Vui lòng thử lại.", "error");
  }
}

async function triggerSmartOTPForNormalOrder() {
  try {
    // 1. Get OTP Config
    let otpType = 'smart';
    try {
      const configResponse = await fetch('/api/otp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
      });
      const configPayload = await configResponse.json().catch(() => ({}));
      const configData = (configPayload.result || configPayload).result || configPayload.result || configPayload;
      if (configData?.otp_type) otpType = configData.otp_type;

      // Bypass OTP if token valid
      if (configData?.has_valid_write_token) {
        await createBuyOrderFromConfirm(); // Create immediately
        return;
      }
    } catch (e) { console.warn("OTP Config Error", e); }

    // 2. Show OTP Modal
    if (window.FundManagementSmartOTP && typeof window.FundManagementSmartOTP.open === 'function') {
      window.FundManagementSmartOTP.open({
        otpType: otpType,
        onConfirm: async (otp, debugMode) => {
          try {
            const response = await fetch('/api/otp/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { otp, debug: debugMode || false } })
            });
            const data = await response.json();
            const result = data.result || data;

            if (!result || result.success !== true) {
              throw new Error(result?.message || 'Mã OTP không hợp lệ');
            }

            // 3. OTP Success -> Create Order
            await createBuyOrderFromConfirm();

          } catch (err) {
            throw err; // Passed to OTP Modal to show error
          }
        }
      });
    } else {
      // Fallback
      console.warn('SmartOTP Component not found. Proceeding without OTP.');
      await createBuyOrderFromConfirm();
    }

  } catch (err) {
    console.error("OTP Error:", err);
    Swal.fire("Lỗi OTP", "Không thể kích hoạt xác thực. " + err.message, "error");
  }
}

function renderQRCode(container, qrCode, onError) {
  if (!container) return;

  container.textContent = '';

  const qrType = detectQRCodeType(qrCode);
  let qrImageSrc;
  let isVietQRString = false;

  switch (qrType) {
    case QR_CODE_TYPES.VIETQR:
      // VietQR string - cần tạo QR code từ string
      isVietQRString = true;
      qrImageSrc = generateQRCodeImageUrl(qrCode, QR_CONFIG.DEFAULT_SIZE);
      break;
    case QR_CODE_TYPES.HTTP_URL:
      // URL hình ảnh từ PayOS (có logo VietQR)
      qrImageSrc = qrCode;
      break;
    case QR_CODE_TYPES.DATA_URL:
      qrImageSrc = qrCode;
      break;
    case QR_CODE_TYPES.BASE64:
    default:
      qrImageSrc = `data:image/png;base64,${qrCode}`;
      break;
  }

  const qrImg = createQRImageElement(qrImageSrc);
  const qrText = createQRTextElement();

  // Hiển thị header và footer (giống PayOS) nếu là VietQR string
  const qrHeader = document.getElementById('payos-qr-header');
  const qrFooter = document.getElementById('payos-qr-footer');

  if (isVietQRString) {
    if (qrHeader) qrHeader.style.display = 'block';
    if (qrFooter) qrFooter.style.display = 'block';
  } else {
    // Nếu là URL từ PayOS, ẩn header/footer vì đã có logo trong QR code
    if (qrHeader) qrHeader.style.display = 'none';
    if (qrFooter) qrFooter.style.display = 'none';
  }

  // Error handler
  qrImg.onerror = function () {
    if (qrType === QR_CODE_TYPES.VIETQR) {
      // Fallback: thử lại với size lớn hơn
      qrImg.src = generateQRCodeImageUrl(qrCode, QR_CONFIG.FALLBACK_SIZE);
    } else if (onError) {
      onError();
    }
  };

  // Success handler
  qrImg.onload = function () {
    container.style.display = 'block';
  };

  container.appendChild(qrImg);
  container.appendChild(qrText);
  container.style.display = 'block';
}

function renderCheckoutInline(container, checkoutUrl) {
  if (!container || !checkoutUrl) {
    return;
  }

  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'payos-inline-checkout';

  const iframe = document.createElement('iframe');
  iframe.src = checkoutUrl;
  iframe.title = 'PayOS Checkout';
  iframe.style.width = '100%';
  iframe.style.minHeight = '480px';
  iframe.style.border = '1px solid #e2e8f0';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 20px 60px rgba(15, 23, 42, 0.15)';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

  const helper = document.createElement('p');
  helper.className = 'small text-muted mt-2';
  helper.style.textAlign = 'center';
  helper.textContent = 'Nếu khung thanh toán không hiển thị, ';

  const helperLink = document.createElement('a');
  helperLink.href = checkoutUrl;
  helperLink.target = '_blank';
  helperLink.rel = 'noopener';
  helperLink.textContent = 'bấm vào đây để mở PayOS trong tab mới';

  helper.appendChild(helperLink);
  helper.appendChild(document.createTextNode('.'));

  wrapper.appendChild(iframe);
  wrapper.appendChild(helper);

  container.appendChild(wrapper);
  container.style.display = 'block';
}

// Hàm tạo PayOS payment và hiển thị QR
async function createPayOSPayment() {
  const payosDiv = document.getElementById('payos-payment-info');
  const errorBox = document.getElementById('payos-error');
  const errorMsg = document.getElementById('payos-error-message');
  const payosBtn = document.getElementById('payos-payment-btn');

  if (!payosDiv) return;

  // Ẩn error message
  if (errorBox) errorBox.style.display = 'none';

  // Hiển thị loading
  if (payosBtn) {
    payosBtn.disabled = true;
    payosBtn.textContent = '';
    payosBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-spinner fa-spin me-2"></i>Đang tạo thanh toán...');
  }

  // Xóa nội dung QR code cũ nếu có (chỉ xóa nội dung, không xóa container)
  const qrContainer = document.getElementById('payos-qr-code');
  if (qrContainer) {
    qrContainer.textContent = '';
    qrContainer.insertAdjacentHTML('beforeend', '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Đang tạo mã QR...</span></div><p class="small text-muted mt-2 mb-0">Đang tạo mã QR thanh toán...</p></div>');
    qrContainer.style.display = 'block'; // Hiển thị loading ngay
  }

  try {
    // Lấy đúng số tiền từ sessionStorage (raw value, chưa format)
    const totalAmountRaw = sessionStorage.getItem('selectedTotalAmount') || '0';
    // PayOS yêu cầu amount là số nguyên (VND không có phần thập phân)
    const amount = Math.round(Number(totalAmountRaw) || 0);

    // Lấy units từ sessionStorage
    const unitsRaw = sessionStorage.getItem('selectedUnits') || '0';
    const units = Math.round(Number(unitsRaw) || 0);

    // Lấy fund name từ sessionStorage
    const fundName = sessionStorage.getItem('selectedFundName') || '';

    if (!amount || amount <= 0) {
      throw new Error('Số tiền thanh toán không hợp lệ');
    }


    // Tạo payload
    const transactionId = Number(sessionStorage.getItem('transaction_id') || 0) || 0;
    const accountNumber = transactionId
      ? String(transactionId).slice(-PAYOS_CONFIG.ACCOUNT_NUMBER_DIGITS)
      : '****';

    const description = `Nap tien TK${accountNumber} tai HDC`.substring(0, PAYOS_CONFIG.DESCRIPTION_MAX_LENGTH);

    const payload = {
      transaction_id: transactionId,
      amount: Math.round(amount),  // Đảm bảo là số nguyên cho PayOS
      units: Math.round(units),
      description: description,
      cancel_url: window.location.origin + PAYOS_CONFIG.ROUTES.CONFIRM,
      return_url: window.location.origin + PAYOS_CONFIG.ROUTES.SUCCESS
    };

    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data || data.success !== true) {
      throw new Error((data && data.error) || 'Không tạo được liên kết PayOS');
    }

    // Lấy QR code từ response - kiểm tra nhiều format
    const qrCode = (
      data.qr_code ||
      data.qrCode ||
      (data.data && (data.data.qr_code || data.data.qrCode || data.data.qrCodeBase64 || data.data.qrCodeUrl))
    );
    const checkoutUrl = data.checkout_url || data.checkoutUrl || (data.data && (data.data.checkout_url || data.data.checkoutUrl));
    const orderCode = data.order_code || data.orderCode || (data.data && (data.data.order_code || data.data.orderCode)) || payload.transaction_id;


    const bankInfo = data.bank_info || (data.data && data.data.bank_info);
    const accountHolder = bankInfo ? (bankInfo.account_holder || bankInfo.accountHolder || '') : '';
    const accountNumberDisplay = bankInfo ? (bankInfo.account_number || bankInfo.accountNumber || '') : '';
    const bankName = bankInfo ? (bankInfo.bank_name || bankInfo.bankName || '') : '';

    if (accountHolder) {
      sessionStorage.setItem('payos_account_holder', accountHolder);
    } else {
      sessionStorage.removeItem('payos_account_holder');
    }
    if (accountNumberDisplay) {
      sessionStorage.setItem('payos_account_number', accountNumberDisplay);
    } else {
      sessionStorage.removeItem('payos_account_number');
    }
    if (bankName) {
      sessionStorage.setItem('payos_bank_name', bankName);
    } else {
      sessionStorage.removeItem('payos_bank_name');
    }

    sessionStorage.setItem('payos_transfer_amount', String(amount));
    if (payload.description) {
      sessionStorage.setItem('payos_transfer_description', payload.description);
    } else {
      sessionStorage.removeItem('payos_transfer_description');
    }
    if (orderCode) {
      sessionStorage.setItem('payos_transfer_reference', String(orderCode));
    } else {
      sessionStorage.removeItem('payos_transfer_reference');
    }

    // Hiển thị PayOS inline (iframe) hoặc QR code
    const inlineContainer = document.getElementById('payos-inline-checkout');
    const qrContainer = document.getElementById('payos-qr-code');

    // Ưu tiên hiển thị iframe nếu có checkoutUrl
    if (checkoutUrl && inlineContainer) {
      // Xóa loading spinner và render iframe
      renderCheckoutInline(inlineContainer, checkoutUrl);
    } else if (qrCode && qrContainer) {
      qrContainer.textContent = '';
      renderQRCode(qrContainer, qrCode, () => {
        qrContainer.textContent = '';
        qrContainer.insertAdjacentHTML('beforeend', '<div class="alert alert-warning"><small>Không thể hiển thị mã QR từ PayOS. Vui lòng sử dụng nút thanh toán để mở trang PayOS.</small></div>');
      });
    } else if (inlineContainer) {
      // Không có QR code hoặc checkoutUrl - hiển thị thông báo
      inlineContainer.textContent = '';
      inlineContainer.insertAdjacentHTML('beforeend', `
        <div class="alert alert-info m-3">
          <p class="mb-2"><strong>PayOS không trả về mã QR hoặc link thanh toán</strong></p>
          <p class="small mb-0">Vui lòng click vào nút bên dưới để mở trang thanh toán PayOS.</p>
        </div>
      `);
    }

    // Lưu checkout_url để có thể redirect sau
    if (checkoutUrl) {
      sessionStorage.setItem('payos_checkout_url', checkoutUrl);
    }

    // Cập nhật nút PayOS
    if (payosBtn) {
      payosBtn.disabled = false;
      if (checkoutUrl) {
        payosBtn.textContent = '';
        payosBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-redo me-2"></i>Mở lại PayOS trong tab mới');
        payosBtn.onclick = () => {
          window.open(checkoutUrl, '_blank');
        };
      } else {
        payosBtn.textContent = '';
        payosBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-qrcode me-2"></i>Đã tạo mã QR');
        payosBtn.onclick = null;
      }
    }

  } catch (err) {
    if (errorMsg) errorMsg.textContent = err?.message || 'Lỗi không xác định';
    if (errorBox) errorBox.style.display = 'block';

    // Reset nút PayOS
    if (payosBtn) {
      payosBtn.disabled = false;
      payosBtn.textContent = 'Thanh toán với PayOS';
    }
  }
}


// ===== GOM TẤT CẢ VÀO 1 DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', async () => {
  renderConfirmInfo();
  renderCurrentDateTime();
  setupConfirmPageEvents();

  // Tự động tạo PayOS payment và hiển thị QR khi load trang
  await createPayOSPayment();

  // Xử lý PayOS: gọi API module PayOS khi người dùng click nút PayOS
  const payosBtn = document.getElementById('payos-payment-btn');
  if (payosBtn) {
    payosBtn.addEventListener('click', async () => {
      // Kiểm tra nếu đã có checkout_url, mở luôn
      const checkoutUrl = sessionStorage.getItem('payos_checkout_url');
      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank');
        return;
      }

      // Nếu chưa có, tạo payment mới
      await createPayOSPayment();
    });
  }
});
