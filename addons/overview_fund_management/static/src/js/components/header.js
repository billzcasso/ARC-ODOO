/** @odoo-module **/
import { Component, xml, useState, onMounted, onPatched } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class Header extends Component {
    static template = xml`
    <div>
        <!-- Main Fixed Header -->
        <header class="hd-header-wrapper" t-att-class="state.scrolled ? 'scrolled' : ''">
            <div class="container-fluid d-flex align-items-center h-100">
                <!-- 1. Logo Section -->
                <a href="/investment_dashboard" class="navbar-brand">
                    <img src="/overview_fund_management/static/src/img/logo.png" alt="HDCapital Logo"/>
                </a>

                <!-- 2. Navigation Menu (Desktop & Mobile) -->
                <ul class="nav-menu" t-att-class="state.mobileMenuOpen ? 'show' : ''">
                    <li class="nav-item">
                        <a href="/investment_dashboard" t-attf-class="nav-link #{state.currentPage === 'overview' ? 'active' : ''}">
                            <i class="fas fa-home"></i>Tổng quan
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="/fund_widget" t-attf-class="nav-link #{state.currentPage === 'products' ? 'active' : ''}">
                            <i class="fas fa-chart-line"></i>Sản phẩm Đầu tư
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="/transaction_management/pending" t-attf-class="nav-link #{state.currentPage === 'transactions' ? 'active' : ''}">
                            <i class="fas fa-exchange-alt"></i>Quản lý Giao dịch
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="/asset-management" t-attf-class="nav-link #{state.currentPage === 'assets' ? 'active' : ''}">
                            <i class="far fa-clock"></i>Quản lý Tài sản
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="/personal_profile" t-attf-class="nav-link #{state.currentPage === 'profile' ? 'active' : ''}">
                            <i class="far fa-user-circle"></i>Hồ sơ cá nhân
                        </a>
                    </li>
                    <t t-if="state.isMarketMaker">
                        <li class="nav-item">
                            <a href="/order-book" t-attf-class="nav-link #{state.currentPage === 'order_matching' ? 'active' : ''}">
                                <i class="fas fa-book"></i>Sổ lệnh
                            </a>
                        </li>
                    </t>
                </ul>

                <!-- 3. Right Actions -->
                <div class="header-actions">
                    <t t-if="state.isLoggedIn">
                        <!-- Notification Bell -->
                        <div class="position-relative" id="notificationDropdownWrapper">
                            <button class="notification-btn" t-att-class="state.pendingNotificationsCount > 0 ? 'has-new' : ''" t-on-click="toggleNotificationDropdown">
                                <i class="far fa-bell"></i>
                                <t t-if="state.pendingNotificationsCount > 0">
                                    <span class="badge-count"><t t-esc="state.pendingNotificationsCount"/></span>
                                </t>
                            </button>
                            
                            <!-- Notification Dropdown -->
                            <div class="hd-dropdown-menu notification-dropdown" id="notificationDropdown">
                                <div class="notif-header">
                                    <h6>Thông báo</h6>
                                    <t t-if="state.pendingNotificationsCount > 0">
                                        <small class="text-primary"><t t-esc="state.pendingNotificationsCount"/> chưa đọc</small>
                                    </t>
                                </div>
                                
                                <t t-if="state.notifications.length > 0">
                                    <div class="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                                         <div class="form-check m-0">
                                            <input class="form-check-input" type="checkbox" id="selectAllNotifications" 
                                                   t-on-change="() => this.toggleSelectAllNotifications()"
                                                   t-att-checked="state.selectedNotificationIds.length === state.notifications.length and state.notifications.length > 0"/>
                                            <label class="form-check-label small text-muted" for="selectAllNotifications">Tất cả</label>
                                         </div>
                                         <t t-if="state.selectedNotificationIds.length > 0">
                                            <button class="btn btn-xs btn-link text-danger text-decoration-none p-0" t-on-click="() => this.deleteSelectedNotifications()">
                                                <small>Xóa (<t t-esc="state.selectedNotificationIds.length"/>)</small>
                                            </button>
                                         </t>
                                    </div>
                                </t>
                                
                                <div class="notif-list">
                                    <t t-if="state.notifications.length === 0">
                                        <div class="empty-state">
                                            <i class="far fa-bell-slash"></i>
                                            <p class="m-0 small">Không có thông báo mới</p>
                                        </div>
                                    </t>
                                    <t t-foreach="state.notifications" t-as="notif" t-key="notif.id">
                                        <div t-attf-class="notif-item #{notif.investor_response === 'pending' ? 'unread' : ''}" t-on-click="() => this.handleNotificationClick(notif)">
                                            <div class="d-flex align-items-start gap-2">
                                                <input class="form-check-input mt-1" type="checkbox" 
                                                       t-att-checked="state.selectedNotificationIds.includes(notif.id)"
                                                       t-on-change="() => this.toggleNotificationSelection(notif.id)"
                                                       t-on-click.stop=""/>
                                                <div class="flex-grow-1">
                                                    <div class="notif-title">
                                                        <t t-if="notif.notification_type === 'order_filled'">
                                                            <span class="text-success"><i class="fas fa-check-circle me-1"></i>Lệnh đã khớp</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_cancelled'">
                                                            <span class="text-danger"><i class="fas fa-times-circle me-1"></i>Lệnh đã hủy</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_sent_success'">
                                                            <span class="text-success"><i class="fas fa-paper-plane me-1"></i>Đặt lệnh thành công</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_sent_failed'">
                                                            <span class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Đặt lệnh thất bại</span>
                                                        </t>
                                                        <t t-elif="notif.investor_response === 'pending'">Đáo hạn hợp đồng</t>
                                                        <t t-else="">Đã xử lý</t>
                                                        <span class="ms-auto small text-muted fst-normal" style="font-size:0.7rem; font-weight:400"><t t-esc="notif.maturity_date || notif.created_at"/></span>
                                                    </div>
                                                    <div class="notif-desc">
                                                        <t t-if="notif.message"><t t-esc="notif.message"/></t>
                                                        <t t-else="">
                                                            Lệnh <strong><t t-esc="notif.transaction_name"/></strong> thuộc quỹ <strong><t t-esc="notif.fund_name"/></strong>
                                                        </t>
                                                    </div>
                                                    <div class="notif-meta">
                                                        <t t-if="!notif.message"><span><t t-esc="notif.units"/> CCQ</span></t>
                                                        <t t-if="notif.notification_type === 'order_filled'">
                                                            <span class="badge bg-success">Đã khớp</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_cancelled'">
                                                            <span class="badge bg-danger">Đã hủy</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_sent_success'">
                                                            <span class="badge bg-success">Đã gửi</span>
                                                        </t>
                                                        <t t-elif="notif.notification_type === 'order_sent_failed'">
                                                            <span class="badge bg-danger">Thất bại</span>
                                                        </t>
                                                        <t t-elif="notif.investor_response === 'pending'">
                                                            <span class="badge bg-warning text-dark">Chờ xử lý</span>
                                                        </t>
                                                        <t t-elif="notif.investor_response === 'confirmed'">
                                                            <span class="badge bg-success">Đã bán</span>
                                                        </t>
                                                        <t t-elif="notif.investor_response === 'rejected'">
                                                            <span class="badge bg-danger">Đã từ chối</span>
                                                        </t>
                                                    </div>
                                                </div>
                                                <button class="btn btn-link text-muted p-0 ms-1" t-on-click.stop="() => this.deleteNotification(notif)">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </t>
                                </div>
                            </div>
                        </div>

                        <!-- User Profile Dropdown -->
                        <div class="position-relative" id="accountDropdownWrapper">
                            <button class="user-dropdown-btn" t-on-click="toggleAccountDropdown">
                                <div class="user-avatar">
                                    <t t-esc="this.getInitials(state.userName)"/>
                                </div>
                                <div class="user-info">
                                    <span class="user-name"><t t-esc="this.getShortName(state.userName)"/></span>
                                    <span class="user-role"><t t-esc="state.accountNo"/><t t-if="state.securitiesAccountNo"> / <t t-esc="state.securitiesAccountNo"/></t></span>
                                </div>
                                <i class="fas fa-chevron-down"></i>
                            </button>

                            <!-- Account Dropdown Menu -->
                            <div class="hd-dropdown-menu" id="accountDropdown">
                                <div class="dropdown-header">
                                    <div class="d-flex align-items-center gap-2 mb-1">
                                        <i class="fas fa-wallet text-primary"></i>
                                        <span class="small fw-bold">Thông tin tài khoản</span>
                                    </div>
                                </div>
                                <a href="/my-account" class="dropdown-item">
                                    <i class="fas fa-receipt"></i>Tài khoản đầu tư
                                </a>
                                <div class="dropdown-divider my-1"></div>
                                <a href="#" t-on-click="logout" class="dropdown-item text-danger">
                                    <i class="fas fa-sign-out-alt"></i>Đăng xuất
                                </a>
                            </div>
                        </div>
                    </t>
                    <t t-else="">
                        <a href="/web/login" class="login-btn">
                            Đăng nhập <i class="fas fa-arrow-right ms-2"></i>
                        </a>
                    </t>

                    <!-- Mobile Menu Toggle -->
                    <button class="mobile-toggle-btn" t-on-click="toggleMobileMenu">
                        <i t-att-class="state.mobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Spacer to prevent content overlap -->
        <div class="header-spacer"></div>
        
        <!-- Modals & Toasts (Keep existing logic) -->
        <!-- Notification Detail Modal -->
        <t t-if="state.showNotificationModal">
           <div class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5); z-index:5000;">
             <div class="modal-dialog modal-dialog-centered modal-lg">
               <div class="modal-content rounded-4 shadow-lg border-0">
                 <div class="modal-header bg-white border-bottom p-4">
                   <h5 class="modal-title fw-bold text-dark">
                     Chi tiết thông báo
                   </h5>
                   <button type="button" class="btn-close" t-on-click="() => this.closeNotificationModal()"></button>
                 </div>
                 <div class="modal-body p-4 bg-light">
                   <t t-if="state.transactionDetails">
                     <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <div class="row g-4">
                               <div class="col-md-6">
                                 <label class="text-muted small text-uppercase fw-bold mb-1">Mã lệnh</label>
                                 <div class="fw-bold fs-5 text-dark"><t t-esc="state.transactionDetails.transaction_name || 'N/A'"/></div>
                               </div>
                               <div class="col-md-6">
                                 <label class="text-muted small text-uppercase fw-bold mb-1">Quỹ đầu tư</label>
                                 <div class="fw-bold fs-5 text-primary"><t t-esc="state.transactionDetails.fund_name || 'N/A'"/></div>
                               </div>
                               <div class="col-md-6">
                                 <label class="text-muted small text-uppercase fw-bold mb-1">Ngày đáo hạn</label>
                                 <div class="fw-bold text-dark"><t t-esc="state.transactionDetails.maturity_date || 'N/A'"/></div>
                               </div>
                               <div class="col-md-6">
                                 <label class="text-muted small text-uppercase fw-bold mb-1">Số lượng CCQ</label>
                                 <div class="fw-bold text-dark"><t t-esc="state.transactionDetails.units ? state.transactionDetails.units.toLocaleString('vi-VN') : 'N/A'"/></div>
                               </div>
                               <div class="col-12 mt-3 pt-3 border-top">
                                    <div class="d-flex justify-content-between align-items-end">
                                        <div>
                                            <label class="text-muted small text-uppercase fw-bold mb-1">Giá trị ước tính</label>
                                            <div class="small text-muted">Đơn giá: <t t-esc="state.transactionDetails.ccq_price ? state.transactionDetails.ccq_price.toLocaleString('vi-VN') + ' VNĐ' : 'N/A'"/></div>
                                        </div>
                                        <div class="fw-bolder fs-3 text-success">
                                            <t t-esc="state.transactionDetails.estimated_value ? state.transactionDetails.estimated_value.toLocaleString('vi-VN') + ' VNĐ' : 'N/A'"/>
                                        </div>
                                    </div>
                               </div>
                            </div>
                        </div>
                     </div>
                     
                     <t t-if="state.selectedNotification and state.selectedNotification.investor_response === 'pending'">
                         <div class="alert alert-warning border-warning d-flex gap-3 align-items-start opacity-75">
                           <i class="fas fa-exclamation-triangle mt-1"></i>
                           <div>
                             <strong>Hành động bắt buộc:</strong> Lệnh này đã đến hạn. Bạn muốn bán lại để chốt lời hay giữ lại?
                             <div class="mt-1 small">Nếu đồng ý bán, hệ thống sẽ tạo lệnh bán tự động.</div>
                           </div>
                         </div>
                     </t>
                   </t>
                   <t t-else="">
                     <div class="text-center py-5">
                       <div class="spinner-border text-primary" role="status"></div>
                       <p class="mt-3 text-muted">Đang tải dữ liệu...</p>
                     </div>
                   </t>
                 </div>
                 <div class="modal-footer bg-white p-3 border-top">
                   <button type="button" class="btn btn-light" t-on-click="() => this.closeNotificationModal()">Đóng</button>
                   <t t-if="state.selectedNotification and state.selectedNotification.investor_response === 'pending'">
                     <button type="button" class="btn btn-outline-danger" t-on-click="() => this.rejectNotification(state.selectedNotification)">
                       Từ chối bán
                     </button>
                     <button type="button" class="btn btn-primary" t-on-click="() => this.confirmNotification(state.selectedNotification)">
                       Đồng ý bán
                     </button>
                   </t>
                 </div>
               </div>
             </div>
           </div>
           <div class="modal-backdrop fade show" t-on-click="() => this.closeNotificationModal()"></div>
        </t>
        
        <!-- Toast & Confirm Modals (Reused from original) -->
        <t t-if="state.showToast">
          <div class="position-fixed top-0 end-0 p-3" style="z-index:9999; margin-top:80px;">
            <div t-attf-class="toast show align-items-center text-white bg-#{state.toastType === 'success' ? 'success' : state.toastType === 'error' ? 'danger' : state.toastType === 'warning' ? 'warning' : 'info'} border-0" role="alert" aria-live="assertive" aria-atomic="true" style="min-width:300px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
              <div class="d-flex">
                <div class="toast-body d-flex align-items-center">
                  <i t-attf-class="fas #{state.toastType === 'success' ? 'fa-check-circle' : state.toastType === 'error' ? 'fa-exclamation-circle' : state.toastType === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2"></i>
                  <span t-esc="state.toastMessage"/>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" t-on-click="() => this.hideToast()"></button>
              </div>
            </div>
          </div>
        </t>
        
        <t t-if="state.showConfirmModal">
          <div class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5); z-index:6000;">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content rounded-4 shadow-lg border-0">
                <div class="modal-header border-bottom">
                  <h5 class="modal-title fw-bold">Xác nhận</h5>
                  <button type="button" class="btn-close" t-on-click="() => this.cancelConfirm()"></button>
                </div>
                <div class="modal-body p-4">
                  <p class="mb-0 fs-6" t-esc="state.confirmMessage"/>
                </div>
                <div class="modal-footer border-top bg-light">
                  <button type="button" class="btn btn-light" t-on-click="() => this.cancelConfirm()">Hủy</button>
                  <button type="button" class="btn btn-primary" t-on-click="() => this.executeConfirm()">Đồng ý</button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-backdrop fade show" t-on-click="() => this.cancelConfirm()"></div>
        </t>
    </div>
    `;

    setup() {
        // Defensive check: only use useService if env.services is available
        this.busService = null;
        try {
            if (this.env && this.env.services && this.env.services.bus_service) {
                this.busService = useService("bus_service");
            }
        } catch (e) {
            console.warn("bus_service not available in this context");
        }

        this.listenersAttached = false;
        this.notificationListenersAttached = false;
        this.state = useState({
            currentPage: this.getCurrentPage(),
            userName: '',
            accountNo: '',
            email: '',
            isLoggedIn: false,
            isMarketMaker: false,
            notifications: [],
            pendingNotificationsCount: 0,
            showNotificationModal: false,
            selectedNotification: null,
            transactionDetails: null,
            showToast: false,
            toastMessage: '',
            toastType: 'success',
            showConfirmModal: false,
            confirmMessage: '',
            confirmCallback: null,
            selectedNotificationIds: [],
            scrolled: false,
            mobileMenuOpen: false
        });
        
        this.fetchUserInfo();

        onMounted(() => {
            window.addEventListener('scroll', this.handleScroll.bind(this));
            
            // Listen to Odoo Bus Notifications
            if (this.busService) {
                this.busService.addEventListener("notification", ({ detail: notifications }) => {
                    for (const { payload } of notifications) {
                        if (payload && (payload.type === 'maturity_notification' || 
                                      payload.type === 'order_filled' || 
                                      payload.type === 'order_cancelled' ||
                                      payload.type === 'order_sent_success' ||
                                      payload.type === 'order_sent_failed')) {
                            console.log('Received notification via bus:', payload);
                            this.fetchMaturityNotifications();
                            
                            // Show toast for order status updates
                            if (['order_filled', 'order_cancelled', 'order_sent_success', 'order_sent_failed'].includes(payload.type)) {
                                let toastType = 'success';
                                if (payload.type === 'order_cancelled') toastType = 'warning';
                                if (payload.type === 'order_sent_failed') toastType = 'error';
                                this.showToast(payload.message, toastType);
                            }
                        }
                    }
                });
            }
        });

        onPatched(() => {
            if (this.state.isLoggedIn && !this.listenersAttached) {
                // Dropdown click outside logic
                document.addEventListener('click', (e) => {
                    const accWrapper = document.getElementById('accountDropdownWrapper');
                    const notifWrapper = document.getElementById('notificationDropdownWrapper');
                    const accDropdown = document.getElementById('accountDropdown');
                    const notifDropdown = document.getElementById('notificationDropdown');

                    if (accWrapper && accDropdown && !accWrapper.contains(e.target)) {
                        accDropdown.classList.remove('show');
                    }
                    if (notifWrapper && notifDropdown && !notifWrapper.contains(e.target)) {
                        notifDropdown.classList.remove('show');
                    }
                });
                this.listenersAttached = true;
            }

            if (this.state.isLoggedIn) {
                this.fetchMaturityNotifications();
                this.setupWebSocketListener();
            }
        });
    }
    
    handleScroll() {
        this.state.scrolled = window.scrollY > 10;
    }
    
    toggleMobileMenu() {
        this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/investment_dashboard')) return 'overview';
        if (path.includes('/fund_widget')) return 'products';
        if (path.includes('/transaction_management')) return 'transactions';
        if (path.includes('/asset-management')) return 'assets';
        if (path.includes('/order-book')) return 'order_matching';
        
        // Correction for active tab issue on profile sub-pages
        if (path.includes('/personal_profile') || 
            path.includes('/bank_info') || 
            path.includes('/address_info') || 
            path.includes('/verification') ||
            path.includes('/my-account')) {
            return 'profile';
        }
        
        return '';
    }
    
    getInitials(name) {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    getShortName(name) {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length <= 2) return name;
        return parts[parts.length - 2] + ' ' + parts[parts.length - 1];
    }
    
    toggleAccountDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
            // Close other dropdowns
            const notif = document.getElementById('notificationDropdown');
            if (notif) notif.classList.remove('show');
        }
    }
    
    toggleNotificationDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
            // Close other dropdowns
            const acc = document.getElementById('accountDropdown');
            if (acc) acc.classList.remove('show');
            
            if (!dropdown.classList.contains('show')) {
                 this.state.selectedNotificationIds = [];
            }
        }
    }
    
    async fetchUserInfo() {
        try {
            const response = await fetch('/web/session/get_session_info', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: '{}'
            });
            const data = await response.json();
            if (data.result && data.result.uid) {
                this.state.userName = data.result.name;
                this.state.email = data.result.username || data.result.login || '';
                const statusInfo = await this.fetchStatusInfo();
                this.state.accountNo = statusInfo.accountNo;
                this.state.securitiesAccountNo = statusInfo.securitiesAccountNo;
                this.state.isLoggedIn = true;
                await this.checkMarketMakerPermission();
                this.fetchMaturityNotifications();
            } else {
                this.state.userName = '';
                this.state.accountNo = '';
                this.state.securitiesAccountNo = '';
                this.state.email = '';
                this.state.isLoggedIn = false;
                this.state.notification = [];
            }
        } catch (e) {
            console.error(e);
            this.state.isLoggedIn = false;
        }
    }

    async checkMarketMakerPermission() {
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
            const data = jsonRpcResponse.result || jsonRpcResponse;
            
            if (data && data.success) {
                this.state.isMarketMaker = data.is_market_maker || false;
            }
        } catch (error) {
            console.error('Error checking market maker permission:', error);
            this.state.isMarketMaker = false;
        }
    }

    async fetchMaturityNotifications() {
        try {
            const response = await fetch('/api/transaction-list/maturity-notifications', {
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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const jsonRpcResponse = await response.json();
            const data = jsonRpcResponse.result || jsonRpcResponse;
            
            if (data && data.success && data.notifications) {
                this.state.notifications = data.notifications;
                this.state.pendingNotificationsCount = data.notifications.filter(n => n.investor_response === 'pending').length;
            } else {
                this.state.notifications = [];
                this.state.pendingNotificationsCount = 0;
            }
        } catch (e) {
            console.error('Lỗi khi lấy thông báo đáo hạn:', e);
            this.state.notifications = [];
            this.state.pendingNotificationsCount = 0;
        }
    }

    toggleNotificationSelection(notificationId) {
        const index = this.state.selectedNotificationIds.indexOf(notificationId);
        if (index > -1) {
            this.state.selectedNotificationIds.splice(index, 1);
        } else {
            this.state.selectedNotificationIds.push(notificationId);
        }
    }
    
    toggleSelectAllNotifications() {
        if (this.state.selectedNotificationIds.length === this.state.notifications.length) {
            this.state.selectedNotificationIds = [];
        } else {
            this.state.selectedNotificationIds = this.state.notifications.map(n => n.id);
        }
    }
    
    async deleteSelectedNotifications() {
        if (this.state.selectedNotificationIds.length === 0) {
            return;
        }
        
        this.showConfirm(`Bạn có chắc chắn muốn xóa ${this.state.selectedNotificationIds.length} thông báo đã chọn?`, async () => {
            await this.performDeleteSelectedNotifications();
        });
    }
    
    async performDeleteSelectedNotifications() {
        try {
            const response = await fetch('/api/transaction-list/delete-maturity-notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        notification_ids: this.state.selectedNotificationIds
                    },
                    id: Math.floor(Math.random() * 1000000)
                })
            });
            
            if (response.ok) {
                const jsonRpcResponse = await response.json();
                const data = jsonRpcResponse.result || jsonRpcResponse;
                if (data && data.success) {
                    const deletedCount = this.state.selectedNotificationIds.length;
                    this.state.selectedNotificationIds = [];
                    await this.fetchMaturityNotifications();
                    this.showToast(`Đã xóa ${deletedCount} thông báo thành công`, 'success');
                } else {
                    this.showToast('Không thể xóa thông báo: ' + (data.message || 'Lỗi không xác định'), 'error');
                }
            }
        } catch (error) {
            console.error('Lỗi khi xóa thông báo:', error);
            this.showToast('Lỗi kết nối: ' + error.message, 'error');
        }
    }

    async handleNotificationClick(notification) {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
        
        this.state.selectedNotification = notification;
        this.state.showNotificationModal = true;
        this.state.transactionDetails = null;
        
        try {
            const response = await fetch(`/api/transaction-list/get-transaction-details/${notification.transaction_id}`, {
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
            
            if (response.ok) {
                const jsonRpcResponse = await response.json();
                const data = jsonRpcResponse.result || jsonRpcResponse;
                if (data && data.success && data.transaction) {
                    const units = notification.units || notification.remaining_units || 0;
                    const ccqPrice = data.transaction.ccq_price || data.transaction.current_nav || data.transaction.price || 0;
                    const estimatedValue = data.transaction.estimated_value || (units * ccqPrice);
                    
                    this.state.transactionDetails = {
                        transaction_name: data.transaction.name || notification.transaction_name,
                        fund_name: data.transaction.fund_name || notification.fund_name,
                        maturity_date: notification.maturity_date,
                        units: units,
                        ccq_price: ccqPrice,
                        nav: data.transaction.current_nav || data.transaction.price || 0,
                        estimated_value: estimatedValue
                    };
                }
            }
        } catch (error) {
            console.error('Lỗi khi lấy chi tiết transaction:', error);
            this.state.transactionDetails = {
                transaction_name: notification.transaction_name,
                fund_name: notification.fund_name,
                maturity_date: notification.maturity_date,
                units: notification.units || notification.remaining_units || 0,
                ccq_price: 0,
                nav: 0,
                estimated_value: 0
            };
        }
    }
    
    closeNotificationModal() {
        this.state.showNotificationModal = false;
        this.state.selectedNotification = null;
        this.state.transactionDetails = null;
    }
    
    showToast(message, type = 'success') {
        this.state.toastMessage = message;
        this.state.toastType = type;
        this.state.showToast = true;
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }
    
    hideToast() {
        this.state.showToast = false;
        this.state.toastMessage = '';
    }
    
    showConfirm(message, callback) {
        this.state.confirmMessage = message;
        this.state.confirmCallback = callback;
        this.state.showConfirmModal = true;
    }
    
    executeConfirm() {
        if (this.state.confirmCallback) {
            this.state.confirmCallback();
        }
        this.cancelConfirm();
    }
    
    cancelConfirm() {
        this.state.showConfirmModal = false;
        this.state.confirmMessage = '';
        this.state.confirmCallback = null;
    }
    
    async deleteNotification(notification) {
        this.showConfirm('Bạn có chắc chắn muốn xóa thông báo này?', async () => {
            await this.performDeleteNotification(notification);
        });
    }
    
    async performDeleteNotification(notification) {
        try {
            const response = await fetch('/api/transaction-list/delete-maturity-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        notification_id: notification.id
                    },
                    id: Math.floor(Math.random() * 1000000)
                })
            });
            
            if (response.ok) {
                const jsonRpcResponse = await response.json();
                const data = jsonRpcResponse.result || jsonRpcResponse;
                if (data && data.success) {
                    await this.fetchMaturityNotifications();
                    this.showToast('Đã xóa thông báo thành công', 'success');
                } else {
                    this.showToast('Không thể xóa thông báo: ' + (data.message || 'Lỗi không xác định'), 'error');
                }
            }
        } catch (error) {
            console.error('Lỗi khi xóa thông báo:', error);
            this.showToast('Lỗi kết nối: ' + error.message, 'error');
        }
    }
    
    async confirmNotification(notification) {
        this.showConfirm('Bạn có chắc chắn muốn đồng ý bán lệnh này? Hệ thống sẽ tự động tạo lệnh bán.', async () => {
            await this.performConfirmNotification(notification);
        });
    }
    
    async performConfirmNotification(notification) {
        try {
            const response = await fetch(`/api/transaction-list/confirm-maturity-notification/${notification.id}`, {
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
            
            if (response.ok) {
                const jsonRpcResponse = await response.json();
                const data = jsonRpcResponse.result || jsonRpcResponse;
                if (data && data.success) {
                    const sellOrderName = data.sell_order_name || '';
                    const message = sellOrderName 
                        ? `Đã xác nhận bán thành công! Lệnh bán ${sellOrderName} đã được tạo và sẽ được đưa vào sổ lệnh để khớp.`
                        : 'Đã xác nhận bán thành công! Lệnh bán đã được tạo và sẽ được đưa vào sổ lệnh để khớp.';
                    this.showToast(message, 'success');
                    this.closeNotificationModal();
                    await this.fetchMaturityNotifications();
                } else {
                    this.showToast('Không thể xác nhận: ' + (data.message || 'Lỗi không xác định'), 'error');
                }
            } else {
                let errorMessage = 'Lỗi kết nối: HTTP ' + response.status;
                try {
                    const text = await response.text();
                    if (text) {
                        let parsed;
                        try {
                            parsed = JSON.parse(text);
                        } catch (parseError) {
                            parsed = null;
                        }
                        const data = parsed ? (parsed.result || parsed) : null;
                        if (data && data.message) {
                            errorMessage = data.message;
                        }
                    }
                } catch (e) {
                   // Ignore
                }
                this.showToast(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Lỗi khi xác nhận:', error);
            this.showToast('Lỗi kết nối: ' + error.message, 'error');
        }
    }
    
    async rejectNotification(notification) {
        this.showConfirm('Bạn có chắc chắn muốn từ chối bán lệnh này?', async () => {
            await this.performRejectNotification(notification);
        });
    }
    
    async performRejectNotification(notification) {
        try {
            const response = await fetch(`/api/transaction-list/reject-maturity-notification/${notification.id}`, {
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
            
            if (response.ok) {
                const jsonRpcResponse = await response.json();
                const data = jsonRpcResponse.result || jsonRpcResponse;
                if (data && data.success) {
                    this.showToast('Đã từ chối bán thành công', 'success');
                    this.closeNotificationModal();
                    await this.fetchMaturityNotifications();
                } else {
                    this.showToast('Không thể từ chối: ' + (data.message || 'Lỗi không xác định'), 'error');
                }
            }
        } catch (error) {
            console.error('Lỗi khi từ chối:', error);
            this.showToast('Lỗi kết nối: ' + error.message, 'error');
        }
    }

    setupWebSocketListener() {
        if (this.websocketListenerAttached) {
            return;
        }
        
        window.addEventListener('maturity-notification-received', (event) => {
            const payload = event.detail;
            if (payload && payload.type === 'maturity_notification') {
                this.fetchMaturityNotifications();
            }
        });
        
        window.addEventListener('maturity-confirmation-received', (event) => {
            const payload = event.detail;
            if (payload && payload.type === 'maturity_confirmation') {
                this.fetchMaturityNotifications();
            }
        });
        
        this.websocketListenerAttached = true;
    }

    async fetchStatusInfo() {
        try {
            const response = await fetch('/get_status_info', {
                method: 'GET',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data && Array.isArray(data) && data.length > 0) {
                return {
                    accountNo: data[0].account_number || '',
                    securitiesAccountNo: data[0].securities_account || ''
                };
            }
            return { accountNo: '', securitiesAccountNo: '' };
        } catch (e) {
            return { accountNo: '', securitiesAccountNo: '' };
        }
    }

    async logout() {
        await fetch('/web/session/destroy', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: '{}'
        });
        window.location.href = '/web/login';
    }
}

window.Header = Header;
