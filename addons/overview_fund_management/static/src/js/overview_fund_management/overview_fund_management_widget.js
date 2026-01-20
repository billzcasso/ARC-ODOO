/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { loadJS } from "@web/core/assets";

export class OverviewFundManagementWidget extends Component {
  static template = xml`
    <div class="fund-overview-container">
        <div class="container-fluid py-4">
            <div class="row g-4">
                <!-- Left Column: Quỹ Đầu Tư sections -->
                <div class="col-lg-4">
                    <div class="fund-list-scrollable custom-scrollbar">
                        <div class="d-flex flex-column gap-4">
                        <t t-if="state.funds and state.funds.length > 0">
                            <t t-foreach="state.funds" t-as="fund" t-key="fund.ticker">
                                <article class="fund-card p-3">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <div class="d-flex align-items-center gap-2">
                                            <span t-attf-class="fund-ticker" t-attf-style="background-color: #{fund.color}">
                                                <t t-esc="fund.ticker"/>
                                            </span>
                                            <h3 class="small fw-semibold text-dark mb-0">
                                                <t t-esc="fund.name"/>
                                            </h3>
                                        </div>
                                    </div>
                                    
                                    <div class="row g-2 mb-2">
                                        <div class="col-6">
                                            <div class="stat-item-compact">
                                                <p class="text-muted xs mb-0">Tổng số CCQ</p>
                                                <p class="fw-semibold small mb-0"><t t-esc="this.formatCurrency(fund.total_units)"/></p>
                                            </div>
                                            <div class="stat-item-compact mt-1">
                                                <p class="text-muted xs mb-0">Tổng GTĐT</p>
                                                <p class="fw-semibold small mb-0"><t t-esc="this.formatCurrency(fund.total_investment)"/>đ</p>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div t-attf-class="stat-item-compact text-end #{this.getNavClass(fund)}">
                                                <p class="text-muted xs mb-0">NAV hiện tại</p>
                                                <p class="fw-semibold small mb-0">
                                                    <t t-esc="this.formatCurrency(fund.current_value / fund.total_units)"/>đ
                                                </p>
                                            </div>
                                            <div t-attf-class="stat-item-compact text-end mt-1 #{this.getValueClass(fund)}">
                                                <p class="text-muted xs mb-0">Giá trị hiện tại</p>
                                                <p class="fw-semibold small mb-0"><t t-esc="this.formatCurrency(fund.current_value)"/>đ</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p t-attf-class="fw-semibold small #{fund.profit_loss_percentage >= 0 ? 'profit-positive' : 'profit-negative'} mb-0">
                                        <i class="bi bi-arrow-up-right me-1" t-if="fund.profit_loss_percentage >= 0"></i>
                                        <i class="bi bi-arrow-down-right me-1" t-if="fund.profit_loss_percentage &lt; 0"></i>
                                        Lợi/lỗ <t t-esc="this.formatProfit(fund.profit_loss_percentage)"/>%
                                    </p>
                                </article>
                            </t>
                        </t>
                        <t t-if="!state.funds or state.funds.length === 0">
                            <article class="fund-card p-3">
                                <div class="text-center text-muted py-4">
                                    <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                                    <p class="mb-0">Không có dữ liệu quỹ đầu tư</p>
                                </div>
                            </article>
                        </t>
                            </div>
                    </div>
                </div>

                <!-- Right Column: Tổng quan tài sản and Giao dịch gần nhất -->
                <div class="col-lg-8">
                    <div class="d-flex flex-column gap-3">
                        <!-- Tổng quan tài sản -->
                        <article class="fund-card p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <h2 class="h6 fw-semibold text-dark mb-0">
                                    <i class="bi bi-pie-chart me-2"></i>
                                    Tổng quan tài sản
                                </h2>
                                <span class="text-muted xs">
                                    <i class="bi bi-clock me-1"></i>
                                    Cập nhật: <t t-esc="state.funds and state.funds.length > 0 ? state.funds[0].last_update : 'N/A'"/>
                                </span>
                            </div>
                            
                            <!-- Biểu đồ và Main values -->
                            <div class="row align-items-center mb-3">
                                <div class="col-md-4 text-center">
                                    <div class="chart-container mx-auto">
                                        <canvas id="assetOverviewChart"></canvas>
                                        <t t-if="state.chartError">
                                            <div class="chart-error text-muted small mt-2">
                                                <i class="bi bi-exclamation-triangle me-1"></i>
                                                Không thể tải biểu đồ
                                            </div>
                                        </t>
                                    </div>
                                </div>

                                <div class="col-md-8">
                                    <div class="d-flex flex-column gap-2">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <p class="text-muted small mb-0">Tổng giá trị thị trường</p>
                                            <p class="small fw-semibold text-dark mb-0"><t t-esc="this.formatCurrency(state.total_current_value)"/>đ</p>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <p class="text-muted small mb-0">Tổng GTĐT</p>
                                            <p class="small fw-semibold text-dark mb-0"><t t-esc="this.formatCurrency(state.total_investment)"/>đ</p>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <p class="text-muted small mb-0">Tổng lời/lỗ</p>
                                            <p t-attf-class="small fw-semibold #{state.total_profit_loss_percentage >= 0 ? 'profit-positive' : 'profit-negative'} mb-0">
                                                <t t-esc="this.formatProfit(state.total_profit_loss_percentage)"/>%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Thống kê chi tiết -->
                            <div class="mb-0">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h3 class="xs fw-semibold text-dark mb-0">
                                        <i class="bi bi-bar-chart me-2"></i>
                                        Thống kê chi tiết
                                    </h3>
                                    <a class="text-decoration-none text-primary xs" href="/asset-management">
                                        Xem tất cả <i class="bi bi-arrow-right ms-1"></i>
                                    </a>
                                </div>
                                <div class="d-flex flex-column gap-2">
                                    <t t-if="state.funds and state.funds.length > 0">
                                        <t t-foreach="state.funds" t-as="fund" t-key="fund.ticker">
                                            <div t-attf-class="stat-item-compact #{this.getNavClass(fund)}">
                                                <div class="d-flex align-items-center justify-content-between">
                                                    <div class="d-flex align-items-center gap-2">
                                                        <div t-attf-class="rounded-circle" t-attf-style="width: 8px; height: 8px; background-color: #{fund.color}"></div>
                                                        <span class="xs fw-medium"><t t-esc="fund.ticker"/></span>
                                                    </div>
                                                    <div class="text-end">
                                                        <span class="xs text-muted">NAV</span>
                                                        <span class="xs fw-semibold"><t t-esc="this.formatCurrency(fund.current_value / fund.total_units)"/>đ</span>
                                                    </div>
                                                </div>
                                                <p class="fw-semibold xs mb-0 mt-1"><t t-esc="this.formatCurrency(fund.current_value)"/>đ</p>
                                            </div>
                                        </t>
                                    </t>
                                    <t t-if="!state.funds or state.funds.length === 0">
                                        <div class="text-center text-muted py-2">
                                            <p class="mb-0 xs">Không có dữ liệu thống kê</p>
                                        </div>
                                    </t>
                                </div>
                            </div>
                        </article>

                        <!-- Giao dịch gần nhất -->
                        <article class="fund-card p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h2 class="small fw-semibold text-dark mb-0">
                                    <i class="bi bi-clock-history me-2"></i>
                                    Giao dịch gần nhất
                                </h2>
                                <a class="text-decoration-none text-primary xs" href="/transaction_management/pending">
                                    Xem tất cả <i class="bi bi-arrow-right ms-1"></i>
                                </a>
                            </div>
                            <div class="d-flex flex-column gap-2">
                                <t t-if="state.transactions and state.transactions.length > 0">
                                    <t t-foreach="state.transactions" t-as="trans" t-key="trans.date + trans.time">
                                        <div class="transaction-item-compact">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div class="d-flex gap-2">
                                                    <div class="d-flex flex-column text-muted xs" style="min-width: 70px;">
                                                        <span><t t-esc="trans.date"/></span>
                                                        <span><t t-esc="trans.time"/></span>
                                                    </div>
                                                    <div class="flex-grow-1">
                                                        <p class="text-dark fw-medium mb-0 xs">
                                                            <t t-esc="trans.description"/>
                                                        </p>
                                                        <p class="fw-semibold small mb-0 text-dark">
                                                            <t t-esc="this.formatCurrency(trans.amount)"/><t t-if="trans.is_units"> CCQ</t><t t-else=""> <t t-esc="trans.currency_symbol"/></t>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span t-attf-class="status-badge-sm #{(trans.status_raw === 'completed') ? 'status-completed' : (trans.status_raw === 'pending' ? 'status-pending' : 'status-failed')}">
                                                    <t t-esc="trans.status"/>
                                                </span>
                                            </div>
                                        </div>
                                    </t>
                                </t>
                                <t t-if="!state.transactions or state.transactions.length === 0">
                                    <div class="text-center text-muted py-3">
                                        <i class="bi bi-inbox text-muted mb-2" style="font-size: 1.5rem;"></i>
                                        <p class="mb-0 xs">Không có giao dịch nào</p>
                                    </div>
                                </t>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `;

  setup() {
    // Store previous NAV values for direction tracking
    this._previousNavs = {};
    this._navDirections = {};
    
    this.state = useState({
      funds: this.props.funds || [],
      transactions: this.props.transactions || [],
      total_investment: this.props.total_investment || 0,
      total_current_value: this.props.total_current_value || 0,
      total_profit_loss_percentage: this.props.total_profit_loss_percentage || 0,
      total_profit_loss: this.props.total_profit_loss || 0,
      chart_data: this.props.chart_data || '{}',
      chartError: false
    });

    // Initialize previous NAVs from initial data
    this._initPreviousNavs();

    // Debug: Log dữ liệu nhận được
    console.log('DEBUG: Widget received funds:', this.props.funds);
    console.log('DEBUG: Widget received transactions:', this.props.transactions);

    // Auto refresh interval (every 30 seconds)
    this._refreshInterval = null;

    onMounted(() => {
      this.initChart();
      this._startAutoRefresh();
    });
    
    onWillUnmount(() => {
      this._stopAutoRefresh();
    });
  }
  
  _initPreviousNavs() {
    if (this.state.funds && this.state.funds.length > 0) {
      for (const fund of this.state.funds) {
        const nav = fund.current_value / fund.total_units;
        this._previousNavs[fund.ticker] = nav;
        this._navDirections[fund.ticker] = 'neutral';
      }
    }
  }
  
  _startAutoRefresh() {
    // Refresh every 30 seconds
    this._refreshInterval = setInterval(() => {
      this._fetchLatestData();
    }, 30000);
  }
  
  _stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }
  
  async _fetchLatestData() {
    try {
      const response = await fetch('/api/overview/realtime-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (data && data.funds) {
        this._updateFundsWithDirection(data.funds);
      }
    } catch (e) {
      console.warn('[OverviewWidget] Failed to fetch realtime data:', e);
    }
  }
  
  _updateFundsWithDirection(newFunds) {
    for (const newFund of newFunds) {
      const currentNav = newFund.current_value / newFund.total_units;
      const previousNav = this._previousNavs[newFund.ticker] || currentNav;
      
      // Determine direction
      if (currentNav > previousNav) {
        this._navDirections[newFund.ticker] = 'up';
      } else if (currentNav < previousNav) {
        this._navDirections[newFund.ticker] = 'down';
      } else {
        this._navDirections[newFund.ticker] = 'neutral';
      }
      
      // Store new NAV as previous for next update
      this._previousNavs[newFund.ticker] = currentNav;
    }
    
    // Update state
    this.state.funds = newFunds;
    
    // Recalculate totals
    const totalCurrentValue = newFunds.reduce((sum, f) => sum + (f.current_value || 0), 0);
    const totalInvestment = newFunds.reduce((sum, f) => sum + (f.total_investment || 0), 0);
    const totalProfitLoss = totalCurrentValue - totalInvestment;
    const totalProfitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
    
    this.state.total_current_value = totalCurrentValue;
    this.state.total_investment = totalInvestment;
    this.state.total_profit_loss = totalProfitLoss;
    this.state.total_profit_loss_percentage = totalProfitLossPercentage;
  }
  
  getNavClass(fund) {
    const direction = this._navDirections[fund.ticker] || 'neutral';
    if (direction === 'down') return 'nav-flash-down';
    if (direction === 'up') return 'nav-flash-up';
    return '';
  }
  
  getValueClass(fund) {
    // Same logic as NAV - if NAV drops, value drops
    return this.getNavClass(fund);
  }
  
  formatProfit(value) {
    if (typeof value !== 'number') return '0.00';
    return value.toFixed(2);
  }

  async initChart() {
    try {
      await loadJS('https://cdn.jsdelivr.net/npm/chart.js');
      
      const ctx = document.getElementById('assetOverviewChart');
      if (!ctx) {
        console.warn('Chart canvas not found');
        this.state.chartError = true;
        return;
      }

      let chartData;
      try {
        chartData = JSON.parse(this.state.chart_data);
      } catch (e) {
        console.error('Error parsing chart data:', e);
        this.state.chartError = true;
        return;
      }

      // Kiểm tra dữ liệu chart có hợp lệ không
      if (!chartData.labels || !chartData.datasets || !chartData.datasets[0] || !chartData.datasets[0].data) {
        console.warn('Invalid chart data structure');
        this.state.chartError = true;
        return;
      }

      // Tạo chart với xử lý lỗi
      try {
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: chartData.labels,
            datasets: [{
              data: chartData.datasets[0].data,
              backgroundColor: chartData.datasets[0].backgroundColor || ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
                position: 'bottom',
                labels: {
                  boxWidth: 12,
                  padding: 15,
                  font: {
                    size: 12
                  }
                }
              }
            },
            cutout: '70%'
          }
        });
        console.log('Chart initialized successfully');
      } catch (chartError) {
        console.error('Error creating chart:', chartError);
        this.state.chartError = true;
      }
    } catch (error) {
      console.error('Error loading Chart.js:', error);
      this.state.chartError = true;
    }
  }

  formatCurrency(value) {
    if (typeof value !== 'number') {
      return value;
    }
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  }
}

// Make component available globally
window.OverviewFundManagementWidget = OverviewFundManagementWidget;

