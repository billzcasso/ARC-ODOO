/** @odoo-module */

import { Component, useState, onMounted, onWillUnmount, xml } from "@odoo/owl";
import { OrderMatchingActions } from "../order_matching_actions.js";

export class OrderBookComponent extends Component {
    static template = xml`
        <div class="order-book-page">
            <div class="order-book-hero">
                <div class="hero-content">
                    <div class="hero-copy">
                        <div class="hero-pill">Trung tâm sổ lệnh</div>
                        <h1>Sàn giao dịch Chứng chỉ quỹ đóng</h1>
                        <p class="hero-lead">
                            Giám sát và điều phối toàn bộ lệnh mua bán theo thời gian thực, hỗ trợ điều hành quỹ nhanh chóng.
                        </p>
                        <div class="hero-meta">
                            <span>
                                Quỹ đang xem:
                                <strong t-if="state.selectedFund">
                                    <t t-esc="state.selectedFund.name"/> (<t t-esc="state.selectedFund.ticker or ''"/>)
                                </strong>
                                <t t-else="">Chưa chọn</t>
                            </span>
                            <span class="status-chip">
                                <i class="fa fa-clock-o"></i>
                                Cập nhật:
                                <t t-esc="state.lastUpdate ? formatDateTime(state.lastUpdate) : 'Đang đồng bộ'"/>
                            </span>
            </div>
                        <div class="order-book-nav">
                            <a href="#" class="nav-link active">Khoản đầu tư chờ xử lý</a>
                            <a href="/completed-orders" class="nav-link">Khoản đầu tư đã khớp</a>
                            <a href="/negotiated-orders" class="nav-link">Khoản đầu tư khớp theo thỏa thuận</a>
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
                    <button class="btn btn-refresh" title="Làm mới dữ liệu" t-on-click="refreshData">
                        <i class="fa fa-refresh"></i>
                        Làm mới
                    </button>
                    <div class="dropdown test-api-dropdown">
                        <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fas fa-flask me-2"></i>Khớp lệnh thỏa thuận
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li>
                                <button class="dropdown-item" t-on-click="createRandomTransactions">
                                    <i class="fas fa-dice"></i>
                                    <span>Tạo Random</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item" t-on-click="marketMakerHandleRemainingFromMenu">
                                    <i class="fas fa-exchange-alt"></i>
                                    <span>Nhà tạo lập Mua/Bán</span>
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item" t-on-click="importExcel">
                                    <i class="fas fa-file-excel"></i>
                                    <span>Import Excel</span>
                                </button>
                            </li>
                            <li><hr class="dropdown-divider"/></li>
                            <li>
                                <button class="dropdown-item" t-on-click="sendMaturityNotifications">
                                    <i class="fas fa-bell"></i>
                                    <span>Gửi thông báo đáo hạn</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div class="hero-fund-card">
                        <div class="fund-control-header">
                            <p class="label">Chọn quỹ cần theo dõi</p>
                            <span class="helper-text">Tìm theo tên, mã giao dịch hoặc ticker</span>
                        </div>
                        <div class="fund-combobox-wrapper">
                            <input 
                                id="fund-combobox" 
                                type="text" 
                                class="fund-combobox-input"
                                placeholder="Nhập tên quỹ..." 
                                t-on-input="onFundComboboxInput"
                                t-on-focus="onFundComboboxFocus"
                                t-on-blur="onFundComboboxBlur"
                                t-on-keydown="onFundComboboxKeydown"
                            />
                            <i class="fa fa-chevron-down fund-combobox-arrow"></i>
                            <div class="fund-combobox-dropdown" t-att-class="{'show': state.showFundDropdown}">
                                <t t-if="getFilteredFunds().length === 0">
                                    <div class="fund-combobox-no-results">Không tìm thấy quỹ</div>
                                </t>
                                <t t-foreach="getFilteredFunds()" t-as="fund" t-key="fund.id">
                                    <div 
                                        class="fund-combobox-option"
                                        t-att-class="{'selected': state.selectedFund and state.selectedFund.id === fund.id}"
                                        t-on-click="onFundOptionClick"
                                        t-att-data-fund-id="fund.id"
                                    >
                                        <div class="option-name"><t t-esc="fund.name"/></div>
                                        <div class="option-meta"><t t-esc="fund.ticker"/> • <t t-esc="fund.code or ''"/></div>
                                    </div>
                                </t>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="order-book-grid">
                <section class="order-column buy-column">
                    <div class="column-header">
                        <div>
                            <p class="column-label">Ưu tiên giá cao</p>
                            <h3><t t-esc="state.buyOrders.length"/> lệnh chờ xử lý</h3>
                    </div>
                        <span class="column-badge">Lệnh mua</span>
                    </div>
                    <div class="column-body">
                        <div t-if="state.loading" class="state-card">
                            <i class="fa fa-spinner fa-spin"></i>
                            Đang tải dữ liệu lệnh mua...
                        </div>
                        <div t-if="!state.loading and state.buyOrders.length === 0" class="state-card muted">
                            <i class="fa fa-info-circle"></i>
                            Không có lệnh mua chờ xử lý
                        </div>
                        <t t-if="!state.loading and state.buyOrders.length > 0">
                            <div class="table-responsive">
                                <table class="order-table">
                                <thead>
                                    <tr>
                                        <th>Giá</th>
                                        <th>Còn lại</th>
                                        <th>Thành tiền</th>
                                        <th>Nhà đầu tư</th>
                                        <th>Thời gian</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr t-foreach="state.buyOrders" t-as="order" t-key="order.id" class="buy-order" t-att-data-id="order.id">
                                        <td>
                                            <t t-esc="formatPrice(order.price)"/>
                                            <t t-if="order.is_split_order and order.parent_order_info">
                                                <span class="split-order-indicator" 
                                                      t-att-data-order-id="order.id"
                                                      t-on-mouseenter="showParentOrderTooltip"
                                                      t-on-mouseleave="hideParentOrderTooltip"
                                                          title="Lệnh được tách tự động - di chuột để xem lệnh gốc">
                                                    <i class="fa fa-code-branch"></i>
                                                </span>
                                            </t>
                                        </td>
                                            <td>
                                                <t t-esc="formatUnits(typeof order.remaining_units === 'number' ? order.remaining_units : (order.units || 0))"/>
                                                <t t-if="(typeof order.matched_units === 'number' ? order.matched_units : 0) > 0">
                                                    <span class="order-info-icon" 
                                                          t-att-data-order-id="order.id"
                                                          t-on-mouseenter="showOrderInfoTooltip"
                                                          t-on-mouseleave="hideOrderInfoTooltip"
                                                          title="Thông tin lệnh">
                                                        <i class="fa fa-info-circle"></i>
                                                    </span>
                                                </t>
                                            </td>
                                        <td><t t-esc="formatAmount(order.amount)"/></td>
                                            <td class="text-ellipsis"><t t-esc="order.user_name"/></td>
                                        <td><t t-esc="formatDateTime(order.created_at)"/></td>
                                        <td>
                                            <span t-attf-class="status-badge status-#{order.status}"><t t-esc="formatStatus(order.status)"/></span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                        </t>
                    </div>
                </section>

                <section class="order-column sell-column">
                    <div class="column-header">
                        <div>
                            <p class="column-label">Ưu tiên giá thấp</p>
                            <h3><t t-esc="state.sellOrders.length"/> lệnh chờ xử lý</h3>
                    </div>
                        <span class="column-badge">Lệnh bán</span>
                    </div>
                    <div class="column-body">
                        <div t-if="state.loading" class="state-card">
                            <i class="fa fa-spinner fa-spin"></i>
                            Đang tải dữ liệu lệnh bán...
                        </div>
                        <div t-if="!state.loading and state.sellOrders.length === 0" class="state-card muted">
                            <i class="fa fa-info-circle"></i>
                            Không có lệnh bán chờ xử lý
                        </div>
                        <t t-if="!state.loading and state.sellOrders.length > 0">
                            <div class="table-responsive">
                                <table class="order-table">
                                <thead>
                                    <tr>
                                        <th>Giá</th>
                                        <th>Còn lại</th>
                                        <th>Thành tiền</th>
                                        <th>Nhà đầu tư</th>
                                        <th>Thời gian</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr t-foreach="state.sellOrders" t-as="order" t-key="order.id" class="sell-order" t-att-data-id="order.id">
                                        <td>
                                            <t t-esc="formatPrice(order.price)"/>
                                            <t t-if="order.is_split_order and order.parent_order_info">
                                                <span class="split-order-indicator" 
                                                      t-att-data-order-id="order.id"
                                                      t-on-mouseenter="showParentOrderTooltip"
                                                      t-on-mouseleave="hideParentOrderTooltip"
                                                          title="Lệnh được tách tự động - di chuột để xem lệnh gốc">
                                                    <i class="fa fa-code-branch"></i>
                                                </span>
                                            </t>
                                        </td>
                                            <td>
                                                <t t-esc="formatUnits(typeof order.remaining_units === 'number' ? order.remaining_units : (order.units || 0))"/>
                                                <t t-if="(typeof order.matched_units === 'number' ? order.matched_units : 0) > 0">
                                                    <span class="order-info-icon" 
                                                          t-att-data-order-id="order.id"
                                                          t-on-mouseenter="showOrderInfoTooltip"
                                                          t-on-mouseleave="hideOrderInfoTooltip"
                                                          title="Thông tin lệnh">
                                                        <i class="fa fa-info-circle"></i>
                                                    </span>
                                                </t>
                                            </td>
                                        <td><t t-esc="formatAmount(order.amount)"/></td>
                                            <td class="text-ellipsis"><t t-esc="order.user_name"/></td>
                                        <td><t t-esc="formatDateTime(order.created_at)"/></td>
                                        <td>
                                            <span t-attf-class="status-badge status-#{order.status}"><t t-esc="formatStatus(order.status)"/></span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                        </t>
                    </div>
                </section>
                </div>

            <section class="partial-orders-card">
                <div class="section-heading">
                    <div>
                        <p class="section-label">Lệnh khớp một phần</p>
                        <h3><t t-esc="state.partialOrders.length"/> lệnh đang xử lý</h3>
                    </div>
                    <span class="section-helper">Theo dõi tiến độ khớp từng lệnh</span>
                </div>
                <div class="column-body">
                    <div t-if="state.loading" class="state-card">
                            <i class="fa fa-spinner fa-spin"></i>
                        Đang đồng bộ dữ liệu khớp một phần...
                        </div>
                    <div t-if="!state.loading and state.partialOrders.length === 0" class="state-card muted">
                            <i class="fa fa-info-circle"></i>
                        Chưa có lệnh nào khớp một phần
                        </div>
                        <t t-if="!state.loading and state.partialOrders.length > 0">
                        <div class="table-responsive">
                            <table class="order-table partial-table">
                                <thead>
                                    <tr>
                                        <th>Loại lệnh</th>
                                        <th>Giá</th>
                                        <th>Tổng số lượng</th>
                                        <th>Đã khớp</th>
                                        <th>Còn lại</th>
                                        <th>Thành tiền</th>
                                        <th>Nhà đầu tư</th>
                                        <th>Thời gian</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr t-foreach="state.partialOrders" t-as="order" t-key="order.id" 
                                        t-attf-class="partial-order #{order.transaction_type === 'sell' ? 'sell-order' : 'buy-order'}">
                                        <td>
                                            <t t-if="order.transaction_type === 'sell'">Lệnh bán</t>
                                            <t t-else="">Lệnh mua</t>
                                            <t t-if="order.is_split_order">
                                                <span class="split-order-indicator split-inline" title="Lệnh được tách tự động">
                                                    <i class="fa fa-code-branch"></i>
                                                </span>
                                            </t>
                                        </td>
                                        <td><t t-esc="formatPrice(order.price)"/></td>
                                        <td><t t-esc="formatUnits(order.units)"/></td>
                                        <td><t t-esc="formatUnits(order.matched_units || 0)"/></td>
                                        <td><t t-esc="formatUnits(order.remaining_units || 0)"/></td>
                                        <td><t t-esc="formatAmount(order.amount)"/></td>
                                        <td class="text-ellipsis"><t t-esc="order.user_name"/></td>
                                        <td><t t-esc="formatDateTime(order.created_at)"/></td>
                                        <td>
                                            <span t-attf-class="status-badge status-#{order.status || 'pending'}"><t t-esc="formatStatus(order.status)"/></span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        </t>
                    </div>
            </section>
        </div>
    `;
    static props = {};

    setup() {
        this.state = useState({
            buyOrders: [],
            sellOrders: [],
            partialOrders: [],
            fundInfo: null,
            selectedFund: null,
            funds: [],
            fundSearchTerm: "",
            showFundDropdown: false,
            loading: false,
            lastUpdate: null,
            priceChange: 0,
            priceChangePercent: 0,
            // Track previous order IDs theo từng phía; reset khi đổi quỹ
            previousOrderIds: { buy: new Set(), sell: new Set() },
            // Chặn animation khi vừa đổi quỹ
            suppressAnimations: false,
            matchedOrders: [], // Track matched orders for animation
            lastMatchedUnits: { buy: new Map(), sell: new Map() }, // Track matched_units per order id
            currentFundIndex: 0, // Track index quỹ hiện tại
            isMarketMaker: false // Track nếu user là Market Maker
        });

        this.refreshInterval = null;
        this.matchInterval = null;
        this.autoRotateInterval = null;
        
        this.setupEventListeners();
        this.loadInitialData();
        
        // Component mounted: set initial value cho combobox sau khi mount
        onMounted(() => {
            setTimeout(() => {
                this.updateComboboxValue();
            }, 100);
            this.checkUserPermission();
        });
    }

    setupEventListeners() {
        // Auto refresh mỗi 5 giây
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, 5000);
        
        // Auto match orders mỗi 2 giây
        this.matchInterval = setInterval(() => {
            this.autoMatchOrders().catch(err => {
                if (err && err.message && !err.message.includes('fetch')) {
                    console.error('[AUTO MATCH INTERVAL] Error:', err);
                }
            });
        }, 2000);
    }

    async loadInitialData() {
        this.state.loading = true;
        try {
            // Load danh sách funds
            const response = await fetch("/api/transaction-list/funds", {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const funds = await response.json();
            this.state.funds = funds.funds || [];
            
            if (this.state.funds.length > 0) {
                this.state.currentFundIndex = 0;
                this.state.selectedFund = this.state.funds[0];
                this.updateComboboxValue();
                await this.loadOrderBook();
                this.startAutoRotate();
            }
        } catch (error) {
            console.error("Error loading initial data:", error);
            if (window.showError) {
                window.showError("Lỗi tải dữ liệu ban đầu: " + error.message);
            }
        } finally {
            this.state.loading = false;
        }
    }

    async loadOrderBook() {
        if (!this.state.selectedFund) {
            return;
        }

        try {
            const response = await fetch("/api/transaction-list/order-book", {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    fund_id: this.state.selectedFund.id
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.success) {
                // Phát hiện orders mới bị khớp (disappeared) - theo thuật toán Price-Time Priority (FIFO)
                this.detectMatchedOrders(data.buy_orders || [], data.sell_orders || []);
                // Phát hiện tăng matched_units để kích hoạt animation ngay khi khớp
                this.detectMatchedIncrements(data.buy_orders || [], data.sell_orders || []);
                
                // Cập nhật danh sách lệnh mua/bán (đã được sắp xếp theo Price-Time Priority từ backend)
                this.state.buyOrders = data.buy_orders || [];
                this.state.sellOrders = data.sell_orders || [];
                // Sử dụng partial_orders từ backend (đã query từ transaction.matched.orders với status = 'partial')
                // Partial orders là các lệnh có remaining_units > 0 và matched_units > 0
                this.state.partialOrders = data.partial_orders || [];
                this.state.fundInfo = data.fund_info || null;
                this.state.priceChange = data.price_change || 0;
                this.state.priceChangePercent = data.price_change_percent || 0;
                this.state.lastUpdate = new Date();

                // Loại bỏ các lệnh đã khớp hoàn toàn khỏi box chờ xử lý
                // remaining_units = units - matched_units (theo chuẩn Stock Exchange)
                this.reconcileOrders();
                
                // Cho phép animation trở lại sau khi đã đồng bộ danh sách theo quỹ mới
                this.state.suppressAnimations = false;
            } else {
                throw new Error(data.message || "Không thể tải dữ liệu sổ lệnh");
            }
        } catch (error) {
            console.error("Error loading order book:", error);
            if (window.showError) {
                window.showError("Lỗi tải sổ lệnh: " + error.message);
            }
        }
    }

    async refreshData() {
        await this.loadOrderBook();
    }

    async onFundChange(event) {
        let fundId = null;
        
        // Nếu có event từ select (cũ), lấy fundId từ event
        if (event && event.target) {
            fundId = parseInt(event.target.value);
        } else if (this.state.selectedFund) {
            // Nếu không có event, dùng selectedFund hiện tại
            fundId = this.state.selectedFund.id;
        }
        
        if (fundId) {
            const index = this.state.funds.findIndex(f => f.id === fundId);
            if (index !== -1) {
                this.state.currentFundIndex = index;
                this.state.selectedFund = this.state.funds[index];
                // Khi đổi quỹ: không nháy màu do thay đổi filter
                this.state.suppressAnimations = true;
                // Reset bộ nhớ để không coi sự biến mất do filter là khớp lệnh
                this.state.previousOrderIds = { buy: new Set(), sell: new Set() };
                this.state.lastMatchedUnits.buy.clear();
                this.state.lastMatchedUnits.sell.clear();
                await this.loadOrderBook();
            }
        }
    }

    startAutoRotate() {
        // Dừng interval cũ nếu có
        if (this.autoRotateInterval) {
            clearInterval(this.autoRotateInterval);
        }
        // Tự động chuyển quỹ mỗi 1 phút (60 giây)
        this.autoRotateInterval = setInterval(() => {
            this.rotateToNextFund();
        }, 60000);
    }

    async rotateToNextFund() {
        if (!this.state.funds || this.state.funds.length <= 1) {
            return; // Không có quỹ hoặc chỉ có 1 quỹ thì không cần rotate
        }
        
        // Tăng index và loop lại từ đầu nếu đến cuối
        this.state.currentFundIndex = (this.state.currentFundIndex + 1) % this.state.funds.length;
        this.state.selectedFund = this.state.funds[this.state.currentFundIndex];
        
        // Khi đổi quỹ: không nháy màu do thay đổi filter
        this.state.suppressAnimations = true;
        // Reset bộ nhớ để không coi sự biến mất do filter là khớp lệnh
        this.state.previousOrderIds = { buy: new Set(), sell: new Set() };
        this.state.lastMatchedUnits.buy.clear();
        this.state.lastMatchedUnits.sell.clear();
        
        // Không cần cập nhật select element nữa vì đã dùng combobox
        
        await this.loadOrderBook();
    }

    formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    formatUnits(units) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(units);
    }

    formatAmount(amount) {
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatPercent(value) {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            return '0%';
        }
        return `${numeric.toFixed(2)}%`;
    }

    getPriceChangeClass() {
        if (this.state.priceChange > 0) return "price-up";
        if (this.state.priceChange < 0) return "price-down";
        return "price-neutral";
    }

    getPriceChangeIcon() {
        if (this.state.priceChange > 0) return "fa-arrow-up";
        if (this.state.priceChange < 0) return "fa-arrow-down";
        return "fa-minus";
    }

    /**
     * Lấy danh sách lệnh khớp một phần từ bảng transaction.matched.orders
     * 
     * Lệnh khớp một phần: remaining_units > 0 và matched_units > 0
     * Tính toán: remaining_units = units - matched_units (theo chuẩn Stock Exchange)
     * 
     * NOTE: Method này hiện không được sử dụng vì backend đã cung cấp partial_orders
     * Giữ lại để tương thích với code cũ nếu cần
     */
    async loadPartialOrdersFromMatched() {
        try {
            // Gọi endpoint get-matched-orders để lấy danh sách các execution records partial/done
            const resp = await fetch('/api/transaction-list/get-matched-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fund_id: this.state.selectedFund && this.state.selectedFund.id ? this.state.selectedFund.id : undefined,
                    status: ['partial', 'done']
                })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const rows = data && (data.data || data.matched_orders || []);
            // Gom số lượng theo từng transaction (mua/bán)
            const agg = new Map(); // key: txId -> { id, user_name, fund_id, price, units, matched_units, remaining_units, status, created_at }

            const normalizeTx = (raw) => {
                if (!raw) return null;
                // Tương thích nhiều cấu trúc trả về khác nhau
                const units = Number(raw.units ?? 0);
                const matchedUnits = Number(raw.matched_units ?? 0);
                const remainingUnitsField = raw.remaining_units;
                const remainingUnitsProvided = typeof remainingUnitsField === 'number';
                const fundId = (raw.fund && raw.fund.id) || raw.fund_id || (raw.fund_id && raw.fund_id[0]) || null;
                return {
                    id: raw.id,
                    user_name: raw.user_name || (raw.user && raw.user.name) || '',
                    fund_id: fundId,
                    price: Number(raw.price ?? raw.current_nav ?? 0),
                    units,
                    matched_units: matchedUnits,
                    remaining_units: remainingUnitsProvided ? Number(remainingUnitsField) : null,
                    status: raw.status || 'pending',
                    created_at: raw.created_at || raw.create_date || null,
                };
            };

            const accumulate = (rawTx, qty) => {
                const tx = normalizeTx(rawTx);
                if (!tx || !tx.id) return;
                // Lọc theo quỹ đang chọn nếu có
                if (this.state.selectedFund && this.state.selectedFund.id && tx.fund_id && tx.fund_id !== this.state.selectedFund.id) {
                    return;
                }
                const k = tx.id;
                const cur = agg.get(k) || {
                    id: k,
                    user_name: tx.user_name,
                    fund_id: tx.fund_id,
                    price: tx.price,
                    units: tx.units,
                    matched_units: 0,
                    // Nếu backend đã cung cấp remaining/matched hiện tại thì ưu tiên số liệu đó làm baseline
                    remaining_units: typeof tx.remaining_units === 'number' ? tx.remaining_units : tx.units,
                    status: tx.status,
                    created_at: tx.created_at,
                };
                // Nếu backend có matched_units và remaining_units hiện tại, đồng bộ trước khi cộng dồn từ lịch sử cặp
                if (tx.matched_units && typeof tx.remaining_units === 'number') {
                    cur.matched_units = Number(tx.matched_units);
                    cur.remaining_units = Number(tx.remaining_units);
                }
                // Cộng thêm matched từ bản ghi cặp (đảm bảo không vượt quá tổng units)
                const added = Number(qty || 0);
                cur.matched_units = Math.min((cur.matched_units || 0) + added, cur.units || 0);
                cur.remaining_units = Math.max((cur.units || 0) - (cur.matched_units || 0), 0);
                agg.set(k, cur);
            };

            rows.forEach((m) => {
                const qty = m.matched_quantity || m.quantity || 0;
                // Chuẩn hóa các field buy/sell trong nhiều cấu trúc trả về
                const buyOrder = m.buy_order || m.buy_order_id || (m.buy_order && m.buy_order.id ? m.buy_order : null);
                const sellOrder = m.sell_order || m.sell_order_id || (m.sell_order && m.sell_order.id ? m.sell_order : null);
                if (buyOrder) accumulate(buyOrder, qty);
                if (sellOrder) accumulate(sellOrder, qty);
            });

            // Chỉ giữ các lệnh đang pending và khớp một phần
            const partial = Array.from(agg.values()).filter(r => r.status === 'pending' && r.matched_units > 0 && r.remaining_units > 0);
            this.state.partialOrders = partial;
        } catch (e) {
            console.error('[LOAD PARTIAL FROM MATCHED ERROR]', e);
            // Fallback: giữ nguyên partialOrders cũ
        }
    }

    formatStatus(status) {
        const s = (status || '').toString().toLowerCase();
        if (s === 'pending') return 'Chờ khớp';
        if (s === 'completed') return 'Khớp lệnh';
        if (s === 'cancelled') return 'Đã hủy';
        return status || '';
    }

    formatDateTime(date) {
        if (!date) return "";
        return new Intl.DateTimeFormat('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(date));
    }

    /**
     * Phát hiện các lệnh đã bị khớp hoàn toàn (disappeared từ danh sách)
     * 
     * Theo workflow khớp lệnh:
     * - Khi lệnh khớp hoàn toàn (remaining_units <= 0), nó sẽ biến mất khỏi danh sách chờ
     * - Frontend phát hiện sự biến mất và hiển thị animation
     */
    detectMatchedOrders(newBuyOrders, newSellOrders) {
        // Nếu đang đổi quỹ, bỏ qua animation do thay đổi filter
        if (this.state.suppressAnimations) {
            const currentBuyIdsOnly = new Set(newBuyOrders.map(order => order.id));
            const currentSellIdsOnly = new Set(newSellOrders.map(order => order.id));
            this.state.previousOrderIds = {
                buy: currentBuyIdsOnly,
                sell: currentSellIdsOnly,
            };
            return;
        }
        
        // Tạo Set các order IDs hiện tại
        const currentBuyIds = new Set(newBuyOrders.map(order => order.id));
        const currentSellIds = new Set(newSellOrders.map(order => order.id));
        
        // Phát hiện buy/sell orders bị khớp hoàn toàn (disappeared)
        const matchedBuyIds = [...this.state.previousOrderIds.buy || []].filter(id => !currentBuyIds.has(id));
        const matchedSellIds = [...this.state.previousOrderIds.sell || []].filter(id => !currentSellIds.has(id));
        
        // Hiển thị animation cho matched orders
        if (matchedBuyIds.length > 0 || matchedSellIds.length > 0) {
            this.showMatchAnimation(matchedBuyIds, matchedSellIds);
        }
        
        // Cập nhật previous order IDs để so sánh lần sau
        this.state.previousOrderIds = {
            buy: currentBuyIds,
            sell: currentSellIds
        };
    }
    
    showMatchAnimation(matchedBuyIds, matchedSellIds) {
        // Hiển thị notification
        const totalMatched = matchedBuyIds.length + matchedSellIds.length;
        this.showMatchNotification(`🎉 Đã khớp ${totalMatched} lệnh! (${matchedBuyIds.length} mua, ${matchedSellIds.length} bán)`);
        
        // Trigger animation cho các orders còn lại (nếu có)
        setTimeout(() => {
            this.triggerMatchAnimation();
        }, 100);
    }
    
    /**
     * Hiển thị thông báo khớp lệnh cho người dùng
     * 
     * @param {string} message - Nội dung thông báo
     * @param {string} type - Loại thông báo: 'success', 'error', 'info'
     */
    showMatchNotification(message, type = 'success') {
        // Xóa notification cũ nếu có
        const existingNotifications = document.querySelectorAll('.match-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Tạo notification element
        const notification = document.createElement('div');
        notification.className = 'match-notification';
        notification.textContent = message;
        
        // Thêm style theo type
        const typeStyles = {
            'error': '#dc3545',
            'info': '#17a2b8',
            'success': '#28a745'
        };
        notification.style.background = typeStyles[type] || typeStyles['success'];
        notification.style.zIndex = '9999';
        notification.style.position = 'fixed';
        notification.style.top = '80px';
        notification.style.right = '20px';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        notification.style.fontSize = '14px';
        notification.style.fontWeight = '500';
        
        document.body.appendChild(notification);
        
        // Auto remove sau 4 giây
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
    }
    
    triggerMatchAnimation() {
        // Thêm class animation cho orders (nếu cần)
        const buyOrders = document.querySelectorAll('.buy-order');
        const sellOrders = document.querySelectorAll('.sell-order');
        
        // Random animation cho một số orders để tạo hiệu ứng
        [...buyOrders].slice(0, 2).forEach(order => {
            order.classList.add('matched-buy');
            setTimeout(() => order.classList.remove('matched-buy'), 2000);
        });
        
        [...sellOrders].slice(0, 2).forEach(order => {
            order.classList.add('matched-sell');
            setTimeout(() => order.classList.remove('matched-sell'), 2000);
        });
    }

    getSelectedFundDisplay() {
        if (this.state.selectedFund) {
            return `${this.state.selectedFund.name} (${this.state.selectedFund.ticker})`;
        }
        return "";
    }

    updateComboboxValue() {
        const input = document.getElementById('fund-combobox');
        if (!input) return;
        
        // Chỉ update nếu input không đang focus (để không làm gián đoạn khi đang gõ)
        if (document.activeElement !== input) {
            if (this.state.fundSearchTerm && this.state.fundSearchTerm.trim() !== "") {
                input.value = this.state.fundSearchTerm;
            } else {
                input.value = "";
            }
        }
    }

    onFundComboboxInput(event) {
        if (!event || !event.target) {
            return;
        }
        const value = event.target.value || "";
        this.state.fundSearchTerm = value;
        this.state.showFundDropdown = true;
    }

    onFundComboboxFocus(event) {
        // Khi focus, luôn cho phép gõ mới, không tự fill lại tên quỹ
            this.state.fundSearchTerm = "";
        if (event && event.target) {
            event.target.value = "";
        }
        this.state.showFundDropdown = true;
    }

    onFundComboboxBlur(event) {
        // Delay để cho phép click vào option được xử lý trước
        setTimeout(() => {
            this.state.showFundDropdown = false;
        }, 200);
    }

    onFundComboboxKeydown(event) {
        if (!event) return;
        
        const key = event.key;
        const filteredFunds = this.getFilteredFunds();
        
        if (key === 'Escape') {
            this.state.showFundDropdown = false;
            event.target.blur();
        } else if (key === 'Enter') {
            event.preventDefault();
            if (filteredFunds.length > 0) {
                this.selectFund(filteredFunds[0]);
            }
        } else if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            // Có thể implement keyboard navigation nếu cần
        }
    }

    onFundOptionClick(event) {
        if (!event || !event.currentTarget) {
            return;
        }
        const fundId = parseInt(event.currentTarget.getAttribute('data-fund-id'));
        const fund = this.state.funds.find(f => f.id === fundId);
        if (fund) {
            this.selectFund(fund);
        }
    }

    selectFund(fund) {
        this.state.selectedFund = fund;
        this.state.fundSearchTerm = "";
        this.state.showFundDropdown = false;
        const input = document.getElementById('fund-combobox');
        if (input) {
            input.value = "";
        }
        this.onFundChange();
    }

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

        const selectedId = this.state.selectedFund && this.state.selectedFund.id;
        if (selectedId && !filtered.some((fund) => fund.id === selectedId)) {
            const currentFund = funds.find((fund) => fund.id === selectedId);
            if (currentFund) {
                return [currentFund, ...filtered];
            }
        }
        return filtered;
    }

    /**
     * Phát hiện tăng matched_units và kích hoạt animation ngay lập tức
     * 
     * Theo workflow khớp lệnh:
     * 1. Backend khớp lệnh → tạo execution record
     * 2. matched_units được tính từ executions (computed field)
     * 3. remaining_units = units - matched_units
     * 4. Frontend phát hiện thay đổi và hiển thị animation
     */
    detectMatchedIncrements(newBuyOrders, newSellOrders) {
        try {
            // Nếu đang đổi quỹ, bỏ qua nháy do matched_units khác fund
            if (this.state.suppressAnimations) {
                return;
            }
            // BUY
            newBuyOrders.forEach(o => {
                const id = o.id;
                const prev = this.state.lastMatchedUnits.buy.get(id) || 0;
                const cur = typeof o.matched_units === 'number' ? o.matched_units : 0;
                if (cur > prev) {
                    const el = document.querySelector(`.buy-order[data-id="${id}"]`);
                    if (el) {
                        el.classList.add('matched-buy');
                        setTimeout(() => el.classList.remove('matched-buy'), 2000);
                    }
                }
                this.state.lastMatchedUnits.buy.set(id, cur);
            });
            // SELL
            newSellOrders.forEach(o => {
                const id = o.id;
                const prev = this.state.lastMatchedUnits.sell.get(id) || 0;
                const cur = typeof o.matched_units === 'number' ? o.matched_units : 0;
                if (cur > prev) {
                    const el = document.querySelector(`.sell-order[data-id="${id}"]`);
                    if (el) {
                        el.classList.add('matched-sell');
                        setTimeout(() => el.classList.remove('matched-sell'), 2000);
                    }
                }
                this.state.lastMatchedUnits.sell.set(id, cur);
            });

            // Sau khi phát hiện tăng matched_units, cập nhật lại danh sách để loại bỏ lệnh đã khớp hoàn toàn
            this.reconcileOrders();
        } catch (e) {
            console.error('[DETECT MATCHED INCREMENTS ERROR]', e);
        }
    }

    /**
     * Đồng bộ danh sách: bỏ lệnh đã khớp hoàn toàn khỏi box chờ xử lý
     * 
     * Theo chuẩn Stock Exchange:
     * - remaining_units = units - matched_units
     * - Lệnh khớp hoàn toàn: remaining_units <= 0
     * - Lệnh khớp một phần: remaining_units > 0 và matched_units > 0
     * 
     * QUAN TRỌNG: Giữ lại TẤT CẢ lệnh có remaining_units > 0, kể cả lệnh nhỏ
     * partialOrders đã được set từ backend (từ transaction.matched.orders với status = 'partial')
     */
    reconcileOrders() {
        const isFullyMatched = (order) => {
            // Tính toán remaining_units chính xác theo chuẩn Stock Exchange
            if (typeof order.remaining_units === 'number') {
                // Backend đã cung cấp remaining_units, sử dụng trực tiếp
                return order.remaining_units <= 0;
            }
            // Fallback: Tính từ units - matched_units
            const units = Number(order.units || 0);
            const matched = Number(order.matched_units || 0);
            const remaining = units - matched;
            // Chỉ coi là khớp hoàn toàn nếu remaining <= 0
            return remaining <= 0;
        };

        // Lọc bỏ lệnh đã khớp hoàn toàn khỏi danh sách chờ xử lý
        // Giữ lại TẤT CẢ lệnh có remaining_units > 0 (kể cả lệnh nhỏ)
        this.state.buyOrders = this.state.buyOrders.filter(order => !isFullyMatched(order));
        this.state.sellOrders = this.state.sellOrders.filter(order => !isFullyMatched(order));
    }

    /**
     * Tự động khớp lệnh theo thuật toán Price-Time Priority (FIFO)
     * 
     * Được gọi mỗi 1 giây bởi matchInterval để đảm bảo khớp lệnh realtime
     * 
     * Workflow:
     * 1. Gọi API match-orders với tất cả lệnh pending
     * 2. Backend sẽ tự query và khớp theo Price-Time Priority:
     *    - Buy orders: Giá cao nhất trước, cùng giá thì thời gian sớm nhất trước
     *    - Sell orders: Giá thấp nhất trước, cùng giá thì thời gian sớm nhất trước
     *    - Điều kiện khớp: buy_price >= sell_price
     *    - Giá khớp: Luôn lấy giá của sell order
     *    - Số lượng khớp: min(buy_quantity, sell_quantity)
     * 3. Nếu có khớp, refresh UI và hiển thị notification
     */
    async autoMatchOrders() {
        // Không khớp nếu chưa có quỹ được chọn
        if (!this.state.selectedFund) {
            return;
        }
        
        try {
            // Backend sẽ tự query tất cả lệnh pending từ database
            // Không dựa vào state.buyOrders/sellOrders vì có thể không đầy đủ do filter hoặc delay
            const response = await fetch('/api/transaction-list/match-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    match_type: 'all',
                    use_time_priority: true, // Sử dụng Price-Time Priority (FIFO)
                    status_mode: 'pending',
                    fund_id: this.state.selectedFund ? this.state.selectedFund.id : undefined
                })
            });

            if (!response.ok) {
                // Chỉ log lỗi HTTP nghiêm trọng, không spam console
                if (response.status >= 500) {
                    console.error('[AUTO MATCH] Server error:', response.status, response.statusText);
                }
                return;
            }

            const result = await response.json();
            
            // Kiểm tra kết quả khớp lệnh
            if (result.success) {
                const totalMatched = result.summary?.total_matched || 0;
                
                if (totalMatched > 0) {
                    // Có khớp lệnh, refresh data để hiển thị animation và cập nhật UI
                    await this.refreshData();
                    
                    // Hiển thị notification cho người dùng (chỉ khi có khớp)
                    this.showMatchNotification(
                        `Đã khớp ${totalMatched} cặp lệnh tự động!`,
                        'success'
                    );
                }
                // Nếu totalMatched = 0, không làm gì (không có lệnh khớp được)
            } else if (result.error || result.message) {
                // Chỉ log lỗi thực sự, không log khi không có lệnh khớp
                const errorMsg = result.message || result.error || '';
                if (errorMsg && !errorMsg.includes('Không có lệnh') && !errorMsg.includes('pending')) {
                    console.error('[AUTO MATCH] Error:', errorMsg);
                }
            }
        } catch (error) {
            // Chỉ log lỗi nghiêm trọng, bỏ qua lỗi network tạm thời
            if (error && error.message && !error.message.includes('fetch') && !error.message.includes('network')) {
                console.error('[AUTO MATCH] Unexpected error:', error);
            }
        }
    }

    async matchNow() {
        try {
            const res = await fetch('/api/transaction-list/match-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_type: 'all',
                    use_time_priority: true,
                    status_mode: 'pending'
                })
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const result = await res.json();
            if (result.success) {
                await this.refreshData();
                this.showMatchNotification(`🎉 Đã khớp ${result.summary?.total_matched || 0} cặp lệnh!`);
            }
        } catch (e) {
            console.error('[MATCH NOW ERROR]', e);
        }
    }

    // Methods sử dụng OrderMatchingActions từ module order_matching
    async createRandomTransactions() {
        await OrderMatchingActions.createRandomTransactions(
            (msg, type) => this.showMatchNotification(msg, type),
            () => this.refreshData()
        );
    }

    /**
     * Khớp lệnh thủ công cho quỹ hiện tại
     * 
     * Sử dụng thuật toán Price-Time Priority (FIFO):
     * - Buy orders: Giá cao nhất trước, cùng giá thì thời gian sớm nhất trước
     * - Sell orders: Giá thấp nhất trước, cùng giá thì thời gian sớm nhất trước
     * - Điều kiện khớp: buy_price >= sell_price
     * - Giá khớp: Luôn lấy giá của sell order
     */
    async matchOrders() {
        await OrderMatchingActions.matchOrders(
            (msg, type) => this.showMatchNotification(msg, type),
            null, // Không có showMatchingResults modal trong order book
            () => this.refreshData(),
            {
                match_type: 'all',
                use_time_priority: true, // Sử dụng Price-Time Priority (FIFO)
                status_mode: 'pending',
                fund_id: this.state.selectedFund ? this.state.selectedFund.id : undefined
            }
        );
    }

    async marketMakerHandleRemainingFromMenu() {
        // Chuẩn bị state object tương thích với OrderMatchingActions
        const compatibleState = {
            buyOrders: this.state.buyOrders || [],
            sellOrders: this.state.sellOrders || [],
            partialOrders: this.state.partialOrders || [],
            selectedFund: this.state.selectedFund || null
        };
        
        await OrderMatchingActions.marketMakerHandleRemainingFromMenu(
            compatibleState,
            (msg, type) => this.showMatchNotification(msg, type),
            null, // Không có showMatchingResults modal trong order book
            () => this.refreshData(),
            {
                fund_id: this.state.selectedFund ? this.state.selectedFund.id : undefined
            }
        );
    }

    async importExcel() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls,.csv';
            input.style.display = 'none';
            document.body.appendChild(input);

            const file = await new Promise((resolve) => {
                input.addEventListener('change', () => {
                    resolve(input.files && input.files[0] ? input.files[0] : null);
                }, { once: true });
                input.click();
            });

            document.body.removeChild(input);

            if (!file) {
                this.showMatchNotification('⚠️ Bạn chưa chọn file. Thao tác bị hủy.', 'info');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/transaction-list/import-excel', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                this.showMatchNotification(`📊 Import thành công: ${result.transactions.length} lệnh (trạng thái pending)`, 'success');
                await this.refreshData();
            } else {
                this.showMatchNotification('❌ Lỗi khi import: ' + (result.message || 'Không xác định'), 'error');
            }
        } catch (error) {
            this.showMatchNotification('❌ Lỗi kết nối: ' + error.message, 'error');
        }
    }

    async sendMaturityNotifications() {
        // Tạo rpc function tương thích với OrderMatchingActions
        const rpc = async (route, params) => {
            const response = await fetch(route, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            
            const result = await response.json();
            
            // Xử lý JSON-RPC format nếu có
            if (result.jsonrpc && result.result) {
                return result.result;
            }
            
            return result;
        };
        
        await OrderMatchingActions.sendMaturityNotifications(
            (msg, type) => this.showMatchNotification(msg, type),
            rpc
        );
    }

    async sendMaturityNotificationsTest() {
        // Tạo rpc function tương thích với OrderMatchingActions
        const rpc = async (route, params) => {
            const response = await fetch(route, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            
            const result = await response.json();
            
            // Xử lý JSON-RPC format nếu có
            if (result.jsonrpc && result.result) {
                return result.result;
            }
            
            return result;
        };
        
        await OrderMatchingActions.sendMaturityNotificationsTest(
            (msg, type) => this.showMatchNotification(msg, type),
            rpc
        );
    }

    showParentOrderTooltip(ev) {
        const span = ev.target;
        const orderId = parseInt(span.getAttribute('data-order-id'));
        if (!orderId) return;
        
        // Tìm order trong state (lệnh tách hiện tại)
        const allOrders = [...this.state.buyOrders, ...this.state.sellOrders, ...this.state.partialOrders];
        const order = allOrders.find(o => o.id === orderId);
        
        if (!order || !order.parent_order_info) return;
        
        const parentInfo = order.parent_order_info;
        
        // Tạo tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'parent-order-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-header">Lệnh gốc (ID: ${parentInfo.id})</div>
            <div class="tooltip-content">
                <div><strong>Giá:</strong> ${this.formatPrice(parentInfo.price)}</div>
                <div><strong>Tổng số lượng:</strong> ${this.formatUnits(parentInfo.units)}</div>
                <div><strong>Đã khớp:</strong> ${this.formatUnits(parentInfo.matched_units || 0)}</div>
                <div><strong>Còn lại:</strong> ${this.formatUnits(parentInfo.remaining_units || 0)}</div>
                <div><strong>Thành tiền:</strong> ${this.formatAmount(parentInfo.amount)}</div>
                <div><strong>Thời gian:</strong> ${this.formatDateTime(parentInfo.created_at)}</div>
            </div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Tính vị trí tooltip
        const rect = span.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top}px`;
        
        // Đảm bảo tooltip không vượt ra ngoài màn hình
        setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth) {
                tooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
            }
            if (tooltipRect.bottom > window.innerHeight) {
                tooltip.style.top = `${window.innerHeight - tooltipRect.height - 10}px`;
            }
        }, 0);
    }
    
    showOrderInfoTooltip(ev) {
        const icon = ev.currentTarget;
        const orderId = icon.getAttribute('data-order-id');
        if (!orderId) return;
        
        // Tìm order trong buyOrders hoặc sellOrders
        const allOrders = [...this.state.buyOrders, ...this.state.sellOrders];
        const order = allOrders.find(o => String(o.id) === String(orderId));
        
        if (!order) return;
        
        const units = typeof order.units === 'number' ? order.units : 0;
        const matchedUnits = typeof order.matched_units === 'number' ? order.matched_units : 0;
        const remainingUnits = typeof order.remaining_units === 'number' ? order.remaining_units : (units - matchedUnits);
        
        const tooltipContent = `
            <div style="text-align: left;">
                <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e4e8f0;">
                    <strong style="color: #4f46e5; font-size: 14px;">Thông tin lệnh</strong>
                </div>
                <div style="margin: 6px 0;"><strong>Tổng số lượng ban đầu:</strong> ${this.formatUnits(units)}</div>
                <div style="margin: 6px 0;"><strong>Đã khớp:</strong> ${this.formatUnits(matchedUnits)}</div>
                <div style="margin: 6px 0;"><strong>Còn lại:</strong> ${this.formatUnits(remainingUnits)}</div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e4e8f0;">
                    <small style="color: #6b7280;">Kiểm tra: ${this.formatUnits(units)} = ${this.formatUnits(matchedUnits)} + ${this.formatUnits(remainingUnits)}</small>
                </div>
            </div>
        `;
        
        // Tạo tooltip element
        let tooltip = document.getElementById('order-info-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'order-info-tooltip';
            tooltip.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                z-index: 10000;
                font-size: 12px;
                min-width: 200px;
                pointer-events: none;
            `;
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = tooltipContent;
        
        // Tính vị trí tooltip
        const rect = icon.getBoundingClientRect();
        tooltip.style.display = 'block';
        
        // Đặt vị trí tooltip
        const tooltipWidth = 250;
        const tooltipHeight = 150;
        let left = rect.right + 10;
        let top = rect.top - 10;
        
        // Đảm bảo tooltip không vượt ra ngoài màn hình
        if (left + tooltipWidth > window.innerWidth) {
            left = rect.left - tooltipWidth - 10;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        if (top < 10) {
            top = 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }
    
    hideOrderInfoTooltip(ev) {
        const tooltip = document.getElementById('order-info-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    hideParentOrderTooltip(ev) {
        const tooltips = document.querySelectorAll('.parent-order-tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
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

    onWillUnmount() {
        // Cleanup tất cả intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.matchInterval) {
            clearInterval(this.matchInterval);
            this.matchInterval = null;
        }
        if (this.autoRotateInterval) {
            clearInterval(this.autoRotateInterval);
            this.autoRotateInterval = null;
        }
        
        // Xóa tooltip khi unmount
        this.hideParentOrderTooltip();
        this.hideOrderInfoTooltip();
    }
}
