/** @odoo-module **/

import { Component, xml, useState, onMounted } from "@odoo/owl";
import { loadJS } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

export class FundWidget extends Component {
    static template = xml`
        <div class="fund-dashboard h-100 d-flex flex-column gap-3">
          <div class="row g-2 h-100">
            <!-- Left Panel: Fund List -->
            <div class="col-lg-2 col-md-3 d-flex flex-column h-100">
              <div class="card border-0 shadow-sm flex-grow-1 overflow-hidden" style="border-radius: 12px; background: #fff; max-width: 280px;">
                <!-- Header -->
                <div class="card-header fm-header-box py-3 d-flex align-items-center justify-content-between">
                    <h6 class="mb-0 fw-bold text-dark small ls-1">Danh mục đầu tư</h6>
                    <span class="badge bg-light text-dark border rounded-pill small">
                      <t t-esc="this.getFilteredFunds().length || 0" />
                    </span>
                </div>

                <!-- Search -->
                <div class="p-2 bg-light border-bottom">
                  <div class="position-relative">
                    <input type="text"
                           class="form-control form-control-sm ps-4 border-0 shadow-sm"
                           placeholder="Tìm kiếm..."
                           t-att-value="state.searchTerm || ''"
                           t-on-input="(ev) => this.onSearchInput(ev)"
                           style="font-size: 0.85rem; background: #fff;"/>
                    <i class="fas fa-search position-absolute text-muted small"
                       style="left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
                    <t t-if="state.searchTerm">
                      <button type="button"
                              class="btn btn-sm btn-link position-absolute text-muted p-0"
                              t-on-click="() => this.clearSearch()"
                              style="right: 0.5rem; top: 50%; transform: translateY(-50%);">
                        <i class="fas fa-times small"></i>
                      </button>
                    </t>
                  </div>
                </div>

                <!-- List -->
                <div class="overflow-auto p-2 d-flex flex-column gap-2" style="height: calc(100vh - 180px);">
                    <t t-foreach="this.getFilteredFunds()" t-as="fund" t-key="fund.ticker">
                      <button type="button"
                              class="btn text-start p-0 w-100 border-0"
                              t-on-click="() => state.compareMode ? this.toggleCompareFund(fund) : this.selectFund(fund)">
                        <!-- Premium List Item -->
                        <div class="fm-list-item card shadow-none"
                             t-att-class="{
                               'active': state.selectedFund &amp;&amp; state.selectedFund.ticker === fund.ticker,
                               'fund-box-flash-up': state.flashBoxByTicker &amp;&amp; state.flashBoxByTicker[fund.ticker] === 'up',
                               'fund-box-flash-down': state.flashBoxByTicker &amp;&amp; state.flashBoxByTicker[fund.ticker] === 'down'
                             }"
                             t-att-style="(!state.selectedFund || state.selectedFund.ticker !== fund.ticker) ? 'border-left: 4px solid ' + this.getFundColor(fund) : ''">
                          <div class="card-body p-2">
                            <!-- Row 1: Ticker & Price -->
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="badge fw-bold shadow-sm" 
                                      style="min-width: 45px; font-size: 0.7rem;"
                                      t-att-style="'background-color: ' + this.getFundColor(fund) + '; color: white;'">
                                  <t t-esc="fund.ticker" />
                                </span>
                                <div class="fw-bold text-dark text-financial">
                                  <t t-esc="fund.current_nav ? (+fund.current_nav).toLocaleString('vi-VN') : '-'" />
                                </div>
                            </div>
                            
                            <!-- Row 2: Name -->
                            <div class="text-xs text-muted text-truncate mb-2" 
                                 style="font-size: 0.75rem; font-weight: 500;" 
                                 t-att-title="fund.name">
                              <t t-esc="fund.name" />
                            </div>

                            <!-- Row 3: Volume & Change -->
                            <div class="d-flex justify-content-between align-items-center border-top pt-2 mt-1 dashed-border">
                                <div class="text-xs text-secondary">
                                    <span class="text-muted opacity-75">Vol:</span> <t t-esc="(+ (fund.volume || 0)).toLocaleString('vi-VN')" />
                                </div>
                                <t t-if="fund.change !== undefined &amp;&amp; fund.change !== null">
                                  <div class="text-xs fw-bold"
                                       t-att-class="fund.change >= 0 ? 'text-success' : 'text-danger'">
                                    <t t-esc="fund.change >= 0 ? '+' : ''" />
                                    <t t-esc="(+fund.change_percent).toFixed(2)" />%
                                  </div>
                                </t>
                            </div>
                          </div>
                        </div>
                      </button>
                    </t>

                    <t t-if="this.getFilteredFunds().length === 0">
                      <div class="text-center py-5 text-muted opacity-50">
                        <i class="fas fa-layer-group fa-2x mb-2"></i>
                        <p class="mb-0 small">Không tìm thấy quỹ</p>
                      </div>
                    </t>
                </div>
              </div>
            </div>

            <!-- Right Panel: Detail -->
            <div class="col-lg-10 col-md-9 h-100">
              <div class="card border-0 shadow-sm h-100 overflow-hidden" style="border-radius: 12px;">
                <div class="card-body d-flex flex-column h-100 p-0">
                  
                  <!-- Top Bar: Info & Actions -->
                  <div class="p-3 fm-header-box">
                      <!-- Title Section -->
                      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div class="d-flex align-items-center gap-3">
                             <div t-if="state.selectedFund" 
                                  class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm hover-lift"
                                  t-att-style="'width: 48px; height: 48px; background-color: ' + this.getFundColor(state.selectedFund)">
                                <t t-esc="state.selectedFund.ticker?.substring(0, 3)" />
                             </div>
                             <div>
                                 <div class="d-flex align-items-center gap-2">
                                     <h5 class="mb-0 fw-bold text-dark"><t t-esc="state.selectedFund?.ticker || '---'" /></h5>
                                     <span class="text-muted small">|</span>
                                     <span class="text-dark fw-medium text-truncate" style="max-width: 350px;">
                                        <t t-esc="state.selectedFund?.name || 'Chọn Quỹ để xem chi tiết'" />
                                     </span>
                                 </div>
                                 <div class="text-muted small mt-1 d-flex align-items-center gap-3">
                                    <span class="text-financial">NAV: <strong class="text-dark fs-6"><t t-esc="state.selectedFund?.current_nav ? (+state.selectedFund.current_nav).toLocaleString('vi-VN') : '-'" /></strong></span>
                                    <t t-if="state.selectedFund &amp;&amp; state.selectedFund.change_percent !== undefined">
                                        <span class="badge rounded-pill" t-att-class="state.selectedFund.change >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">
                                            <i t-att-class="state.selectedFund.change >= 0 ? 'fas fa-arrow-up me-1' : 'fas fa-arrow-down me-1'"></i>
                                            <t t-esc="Math.abs(+state.selectedFund.change_percent).toFixed(2)" />%
                                        </span>
                                    </t>
                                 </div>
                             </div>
                        </div>
                        
                        <!-- Right: Actions -->
                        <div class="d-flex gap-2">
                             <button class="btn btn-sm fm-btn-white px-3"
                                     title="So sánh"
                                     t-on-click="() => this.toggleCompareMode()">
                                <i class="fas fa-exchange-alt me-1"></i> So sánh
                             </button>
                             <button class="btn btn-sm fm-btn-buy px-3 fw-bold"
                                     t-on-click="() => goToBuyFund(state.selectedFund)">
                                MUA
                             </button>
                             <button class="btn btn-sm fm-btn-sell px-3 fw-bold"
                                     t-on-click="() => goToSellFund(state.selectedFund)">
                                BÁN
                             </button>
                        </div>
                      </div>
                  </div>

                  <!-- Content Scrollable Area -->
                  <div class="flex-grow-1 overflow-auto bg-light p-3 position-relative" style="background-color: transparent;">
                      <!-- Stats Cards Row (Glassmorphism Effect) -->
                      <!-- Stats Cards Row (Glassmorphism Effect) -->
                      <div class="row g-2 mb-3">
                         <!-- Current Price Box -->
                         <div class="col-6 col-md-3">
                            <div class="p-3 bg-white rounded-3 shadow-sm border h-100 hover-lift transition-all glass-effect"
                                 t-att-class="{
                                   'fund-box-flash-up': state.selectedFund &amp;&amp; state.flashCurrent === 'up',
                                   'fund-box-flash-down': state.selectedFund &amp;&amp; state.flashCurrent === 'down'
                                 }">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <i class="fas fa-coins text-secondary opacity-50"></i>
                                    <span class="text-secondary text-xs fw-semibold">Giá trị hiện tại</span>
                                </div>
                                <div class="fw-bold fs-5 text-financial"
                                     t-att-class="this.getPriceColorClass(
                                        state.selectedFund?.current_nav,
                                        state.selectedFund?.reference_price,
                                        state.selectedFund?.ceiling_price,
                                        state.selectedFund?.floor_price
                                     )">
                                    <t t-esc="state.selectedFund?.current_nav ? (+state.selectedFund.current_nav).toLocaleString('vi-VN') : '-'" />
                                </div>
                            </div>
                         </div>
                         <!-- Open Price Box -->
                         <div class="col-6 col-md-3">
                            <div class="p-3 bg-white rounded-3 shadow-sm border h-100 hover-lift transition-all glass-effect"
                                 t-att-class="{
                                   'fund-box-flash-up': state.selectedFund &amp;&amp; state.flashOpen === 'up',
                                   'fund-box-flash-down': state.selectedFund &amp;&amp; state.flashOpen === 'down'
                                 }">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <i class="fas fa-door-open text-secondary opacity-50"></i>
                                    <span class="text-secondary text-xs fw-semibold">Giá mở cửa</span>
                                </div>
                                <div class="fw-bold fs-5 text-financial"
                                     t-att-class="this.getPriceColorClass(
                                        state.selectedFund?.open_price,
                                        state.selectedFund?.reference_price,
                                        state.selectedFund?.ceiling_price,
                                        state.selectedFund?.floor_price
                                     )">
                                    <t t-esc="state.selectedFund?.open_price ? (+state.selectedFund.open_price).toLocaleString('vi-VN') : '-'" />
                                </div>
                            </div>
                         </div>
                         <!-- High Price Box -->
                         <div class="col-6 col-md-3">
                            <div class="p-3 bg-white rounded-3 shadow-sm border h-100 hover-lift transition-all glass-effect"
                                 t-att-class="{
                                   'fund-box-flash-up': state.selectedFund &amp;&amp; state.flashHigh === 'up',
                                   'fund-box-flash-down': state.selectedFund &amp;&amp; state.flashHigh === 'down'
                                 }">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <i class="fas fa-arrow-up text-secondary opacity-50"></i>
                                    <span class="text-secondary text-xs fw-semibold">Cao nhất</span>
                                </div>
                                <div class="fw-bold fs-5 text-financial"
                                      t-att-class="this.getPriceColorClass(
                                        state.selectedFund?.high_price,
                                        state.selectedFund?.reference_price,
                                        state.selectedFund?.ceiling_price,
                                        state.selectedFund?.floor_price
                                     )">
                                    <t t-esc="state.selectedFund?.high_price ? (+state.selectedFund.high_price).toLocaleString('vi-VN') : '-'" />
                                </div>
                            </div>
                         </div>
                         <!-- Low Price Box -->
                         <div class="col-6 col-md-3">
                            <div class="p-3 bg-white rounded-3 shadow-sm border h-100 hover-lift transition-all glass-effect"
                                 t-att-class="{
                                   'fund-box-flash-up': state.selectedFund &amp;&amp; state.flashLow === 'up',
                                   'fund-box-flash-down': state.selectedFund &amp;&amp; state.flashLow === 'down'
                                 }">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <i class="fas fa-arrow-down text-secondary opacity-50"></i>
                                    <span class="text-secondary text-xs fw-semibold">Thấp nhất</span>
                                </div>
                                <div class="fw-bold fs-5 text-financial"
                                     t-att-class="this.getPriceColorClass(
                                        state.selectedFund?.low_price,
                                        state.selectedFund?.reference_price,
                                        state.selectedFund?.ceiling_price,
                                        state.selectedFund?.floor_price
                                     )">
                                    <t t-esc="state.selectedFund?.low_price ? (+state.selectedFund.low_price).toLocaleString('vi-VN') : '-'" />
                                </div>
                            </div>
                         </div>
                      </div>

                      <!-- Main Chart Panel -->
                      <div class="bg-white border rounded-3 shadow-sm overflow-hidden d-flex flex-column" style="min-height: 500px; flex: 1;">
                         <!-- Chart Toolbar -->
                         <div class="border-bottom p-2 d-flex align-items-center justify-content-between bg-white">
                            <div class="d-flex align-items-center gap-2">
                                 <!-- Interval -->
                                 <div class="d-flex bg-light rounded-pill p-1 border">
                                    <t t-foreach="['1\'','5\'','15','30\'','45\'','1h']" t-as="intv" t-key="intv">
                                        <button type="button" 
                                                class="btn btn-sm border-0 fm-btn-interval"
                                                t-att-class="state.interval === intv ? 'active' : ''"
                                                t-on-click="() => this.setInterval(intv)"
                                                 t-att-disabled="state.isChartLoading">
                                            <t t-esc="intv"/>
                                        </button>
                                    </t>
                                 </div>
                                 
                                 <div class="vr mx-2 opacity-25"></div>
                                 
                                 <!-- Chart Type -->
                                 <div class="btn-group btn-group-sm">
                                    <button class="btn btn-link text-decoration-none px-2"
                                            t-att-class="state.chartStyle === 'candles' ? 'text-primary' : 'text-muted opacity-50'"
                                            t-on-click="() => this.setChartStyle('candles')">
                                        <i class="fas fa-chart-bar fs-6"></i>
                                    </button>
                                    <button class="btn btn-link text-decoration-none px-2"
                                            t-att-class="state.chartStyle === 'line' ? 'text-primary' : 'text-muted opacity-50'"
                                            t-on-click="() => this.setChartStyle('line')">
                                        <i class="fas fa-chart-line fs-6"></i>
                                    </button>
                                 </div>
                            </div>

                            <!-- OHLC Info on Toolbar -->
                            <div id="ohlcToolbarInfo" class="d-flex align-items-center gap-3 ms-4 flex-grow-1" style="font-size: 11px; color: #64748b;">
                            </div>

                            <div class="d-flex align-items-center gap-2">
                                <t t-if="state.compareFunds &amp;&amp; state.compareFunds.length &gt; 0">
                                    <div class="d-flex gap-1">
                                        <t t-foreach="state.compareFunds" t-as="cf" t-key="cf.ticker">
                                            <span class="badge fm-badge-compare d-flex align-items-center gap-1 rounded-pill ps-2 pe-1 py-1">
                                                <t t-esc="cf.ticker"/>
                                                <i class="fas fa-times-circle cursor-pointer opacity-50 hover-opacity-100" t-on-click="() => this.removeCompareFund(cf)"></i>
                                            </span>
                                        </t>
                                    </div>
                                </t>
                             </div>
                         </div>
                         
                         <!-- Chart Canvas -->
                         <div class="flex-grow-1 position-relative bg-dark" style="height: 420px; overflow: hidden;">
                            <div id="candleContainer" class="w-100 h-100" style="height: 100%;"></div>

                             <!-- Loading Overlay -->
                             <div t-if="state.isChartLoading" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-25" style="z-index: 10; backdrop-filter: blur(1px);">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                             </div>

                             <!-- Error Overlay -->
                             <div t-if="state.chartError" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50" style="z-index: 11;">
                                <div class="text-center p-3 bg-white rounded shadow-lg mx-3" style="max-width: 300px;">
                                    <i class="fas fa-exclamation-triangle text-warning mb-2 fs-3"></i>
                                    <p class="text-dark small mb-2"><t t-esc="state.chartError"/></p>
                                    <button class="btn btn-sm btn-outline-primary" t-on-click="() => this.loadCandleData(state.selectedFund?.ticker, state.interval)">Thử lại</button>
                                </div>
                             </div>
                            
                            <!-- Simple overlay controls -->
                            <div class="position-absolute bottom-0 start-0 m-3 d-flex gap-1 pointer-events-none">
                                 <button class="btn btn-sm btn-dark bg-opacity-50 border-0 text-white shadow-none pointer-events-auto rounded-circle d-flex align-items-center justify-content-center"
                                         style="width: 32px; height: 32px; backdrop-filter: blur(4px);"
                                         t-on-click="() => this.resetChartView()"
                                         title="Reset View">
                                    <i class="fas fa-redo-alt fa-xs"></i>
                                 </button>
                            </div>
                         </div>
                      </div>
                      
                      <!-- Description (Bottom) -->
                      <div class="mt-3 p-3 bg-white rounded-3 border">
                         <h6 class="text-xs fw-bold text-muted mb-2">Giới thiệu quỹ</h6>
                         <p class="mb-0 text-muted small" style="line-height: 1.6;">
                            <t t-esc="state.selectedFund?.description || 'Chưa có thông tin mô tả cho quỹ này.'" />
                         </p>
                      </div>

                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
    `;

    setup() {
        console.log("🎯 FundWidget - setup called!");

        this.state = useState({
            loading: true,
            funds: [],
            selectedFund: null,
            activeRange: '1M',
            compareFunds: [],   // 👈 THÊM DÒNG NÀY
            compareMode: false,   // 👈 Thêm dòng này
            candleRange: '5\'',
            interval: '5\'',      // Chart interval (1', 5', 15, 30', 45', 1h)
            chartStyle: 'candles', // Chart style (candles, line)
            flashByTicker: {},           // flash cho giá hiện tại của selectedFund
            flashPriceByTicker: {},      // flash theo ticker cho cột GIÁ
            flashVolumeByTicker: {},     // flash theo ticker cho cột KL
            flashBoxByTicker: {},        // flash animation cho box khi có biến động
            flashCurrent: null,          // 'up' | 'down' cho OHLC selected detail
            flashOpen: null,
            flashHigh: null,
            flashLow: null,
            searchTerm: '',              // Search term for filtering funds
            isChartLoading: false,      // Loading state for chart data
            chartError: null,           // Error message for chart
        });

        // Khởi tạo mảng lưu area series cho so sánh
        this.compareAreaSeries = [];

        // Bus service (fallback interval nếu không có)
        try {
            this.bus = useService?.('bus_service');
        } catch (e) {
            this.bus = null;
        }

        this.state.activeRange = '1M';  // mặc định

        onMounted(async () => {
            // Load Lightweight Charts (high-performance OHLC)
            console.log('📚 Loading LightweightCharts library...');
            try {
                await loadJS("https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.5/dist/lightweight-charts.standalone.production.js");
                console.log('✅ LightweightCharts library loaded successfully');
                // Đảm bảo library được gán vào window
                if (window.LightweightCharts) {
                    console.log('✅ window.LightweightCharts is available');
                } else {
                    console.warn('⚠️ window.LightweightCharts not found after loadJS');
                }
            } catch (e) {
                console.error('❌ Lightweight Charts load failed', e);
            }

            try {
                const response = await fetch('/data_fund');
                const data = await response.json();
                console.log("📥 Fund data:", data);
                this.state.funds = data;
            } catch (error) {
                console.error("❌ Error fetching funds:", error);
            } finally {
                this.state.loading = false;
            }
            // Start realtime updates via bus if available
            try {
                if (this.bus && typeof this.bus.addEventListener === 'function') {
                    // Subscribe to stock_data_live channel (Odoo 18 bus)
                    this.bus.addChannel('stock_data_live');
                    this.bus.start();

                    this.bus.addEventListener('notification', ({ detail }) => {
                        const notifs = detail || [];
                        // Check for stock_data/price_update notification
                        const hasPriceUpdate = notifs.some((n) => (n.type === 'stock_data/price_update'));
                        if (hasPriceUpdate) {
                            // console.log('⚡ Realtime Update Received, refreshing funds...');
                            this.refreshFunds();
                        }
                    });
                } else {
                    // Fallback: poll every 5s (same as stock_data)
                    console.log('📡 Using polling fallback for realtime updates (5s)');
                    this._pollId = setInterval(() => this.refreshFunds(), 5000);
                }
            } catch (e) {
                console.warn('⚠️ Bus init failed, fallback to polling', e);
                this._pollId = setInterval(() => this.refreshFunds(), 5000);
            }

            // Auto-select first fund và load chart sau khi data đã load
            if (this.state.funds && this.state.funds.length > 0) {
                console.log('✅ Auto-selecting first fund:', this.state.funds[0]);
                // Đợi một chút để đảm bảo DOM đã render
                setTimeout(() => {
                    this.selectFund(this.state.funds[0]);
                }, 500);
            }
        });
    }

    // Thêm hàm này để khi click fund thì cập nhật state.selectedFund
    selectFund(fund) {
        console.log("✅ Selected Fund:", fund);
        this.state.selectedFund = fund;

        const navHistory = fund.nav_history_json
            ? JSON.parse(fund.nav_history_json)
            : [];

        const labels = navHistory.map(entry => {
            const d = new Date(entry.date);
            return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });

        const values = navHistory.map(entry => entry.value);

        // NAV/Unit chart removed; skip drawing
        // Load candlestick for current ticker
        if (fund && fund.ticker) {
            this.state.candleRange = this.state.candleRange || '1H';
            console.log(`📊 [selectFund] Loading candle data for ticker: ${fund.ticker}, range: ${this.state.candleRange}`);
            // Đợi một chút để đảm bảo DOM đã render và LightweightCharts đã load
            setTimeout(async () => {
                await this.loadCandleData(fund.ticker, this.state.candleRange);
            }, 300);
        } else {
            console.warn('⚠️ [selectFund] Fund or ticker is missing:', fund);
        }


    }

    // Search methods
    getFilteredFunds() {
        if (!this.state.searchTerm || this.state.searchTerm.trim() === '') {
            return this.state.funds || [];
        }

        const searchTerm = this.state.searchTerm.toLowerCase().trim();
        return (this.state.funds || []).filter(fund => {
            const ticker = (fund.ticker || '').toLowerCase();
            const name = (fund.name || '').toLowerCase();
            return ticker.includes(searchTerm) || name.includes(searchTerm);
        });
    }

    onSearchInput(ev) {
        // Update search term from input value
        this.state.searchTerm = ev.target.value || '';
    }

    clearSearch() {
        this.state.searchTerm = '';
    }

    drawCharts() {
        this.drawNavLineChart();  // <--- gọi hàm riêng này
    }

    goToStockPage(fund) {
        console.log("Redirecting to stock page for fund:", fund);
        window.location.href = "/stock_widget";
    }

    goToBuyFund(fund) {
        if (fund) {
            sessionStorage.setItem('selectedTicker', fund.ticker);
        } else {
            sessionStorage.removeItem('selectedTicker'); // hoặc bỏ dòng này nếu muốn giữ nguyên session cũ
        }
        window.location.href = "/fund_buy";
    }

    goToSellFund(fund) {
        console.log("Redirecting to sell fund:", fund);
        window.location.href = "/fund_sell";
    }

    drawNavLineChart(labels = [], values = []) {
        const navCtx = document.getElementById('navLineChart');

        if (window.Chart && navCtx) {
            if (this.navChartInstance) {
                this.navChartInstance.destroy();  // Xoá biểu đồ cũ
            }

            this.navChartInstance = new Chart(navCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'NAV/Unit (VND)',
                        data: values,
                        borderColor: '#dc3545', // đỏ đậm giống header
                        backgroundColor: 'rgba(220, 53, 69, 0.1)', // đỏ nhạt có độ trong suốt
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    }]
                },

                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Biến động NAV/Unit theo thời gian'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: (value) => value.toLocaleString('vi-VN') + '₫'
                            }
                        }
                    }
                }
            });
        } else {
            console.warn("⚠️ Chart.js hoặc canvas chưa sẵn sàng!");
        }
    }

    async refreshFunds() {
        try {
            const prevByTicker = {};
            (this.state.funds || []).forEach(f => { prevByTicker[f.ticker] = f; });

            const res = await fetch('/data_fund');
            const data = await res.json();
            this.state.funds = data;

            // detect changes to flash
            const flashMap = this.state.flashByTicker || {};
            const priceFlash = this.state.flashPriceByTicker || {};
            const volFlash = this.state.flashVolumeByTicker || {};
            const boxFlash = this.state.flashBoxByTicker || {};
            data.forEach(f => {
                const prev = prevByTicker[f.ticker];
                if (!prev) return;
                const prevVal = Number(prev.current_nav || 0);
                const currVal = Number(f.current_nav || 0);
                const hasPriceChange = currVal !== prevVal;

                if (currVal > prevVal) {
                    flashMap[f.ticker] = 'up';
                    priceFlash[f.ticker] = 'up';
                    if (hasPriceChange) boxFlash[f.ticker] = 'up';
                } else if (currVal < prevVal) {
                    flashMap[f.ticker] = 'down';
                    priceFlash[f.ticker] = 'down';
                    if (hasPriceChange) boxFlash[f.ticker] = 'down';
                }

                // Volume direction
                const pVol = Number(prev.volume || 0);
                const cVol = Number(f.volume || 0);
                const hasVolumeChange = cVol !== pVol;

                if (cVol > pVol) {
                    volFlash[f.ticker] = 'up';
                    // Trigger box flash nếu chưa có (ưu tiên price change)
                    if (!boxFlash[f.ticker] && hasVolumeChange) {
                        boxFlash[f.ticker] = 'up';
                    }
                } else if (cVol < pVol) {
                    volFlash[f.ticker] = 'down';
                    // Trigger box flash nếu chưa có (ưu tiên price change)
                    if (!boxFlash[f.ticker] && hasVolumeChange) {
                        boxFlash[f.ticker] = 'down';
                    }
                }

                // Clear flash after animation
                if (flashMap[f.ticker]) {
                    const ticker = f.ticker;
                    setTimeout(() => {
                        if (this.state.flashByTicker && this.state.flashByTicker[ticker]) {
                            delete this.state.flashByTicker[ticker];
                        }
                    }, 1000);
                }
                if (priceFlash[f.ticker]) {
                    const t = f.ticker;
                    setTimeout(() => {
                        if (this.state.flashPriceByTicker && this.state.flashPriceByTicker[t]) {
                            delete this.state.flashPriceByTicker[t];
                        }
                    }, 800);
                }
                if (volFlash[f.ticker]) {
                    const t = f.ticker;
                    setTimeout(() => {
                        if (this.state.flashVolumeByTicker && this.state.flashVolumeByTicker[t]) {
                            delete this.state.flashVolumeByTicker[t];
                        }
                    }, 800);
                }
                // Clear box flash after animation
                if (boxFlash[f.ticker]) {
                    const t = f.ticker;
                    setTimeout(() => {
                        if (this.state.flashBoxByTicker && this.state.flashBoxByTicker[t]) {
                            delete this.state.flashBoxByTicker[t];
                        }
                    }, 1200);
                }
            });
            this.state.flashByTicker = flashMap;
            this.state.flashPriceByTicker = priceFlash;
            this.state.flashVolumeByTicker = volFlash;
            this.state.flashBoxByTicker = boxFlash;
            // Nếu đang chọn quỹ, cập nhật lại theo id
            if (this.state.selectedFund) {
                const updated = data.find(f => f.id === this.state.selectedFund.id);
                if (updated) {
                    const prev = this.state.selectedFund;

                    // --- DETECT CHANGES FOR OHLC FLASH ---
                    const pCurrent = Number(prev.current_nav || 0);
                    const cCurrent = Number(updated.current_nav || 0);
                    if (cCurrent > pCurrent) this.state.flashCurrent = 'up';
                    else if (cCurrent < pCurrent) this.state.flashCurrent = 'down';

                    const pOpen = Number(prev.open_price || 0);
                    const cOpen = Number(updated.open_price || 0);
                    if (cOpen > pOpen) this.state.flashOpen = 'up';
                    else if (cOpen < pOpen) this.state.flashOpen = 'down';

                    const pHigh = Number(prev.high_price || 0);
                    const cHigh = Number(updated.high_price || 0);
                    if (cHigh > pHigh) this.state.flashHigh = 'up';
                    else if (cHigh < pHigh) this.state.flashHigh = 'down';

                    const pLow = Number(prev.low_price || 0);
                    const cLow = Number(updated.low_price || 0);
                    if (cLow > pLow) this.state.flashLow = 'up';
                    else if (cLow < pLow) this.state.flashLow = 'down';

                    // Clear flash
                    setTimeout(() => {
                        this.state.flashCurrent = null;
                        this.state.flashOpen = null;
                        this.state.flashHigh = null;
                        this.state.flashLow = null;
                    }, 1000);

                    this.state.selectedFund = updated;
                }
            }
        } catch (e) {
            console.warn('Refresh funds failed', e);
        }
    }

    getPriceColorClass(price, refPrice, ceiling, floor) {
        if (!price || !refPrice) return '';
        price = Number(price);
        refPrice = Number(refPrice);
        ceiling = Number(ceiling || 0);
        floor = Number(floor || 0);

        if (ceiling > 0 && price >= ceiling) return 'text-purple'; // Ceiling
        if (floor > 0 && price <= floor) return 'text-cyan';      // Floor
        if (price === refPrice) return 'text-warning';            // Ref
        if (price > refPrice) return 'text-success';              // Up
        return 'text-danger';                                     // Down
    }

    getFundColor(fund) {
        // Ưu tiên màu từ model fund (field `color`), sau đó mới tới `fund_color` nếu có
        if (fund && typeof fund.color === 'string' && fund.color.trim()) {
            return fund.color.trim();
        }
        if (fund && typeof fund.fund_color === 'string' && fund.fund_color.trim()) {
            return fund.fund_color.trim();
        }
        return this._colorFromTicker(fund && fund.ticker);
    }

    _colorFromTicker(ticker) {
        // Deterministic HSL based on ticker
        const str = (ticker || '').toString();
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        const hue = Math.abs(hash) % 360;
        const sat = 70; //%
        const light = 45; //%
        return `hsl(${hue} ${sat}% ${light}%)`;
    }

    async loadCandleData(ticker, range, silent = false) {
        try {
            if (!silent) console.log(`📊 [loadCandleData] Loading candle data for ticker: ${ticker}, range: ${range}`);

            // Define intraday ranges
            const intradayRanges = ["1'", "5'", "15", "30'", "45'", "1h"];
            // Kiểm tra xem có phải intraday range không
            const isIntraday = intradayRanges.includes(range);


            // Concurrency guard: avoid overlapping fetches
            const fetchId = Date.now();
            this._lastFetchId = fetchId;

            if (!silent) {
                this.state.isChartLoading = true;
                this.state.chartError = null;
            }

            let payload;
            if (isIntraday) {
                // Gọi API intraday OHLC
                const resolutionMap = {
                    '1\'': 1,
                    '5\'': 5,
                    '15': 15,
                    '30\'': 30,
                    '45\'': 45,
                    '1h': 60,
                };
                // Always fetch raw 1-minute data to get the full day's picture
                // Then aggregate on client side for the requested range
                const fetchResolution = 1;

                // Helper: Tính ngày trước đó (skip weekend đơn giản)
                const getPreviousDate = (dateStr) => {
                    const d = new Date(dateStr);
                    d.setDate(d.getDate() - 1);
                    // Nếu lùi vào T7 (6) hoặc CN (0) thì lùi tiếp
                    if (d.getDay() === 0) d.setDate(d.getDate() - 2); // CN -> T6
                    if (d.getDay() === 6) d.setDate(d.getDate() - 1); // T7 -> T6
                    return d.toISOString().split('T')[0];
                };

                // Use local date instead of UTC to avoid "next day" issues at night
                const now = new Date();
                let attemptDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                // Helper func to fetch
                const fetchIntraday = async (date) => {
                    const qs = new URLSearchParams({ symbol: ticker, resolution: fetchResolution, date: date }).toString();
                    const url = `/stock_data/api/intraday_ohlc?${qs}`;
                    console.log(`🔗 [loadCandleData] Calling intraday API: ${url}`);
                    const res = await fetch(url);
                    if (!res.ok) return null;
                    return await res.json();
                };

                payload = await fetchIntraday(attemptDate);
                let items = (payload && payload.status === 'Success') ? payload.data : [];

                // Retry previous day if empty
                if (!items || items.length === 0) {
                    const prevDate = getPreviousDate(attemptDate);
                    console.warn(`⚠️ [loadCandleData] No data for ${attemptDate}, retrying with ${prevDate}`);
                    const payloadPrev = await fetchIntraday(prevDate);
                    if (payloadPrev && payloadPrev.status === 'Success' && payloadPrev.data && payloadPrev.data.length > 0) {
                        payload = payloadPrev;
                        items = payloadPrev.data;
                        attemptDate = prevDate; // Update effective date
                        console.log(`✅ [loadCandleData] Found data for previous date: ${prevDate}`);
                    }
                }

                if (payload && payload.status === 'Success') {
                    if (!items || items.length === 0) {
                        console.warn(`⚠️ [loadCandleData] No intraday data for ticker ${ticker}`);
                        await this.drawCandleChart([]);
                        return;
                    }

                    // Lưu ngày giao dịch hiện tại
                    this._intradayTradingDate = payload.date || attemptDate;

                    // Aggregate raw 1-min data to target resolution
                    const targetResolution = resolutionMap[range] || 5;
                    const aggregatedItems = this._aggregateIntradayCandles(items, targetResolution);
                    console.log(`✅ [loadCandleData] Aggregated ${items.length} raw items -> ${aggregatedItems.length} items (res=${targetResolution})`);

                    // Transform intraday data format để tương thích với drawCandleChart
                    const transformedItems = aggregatedItems.map(item => {
                        const timestamp = this._resolveIntradayTimestamp(item, this._intradayTradingDate);
                        return {
                            t: timestamp,
                            timeStr: item.time || null,
                            o: parseFloat(item.open || 0) || 0,
                            h: parseFloat(item.high || 0) || 0,
                            l: parseFloat(item.low || 0) || 0,
                            c: parseFloat(item.close || 0) || 0,
                            v: parseFloat(item.volume || 0) || 0,
                        };
                    }).filter(item => item.t > 0 && (item.o > 0 || item.c > 0));

                    console.log(`✅ [loadCandleData] Transformed ${transformedItems.length} valid items`);

                    if (transformedItems.length === 0) {
                        console.warn(`⚠️ [loadCandleData] No valid transformed items`);
                        await this.drawCandleChart([]);
                        return;
                    }

                    this._isIntraday = true;
                    await this.drawCandleChart(transformedItems);
                    if (!silent) this.startRealtime(transformedItems);
                } else {
                    console.error(`❌ [loadCandleData] API returned error:`, payload);
                    await this.drawCandleChart([]);
                }
            } else {
                // Gọi API OHLC thông thường (legacy)
                const { fromDate, toDate } = this._computeDateRange(range);
                const qs = new URLSearchParams({ ticker, range, fromDate, toDate }).toString();
                const url = `/fund_ohlc?${qs}`;
                console.log(`🔗 [loadCandleData] Calling legacy API: ${url}`);

                const res = await fetch(url);
                payload = await res.json();

                if (payload && payload.status === 'Success') {
                    const items = payload.data || [];
                    console.log(`✅ [loadCandleData] Got ${items.length} legacy items`);
                    // Xác định intraday hay daily dựa vào kiểu của trường t
                    this._isIntraday = Array.isArray(items) && items.length > 0 && typeof items[0].t === 'number';
                    await this.drawCandleChart(items);
                    // Start or restart simulated realtime updates based on latest data
                    this.startRealtime(items);
                } else {
                    console.error(`❌ [loadCandleData] Legacy API returned error:`, payload);
                }
            }

            // Check if this fetch is still the latest one
            if (this._lastFetchId !== fetchId) {
                console.log(`⏭️ [loadCandleData] Ignoring outdated fetch result (ID: ${fetchId})`);
                return;
            }

            if (!silent) {
                this.state.isChartLoading = false;
            }
        } catch (e) {
            console.error('❌ [loadCandleData] Load candle data failed:', e);
            if (!silent) {
                this.state.chartError = e.message || 'Lỗi khi tải dữ liệu biểu đồ';
                this.state.isChartLoading = false;
            }
        }
    }

    _parseTimeToTimestamp(timeStr) {
        // Parse time string (HH:mm hoặc HH:mm:ss) thành unix timestamp
        // Giả sử time là trong ngày hôm nay
        if (!timeStr) return Math.floor(Date.now() / 1000);

        try {
            const today = new Date();
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0] || 0, 10);
            const minutes = parseInt(parts[1] || 0, 10);
            const seconds = parseInt(parts[2] || 0, 10);

            // Tạo date object cho ngày hôm nay với giờ phút giây từ timeStr
            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
            return Math.floor(date.getTime() / 1000);
        } catch (e) {
            console.warn('Failed to parse time:', timeStr, e);
            return Math.floor(Date.now() / 1000);
        }
    }

    _resolveIntradayTimestamp(item, tradingDate) {
        // Ưu tiên kết hợp date và time string để tránh lệch múi giờ UTC
        const dateStr = tradingDate || this._intradayTradingDate;
        if (dateStr && (item.time || item.timeStr)) {
            return this._combineDateAndTime(dateStr, item.time || item.timeStr);
        }

        if (item && item.datetime) {
            const dt = new Date(item.datetime);
            if (!isNaN(dt.getTime())) {
                return Math.floor(dt.getTime() / 1000);
            }
        }

        if (item && typeof item.timestamp === 'number') {
            return item.timestamp;
        }

        return 0;
    }

    _combineDateAndTime(dateStr, timeStr) {
        try {
            if (!dateStr) {
                return this._parseTimeToTimestamp(timeStr);
            }
            const [year, month, day] = dateStr.split('-').map(Number);
            if (!timeStr) {
                return Math.floor(new Date(year, (month || 1) - 1, day || 1).getTime() / 1000);
            }
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0] || 0, 10);
            const minutes = parseInt(parts[1] || 0, 10);
            const seconds = parseInt(parts[2] || 0, 10);
            const dt = Date.UTC(year, (month || 1) - 1, day || 1, hours, minutes, seconds);
            return Math.floor(dt / 1000);
        } catch (error) {
            console.warn('⚠️ [_combineDateAndTime] Failed to build timestamp', { dateStr, timeStr, error });
            return this._parseTimeToTimestamp(timeStr);
        }
    }

    _aggregateIntradayCandles(baseItems, resolutionMinutes) {
        try {
            if (!Array.isArray(baseItems) || baseItems.length === 0 || !resolutionMinutes || resolutionMinutes <= 1) {
                return baseItems || [];
            }
            const bucketSize = resolutionMinutes * 60; // seconds
            const buckets = new Map();

            baseItems.forEach(item => {
                const ts = typeof item.timestamp === 'number'
                    ? item.timestamp
                    : this._resolveIntradayTimestamp(item, this._intradayTradingDate);
                if (!ts || !isFinite(ts)) return;
                const bucketKey = Math.floor(ts / bucketSize) * bucketSize;
                const existing = buckets.get(bucketKey);
                const open = parseFloat(item.open || 0) || 0;
                const high = parseFloat(item.high || 0) || 0;
                const low = parseFloat(item.low || 0) || 0;
                const close = parseFloat(item.close || 0) || 0;
                const volume = parseFloat(item.volume || 0) || 0;
                if (!existing) {
                    buckets.set(bucketKey, {
                        time: item.time,
                        timestamp: bucketKey,
                        datetime: new Date(bucketKey * 1000).toISOString(),
                        open,
                        high,
                        low,
                        close,
                        volume,
                        resolution: resolutionMinutes,
                    });
                } else {
                    existing.high = Math.max(existing.high, high);
                    existing.low = existing.low === 0 ? low : Math.min(existing.low, low);
                    existing.close = close;
                    existing.volume += volume;
                }
            });

            return Array.from(buckets.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, v]) => v);
        } catch (e) {
            console.error('❌ [_aggregateIntradayCandles] Failed to aggregate intraday candles:', e);
            return baseItems || [];
        }
    }

    // Chuyển đổi interval hiển thị trên chart (5M, 10M, 30M, 1D)
    setInterval(interval) {
        console.log('📊 [setInterval] Changing interval to:', interval);
        this.state.interval = interval;
        this.state.candleRange = interval;

        // Đánh dấu đang ở chế độ intraday nếu range là trong ngày
        const intradayRanges = ['1\'', '5\'', '15', '30\'', '45\'', '1h'];
        this._isIntraday = intradayRanges.includes(interval);

        // Nếu đang ở chế độ so sánh, vẽ lại so sánh với range mới
        if (this.state.compareMode && this.state.compareFunds.length > 0) {
            this.compareSelectedFunds();
        } else {
            // Nếu không, load candlestick cho fund đang chọn
            const fund = this.state.selectedFund;
            if (fund && fund.ticker) {
                this.loadCandleData(fund.ticker, interval);
            }
        }
    }

    updateCandleRange(range) {
        console.log('📊 [updateCandleRange] Changing range to:', range);
        this.state.candleRange = range;
        // Đánh dấu đang ở chế độ intraday nếu range là trong ngày
        const intradayRanges = ['5M', '10M', '30M'];
        this._isIntraday = intradayRanges.includes(range);

        // Nếu đang ở chế độ so sánh, vẽ lại so sánh với range mới
        if (this.state.compareMode && this.state.compareFunds.length > 0) {
            this.compareSelectedFunds();
        } else {
            // Nếu không, load candlestick cho fund đang chọn
            const fund = this.state.selectedFund;
            if (fund && fund.ticker) {
                this.loadCandleData(fund.ticker, range);
            }
        }
    }

    // Chuyển đổi loại biểu đồ: 'candles' (nến) hoặc 'line' (đường/núi)
    setChartStyle(style) {
        console.log('📊 [setChartStyle] Changing chart style to:', style);
        this.state.chartStyle = style;

        // Vẽ lại biểu đồ với style mới
        const fund = this.state.selectedFund;
        if (fund && fund.ticker) {
            this.loadCandleData(fund.ticker, this.state.candleRange || '1H');
        }
    }

    async drawCandleChart(ohlcItems = []) {
        console.log(`📊 [drawCandleChart] Drawing chart with ${ohlcItems.length} items`);

        // Đợi LightweightCharts library load xong
        if (!window.LightweightCharts) {
            console.warn('⚠️ [drawCandleChart] LightweightCharts not loaded, waiting...');
            // Đợi tối đa 5 giây
            let attempts = 0;
            while (!window.LightweightCharts && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            if (!window.LightweightCharts) {
                console.error('❌ [drawCandleChart] LightweightCharts library not loaded after waiting');
                return;
            }
        }

        // Đợi container được render
        let container = document.getElementById('candleContainer');
        if (!container) {
            console.warn('⚠️ [drawCandleChart] Container not found, waiting...');
            let attempts = 0;
            while (!container && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                container = document.getElementById('candleContainer');
                attempts++;
            }
            if (!container) {
                console.error('❌ [drawCandleChart] Container not found after waiting: candleContainer');
                return;
            }
        }

        const LWC = window.LightweightCharts;

        // Lưu container reference để dùng trong event handlers
        this._chartContainer = container;

        // Đảm bảo container có kích thước
        const containerRect = container.getBoundingClientRect();
        const chartWidth = containerRect.width || container.clientWidth || 800;
        const chartHeight = containerRect.height || container.clientHeight || 300;
        console.log(`📊 [drawCandleChart] Container dimensions: ${chartWidth}x${chartHeight}`);

        // Check if chart exists but is attached to a different/stale container
        let needsRecreate = false;
        if (this.lwChart) {
            // Check if the old container is still in DOM and same as current
            if (this._chartContainer !== container || !document.body.contains(this._chartContainer)) {
                console.log('⚠️ [drawCandleChart] Chart container changed, recreating chart');
                needsRecreate = true;
                try {
                    this.lwChart.remove();
                } catch (e) {
                    console.warn('Could not remove old chart:', e);
                }
                this.lwChart = null;
                this.lwCandle = null;
                this.lwVolume = null;
                this._tooltip = null;
            }
        }

        if (!this.lwChart) {
            const isIntraday = !!this._isIntraday;
            this.lwChart = LWC.createChart(container, {
                width: chartWidth,
                height: chartHeight,

                layout: {
                    background: { color: '#0b0f1a' },
                    textColor: '#e5e7eb'
                },
                grid: {
                    vertLines: { color: '#1f2937', style: 0 },
                    horzLines: { color: '#1f2937', style: 0 }
                },
                rightPriceScale: {
                    borderColor: '#374151',
                    scaleMargins: { top: 0.1, bottom: 0.1 }
                },
                leftPriceScale: {
                    visible: false
                },
                timeScale: {
                    borderColor: '#374151',
                    timeVisible: true,
                    secondsVisible: false, // Tắt giây trên trục X để tránh rối (ví dụ :45)
                    rightOffset: isIntraday ? 4 : 6,
                    barSpacing: isIntraday ? 4 : 6,
                    minBarSpacing: isIntraday ? 1 : 2
                },
                crosshair: {
                    mode: 1,
                    vertLine: { color: '#6b7280', width: 1, style: 2 },
                    horzLine: { color: '#6b7280', width: 1, style: 2 },
                    vertLineLabelVisible: true,  // Hiển thị label trên đường dọc
                    horzLineLabelVisible: true   // Hiển thị label trên đường ngang
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: true
                },
                handleScale: {
                    axisPressedMouseMove: true,
                    axisTouchScale: true,
                    mouseWheel: true,
                    pinch: true
                },
                localization: {
                    priceFormatter: (v) => (v ?? 0).toLocaleString('vi-VN'),
                    timeFormatter: (t) => {
                        // Chuẩn hóa hiển thị thời gian theo kiểu dữ liệu:
                        // - Intraday: t là số (unix seconds) => 9h, 9h1p, 9h2p...
                        // - Daily: t có thể là object {year,month,day} hoặc 'YYYY-MM-DD' => dd/MM/yyyy
                        const pad = (n) => String(n).padStart(2, '0');
                        if (isIntraday) {
                            const d = new Date((typeof t === 'number' ? t : Number(t)) * 1000);
                            const h = d.getUTCHours();
                            const m = d.getUTCMinutes();
                            // Format: HH:mm (ví dụ 09:15, 14:45)
                            return `${pad(h)}:${pad(m)}`;
                        }
                        // Daily formats
                        if (t && typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
                            return `${pad(t.day)}/${pad(t.month)}/${t.year}`;
                        }
                        if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
                            const [y, m, d] = t.split('-').map(Number);
                            return `${pad(d)}/${pad(m)}/${y}`;
                        }
                        if (typeof t === 'number') {
                            const d = new Date(t * 1000);
                            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        }
                        return '';
                    }
                },
            });
            try {
                const intradayRanges = ['5M', '10M', '30M'];
                const currentRange = this.state.candleRange || '5M';
                const isIntra = intradayRanges.includes(currentRange);
                this.lwChart.timeScale().applyOptions({
                    barSpacing: isIntra ? 4 : 10,
                    minBarSpacing: isIntra ? 1 : 6,
                    rightOffset: isIntra ? 4 : 8
                });
            } catch (e) { }

            // Kiểm tra loại biểu đồ: 'candles' (nến) hoặc 'line' (đường/núi)
            const chartStyle = this.state.chartStyle || 'candles';
            console.log('📊 [drawCandleChart] Chart style:', chartStyle);

            // Series API compatibility (v3 vs v4)
            try {
                if (chartStyle === 'line') {
                    // Tạo Area series (biểu đồ đường/núi)
                    if (typeof this.lwChart.addSeries === 'function' && LWC.AreaSeries) {
                        this.lwCandle = this.lwChart.addSeries(LWC.AreaSeries, {
                            lineColor: '#2962FF',
                            topColor: 'rgba(41, 98, 255, 0.56)',
                            bottomColor: 'rgba(41, 98, 255, 0.04)',
                            lineWidth: 2,
                        });
                    } else if (typeof this.lwChart.addAreaSeries === 'function') {
                        this.lwCandle = this.lwChart.addAreaSeries({
                            lineColor: '#2962FF',
                            topColor: 'rgba(41, 98, 255, 0.56)',
                            bottomColor: 'rgba(41, 98, 255, 0.04)',
                            lineWidth: 2,
                        });
                    }
                    // Refine area aesthetics
                    try {
                        this.lwCandle && this.lwCandle.applyOptions({
                            priceLineVisible: true,
                            lastValueVisible: true,
                            crosshairMarkerVisible: true,
                            crosshairMarkerRadius: 4,
                        });
                    } catch (e) { }
                } else {
                    // Tạo Candlestick series (biểu đồ nến)
                    if (typeof this.lwChart.addSeries === 'function' && LWC.CandlestickSeries) {
                        this.lwCandle = this.lwChart.addSeries(LWC.CandlestickSeries, {
                            upColor: '#22c55e', downColor: '#ef4444',
                            borderUpColor: '#22c55e', borderDownColor: '#ef4444',
                            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                        });
                    } else if (typeof this.lwChart.addCandlestickSeries === 'function') {
                        this.lwCandle = this.lwChart.addCandlestickSeries({
                            upColor: '#22c55e', downColor: '#ef4444',
                            borderUpColor: '#22c55e', borderDownColor: '#ef4444',
                            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                        });
                    }
                    // Refine candlestick aesthetics
                    try {
                        this.lwCandle && this.lwCandle.applyOptions({
                            priceLineVisible: false,
                            lastValueVisible: true,
                            borderVisible: true,
                            upColor: '#22c55e', downColor: '#ef4444',
                            borderUpColor: '#22c55e', borderDownColor: '#ef4444',
                            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                            crosshairMarkerVisible: true,
                            crosshairMarkerRadius: 4,
                        });
                    } catch (e) { }
                }
            } catch (e) { console.warn('Create candlestick series failed', e); }

            // Khởi tạo reference cho ohlcToolbarInfo
            this._ohlcToolbar = document.getElementById('ohlcToolbarInfo');


            // Subscribe to crosshair move để hiển thị thông tin OHLC trên Toolbar
            try {
                if (this.lwChart && typeof this.lwChart.subscribeCrosshairMove === 'function') {
                    this._ohlcDataMap = new Map();
                    ohlcItems.forEach(item => {
                        const timeKey = typeof item.t === 'number' ? item.t : (typeof item.t === 'string' ? new Date(item.t).getTime() / 1000 : item.t);
                        this._ohlcDataMap.set(timeKey, item);
                    });

                    this.lwChart.subscribeCrosshairMove((param) => {
                        const ohlcToolbar = document.getElementById('ohlcToolbarInfo');
                        if (!ohlcToolbar) return;

                        if (!param.time || !param.seriesData) {
                            ohlcToolbar.textContent = '';
                            return;
                        }

                        const candleData = param.seriesData.get(this.lwCandle);
                        if (!candleData) {
                            ohlcToolbar.textContent = '';
                            return;
                        }

                        // Hỗ trợ cả intraday (number) và daily (string/object)
                        let timeKey;
                        if (typeof param.time === 'number') {
                            timeKey = param.time;
                        } else if (typeof param.time === 'string') {
                            timeKey = Math.floor(new Date(param.time).getTime() / 1000);
                        } else if (param.time && typeof param.time === 'object' && 'year' in param.time) {
                            const { year, month, day } = param.time;
                            timeKey = Math.floor(new Date(year, (month - 1), day).getTime() / 1000);
                        } else {
                            timeKey = null;
                        }

                        const ohlcData = this._ohlcDataMap.get(timeKey);
                        if (ohlcData) {
                            const isIntradayView = !!this._isIntraday;
                            let dateStr, timeStr;
                            if (isIntradayView) {
                                const d = new Date(timeKey * 1000);
                                const pad = (n) => String(n).padStart(2, '0');
                                dateStr = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
                                timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
                            } else {
                                const d = new Date(timeKey * 1000);
                                const pad = (n) => String(n).padStart(2, '0');
                                dateStr = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
                                timeStr = '';
                            }

                            ohlcToolbar.textContent = '';

                            const containerDiv = document.createElement('div');
                            containerDiv.className = 'd-flex align-items-center gap-3';

                            const dateSpan = document.createElement('span');
                            dateSpan.className = 'text-muted';
                            dateSpan.style.minWidth = '100px';
                            dateSpan.textContent = `${dateStr} ${timeStr}`;
                            containerDiv.appendChild(dateSpan);

                            const createSpan = (label, val, color) => {
                                const span = document.createElement('span');
                                span.textContent = `${label}: `;
                                const valSpan = document.createElement('span');
                                valSpan.className = 'fw-bold';
                                valSpan.style.color = color;
                                valSpan.textContent = val.toLocaleString('vi-VN');
                                span.appendChild(valSpan);
                                return span;
                            };

                            containerDiv.appendChild(createSpan('O', ohlcData.o || 0, '#60a5fa'));
                            containerDiv.appendChild(createSpan('H', ohlcData.h || 0, '#22c55e'));
                            containerDiv.appendChild(createSpan('L', ohlcData.l || 0, '#ef4444'));
                            containerDiv.appendChild(createSpan('C', ohlcData.c || 0, ohlcData.c >= ohlcData.o ? '#22c55e' : '#ef4444'));

                            if (ohlcData.v) {
                                containerDiv.appendChild(createSpan('V', ohlcData.v, 'inherit')); // text-muted applies to parent 
                                containerDiv.lastChild.lastChild.className = 'fw-bold text-muted';
                                containerDiv.lastChild.lastChild.style.color = '';
                            }

                            ohlcToolbar.appendChild(containerDiv);
                        }
                    });
                }
            } catch (e) { console.warn('Subscribe crosshair move failed', e); }

            // Xóa volume chart - chỉ giữ lại candlestick chart
            this.lwVolume = null;
            try {
                this._resizeObs = new ResizeObserver(() => {
                    const { clientWidth, clientHeight } = container;
                    this.lwChart.applyOptions({ width: clientWidth, height: clientHeight });
                });
                this._resizeObs.observe(container);
            } catch (e) { }
        }

        // Ensure series exists even if chart was already created
        // This handles cases where chart exists but series was lost or needs recreation
        if (this.lwChart && !this.lwCandle) {
            console.log('⚠️ [drawCandleChart] Chart exists but series missing, creating series');
            const chartStyle = this.state.chartStyle || 'candles';
            try {
                if (chartStyle === 'line') {
                    if (typeof this.lwChart.addSeries === 'function' && LWC.AreaSeries) {
                        this.lwCandle = this.lwChart.addSeries(LWC.AreaSeries, {
                            lineColor: '#2962FF',
                            topColor: 'rgba(41, 98, 255, 0.56)',
                            bottomColor: 'rgba(41, 98, 255, 0.04)',
                            lineWidth: 2,
                        });
                    } else if (typeof this.lwChart.addAreaSeries === 'function') {
                        this.lwCandle = this.lwChart.addAreaSeries({
                            lineColor: '#2962FF',
                            topColor: 'rgba(41, 98, 255, 0.56)',
                            bottomColor: 'rgba(41, 98, 255, 0.04)',
                            lineWidth: 2,
                        });
                    }
                } else {
                    if (typeof this.lwChart.addSeries === 'function' && LWC.CandlestickSeries) {
                        this.lwCandle = this.lwChart.addSeries(LWC.CandlestickSeries, {
                            upColor: '#22c55e', downColor: '#ef4444',
                            borderUpColor: '#22c55e', borderDownColor: '#ef4444',
                            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                        });
                    } else if (typeof this.lwChart.addCandlestickSeries === 'function') {
                        this.lwCandle = this.lwChart.addCandlestickSeries({
                            upColor: '#22c55e', downColor: '#ef4444',
                            borderUpColor: '#22c55e', borderDownColor: '#ef4444',
                            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                        });
                    }
                }
                console.log('✅ [drawCandleChart] Series created:', !!this.lwCandle);
            } catch (e) {
                console.error('❌ [drawCandleChart] Failed to create series:', e);
            }
        }

        // Helper: chuyển về dạng thời gian mà lightweight-charts ưa thích
        const normalizeTime = (timeValue) => {
            if (typeof timeValue === 'number') {
                return timeValue > 10000000000 ? Math.floor(timeValue / 1000) : timeValue; // seconds
            }
            if (typeof timeValue === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(timeValue)) {
                    const [y, m, d] = timeValue.split('-').map(Number);
                    return { year: y, month: m, day: d }; // business day to avoid TZ shift
                }
                const parsed = new Date(timeValue);
                return isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
            }
            if (timeValue instanceof Date) {
                return Math.floor(timeValue.getTime() / 1000);
            }
            if (timeValue && typeof timeValue === 'object' && 'year' in timeValue) {
                return timeValue; // already business day
            }
            return null;
        };

        const epochSecondsFromTime = (t) => {
            if (typeof t === 'number') return t;
            if (typeof t === 'string') return Math.floor(new Date(t).getTime() / 1000);
            if (t && typeof t === 'object' && 'year' in t) {
                return Math.floor(new Date(t.year, t.month - 1, t.day).getTime() / 1000);
            }
            if (t instanceof Date) return Math.floor(t.getTime() / 1000);
            return 0;
        };

        // Map và normalize time, sắp xếp theo thời gian
        // Kiểm tra loại biểu đồ để chọn format data phù hợp
        const chartStyle = this.state.chartStyle || 'candles';

        let chartData;
        if (chartStyle === 'line') {
            // Area chart: chỉ cần {time, value} - dùng close price
            chartData = ohlcItems
                .map(i => {
                    const normalizedTime = normalizeTime(i.t);
                    if (normalizedTime === null) return null;
                    return {
                        time: normalizedTime,
                        value: i.c || i.close || 0  // Dùng close price
                    };
                })
                .filter(item => item !== null && item.value > 0)
                .sort((a, b) => epochSecondsFromTime(a.time) - epochSecondsFromTime(b.time));
        } else {
            // Candlestick chart: cần OHLC data
            chartData = ohlcItems
                .map(i => {
                    const normalizedTime = normalizeTime(i.t);
                    if (normalizedTime === null) return null;
                    return {
                        time: normalizedTime,
                        open: i.o,
                        high: i.h,
                        low: i.l,
                        close: i.c
                    };
                })
                .filter(item => item !== null)
                .sort((a, b) => epochSecondsFromTime(a.time) - epochSecondsFromTime(b.time));
        }

        // Cập nhật map data để dùng trong crosshair tooltip (chuẩn hóa key về epoch seconds)
        this._ohlcDataMap = new Map();
        ohlcItems.forEach(item => {
            const key = epochSecondsFromTime(normalizeTime(item.t));
            if (key) this._ohlcDataMap.set(key, item);
        });

        console.log(`📊 [drawCandleChart] Preparing to set data:`, {
            chartStyle: chartStyle,
            hasCandleSeries: !!this.lwCandle,
            hasSetData: this.lwCandle && typeof this.lwCandle.setData === 'function',
            dataLength: chartData.length,
            firstItem: chartData[0],
            lastItem: chartData[chartData.length - 1]
        });

        if (!this.lwCandle) {
            console.error('❌ [drawCandleChart] Candle series not initialized');
            return;
        }

        if (typeof this.lwCandle.setData !== 'function') {
            console.error('❌ [drawCandleChart] setData method not available');
            return;
        }

        if (chartData.length === 0) {
            console.warn('⚠️ [drawCandleChart] No data to display');
            // Clear chart if no data
            try {
                this.lwCandle.setData([]);
            } catch (e) {
                console.error('Error clearing chart:', e);
            }
            return;
        }

        try {
            console.log(`✅ [drawCandleChart] Setting ${chartData.length} items to ${chartStyle} chart`);
            this.lwCandle.setData(chartData);
            console.log(`✅ [drawCandleChart] Data set successfully`);
        } catch (e) {
            console.error('❌ [drawCandleChart] Error setting candlestick data:', e);
            console.error('❌ [drawCandleChart] Error stack:', e.stack);
            // Fallback: thử với dữ liệu mới nhất
            if (ohlcItems.length > 0) {
                try {
                    console.log('⚠️ [drawCandleChart] Trying fallback with last item only');
                    this.lwCandle.setData([ohlcItems[ohlcItems.length - 1]]);
                } catch (e2) {
                    console.error('❌ [drawCandleChart] Fallback also failed:', e2);
                }
            }
        }
        if (ohlcItems.length && this.lwCandle && typeof this.lwCandle.createPriceLine === 'function') {
            const last = ohlcItems[ohlcItems.length - 1];
            try { this._lastPriceLine && this.lwCandle.removePriceLine(this._lastPriceLine); } catch (e) { }
            try {
                this._lastPriceLine = this.lwCandle.createPriceLine({
                    price: last.close,
                    color: '#6b7280',
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: 'Last'
                });
            } catch (e) { }
        }
        this.lwChart.timeScale().fitContent();

        // Force resize để đảm bảo chart render đúng
        try {
            const containerRect = this._chartContainer.getBoundingClientRect();
            const newWidth = containerRect.width || this._chartContainer.clientWidth || 800;
            const newHeight = containerRect.height || this._chartContainer.clientHeight || 300;
            this.lwChart.resize(newWidth, newHeight);
            this.lwChart.timeScale().fitContent();
            console.log(`✅ [drawCandleChart] Chart resized to ${newWidth}x${newHeight}`);
        } catch (e) {
            console.warn('⚠️ [drawCandleChart] Could not resize chart:', e);
        }
    }

    // Tính năng Realtime: Tự động cập nhật dữ liệu
    startRealtime(baseItems = []) {
        try { this.stopRealtime(); } catch (e) { }

        const intradayRanges = ['1\'', '5\'', '15', '30\'', '45\'', '1h'];
        const isIntraday = intradayRanges.includes(this.state.interval);
        const today = new Date().toISOString().split('T')[0];

        // LOGIC REALTIME CHO INTRADAY: Polling dữ liệu thật
        if (isIntraday) {
            // Chỉ tự động cập nhật nếu đang xem ngày hiện tại
            if (this._intradayTradingDate === today) {
                console.log('📡 [startRealtime] Enabled polling for real intraday data');
                this._rtInterval = setInterval(() => {
                    const ticker = this.state.selectedFund && this.state.selectedFund.ticker;
                    const range = this.state.interval;
                    if (ticker) {
                        this.loadCandleData(ticker, range, true); // silent = true
                    }
                }, 15000); // 15 giây cập nhật một lần
            } else {
                console.log('🔇 [startRealtime] Polling disabled for historical date:', this._intradayTradingDate);
            }
            return;
        }

        // LOGIC REALTIME CHO DAILY: Giả lập nến ngẫu nhiên (chỉ dùng cho demo)

        // Helper function để normalize time format
        const normalizeTime = (timeValue) => {
            if (typeof timeValue === 'number') {
                return timeValue > 10000000000 ? timeValue / 1000 : timeValue;
            }
            if (typeof timeValue === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(timeValue)) {
                    return timeValue;
                }
                const parsed = new Date(timeValue);
                return isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
            }
            if (timeValue instanceof Date) {
                return Math.floor(timeValue.getTime() / 1000);
            }
            return null;
        };

        const seed = baseItems.slice(-200) // recent snapshot (tăng số lượng điểm để chạy mượt hơn)
            .map(i => {
                const normalizedTime = normalizeTime(i.t);
                if (normalizedTime === null) return null;
                return {
                    time: normalizedTime,
                    open: i.o,
                    high: i.h,
                    low: i.l,
                    close: i.c
                };
            })
            .filter(item => item !== null);

        if (!this.lwCandle || seed.length === 0) return;
        let last = seed[seed.length - 1];
        let i = 0;
        const rand = () => (Math.random() - 0.5) * (last.close * 0.004); // +-0.4%
        this._rtInterval = setInterval(() => {
            // Every 5 ticks start a new candle, otherwise update current
            const isOpen = (i % 5) === 0;
            if (isOpen) {
                const open = last.close;
                const val = open + rand();
                // Tính toán time mới dựa trên time hiện tại
                let nextTime;
                if (typeof last.time === 'number') {
                    // Nếu là timestamp, thêm 1 ngày (86400 seconds)
                    nextTime = last.time + 86400;
                } else if (typeof last.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(last.time)) {
                    // Nếu là string YYYY-MM-DD, thêm 1 ngày
                    const d = new Date(last.time);
                    d.setDate(d.getDate() + 1);
                    nextTime = d.toISOString().slice(0, 10);
                } else {
                    // Fallback
                    const d = new Date(last.time);
                    d.setDate(d.getDate() + 1);
                    nextTime = Math.floor(d.getTime() / 1000);
                }
                const candle = {
                    time: nextTime,
                    open: open,
                    high: Math.max(open, val),
                    low: Math.min(open, val),
                    close: val
                };
                last = candle;
                try {
                    this.lwCandle.update(candle);
                } catch (e) {
                    console.warn('Realtime update failed:', e);
                }
            } else {
                const val = last.close + rand();
                last = {
                    time: last.time,
                    open: last.open,
                    high: Math.max(last.high, val),
                    low: Math.min(last.low, val),
                    close: val
                };
                try {
                    this.lwCandle.update(last);
                } catch (e) {
                    console.warn('Realtime update failed:', e);
                }
            }
            i += 1;
        }, 1000);
    }

    _computeDateRange(range) {
        const today = new Date();
        const toDate = today.toISOString().slice(0, 10);
        const daysAgo = (n) => {
            const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
        };
        const monthsAgo = (n) => {
            const d = new Date(today); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10);
        };
        const yearsAgo = (n) => {
            const d = new Date(today); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10);
        };
        const yearStart = () => {
            const d = new Date(today.getFullYear(), 0, 1); return d.toISOString().slice(0, 10);
        };
        switch (range) {
            case '1D': return { fromDate: toDate, toDate };
            case '5D': return { fromDate: daysAgo(5), toDate };
            case '1M': return { fromDate: daysAgo(31), toDate };
            case '3M': return { fromDate: daysAgo(91), toDate };
            case '6M': return { fromDate: daysAgo(182), toDate };
            case 'YTD': return { fromDate: yearStart(), toDate };
            case '1Y': return { fromDate: yearsAgo(1), toDate };
            case '5Y': return { fromDate: yearsAgo(5), toDate };
            case 'ALL': return { fromDate: '2020-01-01', toDate }; // Hoặc từ ngày đầu tiên có dữ liệu
            default: return { fromDate: daysAgo(31), toDate };
        }
    }

    stopRealtime() {
        if (this._rtInterval) {
            clearInterval(this._rtInterval);
            this._rtInterval = null;
        }
    }

    _incDay(isoDate) {
        try {
            const d = new Date(isoDate);
            d.setDate(d.getDate() + 1);
            return d.toISOString().slice(0, 10);
        } catch (e) { return isoDate; }
    }

    scrollToRealtime() {
        if (this.lwChart && this.lwChart.timeScale) {
            try {
                this.lwChart.timeScale().scrollToRealTime();
            } catch (e) {
                // Fallback: scroll to rightmost position
                try {
                    this.lwChart.timeScale().scrollToPosition(-1, true);
                } catch (e2) { }
            }
        }
    }

    resetChartView() {
        if (this.lwChart && this.lwChart.timeScale) {
            try {
                this.lwChart.timeScale().resetTimeScale();
            } catch (e) {
                this.fitChartContent();
            }
        }
    }

    fitChartContent() {
        if (this.lwChart && this.lwChart.timeScale) {
            try {
                this.lwChart.timeScale().fitContent();
            } catch (e) {
                console.warn('Fit content failed', e);
            }
        }
    }

    updateNavChartRange(range) {        // Cập nhật NAV theo thời gian thật
        this.unable_roll();
        console.log("⏳ Changing NAV chart range to:", range);
        this.state.activeRange = range;

        const fund = this.state.selectedFund;
        if (!fund || !fund.nav_history_json) {
            console.warn("⚠️ Không có dữ liệu nav_history_json!");
            return;
        }

        const allData = JSON.parse(fund.nav_history_json);

        const now = new Date();
        const getDateMonthsAgo = (months) => {
            const d = new Date(now);
            d.setMonth(d.getMonth() - months);
            return d;
        };

        let startDate;
        switch (range) {
            case '1M':
                startDate = getDateMonthsAgo(1); break;
            case '3M':
                startDate = getDateMonthsAgo(3); break;
            case '6M':
                startDate = getDateMonthsAgo(6); break;
            case '1Y':
                startDate = getDateMonthsAgo(12); break;
            default:
                startDate = getDateMonthsAgo(1); break;
        }

        // Lọc dữ liệu trong khoảng thời gian được chọn
        const filtered = allData.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= startDate && entryDate <= now;
        });

        const labels = filtered.map(entry => {
            const d = new Date(entry.date);
            return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });

        const values = filtered.map(entry => entry.value);
        this.drawNavLineChart(labels, values);
    }

    toggleCompareFund(fund) {
        this.unable_roll();
        const index = this.state.compareFunds.findIndex(f => f.ticker === fund.ticker);

        if (index > -1) {
            this.state.compareFunds.splice(index, 1);
        } else {
            if (this.state.compareFunds.length >= 4) {
                Swal.fire({
                    icon: "warning",
                    title: "Giới hạn!",
                    text: "⚠️ Bạn chỉ có thể chọn tối đa 4 quỹ để so sánh.",
                    confirmButtonColor: "#dc3545"
                });
                return;
            }
            this.state.compareFunds.push(fund);
        }

        // ✅ Luôn bật chế độ so sánh và vẽ lại mỗi khi có thay đổi
        this.state.compareMode = true;
        this.compareSelectedFunds();
    }

    toggleCompareMode() {
        this.unable_roll();
        if (!this.state.selectedFund) {
            Swal.fire({
                icon: "info",
                title: "Chọn CCQ",
                text: "Vui lòng chọn một chứng chỉ quỹ trước khi so sánh.",
                confirmButtonColor: "#36A2EB"
            });
            return;
        }

        // Toggle compare mode
        if (!this.state.compareMode) {
            this.state.compareMode = true;
            // Tự động thêm fund hiện tại vào danh sách so sánh nếu chưa có
            const exists = this.state.compareFunds.find(f => f.ticker === this.state.selectedFund.ticker);
            if (!exists) {
                this.state.compareFunds.push(this.state.selectedFund);
            }
        } else {
            // Nếu đang ở chế độ so sánh, có thể mở dialog để thêm thêm CCQ
            this.openCompareDialog();
        }
    }

    openCompareDialog() {
        // Tạo dialog để chọn thêm CCQ để so sánh
        const availableFunds = this.state.funds.filter(f =>
            !this.state.compareFunds.find(cf => cf.ticker === f.ticker)
        );

        if (availableFunds.length === 0) {
            Swal.fire({
                icon: "info",
                title: "Không có CCQ",
                text: "Tất cả CCQ đã được thêm vào danh sách so sánh.",
                confirmButtonColor: "#36A2EB"
            });
            return;
        }

        const options = availableFunds.map(f => f.ticker).join(', ');

        Swal.fire({
            title: "Thêm CCQ để so sánh",
            text: `CCQ có sẵn: ${options}`,
            input: "text",
            inputPlaceholder: "Nhập mã CCQ (ví dụ: VND, VFM, ...)",
            showCancelButton: true,
            confirmButtonText: "Thêm",
            cancelButtonText: "Hủy",
            confirmButtonColor: "#36A2EB",
            inputValidator: (value) => {
                if (!value) {
                    return "Vui lòng nhập mã CCQ!";
                }
                const fund = this.state.funds.find(f =>
                    f.ticker && f.ticker.toUpperCase() === value.toUpperCase().trim()
                );
                if (!fund) {
                    return "Không tìm thấy CCQ với mã này!";
                }
                if (this.state.compareFunds.find(cf => cf.ticker === fund.ticker)) {
                    return "CCQ này đã được thêm vào danh sách so sánh!";
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const ticker = result.value.toUpperCase().trim();
                const fund = this.state.funds.find(f =>
                    f.ticker && f.ticker.toUpperCase() === ticker
                );
                if (fund && this.state.compareFunds.length < 4) {
                    this.state.compareFunds.push(fund);
                    this.compareSelectedFunds();
                }
            }
        });
    }

    removeCompareFund(fund) {
        this.unable_roll();
        const index = this.state.compareFunds.findIndex(f => f.ticker === fund.ticker);
        if (index > -1) {
            // Xóa area series tương ứng
            if (this.compareAreaSeries && this.compareAreaSeries[index]) {
                try {
                    if (this.lwChart) {
                        this.lwChart.removeSeries(this.compareAreaSeries[index]);
                    }
                } catch (e) { }
                this.compareAreaSeries.splice(index, 1);
            }

            this.state.compareFunds.splice(index, 1);
            if (this.state.compareFunds.length === 0) {
                this.state.compareMode = false;
                // Vẽ lại candlestick chart cho fund đang chọn
                const selectedFund = this.state.selectedFund;
                if (selectedFund && selectedFund.ticker) {
                    this.loadCandleData(selectedFund.ticker, this.state.candleRange || '1M');
                }
            } else {
                // Vẽ lại với danh sách còn lại
                this.compareSelectedFunds();
            }
        }
    }

    openSymbolSearch() {
        if (!this.state.funds || this.state.funds.length === 0) {
            Swal.fire({
                icon: "info",
                title: "Không có dữ liệu",
                text: "Chưa có danh sách CCQ.",
                confirmButtonColor: "#36A2EB"
            });
            return;
        }

        const options = this.state.funds.map(f => f.ticker).join(', ');

        Swal.fire({
            title: "Tìm kiếm CCQ",
            text: `CCQ có sẵn: ${options}`,
            input: "text",
            inputPlaceholder: "Nhập mã CCQ để tìm kiếm",
            showCancelButton: true,
            confirmButtonText: "Chọn",
            cancelButtonText: "Hủy",
            confirmButtonColor: "#36A2EB",
            inputValidator: (value) => {
                if (!value) {
                    return "Vui lòng nhập mã CCQ!";
                }
                const fund = this.state.funds.find(f =>
                    f.ticker && f.ticker.toUpperCase() === value.toUpperCase().trim()
                );
                if (!fund) {
                    return "Không tìm thấy CCQ với mã này!";
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const ticker = result.value.toUpperCase().trim();
                const fund = this.state.funds.find(f =>
                    f.ticker && f.ticker.toUpperCase() === ticker
                );
                if (fund) {
                    this.selectFund(fund);
                }
            }
        });
    }

    setInterval(interval) {
        this.unable_roll();
        this.state.interval = interval;
        // Có thể thêm logic để thay đổi interval của chart nếu cần
        console.log("Interval changed to:", interval);
    }

    setChartStyle(style) {
        this.unable_roll();
        this.state.chartStyle = style;
        // Có thể thêm logic để thay đổi chart style nếu cần
        console.log("Chart style changed to:", style);
    }


    async compareSelectedFunds() {
        if (!this.state.compareMode) {
            this.state.compareMode = true;
            Swal.fire({
                title: "Thông báo!",
                text: "Hãy chọn các sản phẩm chứng chỉ quỹ để so sánh.",
                icon: "info",
                confirmButtonText: "OK",
                confirmButtonColor: "#36A2EB"
            });
            return;
        }

        const selected = this.state.compareFunds;
        if (!selected || selected.length === 0) {
            return;
        }

        // Ẩn candlestick và volume khi so sánh
        if (this.lwCandle) {
            try {
                this.lwCandle.setData([]);
            } catch (e) { }
        }
        if (this.lwVolume) {
            try {
                this.lwVolume.setData([]);
            } catch (e) { }
        }

        // Xóa các area series cũ nếu có
        if (this.compareAreaSeries) {
            this.compareAreaSeries.forEach(series => {
                try {
                    this.lwChart.removeSeries(series);
                } catch (e) { }
            });
        }
        this.compareAreaSeries = [];

        // Đảm bảo chart đã được khởi tạo
        const container = document.getElementById('candleContainer');
        if (!container || !window.LightweightCharts) return;
        const LWC = window.LightweightCharts;

        if (!this.lwChart) {
            this.drawCandleChart([]);
        }

        // Load OHLC data cho từng CCQ và vẽ area chart
        const range = this.state.candleRange || '1M';
        // Intraday khi nằm trong các khung phút/giờ trong ngày
        const intradayRanges = ['1M', '15M', '30M', '45M', '1H'];
        this._isIntraday = intradayRanges.includes(range);
        try {
            if (this.lwChart && typeof this.lwChart.applyOptions === 'function') {
                this.lwChart.applyOptions({ timeScale: { secondsVisible: this._isIntraday, timeVisible: true } });
            }
        } catch (e) { }
        const { fromDate, toDate } = this._computeDateRange(range);

        for (let i = 0; i < selected.length; i++) {
            const fund = selected[i];
            try {
                const qs = new URLSearchParams({
                    ticker: fund.ticker,
                    range,
                    fromDate,
                    toDate
                }).toString();
                const res = await fetch(`/fund_ohlc?${qs}`);
                const payload = await res.json();

                if (payload && payload.status === 'Success') {
                    const items = payload.data || [];
                    if (items.length > 0) {
                        // Lấy màu cho CCQ này
                        let fundColor = this.getFundColor(fund);

                        // Convert color (hex, hsl, rgb) to rgba với opacity
                        const colorToRgba = (color, alpha) => {
                            if (!color) return `rgba(0, 123, 255, ${alpha})`;

                            // Nếu là HSL
                            if (color.startsWith('hsl(')) {
                                const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
                                if (match) {
                                    const h = parseInt(match[1]);
                                    const s = parseInt(match[2]) / 100;
                                    const l = parseInt(match[3]) / 100;
                                    // Convert HSL to RGB
                                    const c = (1 - Math.abs(2 * l - 1)) * s;
                                    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
                                    const m = l - c / 2;
                                    let r, g, b;
                                    if (h < 60) { r = c; g = x; b = 0; }
                                    else if (h < 120) { r = x; g = c; b = 0; }
                                    else if (h < 180) { r = 0; g = c; b = x; }
                                    else if (h < 240) { r = 0; g = x; b = c; }
                                    else if (h < 300) { r = x; g = 0; b = c; }
                                    else { r = c; g = 0; b = x; }
                                    return `rgba(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}, ${alpha})`;
                                }
                            }

                            // Nếu là hex
                            if (color.startsWith('#')) {
                                const r = parseInt(color.slice(1, 3), 16);
                                const g = parseInt(color.slice(3, 5), 16);
                                const b = parseInt(color.slice(5, 7), 16);
                                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                            }

                            // Nếu là rgb/rgba, giữ nguyên và chỉ thay đổi alpha
                            if (color.startsWith('rgb')) {
                                return color.replace(/rgba?\([^)]+\)/, `rgba(${color.match(/\d+/g).slice(0, 3).join(', ')}, ${alpha})`);
                            }

                            return `rgba(0, 123, 255, ${alpha})`;
                        };

                        // Chuẩn hóa màu thành hex hoặc rgb để dùng cho lineColor
                        const normalizeColor = (color) => {
                            if (!color) return '#007bff';
                            if (color.startsWith('#')) return color;
                            if (color.startsWith('rgb')) {
                                // Convert rgb to hex
                                const match = color.match(/\d+/g);
                                if (match && match.length >= 3) {
                                    const r = parseInt(match[0]).toString(16).padStart(2, '0');
                                    const g = parseInt(match[1]).toString(16).padStart(2, '0');
                                    const b = parseInt(match[2]).toString(16).padStart(2, '0');
                                    return `#${r}${g}${b}`;
                                }
                                return '#007bff';
                            }
                            if (color.startsWith('hsl(')) {
                                // Convert HSL to hex
                                const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
                                if (match) {
                                    const h = parseInt(match[1]);
                                    const s = parseInt(match[2]) / 100;
                                    const l = parseInt(match[3]) / 100;
                                    const c = (1 - Math.abs(2 * l - 1)) * s;
                                    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
                                    const m = l - c / 2;
                                    let r, g, b;
                                    if (h < 60) { r = c; g = x; b = 0; }
                                    else if (h < 120) { r = x; g = c; b = 0; }
                                    else if (h < 180) { r = 0; g = c; b = x; }
                                    else if (h < 240) { r = 0; g = x; b = c; }
                                    else if (h < 300) { r = x; g = 0; b = c; }
                                    else { r = c; g = 0; b = x; }
                                    const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
                                    const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
                                    const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');
                                    return `#${rHex}${gHex}${bHex}`;
                                }
                            }
                            return '#007bff';
                        };

                        const normalizedColor = normalizeColor(fundColor);

                        // Tạo area series (mountain chart)
                        let areaSeries;
                        try {
                            if (typeof this.lwChart.addSeries === 'function' && LWC.AreaSeries) {
                                areaSeries = this.lwChart.addSeries(LWC.AreaSeries, {
                                    lineColor: normalizedColor,
                                    topColor: colorToRgba(fundColor, 0.4),
                                    bottomColor: colorToRgba(fundColor, 0.05),
                                    lineWidth: 2,
                                    title: `${fund.ticker} - ${fund.name || ''}`
                                });
                            } else if (typeof this.lwChart.addAreaSeries === 'function') {
                                areaSeries = this.lwChart.addAreaSeries({
                                    lineColor: normalizedColor,
                                    topColor: colorToRgba(fundColor, 0.4),
                                    bottomColor: colorToRgba(fundColor, 0.05),
                                    lineWidth: 2,
                                    title: `${fund.ticker} - ${fund.name || ''}`
                                });
                            }
                        } catch (e) {
                            console.warn('Failed to create area series:', e);
                            continue;
                        }

                        if (areaSeries) {
                            // Helper function để normalize time format
                            const normalizeTime = (timeValue) => {
                                if (typeof timeValue === 'number') {
                                    // Nếu là timestamp (seconds), giữ nguyên
                                    // Nếu là milliseconds, chuyển sang seconds
                                    return timeValue > 10000000000 ? timeValue / 1000 : timeValue;
                                }
                                if (typeof timeValue === 'string') {
                                    // Nếu là string YYYY-MM-DD, giữ nguyên (lightweight-charts hỗ trợ)
                                    if (/^\d{4}-\d{2}-\d{2}$/.test(timeValue)) {
                                        return timeValue;
                                    }
                                    // Nếu là string khác, parse thành timestamp
                                    const parsed = new Date(timeValue);
                                    return isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
                                }
                                if (timeValue instanceof Date) {
                                    return Math.floor(timeValue.getTime() / 1000);
                                }
                                return null;
                            };

                            // Convert OHLC data thành format cho area series (sử dụng close price)
                            const areaData = items
                                .map(item => {
                                    const normalizedTime = normalizeTime(item.t);
                                    if (normalizedTime === null) return null;
                                    const value = (item.c ?? item.close ?? null);
                                    if (value === null || isNaN(Number(value))) return null;
                                    return {
                                        time: normalizedTime,
                                        value: Number(value)
                                    };
                                })
                                .filter(item => item !== null)
                                .sort((a, b) => epochSecondsFromTime(a.time) - epochSecondsFromTime(b.time));

                            try {
                                if (areaData.length > 0) {
                                    areaSeries.setData(areaData);
                                    this.compareAreaSeries.push(areaSeries);
                                } else if ((items || []).length > 0) {
                                    // Fallback: nếu thiếu dữ liệu (ví dụ intraday trống), hiển thị 1 điểm cuối để user vẫn thấy giá
                                    const last = items[items.length - 1];
                                    const tnorm = normalizeTime(last.t);
                                    const vnorm = Number(last.c ?? last.close ?? 0);
                                    if (tnorm != null) {
                                        areaSeries.setData([{ time: tnorm, value: vnorm }]);
                                        this.compareAreaSeries.push(areaSeries);
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to set area data:', e);
                                // Fallback: thử với dữ liệu mới nhất
                                if (areaData.length > 0) {
                                    try {
                                        areaSeries.setData([areaData[areaData.length - 1]]);
                                    } catch (e2) {
                                        console.error('Fallback failed:', e2);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to load data for ${fund.ticker}:`, e);
            }
        }

        // Fit content sau khi vẽ xong
        if (this.lwChart && this.compareAreaSeries.length > 0) {
            try {
                this.lwChart.timeScale().fitContent();
            } catch (e) { }
        }
    }



    resetCompareMode() {
        this.unable_roll();
        this.state.compareMode = false;
        this.state.compareFunds = [];

        // Xóa các area series khi thoát chế độ so sánh
        if (this.compareAreaSeries && this.compareAreaSeries.length > 0) {
            this.compareAreaSeries.forEach(series => {
                try {
                    if (this.lwChart) {
                        this.lwChart.removeSeries(series);
                    }
                } catch (e) { }
            });
            this.compareAreaSeries = [];
        }

        // Vẽ lại candlestick chart cho fund đang chọn
        const fund = this.state.selectedFund;
        if (fund && fund.ticker) {
            this.loadCandleData(fund.ticker, this.state.candleRange || '1M');
        }
    }

    unable_roll() {
        const scrollTop = window.scrollY;
        requestAnimationFrame(() => {
            window.scrollTo(0, scrollTop);
        });
    }
}
