/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { SidebarPanel } from "./sidebar_panel";

export class DashboardWidget extends Component {
    static components = { SidebarPanel };
    static template = xml`
        <div class="fund-dashboard-container">
            <div class="dashboard-shell">
                <t t-if="state.showSidebar">
                <SidebarPanel/>
                </t>

                <main class="dashboard-main">
                    <div class="dashboard-top-bar"></div>

                    <section class="dashboard-section">
                        <div class="section-header">
                            <div>
                                <p class="section-kicker">Tổng quan</p>
                                <h3>Thông kê sản phẩm</h3>
                            </div>
                            <div class="realtime-clock">
                                <span class="realtime-label">Thời gian</span>
                                <div class="realtime-time" t-esc="state.currentTime"/>
                            </div>
                                </div>
                        <t t-set="productCards" t-value="this.getProductCards()"/>
                        <div class="card-grid cols-3">
                            <t t-foreach="productCards" t-as="card" t-key="card.label">
                                <div t-attf-class="info-card #{card.variant}">
                                    <div class="card-icon">
                                        <i t-att-class="card.icon"/>
                            </div>
                                    <div class="card-content">
                                        <p class="card-label" t-esc="card.label"/>
                                        <h4 class="card-value" t-esc="card.value"/>
                                        <p class="card-description" t-if="card.description" t-esc="card.description"/>
                        </div>
                    </div>
                            </t>
                </div>
                    </section>

                    <section class="dashboard-section">
                        <div class="section-header">
                            <div>
                                <p class="section-kicker">Nguồn vốn</p>
                                <h3>Thống kê số dư (VND)</h3>
                            </div>
                            </div>
                        <t t-set="balanceCards" t-value="this.getBalanceCards()"/>
                        <div class="card-grid cols-3">
                            <t t-foreach="balanceCards" t-as="card" t-key="card.label">
                                <div t-attf-class="info-card #{card.variant}">
                                    <div class="card-icon">
                                        <i t-att-class="card.icon"/>
                        </div>
                                    <div class="card-content">
                                        <p class="card-label" t-esc="card.label"/>
                                        <h4 class="card-value" t-esc="card.value"/>
                                        <p class="card-description" t-if="card.description" t-esc="card.description"/>
                    </div>
                            </div>
                            </t>
                            </div>
                    </section>

                    <section class="dashboard-section two-column">
                        <div class="panel">
                            <div class="section-header">
                                <div>
                                    <p class="section-kicker">Người dùng</p>
                                    <h3>Thống kê người dùng</h3>
                            </div>
                                <span class="section-note">
                                    Tổng cộng <t t-esc="this.formatNumber(state.accounts.total || 0)"/> nhà đầu tư
                                    </span>
                            </div>
                            <ul class="user-status-list">
                                <t t-foreach="this.getUserStatusRows()" t-as="row" t-key="row.label">
                                    <li>
                                        <div class="user-status-info">
                                            <span t-attf-class="status-dot #{row.variant}"></span>
                                            <span class="user-status-label" t-esc="row.label"/>
                        </div>
                                        <div class="user-status-value">
                                            <span class="value" t-esc="row.value"/>
                                            <span class="badge" t-if="row.badge" t-attf-class="badge #{row.badgeVariant}">
                                                <t t-esc="row.badge"/>
                                            </span>
                    </div>
                                    </li>
                                </t>
                            </ul>
                </div>

                        <div class="panel transactions">
                            <div class="section-header">
                                <div>
                                    <p class="section-kicker">Giao dịch</p>
                                    <h3>Thống kê giao dịch</h3>
                            </div>
                                <span class="section-note">
                                    Tổng giá trị <t t-esc="this.formatCurrency(state.summary.today_total_amount)"/>
                                </span>
                                            </div>
                            <div class="transaction-card-grid">
                                <t t-foreach="this.getTransactionCards()" t-as="card" t-key="card.label">
                                    <div t-attf-class="transaction-card #{card.variant}">
                                        <div class="transaction-card-meta">
                                            <p class="label" t-esc="card.label"/>
                                            <span class="chip" t-if="card.status" t-esc="card.status"/>
                                            </div>
                                        <h4 t-esc="card.value"/>
                                        <p t-if="card.description" t-esc="card.description"/>
                                        </div>
                                </t>
                                </div>
                            </div>
                    </section>

                    <!-- NEW: Chart Sections -->
                    <section class="dashboard-section">
                        <div class="two-column">
                            <div class="panel chart-panel">
                                <div class="section-header">
                                    <div>
                                        <p class="section-kicker">Xu hướng</p>
                                        <h3>Biểu đồ giao dịch</h3>
                                    </div>
                                </div>
                                <div class="chart-container">
                                    <canvas id="transactionTrendChart"></canvas>
                                </div>
                            </div>
                            <div class="panel chart-panel">
                                <div class="section-header">
                                    <div>
                                        <p class="section-kicker">Phân bổ</p>
                                        <h3>Tỷ trọng danh mục đầu tư</h3>
                                    </div>
                                </div>
                                <div class="chart-container">
                                    <canvas id="fundDistributionChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </section>

                </main>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            showSidebar: true, // Mặc định hiển thị sidebar
            summary: {
                total_accounts: 0,
                total_investment: 0,
                total_current_value: 0,
                total_profit_loss: 0,
                total_profit_loss_percentage: 0,
                today_transactions_count: 0,
                today_pending_count: 0,
                today_completed_count: 0,
                today_total_amount: 0,
                today_buy_count: 0,
                today_sell_count: 0,
                today_buy_amount: 0,
                today_sell_amount: 0,
            },
            transactions: [],
            accounts: {
                total: 0,
                by_status: {
                    pending: 0,
                    kyc: 0,
                    vsd: 0,
                    incomplete: 0,
                }
            },
            fund_movements: [],
            top_transactions: [],
            currentTime: '',
            nav_opening_data: {
                total_opening_ccq: 0,
                funds: [],
            },
            traffic_stats: {
                current_sessions: 0,
                today: 0,
                week: 0,
                month: 0,
                total: 0,
                alerts: 0,
            },
            transaction_status_stats: {
                buy: {
                    pending_confirm: { count: 0, amount: 0 },
                    pending_match: { count: 0, amount: 0 },
                    matched: { count: 0, amount: 0 },
                },
                sell: {
                    pending_confirm: { count: 0, amount: 0 },
                    pending_match: { count: 0, amount: 0 },
                    matched: { count: 0, amount: 0 },
                },
            },
            balance_metrics: {
                total_buy_pending_amount: 0,
                total_sell_pending_amount: 0,
                investor_assets: 0,
            },
            product_status_stats: {
                pending: 0,
                active: 0,
                total: 0,
            },
        });

        // Chart instances
        this.transactionTrendChart = null;
        this.fundDistributionChart = null;
        this.buySellComparisonChart = null;
        this.navOpeningPriceChart = null;

        // Realtime clock interval
        this.clockInterval = null;

        onMounted(() => {
            this.checkUserPermission();
            this.loadDashboardData();
            this.startRealtimeClock();
        });

        onWillUnmount(() => {
            // Clear interval when component unmounts
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
            }
        });
    }

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
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const jsonRpcResponse = await response.json();
            // Với type='json', Odoo trả về JSON-RPC format: {jsonrpc: '2.0', id: null, result: {...}}
            const data = jsonRpcResponse.result || jsonRpcResponse;

            if (data && data.success) {
                // Nếu user là fund_operator, ẩn sidebar
                if (data.user_type === 'fund_operator') {
                    this.state.showSidebar = false;
                    // Ẩn sidebar bằng CSS
                    const shell = document.querySelector('.dashboard-shell');
                    if (shell) {
                        shell.classList.add('no-sidebar');
                    }
                }
            }
        } catch (error) {
            console.error('Error checking user permission:', error);
            // Mặc định vẫn hiển thị sidebar nếu có lỗi
        }
    }

    startRealtimeClock() {
        // Update time immediately
        this.updateCurrentTime();

        // Update every second
        this.clockInterval = setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
    }

    updateCurrentTime() {
        const now = new Date();

        // Format thời gian theo định dạng: HH:mm:ss DD/MM/YYYY
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        this.state.currentTime = `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    }

    async loadDashboardData() {
        try {
            const data = this.props?.initialData;
            if (data) {
                this.updateState(data);
            } else {
                this.showError("Không thể tải dữ liệu dashboard");
            }
        } catch (error) {
            console.error("Error loading dashboard data:", error);
            this.showError("Lỗi khi tải dữ liệu dashboard");
        }
    }

    updateState(data) {
        Object.assign(this.state.summary, data.summary || {});
        this.state.transactions = data.transactions || [];
        Object.assign(this.state.accounts, data.accounts || {});
        this.state.fund_movements = data.fund_movements || [];
        this.state.top_transactions = data.top_transactions || [];
        Object.assign(this.state.nav_opening_data, data.nav_opening_data || {});
        this.state.transaction_trend = data.transaction_trend || null;
        Object.assign(
            this.state.traffic_stats,
            data.traffic_stats || this.getDefaultTrafficStats()
        );
        Object.assign(
            this.state.product_status_stats,
            data.product_stats || {}
        );
        const transactionStats = this.computeTransactionStatusStats(this.state.transactions);
        Object.assign(this.state.transaction_status_stats.buy, transactionStats.buy);
        Object.assign(this.state.transaction_status_stats.sell, transactionStats.sell);
        Object.assign(
            this.state.balance_metrics,
            this.computeBalanceMetrics(transactionStats, this.state.summary)
        );

        // Render charts after state update
        this.renderCharts();
    }

    renderCharts() {
        const hasChartContainer =
            document.getElementById('transactionTrendChart') ||
            document.getElementById('fundDistributionChart') ||
            document.getElementById('buySellComparisonChart') ||
            document.getElementById('navOpeningPriceChart');

        if (!hasChartContainer) {
            return;
        }

        // Wait for DOM to be ready and Chart.js to be loaded
        const checkChartJs = () => {
            if (typeof Chart !== 'undefined') {
                setTimeout(() => {
                    this.renderTransactionTrendChart();
                    this.renderFundDistributionChart();
                }, 100);
            } else {
                // Retry after 100ms if Chart.js not loaded yet
                setTimeout(checkChartJs, 100);
            }
        };
        checkChartJs();
    }

    renderTransactionTrendChart() {
        const ctx = document.getElementById('transactionTrendChart');
        if (!ctx) return;

        if (this.transactionTrendChart) {
            this.transactionTrendChart.destroy();
        }

        const trendData = this.state.transaction_trend;
        if (!trendData || !trendData.labels || !trendData.buy_data || !trendData.sell_data) {
            return;
        }

        this.transactionTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Lệnh mua',
                    data: trendData.buy_data,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                }, {
                    label: 'Lệnh bán',
                    data: trendData.sell_data,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    renderFundDistributionChart() {
        const ctx = document.getElementById('fundDistributionChart');
        if (!ctx) return;

        if (this.fundDistributionChart) {
            this.fundDistributionChart.destroy();
        }

        const fundMovements = this.state.fund_movements || [];
        const activeFunds = fundMovements.filter(m => (m.buy_amount || 0) + (m.sell_amount || 0) > 0);

        if (activeFunds.length === 0) return;

        const labels = activeFunds.map(m => m.fund_ticker || 'N/A');
        const data = activeFunds.map(m => (m.buy_amount || 0) + (m.sell_amount || 0));
        const colors = ['#2563eb', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9'];

        this.fundDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const index = context.dataIndex;
                                const movement = activeFunds[index];
                                const total = data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                const fundName = movement ? movement.fund_name : '';
                                return [
                                    `${context.label}${fundName ? ' - ' + fundName : ''}`,
                                    `Giá trị: ${this.formatCurrency(value)}`,
                                    `Tỷ lệ: ${percentage}%`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    renderBuySellComparisonChart() {
        const ctx = document.getElementById('buySellComparisonChart');
        if (!ctx) return;

        if (this.buySellComparisonChart) {
            this.buySellComparisonChart.destroy();
        }

        const fundMovements = this.state.fund_movements || [];
        const validMovements = fundMovements.filter(m => (m.buy_amount || 0) > 0 || (m.sell_amount || 0) > 0);

        if (validMovements.length === 0) return;

        const labels = validMovements.map(m => m.fund_ticker || 'N/A');
        const buyData = validMovements.map(m => m.buy_amount || 0);
        const sellData = validMovements.map(m => m.sell_amount || 0);

        this.buySellComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Mua',
                        data: buyData,
                        backgroundColor: '#22c55e',
                        borderRadius: 4,
                    },
                    {
                        label: 'Bán',
                        data: sellData,
                        backgroundColor: '#ef4444',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                }
            }
        });
    }

    renderNavOpeningPriceChart() {
        // This method is now secondary but kept for completeness if the container exists
        const ctx = document.getElementById('navOpeningPriceChart');
        if (!ctx) return;

        if (this.navOpeningPriceChart) {
            this.navOpeningPriceChart.destroy();
        }

        const navData = this.state.nav_opening_data?.funds || [];
        if (navData.length === 0) return;

        const labels = navData.map(f => f.ticker || 'N/A');
        const navValues = navData.map(f => f.nav || 0);
        const openingPrices = navData.map(f => f.opening_price || 0);

        this.navOpeningPriceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Giá NAV',
                        data: navValues,
                        backgroundColor: '#2563eb',
                        borderRadius: 4,
                    },
                    {
                        label: 'Giá mở cửa',
                        data: openingPrices,
                        backgroundColor: '#94a3b8',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                }
            }
        });
    }

    getProductCards() {
        const stats = this.state.product_status_stats || {};
        const pending = stats.pending || 0;
        const active = stats.active || 0;
        const total = stats.total || pending + active;
        return [
            {
                label: 'Sản phẩm hoạt động chờ duyệt',
                value: this.formatNumber(pending),
                icon: 'fas fa-hourglass-half',
                variant: 'variant-neutral',
            },
            {
                label: 'Chương trình hoạt động đã duyệt',
                value: this.formatNumber(active),
                icon: 'fas fa-clipboard-check',
                variant: 'variant-accent',
            },
            {
                label: 'Tổng sản phẩm theo dõi',
                value: this.formatNumber(total),
                icon: 'fas fa-layer-group',
                variant: 'variant-primary',
            },
        ];
    }

    getBalanceCards() {
        const metrics = this.state.balance_metrics || {};
        return [
            {
                label: 'Tổng chờ mua',
                value: this.formatCurrency(metrics.total_buy_pending_amount),
                description: 'Giá trị lệnh mua đang xử lý',
                icon: 'fas fa-hand-holding-usd',
                variant: 'variant-neutral',
            },
            {
                label: 'Tổng chờ bán',
                value: this.formatCurrency(metrics.total_sell_pending_amount),
                description: 'Giá trị lệnh bán đang xử lý',
                icon: 'fas fa-wallet',
                variant: 'variant-sky',
            },
            {
                label: 'Tài sản nhà đầu tư',
                value: this.formatCurrency(metrics.investor_assets || this.state.summary.total_current_value),
                description: `${this.formatNumber(this.state.summary.total_accounts || 0)} tài khoản`,
                icon: 'fas fa-building',
                variant: 'variant-green',
            },
        ];
    }

    getUserStatusRows() {
        const total = this.state.accounts.total || 0;
        const statuses = this.state.accounts.by_status || {};
        const mapping = [
            { key: 'pending', label: 'Nhà đầu tư chờ KYC', variant: 'dot-warning' },
            { key: 'kyc', label: 'Nhà đầu tư đã KYC', variant: 'dot-success' },
            { key: 'vsd', label: 'Nhà đầu tư đã có VSD', variant: 'dot-info' },
            { key: 'incomplete', label: 'Nhà đầu tư thiếu hồ sơ', variant: 'dot-muted' },
        ];

        const rows = mapping.map((item) => {
            const value = statuses[item.key] || 0;
            return {
                label: item.label,
                value: this.formatNumber(value),
                variant: item.variant,
                badge: total ? this.formatPercentage(value, total) : null,
                badgeVariant: 'badge-light',
            };
        });

        rows.push({
            label: 'Tổng người dùng',
            value: this.formatNumber(total),
            variant: 'dot-primary',
            badge: '100%',
            badgeVariant: 'badge-strong',
        });

        return rows;
    }

    getTransactionCards() {
        const stats = this.state.transaction_status_stats || {};
        const buyStats = stats.buy || {};
        const sellStats = stats.sell || {};
        const pendingPlaceholder = {
            value: '--',
            description: 'Đang cập nhật từ kết quả lệnh',
        };
        return [
            {
                label: 'Lệnh mua chờ xác nhận',
                value: pendingPlaceholder.value,
                description: pendingPlaceholder.description,
                status: 'BUY',
                variant: 'variant-buy-pending',
            },
            {
                label: 'Lệnh mua chờ khớp lệnh',
                value: this.formatNumber(buyStats.pending_match?.count || 0),
                description: this.formatCurrency(buyStats.pending_match?.amount || 0),
                status: 'BUY',
                variant: 'variant-buy-waiting',
            },
            {
                label: 'Lệnh mua đã khớp lệnh',
                value: this.formatNumber(buyStats.matched?.count || 0),
                description: this.formatCurrency(buyStats.matched?.amount || 0),
                status: 'BUY',
                variant: 'variant-buy-matched',
            },
            {
                label: 'Lệnh bán chờ xác nhận',
                value: pendingPlaceholder.value,
                description: pendingPlaceholder.description,
                status: 'SELL',
                variant: 'variant-sell-pending',
            },
            {
                label: 'Lệnh bán chờ khớp lệnh',
                value: this.formatNumber(sellStats.pending_match?.count || 0),
                description: this.formatCurrency(sellStats.pending_match?.amount || 0),
                status: 'SELL',
                variant: 'variant-sell-waiting',
            },
            {
                label: 'Lệnh bán đã khớp lệnh',
                value: this.formatNumber(sellStats.matched?.count || 0),
                description: this.formatCurrency(sellStats.matched?.amount || 0),
                status: 'SELL',
                variant: 'variant-sell-matched',
            },
        ];
    }

    getTrafficStats() {
        const stats = this.state.traffic_stats || {};
        return [
            {
                label: 'Đang truy cập',
                value: this.formatNumber(stats.current_sessions || 0),
                description: 'Phiên hoạt động',
            },
            {
                label: 'Hôm nay',
                value: this.formatNumber(stats.today || 0),
                description: 'Tổng lượt ghi nhận',
            },
            {
                label: 'Trong tuần',
                value: this.formatNumber(stats.week || 0),
                description: 'Ước tính 5 ngày',
            },
            {
                label: 'Trong tháng',
                value: this.formatNumber(stats.month || 0),
                description: 'Ước tính 4 tuần',
            },
            {
                label: 'Cảnh báo bảo mật',
                value: this.formatNumber(stats.alerts || 0),
                description: 'Sự kiện cần chú ý',
            },
            {
                label: 'Tổng truy cập',
                value: this.formatNumber(stats.total || 0),
                description: 'Bao gồm giao dịch & NĐT',
            },
        ];
    }

    getDefaultTrafficStats() {
        return {
            current_sessions: 0,
            today: 0,
            week: 0,
            month: 0,
            total: 0,
            alerts: 0,
        };
    }

    computeTransactionStatusStats(transactions = []) {
        const baseBucket = () => ({ count: 0, amount: 0 });
        const stats = {
            buy: {
                pending_confirm: baseBucket(),
                pending_match: baseBucket(),
                matched: baseBucket(),
            },
            sell: {
                pending_confirm: baseBucket(),
                pending_match: baseBucket(),
                matched: baseBucket(),
            },
        };
        const buyTypes = ['buy'];
        const sellTypes = ['sell'];
        transactions.forEach((tx) => {
            const type = buyTypes.includes(tx.transaction_type) ? 'buy'
                : sellTypes.includes(tx.transaction_type) ? 'sell'
                    : null;
            if (!type) {
                return;
            }
            const status = tx.status || '';
            let bucket = null;
            if (status === 'pending') {
                bucket = 'pending_match';
            } else if (status === 'completed') {
                bucket = 'matched';
            }
            if (bucket && stats[type][bucket]) {
                stats[type][bucket].count += 1;
                stats[type][bucket].amount += tx.amount || 0;
            }
        });
        return stats;
    }

    computeBalanceMetrics(transactionStats, summary = {}) {
        const buyPending = ((transactionStats.buy?.pending_confirm?.amount) || 0) +
            ((transactionStats.buy?.pending_match?.amount) || 0);
        const sellPending = ((transactionStats.sell?.pending_confirm?.amount) || 0) +
            ((transactionStats.sell?.pending_match?.amount) || 0);
        return {
            total_buy_pending_amount: buyPending,
            total_sell_pending_amount: sellPending,
            investor_assets: summary.total_current_value || 0,
        };
    }

    showError(message) {
        console.error(message);
        const widgetContainer = document.getElementById('dashboard-widget');
        const errorContainer = document.getElementById('error-container');
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        if (errorContainer) {
            errorContainer.style.display = 'block';
        }
        if (widgetContainer) {
            widgetContainer.style.display = 'none';
        }
    }

    formatCurrency(value) {
        if (!value && value !== 0) return "0 ₫";
        // Đảm bảo value là number
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return "0 ₫";
        // Làm tròn số
        const rounded = Math.round(numValue);
        // Format thủ công để đảm bảo hiển thị đúng
        // Chia thành phần nguyên và format với dấu chấm phân cách hàng nghìn
        const parts = rounded.toString().split('.');
        let integerPart = parts[0];
        // Thêm dấu chấm phân cách hàng nghìn
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return integerPart + ' ₫';
    }

    formatNumber(value) {
        if (!value && value !== 0) return "0";
        // Đảm bảo value là number
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return "0";
        const formatted = new Intl.NumberFormat("vi-VN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(numValue);
        // Bỏ ,00 nếu có
        return formatted.replace(/,00$/, '');
    }

    formatPercentage(value, total) {
        if (!total) {
            return "0%";
        }
        const ratio = (value / total) * 100;
        return `${ratio.toFixed(1)}%`;
    }
}

