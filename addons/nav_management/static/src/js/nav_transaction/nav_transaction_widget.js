/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount } from "@odoo/owl";

export class NavTransactionWidget extends Component {
  
  static template = xml`
    <div class="nav-management-fund-overview-container">
      <div class="container-fluid">
        <!-- Top Navigation Buttons -->
        <div class="nav-management-content-header mb-3">
          <div class="d-flex gap-2 flex-wrap">
            <button t-att-class="'nav-management-btn-modern ' + (state.currentTab==='nav' ? 'nav-management-btn-primary-modern' : 'nav-management-btn-secondary-modern')" t-on-click="() => this.switchTab('nav')">
              <i class="fas fa-table me-2"></i>Danh sách NAV phiên giao dịch
            </button>
            <button t-att-class="'nav-management-btn-modern ' + (state.currentTab==='mm' ? 'nav-management-btn-primary-modern' : 'nav-management-btn-secondary-modern')" t-on-click="() => this.switchTab('mm')">
              <i class="fas fa-random me-2"></i>Lệnh mua bán trong ngày của Nhà tạo lập
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <t t-if="state.currentTab==='nav'">
        <div class="nav-management-stats-grid">
          <div class="nav-management-stat-card">
            <div class="nav-management-stat-icon" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1e40af;">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="nav-management-stat-number"><t t-esc="state.totalTransactions"/></div>
            <div class="nav-management-stat-label">Tổng phiên giao dịch của <t t-esc="this.getSelectedFundName()"/></div>
            <div class="nav-management-stat-description">Số lượng phiên giao dịch thuộc quỹ đã chọn</div>
          </div>
          <div class="nav-management-stat-card">
            <div class="nav-management-stat-icon" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); color: #065f46;">
              <i class="fas fa-coins"></i>
            </div>
            <div class="nav-management-stat-number"><t t-esc="this.formatCurrency(state.totalNavValue)"/></div>
            <div class="nav-management-stat-label">Tổng giá trị lệnh</div>
            <div class="nav-management-stat-description">Tổng giá trị NAV của tất cả phiên</div>
          </div>
          <div class="nav-management-stat-card">
            <div class="nav-management-stat-icon" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e;">
              <i class="fas fa-calculator"></i>
            </div>
            <div class="nav-management-stat-number"><t t-esc="this.formatCurrency(state.averageNavValue)"/></div>
            <div class="nav-management-stat-label">Giá trị NAV trung bình</div>
            <div class="nav-management-stat-description">Giá trị NAV trung bình mỗi phiên</div>
          </div>
          <div class="nav-management-stat-card">
            <div class="nav-management-stat-icon" style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); color: #3730a3;">
              <i class="fas fa-calendar-day"></i>
            </div>
            <div class="nav-management-stat-number"><t t-esc="state.todayTransactions"/></div>
            <div class="nav-management-stat-label"><t t-esc="'Phiên Ngày ' + this.getTodayDateString()"/></div>
            <div class="nav-management-stat-description">Số lệnh được tạo trong ngày hôm nay</div>
          </div>
          </div>
        </t>
                                    
        <!-- Main Content -->
        <div class="main-content">
          <t t-if="state.currentTab==='nav'">
          <!-- Content Header -->
          <div class="nav-management-content-header">
            <div class="row align-items-center">
              <div class="col-lg-6">
                <h2 class="nav-management-content-title">
                  <i class="fas fa-table me-2"></i>Danh sách NAV phiên giao dịch
                </h2>
                <p class="nav-management-content-subtitle">
                  <t t-if="state.showCalculatedResults">
                    Hiển thị <strong><t t-esc="state.calculatedTransactions ? state.calculatedTransactions.length : 0"/></strong> lệnh có lãi (đã lọc từ tính toán NAV)
                  </t>
                  <t t-else="">
                  Hiển thị <strong><t t-esc="state.filteredTransactions ? state.filteredTransactions.length : 0"/></strong> trong tổng số <strong><t t-esc="state.totalTransactions"/></strong> phiên giao dịch
                  </t>
                </p>
              </div>
              <div class="col-lg-6">
                <div class="d-flex gap-2 justify-content-end flex-wrap">
                  <button class="nav-management-btn-modern nav-management-btn-secondary-modern" t-on-click="exportData">
                    <i class="fas fa-download me-2"></i>Xuất CSV
                  </button>
                  <button class="nav-management-btn-modern nav-management-btn-primary-modern" t-on-click="calculateNavValue">
                    <i class="fas fa-calculator me-2"></i>Tính giá trị NAV
                  </button>
                  <button t-if="state.showCalculatedResults" class="nav-management-btn-modern nav-management-btn-secondary-modern" t-on-click="showOriginalData">
                    <i class="fas fa-list me-2"></i>Xem danh sách gốc
                  </button>
                  <button class="nav-management-btn-modern nav-management-btn-primary-modern" t-on-click="refreshData">
                    <i class="fas fa-sync-alt me-2"></i>Làm mới
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Filters Section -->
          <div class="filters-section mb-4">
            <div class="card">
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <label for="fundFilter" class="nav-management-form-label">Quỹ:</label>
                    <select id="fundFilter" class="nav-management-form-select" t-on-change="onFundFilterChange">
                                  <t t-foreach="state.funds" t-as="fund" t-key="fund.id">
                                    <option t-att-value="fund.id" t-att-selected="state.selectedFundId === fund.id">
                                      <t t-esc="fund.name"/> (<t t-esc="fund.ticker"/>)
                                    </option>
                                  </t>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label for="singleDateFilter" class="nav-management-form-label">Ngày giao dịch:</label>
                    <input type="date" id="singleDateFilter" class="nav-management-form-control" t-att-value="state.selectedDate" t-on-change="onSingleDateFilterChange"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- NAV Daily Chart Section -->
          <div class="mb-4">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h5 class="mb-0">Biểu đồ NAV theo ngày</h5>
                  <small class="text-muted">Hiển thị theo quỹ và khoảng ngày đã chọn</small>
                </div>
                <div class="nav-management-chart-container" style="width:100%;height:300px;position:relative;">
                  <canvas id="navChartCanvas"></canvas>
                  <t t-if="!state.chartPoints || !state.chartPoints.length">
                    <div class="text-center text-muted" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">Không có dữ liệu trong khoảng đã chọn</div>
                  </t>
                </div>
              </div>
            </div>
          </div>

          <!-- Table Container -->
          <div class="nav-management-table-container">
            <table class="nav-management-modern-table compact">
              <thead>
                <tr>
                  <th style="width: 50px;">Chọn</th>
                  <th style="width: 50px;">STT</th>
                  <th class="sortable" t-on-click="() => this.sortBy('investor_name')">
                    Nhà đầu tư
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('investor_name')"></i>
                  </th>
                  <th style="width: 80px;">Loại</th>
                  <th class="sortable" t-on-click="() => this.sortBy('transaction_date')">
                    Ngày
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('transaction_date')"></i>
                  </th>
                  <th class="sortable" style="width: 80px;" t-on-click="() => this.sortBy('term_months')">
                    Kỳ hạn
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('term_months')"></i>
                  </th>
                  <th class="sortable" t-on-click="() => this.sortBy('units')">
                    Số CCQ
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('units')"></i>
                  </th>
                  <th class="sortable" t-on-click="() => this.sortBy('nav_value')">
                    Giá NAV
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('nav_value')"></i>
                  </th>
                  <th class="sortable" t-on-click="() => this.sortBy('trade_price')">
                    Giá trị lệnh
                    <i t-att-class="'fas ms-1 ' + this.getSortIcon('trade_price')"></i>
                  </th>
                  <th style="width: 120px;">Thao tác</th>
                </tr>
                <tr class="nav-management-filter-row">
                  <th>
                    <input type="checkbox" t-on-change="(ev) => this.toggleSelectAll(ev.target.checked)"/>
                  </th>
                  <th></th>
                  <th><input type="text" class="nav-management-filter-input" placeholder="Tìm kiếm..." t-on-input="(ev) => this.filterTable('investor_name', ev.target.value)" /></th>
                  <th></th>
                  <th></th>
                  <th>
                    <select class="nav-management-form-select" style="font-size: 0.75rem; padding: 0.25rem;" t-on-change="onTermFilterChange">
                      <option value="">Tất cả</option>
                      <t t-foreach="[1,2,3,4,5,6,7,8,9,10,11,12]" t-as="m" t-key="m">
                        <option t-att-value="m"><t t-esc="m"/> tháng</option>
                      </t>
                    </select>
                  </th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th>
                    <button class="nav-management-btn-modern nav-management-btn-primary-modern" 
                            style="font-size: 0.7rem; padding: 0.25rem 0.5rem;" 
                            t-att-disabled="!state.navCalculated || this.getSelectedCount()===0" 
                            t-att-title="!state.navCalculated ? 'Vui lòng tính NAV trước' : (this.getSelectedCount()===0 ? 'Chọn ít nhất 1 giao dịch' : 'Thực hiện giao dịch với NTL')"
                            t-on-click="() => this.handleMmBulkAction()">
                      <i class="fas fa-exchange-alt me-1"></i>Giao dịch (<t t-esc="this.getSelectedCount()"/>)
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <t t-if="state.loading">
                  <tr>
                    <td colspan="10" class="text-center py-5">
                      <div class="nav-management-loading-state">
                      <div class="nav-management-spinner-border"></div>
                        <h4 class="nav-management-loading-title mt-3">Đang tải...</h4>
                      </div>
                    </td>
                  </tr>
                </t>
                <t t-elif="state.error">
                  <tr>
                    <td colspan="10" class="text-center py-5">
                      <div class="nav-management-error-state">
                        <i class="fas fa-exclamation-triangle nav-management-error-icon"></i>
                        <h4 class="nav-management-error-title">Lỗi</h4>
                        <p class="nav-management-error-description"><t t-esc="state.error"/></p>
                        <button class="nav-management-btn-modern nav-management-btn-primary-modern mt-3" t-on-click="() => this.loadData()">
                          <i class="fas fa-redo me-2"></i>Thử lại
                        </button>
                      </div>
                    </td>
                  </tr>
                </t>
                <t t-elif="(state.showCalculatedResults ? state.calculatedTransactions : state.filteredTransactions) and (state.showCalculatedResults ? state.calculatedTransactions : state.filteredTransactions).length > 0">
                  <t t-foreach="(state.showCalculatedResults ? state.calculatedTransactions : state.filteredTransactions).slice(state.startIndex, state.endIndex)" t-as="transaction" t-key="transaction.id">
                    <tr class="nav-management-fade-in">
                      <td class="text-center">
                        <input type="checkbox" t-att-checked="this.isSelected(transaction.id)" t-on-change="(ev) => this.toggleSelect(transaction, ev.target.checked)"/>
                      </td>
                      <td class="text-center"><t t-esc="state.startIndex + transaction_index + 1"/></td>
                      <td>
                        <div class="fw-semibold"><t t-esc="this.getDisplayValue(transaction.investor_name)"/></div>
                      </td>
                      <td class="text-center">
                        <span t-att-class="'badge-chip ' + this.getTypeBadgeClass(transaction)"><t t-esc="this.getTypeLabel(transaction)"/></span>
                      </td>
                      <td class="text-center"><t t-esc="this.formatDateOnly(transaction.transaction_date || transaction.created_at)"/></td>
                      <td class="text-center"><t t-esc="transaction.term_months ? transaction.term_months + 'M' : '-'"/></td>
                      <td class="text-center"><t t-esc="transaction.units || 0"/></td>
                      <td class="text-center"><t t-esc="this.formatCurrency(transaction.nav_value)"/></td>
                      <td class="text-center fw-semibold"><t t-esc="this.formatCurrency(transaction.trade_price || 0)"/></td>
                      <td class="text-center">
                        <button class="nav-management-btn-modern nav-management-btn-secondary-modern" 
                                style="font-size: 0.7rem; padding: 0.2rem 0.4rem;"
                                t-on-click="() => this.showTransactionDetails(transaction)"
                                title="Xem chi tiết">
                          <i class="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  </t>
                </t>
                <t t-else="">
                  <tr>
                    <td colspan="10" class="text-center py-5">
                      <div class="nav-management-empty-state">
                        <i class="fas fa-folder-open nav-management-empty-state-icon"></i>
                        <h4 class="nav-management-empty-state-title">Không có dữ liệu</h4>
                        <p class="nav-management-empty-state-description">Vui lòng chọn quỹ và điều kiện lọc để xem dữ liệu</p>
                      </div>
                    </td>
                  </tr>
                </t>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="nav-management-pagination-modern">
            <div class="nav-management-pagination-info">
              <t t-set="currentData" t-value="state.showCalculatedResults ? state.calculatedTransactions : state.filteredTransactions"/>
              Hiển thị <strong><t t-esc="state.startIndex + 1"/></strong> đến <strong><t t-esc="Math.min(state.endIndex, currentData.length)"/></strong> trong tổng số <strong><t t-esc="currentData.length"/></strong> kết quả
            </div>
            <div class="nav-management-pagination-controls">
              <button class="nav-management-page-btn" t-att-disabled="state.currentPage === 1" t-on-click="() => this.changePage(state.currentPage - 1)">
                <i class="fas fa-chevron-left"></i>
              </button>
              <t t-foreach="state.pageNumbers" t-as="page" t-key="page">
                <button t-att-class="'nav-management-page-btn ' + (page === state.currentPage ? 'active' : '')" t-on-click="() => this.changePage(page)">
                  <t t-esc="page"/>
                </button>
              </t>
              <button class="nav-management-page-btn" t-att-disabled="state.currentPage === state.totalPages" t-on-click="() => this.changePage(state.currentPage + 1)">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
          </t>

          <t t-if="state.currentTab==='mm'">
          <!-- Market Maker Matched Orders Section -->
          <div class="nav-management-content-header mt-4">
            <div class="d-flex justify-content-between align-items-center">
              <h2 class="nav-management-content-title">Lệnh mua bán trong ngày của Nhà tạo lập</h2>
              <div class="d-flex gap-2">
                <button class="nav-management-btn-modern nav-management-btn-primary-modern" t-on-click="loadMatchedOrders">
                  <i class="fas fa-sync-alt me-2"></i>Tải dữ liệu
                </button>
              </div>
            </div>
          </div>

          <!-- Matched Orders Content -->
          <div class="matched-orders-container">
            <!-- Filter Row (Fund + Date) -->
            <div class="row g-2 align-items-end mb-3">
              <div class="col-md-4">
                <label class="nav-management-form-label">Quỹ</label>
                <select class="nav-management-form-select" t-model="state.mmFilters.fund_id" t-on-change="onFilterChanged">
                  <option value="">Tất cả quỹ</option>
                  <t t-foreach="state.fundOptions" t-as="f" t-key="f.id">
                    <option t-att-value="f.id"><t t-esc="f.name"/></option>
                  </t>
                </select>
              </div>
              <div class="col-md-4">
                <label class="nav-management-form-label">Ngày</label>
                <input type="date" class="nav-management-form-control" t-model="state.mmFilters.date" t-on-change="onFilterChanged"/>
              </div>
              <div class="col-md-4">
                <!-- Buttons removed as requested -->
              </div>
            </div>
            
            <!-- Matched Orders Table -->
            <div class="nav-management-table-container">
              <table class="nav-management-modern-table">
                <thead>
                  <tr>
                    <th style="width: 50px;">
                      <input type="checkbox" t-on-change="(ev) => this.toggleSelectAllMatchedOrders(ev.target.checked)" title="Chọn tất cả"/>
                    </th>
                    <th style="width: 50px;">STT</th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('buy_investor')">
                      Người mua
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('buy_investor')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('sell_investor')">
                      Người bán
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('sell_investor')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('matched_price')">
                      Giá
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('matched_price')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('matched_ccq')">
                      Số CCQ
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('matched_ccq')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('order_value')">
                      Giá trị lệnh
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('order_value')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('interest_rate')">
                      Lãi suất
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('interest_rate')"></i>
                    </th>
                    <th class="sortable" t-on-click="() => this.sortMmBy('term')">
                      Kỳ hạn
                      <i t-att-class="'fas ms-1 ' + this.getMmSortIcon('term')"></i>
                    </th>
                    <th>Phiên GD</th>
                    <th style="width: 80px;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <t t-if="state.mmLoading">
                    <tr>
                      <td colspan="11" class="text-center py-4">
                        <div class="nav-management-loading-state">
                          <i class="fas fa-spinner fa-spin nav-management-loading-icon"></i>
                          <h3 class="nav-management-loading-title">Đang tải dữ liệu...</h3>
                          <p class="nav-management-loading-description">Vui lòng chờ trong giây lát.</p>
                        </div>
                      </td>
                    </tr>
                </t>
                <t t-elif="state.mmError">
                    <tr>
                      <td colspan="11" class="text-center py-4">
                        <div class="nav-management-error-state">
                          <i class="fas fa-exclamation-triangle nav-management-error-icon"></i>
                          <h3 class="nav-management-error-title">Lỗi tải dữ liệu</h3>
                          <p class="nav-management-error-description"><t t-esc="state.mmError"/></p>
                          <button class="nav-management-btn-modern nav-management-btn-primary-modern mt-3" t-on-click="loadMatchedOrders">
                            <i class="fas fa-redo me-2"></i>Thử lại
                          </button>
                        </div>
                      </td>
                    </tr>
                  </t>
                <t t-elif="state.matchedOrders and state.matchedOrders.length">
                  <t t-foreach="state.displayedMatchedOrders" t-as="order" t-key="order.id || order_index">
                      <tr>
                      <td class="text-center">
                        <input type="checkbox" t-att-checked="this.isMatchedOrderSelected(order)" t-on-change="(ev) => this.toggleSelectMatchedOrder(order, ev.target.checked)"/>
                      </td>
                      <td class="text-center"><t t-esc="(state.matchedOrdersPagination.currentPage - 1) * state.matchedOrdersPagination.itemsPerPage + order_index + 1"/></td>
                        
                        <!-- Người mua -->
                        <td class="text-center">
                          <div class="investor-info">
                            <div class="investor-name" style="color: #28a745; font-weight: 600; font-size: 0.8rem;">
                              <t t-esc="order.buy_investor || order.buy_name || order.buy_investor_name || order.buy_user_name || order.buyer_name || 'N/A'"/>
                            </div>
                            <div class="investor-details" style="font-size: 0.7rem; color: #6c757d;">
                              <t t-if="order.buy_account_number || order.buy_stk">
                                <small>STK: <t t-esc="order.buy_account_number || order.buy_stk"/></small><br/>
                              </t>
                              <small>CCQ: <t t-esc="this.formatNumber(order.buy_units || 0)"/></small>
                            </div>
                          </div>
                        </td>
                        
                        <!-- Người bán -->
                        <td class="text-center">
                          <div class="investor-info">
                            <div class="investor-name" style="color: #dc3545; font-weight: 600; font-size: 0.8rem;">
                              <t t-esc="order.sell_investor || order.sell_name || order.sell_investor_name || order.sell_user_name || order.seller_name || 'N/A'"/>
                            </div>
                            <div class="investor-details" style="font-size: 0.7rem; color: #6c757d;">
                              <t t-if="order.sell_account_number || order.sell_stk">
                                <small>STK: <t t-esc="order.sell_account_number || order.sell_stk"/></small><br/>
                              </t>
                              <small>CCQ: <t t-esc="this.formatNumber(order.sell_units || 0)"/></small>
                            </div>
                          </div>
                        </td>
                        
                        <!-- Giá -->
                        <td class="text-center">
                          <div class="price-info" style="font-weight: 600; color: #28a745; font-size: 0.8rem;">
                            <t t-esc="this.formatCurrency(order.matched_price || order._matched_price || 0)"/>
                          </div>
                        </td>
                        
                        <!-- Số CCQ -->
                        <td class="text-center">
                          <div class="ccq-info" style="font-size: 0.75rem; color: #6c757d;">
                            <span class="ccq-label">Khớp:</span>
                            <span class="ccq-value"><t t-esc="this.formatNumber(order.matched_ccq || order.matched_quantity || order._matched_ccq || 0)"/></span>
                          </div>
                        </td>
                        
                      <!-- Giá trị lệnh -->
                      <td class="text-center">
                        <div style="font-size: 0.75rem; color: #6c757d; font-weight: 600;">
                          <t t-set="_price" t-value="order.matched_price || order._matched_price || 0"/>
                          <t t-set="_ccq" t-value="order.matched_ccq || order.matched_quantity || order._matched_ccq || 0"/>
                          <t t-esc="this.formatCurrency((_price || 0) * (_ccq || 0))"/>
                        </div>
                      </td>
                        
                        <!-- Lãi suất -->
                        <td class="text-center" style="font-size: 0.75rem; color: #6c757d;">
                          <t t-esc="order.interest_rate ? (order.interest_rate + '%') : '-'"/>
                        </td>
                        
                        <!-- Kỳ hạn -->
                        <td class="text-center" style="font-size: 0.75rem; color: #6c757d;">
                          <t t-esc="order.term ? (order.term + ' tháng') : '-'"/>
                        </td>
                        
                        <!-- Phiên giao dịch -->
                        <td class="text-center">
                          <div class="transaction-time-info" style="font-size: 0.7rem;">
                            <div style="color: #28a745; font-weight: 600;">
                              In: <t t-esc="order.buy_in_time || order.buy_created_at || order._in_time || '-'"/>
                            </div>
                            <t t-if="order.buy_out_time || order._out_time">
                              <div style="color: #dc3545; font-weight: 600;">
                                Out: <t t-esc="order.buy_out_time || order._out_time"/>
                              </div>
                            </t>
                          </div>
                        </td>
                        
                        <!-- Thao tác -->
                        <td class="text-center">
                          <button class="btn-send-exchange" 
                                  t-att-data-pair-id="(order.buy_id || '') + '-' + (order.sell_id || '')"
                                  title="Gửi lên sàn"
                                  style="background:#f97316;color:white;border:1px solid #f97316;border-radius:4px;padding:5px 8px;cursor:pointer;transition:all 0.3s;font-size:12px;">
                            <i class="fas fa-paper-plane"></i>
                          </button>
                        </td>
                    </tr>
                  </t>
                </t>
                  <t t-else="">
                    <tr>
                      <td colspan="11" class="text-center py-5">
                        <div class="nav-management-empty-state">
                          <i class="fas fa-handshake nav-management-empty-state-icon"></i>
                          <h3 class="nav-management-empty-state-title">Không có dữ liệu</h3>
                          <p class="nav-management-empty-state-description">Chưa có cặp lệnh nào được khớp. Hãy thử khớp lệnh để xem kết quả.</p>
                        </div>
                      </td>
                    </tr>
                  </t>
              </tbody>
            </table>
          </div>

            <!-- Pagination -->
            <div t-if="state.matchedOrdersPagination.totalItems > state.matchedOrdersPagination.itemsPerPage" class="pagination-container mt-3 d-flex justify-content-end">
              <div class="pagination-controls">
                <button class="page-btn" t-att-disabled="state.matchedOrdersPagination.currentPage === 1" t-on-click="() => this.changeMatchedOrdersPage(state.matchedOrdersPagination.currentPage - 1)">
                  <i class="fas fa-chevron-left"></i>
                </button>
                <t t-foreach="Array.from({length: this.getMatchedOrdersTotalPages()}, (_, i) => i + 1)" t-as="page" t-key="page">
                  <button class="page-btn" t-att-class="page === state.matchedOrdersPagination.currentPage ? 'active' : ''" t-on-click="() => this.changeMatchedOrdersPage(page)">
                    <t t-esc="page"/>
                  </button>
                </t>
                <button class="page-btn" t-att-disabled="state.matchedOrdersPagination.currentPage === this.getMatchedOrdersTotalPages()" t-on-click="() => this.changeMatchedOrdersPage(state.matchedOrdersPagination.currentPage + 1)">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
          </t>
        </div>
      </div>
    </div>
  `;

  setup() {
    this.state = useState({
      transactions: [],
      filteredTransactions: [],
      allFundTransactions: [], // Lưu tất cả dữ liệu NAV gốc của fund để hiển thị biểu đồ
      funds: this.props.funds || [],
      searchTerm: '',
      currentTab: 'nav',
      currentPage: 1,
      pageSize: 10,
      startIndex: 0,
      endIndex: 10,
      totalPages: 1,
      pageNumbers: [],
      totalTransactions: 0,
      totalNavValue: 0,
      averageNavValue: 0,
      todayTransactions: 0,
      selectedDate: '', // Will be set to today on mount
      // Sort state
      sortColumn: 'transaction_date',
      sortDirection: 'desc',
        // Selection state for bulk MM actions
        selectedTxIds: new Set(),
      // Selection state for matched orders
      selectedMatchedOrderIds: new Set(),
      loading: false,
      error: null,
      selectedFundId: this.props.selectedFundId || (this.props.funds && this.props.funds.length ? this.props.funds[0].id : null),
      filters: {
        investor_name: '',
        term_months: '',
        units: '',
        nav_value: ''
      },
      termRateLabel: '...',
      termRateMap: {}, // key: month => rate
      capConfig: { cap_upper: null, cap_lower: null },
      // Matched pairs state
      mmPairs: [],
      mmLoading: false,
      mmError: null,
      mmSourceType: 'market_maker',
      showIframe: false,
      mmSourceType: 'market_maker',
      showIframe: false,
      matchedOrders: [],
      filteredMatchedOrders: [],
      displayedMatchedOrders: [],
      matchedOrdersPagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
      },
      // simple filter state for matched orders
      mmFilters: {
        fund_id: '',
        date: '', // yyyy-mm-dd
      },
      fundOptions: [],
      dynamicFilter: {},
      // MM Sort state
      mmSortColumn: 'matched_price',
      mmSortDirection: 'desc',
      // Chart state
      chartPoints: [], // [{x: timestamp, y: nav_value}]
      chartMin: 0,
      chartMax: 0,
        navCalculated: false,
      calculatedTransactions: [], // Lưu kết quả tính toán NAV
      showCalculatedResults: false, // Flag để hiển thị kết quả tính toán thay vì dữ liệu gốc
    });

    this._chart = null;
    this._renderingChart = false; // Add rendering lock

    // Gọi loadData sau khi component được mount
    onMounted(() => {
      // Set ngày hôm nay làm mặc định
      this.setTodayAsDefault();
      this.loadData();
      this.loadChartData();
      this.loadMmPairs();
      this.loadConfigs();
      // Render chart on first mount and on resize
      window.addEventListener('resize', () => this.updateChartFromAllFundData());
      
      // Thêm event listener cho button gửi lên sàn
      document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-send-exchange')) {
          e.preventDefault();
          e.stopPropagation();
          const btn = e.target.closest('.btn-send-exchange');
          const pairId = btn.getAttribute('data-pair-id');
          
          // Kiểm tra xem đã gửi chưa
          if (btn.classList.contains('sent')) {
            this.showPopup({
              title: 'Đã gửi',
              message: 'Cặp lệnh này đã được gửi lên sàn!',
              type: 'warning'
            });
            return;
          }
          
          this.sendPairToExchange(pairId, btn);
        }
      });
    });

    // Cleanup khi component bị destroy
    onWillUnmount(() => {
      // Dọn dẹp timer nếu có
      if (this._realtimeTimer) {
        clearInterval(this._realtimeTimer);
        this._realtimeTimer = null;
      }
      // Dọn dẹp chart
      if (this._chart) {
        this._chart.destroy();
        this._chart = null;
      }
    });
  }

  // Show transaction details in a popup
  showTransactionDetails(transaction) {
    const details = [
      `Investor: ${transaction.investor_name || 'N/A'}`,
      `Type: ${this.getTypeLabel(transaction)}`,
      `Date: ${this.formatDateOnly(transaction.transaction_date)}`,
      `Maturity: ${transaction.maturity_date ? this.formatDateOnly(transaction.maturity_date) : 'N/A'}`,
      `Days: ${transaction.days || 'N/A'}`,
      `Term: ${transaction.term_months || 'N/A'} months`,
      `CCQ Units: ${transaction.units || 0}`,
      `NAV Price: ${this.formatCurrency(transaction.nav_value)}`,
      `Interest Rate: ${this.formatPercent(transaction.interest_rate)}`,
      `Converted Rate: ${this.formatPercentFixed2(transaction.interest_rate_new)}`,
      `Rate Delta: ${this.formatDeltaPercent(transaction.interest_delta)}`,
      `Order Value: ${this.formatCurrency(transaction.trade_price || 0)}`,
      `Sell Value: ${this.formatCurrency(transaction.sell_value || 0)}`,
      `Price 1: ${this.formatCurrency(transaction.price1 || 0)}`,
      `Price 2: ${this.formatCurrency(transaction.price2 || 0)}`,
    ].join('\n');
    
    alert(`Transaction Details\n${'─'.repeat(30)}\n${details}`);
  }

  // Set today's date as default for filters
  setTodayAsDefault() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    this.state.selectedDate = todayStr;
    this.state.mmFilters.date = todayStr;
  }

  // Sort table by column
  sortBy(column) {
    if (this.state.sortColumn === column) {
      // Toggle direction
      this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortColumn = column;
      this.state.sortDirection = 'asc';
    }
    this.applySorting();
  }

  // Get sort icon class for column
  getSortIcon(column) {
    if (this.state.sortColumn !== column) {
      return 'fa-sort text-muted';
    }
    return this.state.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // Apply sorting to filtered data
  applySorting() {
    const col = this.state.sortColumn;
    const dir = this.state.sortDirection;
    
    const sortFn = (a, b) => {
      let valA = a[col];
      let valB = b[col];
      
      // Handle null/undefined
      if (valA == null) valA = '';
      if (valB == null) valB = '';
      
      // Handle dates
      if (col === 'transaction_date' || col === 'created_at') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }
      // Handle numbers
      else if (typeof valA === 'number' || typeof valB === 'number') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      // Handle strings
      else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    };
    
    this.state.filteredTransactions.sort(sortFn);
    if (this.state.calculatedTransactions) {
      this.state.calculatedTransactions.sort(sortFn);
    }
    this.updatePagination();
  }

  // Sort matched orders table by column
  sortMmBy(column) {
    if (this.state.mmSortColumn === column) {
      this.state.mmSortDirection = this.state.mmSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.mmSortColumn = column;
      this.state.mmSortDirection = 'asc';
    }
    this.applyMmSorting();
  }

  getMmSortIcon(column) {
    if (this.state.mmSortColumn !== column) return 'fa-sort text-muted';
    return this.state.mmSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  applyMmSorting() {
    const col = this.state.mmSortColumn;
    const dir = this.state.mmSortDirection;
    
    // Sort filteredMatchedOrders instead of matchedOrders
    this.state.filteredMatchedOrders.sort((a, b) => {
      let valA = a[col] || a['_' + col] || a[col.replace('matched_', '')] || '';
      let valB = b[col] || b['_' + col] || b[col.replace('matched_', '')] || '';
      
      // Handle numbers
      if (['matched_price', 'matched_ccq', 'order_value', 'interest_rate', 'term'].includes(col)) {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updateMatchedOrdersPagination();
  }

  // Parse chuỗi ngày/giờ về Date local an toàn (tránh lệch timezone khi chuỗi chỉ có yyyy-mm-dd)
  parseDateStringToLocal(dateStr) {
    try {
      if (!dateStr) return null;
      const s = String(dateStr);
      // Nếu chỉ có yyyy-mm-dd, tạo Date theo local (year, month-1, day)
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
        return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
      }
      // Nếu ở dạng 'yyyy-mm-dd hh:mm:ss', đổi sang ISO nhẹ để Date parse đúng local
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        const isoLike = s.replace(' ', 'T');
        return new Date(isoLike);
      }
      // Trường hợp khác: để Date tự parse
      return new Date(s);
    } catch (_) {
      return null;
    }
  }

  // Lấy timestamp đầu-cuối của 1 ngày (local) từ chuỗi yyyy-mm-dd
  getDayRangeTimestamps(dayStr) {
    try {
      if (!dayStr) return { fromTime: null, toTime: null };
      if (/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) {
        const [y, m, d] = dayStr.split('-').map((x) => parseInt(x, 10));
        const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
        const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
        return { fromTime: start, toTime: end };
      }
      // Fallback: parse rồi lấy đầu-cuối ngày từ đối tượng Date
      const dt = this.parseDateStringToLocal(dayStr);
      if (!(dt instanceof Date) || isNaN(dt)) return { fromTime: null, toTime: null };
      const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999).getTime();
      return { fromTime: start, toTime: end };
    } catch (_) {
      return { fromTime: null, toTime: null };
    }
  }

  async computeMetricsServer(items) {
    try {
      if (!Array.isArray(items) || items.length === 0) return [];
      const res = await fetch('/nav_management/api/calc_metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { items }
        })
      });
      if (!res.ok) return this._fillComputedFields(items);
      const data = await res.json();
      if (data && data.result && data.result.success && Array.isArray(data.result.items)) {
        return this._fillComputedFields(data.result.items);
      }
      return this._fillComputedFields(items);
    } catch (e) {
      return this._fillComputedFields(items);
    }
  }

  _fillComputedFields(items) {
    try {
      return (items || []).map((raw) => {
        const tx = { ...raw };
        
        // Ưu tiên sử dụng data từ server (đã tính toán bằng compute_transaction_metrics_full)
        // Nếu server đã trả về đầy đủ các field mới, sử dụng chúng
        if (tx.sell_value1 !== undefined || tx.sell_value2 !== undefined || 
            tx.sell_price1 !== undefined || tx.sell_price2 !== undefined ||
            tx.purchase_value !== undefined || tx.price_with_fee !== undefined) {
          // Server đã tính toán đầy đủ, chỉ cần format date
          return {
            ...tx,
            // Format các date fields nếu có
            sell_date_formatted: tx.sell_date ? this.formatDateOnly(tx.sell_date) : null,
            maturity_date_formatted: tx.maturity_date ? this.formatDateOnly(tx.maturity_date) : null,
            purchase_date_formatted: tx.purchase_date || tx.transaction_date ? this.formatDateOnly(tx.purchase_date || tx.transaction_date) : null,
          };
        }
        
        // Fallback: tính toán local nếu server chưa trả về đầy đủ
        const nav = Number(tx.nav_value || 0);
        const units = Number((tx.remaining_units != null ? tx.remaining_units : tx.units) || 0);
        const rate = Number(tx.interest_rate || 0);
        const orderValue = Number(tx.trade_price || tx.amount || (units * nav) || 0);
        
        // days: ưu tiên server, sau đó tính theo kỳ hạn
        let days = Number(tx.days_effective != null ? tx.days_effective : (tx.days || 0));
        if (!days || days <= 0) {
          days = this.computeDays(tx);
        }
        
        // Giá trị bán 1 (U) = Giá trị mua * Lãi suất / 365 * Số ngày + Giá trị mua
        let sellValue1 = Number(tx.sell_value1 || tx.sell_value || 0);
        if (!sellValue1 && orderValue > 0 && rate >= 0 && days > 0) {
          sellValue1 = orderValue * (rate / 100) / 365 * days + orderValue;
        }
        
        // Giá bán 1 (S) = ROUND(Giá trị bán 1 / Units, 0)
        let sellPrice1 = Number(tx.sell_price1 || tx.price1 || 0);
        if (!sellPrice1 && sellValue1 && units > 0) {
          sellPrice1 = Math.round(sellValue1 / units);
        }
        
        // Giá bán 2 (T) = MROUND(Giá bán 1, 50)
        let step = Number(tx.round_step || 50);
        if (!step || step <= 0) step = 50;
        let sellPrice2 = Number(tx.sell_price2 || tx.price2 || 0);
        if (!sellPrice2 && sellPrice1) {
          sellPrice2 = Math.round(sellPrice1 / step) * step;
        }
        
        // Giá trị bán 2 (V) = Units * Giá bán 2
        let sellValue2 = Number(tx.sell_value2 || 0);
        if (!sellValue2 && units > 0 && sellPrice2 > 0) {
          sellValue2 = units * sellPrice2;
        }
        
        // Lãi suất quy đổi (O) = (Giá bán 2 / Giá mua - 1) * 365 / Số ngày * 100
        const pricePerUnit = Number(tx.price_per_unit || tx.price || nav || 0);
        let convertedRate = (tx.converted_rate != null) ? Number(tx.converted_rate) : null;
        if ((convertedRate === null || Number.isNaN(convertedRate)) && pricePerUnit > 0 && days > 0 && sellPrice2) {
          convertedRate = ((sellPrice2 / pricePerUnit) - 1) * 365 / days * 100;
        }
        
        // Chênh lệch lãi suất (Q) = Lãi suất quy đổi - Lãi suất
        let delta = (tx.interest_delta != null) ? Number(tx.interest_delta) : null;
        if ((delta === null || Number.isNaN(delta)) && convertedRate != null && !Number.isNaN(rate)) {
          delta = convertedRate - rate;
        }

        return {
          ...tx,
          sell_value: sellValue1,
          sell_value1: sellValue1,
          sell_value2: sellValue2,
          price1: sellPrice1,
          sell_price1: sellPrice1,
          sell_price2: sellPrice2,
          price2: sellPrice2,
          interest_rate_new: convertedRate,
          converted_rate: convertedRate,
          interest_delta: delta,
          // Format date fields
          sell_date_formatted: tx.sell_date ? this.formatDateOnly(tx.sell_date) : null,
          maturity_date_formatted: tx.maturity_date ? this.formatDateOnly(tx.maturity_date) : null,
          purchase_date_formatted: tx.purchase_date || tx.transaction_date ? this.formatDateOnly(tx.purchase_date || tx.transaction_date) : null,
        };
      });
    } catch (_) {
      return items || [];
    }
  }

  setTodayAsDefault() {
    // Set ngày hôm nay vào single date filter
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // yyyy-mm-dd format
    
    // Wait for DOM to be ready
    setTimeout(() => {
      
      const singleDateFilter = document.getElementById('singleDateFilter');
      const quickDateFilter = document.getElementById('quickDateFilter');
      
      if (singleDateFilter) {
        singleDateFilter.value = todayString;
      }
      
      if (quickDateFilter) {
        quickDateFilter.value = 'today';
      }
    }, 100);
  }

  async parseJsonSafe(res) {
    const ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
    if (!ct.includes('application/json')) return null;
    return await res.json();
  }

  async handleMmAction(tx) {
    try {
      // Kiểm tra điều kiện CÓ LÃI trên server trước khi tạo lệnh NTL
      const fundId = this.state.selectedFundId;
      const { fromDate, toDate } = this.getDateFilter();
      const profitableIds = await this.getProfitableTxIds(fundId, fromDate, toDate);
      if (!profitableIds.has(Number(tx?.id))) {
        this.showPopup({ title: 'Thông tin', message: 'Lệnh không thỏa điều kiện lãi theo cấu hình hiện hành.', type: 'warning' });
        return;
      }

      // Gọi API NTL xử lý một giao dịch pending
      const data = await this.rpc('/api/transaction-list/market-maker/handle-one', { transaction_id: tx?.id });
      const ok = data && data.success;
      this.showPopup({
        title: ok ? 'Gửi lệnh Buy/Sell thành công' : 'Gửi lệnh Buy/Sell thất bại',
        message: ok ? 'Hệ thống đã ghi nhận yêu cầu Buy/Sell.' : ((data && (data.message)) || 'Phản hồi không hợp lệ (có thể endpoint chưa tồn tại).'),
        type: ok ? 'success' : 'error'
      });
      if (ok) {
        await this.loadData();
        // Nếu trước đó đã tính NAV, giữ trạng thái và áp dụng lại kết quả lãi
        if (this.state.navCalculated) {
          // Tái tính trên dữ liệu mới để duy trì danh sách có lãi và không reload toàn trang
          await this.calculateNavValue();
        }
      }
    } catch (e) {
      this.showPopup({ title: 'Lỗi', message: e?.message || 'Không xác định', type: 'error' });
    }
  }

  async loadConfigs() {
    try {
      // term rates
      const r1 = await fetch('/nav_management/api/term_rates', { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (r1.ok) {
        const j = await this.parseJsonSafe(r1);
        if (j && j.success && j.rate_map) {
          this.state.termRateMap = j.rate_map || {};
        }
      }
      // cap config
      const r2 = await fetch('/nav_management/api/cap_config', { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (r2.ok) {
        const j2 = await this.parseJsonSafe(r2);
        if (j2 && j2.success) {
          this.state.capConfig.cap_upper = j2.cap_upper;
          this.state.capConfig.cap_lower = j2.cap_lower;
        }
      }
    } catch (e) {
      // ignore, frontend sẽ fallback nếu cần
    }
  }

  async ensureChartJs() {
    if (window.Chart) return;
    // load Chart.js v4 from CDN if not loaded
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nav-chartjs]');
      if (existing && window.Chart) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.async = true;
      s.setAttribute('data-nav-chartjs', '1');
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
    // time adapter for time scale
    await new Promise((resolve, reject) => {
      if (window.dateFns) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  switchTab(tab) {
    if (!tab || this.state.currentTab === tab) return;
    this.state.currentTab = tab;
    if (tab === 'mm') {
      // Luôn load matched orders khi chuyển sang tab MM để đảm bảo có dữ liệu mới nhất
      console.log('Switching to MM tab, loading matched orders...');
      this.loadMatchedOrders();
    } else if (tab === 'nav') {
      // Khi quay lại tab NAV, chờ DOM render canvas rồi vẽ lại biểu đồ từ dữ liệu đã có
      const rerender = () => this.updateChartFromAllFundData();
      if (typeof window.requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(rerender));
      } else {
        setTimeout(rerender, 0);
      }
    }
  }

  async loadMmPairs() {
    try {
      this.state.mmLoading = true;
      this.state.mmError = null;
      const payload = { page: 1, limit: 500, source_type: this.state.mmSourceType };
      const response = await fetch('/api/transaction-list/matched-pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data && data.success) {
        this.state.mmPairs = data.matched_pairs || data.data || [];
      } else {
        this.state.mmError = (data && data.message) ? data.message : 'Không thể tải dữ liệu.';
      }
    } catch (e) {
      this.state.mmError = e.message || 'Lỗi không xác định';
    } finally {
      this.state.mmLoading = false;
    }
  }

  onMmSourceTypeChange(ev) {
    this.state.mmSourceType = ev.target.value || 'market_maker';
    this.loadMmPairs();
  }

  onFundFilterChange(event) {
    const fundId = event.target.value;
    this.state.selectedFundId = fundId ? parseInt(fundId) : null;
    // Đổi quỹ => gọi API để tải lại dữ liệu
    this.state.navCalculated = false;
    this.state.showCalculatedResults = false;
    this.state.calculatedTransactions = [];
    this.state.selectedTxIds = new Set();
    this.state.currentPage = 1;
    this.applyFilters();
    this.loadChartData();
    // Cập nhật statcard với giá NAV trung bình mới
    this.updateStatCard();
  }

  onSingleDateFilterChange() {
    // Reset quick filter when manual date is selected
    const quickDateFilter = document.getElementById('quickDateFilter');
    if (quickDateFilter) quickDateFilter.value = '';
    
    // Gọi lại API để áp dụng ngày đã chọn
    this.state.navCalculated = false;
    this.state.showCalculatedResults = false;
    this.state.calculatedTransactions = [];
    this.state.selectedTxIds = new Set();
    this.state.currentPage = 1;
    this.applyFilters();
    this.loadChartData();
  }

  onQuickDateFilterChange(event) {
    const value = event.target.value;
    const singleDateFilter = document.getElementById('singleDateFilter');
    
    if (!value) return;
    
    const today = new Date();
    let targetDate = null;
    
    switch (value) {
      case 'today':
        targetDate = today;
        break;
      case 'yesterday':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 1);
        break;
      case 'last7days':
        // Xóa single date filter cho chế độ 7 ngày
        if (singleDateFilter) singleDateFilter.value = '';
        this.applyFilters();
        this.loadChartData();
        return;
      default:
        return;
    }
    
    // Set single date filter
    if (targetDate && singleDateFilter) {
      singleDateFilter.value = targetDate.toISOString().split('T')[0];
    }
    
    this.state.navCalculated = false;
    this.state.showCalculatedResults = false;
    this.state.calculatedTransactions = [];
    this.state.selectedTxIds = new Set();
    this.state.currentPage = 1;
    this.applyFilters();
    this.loadChartData();
  }

  onTermFilterChange(event) {
    const value = event.target.value;
    this.filterTable('term_months', value);
    const months = parseInt(value || '', 10);
    if (!Number.isNaN(months) && months >= 1 && months <= 12) {
      const rate = this.getRateForMonths(months);
      this.state.termRateLabel = rate !== null ? `${months} tháng — ${Number(rate).toFixed(2)}%` : '...';
    } else {
      this.state.termRateLabel = '...';
    }
  }

  applyFilters() {
    this.state.currentPage = 1;
    this.loadData();
  }

  async loadData() {
    try {
      // Đảm bảo state đã được khởi tạo
      if (!this.state) {
        console.error('State chưa được khởi tạo. Component chưa được setup.');
        return;
      }
      
      this.state.loading = true;
      this.state.error = null;
      
      // Load danh sách quỹ từ props (đã có sẵn)
      if (this.props.funds && this.props.funds.length > 0) {
        this.state.funds = this.props.funds;
      }
      
      // Lấy fund_id từ state hoặc URL, ưu tiên state; nếu rỗng sẽ dùng fund đầu tiên (đã set ở setup)
      const urlParams = new URLSearchParams(window.location.search);
      let fundId = this.state.selectedFundId || urlParams.get('fund_id') || (this.state.funds && this.state.funds.length ? this.state.funds[0].id : null);

      // Lấy bộ lọc ngày từ input
      const { fromDate, toDate } = this.getDateFilter();

      const response = await fetch('/nav_management/api/nav_transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            fund_id: fundId ? parseInt(fundId) : null,
            from_date: fromDate,
            to_date: toDate,
            status_filter: 'pending_remaining'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.result && result.result.nav_transactions) {
        // Loại bỏ giao dịch bị xóa (soft delete) ngay từ đầu
        const validTransactions = result.result.nav_transactions.filter(tx => tx.active !== false);
        // Ưu tiên tính toán từ server để tránh duplicate công thức với backend
        this.state.transactions = await this.computeMetricsServer(validTransactions);
        // Không set allFundTransactions ở đây; biểu đồ & thống kê sẽ dùng loadChartData
        this.applyLocalFilters();
        this.updatePagination();
        this.loadChartData();
      } else {
        this.state.transactions = [];
        this.state.filteredTransactions = [];
        // Không reset allFundTransactions ở đây; để loadChartData quyết định
        this.updatePagination();
        this.loadChartData();
      }
      
      this.state.loading = false;
      if (typeof window.hideSpinner === 'function') {
        window.hideSpinner();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.state.error = error.message;
      this.state.loading = false;
      if (typeof window.showError === 'function') {
        window.showError(error.message);
      }
    }
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    // Sử dụng parseDateStringToLocal để đảm bảo timezone đúng
    const date = this.parseDateStringToLocal(dateString);
    if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateOnly(dateString) {
    if (!dateString) return '-';
    try {
      // Sử dụng parseDateStringToLocal để đảm bảo timezone đúng
      const date = this.parseDateStringToLocal(dateString);
      if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (_) {
      return '-';
    }
  }

  // ===== Selection helpers for bulk MM =====
  isSelected(id) {
    try {
      return this.state.selectedTxIds && this.state.selectedTxIds.has(id);
    } catch (_) { return false; }
  }

  toggleSelect(tx, checked) {
    try {
      if (!this.state.selectedTxIds) this.state.selectedTxIds = new Set();
      if (checked) this.state.selectedTxIds.add(tx.id); else this.state.selectedTxIds.delete(tx.id);
    } catch (_) {}
  }

  toggleSelectAll(force) {
    try {
      const all = this.state.filteredTransactions || [];
      if (!this.state.selectedTxIds) this.state.selectedTxIds = new Set();
      const shouldSelect = (typeof force === 'boolean') ? force : (this.state.selectedTxIds.size !== all.length);
      this.state.selectedTxIds.clear();
      if (shouldSelect) {
        for (const tx of all) this.state.selectedTxIds.add(tx.id);
      }
    } catch (_) {}
  }

  getSelectedCount() {
    return this.state.selectedTxIds ? this.state.selectedTxIds.size : 0;
  }

  validateSelectedTransactionsForMM() {
    const ids = this.state.selectedTxIds ? Array.from(this.state.selectedTxIds) : [];
    if (!ids.length) {
      return { valid: false, error: 'Chưa chọn lệnh nào.' };
    }

    const currentData = this.state.showCalculatedResults ? this.state.calculatedTransactions : this.state.filteredTransactions;
    const selected = (currentData || []).filter(tx => ids.includes(tx.id));
    
    if (!selected.length) {
      return { valid: false, error: 'Không tìm thấy giao dịch đã chọn.' };
    }

    // Kiểm tra loại giao dịch hợp lệ
    const validTx = selected.filter(tx => {
      const type = (tx.transaction_type || '').toLowerCase();
      return type === 'buy' || type === 'sell';
    });

    if (!validTx.length) {
      return { valid: false, error: 'Các giao dịch đã chọn không phải là lệnh mua/bán hợp lệ.' };
    }

    // Kiểm tra remaining units > 0
    const validRemaining = validTx.filter(tx => {
      const remaining = Number(tx.remaining_units || (tx.units - (tx.matched_units || 0)) || 0);
      return remaining > 0;
    });

    if (!validRemaining.length) {
      return { valid: false, error: 'Các giao dịch đã chọn không còn units để xử lý (đã khớp hết).' };
    }

    return { 
      valid: true, 
      data: {
        selected: validRemaining,
        buys: validRemaining.filter(tx => tx.transaction_type.toLowerCase() === 'buy'),
        sells: validRemaining.filter(tx => tx.transaction_type.toLowerCase() === 'sell')
      }
    };
  }

  async handleMmBulkAction() {
    try {
      if (!this.state.navCalculated || !this.state.showCalculatedResults) {
        this.showPopup({ 
          title: 'Chưa đủ điều kiện', 
          message: 'Vui lòng tính NAV và có kết quả lãi trước khi thực hiện MM.', 
          type: 'warning' 
        });
        return;
      }
      
      // Validate selected transactions
      const validation = this.validateSelectedTransactionsForMM();
      if (!validation.valid) {
        this.showPopup({ 
          title: 'Validation lỗi', 
          message: validation.error, 
          type: 'warning' 
        });
        return;
      }
      
      const { buys, sells } = validation.data;

      // Lọc lại theo tập ID có lãi từ server để đảm bảo đồng nhất backend
      const fundId = this.state.selectedFundId;
      const { fromDate, toDate } = this.getDateFilter();
      const profitableIds = await this.getProfitableTxIds(fundId, fromDate, toDate);
      const remaining_buys = buys.map(tx => tx.id).filter(id => profitableIds.has(Number(id)));
      const remaining_sells = sells.map(tx => tx.id).filter(id => profitableIds.has(Number(id)));

      if (remaining_buys.length === 0 && remaining_sells.length === 0) {
        this.showPopup({ title: 'Thông tin', message: 'Không có giao dịch nào thỏa điều kiện lãi để xử lý.', type: 'info' });
        return;
      }

      console.log(`MM Processing: ${remaining_buys.length} buys, ${remaining_sells.length} sells`);

      // Hiển thị loading
      this.state.mmLoading = true;

      const res = await fetch('/api/transaction-list/market-maker/handle-remaining', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Requested-With': 'XMLHttpRequest' 
        },
        body: JSON.stringify({ 
          remaining_buys, 
          remaining_sells 
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      const ok = data && data.success;
      
      // Tạo message chi tiết từ response
      let successMessage = '';
      if (ok && data.handled) {
        const buysHandled = data.handled.buys ? data.handled.buys.length : 0;
        const sellsHandled = data.handled.sells ? data.handled.sells.length : 0;
        const totalPairs = data.matched_pairs ? data.matched_pairs.length : 0;
        
        successMessage = `Đã xử lý thành công:
        • ${buysHandled} lệnh mua của nhà đầu tư (NTL bán)
        • ${sellsHandled} lệnh bán của nhà đầu tư (NTL mua)
        • Tạo được ${totalPairs} cặp khớp lệnh`;
      }

      this.showPopup({
        title: ok ? 'Market Maker thành công' : 'Market Maker thất bại',
        message: ok ? 
          (successMessage || `Hệ thống đã xử lý ${remaining_buys.length} lệnh mua và ${remaining_sells.length} lệnh bán.`) : 
          ((data && data.error) || (data && data.message) || 'Có lỗi xảy ra từ server.'),
        type: ok ? 'success' : 'error'
      });
      
      if (ok) {
        // Reset selection
        this.state.selectedTxIds = new Set();
        
        // Hiển thị kết quả khớp nếu có (không chuyển tab)
        if (data.matched_pairs && data.matched_pairs.length > 0) {
          // Lưu matched pairs để hiển thị ở tab MM (nếu user muốn xem)
          this.state.matchedOrders = data.matched_pairs.map(pair => ({
            ...pair,
            _sourceType: 'market_maker'
          }));
          
          // KHÔNG chuyển sang tab MM - chỉ hiển thị popup thành công
          // Cập nhật pagination cho matched orders (để sẵn sàng nếu user chuyển tab)
          this.state.matchedOrdersPagination.totalItems = this.state.matchedOrders.length;
          this.state.matchedOrdersPagination.currentPage = 1;
          this.updateMatchedOrdersDisplay();
        }
        
        // Làm mới dữ liệu để cập nhật trạng thái
        await this.loadData();
        
        // Giữ nguyên trạng thái sau khi MM: áp dụng lại tính NAV (nếu đang bật)
        if (this.state.navCalculated && this.state.showCalculatedResults) {
          await this.calculateNavValue();
        }
      }
    } catch (error) {
      console.error('Error in MM bulk action:', error);
      this.showPopup({ 
        title: 'Lỗi hệ thống', 
        message: `Có lỗi xảy ra: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      this.state.mmLoading = false;
    }
  }

  // Helper: gọi API nav_management để lấy danh sách transaction IDs có lãi (server-side)
  async getProfitableTxIds(fundId, fromDate = null, toDate = null) {
    try {
      if (!fundId) return new Set();
      const payload = { jsonrpc: '2.0', params: { fund_id: Number(fundId) } };
      if (fromDate) payload.params.from_date = fromDate;
      if (toDate) payload.params.to_date = toDate;
      const resp = await fetch('/nav_management/api/calculate_nav_transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const raw = await resp.json();
      // Unwrap JSON-RPC if needed
      const data = (raw && raw.jsonrpc && raw.result) ? raw.result : raw;
      try {
        // Debug chi tiết công thức trên console để đối chiếu
        if (data && data.success && Array.isArray(data.transactions)) {
          console.groupCollapsed('[NAV PROFIT DEBUG] Kết quả tính lãi (server)');
          console.log('Tổng giao dịch:', data.data?.total || data.transactions.length);
          console.log('Số giao dịch có lãi:', data.data?.profitable || data.transactions.length);
          (data.transactions || []).slice(0, 20).forEach((tx, idx) => {
            const units = Number(tx.remaining_units ?? tx.units ?? 0);
            const navValue = Number(tx.nav_value ?? 0);
            const tradePrice = Number(tx.trade_price ?? tx.amount ?? (units * navValue));
            const rate = Number(tx.interest_rate ?? 0);
            const price1 = Number(tx.price1 ?? 0);
            const price2 = Number(tx.price2 ?? 0);
            const rNew = Number(tx.interest_rate_new ?? 0);
            const delta = Number(tx.interest_delta ?? 0);
            const days = Number(tx.days_effective ?? tx.days ?? 0);
            console.log(`#${idx + 1} id=${tx.id} type=${tx.transaction_type} units=${units}`);
            console.log('  nav_value=', navValue, 'trade_price=', tradePrice, 'interest_rate(%)=', rate, 'days=', days);
            console.log('  price1=', price1, 'price2(MROUND 50)=', price2);
            console.log('  interest_rate_new(%)=', rNew, 'interest_delta(%)=', delta);
          });
          console.groupEnd();
        } else {
          console.warn('[NAV PROFIT DEBUG] Không có dữ liệu transactions từ server. Payload:', data);
        }
      } catch (e) {
        console.warn('[NAV PROFIT DEBUG] Lỗi in debug:', e);
      }
      if (data && data.success && Array.isArray(data.transactions)) {
        return new Set(data.transactions.map(it => Number(it.id)).filter(Boolean));
      }
      return new Set();
    } catch (_) {
      return new Set();
    }
  }

  formatCurrency(value) {
    if (!value) return '0₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  }

  getCcqRemainingClass(buyUnits, sellUnits, matchedCcq) {
    const buyRemaining = (buyUnits || 0) - (matchedCcq || 0);
    const sellRemaining = (sellUnits || 0) - (matchedCcq || 0);
    
    if (buyRemaining > 0) return 'ccq-remaining-positive';
    if (buyRemaining < 0) return 'ccq-remaining-negative';
    return 'ccq-remaining-zero';
  }

  redirectToTransactionList() {
    // Redirect đến trang transaction list với tab matched orders
    window.location.href = '/transaction-list?tab=matched_orders';
  }

  toggleIframeView() {
    this.state.showIframe = !this.state.showIframe;
  }

  async loadFunds() {
    try {
      const response = await fetch('/nav_management/api/funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Math.floor(Math.random() * 1000000)
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.result;
      
      if (result && result.funds) {
        this.state.funds = result.funds;
        console.log('Funds loaded:', result.funds.length, 'funds');
        return result.funds;
      } else {
        throw new Error('Không thể tải danh sách quỹ');
      }
    } catch (error) {
      console.error('Error loading funds:', error);
      throw error;
    }
  }

  async loadMatchedOrders() {
    try {
      this.state.mmLoading = true;
      this.state.mmError = null;
      
      // Load funds trước nếu chưa có
      if (!this.state.funds || this.state.funds.length === 0) {
        try {
          console.log('Loading funds...');
          await this.loadFunds();
        } catch (error) {
          console.warn('Không thể load funds, tiếp tục với dữ liệu có sẵn:', error);
        }
      } else {
        console.log('Funds already loaded:', this.state.funds.length, 'funds');
      }
      
      // Gọi API để lấy danh sách cặp lệnh đã khớp (chỉ nhà tạo lập)
      // Thử HTTP endpoint trước
      let response;
      try {
        console.log('Trying HTTP endpoint for matched pairs...');
        response = await fetch('/api/transaction-list/matched-pairs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            source_type: 'market_maker',
            limit: 500
          })
        });
      } catch (error) {
        console.warn('HTTP endpoint failed, trying JSON-RPC:', error);
        // Fallback to JSON-RPC
        console.log('Trying JSON-RPC endpoint for matched pairs...');
        response = await fetch('/api/transaction-list/get-matched-pairs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              source_type: 'market_maker',
              limit: 500
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Matched orders API response:', data);
      console.log('Response status:', response.status, 'OK:', response.ok);
      
      // Handle both HTTP and JSON-RPC responses
      let result;
      if (data.result) {
        // JSON-RPC response
        result = data.result;
      } else if (data.success !== undefined) {
        // HTTP response
        result = data;
      } else {
        throw new Error('Invalid response format');
      }
      
      if (result && result.success) {
        let allOrders = result.matched_pairs || result.data || [];
        console.log('All orders loaded:', allOrders.length, 'orders');
        // Sử dụng method tạo filter chính xác
        this.state.matchedOrders = this.createAccurateFilter(allOrders);

        // Build fund options từ state.funds hoặc dữ liệu matched orders
        if (this.state.funds && this.state.funds.length > 0) {
          this.state.fundOptions = this.state.funds.map(fund => ({ id: fund.id, name: fund.name }));
        } else {
          const uniqueFunds = new Map();
          (allOrders || []).forEach(o => {
            const id = o.fund_id || o.buy_fund_id || o.sell_fund_id;
            const name = o.fund_name || o.buy_fund_name || o.sell_fund_name;
            if (id && name && !uniqueFunds.has(id)) uniqueFunds.set(id, name);
          });
          this.state.fundOptions = Array.from(uniqueFunds.entries()).map(([id, name]) => ({ id, name }));
        }

        // Initial filtered data = all data
        this.state.matchedOrders = allOrders;
        this.state.filteredMatchedOrders = allOrders;

        // Áp dụng lọc & phân trang
        this.applyFiltersToMatchedOrders();

        // Khôi phục trạng thái đã gửi lên sàn
        this.restoreSentPairStates();

        // Tạo filter động dựa trên dữ liệu thực tế
        this.createDynamicFilter(allOrders);
        
        console.log('Matched orders loaded successfully:', {
          total: allOrders.length,
          displayed: this.state.displayedMatchedOrders.length,
          funds: this.state.fundOptions.length
        });
        
        // Nếu không có dữ liệu, hiển thị thông báo
        if (allOrders.length === 0) {
          this.state.mmError = 'Không có lệnh mua bán của nhà tạo lập trong ngày';
        }
      } else {
        this.state.mmError = result?.message || 'Không thể tải dữ liệu';
      }
    } catch (error) {
      console.error('Error loading matched orders:', error);
      this.state.mmError = 'Lỗi khi tải dữ liệu: ' + error.message;
    } finally {
      this.state.mmLoading = false;
    }
  }


  createDynamicFilter(allOrders) {
    // Phân tích tất cả các field có thể liên quan đến usertype
    const fieldAnalysis = {};
    const possibleFields = [
      '_pairType', '_buyUserType', '_sellUserType', 
      'buy_source', 'sell_source', 'buy_user_type', 'sell_user_type',
      'is_market_maker', 'buy_is_market_maker', 'sell_is_market_maker'
    ];
    
    allOrders.forEach((order, index) => {
      if (index < 5) { // Chỉ phân tích 5 order đầu
        console.log(`Order ${index + 1} (ID: ${order.id}):`);
        possibleFields.forEach(field => {
          const value = order[field];
          if (value !== undefined && value !== null && value !== '') {
            if (!fieldAnalysis[field]) {
              fieldAnalysis[field] = new Set();
            }
            fieldAnalysis[field].add(value);
            console.log(`  ${field}: ${value}`);
          }
        });
      }
    });
    
    // In ra tất cả giá trị unique cho mỗi field
    // Tạo filter dựa trên phân tích
    this.state.dynamicFilter = fieldAnalysis;
  }

  // Method để tạo filter chính xác dựa trên kết quả debug
  createAccurateFilter(allOrders) {
    // Filter dựa trên buy_user_type và sell_user_type
    const marketMakerOrders = allOrders.filter(order => {
      const buyUserType = order.buy_user_type || '';
      const sellUserType = order.sell_user_type || '';
      
      // Lọc lệnh có ít nhất một bên là market maker
      return buyUserType === 'market_maker' || sellUserType === 'market_maker';
    });
    return marketMakerOrders;
  }

  async rpc(route, params = {}) {
    try {
      const response = await fetch(route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: params,
          id: Math.floor(Math.random() * 1000000)
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('RPC Error:', error);
      throw error;
    }
  }

  // ===== Filters (fund, date) =====
  applyFiltersToMatchedOrders() {
    const { fund_id, date } = this.state.mmFilters || {};
    let data = [...this.state.matchedOrders];
    if (fund_id) {
      data = data.filter(o => String(o.fund_id || o.buy_fund_id || o.sell_fund_id || '') === String(fund_id));
    }
    if (date) {
      // so khớp theo ngày phần "In:" (buy_in_time/match_time)
      const d = date;
      data = data.filter(o => {
        const t = o.buy_in_time || o.sell_in_time || o.match_time || '';
        if (!t) return false;
        return (t || '').slice(0, 10) === d; // yyyy-mm-dd
      });
    }
    this.state.filteredMatchedOrders = data;
    this.applyMmSorting(); // Apply sorting will also update pagination
  }

  onFilterChanged() {
    this.applyFiltersToMatchedOrders();
  }

  resetFilters() {
    this.state.mmFilters.fund_id = '';
    this.state.mmFilters.date = '';
    this.applyFiltersToMatchedOrders();
  }

  // ========== Matched Orders Pagination Helpers ==========


  // Matched Orders Selection Functions
  isMatchedOrderSelected(order) {
    const orderId = this.getMatchedOrderId(order);
    return this.state.selectedMatchedOrderIds.has(orderId);
  }

  getMatchedOrderId(order) {
    // Tạo unique ID từ buy_id và sell_id
    return `${order.buy_id || 'unknown'}-${order.sell_id || 'unknown'}`;
  }

  toggleSelectMatchedOrder(order, checked) {
    const orderId = this.getMatchedOrderId(order);
    if (checked) {
      this.state.selectedMatchedOrderIds.add(orderId);
    } else {
      this.state.selectedMatchedOrderIds.delete(orderId);
    }
  }

  toggleSelectAllMatchedOrders(checked) {
    if (checked) {
      // Chọn tất cả matched orders hiện tại
      this.state.displayedMatchedOrders.forEach(order => {
        const orderId = this.getMatchedOrderId(order);
        this.state.selectedMatchedOrderIds.add(orderId);
      });
    } else {
      // Bỏ chọn tất cả
      this.state.selectedMatchedOrderIds.clear();
    }
  }

  getSelectedMatchedOrdersCount() {
    return this.state.selectedMatchedOrderIds.size;
  }

  async sendPairToExchange(pairId, btnElement) {
    try {
      if (!pairId || !pairId.includes('-')) {
        this.showPopup({
          title: 'Lỗi',
          message: 'Pair ID không hợp lệ',
          type: 'error'
        });
        return;
      }

      const [buyId, sellId] = pairId.split('-');
      
      // Tìm thông tin cặp lệnh từ state
      const matchedOrder = this.state.matchedOrders.find(order => 
        String(order.buy_id) === buyId && String(order.sell_id) === sellId
      );

      if (!matchedOrder) {
        this.showPopup({
          title: 'Lỗi',
          message: 'Không tìm thấy thông tin cặp lệnh',
          type: 'error'
        });
        return;
      }

      // Hiển thị loading trên button
      const originalHTML = btnElement.innerHTML;
      btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btnElement.disabled = true;

      // Gọi API gửi lên sàn từ transaction_list
      const response = await fetch('/api/transaction-list/send-to-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            buy_id: parseInt(buyId),
            sell_id: parseInt(sellId),
            matched_volume: matchedOrder.matched_ccq || matchedOrder.matched_quantity || 0,
            matched_price: matchedOrder.matched_price || matchedOrder._matched_price || 0
          }
        })
      });

      const result = await response.json();
      
      if (result.result && result.result.success) {
        // Thành công
        btnElement.innerHTML = '<i class="fas fa-check"></i>';
        btnElement.classList.add('sent');
        btnElement.style.backgroundColor = '#28a745';
        btnElement.title = 'Đã gửi lên sàn';
        
        // Làm mờ row
        const row = btnElement.closest('tr');
        if (row) {
          row.style.opacity = '0.6';
        }

        // Lưu trạng thái vào localStorage
        this.saveSentPairState(pairId);

        this.showPopup({
          title: 'Thành công',
          message: `Đã gửi cặp lệnh ${pairId} lên sàn thành công!`,
          type: 'success'
        });
      } else {
        // Thất bại
        btnElement.innerHTML = originalHTML;
        btnElement.disabled = false;
        
        this.showPopup({
          title: 'Gửi lên sàn thất bại',
          message: result.result?.message || 'Có lỗi xảy ra khi gửi lên sàn',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error sending to exchange:', error);
      
      // Reset button
      btnElement.innerHTML = '<i class="fas fa-paper-plane"></i>';
      btnElement.disabled = false;
      
      this.showPopup({
        title: 'Lỗi hệ thống',
        message: `Có lỗi xảy ra: ${error.message}`,
        type: 'error'
      });
    }
  }

  saveSentPairState(pairId) {
    try {
      const sentPairs = JSON.parse(localStorage.getItem('sentExchangePairs') || '[]');
      if (!sentPairs.includes(pairId)) {
        sentPairs.push(pairId);
        localStorage.setItem('sentExchangePairs', JSON.stringify(sentPairs));
      }
    } catch (e) {
      console.error('Error saving sent pair state:', e);
    }
  }

  restoreSentPairStates() {
    try {
      const sentPairs = JSON.parse(localStorage.getItem('sentExchangePairs') || '[]');
      
      setTimeout(() => {
        sentPairs.forEach(pairId => {
          const btn = document.querySelector(`[data-pair-id="${pairId}"]`);
          if (btn && !btn.classList.contains('sent')) {
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.classList.add('sent');
            btn.style.backgroundColor = '#28a745';
            btn.title = 'Đã gửi lên sàn';
            
            const row = btn.closest('tr');
            if (row) {
              row.style.opacity = '0.6';
            }
          }
        });
      }, 500); // Đợi DOM render
    } catch (e) {
      console.error('Error restoring sent pair states:', e);
    }
  }

  changeMatchedOrdersPage(page) {
    const totalPages = this.getMatchedOrdersTotalPages();
    if (page < 1 || page > totalPages) return;
    this.state.matchedOrdersPagination.currentPage = page;
    this.updateMatchedOrdersPagination();
  }

  updateMatchedOrdersPagination() {
    this.state.matchedOrdersPagination.totalItems = this.state.filteredMatchedOrders.length;
    const { currentPage, itemsPerPage, totalItems } = this.state.matchedOrdersPagination;
    
    // Ensure current page is valid
    const maxPage = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    if (this.state.matchedOrdersPagination.currentPage > maxPage) {
        this.state.matchedOrdersPagination.currentPage = maxPage;
    }
    
    // Use filteredMatchedOrders instead of matchedOrders
    const start = (this.state.matchedOrdersPagination.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    this.state.displayedMatchedOrders = this.state.filteredMatchedOrders.slice(start, end);
  }

  getMatchedOrdersTotalPages() {
    const { totalItems, itemsPerPage } = this.state.matchedOrdersPagination;
    return Math.max(1, Math.ceil((totalItems || 0) / (itemsPerPage || 10)));
  }

  formatNumber(value) {
    const num = Number(value || 0);
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  formatPercent(value) {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    return `${num}%`;
  }

  formatDeltaPercent(value) {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    return `${num.toFixed(2)}%`;
  }

  formatPercentFixed2(value) {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    return `${num.toFixed(2)}%`;
  }

  mapTransactionType(value) {
    const v = (value || '').toString().toLowerCase();
    if (v === 'buy') return 'Lệnh mua';
    if (v === 'sell') return 'Lệnh bán';
    if (v === 'exchange') return 'Lệnh chuyển đổi';
    return this.getDisplayValue(value);
  }

  getTypeLabel(tx) {
    const t = (tx && tx.transaction_type ? tx.transaction_type : '').toLowerCase();
    if (t === 'buy') return 'Mua';
    if (t === 'sell') return 'Bán';
    if (t === 'exchange') return 'Chuyển đổi';
    return 'Khác';
  }

  getTypeBadgeClass(tx) {
    const t = (tx && tx.transaction_type ? tx.transaction_type : '').toLowerCase();
    if (t === 'buy') return 'badge-type-buy';
    if (t === 'sell') return 'badge-type-sell';
    return 'badge-type-exchange';
  }

  getDeltaBadgeClass(delta) {
    const num = Number(delta);
    if (Number.isNaN(num)) return 'badge-pnl-na';
    if (num > 0) return 'badge-pnl-profit';
    if (num < 0) return 'badge-pnl-loss';
    return 'badge-pnl-na';
  }

  // Giá trị lệnh (order_value) = amount nếu có, fallback units * nav_value
  computeOrderValue(tx) {
    const amount = Number(tx.amount || 0);
    if (amount > 0) return amount;
    const units = Number((tx.remaining_units != null ? tx.remaining_units : tx.units) || 0);
    const nav = Number(tx.nav_value || 0);
    return units * nav;
  }

  // Tính số ngày: ưu tiên tx.days, sau đó kỳ hạn (term_months * 30), cuối cùng ước lượng theo lịch
  computeDays(tx) {
    const daysFromTx = Number(tx.days || 0);
    if (daysFromTx > 0) return daysFromTx;
    const termMonths = Number(tx.term_months || 0);
    if (termMonths > 0) {
      return Math.max(1, Math.round(termMonths * 30));
    }
    const today = new Date();
    const maturityDate = new Date(today);
    maturityDate.setMonth(today.getMonth() + (Number(tx.term_months || 12)));
    const days = Math.ceil((maturityDate - today) / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }

  // Giá trị bán = Giá trị lệnh * lãi suất / 365 * Số ngày + Giá trị lệnh
  computeSellValue(tx) {
    const orderValue = this.computeOrderValue(tx);
    const rate = Number(tx.interest_rate || 0);
    const days = this.computeDays(tx);
    return orderValue * (rate / 100) / 365 * days + orderValue;
  }

  // Giá bán 1 = ROUND(Giá trị bán / Số lượng CCQ, 0)
  computePrice1(tx) {
    const sellValue = this.computeSellValue(tx);
    const units = Number((tx.remaining_units != null ? tx.remaining_units : tx.units) || 0);
    if (units <= 0) return 0;
    return Math.round(sellValue / units);
  }

  // Giá bán 2 = MROUND(Giá bán 1, 50)
  computePrice2(tx, step = 50) {
    const price1 = this.computePrice1(tx);
    if (!step || step <= 0) return price1;
    return Math.round(price1 / step) * step;
  }

  getRateForMonths(months) {
    // ưu tiên đọc từ cấu hình đã nạp
    if (this.state && this.state.termRateMap) {
      const key = String(months);
      if (Object.prototype.hasOwnProperty.call(this.state.termRateMap, key)) {
        return Number(this.state.termRateMap[key]);
      }
    }
    return null;
  }

  formatMonthWithRate(months) {
    const r = this.getRateForMonths(months);
    if (r === null || r === undefined) return `${months} tháng`;
    return `${months} tháng — ${Number(r).toFixed(2)}%`;
  }

  isSelectedTerm(months) {
    const cur = this.state?.filters?.term_months || '';
    const num = parseInt(cur, 10);
    if (Number.isNaN(num)) return false;
    return num === months;
  }

  getDisplayValue(value) {
    return value || '-';
  }

  getSelectedFundName() {
    try {
      const id = this.state?.selectedFundId;
      const funds = this.state?.funds || [];
      const f = funds.find((x) => String(x.id) === String(id));
      return f ? (f.name || '-') : '-';
    } catch (_) { return '-'; }
  }

  // Popup helper (no external libs). Uses CSS in nav_management.css
  showPopup({ title = '', message = '', type = 'info', confirmText = 'OK' } = {}) {
    try {
      // Remove existing modal if any
      const existing = document.getElementById('navMngModal');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.className = 'nav-management-modal nav-management-modal-open show';
      backdrop.id = 'navMngModal';

      const dialog = document.createElement('div');
      dialog.className = 'nav-management-modal-dialog nav-management-modal-dialog-centered';

      const content = document.createElement('div');
      content.className = 'nav-management-modal-content';

      const header = document.createElement('div');
      header.className = 'nav-management-modal-header ' + (type === 'success' ? 'nm-modal-success' : type === 'error' ? 'nm-modal-error' : type === 'warning' ? 'nm-modal-warning' : '');
      const hTitle = document.createElement('h5');
      hTitle.className = 'nav-management-modal-title';
      hTitle.textContent = title || '';
      const btnClose = document.createElement('button');
      btnClose.className = 'nav-management-btn-close';
      btnClose.setAttribute('aria-label', 'Close');
      btnClose.onclick = () => backdrop.remove();
      header.appendChild(hTitle);
      header.appendChild(btnClose);

      const body = document.createElement('div');
      body.className = 'nav-management-modal-body';
      
      // Thêm icon lớn cho popup success
      if (type === 'success') {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'nav-management-success-icon-container';
        iconContainer.innerHTML = `
          <div class="nav-management-success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="#10b981" stroke="#10b981" stroke-width="2"/>
              <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        `;
        body.appendChild(iconContainer);
      }
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'nav-management-modal-message';
      messageDiv.innerHTML = message || '';
      body.appendChild(messageDiv);

      const footer = document.createElement('div');
      footer.className = 'nav-management-modal-footer';
      const ok = document.createElement('button');
      ok.className = 'nav-management-btn nav-management-btn-primary';
      ok.textContent = confirmText || 'OK';
      ok.onclick = () => backdrop.remove();
      footer.appendChild(ok);

      content.appendChild(header);
      content.appendChild(body);
      content.appendChild(footer);
      dialog.appendChild(content);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
    } catch (e) {
      // fallback
      alert(title + (message ? ('\n' + (message.replace(/<[^>]*>/g, ''))) : ''));
    }
  }

  getTodayDateString() {
    const today = new Date();
    return today.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  calculateStats() {
    // Chỉ tính cho quỹ đã chọn
    const fundId = this.state.selectedFundId ? Number(this.state.selectedFundId) : null;
    // Sử dụng filteredTransactions nếu có, ngược lại dùng transactions; sau đó lọc theo fund
    const baseData = this.state.filteredTransactions && this.state.filteredTransactions.length > 0 
      ? this.state.filteredTransactions 
      : this.state.transactions;
    const dataToCalculate = fundId
      ? baseData.filter(tx => Number(tx.fund_id || tx.buy_fund_id || tx.sell_fund_id || 0) === fundId)
      : baseData;
    
    this.state.totalTransactions = dataToCalculate.length;
    
    // Tính tổng giá trị NAV dựa trên remaining_units (số lượng còn lại)
    this.state.totalNavValue = dataToCalculate.reduce((sum, transaction) => {
      const navValue = Number(transaction.nav_value || 0);
      const remainingUnits = Number(transaction.remaining_units || (transaction.units - (transaction.matched_units || 0)) || 0);
      return sum + (navValue * remainingUnits);
    }, 0);
    
    // Tính NAV trung bình theo weighted average (có trọng số theo remaining_units)
    const totalWeightedNav = dataToCalculate.reduce((sum, transaction) => {
      const navValue = Number(transaction.nav_value || 0);
      const remainingUnits = Number(transaction.remaining_units || (transaction.units - (transaction.matched_units || 0)) || 0);
      return sum + (navValue * remainingUnits);
    }, 0);
    
    const totalUnits = dataToCalculate.reduce((sum, transaction) => {
      const remainingUnits = Number(transaction.remaining_units || (transaction.units - (transaction.matched_units || 0)) || 0);
      return sum + remainingUnits;
    }, 0);
    
    this.state.averageNavValue = totalUnits > 0 ? totalWeightedNav / totalUnits : 0;
    
    // Đếm giao dịch được tạo trong ngày hôm nay (theo quỹ đã chọn)
    this.calculateTodayTransactions(dataToCalculate);
  }

  async calculateStatsFromAllTransactions(allTransactions) {
    // Tính statcard từ tất cả giao dịch (chờ khớp + khớp lệnh)
    const fundId = this.state.selectedFundId ? Number(this.state.selectedFundId) : null;
    
    // Lọc giao dịch theo quỹ và loại bỏ giao dịch bị xóa (active = false)
    const dataToCalculate = allTransactions.filter(tx => {
      // Lọc theo quỹ
      const txFundId = Number(tx.fund_id || tx.buy_fund_id || tx.sell_fund_id || 0);
      if (fundId && txFundId !== fundId) return false;
      
      // Loại bỏ giao dịch bị xóa (soft delete)
      if (tx.active === false) return false;
      
      return true;
    });
    
    // Tổng phiên giao dịch của quỹ - lấy tất cả giao dịch (chờ khớp + khớp lệnh)
    this.state.totalTransactions = dataToCalculate.length;
    
    // Tổng giá trị NAV - lấy tổng giá trị NAV của tất cả giao dịch
    this.state.totalNavValue = dataToCalculate.reduce((sum, transaction) => {
      const navValue = Number(transaction.nav_value || 0);
      const units = Number(transaction.units || 0);
      return sum + (navValue * units);
    }, 0);
    
    // Giá trị NAV trung bình - lấy từ tồn kho cuối ngày (theo công thức weighted average)
    await this.loadAverageNavPrice(fundId);
    
    // Phiên ngày - chỉ lấy giao dịch trong ngày (chờ khớp + khớp lệnh)
    this.calculateTodayTransactions(dataToCalculate);
  }

  async loadAverageNavPrice(fundId) {
    try {
      console.log(`Loading average NAV price for fund ${fundId}...`);
      
      const response = await fetch('/nav_management/api/nav_average_price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            fund_id: fundId,
            inventory_date: new Date().toISOString().split('T')[0]
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('NAV average price API response:', result);
        
        if (result.result && result.result.success) {
          const averagePrice = result.result.average_nav_price || 0;
          console.log(`Setting average NAV price: ${averagePrice}`);
          this.state.averageNavValue = averagePrice;
        } else {
          console.warn('API returned success=false:', result.result?.message);
          this.state.averageNavValue = 0;
        }
      } else {
        console.error(`API error: ${response.status} ${response.statusText}`);
        this.state.averageNavValue = 0;
      }
    } catch (e) {
      console.error('Error loading average NAV price:', e);
      this.state.averageNavValue = 0;
    }
  }
  

  calculateTodayTransactions(scopedData) {
    // Lấy ngày hiện tại (chỉ ngày, không tính giờ)
    const today = new Date();
    const todayString = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toDateString();
    
    // Dữ liệu đã lọc theo quỹ truyền vào; fallback như cũ nếu thiếu
    const dataToCount = Array.isArray(scopedData) && scopedData.length
      ? scopedData
      : (this.state.filteredTransactions && this.state.filteredTransactions.length > 0 
        ? this.state.filteredTransactions 
        : this.state.transactions);
    
    // Chỉ lấy giao dịch trong ngày (chờ khớp + khớp lệnh) và loại bỏ giao dịch bị xóa
    this.state.todayTransactions = dataToCount.filter(transaction => {
      // Loại bỏ giao dịch bị xóa (soft delete)
      if (transaction.active === false) return false;
      
      // Ưu tiên created_at (có cả giờ phút), fallback về transaction_date hoặc create_date
      const dateToCheck = transaction.created_at || transaction.transaction_date || transaction.create_date;
      
      if (!dateToCheck) return false;
      
      // So sánh theo local-date để tránh lệch UTC
      const transactionDate = this.parseDateStringToLocal(dateToCheck);
      if (!(transactionDate instanceof Date) || isNaN(transactionDate)) return false;
      const transactionDateString = new Date(
        transactionDate.getFullYear(),
        transactionDate.getMonth(),
        transactionDate.getDate()
      ).toDateString();
      
      return transactionDateString === todayString;
    }).length;
  }

  updatePagination() {
    // Sử dụng dữ liệu hiện tại (tính toán hoặc lọc)
    const currentData = this.state.showCalculatedResults ? this.state.calculatedTransactions : this.state.filteredTransactions;
    const totalItems = currentData.length;
    this.state.totalPages = Math.ceil(totalItems / this.state.pageSize);
    this.state.startIndex = (this.state.currentPage - 1) * this.state.pageSize;
    this.state.endIndex = Math.min(this.state.startIndex + this.state.pageSize, totalItems);
    
    // Generate page numbers
    const pages = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.state.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.state.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    this.state.pageNumbers = pages;
  }

  filterTable(field, value) {
    if (!this.state.filters) this.state.filters = {};
    this.state.filters[field] = value;
    this.applyLocalFilters();
  }

  filterByDate(dateValue) {
    this.state.dateFilter = dateValue;
    this.applyLocalFilters();
  }

  applyLocalFilters() {
    let filtered = this.state.transactions;

    // Loại bỏ giao dịch bị xóa (soft delete) trước khi áp dụng các filter khác
    filtered = filtered.filter(t => t.active !== false);

    // Text filter: investor_name
    const nameFilter = (this.state.filters?.investor_name || '').toLowerCase().trim();
    if (nameFilter) {
      filtered = filtered.filter(t => (t.investor_name || '').toLowerCase().includes(nameFilter));
    }

    // Numeric: term_months
    const termFilter = parseInt(this.state.filters?.term_months || '', 10);
    if (!Number.isNaN(termFilter)) {
      filtered = filtered.filter(t => parseInt(t.term_months || 0, 10) === termFilter);
    }

    // Numeric: units
    const unitsFilter = parseFloat(this.state.filters?.units || '');
    if (!Number.isNaN(unitsFilter)) {
      filtered = filtered.filter(t => Number(t.units || 0) === unitsFilter);
    }

    // Numeric: nav_value
    const navFilter = parseFloat(this.state.filters?.nav_value || '');
    if (!Number.isNaN(navFilter)) {
      filtered = filtered.filter(t => Number(t.nav_value || 0) === navFilter);
    }

    // Date filter (single date or 7 days range)
    const singleDate = document.getElementById('singleDateFilter')?.value;
    const quickDateFilter = document.getElementById('quickDateFilter')?.value || '';
    
    if (singleDate || quickDateFilter === 'last7days') {
      let fromTime = null;
      let toTime = null;
      
      if (quickDateFilter === 'last7days') {
        // Lấy 7 ngày gần nhất
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7, 0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        fromTime = start.getTime();
        toTime = end.getTime();
      } else if (singleDate) {
        // Lọc theo ngày cụ thể
        const rng = this.getDayRangeTimestamps(singleDate);
        fromTime = rng.fromTime;
        toTime = rng.toTime;
      }
      
      if (fromTime !== null && toTime !== null) {
        filtered = filtered.filter(t => {
          const when = this.parseDateStringToLocal(t.created_at || t.transaction_date || t.create_date || null);
          const ts = (when instanceof Date && !isNaN(when)) ? when.getTime() : null;
          if (ts === null) return false;
          return ts >= fromTime && ts <= toTime;
        });
      }
    }

    this.state.filteredTransactions = filtered;
    this.state.currentPage = 1;
    this.updatePagination();
    // Không cập nhật biểu đồ - biểu đồ luôn hiển thị dữ liệu NAV đã khớp của fund
    this.state.navCalculated = false;
  }

  updateChartFromFiltered() {
    try {
      // Sử dụng dữ liệu đã lọc (chỉ giao dịch đã khớp) cho biểu đồ NAV
      const series = this.computeIntradaySeries(this.state.filteredTransactions || []);
      this.state.chartPoints = series;
      const ys = series.map(p => p.y);
      this.state.chartMin = ys.length ? Math.min(...ys) : 0;
      this.state.chartMax = ys.length ? Math.max(...ys) : 0;
      this.renderChartJs('#navChartCanvas', series, { min: this.state.chartMin, max: this.state.chartMax });
    } catch (e) {
      this.state.chartPoints = [];
      this.renderChartJs('#navChartCanvas', [], { min: 0, max: 0 });
    }
  }

  // Cập nhật biểu đồ từ dữ liệu NAV đã khớp của fund
  updateChartFromAllFundData() {
    try {
      // Sử dụng dữ liệu đã lọc (chỉ giao dịch đã khớp) cho biểu đồ NAV
      const series = this.computeIntradaySeries(this.state.allFundTransactions || []);
      this.state.chartPoints = series;
      const ys = series.map(p => p.y);
      this.state.chartMin = ys.length ? Math.min(...ys) : 0;
      this.state.chartMax = ys.length ? Math.max(...ys) : 0;
      this.renderChartJs('#navChartCanvas', series, { min: this.state.chartMin, max: this.state.chartMax });
    } catch (e) {
      this.state.chartPoints = [];
      this.renderChartJs('#navChartCanvas', [], { min: 0, max: 0 });
    }
  }

  computeIntradaySeries(items) {
    // Build series theo từng giao dịch đã khớp trong khoảng lọc hiện tại
    const fundId = this.state.selectedFundId;
    const arr = [];
    for (const tx of items) {
      if (fundId && tx.fund_id && Number(tx.fund_id) !== Number(fundId)) continue;
      
      // Loại bỏ giao dịch bị xóa (soft delete)
      if (tx.active === false) continue;
      
      // Chỉ lấy giao dịch đã khớp (completed) cho biểu đồ NAV
      if (tx.status !== 'approved' && tx.db_status !== 'completed') continue;
      
      const dtStr = tx.created_at || tx.transaction_date || tx.create_date;
      if (!dtStr) continue;
      // Sử dụng parseDateStringToLocal để đảm bảo timezone đúng
      const localDate = this.parseDateStringToLocal(dtStr);
      if (!(localDate instanceof Date) || isNaN(localDate.getTime())) continue;
      const ts = localDate.getTime();
      const nav = Number(tx.nav_value || 0);
      arr.push({ x: ts, y: nav });
    }
    arr.sort((a,b) => a.x - b.x);
    return arr;
  }

  computeMA(points, windowSize) {
    if (!points || points.length === 0) return [];
    const out = [];
    let sum = 0;
    const q = [];
    for (let i = 0; i < points.length; i++) {
      const y = Number(points[i].y || 0);
      sum += y;
      q.push(y);
      if (q.length > windowSize) sum -= q.shift();
      const avg = q.length === windowSize ? (sum / windowSize) : null;
      out.push(avg);
    }
    return out;
  }

  async renderChartJs(canvasSelector, points, range) {
    await this.ensureChartJs();
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent concurrent renders
    if (this._renderingChart) return;
    this._renderingChart = true;

    try {
      // destroy old chart bound to this canvas if any (Chart.js v4)
      const bound = window.Chart.getChart(canvas);
      if (bound) {
        try { bound.destroy(); } catch (e) {}
      }
      if (this._chart && typeof this._chart.destroy === 'function') {
        try { this._chart.destroy(); } catch (e) {}
        this._chart = null;
      }

      if (!points || points.length === 0) {
        return; // overlay message handled by template
      }

      const labels = points.map(p => p.x);
      const data = points.map(p => p.y);

      // Moving Averages theo số điểm (MA7/25/99)
      const ma7  = this.computeMA(points, 7);
      const ma25 = this.computeMA(points, 25);
      const ma99 = this.computeMA(points, 99);

      const minY = Math.min(...data);
      const maxY = Math.max(...data);
      const dataRange = maxY - minY;
      
      // Đảm bảo padding tối thiểu 0.5% của giá trị trung bình để chart hiển thị rõ biến động
      const avgValue = (minY + maxY) / 2;
      const minPadding = avgValue * 0.005; // 0.5% của giá trị trung bình
      const calculatedPadding = dataRange * 0.1; // 10% của range
      const nicePadding = Math.max(calculatedPadding, minPadding, 1);

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        // parsing: default (allow labels + numeric data)
        normalized: true,
        interaction: { mode: 'index', intersect: false },
        elements: { point: { radius: 0, hitRadius: 6 } },
        plugins: {
          legend: { display: true, labels: { boxWidth: 18 } },
          tooltip: {
            callbacks: {
              title: (items) => {
                // Hiển thị thời gian theo timezone local của user
                if (!items.length) return '';
                const timestamp = items[0].parsed.x;
                const date = new Date(timestamp);
                return date.toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              },
              label: (ctx) => {
                const v = ctx.raw;
                if (v === null || v === undefined) return ctx.dataset.label + ': -';
                return `${ctx.dataset.label}: ` + new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
            grid: { color: '#1f2937' },
            ticks: { maxRotation: 0, autoSkip: true }
          },
          y: {
            grid: { color: '#1f2937' },
            suggestedMin: minY - nicePadding,
            suggestedMax: maxY + nicePadding,
            ticks: {
              callback: (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
            }
          }
        }
      };

      // Ensure dataset lengths align with labels
      while (ma7.length < labels.length) ma7.push(null);
      while (ma25.length < labels.length) ma25.push(null);
      while (ma99.length < labels.length) ma99.push(null);

      const base = {
        label: 'NAV/Unit (VND)',
        data: data,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 2,
        tension: 0.25,
        fill: true
      };

      const dsMA7 = {
        label: 'MA(7)',
        data: ma7,
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        tension: 0.2,
        fill: false
      };
      const dsMA25 = {
        label: 'MA(25)',
        data: ma25,
        borderColor: '#ec4899',
        borderWidth: 1.5,
        tension: 0.2,
        fill: false
      };
      const dsMA99 = {
        label: 'MA(99)',
        data: ma99,
        borderColor: '#a78bfa',
        borderWidth: 1.5,
        tension: 0.2,
        fill: false
      };

      const cfg = { type: 'line', data: { labels, datasets: [base, dsMA7, dsMA25, dsMA99] }, options };

      this._chart = new window.Chart(ctx, cfg);
    } finally {
      this._renderingChart = false;
    }
  }

  // Đã loại bỏ realtime refresh - dữ liệu sẽ được lấy từ backend Odoo khi cần
  startRealtime() {
    // Không còn tự động refresh - dữ liệu biến động sẽ được lấy từ backend Odoo
    if (this._realtimeTimer) {
      clearInterval(this._realtimeTimer);
      this._realtimeTimer = null;
    }
  }

  changePage(page) {
    if (page >= 1 && page <= this.state.totalPages) {
      this.state.currentPage = page;
      this.updatePagination();
    }
  }

  exportData() {
    const dataToExport = this.state.filteredTransactions || [];
    
    if (dataToExport.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    const headers = [
      'No',
      'Phiên giao dịch',
      'Giá trị NAV',
      'Ngày giao dịch',
      'Ngày đáo hạn'
    ];

    const csvData = dataToExport.map((transaction, index) => [
      index + 1,
      this.getDisplayValue(transaction.transaction_session),
      transaction.nav_value,
      this.formatDateOnly(transaction.transaction_date || transaction.created_at || transaction.create_date),
      transaction.maturity_date ? this.formatDateOnly(transaction.maturity_date) : '-',
    ]);

    const csvContent = this.convertToCSV([headers, ...csvData]);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `nav_phiên_giao_dịch_${timestamp}.csv`;
    
    this.downloadCSV(csvContent, fileName);
  }

  convertToCSV(data) {
    return data.map(row => 
      row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
  }

  downloadCSV(content, fileName) {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(content));
    }
  }

  async calculateNavValue() {
    try {
      console.log('Calculating NAV value...');
      
      // Kiểm tra xem có quỹ được chọn không
      if (!this.state.selectedFundId) {
        this.showPopup({
          title: 'Thiếu thông tin',
          message: 'Vui lòng chọn quỹ để tính giá trị NAV!',
          type: 'warning',
          confirmText: 'Đã hiểu'
        });
        return;
      }

      // Hiển thị loading
      this.state.isCalculating = true;
      
      // Lấy cấu hình cap - bắt buộc phải có từ backend (thử nạp lại nếu chưa có)
      if (!this.state.capConfig || this.state.capConfig.cap_upper == null || this.state.capConfig.cap_lower == null) {
        try {
          await this.loadConfigs();
        } catch (_) {}
      }
      if (!this.state.capConfig || this.state.capConfig.cap_upper == null || this.state.capConfig.cap_lower == null) {
        this.showPopup({
          title: 'Thiếu cấu hình',
          message: 'Không tìm thấy cấu hình chặn trên/chặn dưới. Vui lòng thiết lập trong menu Cấu hình.',
          type: 'warning',
          confirmText: 'Đã hiểu'
        });
        return;
      }
      
      const capUpper = Number(this.state.capConfig.cap_upper);
      const capLower = Number(this.state.capConfig.cap_lower);
      
      // Lấy bộ lọc ngày từ form hiện tại
      const { fromDate, toDate } = this.getDateFilter();

      // Gọi API backend để tính toán NAV với filter đúng
      const response = await fetch('/nav_management/api/calculate_nav_transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            fund_id: this.state.selectedFundId,
            from_date: fromDate,
            to_date: toDate,
            cap_upper: capUpper,
            cap_lower: capLower
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.result && result.result.success) {
        let profitableTransactions = result.result.transactions || [];

        // Gọi batch API để tính toán từ server thay vì local
        profitableTransactions = await this.computeMetricsServer(profitableTransactions);
        const totalCount = result.result.data?.total || 0;
        const profitableCount = result.result.data?.profitable || 0;
        
        // Cập nhật state để hiển thị kết quả tính toán
        this.state.calculatedTransactions = profitableTransactions;
        this.state.showCalculatedResults = true;
        this.state.navCalculated = profitableTransactions.length > 0;
      this.state.currentPage = 1;
        this.updatePagination();
      
        this.showPopup({
        title: 'Tính giá trị NAV thành công',
          message: `Đã tính được ${profitableCount}/${totalCount} lệnh có lãi theo điều kiện chênh lệch lãi suất (${capUpper}% - ${capLower}%).`,
          type: 'success'
        });
      } else {
        throw new Error(result.result?.message || 'Không có phản hồi từ server');
      }
    } catch (error) {
      console.error('Error calculating NAV:', error);
      this.showPopup({
        title: 'Có lỗi xảy ra',
        message: error?.message || 'Không xác định',
        type: 'error',
        confirmText: 'Đóng'
      });
    } finally {
      this.state.isCalculating = false;
    }
  }

  showOriginalData() {
    // Quay lại hiển thị dữ liệu gốc
    this.state.showCalculatedResults = false;
    this.state.navCalculated = false;
    this.state.currentPage = 1;
    this.updatePagination();
  }

  getDateFilter() {
    // Helper function để lấy filter ngày một cách nhất quán
    const singleDate = document.getElementById('singleDateFilter')?.value || null;
    const quickDateFilter = document.getElementById('quickDateFilter')?.value || '';
    
    let fromDate = null;
    let toDate = null;
    
    if (quickDateFilter === 'today') {
      // Hôm nay
      const today = new Date();
      fromDate = toDate = today.toISOString().split('T')[0];
    } else if (quickDateFilter === 'yesterday') {
      // Hôm qua
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      fromDate = toDate = yesterday.toISOString().split('T')[0];
    } else if (quickDateFilter === 'last7days') {
      // Lấy 7 ngày gần nhất
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      fromDate = sevenDaysAgo.toISOString().split('T')[0];
      toDate = today.toISOString().split('T')[0];
    } else if (singleDate) {
      // Lọc theo ngày cụ thể được chọn
      fromDate = toDate = singleDate;
    }
    
    return { fromDate, toDate };
  }

  enrichCalculatedFields(items) {
    try {
      return (items || []).map((tx) => ({ ...tx }));
    } catch (e) {
      console.error('enrichCalculatedFields error:', e);
      return items || [];
    }
  }

  refreshData() {
    console.log('Refreshing data...');
    window.location.reload();
  }
  
  async recalculateInventoryAfterTransactionChange(transactionId) {
    try {
      const response = await fetch('/nav_management/api/recalculate_inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            transaction_id: transactionId
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.result && result.result.success) {
          console.log('Đã tính lại tồn kho sau khi thay đổi giao dịch:', result.result.message);
          // Tự động refresh dữ liệu để cập nhật statcard
          await this.loadChartData();
          // Cập nhật statcard với giá NAV trung bình mới
          await this.updateStatCard();
        }
      }
    } catch (error) {
      console.error('Lỗi khi tính lại tồn kho:', error);
    }
  }

  async loadChartData() {
    try {
      await this.ensureChartJs();
      const urlParams = new URLSearchParams(window.location.search);
      let fundId = this.state.selectedFundId || urlParams.get('fund_id') || (this.state.funds && this.state.funds.length ? this.state.funds[0].id : null);
      // Lấy bộ lọc ngày từ input (tương tự loadData)
      const { fromDate, toDate } = this.getDateFilter();

      // Lấy dữ liệu cho biểu đồ NAV - chỉ lấy giao dịch đã khớp (completed)
      const chartResponse = await fetch('/nav_management/api/nav_transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            fund_id: fundId ? parseInt(fundId) : null,
            from_date: fromDate,
            to_date: toDate,
            // Chỉ lấy giao dịch đã khớp cho biểu đồ NAV
            status_filter: 'approved'
          }
        })
      });
      
      // Lấy dữ liệu cho statcard - lấy tất cả giao dịch (chờ khớp + khớp lệnh)
      const statsResponse = await fetch('/nav_management/api/nav_transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            fund_id: fundId ? parseInt(fundId) : null,
            from_date: fromDate,
            to_date: toDate,
            // Lấy tất cả giao dịch cho statcard
            status_filter: 'all'
          }
        })
      });
      
      if (!chartResponse.ok || !statsResponse.ok) return;
      
      const chartResult = await chartResponse.json();
      const statsResult = await statsResponse.json();
      
      // Dữ liệu cho biểu đồ NAV (chỉ giao dịch đã khớp và chưa bị xóa)
      const chartList = (chartResult && chartResult.result && chartResult.result.nav_transactions) ? chartResult.result.nav_transactions : [];
      const validChartList = chartList.filter(tx => tx.active !== false);
      const chartEnriched = await this.computeMetricsServer(validChartList);
      
      // Dữ liệu cho statcard (tất cả giao dịch chưa bị xóa)
      const statsList = (statsResult && statsResult.result && statsResult.result.nav_transactions) ? statsResult.result.nav_transactions : [];
      const validStatsList = statsList.filter(tx => tx.active !== false);
      const statsEnriched = await this.computeMetricsServer(validStatsList);
      
      // Cập nhật nguồn dữ liệu cho chart (chỉ giao dịch đã khớp)
      this.state.allFundTransactions = chartEnriched;
      
      // Tính thống kê dựa trên tất cả giao dịch (chờ khớp + khớp lệnh)
      await this.calculateStatsFromAllTransactions(statsEnriched);
      
      // Tính series cho chart từ giao dịch đã khớp
      const series = this.computeIntradaySeries(chartEnriched);
      this.state.chartPoints = series;
      const ys = series.map(p => p.y);
      this.state.chartMin = ys.length ? Math.min(...ys) : 0;
      this.state.chartMax = ys.length ? Math.max(...ys) : 0;
      this.renderChartJs('#navChartCanvas', series, { min: this.state.chartMin, max: this.state.chartMax });
    } catch (e) {
      console.error('Error in loadChartData:', e);
    }
  }

  // Method để cập nhật statcard khi có thay đổi dữ liệu
  async updateStatCard() {
    try {
      const fundId = this.state.selectedFundId;
      if (!fundId) return;
      
      console.log('Updating stat card for fund:', fundId);
      
      // Cập nhật giá NAV trung bình từ tồn kho cuối ngày
      await this.loadAverageNavPrice(fundId);
      
      console.log('Stat card updated. Average NAV value:', this.state.averageNavValue);
    } catch (e) {
      console.error('Error updating stat card:', e);
    }
  }
}

