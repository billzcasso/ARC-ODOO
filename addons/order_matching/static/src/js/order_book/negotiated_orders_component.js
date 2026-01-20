/** @odoo-module */

import { Component, useState, onMounted, onWillUnmount, xml } from "@odoo/owl";

export class NegotiatedOrdersComponent extends Component {
    static template = xml`
        <div class="order-book-page">
            <div class="order-book-hero">
                <div class="hero-content">
                    <div class="hero-copy">
                        <div class="hero-pill">Trung tâm khớp lệnh</div>
                        <h1>Khoản đầu tư khớp theo thỏa thuận</h1>
                        <p class="hero-lead">
                            Theo dõi chi tiết các cặp lệnh khớp theo thỏa thuận, lọc theo quỹ và ngày giao dịch, và gửi lệnh lên sàn.
                        </p>
                        <div class="hero-meta">
                            <span class="status-chip">
                                <i class="fa fa-clock-o"></i>
                                Cập nhật:
                                <t t-esc="formatDateTime(state.lastUpdate)"/>
                            </span>
                        </div>
                        <div class="order-book-nav">
                            <a href="/order-book" class="nav-link">Khoản đầu tư chờ xử lý</a>
                            <a href="/completed-orders" class="nav-link">Khoản đầu tư đã khớp</a>
                            <a href="/negotiated-orders" class="nav-link active">Khoản đầu tư khớp theo thỏa thuận</a>
                            <a href="/normal-orders" class="nav-link">Lệnh đặt thường</a>
                        </div>
                        <t t-if="state.isMarketMaker">
                            <div class="mt-3">
                                <a href="/investment_dashboard" class="btn-back-market-maker" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: white; color: #2563EB; border: 2px solid #2563EB; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2); transition: all 0.2s ease;">
                                    <i class="fa fa-arrow-left"></i>Quay lại Dashboard
                                </a>
                            </div>
                        </t>
                    </div>
                </div>
                <div class="hero-actions">
                    <button class="btn btn-refresh" title="Làm mới dữ liệu" t-on-click="refreshData" t-att-disabled="state.loading">
                        <i class="fa fa-refresh" t-att-class="state.loading ? 'fa-spin' : ''"></i>
                        Làm mới
                    </button>
                    <button class="btn btn-secondary btn-sm" t-att-disabled="state.selectedIds.size === 0 || state.loading" t-on-click="sendToExchange">
                        <i class="fa fa-paper-plane"></i>
                        Gửi lên sàn (<t t-esc="state.selectedIds.size"/>)
                    </button>
                </div>
            </div>

            <div class="partial-orders-card">
            <style>
                .negotiated-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #e5e7eb;
                }
                .negotiated-header h2 {
                    margin: 0;
                    color: #1f2937;
                    font-size: 24px;
                    font-weight: 600;
                }
                .negotiated-header .header-actions {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .negotiated-filters {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                }
                .negotiated-filters .row {
                    margin: 0;
                }
                .negotiated-filters .col-md-4 {
                    padding: 0 10px;
                }
                .negotiated-filters label {
                    font-weight: 500;
                    margin-bottom: 5px;
                    color: #374151;
                    display: block;
                }
                .type-filter-nav {
                    margin-bottom: 20px;
                }
                .type-filter-nav .nav-pills .nav-link {
                    color: #6b7280;
                    padding: 8px 16px;
                    border-radius: 6px;
                    margin-right: 8px;
                    transition: all 0.2s;
                }
                .type-filter-nav .nav-pills .nav-link:hover {
                    background: #f3f4f6;
                    color: #1f2937;
                }
                .type-filter-nav .nav-pills .nav-link.active {
                    background: #3b82f6;
                    color: #fff;
                }
                .loading-container {
                    text-align: center;
                    padding: 40px;
                }
                .loading-container .spinner-border {
                    width: 3rem;
                    height: 3rem;
                    border-width: 0.3em;
                }
                .loading-text {
                    margin-top: 15px;
                    color: #6b7280;
                    font-size: 14px;
                }
                .error-container {
                    text-align: center;
                    padding: 40px;
                }
                .error-container .error-icon {
                    font-size: 48px;
                    color: #ef4444;
                    margin-bottom: 15px;
                }
                .error-container .error-message {
                    color: #6b7280;
                    margin-bottom: 20px;
                    font-size: 16px;
                }
                .matched-totals {
                    background: #f9fafb;
                    padding: 12px 16px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                }
                .matched-totals div {
                    font-size: 14px;
                }
                .matched-totals strong {
                    color: #374151;
                    margin-right: 8px;
                }
                .matched-table {
                    width: 100%;
                    font-size: 13px;
                }
                .matched-table thead th {
                    background: #f3f4f6;
                    font-weight: 600;
                    color: #374151;
                    padding: 12px 8px;
                    border-bottom: 2px solid #e5e7eb;
                }
                .matched-table tbody td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #e5e7eb;
                    vertical-align: middle;
                }
                .matched-table tbody tr:hover {
                    background: #f9fafb;
                }
                .matched-table .sent-row {
                    opacity: 0.6;
                    background: #f0f9ff;
                }
                .matched-table .sent-row:hover {
                    background: #e0f2fe;
                }
                .sub-info {
                    font-size: 11px;
                    color: #6b7280;
                    margin-top: 4px;
                }
                .fund-symbol {
                    color: #3b82f6;
                    font-weight: 600;
                }
                .stt-badge {
                    font-size: 12px;
                    padding: 4px 8px;
                }
                .matched-pagination {
                    margin-top: 20px;
                }
                .matched-pagination .btn {
                    min-width: 36px;
                    padding: 6px 12px;
                }
                .no-orders {
                    text-align: center;
                    padding: 40px;
                    color: #6b7280;
                }
                .no-orders i {
                    font-size: 48px;
                    margin-bottom: 15px;
                    display: block;
                    color: #d1d5db;
                }
            </style>

            <div class="negotiated-header">
                <h2>
                    <i class="fa fa-handshake"></i>
                    Khoản đầu tư khớp theo thỏa thuận
                </h2>
            </div>
            
            <div class="negotiated-filters">
                <div class="row g-2 align-items-end">
                    <div class="col-md-6">
                        <label>Quỹ:</label>
                        <div class="fund-combobox-wrapper">
                            <input 
                                id="fund-combobox-negotiated" 
                                type="text" 
                                class="fund-combobox-input"
                                placeholder="Nhập tên quỹ..." 
                                t-on-input="onFilterFundInput"
                                t-on-focus="onFilterFundFocus"
                                t-on-blur="onFilterFundBlur"
                                t-on-keydown="onFilterFundKeydown"
                            />
                            <i class="fa fa-chevron-down fund-combobox-arrow"></i>
                            <div class="fund-combobox-dropdown" t-att-class="{'show': state.showFundDropdown}">
                                <t t-if="getFilteredFunds().length === 0">
                                    <div class="fund-combobox-no-results">Không tìm thấy quỹ</div>
                                </t>
                                <t t-foreach="getFilteredFunds()" t-as="fund" t-key="fund.id">
                                    <div 
                                        class="fund-combobox-option"
                                        t-att-class="{'selected': state.filters.fund_id === fund.id}"
                                        t-on-click="onFilterFundOptionClick"
                                        t-att-data-fund-id="fund.id"
                                    >
                                        <div class="option-name"><t t-esc="fund.name"/></div>
                                        <div class="option-meta"><t t-esc="fund.ticker or fund.code or ''"/></div>
                                    </div>
                                </t>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <label>Ngày giao dịch:</label>
                        <input type="date" class="form-control filter-date" t-on-change="onFilterChanged" t-att-value="state.filters.transaction_date"/>
                    </div>
                </div>
            </div>

            <div class="type-filter-nav" style="margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <nav class="nav nav-pills" style="gap: 8px;">
                    <a class="nav-link" t-att-class="state.typeFilter === 'all' ? 'active' : ''" href="#" t-on-click="() => this.changeTypeFilter('all')" style="padding: 8px 16px; border-radius: 6px; font-weight: 500;">Tất cả</a>
                    <a class="nav-link" t-att-class="state.typeFilter === 'investor' ? 'active' : ''" href="#" t-on-click="() => this.changeTypeFilter('investor')" style="padding: 8px 16px; border-radius: 6px; font-weight: 500;">Nhà đầu tư</a>
                    <a class="nav-link" t-att-class="state.typeFilter === 'market_maker' ? 'active' : ''" href="#" t-on-click="() => this.changeTypeFilter('market_maker')" style="padding: 8px 16px; border-radius: 6px; font-weight: 500;">Nhà tạo lập</a>
                </nav>
            </div>
            
            <div class="tab-content">
                <div t-if="state.loading" class="loading-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <div class="loading-text">Đang tải dữ liệu...</div>
                </div>
                
                <div t-elif="state.error" class="error-container">
                    <div class="error-icon">
                        <i class="fa fa-exclamation-triangle"></i>
                    </div>
                    <div class="error-message">
                        <t t-esc="state.error"/>
                    </div>
                    <button class="btn btn-primary" t-on-click="refreshData">
                        <i class="fa fa-refresh"></i> Thử lại
                    </button>
                </div>
                
                <div t-else="" class="matched-orders-list">
                    <div t-if="getTypeFilteredOrders().length === 0" class="no-orders">
                        <i class="fa fa-info-circle"></i>
                        Không có lệnh khớp thỏa thuận
                    </div>
                    
                    <div t-else="" class="orders-table table-responsive">
                        <div class="matched-totals d-flex justify-content-end gap-4 mb-2">
                            <div>
                                <strong>Tổng CCQ: </strong>
                                <span><t t-esc="formatUnits(getTotals().totalCCQ)"/></span>
                            </div>
                            <div>
                                <strong>Tổng giá trị lệnh: </strong>
                                <span><t t-esc="formatAmount(getTotals().totalValue)"/></span>
                            </div>
                        </div>
                        <table class="table table-sm table-hover table-striped align-middle matched-table">
                            <thead class="table-light sticky-head">
                                <tr>
                                    <th style="width:36px;" class="text-center">
                                        <input type="checkbox" class="form-check-input" t-att-checked="this.isAllSelectableChecked()" t-att-disabled="this.getSelectableVisibleOrders().length === 0" t-on-change="(ev) => this.toggleSelectAll(ev.target.checked)"/>
                                    </th>
                                    <th style="width:48px;" class="text-center">STT</th>
                                    <th class="text-nowrap sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('fund_name')">
                                        Quỹ <i t-att-class="getSortIcon('fund_name')"></i>
                                    </th>
                                    <th class="text-nowrap sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('buy_investor')">
                                        Người mua <i t-att-class="getSortIcon('buy_investor')"></i>
                                    </th>
                                    <th class="text-nowrap sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('sell_investor')">
                                        Người bán <i t-att-class="getSortIcon('sell_investor')"></i>
                                    </th>
                                    <th class="text-end sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('matched_price')">
                                        Giá khớp <i t-att-class="getSortIcon('matched_price')"></i>
                                    </th>
                                    <th class="text-end sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('matched_quantity')">
                                        SL khớp <i t-att-class="getSortIcon('matched_quantity')"></i>
                                    </th>
                                    <th class="text-end sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('total_value')">
                                        Giá trị <i t-att-class="getSortIcon('total_value')"></i>
                                    </th>
                                    <th class="text-center d-none d-lg-table-cell">Lãi suất</th>
                                    <th class="text-center d-none d-lg-table-cell">Kỳ hạn</th>
                                    <th class="text-nowrap sortable-header" style="cursor:pointer;" t-on-click="() => this.sortTable('match_date')">
                                        Thời gian <i t-att-class="getSortIcon('match_date')"></i>
                                    </th>
                                    <th class="text-center">Gửi sàn</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr t-foreach="getDisplayedOrders()" t-as="order" t-key="order.id" t-att-class="this.isOrderSent(order) ? 'sent-row' : ''">
                                    <td class="text-center">
                                        <input type="checkbox" class="form-check-input" t-att-checked="this.isSelected(order)" t-att-disabled="this.isOrderSent(order)" t-on-change="(ev) => this.toggleSelect(order, ev.target.checked)"/>
                                    </td>
                                    <td class="text-center">
                                        <span class="stt-badge badge bg-secondary"><t t-esc="(state.pagination.currentPage - 1) * state.pagination.perPage + order_index + 1"/></span>
                                    </td>
                                    <td>
                                        <div class="fw-semibold fund-symbol"><t t-esc="this.getFundSymbol(order)"/></div>
                                        <div class="text-muted sub-info"><t t-esc="order.fund_name || ''"/></div>
                                    </td>
                                    <td>
                                        <div class="fw-semibold text-success">
                                            <t t-esc="order.buy_investor || '-'"/>
                                            <span class="badge bg-light text-dark ms-1"><t t-esc="(order.buy_user_type || '').toString() === 'market_maker' ? 'NTL' : 'NĐT'"/></span>
                                        </div>
                                        <div class="text-muted sub-info">
                                            SL: <t t-esc="formatUnits(order.buy_units)"/>
                                            <t t-if="order.buy_remaining_units !== undefined"> · Còn: <t t-esc="formatUnits(order.buy_remaining_units)"/></t>
                                            · Giá: <t t-esc="formatPrice(order.buy_price)"/>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="fw-semibold text-danger">
                                            <t t-esc="order.sell_investor || '-'"/>
                                            <span class="badge bg-light text-dark ms-1"><t t-esc="(order.sell_user_type || '').toString() === 'market_maker' ? 'NTL' : 'NĐT'"/></span>
                                        </div>
                                        <div class="text-muted sub-info">
                                            SL: <t t-esc="formatUnits(order.sell_units)"/>
                                            <t t-if="order.sell_remaining_units !== undefined"> · Còn: <t t-esc="formatUnits(order.sell_remaining_units)"/></t>
                                            · Giá: <t t-esc="formatPrice(order.sell_price)"/>
                                        </div>
                                    </td>
                                    <td class="text-end">
                                        <t t-esc="formatPrice(order.matched_price)"/>
                                    </td>
                                    <td class="text-end">
                                        <t t-esc="formatUnits(order.matched_quantity)"/>
                                    </td>
                                    <td class="text-end fw-semibold">
                                        <t t-esc="formatAmount(order.total_value)"/>
                                    </td>
                                    <td class="text-center d-none d-lg-table-cell">
                                        <t t-esc="getInterestRateDisplay(order)"/>
                                    </td>
                                    <td class="text-center d-none d-lg-table-cell">
        <t t-esc="getTermDisplay(order)"/>
                                    </td>
                                    <td class="text-nowrap">
                                        <div class="session-info">
                                            <div class="in-time">
                                                <t t-esc="formatDateTime(order.match_date || order.match_time || order.created_at)"/>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <t t-if="this.isOrderSent(order)">
                                            <span class="badge bg-success">Đã gửi</span>
                                        </t>
                                        <t t-else="">
                                            <span class="badge bg-secondary">Chưa gửi</span>
                                        </t>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="matched-pagination d-flex justify-content-end align-items-center gap-2 mt-2">
                            <button class="btn btn-sm btn-outline-secondary" t-on-click="() => this.changePage(state.pagination.currentPage - 1)" t-att-disabled="state.pagination.currentPage === 1">«</button>
                            <t t-foreach="getPageNumbers()" t-as="p" t-key="'page-' + p">
                                <t t-if="p === 'ellipsis'">
                                    <span class="px-2">...</span>
                                </t>
                                <t t-else="">
                                    <button class="btn btn-sm" t-att-class="p === state.pagination.currentPage ? 'btn-primary' : 'btn-outline-secondary'" t-on-click="() => this.changePage(p)"><t t-esc="p"/></button>
                                </t>
                            </t>
                            <button class="btn btn-sm btn-outline-secondary" t-on-click="() => this.changePage(state.pagination.currentPage + 1)" t-att-disabled="state.pagination.currentPage === this.getTotalPages()">»</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    
    static props = {};
    
    setup() {
        const todayIso = new Date().toISOString().split('T')[0];
        this.state = useState({
            matchedOrders: [],
            funds: [],
            loading: true,
            error: null,
            selectedIds: new Set(),
            pagination: { currentPage: 1, perPage: 20, totalItems: 0 },
            typeFilter: 'all',
            lastUpdate: null,
            filters: {
                fund_id: null,
                quick_date: 'today',
                transaction_date: todayIso,
                date_from: null,
                date_to: null
            },
            // Combobox search quỹ
            fundSearchTerm: "",
            showFundDropdown: false,
            isMarketMaker: false, // Track nếu user là Market Maker
            // Sort state
            sortField: '',
            sortOrder: 'asc' // 'asc' or 'desc'
        });
        
        this.refreshInterval = null;
        this._loadInitialData();
        
        onMounted(() => {
            // Auto refresh mỗi 30 giây để cập nhật danh sách lệnh khớp thỏa thuận
            this.refreshInterval = setInterval(() => {
                if (!this.state.loading) {
                    this._loadMatchedOrders();
                }
            }, 30000);
            this.checkUserPermission();
        });
        
        onWillUnmount(() => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });
    }
    
    /**
     * Tải dữ liệu ban đầu: danh sách quỹ và lệnh khớp thỏa thuận
     */
    async _loadInitialData() {
        this.state.loading = true;
        this.state.error = null;
        try {
            await Promise.all([
                this._loadFunds(),
                this._loadMatchedOrders()
            ]);
        } catch (error) {
            // Chỉ log lỗi nghiêm trọng
            if (error.message && !error.message.includes('Network')) {
                console.error('[LOAD INITIAL DATA] Error:', error);
            }
            this.state.error = "Lỗi tải dữ liệu: " + (error.message || "Không xác định");
        } finally {
            this.state.loading = false;
        }
    }
    
    /**
     * Tải danh sách quỹ từ API
     */
    async _loadFunds() {
        try {
            const res = await fetch('/api/transaction-list/funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({})
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const response = await res.json();
            
            // Xử lý nhiều format response khác nhau
            if (Array.isArray(response)) {
                this.state.funds = response;
            } else if (response && Array.isArray(response.funds)) {
                this.state.funds = response.funds;
            } else if (response && response.result && Array.isArray(response.result.funds)) {
                this.state.funds = response.result.funds;
            } else {
                this.state.funds = [];
            }
        } catch (error) {
            // Chỉ log lỗi nghiêm trọng
            if (error.message && !error.message.includes('Network')) {
                console.error('[LOAD FUNDS] Error:', error);
            }
            this.state.funds = [];
        }
    }
    
    /**
     * Tải danh sách lệnh khớp thỏa thuận từ API
     * 
     * Lệnh khớp thỏa thuận là các execution records (transaction.matched.orders)
     * đã được tạo sau khi khớp lệnh theo thuật toán Price-Time Priority (FIFO)
     * 
     * Theo chuẩn Stock Exchange:
     * - Giá khớp: Luôn lấy giá của sell order
     * - Số lượng khớp: min(buy_quantity, sell_quantity)
     * - Remaining: remaining_units = units - matched_units
     */
    async _loadMatchedOrders() {
        try {
            // Tính toán date_from/date_to từ filter
            let date_from, date_to;
            if (this.state.filters.transaction_date) {
                const { date_from: df, date_to: dt } = this.computeDateRangeForDate(this.state.filters.transaction_date);
                date_from = df; 
                date_to = dt;
            } else {
                const r = this.computeDateRange(this.state.filters.quick_date);
                date_from = r.date_from; 
                date_to = r.date_to;
            }
            this.state.filters.date_from = date_from;
            this.state.filters.date_to = date_to;
            
            // Normalize fund và ticker
            const fundId = this.state.filters.fund_id ? Number(this.state.filters.fund_id) : null;
            let ticker = null;
            if (fundId && Array.isArray(this.state.funds)) {
                const fund = this.state.funds.find(f => String(f.id) === String(fundId));
                ticker = fund && (fund.ticker || fund.symbol || fund.code) 
                    ? String(fund.ticker || fund.symbol || fund.code) 
                    : null;
            }

            const res = await fetch('/api/transaction-list/get-matched-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({
                    fund_id: fundId,
                    ticker,
                    date_from,
                    date_to
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const response = await res.json();
            
            // Xử lý nhiều format response khác nhau
            let data = [];
            if (response && response.success && Array.isArray(response.data)) {
                data = response.data;
            } else if (Array.isArray(response)) {
                data = response;
            } else if (response && response.result && Array.isArray(response.result.data)) {
                data = response.result.data;
            } else if (response && Array.isArray(response.data)) {
                data = response.data;
            } else {
                throw new Error(response && response.message ? response.message : "Không thể tải dữ liệu lệnh khớp");
            }
            
            // Client-side filter by fund nếu backend bỏ qua
            if (fundId) {
                const wantId = Number(fundId);
                const wantTicker = ticker ? String(ticker).toUpperCase() : null;
                data = (data || []).filter(order => {
                    const ids = [order.fund_id, order.buy_fund_id, order.sell_fund_id].map(v => Number(v || 0));
                    const tickers = [order.fund_ticker, order.buy_fund_ticker, order.sell_fund_ticker]
                        .filter(Boolean)
                        .map(t => String(t).toUpperCase());
                    const idMatch = ids.includes(wantId);
                    const tickerMatch = wantTicker ? tickers.includes(wantTicker) : true;
                    return idMatch || tickerMatch;
                });
            }
            
            // Client-side filter by date range
            const fromTime = new Date(date_from.replace(' ', 'T')).getTime();
            const toTime = new Date(date_to.replace(' ', 'T')).getTime();
            data = (data || []).filter(order => {
                const dtStr = order.match_date || order.match_time || order.created_at || order.create_date;
                const t = dtStr ? new Date(dtStr).getTime() : NaN;
                return !isNaN(t) ? (t >= fromTime && t <= toTime) : true;
            });
            
            // Sync localStorage với backend data (để track lệnh đã gửi lên sàn)
            try {
                const sentFromBackend = (data || []).filter(order => 
                    order.sent_to_exchange === true || order.sent_to_exchange === 1
                ).map(order => String(order.id));
                if (sentFromBackend.length > 0) {
                    localStorage.setItem('sentMatchedIds', JSON.stringify(sentFromBackend));
                }
            } catch (_) {
                // Ignore localStorage errors
            }
            
            // Chuẩn hóa record để hiển thị đúng vai trò mua/bán
            this.state.matchedOrders = (data || []).map((o) => this._normalizeOrder(o));
            this.state.pagination.totalItems = data.length;
            this.state.pagination.currentPage = 1;
            this.state.lastUpdate = new Date();
        } catch (error) {
            // Chỉ log lỗi nghiêm trọng
            if (error.message && !error.message.includes('Network')) {
                console.error('[LOAD MATCHED ORDERS] Error:', error);
            }
            this.state.error = "Lỗi tải lệnh khớp: " + (error.message || "Không xác định");
        }
    }

    // ===== Combobox search quỹ =====

    /**
     * Lọc danh sách quỹ theo từ khóa tìm kiếm
     * Tìm kiếm theo tên, ticker hoặc code
     * 
     * @returns {Array} Danh sách quỹ đã lọc
     */
    getFilteredFunds() {
        const funds = this.state.funds || [];
        const term = (this.state.fundSearchTerm || "").trim().toLowerCase();
        if (!term) {
            return funds;
        }

        const filtered = funds.filter((fund) => {
            const name = (fund.name || "").toLowerCase();
            const ticker = (fund.ticker || "").toLowerCase();
            const code = (fund.code || "").toLowerCase();
            return name.includes(term) || ticker.includes(term) || code.includes(term);
        });

        const selectedId = this.state.filters.fund_id;
        if (selectedId && !filtered.some((fund) => fund.id === selectedId)) {
            const currentFund = funds.find((fund) => fund.id === selectedId);
            if (currentFund) {
                return [currentFund, ...filtered];
            }
        }
        return filtered;
    }

    onFilterFundInput(event) {
        if (!event || !event.target) {
            return;
        }
        const value = event.target.value || "";
        this.state.fundSearchTerm = value;
        this.state.showFundDropdown = true;
    }

    onFilterFundFocus(event) {
        this.state.fundSearchTerm = "";
        if (event && event.target) {
            event.target.value = "";
        }
        this.state.showFundDropdown = true;
    }

    onFilterFundBlur(event) {
        setTimeout(() => {
            this.state.showFundDropdown = false;
        }, 200);
    }

    onFilterFundKeydown(event) {
        if (!event) return;
        const key = event.key;
        const filteredFunds = this.getFilteredFunds();
        if (key === 'Escape') {
            this.state.showFundDropdown = false;
            event.target.blur();
        } else if (key === 'Enter') {
            event.preventDefault();
            if (filteredFunds.length > 0) {
                this.onFilterFundSelected(filteredFunds[0]);
            }
        } else if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
        }
    }

    onFilterFundOptionClick(event) {
        if (!event || !event.currentTarget) {
            return;
        }
        const fundId = parseInt(event.currentTarget.getAttribute('data-fund-id'));
        const fund = this.state.funds.find(f => f.id === fundId);
        if (fund) {
            this.onFilterFundSelected(fund);
        }
    }

    onFilterFundSelected(fund) {
        this.state.filters.fund_id = fund.id;
        this.state.fundSearchTerm = "";
        this.state.showFundDropdown = false;
        const input = document.getElementById('fund-combobox-negotiated');
        if (input) {
            input.value = "";
        }
        this.state.pagination.currentPage = 1;
        this._loadMatchedOrders();
    }
    
    /**
     * Làm mới dữ liệu lệnh khớp thỏa thuận
     */
    async refreshData() {
        this.state.error = null;
        this.state.loading = true;
        try {
            await this._loadMatchedOrders();
        } finally {
            this.state.loading = false;
        }
    }
    
    isSelected(order) {
        return this.state.selectedIds.has(order.id);
    }

    getSelectableVisibleOrders() {
        return this.getDisplayedOrders().filter(o => !this.isOrderSent(o));
    }

    isAllSelectableChecked() {
        const visible = this.getSelectableVisibleOrders();
        if (visible.length === 0) return false;
        return visible.every(o => this.state.selectedIds.has(o.id));
    }

    toggleSelect(order, checked) {
        if (this.isOrderSent(order)) return;
        if (checked) {
            this.state.selectedIds.add(order.id);
        } else {
            this.state.selectedIds.delete(order.id);
        }
        this.state.selectedIds = new Set(this.state.selectedIds);
    }

    toggleSelectAll(checked) {
        const selectable = this.getSelectableVisibleOrders();
        if (checked) {
            selectable.forEach(o => this.state.selectedIds.add(o.id));
        } else {
            selectable.forEach(o => this.state.selectedIds.delete(o.id));
        }
        this.state.selectedIds = new Set(this.state.selectedIds);
    }

    getTotalPages() {
        const { perPage } = this.state.pagination;
        const total = this.getTypeFilteredOrders().length;
        return Math.max(1, Math.ceil((total || 0) / perPage));
    }

    /**
     * Tính toán danh sách số trang để hiển thị
     * Hiển thị dạng rút gọn với ellipsis khi có nhiều trang
     * 
     * @returns {Array<number|string>} Danh sách số trang và ellipsis
     */
    getPageNumbers() {
        const totalPages = this.getTotalPages();
        const currentPage = this.state.pagination.currentPage;
        const pages = [];
        
        if (totalPages <= 7) {
            // Nếu tổng số trang <= 7, hiển thị tất cả
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Hiển thị dạng rút gọn: 1 2 3 4 5 ... 30 31 32
            pages.push(1);
            
            if (currentPage <= 4) {
                // Gần đầu: 1 2 3 4 5 ... last
                for (let i = 2; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('ellipsis');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                // Gần cuối: 1 ... (n-4) (n-3) (n-2) (n-1) n
                pages.push('ellipsis');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Ở giữa: 1 ... (current-1) current (current+1) ... last
                pages.push('ellipsis');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('ellipsis');
                pages.push(totalPages);
            }
        }
        
        return pages;
    }

    /**
     * Lọc lệnh khớp theo loại người dùng
     * 
     * @returns {Array} Danh sách lệnh đã lọc theo typeFilter
     */
    getTypeFilteredOrders() {
        const type = this.state.typeFilter;
        if (type === 'all') return this.state.matchedOrders;
        
        return (this.state.matchedOrders || []).filter(order => {
            const buyType = (order.buy_user_type || order._buyUserType || '').toString();
            const sellType = (order.sell_user_type || order._sellUserType || '').toString();
            const hasMM = buyType === 'market_maker' || sellType === 'market_maker';
            
            if (type === 'market_maker') return hasMM;
            if (type === 'investor') return !hasMM; 
            return true;
        });
    }

    getDisplayedOrders() {
        const { currentPage, perPage } = this.state.pagination;
        const data = this.getTypeFilteredOrders();
        const start = (currentPage - 1) * perPage;
        return data.slice(start, start + perPage);
    }

    changeTypeFilter(type) {
        this.state.typeFilter = type;
        this.state.pagination.currentPage = 1;
        this.state.pagination.totalItems = this.getTypeFilteredOrders().length;
    }

    /**
     * Tính tổng số lượng CCQ và tổng giá trị lệnh khớp
     * 
     * @returns {Object} { totalCCQ: number, totalValue: number }
     */
    getTotals() {
        try {
            const list = this.getTypeFilteredOrders();
            return (list || []).reduce((acc, order) => {
                // Số lượng CCQ đã khớp (theo chuẩn Stock Exchange)
                const ccq = Number(order.matched_quantity || order.matched_ccq || order.matched_volume || 0) || 0;
                // Giá trị lệnh = matched_price * matched_quantity
                const val = Number(order.total_value || (order.matched_price || 0) * ccq || 0) || 0;
                acc.totalCCQ += ccq;
                acc.totalValue += val;
                return acc;
            }, { totalCCQ: 0, totalValue: 0 });
        } catch (_) {
            return { totalCCQ: 0, totalValue: 0 };
        }
    }

    isOrderSent(order) {
        if (!order) return false;
        if (order.sent_to_exchange === true || order.sent_to_exchange === 1) {
            return true;
        }
        if (order.buy_sent_to_exchange || order.sell_sent_to_exchange) {
            return true;
        }
        try {
            const sent = JSON.parse(localStorage.getItem('sentMatchedIds') || '[]');
            if (sent.includes(String(order.id))) {
                return false; // Cho phép gửi lại nếu backend chưa cập nhật
            }
        } catch (_) {}
        return false;
    }

    changePage(page) {
        const total = this.getTotalPages();
        const next = Math.min(Math.max(1, page), total);
        this.state.pagination.currentPage = next;
    }

    /**
     * Gửi các lệnh khớp đã chọn lên sàn giao dịch
     * 
     * Ưu tiên sử dụng bulk API, fallback về single API nếu bulk thất bại
     */
    /**
     * Gửi các lệnh khớp đã chọn lên sàn giao dịch
     */
    async sendToExchange() {
        if (this.state.selectedIds.size === 0) return;
        
        try {
            const ids = Array.from(this.state.selectedIds);
            let successIds = [];
            let errors = [];
            
            // --- 1. Thử gửi Bulk API ---
            try {
                const resBulk = await fetch('/api/transaction-list/bulk-send-to-exchange', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify({ 
                        jsonrpc: '2.0', 
                        method: 'call', 
                        params: { matched_order_ids: ids, auto_submit: true } 
                    })
                });
                
                if (resBulk.ok) {
                    const json = await resBulk.json();
                    const result = json.result || json; // Handle Odoo wrapper
                    
                    if (result && result.success) {
                        // Case: Bulk success all
                        successIds = [...ids];
                    } else if (result && result.results) {
                        // Case: Mixed results
                        result.results.forEach(r => {
                            if (r.success) {
                                successIds.push(String(r.id));
                            } else {
                                errors.push(r.message || `Lỗi không xác định (ID: ${r.id})`);
                            }
                        });
                    } else {
                        // Case: Global failure (e.g. no account config)
                        throw new Error(result.message || result.error || "Gửi thất bại");
                    }
                } else {
                    throw new Error(`HTTP ${resBulk.status}`);
                }
            } catch (bulkErr) {
                // Nếu Bulk API lỗi network hoặc logic global fail, fallback hoặc report
                console.warn('[Bulk Send Fail]', bulkErr);
                if (errors.length === 0) errors.push(bulkErr.message);
            }

            // --- 2. Fallback (nếu API cũ không support bulk hoặc logic khác) ---
            // Ở đây vì user yêu cầu fix lỗi "không báo khi chưa có tk", ta ưu tiên hiển thị lỗi từ Bulk trả về.
            // Nếu successIds rỗng và errors rỗng sau bước trên, nghĩa là có gì đó k ổn, ta coi là lỗi chung.

            // --- 3. Xử lý kết quả ---
            if (successIds.length > 0) {
                // Update Local State -> Dim ngay lập tức
                const sentSet = new Set(JSON.parse(localStorage.getItem('sentMatchedIds') || '[]'));
                
                this.state.matchedOrders = this.state.matchedOrders.map(order => {
                    if (successIds.includes(String(order.id))) {
                        sentSet.add(String(order.id));
                        return { ...order, sent_to_exchange: true };
                    }
                    return order;
                });
                
                localStorage.setItem('sentMatchedIds', JSON.stringify(Array.from(sentSet)));
                
                // Clear selection cho các item đã gửi thành công
                successIds.forEach(id => this.state.selectedIds.delete(parseInt(id)));
                this.state.selectedIds = new Set(this.state.selectedIds); // Trigger reactivity
                
                // Thông báo thành công
                const msg = `Đã gửi thành công ${successIds.length} lệnh lên sàn.`;
                this.showToast(msg, 'success');
            }

            if (errors.length > 0) {
                // Hiển thị lỗi đầu tiên hoặc tổng hợp
                const uniqueErrors = [...new Set(errors)];
                const errMsg = uniqueErrors.length === 1 
                    ? uniqueErrors[0] 
                    : `${uniqueErrors.length} lệnh gửi thất bại. ${uniqueErrors[0]}...`;
                
                // Hiển thị toast lỗi (quan trọng: hiển thị Error thay vì Success giả)
                this.showToast(errMsg, 'danger');
            } else if (successIds.length === 0 && errors.length === 0) {
                 this.showToast("Không thể kết nối tới server hoặc phản hồi không hợp lệ.", 'danger');
            }

            // Reload data ngầm để sync status chính xác nhất
            if (successIds.length > 0) {
                setTimeout(() => this._loadMatchedOrders(), 1000);
            }
            
        } catch (error) {
           console.error('[SEND TO EXCHANGE] Fatal Error:', error);
           this.showToast('Lỗi hệ thống: ' + error.message, 'danger');
        }
    }
    
    onFilterChanged(event) {
        const cls = Array.from(event.target.classList).find(c => c.startsWith('filter-')) || '';
        const field = cls.replace('filter-', '');
        const value = event.target.value || null;
        if (field === 'quick-date') {
            this.state.filters.quick_date = value;
            this.state.filters.transaction_date = null;
        } else if (field === 'date') {
            this.state.filters.transaction_date = value;
            this.state.filters.quick_date = null;
        }
        this.state.pagination.currentPage = 1;
        this._loadMatchedOrders();
    }
    
    /**
     * Định dạng giá theo chuẩn Việt Nam
     * 
     * @param {number} price - Giá cần định dạng
     * @returns {string} Giá đã được định dạng
     */
    formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price || 0);
    }
    
    /**
     * Định dạng số lượng (units) theo chuẩn Việt Nam
     * 
     * @param {number} units - Số lượng cần định dạng
     * @returns {string} Số lượng đã được định dạng
     */
    formatUnits(units) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(units || 0);
    }
    
    /**
     * Định dạng thành tiền theo chuẩn Việt Nam
     * 
     * @param {number} amount - Thành tiền cần định dạng
     * @returns {string} Thành tiền đã được định dạng
     */
    formatAmount(amount) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }
    
    /**
     * Định dạng ngày giờ theo chuẩn Việt Nam
     * 
     * @param {string|Date} date - Ngày giờ cần định dạng
     * @returns {string} Ngày giờ đã được định dạng
     */
    formatDateTime(date) {
        if (!date) return "";
        try {
            return new Intl.DateTimeFormat('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(date));
        } catch {
            return "";
        }
    }

    getFundSymbol(order) {
        const symbol = order && (order.fund_ticker || order.ticker || order.fund_symbol);
        if (symbol) return String(symbol).toUpperCase();
        const name = order && (order.fund_name || '');
        const match = String(name).match(/\b[A-Z0-9]{2,}\b/);
        return match ? match[0] : (name || '-');
    }

    formatInterestRate(rate) {
        if (rate === undefined || rate === null || rate === '') return '-';
        const num = Number(rate);
        if (Number.isNaN(num)) return '-';
        return `${num}%`;
    }

    getInterestRateDisplay(order) {
        // Chỉ hiển thị lãi suất nếu buyer là investor
        const buyUserType = order.buy_user_type || order._buyUserType || '';
        if (buyUserType === 'market_maker') {
            return '-';
        }
        const rate = order.interest_rate !== undefined && order.interest_rate !== null 
            ? order.interest_rate 
            : (order.buy_interest_rate !== undefined && order.buy_interest_rate !== null ? order.buy_interest_rate : null);
        if (rate === null || rate === undefined || rate === 0) return '-';
        return this.formatInterestRate(rate);
    }

    getTermDisplay(order) {
        // Chỉ hiển thị kỳ hạn nếu buyer là investor
        const buyUserType = order.buy_user_type || order._buyUserType || '';
        if (buyUserType === 'market_maker') {
            return '-';
        }
        const term = order.term !== undefined && order.term !== null 
            ? order.term 
            : (order.term_months !== undefined && order.term_months !== null 
                ? order.term_months 
                : (order.buy_term_months !== undefined && order.buy_term_months !== null 
                    ? order.buy_term_months 
                    : (order.tenor !== undefined && order.tenor !== null ? order.tenor : null)));
        if (term === null || term === undefined || term === 0) return '-';
        return `${term} tháng`;
    }

    /**
     * Chuẩn hóa record matched order để đảm bảo đúng vai trò mua/bán và số liệu hiển thị.
     */
    _normalizeOrder(raw) {
        const safe = (v, d = '') => (v === undefined || v === null ? d : v);
        const toNum = (v, d = 0) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : d;
        };

        // Buyer side
        const buyInvestor = safe(raw.buy_user_name || raw.buy_investor || raw.buy_user || raw.buy_partner || raw.buy_user_id_name, '');
        const buyUnits = toNum(raw.buy_units !== undefined ? raw.buy_units : raw.units || raw.matched_quantity);
        const buyRemaining = toNum(raw.buy_remaining_units !== undefined ? raw.buy_remaining_units : raw.remaining_units);
        const buyPrice = toNum(raw.buy_price !== undefined ? raw.buy_price : raw.matched_price || raw.price);
        const buyUserType = safe(raw.buy_user_type || raw._buyUserType, 'investor');

        // Seller side
        const sellInvestor = safe(raw.sell_user_name || raw.sell_investor || raw.sell_user || raw.sell_partner || raw.sell_user_id_name, '');
        const sellUnits = toNum(raw.sell_units !== undefined ? raw.sell_units : raw.units || raw.matched_quantity);
        const sellRemaining = toNum(raw.sell_remaining_units !== undefined ? raw.sell_remaining_units : raw.remaining_units);
        const sellPrice = toNum(raw.sell_price !== undefined ? raw.sell_price : raw.matched_price || raw.price);
        const sellUserType = safe(raw.sell_user_type || raw._sellUserType, 'investor');

        // Matched info
        const matchedQty = toNum(raw.matched_quantity || raw.matched_ccq || raw.matched_volume, 0);
        const matchedPrice = toNum(raw.matched_price !== undefined ? raw.matched_price : raw.price, 0);
        const totalVal = toNum(raw.total_value, matchedQty * matchedPrice);

        // Fund
        const fundName = safe(raw.fund_name || raw.buy_fund_name || raw.sell_fund_name, '');
        const fundTicker = safe(raw.fund_ticker || raw.buy_fund_ticker || raw.sell_fund_ticker, '');

        return {
            ...raw,
            buy_investor: buyInvestor,
            buy_units: buyUnits,
            buy_remaining_units: buyRemaining,
            buy_price: buyPrice,
            buy_user_type: buyUserType,

            sell_investor: sellInvestor,
            sell_units: sellUnits,
            sell_remaining_units: sellRemaining,
            sell_price: sellPrice,
            sell_user_type: sellUserType,

            matched_quantity: matchedQty,
            matched_price: matchedPrice,
            total_value: totalVal,

            fund_name: fundName,
            fund_ticker: fundTicker,
        };
    }

    /**
     * Tính toán khoảng thời gian từ quick date filter
     * 
     * @param {string} mode - 'today', 'yesterday', 'last7days'
     * @returns {Object} { date_from: string, date_to: string }
     */
    computeDateRange(mode) {
        const now = new Date();
        const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        const fmt = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };
        let from = startOfDay(now), to = endOfDay(now);
        if (mode === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            from = startOfDay(y);
            to = endOfDay(y);
        } else if (mode === 'last7days') {
            const s = new Date(now);
            s.setDate(s.getDate() - 6);
            from = startOfDay(s);
            to = endOfDay(now);
        }
        return { date_from: fmt(from), date_to: fmt(to) };
    }

    /**
     * Tính toán khoảng thời gian cho một ngày cụ thể
     * 
     * @param {string} dateStr - Ngày dạng 'YYYY-MM-DD' hoặc 'DD/MM/YYYY'
     * @returns {Object} { date_from: string, date_to: string }
     */
    computeDateRangeForDate(dateStr) {
        const [y, m, d] = (() => {
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
            }
            const parts = dateStr.split('/');
            return [Number(parts[2]), Number(parts[1]), Number(parts[0])];
        })();
        const day = new Date(y, m - 1, d);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
        return { date_from: fmt(start), date_to: fmt(end) };
    }

    showToast(message, type = 'info') {
        try {
            const map = { success: 'success', danger: 'danger', error: 'danger', info: 'info', warning: 'warning' };
            const cls = map[type] || 'info';
            const el = document.createElement('div');
            el.className = `alert alert-${cls} alert-dismissible fade show position-fixed`;
            el.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 280px;';
            el.innerHTML = `${message} <button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
            document.body.appendChild(el);
            setTimeout(() => { if (el && el.parentElement) el.parentElement.removeChild(el); }, 3500);
        } catch (_) {
            if (typeof window !== 'undefined' && window.alert) {
                alert(message);
            }
        }
    }

    /**
     * Kiểm tra quyền Market Maker của user
     */
    async checkUserPermission() {
        try {
            const response = await fetch('/api/user-permission/check-user-type', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {},
                    id: Math.floor(Math.random() * 1000000)
                })
            });
            const jsonRpcResponse = await response.json();
            const data = jsonRpcResponse.result || jsonRpcResponse;
            if (data && data.success) {
                this.state.isMarketMaker = data.is_market_maker === true && data.user_type === 'portal';
            }
        } catch (error) {
            console.error('Error checking user permission:', error);
        }
    }

    // Sort table by column
    sortTable(field) {
        if (this.state.sortField === field) {
            this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortField = field;
            this.state.sortOrder = 'asc';
        }
        this.applySorting();
    }

    // Get sort icon class
    getSortIcon(field) {
        if (this.state.sortField !== field) {
            return 'fa fa-sort text-muted';
        }
        return this.state.sortOrder === 'asc' 
            ? 'fa fa-sort-up text-primary' 
            : 'fa fa-sort-down text-primary';
    }

    // Apply sorting to matched orders
    applySorting() {
        if (!this.state.sortField) return;
        
        const field = this.state.sortField;
        const order = this.state.sortOrder;
        
        this.state.matchedOrders.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];
            
            if (valA == null) valA = '';
            if (valB == null) valB = '';
            
            // Handle numeric fields
            if (['matched_price', 'matched_quantity', 'total_value'].includes(field)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (field === 'match_date') {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }
            
            let comparison = 0;
            if (valA < valB) comparison = -1;
            else if (valA > valB) comparison = 1;
            
            return order === 'asc' ? comparison : -comparison;
        });
        
        this.state.pagination.currentPage = 1;
    }
}

