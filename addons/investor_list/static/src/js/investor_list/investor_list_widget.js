/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount, useRef } from "@odoo/owl";

export class InvestorListWidget extends Component {
  static template = xml`
    <div class="bo">
      <div class="bo-container">
        <!-- Stats Cards -->
        <div class="bo-stats-grid">
          <div class="bo-stat-card bo-stat-card--clickable" t-on-click="() => this.setStatusFilter(null)">
            <div class="bo-stat-card__header">
              <div class="bo-stat-card__icon bo-stat-card__icon--primary">
                <i class="fas fa-users"></i>
              </div>
              <div class="bo-stat-card__trend bo-stat-card__trend--up">
                <i class="fas fa-arrow-up"></i>
              </div>
            </div>
            <div class="bo-stat-card__value"><t t-esc="state.totalInvestors"/></div>
            <div class="bo-stat-card__label">Tổng NĐT</div>
          </div>
          
          <div class="bo-stat-card bo-stat-card--clickable bo-stat-card--danger" t-on-click="() => this.setActiveTab('draft')">
            <div class="bo-stat-card__header">
              <div class="bo-stat-card__icon bo-stat-card__icon--danger">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
            </div>
            <div class="bo-stat-card__value"><t t-esc="state.draftCount || 0"/></div>
            <div class="bo-stat-card__label">Chưa cập nhật</div>
          </div>
          
          <div class="bo-stat-card bo-stat-card--clickable bo-stat-card--warning" t-on-click="() => this.setStatusFilter('pending')">
            <div class="bo-stat-card__header">
              <div class="bo-stat-card__icon bo-stat-card__icon--warning">
                <i class="fas fa-clock"></i>
              </div>
            </div>
            <div class="bo-stat-card__value"><t t-esc="state.pendingCount || 0"/></div>
            <div class="bo-stat-card__label">Chờ KYC</div>
          </div>
          
          <div class="bo-stat-card bo-stat-card--clickable bo-stat-card--success" t-on-click="() => this.setStatusFilter('active')">
            <div class="bo-stat-card__header">
              <div class="bo-stat-card__icon bo-stat-card__icon--success">
                <i class="fas fa-check-circle"></i>
              </div>
            </div>
            <div class="bo-stat-card__value"><t t-esc="state.activeCount || 0"/></div>
            <div class="bo-stat-card__label">Đã KYC</div>
          </div>
          
          <div class="bo-stat-card bo-stat-card--clickable bo-stat-card--info" t-on-click="() => this.setStatusFilter('vsd')">
            <div class="bo-stat-card__header">
              <div class="bo-stat-card__icon bo-stat-card__icon--info">
                <i class="fas fa-shield-alt"></i>
              </div>
            </div>
            <div class="bo-stat-card__value"><t t-esc="state.vsdCount || 0"/></div>
            <div class="bo-stat-card__label">Đã lên VSD</div>
          </div>
        </div>
                                    
        <!-- Tab Navigation -->
        <div class="bo-tabs">
          <nav class="bo-tabs__nav">
            <button class="bo-tabs__tab" t-att-class="state.activeTab === 'all' ? 'active' : ''" t-on-click="() => this.setActiveTab('all')">
              <i class="fas fa-list"></i>
              <span>Danh sách NĐT</span>
            </button>
            <button class="bo-tabs__tab" t-att-class="state.activeTab === 'draft' ? 'active' : ''" t-on-click="() => this.setActiveTab('draft')">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Chưa cập nhật</span>
            </button>
          </nav>
        </div>
                                    
        <!-- Main Table Card -->
        <div class="bo-table-card">
          <!-- Table Header -->
          <div class="bo-table-header">
            <div>
              <h2 class="bo-table-header__title">
                <i class="fas fa-table"></i> Danh sách chi tiết
              </h2>
              <p class="bo-table-header__subtitle">
                Hiển thị <strong><t t-esc="state.filteredInvestors ? state.filteredInvestors.length : 0"/></strong> trong tổng số <strong><t t-esc="state.totalInvestors"/></strong> nhà đầu tư
              </p>
            </div>
            <div class="bo-table-header__actions">
              <button class="bo-btn bo-btn--secondary bo-btn--sm" t-on-click="exportData">
                <i class="fas fa-download"></i>
                <span class="hide-sm">Xuất CSV</span>
              </button>
            </div>
          </div>
          
          <!-- Status Filter Pills -->
          <div class="bo-filter-pills" t-if="state.activeTab !== 'draft'">
            <button t-att-class="'bo-filter-pill bo-filter-pill--warning ' + (state.statusFilter === 'pending' ? 'active' : '')" t-on-click="() => this.setStatusFilter('pending')">
              <i class="fas fa-clock"></i>
              <span>Chờ KYC</span>
              <span class="bo-filter-pill__count"><t t-esc="state.pendingCount || 0"/></span>
            </button>
            <button t-att-class="'bo-filter-pill bo-filter-pill--success ' + (state.statusFilter === 'active' ? 'active' : '')" t-on-click="() => this.setStatusFilter('active')">
              <i class="fas fa-check-circle"></i>
              <span>KYC</span>
              <span class="bo-filter-pill__count"><t t-esc="state.activeCount || 0"/></span>
            </button>
            <button t-att-class="'bo-filter-pill bo-filter-pill--info ' + (state.statusFilter === 'vsd' ? 'active' : '')" t-on-click="() => this.setStatusFilter('vsd')">
              <i class="fas fa-shield-alt"></i>
              <span>VSD</span>
              <span class="bo-filter-pill__count"><t t-esc="state.vsdCount || 0"/></span>
            </button>
            <button t-if="state.statusFilter" class="bo-filter-pill bo-filter-pill--clear" t-on-click="() => this.setStatusFilter(null)">
              <i class="fas fa-times"></i>
              <span>Xóa bộ lọc</span>
            </button>
          </div>

          <!-- Compact Date Filter - Always Today -->
          <div class="bo-date-filter">
            <span class="bo-date-filter__label">
              <i class="fas fa-calendar-day"></i> Ngày mở TK:
            </span>
            <!-- Custom Styled Date Picker for dd/mm/yyyy format -->
            <div class="bo-date-picker-wrapper">
              <div class="bo-date-picker-display" t-on-click="openDatePicker">
                <i class="fas fa-calendar-alt"></i>
                <t t-if="state.dateFrom">
                    <t t-esc="this.formatDate(state.dateFrom)"/>
                </t>
                <t t-else="">
                    <span>Chọn ngày</span>
                </t>
              </div>
              <input type="date" class="bo-date-picker-hidden" t-ref="dateInput" t-att-value="state.dateFrom" t-on-change="(ev) => this.filterByDate(ev.target.value)" />
            </div>
          </div>


          <!-- Table Container -->
          <div class="bo-table-wrapper">
            <table class="bo-table bo-table--compact">
              <thead>
                <tr class="bo-table__header">
                  <th class="sortable" t-on-click="() => this.sortBy('open_date')">
                    <span>Ngày mở</span>
                    <i t-att-class="'fas ' + (state.sortField === 'open_date' ? (state.sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort')"></i>
                  </th>
                  <th class="sortable" t-on-click="() => this.sortBy('account_number')">
                    <span>Số TK</span>
                    <i t-att-class="'fas ' + (state.sortField === 'account_number' ? (state.sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort')"></i>
                  </th>
                  <th class="sortable" t-on-click="() => this.sortBy('partner_name')">
                    <span>Họ tên</span>
                    <i t-att-class="'fas ' + (state.sortField === 'partner_name' ? (state.sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort')"></i>
                  </th>
                  <th>ĐKSH</th>
                  <th>SĐT</th>
                  <th>Email</th>
                  <th>Tỉnh/TP</th>
                  <th>Trạng thái</th>
                </tr>
                <tr class="bo-table-filters">
                  <th></th>
                  <th>
                    <input type="text" class="filter-input" placeholder="Tìm số TK..." t-on-input="(ev) => this.filterTable('account_number', ev.target.value)" />
                  </th>
                  <th>
                    <input type="text" class="filter-input" placeholder="Tìm họ tên..." t-on-input="(ev) => this.filterTable('partner_name', ev.target.value)" />
                  </th>
                  <th>
                    <input type="text" class="filter-input" placeholder="ĐKSH..." t-on-input="(ev) => this.filterTable('id_number', ev.target.value)" />
                  </th>
                  <th>
                    <input type="text" class="filter-input" placeholder="SĐT..." t-on-input="(ev) => this.filterTable('phone', ev.target.value)" />
                  </th>
                  <th>
                    <input type="text" class="filter-input" placeholder="Email..." t-on-input="(ev) => this.filterTable('email', ev.target.value)" />
                  </th>
                  <th>
                    <input type="text" class="filter-input" placeholder="Tỉnh/TP..." t-on-input="(ev) => this.filterTable('province_city', ev.target.value)" />
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <t t-if="state.loading">
                  <tr>
                    <td colspan="8">
                      <div class="bo-loading">
                        <div class="bo-loading__spinner"></div>
                        <div class="bo-loading__text">Đang tải dữ liệu...</div>
                      </div>
                    </td>
                  </tr>
                </t>
                <t t-elif="state.error">
                  <tr>
                    <td colspan="8">
                      <div class="bo-empty-state">
                        <i class="fas fa-exclamation-triangle bo-empty-state__icon text-danger"></i>
                        <h3 class="bo-empty-state__title">Lỗi tải dữ liệu</h3>
                        <p class="bo-empty-state__desc"><t t-esc="state.error"/></p>
                        <button class="bo-btn bo-btn--primary" t-on-click="() => this.loadData()">
                          <i class="fas fa-refresh"></i> Thử lại
                        </button>
                      </div>
                    </td>
                  </tr>
                </t>
                <t t-elif="state.filteredInvestors and state.filteredInvestors.length > 0">
                  <t t-foreach="state.filteredInvestors.slice(state.startIndex, state.endIndex)" t-as="investor" t-key="investor.id">
                    <tr>
                      <td><t t-esc="this.formatDate(investor.open_date)"/></td>
                      <td><t t-esc="this.getDisplayValue(investor.account_number)"/></td>
                      <td class="text-left truncate"><t t-esc="this.getDisplayValue(investor.partner_name)"/></td>
                      <td><t t-esc="this.getDisplayValue(investor.id_number)"/></td>
                      <td><t t-esc="this.getDisplayValue(investor.phone)"/></td>
                      <td class="text-left truncate"><t t-esc="this.getDisplayValue(investor.email)"/></td>
                      <td><t t-esc="this.getDisplayValue(investor.province_city)"/></td>
                      <td>
                        <div class="bo-action-btns">
                          <span t-att-class="'bo-badge bo-badge--' + this.getStatusBadge(investor.status)">
                            <t t-esc="this.getStatusDisplayValue(investor.status)"/>
                          </span>
                          <t t-if="investor.status === 'pending' || investor.status === 'draft'">
                            <button class="bo-btn bo-btn--success bo-btn--sm" t-on-click="() => this.approveInvestor(investor.id)" title="Duyệt">
                              <i class="fas fa-check"></i>
                            </button>
                          </t>
                          <button class="bo-btn bo-btn--ghost bo-btn--sm bo-btn--icon" t-on-click="() => this.editInvestor(investor)" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </t>
                </t>
                <t t-else="">
                  <tr>
                    <td colspan="8">
                      <div class="bo-empty-state">
                        <i class="fas fa-users bo-empty-state__icon"></i>
                        <h3 class="bo-empty-state__title">Không có dữ liệu</h3>
                      </div>
                    </td>
                  </tr>
                </t>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="bo-pagination">
            <div class="bo-pagination__info">
              Hiển thị <strong><t t-esc="state.startIndex + 1"/></strong> đến <strong><t t-esc="Math.min(state.endIndex, state.filteredInvestors.length)"/></strong> trong tổng số <strong><t t-esc="state.filteredInvestors.length"/></strong> kết quả
            </div>
            <div class="bo-pagination__controls">
              <button class="bo-pagination__btn" t-att-disabled="state.currentPage === 1" t-on-click="() => this.changePage(state.currentPage - 1)">
                <i class="fas fa-chevron-left"></i>
              </button>
              <t t-foreach="state.pageNumbers" t-as="page" t-key="page">
                <button t-att-class="'bo-pagination__btn ' + (page === state.currentPage ? 'active' : '')" t-on-click="() => this.changePage(page)">
                  <t t-esc="page"/>
                </button>
              </t>
              <button class="bo-pagination__btn" t-att-disabled="state.currentPage === state.totalPages" t-on-click="() => this.changePage(state.currentPage + 1)">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <t t-if="state.showEditModal">
        <div class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5); z-index: 9999;">
          <div class="modal-dialog modal-lg">
            <div class="modal-content" style="border-radius: 12px; overflow: hidden;">
              <div class="modal-header" style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; border: none;">
                <h5 class="modal-title">
                  <i class="fas fa-edit me-2"></i>Chỉnh sửa thông tin nhà đầu tư
                </h5>
                <button type="button" class="btn-close btn-close-white" t-on-click="closeEditModal"></button>
              </div>
              <div class="modal-body">
                <t t-if="state.editingInvestor">
                  <!-- Thông báo về logic trạng thái -->
                  <div class="alert alert-info mb-3" style="border-radius: 8px;">
                    <h6 class="alert-heading"><i class="fas fa-info-circle me-2"></i>Logic cập nhật trạng thái tự động:</h6>
                    <ul class="mb-0 small">
                      <li><strong>Chưa cập nhật:</strong> Hồ sơ gốc chưa nhận + Trạng thái TK chờ duyệt</li>
                      <li><strong>Chờ KYC:</strong> Hồ sơ gốc đã nhận + Trạng thái TK chờ duyệt</li>
                      <li><strong>KYC:</strong> Hồ sơ gốc đã nhận + Trạng thái TK đã duyệt</li>
                      <li><strong>VSD:</strong> Có thể điều chỉnh tự do</li>
                    </ul>
                  </div>
                  <form t-on-submit.prevent="saveInvestor">
                    <div class="row g-3">
                      <!-- Thông tin cá nhân -->
                      <div class="col-md-6">
                        <label class="form-label">Họ tên <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" t-model="state.editingInvestor.partner_name" required="required"/>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label">Số điện thoại</label>
                        <input type="text" class="form-control" t-model="state.editingInvestor.phone"/>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" t-model="state.editingInvestor.email"/>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label">ĐKSH</label>
                        <input type="text" class="form-control" t-model="state.editingInvestor.id_number"/>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label">Tỉnh/Thành phố</label>
                        <input type="text" class="form-control" t-model="state.editingInvestor.province_city"/>
                      </div>
                      

                      
                      <!-- Trạng thái TK đầu tư -->
                      <div class="col-md-6">
                        <label class="form-label">Trạng thái TK đầu tư <span class="text-danger">*</span></label>
                        <select class="form-select" t-model="state.editingInvestor.account_status" required="required" t-on-change="autoUpdateStatus">
                          <option value="approved">Đã duyệt</option>
                          <option value="pending">Chờ duyệt</option>
                          <option value="rejected">Từ chối</option>
                        </select>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label">Hồ sơ gốc <span class="text-danger">*</span></label>
                        <select class="form-select" t-model="state.editingInvestor.profile_status" required="required" t-on-change="autoUpdateStatus">
                          <option value="complete">Đã nhận</option>
                          <option value="incomplete">Chưa nhận</option>
                        </select>
                      </div>
                      
                      <!-- Trạng thái -->
                      <div class="col-md-6">
                        <label class="form-label">Trạng thái <span class="text-danger">*</span></label>
                        <select class="form-select" t-model="state.editingInvestor.status" required="required">
                          <option value="draft">Chưa cập nhật</option>
                          <option value="pending">Chờ KYC</option>
                          <option value="active">KYC</option>
                          <option value="vsd">VSD</option>
                          <option value="rejected">Từ chối</option>
                        </select>
                      </div>
                    </div>
                    
                    <div class="modal-footer border-0 pt-4">
                      <button type="button" class="bo-btn bo-btn--secondary" t-on-click="closeEditModal">
                        <i class="fas fa-times"></i> Hủy
                      </button>
                      <button type="submit" class="bo-btn bo-btn--primary">
                        <i class="fas fa-save"></i> Lưu thay đổi
                      </button>
                    </div>
                  </form>
                </t>
              </div>
            </div>
          </div>
        </div>
      </t>
    </div>
  `;

  setup() {
    this.state = useState({
      investors: [],
      filteredInvestors: [],
      searchTerm: '',
      statusFilter: null,
      activeTab: 'all',
      currentPage: 1,
      pageSize: 10,
      startIndex: 0,
      endIndex: 10,
      totalPages: 1,
      pageNumbers: [],
      totalInvestors: 0,
      draftCount: 0,
      pendingCount: 0,
      activeCount: 0,
      vsdCount: 0,
      rejectedCount: 0,
      dateFrom: new Date().toISOString().split('T')[0],
      dateFilter: 'custom', // Use custom date filter
      sortField: 'open_date',
      sortOrder: 'desc',
      loading: false,
      error: null,
      // Modal states
      showEditModal: false,
      editingInvestor: null,
      bdaUsers: [],
    });

    this.dateInput = useRef("dateInput");

    // Listen for bus updates from entrypoint
    this.handleBusEvent = async (event) => {
      const message = event.detail;
      if (message && message.type) {
        await this.loadDataFromAPI();
        this.showUpdateNotification(this.getNotificationMessage(message.type));
      }
    };

    onMounted(() => {
      document.addEventListener('investor-data-update', this.handleBusEvent);
    });

    onWillUnmount(() => {
      document.removeEventListener('investor-data-update', this.handleBusEvent);
    });

    this.loadData();
  }

  getNotificationMessage(type) {
    const messages = {
      'create': 'Co nha dau tu moi duoc them',
      'write': 'Du lieu nha dau tu da duoc cap nhat',
      'unlink': 'Nha dau tu da bi xoa',
    };
    return messages[type] || 'Du lieu da duoc cap nhat';
  }

  // ============================================
  // DATA REFRESH HELPERS
  // ============================================

  startBusPolling() {
    // Bus polling is handled by entrypoint.js
  }

  stopBusPolling() {
    // Bus polling is handled by entrypoint.js
  }

  showUpdateNotification(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'bo-toast bo-toast--info';
    toast.textContent = '';
    toast.insertAdjacentHTML('beforeend', `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `);
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #3B82F6, #1E40AF);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async loadData() {
    try {
      this.state.loading = true;
      this.state.error = null;
      

      
      // Kiểm tra xem có dữ liệu từ controller không
      if (window.allDashboardData && window.allDashboardData.investors) {
        this.state.investors = window.allDashboardData.investors;
        this.calculateStats();
        this.applyFilters();
        this.updatePagination();
        this.state.loading = false;
        return;
      }

      // Nếu không có dữ liệu từ controller, thử lấy từ API

      await this.loadDataFromAPI();
      
    } catch (error) {
      console.error('Error loading data:', error);
      this.state.error = error.message;
      this.state.loading = false;
    }
  }

  async loadDataFromAPI() {
    try {
      console.log('Loading data from API...');
      
      const response = await fetch('/web/dataset/call_kw/investor.list/search_read', {
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
            model: 'investor.list',
            method: 'search_read',
            args: [],
            kwargs: {
              fields: ['open_date', 'account_number', 'partner_name', 'id_number', 'phone', 'email', 'province_city', 'status', 'account_status', 'profile_status'],
              limit: 1000
            }
          }
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      if (result.result && result.result.records && result.result.records.length > 0) {
        console.log('Found records from API:', result.result.records.length);
        this.state.investors = result.result.records;
        this.calculateStats();
        this.applyFilters();
        this.updatePagination();
        this.state.loading = false;
      } else {
        console.log('No records found in database, trying to sync portal users...');
        await this.syncPortalUsers();
        await this.loadDataAfterSync();
      }
      
    } catch (error) {
      console.error('Error loading data from API:', error);
      this.state.error = error.message;
      this.state.loading = false;
    }
  }

  async loadDataAfterSync() {
    try {
      console.log('Loading data after sync...');
      
      const response = await fetch('/web/dataset/call_kw/investor.list/search_read', {
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
            model: 'investor.list',
            method: 'search_read',
            args: [],
            kwargs: {
              fields: ['open_date', 'account_number', 'partner_name', 'id_number', 'phone', 'email', 'province_city', 'status', 'account_status', 'profile_status'],
              limit: 1000
            }
          }
        })
      });

      const result = await response.json();
      console.log('Data after sync:', result);
      
      if (result.result && result.result.records && result.result.records.length > 0) {
        console.log('Found records after sync:', result.result.records.length);
        this.state.investors = result.result.records;
        this.calculateStats();
        this.applyFilters();
        this.updatePagination();
      } else {
        console.log('Still no records, showing empty state');
        this.state.investors = [];
        this.calculateStats();
        this.applyFilters();
        this.updatePagination();
      }
      
      this.state.loading = false;
    } catch (error) {
      console.error('Error loading data after sync:', error);
      this.state.error = error.message;
      this.state.loading = false;
    }
  }

  async syncPortalUsers() {
    try {
      console.log('Syncing portal users...');
      
      const response = await fetch('/web/dataset/call_kw/investor.list/sync_portal_users', {
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
            model: 'investor.list',
            method: 'sync_portal_users',
            args: [],
            kwargs: {}
          }
        })
      });

      const result = await response.json();
      console.log('Sync result:', result);
      
      if (result.result) {
        console.log('Portal users synced successfully');
      }
    } catch (error) {
      console.error('Error syncing portal users:', error);
    }
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  }

  getDisplayValue(value) {
    return value || '-';
  }

  getSourceBadge(source) {
    switch (source) {
      case 'tpb2': return 'warning';
      case 'fpla1': return 'success';
      case 'scb': return 'info';
      default: return 'primary';
    }
  }

  getStatusBadge(status) {
    switch (status) {
      case 'draft': return 'warning';
      case 'pending': return 'pending';
      case 'active': return 'success';
      case 'vsd': return 'info';
      case 'rejected': return 'danger';
      default: return 'primary';
    }
  }

  updatePagination() {
    const totalItems = this.state.filteredInvestors.length;
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
    this.state.searchTerm = value;
    this.applyFilters();
  }

  filterByDate(value) {
    this.state.dateFrom = value;
    this.applyFilters();
  }

  openDatePicker() {
      if (this.dateInput.el) {
          try {
              this.dateInput.el.showPicker();
          } catch (error) {
              console.warn("Browser does not support showPicker or other error:", error);
              // Fallback or ignore
          }
      }
  }



  applyFilters() {
    let filtered = this.state.investors;

    // Áp dụng tab filter trước
    if (this.state.activeTab === 'draft') {
      // Tab "Chưa cập nhật" - chỉ hiển thị draft
      filtered = filtered.filter(investor => investor.status === 'draft');
    } else {
      // Tab "Danh sách NĐT" - chỉ hiển thị pending, active, vsd (loại bỏ draft và rejected)
      filtered = filtered.filter(investor => ['pending', 'active', 'vsd'].includes(investor.status));
      
      // Áp dụng status filter nếu có
      if (this.state.statusFilter && this.state.statusFilter !== null) {
        filtered = filtered.filter(investor => investor.status === this.state.statusFilter);
      }
    }

    // Apply date filter
    if (this.state.dateFrom) {
      filtered = filtered.filter(investor => {
        if (!investor.open_date) return false;
        const investorDate = new Date(investor.open_date);
        const selectedDate = new Date(this.state.dateFrom);
        return investorDate.toDateString() === selectedDate.toDateString();
      });
    }

    // Apply search filter
    if (this.state.searchTerm) {
      const searchTerm = this.state.searchTerm.toLowerCase();
      filtered = filtered.filter(investor => 
        (investor.partner_name && investor.partner_name.toLowerCase().includes(searchTerm)) ||
        (investor.account_number && investor.account_number.toLowerCase().includes(searchTerm)) ||
        (investor.phone && investor.phone.includes(searchTerm)) ||
        (investor.email && investor.email.toLowerCase().includes(searchTerm)) ||
        (investor.id_number && investor.id_number.includes(searchTerm)) ||
        (investor.province_city && investor.province_city.toLowerCase().includes(searchTerm))
      );
    }

    this.state.filteredInvestors = filtered;
    this.state.currentPage = 1;
    this.applySorting();
    this.calculateStats();
  }

  changePage(page) {
    if (page >= 1 && page <= this.state.totalPages) {
      this.state.currentPage = page;
      this.updatePagination();
    }
  }

  setStatusFilter(status) {
    if (this.state.statusFilter === status) {
      this.state.statusFilter = null;
    } else {
      this.state.statusFilter = status;
    }
    this.applyFilters();
  }

  // ============================================
  // DATE FILTER METHODS
  // ============================================



  // ============================================
  // SORT METHODS
  // ============================================

  sortBy(field) {
    if (this.state.sortField === field) {
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortField = field;
      this.state.sortOrder = 'asc';
    }
    this.applySorting();
  }

  applySorting() {
    const field = this.state.sortField;
    const order = this.state.sortOrder;
    
    this.state.filteredInvestors.sort((a, b) => {
      let valA = a[field] || '';
      let valB = b[field] || '';
      
      if (field === 'open_date') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updatePagination();
  }

  setActiveTab(tab) {
    this.state.activeTab = tab;
    if (tab === 'draft') {
      this.state.statusFilter = null;
    }
    this.applyFilters();
  }

  calculateStats() {
    this.state.totalInvestors = this.state.investors.length;
    this.state.draftCount = this.state.investors.filter(investor => investor.status === 'draft').length;
    this.state.pendingCount = this.state.investors.filter(investor => investor.status === 'pending').length;
    this.state.activeCount = this.state.investors.filter(investor => investor.status === 'active').length;
    this.state.vsdCount = this.state.investors.filter(investor => investor.status === 'vsd').length;
    this.state.rejectedCount = this.state.investors.filter(investor => investor.status === 'rejected').length;
  }

  exportData() {
    const dataToExport = this.state.filteredInvestors || [];
    
    if (dataToExport.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    const headers = [
      'Ngày mở TK', 'Số tài khoản', 'Họ tên', 'ĐKSH', 'Số điện thoại', 
      'Email', 'Tỉnh/TP', 'Nguồn', 'BDA', 'Trạng thái', 'TK đầu tư', 'Hồ sơ gốc'
    ];

    const csvData = dataToExport.map(investor => [
      this.formatDate(investor.open_date),
      this.getDisplayValue(investor.account_number),
      this.getDisplayValue(investor.partner_name),
      this.getDisplayValue(investor.id_number),
      this.getDisplayValue(investor.phone),
      this.getDisplayValue(investor.email),
      this.getDisplayValue(investor.province_city),
      this.getDisplayValue(investor.source),
      this.getDisplayValue(investor.bda_user),
      this.getStatusDisplayValue(investor.status),
      this.getDisplayValue(investor.account_status),
      this.getDisplayValue(investor.profile_status)
    ]);

    const csvContent = this.convertToCSV([headers, ...csvData]);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `danh_sach_nha_dau_tu_${timestamp}.csv`;
    
    this.downloadCSV(csvContent, fileName);
  }

  getStatusDisplayValue(status) {
    const statusMap = {
      'draft': 'Chưa cập nhật',
      'pending': 'Chờ KYC',
      'active': 'KYC',
      'vsd': 'VSD',
      'rejected': 'Từ chối'
    };
    return statusMap[status] || status;
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  refreshData() {
    console.log('Refreshing data...');
    this.loadDataFromAPI();
  }

  async editInvestor(investor) {
    await this.loadBdaUsers();
    this.state.editingInvestor = { ...investor };
    this.state.showEditModal = true;
  }

  async loadBdaUsers() {
    try {
      const response = await fetch('/api/users', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const users = await response.json();
        this.state.bdaUsers = users;
      }
    } catch (error) {
      console.error('Error loading BDA users:', error);
    }
  }

  closeEditModal() {
    this.state.showEditModal = false;
    this.state.editingInvestor = null;
  }

  autoUpdateStatus() {
    if (this.state.editingInvestor) {
      // New algorithm: Based on account_status and profile_status
      if (this.state.editingInvestor.account_status === 'rejected') {
        this.state.editingInvestor.status = 'rejected';
      } else if (this.state.editingInvestor.account_status === 'approved') {
        this.state.editingInvestor.status = 'active';
      } else if (this.state.editingInvestor.profile_status === 'complete') {
        this.state.editingInvestor.status = 'pending';
      } else {
        this.state.editingInvestor.status = 'draft';
      }
    }
  }

  async approveInvestor(investorId) {
    if (!confirm('Bạn có chắc chắn muốn duyệt nhà đầu tư này?')) return;
    
    try {
      const response = await fetch(`/web/dataset/call_kw/investor.list/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'investor.list',
            method: 'write',
            args: [[investorId], { account_status: 'approved', status_manual: true }],
            kwargs: {}
          }
        })
      });
      
      const result = await response.json();
      if (result.result) {
        this.showUpdateNotification('Đã duyệt nhà đầu tư thành công!');
        await this.loadDataFromAPI();
      } else {
        alert('Lỗi: ' + (result.error?.message || 'Không thể duyệt'));
      }
    } catch (error) {
      console.error('Error approving investor:', error);
      alert('Lỗi kết nối. Vui lòng thử lại!');
    }
  }

  async saveInvestor() {
    if (!this.state.editingInvestor) return;

    try {
      const updateData = {
        partner_name: this.state.editingInvestor.partner_name,
        phone: this.state.editingInvestor.phone,
        email: this.state.editingInvestor.email,
        id_number: this.state.editingInvestor.id_number,
        province_city: this.state.editingInvestor.province_city,
        source: this.state.editingInvestor.source,
        bda_user: this.state.editingInvestor.bda_user || false,
        account_status: this.state.editingInvestor.account_status,
        profile_status: this.state.editingInvestor.profile_status,
        status: this.state.editingInvestor.status
      };

      const response = await fetch(`/api/investor_list/${this.state.editingInvestor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        this.closeEditModal();
        alert('Cập nhật thông tin thành công!');
        await this.loadDataFromAPI();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.message || 'Không thể cập nhật thông tin'}`);
      }
    } catch (error) {
      console.error('Error updating investor:', error);
      alert('Lỗi kết nối. Vui lòng thử lại!');
    }
  }
}
