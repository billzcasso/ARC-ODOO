/** @odoo-module */

/**
 * Order Matching Actions
 * 
 * This module contains all the action methods related to order matching:
 * - Creating random transactions (for testing)
 * - Matching orders
 * - Market maker handling
 * - Sending maturity notifications
 */

export class OrderMatchingActions {
  /**
   * Tạo giao dịch random cho testing
   * 
   * @param {Function} showNotification - Function to show notifications
   * @param {Function} loadData - Function to reload data after creation
   */
  static async createRandomTransactions(showNotification, loadData) {
    try {
      const response = await fetch('/api/order-matching/create-random', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showNotification(
          `Tạo thành công ${result.created_count || 0} giao dịch random`, 
          'success'
        );
        if (loadData) loadData();
      } else {
        showNotification(
          'Lỗi tạo random transactions: ' + (result.message || 'Không xác định'), 
          'error'
        );
      }
    } catch (error) {
      // Chỉ log lỗi nghiêm trọng
      if (error.message && !error.message.includes('Network')) {
        console.error('[CREATE RANDOM TRANSACTIONS] Error:', error);
      }
      showNotification('Lỗi kết nối: ' + error.message, 'error');
    }
  }

  /**
   * Khớp lệnh sử dụng thuật toán Price-Time Priority (FIFO)
   * 
   * Thuật toán chuẩn Stock Exchange:
   * - Buy orders: Giá cao nhất trước, cùng giá thì thời gian sớm nhất trước
   * - Sell orders: Giá thấp nhất trước, cùng giá thì thời gian sớm nhất trước
   * - Điều kiện khớp: buy_price >= sell_price
   * - Giá khớp: Luôn lấy giá của sell order
   * - Số lượng khớp: min(buy_quantity, sell_quantity)
   * 
   * @param {Function} showNotification - Function to show notifications
   * @param {Function} showMatchingResults - Function to show matching results modal
   * @param {Function} loadData - Function to reload data after matching
   * @param {Object} options - Optional parameters (fund_id, match_type, etc.)
   */
  static async matchOrders(showNotification, showMatchingResults, loadData, options = {}) {
    try {
      const payload = {
        match_type: options.match_type || 'all',
        use_time_priority: options.use_time_priority !== false,  // Default true - Sử dụng Price-Time Priority (FIFO)
        status_mode: options.status_mode || 'pending'
      };
      
      // Thêm fund_id nếu có (để khớp lệnh cho quỹ cụ thể)
      if (options.fund_id) {
        payload.fund_id = options.fund_id;
      }
      
      const response = await fetch('/api/transaction-list/match-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const algorithmUsed = result.algorithm_used || 'Price-Time Priority (FIFO)';
        const totalMatched = result.summary?.total_matched || 0;
        showNotification(
          `Khớp lệnh thành công: ${totalMatched} cặp (${algorithmUsed})`, 
          'success'
        );
        // Hiển thị popup kết quả khớp lệnh ngay
        if (showMatchingResults) {
          await showMatchingResults(result);
        }
        // Sau đó refresh dữ liệu danh sách
        if (loadData) loadData();
      } else {
        showNotification('Lỗi khớp lệnh: ' + (result.message || 'Không xác định'), 'error');
      }
    } catch (error) {
      // Chỉ log lỗi nghiêm trọng
      if (error.message && !error.message.includes('Network')) {
        console.error('[MATCH ORDERS] Error:', error);
      }
      showNotification('Lỗi kết nối: ' + error.message, 'error');
    }
  }

  /**
   * Xử lý lệnh còn lại với Market Maker
   * 
   * Backend tự lấy toàn bộ lệnh pending (mọi quỹ) từ database và tạo lệnh đối ứng
   * cho Market Maker để khớp với các lệnh còn lại của nhà đầu tư.
   * 
   * @param {Object} state - Component state (không còn dùng để gửi ID, chỉ để reload lại dữ liệu)
   * @param {Function} showNotification - Function to show notifications
   * @param {Function} showMatchingResults - Function to show matching results modal
   * @param {Function} loadData - Function to reload data after handling
   * @param {Object} options - Optional parameters (fund_id, etc.)
   */
  static async marketMakerHandleRemainingFromMenu(state, showNotification, showMatchingResults, loadData, options = {}) {
    try {
      const payload = {};
      
      // Thêm fund_id nếu có (để xử lý lệnh cho quỹ cụ thể)
      if (options.fund_id) {
        payload.fund_id = options.fund_id;
      }
      
      const res = await fetch('/api/transaction-list/market-maker/handle-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
      }

      const data = await res.json();
      const ok = !!(data && data.success);

      if (!ok) {
        showNotification('Lỗi: ' + (data && data.message || 'Không xác định'), 'error');
        return;
      }

      const totalBuys = (data.handled && Array.isArray(data.handled.buys)) ? data.handled.buys.length : 0;
      const totalSells = (data.handled && Array.isArray(data.handled.sells)) ? data.handled.sells.length : 0;
      const total = totalBuys + totalSells;

      const msg = total > 0
        ? `Nhà tạo lập đã xử lý ${total} lệnh (Mua: ${totalBuys}, Bán: ${totalSells})`
        : 'Không tìm thấy lệnh pending nào để Nhà tạo lập xử lý';

      showNotification(msg, total > 0 ? 'success' : 'info');

      // Hiển thị popup kết quả chi tiết nếu cần
      if (showMatchingResults && data.matched_pairs) {
        const annotated = (data.matched_pairs || []).map(pair => ({ ...pair, _sourceType: 'market_maker' }));
        showMatchingResults({
          matched_pairs: annotated,
          remaining: data.remaining || { buys: [], sells: [] },
          algorithm_used: 'Market Maker'
        });
      }

      // Làm mới dữ liệu front-end sau khi xử lý xong
      if (loadData) {
        loadData();
      }

      // Recalc tồn kho sau khi Market Maker can thiệp
      try {
        await fetch('/nav_management/api/inventory/recalc_after_match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', params: {} })
        });
      } catch (_) {
        // Ignore background error - không ảnh hưởng đến workflow chính
      }
    } catch (error) {
      // Chỉ log lỗi nghiêm trọng
      if (error.message && !error.message.includes('Network')) {
        console.error('[MARKET MAKER] Error:', error);
      }
      showNotification('Lỗi Market Maker: ' + error.message, 'error');
    }
  }

  /**
   * Gửi thông báo đáo hạn cho các lệnh mua đã hoàn thành
   * 
   * Kiểm tra các lệnh mua đã hoàn thành và gửi thông báo đáo hạn qua WebSocket
   * cho nhà đầu tư khi đến ngày đáo hạn.
   * 
   * @param {Function} showNotification - Function to show notifications
   * @param {Function} rpc - Function to make RPC calls
   */
  static async sendMaturityNotifications(showNotification, rpc) {
    try {
      showNotification('Đang kiểm tra và gửi thông báo đáo hạn...', 'info');
      
      const response = await rpc('/api/transaction-list/send-maturity-notifications', {});
      
      if (response && response.success) {
        const created = response.notifications_created || 0;
        const sent = response.notifications_sent || 0;
        showNotification(
          response.message || `Đã tạo ${created} thông báo và gửi ${sent} thông báo qua websocket thành công.`,
          'success'
        );
      } else {
        showNotification(
          response.message || 'Không thể gửi thông báo đáo hạn',
          'error'
        );
      }
    } catch (error) {
      // Chỉ log lỗi nghiêm trọng
      if (error.message && !error.message.includes('Network')) {
        console.error('[SEND MATURITY NOTIFICATIONS] Error:', error);
      }
      showNotification('Lỗi kết nối: ' + error.message, 'error');
    }
  }


}

