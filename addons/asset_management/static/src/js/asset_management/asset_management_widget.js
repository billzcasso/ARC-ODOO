/** @odoo-module */

import { Component, xml, useState, onMounted } from "@odoo/owl";
import { loadJS } from "@web/core/assets";

export class AssetManagementWidget extends Component {
    static template = xml`
    <div class="asset-management-container">
        <div class="am-scope container-fluid py-4">
            <div class="row g-4">
                <!-- Left Column: Summary and Assets -->
                <div class="col-lg-4">
                    <div class="am-card d-flex flex-column">
                        <div class="card-title">
                            <i class="fas fa-wallet text-primary"></i> Tổng tài sản
                        </div>
                        
                        <div class="total-assets-display flex-grow-1 d-flex flex-column justify-content-center">
                             <div class="amount mb-4">
                                <t t-esc="this.formatCurrency(state.totalAssets)"/>
                                <span class="currency">đ</span>
                            </div>
                            <div class="chart-container">
                                <canvas id="assetOverviewChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Fund Certificates Summary -->
                <div class="col-lg-8">
                    <div class="am-card">
                        <div class="card-title">
                            <i class="fas fa-certificate text-warning"></i> Chứng chỉ quỹ nắm giữ
                        </div>
                        <div class="table-responsive">
                            <table class="hd-table">
                                <thead>
                                    <tr>
                                        <th>Quy</th>
                                        <th class="text-center">Số lượng</th>
                                        <th class="text-center">Lãi/Lỗ</th>
                                        <th class="text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <t t-if="state.fundCertificates and state.fundCertificates.length > 0">
                                        <t t-foreach="state.fundCertificates" t-as="cert" t-key="cert.code">
                                            <tr>
                                                <td>
                                                    <div class="d-flex align-items-center gap-3">
                                                        <span t-attf-style="background-color: #{cert.color or '#2B4BFF'}; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.8rem;">
                                                            <t t-esc="cert.code"/>
                                                        </span>
                                                        <div>
                                                            <div class="fw-bold text-dark"><t t-esc="cert.name"/></div>
                                                            <div class="sub-text"><t t-esc="cert.code"/></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="text-center fw-semibold">
                                                    <t t-esc="this.formatNumber(cert.quantity)"/> CCQ
                                                </td>
                                                <td class="text-center">
                                                    <span t-attf-class="badge-premium #{(cert.isProfit) ? 'badge-success' : 'badge-danger'}">
                                                        <i t-attf-class="fas fa-caret-#{cert.isProfit ? 'up' : 'down'} me-1"></i>
                                                        <t t-esc="(cert.change || 0).toFixed(2)"/>%
                                                    </span>
                                                </td>
                                                <td class="text-center">
                                                    <div class="d-flex justify-content-center gap-2">
                                                        <a href="/fund_buy" class="btn-action btn-buy" title="Mua thêm">
                                                            <i class="fas fa-plus"></i>
                                                        </a>
                                                    </div>
                                                </td>
                                            </tr>
                                        </t>
                                    </t>
                                    <t t-else="">
                                        <tr>
                                            <td colspan="4" class="text-center py-4 text-muted">
                                                <i class="fas fa-inbox fa-2x mb-2 d-block opacity-50"></i>
                                                Chưa có dữ liệu
                                            </td>
                                        </tr>
                                    </t>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Danh Mục Đầu Tư Section (SSI Style) -->
            <div class="am-card mt-4">
                <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-3">
                    <h5 class="fw-bold mb-0 text-dark">
                        <i class="fas fa-briefcase text-primary me-2"></i> Danh mục đầu tư
                    </h5>
                </div>

                <div class="table-responsive">
                    <table class="hd-table portfolio-table">
                        <thead>
                            <tr class="header-row">
                                <th rowspan="2" class="sticky-col text-center">Mã</th>
                                <th rowspan="2" class="text-center">Tổng KL</th>
                                <th rowspan="2" class="text-center">KL KD</th>
                                <th colspan="2" class="text-center border-start">Sở hữu theo loại</th>
                                <th colspan="3" class="text-center border-start">Mua chờ về</th>
                                <th colspan="3" class="text-center border-start">Bán chờ giao</th>
                                <th rowspan="2" class="text-center border-start">Giá vốn</th>
                                <th rowspan="2" class="text-center">Giá TT</th>
                                <th rowspan="2" class="text-center">Vốn</th>
                                <th rowspan="2" class="text-center">GT TT</th>
                                <th rowspan="2" class="text-center">Lãi/Lỗ</th>
                                <th rowspan="2" class="text-center">%</th>
                                <th rowspan="2" class="text-center">Bán</th>
                            </tr>
                            <tr class="sub-header-row">
                                <th class="text-center border-start">Thường</th>
                                <th class="text-center">Thỏa thuận</th>
                                <th class="text-center border-start">T0</th>
                                <th class="text-center">T1</th>
                                <th class="text-center">T2</th>
                                <th class="text-center border-start">T0</th>
                                <th class="text-center">T1</th>
                                <th class="text-center">T2</th>
                            </tr>
                        </thead>
                        <tbody>
                            <t t-if="state.portfolioItems and state.portfolioItems.length > 0">
                                <t t-foreach="state.portfolioItems" t-as="item" t-key="item.code">
                                    <tr t-attf-class="#{item.profitLoss >= 0 ? '' : 'row-loss'}">
                                        <td class="sticky-col fw-bold text-primary text-center">
                                            <t t-esc="item.code"/>
                                        </td>
                                        <td class="text-center fw-semibold"><t t-esc="this.formatNumber(item.totalQuantity)"/></td>
                                        <td class="text-center"><t t-esc="this.formatNumber(item.tradableQuantity)"/></td>
                                        <!-- Sở hữu theo loại -->
                                        <td class="text-center border-start"><t t-esc="this.formatNumber(item.normalUnits) || '-'"/></td>
                                        <td class="text-center"><t t-esc="this.formatNumber(item.negotiatedUnits) || '-'"/></td>
                                        <!-- Mua chờ về T0/T1/T2 -->
                                        <td class="text-center border-start"><t t-esc="item.pendingBuyT0 || '-'"/></td>
                                        <td class="text-center"><t t-esc="item.pendingBuyT1 || '-'"/></td>
                                        <td class="text-center"><t t-esc="item.pendingBuyT2 || '-'"/></td>
                                        <!-- Bán chờ giao T0/T1/T2 -->
                                        <td class="text-center border-start"><t t-esc="item.pendingSellT0 || '-'"/></td>
                                        <td class="text-center"><t t-esc="item.pendingSellT1 || '-'"/></td>
                                        <td class="text-center"><t t-esc="item.pendingSellT2 || '-'"/></td>
                                        <!-- Giá trị -->
                                        <td class="text-center border-start"><t t-esc="this.formatCurrency(item.costPrice)"/></td>
                                        <td class="text-center"><t t-esc="this.formatCurrency(item.marketPrice)"/></td>
                                        <td class="text-center"><t t-esc="this.formatCurrency(item.costValue)"/></td>
                                        <td class="text-center"><t t-esc="this.formatCurrency(item.marketValue)"/></td>
                                        <td t-attf-class="text-center fw-bold #{item.profitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                            <t t-esc="this.formatCurrency(item.profitLoss)"/>
                                        </td>
                                        <td t-attf-class="text-center fw-bold #{item.profitLossPercent >= 0 ? 'text-success' : 'text-danger'}">
                                            <t t-esc="item.profitLossPercent.toFixed(2)"/>%
                                        </td>
                                        <!-- Bán button - chỉ hiển thị khi có hàng khả dụng -->
                                        <td class="text-center">
                                            <t t-if="item.canSell">
                                                <button class="btn btn-sm btn-danger" t-on-click="() => this.openSellModal(item)">
                                                    Bán
                                                </button>
                                            </t>
                                            <t t-else="">
                                                <span class="text-muted">Chờ T+2</span>
                                            </t>
                                        </td>
                                    </tr>
                                </t>
                            </t>
                            <t t-else="">
                                <tr>
                                    <td colspan="18" class="text-center py-4 text-muted">
                                        <i class="fas fa-folder-open fa-2x mb-2 d-block opacity-50"></i>
                                        Không có dữ liệu
                                    </td>
                                </tr>
                            </t>
                        </tbody>
                        <!-- Summary Footer -->
                        <tfoot t-if="state.portfolioItems and state.portfolioItems.length > 0">
                            <tr class="summary-row">
                                <td class="sticky-col fw-bold">Tổng</td>
                                <td class="text-end fw-bold"><t t-esc="this.formatNumber(state.summary.totalQuantity)"/></td>
                                <td class="text-end fw-bold"><t t-esc="this.formatNumber(state.summary.tradableQuantity)"/></td>
                                <td colspan="6" class="border-start"></td>
                                <td colspan="2" class="border-start"></td>
                                <td class="text-end fw-bold"><t t-esc="this.formatCurrency(state.summary.costValue)"/></td>
                                <td class="text-end fw-bold"><t t-esc="this.formatCurrency(state.summary.marketValue)"/></td>
                                <td t-attf-class="text-end fw-bold #{state.summary.profitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                    <t t-esc="this.formatCurrency(state.summary.profitLoss)"/>
                                </td>
                                <td t-attf-class="text-end fw-bold #{state.summary.profitLossPercent >= 0 ? 'text-success' : 'text-danger'}">
                                    <t t-esc="state.summary.profitLossPercent.toFixed(2)"/>%
                                </td>
                                <td colspan="3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
  `;

    setup() {
        this.validateProps();

        this.state = useState({
            totalAssets: this.safeGetProp('totalAssets', 0),
            fundCertificates: this.safeGetProp('fundCertificates', []),
            chartData: this.safeGetProp('chartData', '{}'),

            // Portfolio items with T+2 breakdown
            portfolioItems: this.transformToPortfolioItems(),
            summary: {
                totalQuantity: 0,
                tradableQuantity: 0,
                costValue: 0,
                marketValue: 0,
                profitLoss: 0,
                profitLossPercent: 0
            }
        });

        onMounted(() => {
            try {
                this.calculateSummary();
                this.initChart();
            } catch (error) {
                console.error('Error in onMounted:', error);
            }
        });
    }

    validateProps() {
        if (!this.props) {
            throw new Error('Props not defined');
        }
    }

    safeGetProp(propName, defaultValue) {
        try {
            const value = this.props[propName];
            if (value === null || value === undefined) {
                return defaultValue;
            }
            return value;
        } catch (error) {
            console.warn(`Error getting prop ${propName}:`, error);
            return defaultValue;
        }
    }

    transformToPortfolioItems() {
        // Transform holdings data to portfolio format with T+2 breakdown
        const holdings = this.safeGetProp('holdings', []);
        const fundCerts = this.safeGetProp('fundCertificates', []);

        // Group by fund code
        const grouped = {};

        for (const cert of fundCerts) {
            if (!cert.code) continue;

            grouped[cert.code] = {
                code: cert.code,
                name: cert.name,
                totalQuantity: cert.quantity || 0,
                tradableQuantity: cert.availableQuantity || cert.quantity || 0,
                // Order type breakdown
                normalUnits: cert.normalUnits || 0,
                negotiatedUnits: cert.negotiatedUnits || 0,
                // Use T0/T1/T2 data from controller
                pendingBuyT0: cert.pendingBuyT0 || 0,
                pendingBuyT1: cert.pendingBuyT1 || 0,
                pendingBuyT2: cert.pendingBuyT2 || 0,
                pendingSellT0: cert.pendingSellT0 || 0,
                pendingSellT1: cert.pendingSellT1 || 0,
                pendingSellT2: cert.pendingSellT2 || 0,
                costPrice: cert.avgPrice || 0,
                marketPrice: cert.currentPrice || cert.navPrice || 0,
                costValue: cert.totalValue || 0,
                marketValue: 0,
                profitLoss: 0,
                profitLossPercent: 0,
                // Can sell when T+2 complete
                canSell: cert.canSell || false
            };

            // Calculate market value and profit/loss
            grouped[cert.code].marketValue = grouped[cert.code].totalQuantity * grouped[cert.code].marketPrice;
            grouped[cert.code].profitLoss = grouped[cert.code].marketValue - grouped[cert.code].costValue;
            grouped[cert.code].profitLossPercent = grouped[cert.code].costValue > 0
                ? (grouped[cert.code].profitLoss / grouped[cert.code].costValue) * 100
                : 0;
        }

        return Object.values(grouped);
    }

    calculateSummary() {
        const items = this.state.portfolioItems || [];

        let totalQty = 0;
        let tradableQty = 0;
        let costVal = 0;
        let marketVal = 0;

        for (const item of items) {
            totalQty += item.totalQuantity || 0;
            tradableQty += item.tradableQuantity || 0;
            costVal += item.costValue || 0;
            marketVal += item.marketValue || 0;
        }

        this.state.summary = {
            totalQuantity: totalQty,
            tradableQuantity: tradableQty,
            costValue: costVal,
            marketValue: marketVal,
            profitLoss: marketVal - costVal,
            profitLossPercent: costVal > 0 ? ((marketVal - costVal) / costVal) * 100 : 0
        };
    }

    openSellModal(item) {
        // Navigate to sell page or open modal
        window.location.href = `/fund_sell?ticker=${item.code}`;
    }

    async initChart() {
        try {
            await loadJS('https://cdn.jsdelivr.net/npm/chart.js');

            const ctx = document.getElementById('assetOverviewChart');
            if (!ctx) {
                console.warn('Chart canvas element not found');
                return;
            }

            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded');
                return;
            }

            let chartData;
            try {
                chartData = JSON.parse(this.state.chartData || '{}');
            } catch (parseError) {
                console.warn('Error parsing chart data:', parseError);
                chartData = { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
            }

            if (!chartData.labels || !Array.isArray(chartData.labels)) {
                chartData.labels = [];
            }
            if (!chartData.datasets || !Array.isArray(chartData.datasets) || !chartData.datasets[0]) {
                chartData.datasets = [{ data: [], backgroundColor: [] }];
            }

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        data: chartData.datasets[0].data || [],
                        backgroundColor: chartData.datasets[0].backgroundColor || ['#2B4BFF'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    return `${label}: ${value.toLocaleString('vi-VN')}d`;
                                }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        } catch (error) {
            console.error("Error initializing chart:", error);
        }
    }

    formatCurrency(value) {
        try {
            if (value === null || value === undefined) return '0';
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(numValue)) return '0';
            return numValue.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
        } catch (error) {
            return '0';
        }
    }

    formatNumber(value) {
        try {
            if (value === null || value === undefined) return '0';
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(numValue)) return '0';
            return numValue.toLocaleString('vi-VN');
        } catch (error) {
            return '0';
        }
    }
}

// Make component available globally
window.AssetManagementWidget = AssetManagementWidget;