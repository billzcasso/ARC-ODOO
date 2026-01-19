/** @odoo-module **/
import { Component, xml, useState, onMounted, onPatched, onWillUnmount } from "@odoo/owl";

export class Header extends Component {
    static template = xml`
    <div>
    <header class="bo-header" t-att-class="state.scrolled ? 'scrolled' : ''">
      <!-- Top Bar -->
      <div class="bo-topbar">
        <!-- Logo -->
        <a href="/fund-management-dashboard" class="bo-logo">
          <img t-att-src="'/investor_list/static/src/img/logo.png'" alt="HDCapital Logo" class="bo-logo__image"/>
        </a>
        
        <!-- Header Actions -->
        <div class="bo-header-actions">
          
          <t t-if="state.isLoggedIn">
            <!-- User Menu -->
            <div class="bo-user-menu" t-att-class="state.isUserDropdownOpen ? 'active' : ''" id="boUserMenu">
              <button class="bo-user-menu__trigger" t-on-click="toggleUserDropdown">
                <div class="bo-user-menu__avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="bo-user-menu__info">
                  <span class="bo-user-menu__name"><t t-esc="state.userName"/></span>
                  <span class="bo-user-menu__role">Nhân viên</span>
                </div>
                <i class="fas fa-chevron-down bo-user-menu__chevron"></i>
              </button>
              
              <!-- User Dropdown -->
              <div class="bo-user-dropdown">
                <div class="bo-user-dropdown__header">
                  <div class="name"><t t-esc="state.userName"/></div>
                  <div class="email">Nhân viên Quản lý Quỹ</div>
                </div>
                <div class="bo-user-dropdown__body">

                  <button class="bo-user-dropdown__item bo-user-dropdown__item--danger" t-on-click="logout">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </div>
          </t>
          <t t-else="">
            <a href="/web/login" class="bo-btn bo-btn--primary">
              <i class="fas fa-sign-in-alt"></i>
              <span>Đăng nhập</span>
            </a>
          </t>
          
          <!-- Mobile Toggle -->
          <div class="bo-mobile-toggle">
            <button class="bo-mobile-toggle__btn" t-on-click="toggleMobileMenu">
              <i t-att-class="state.isMobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Navigation Bar -->
      <nav class="bo-navbar">
        <div class="bo-nav">
          <div class="bo-nav-item">
            <a t-att-class="'bo-nav-link ' + (state.currentPage === 'dashboard' ? 'active' : '')" href="/fund-management-dashboard">
              <i class="fas fa-gauge-high"></i>
              <span>Tổng quan</span>
            </a>
          </div>
          
          <div class="bo-nav-item">
            <a t-att-class="'bo-nav-link ' + (state.currentPage === 'investor' ? 'active' : '')" href="/investor_list">
              <i class="fas fa-users"></i>
              <span>Nhà đầu tư</span>
            </a>
          </div>
          
          <!-- Transaction Dropdown -->
          <div t-att-class="'bo-nav-item dropdown ' + (state.isTransactionDropdownOpen ? 'active' : '')">
            <button t-att-class="'bo-nav-link ' + (state.currentPage === 'transaction' || state.currentPage === 'order-book' ? 'active' : '')" t-on-click="toggleTransactionDropdown">
              <i class="fas fa-exchange-alt"></i>
              <span>Giao dịch</span>
              <i class="fas fa-chevron-down chevron"></i>
            </button>
            <div class="bo-nav-dropdown">
              <div class="bo-nav-dropdown__header">
                <i class="fas fa-exchange-alt"></i> Giao dịch
              </div>
              <div class="bo-nav-dropdown__body">
                <a href="/transaction-list" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'transaction' ? 'active' : ''" t-on-click="closeTransactionDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--blue"><i class="fas fa-list"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Danh sách giao dịch</div>
                    <div class="desc">Quản lý danh sách giao dịch</div>
                  </div>
                </a>
                <a href="/order-book" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'order-book' ? 'active' : ''" t-on-click="closeTransactionDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--green"><i class="fas fa-book"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Sổ lệnh</div>
                    <div class="desc">Sổ lệnh giao dịch real-time</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
          
          <!-- NAV Dropdown -->
          <div t-att-class="'bo-nav-item dropdown ' + (state.isNavDropdownOpen ? 'active' : '')">
            <button t-att-class="'bo-nav-link ' + (state.currentPage === 'nav-transaction' ? 'active' : '')" t-on-click="toggleNavDropdown">
              <i class="fas fa-chart-line"></i>
              <span>NAV</span>
              <i class="fas fa-chevron-down chevron"></i>
            </button>
            <div class="bo-nav-dropdown">
              <div class="bo-nav-dropdown__header">
                <i class="fas fa-chart-line"></i> NAV Management
              </div>
              <div class="bo-nav-dropdown__body">
                <a href="/nav_management/nav_transaction" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'nav-transaction' ? 'active' : ''" t-on-click="closeNavDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--blue"><i class="fas fa-exchange-alt"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">NAV Phiên giao dịch</div>
                    <div class="desc">Quản lý NAV theo phiên giao dịch</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
          
          <!-- Report Dropdown -->
          <div t-att-class="'bo-nav-item dropdown ' + (state.isReportDropdownOpen ? 'active' : '')">
            <button t-att-class="'bo-nav-link ' + (state.currentPage.includes('report') ? 'active' : '')" t-on-click="toggleReportDropdown">
              <i class="fas fa-file-alt"></i>
              <span>Báo cáo</span>
              <i class="fas fa-chevron-down chevron"></i>
            </button>
            <div class="bo-nav-dropdown" style="min-width: 280px;">
              <div class="bo-nav-dropdown__header">
                <i class="fas fa-chart-bar"></i> Báo cáo
              </div>
              <div class="bo-nav-dropdown__body custom-scrollbar" style="max-height: 320px; overflow-y: auto;">
                <a href="/report-balance" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'report-balance' ? 'active' : ''" t-on-click="closeReportDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--blue"><i class="fas fa-balance-scale"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Report Balance</div>
                    <div class="desc">Báo cáo số dư</div>
                  </div>
                </a>
                <a href="/report-transaction" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'report-transaction' ? 'active' : ''" t-on-click="closeReportDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--green"><i class="fas fa-exchange-alt"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Báo cáo Giao dịch</div>
                    <div class="desc">Report Transaction</div>
                  </div>
                </a>
                <a href="/investor_report" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'investor-report' ? 'active' : ''" t-on-click="closeReportDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--purple"><i class="fas fa-users"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Danh sách Nhà đầu tư</div>
                    <div class="desc">Quản lý thông tin nhà đầu tư</div>
                  </div>
                </a>
                <a href="/list_tenors_interest_rates" class="bo-nav-dropdown__item" t-att-class="state.currentPage === 'list-tenors-interest-rates' ? 'active' : ''" t-on-click="closeReportDropdown">
                  <div class="bo-nav-dropdown__icon bo-nav-dropdown__icon--orange"><i class="fas fa-percentage"></i></div>
                  <div class="bo-nav-dropdown__text">
                    <div class="title">Kỳ hạn và Lãi suất</div>
                    <div class="desc">Quản lý kỳ hạn và lãi suất sản phẩm</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <!-- Mobile Menu -->
      <div t-att-class="'bo-mobile-menu ' + (state.isMobileMenuOpen ? 'active' : '')">
        <nav class="bo-mobile-menu__nav">
          <a href="/fund-management-dashboard" class="bo-mobile-menu__link" t-att-class="state.currentPage === 'dashboard' ? 'active' : ''">
            <i class="fas fa-gauge-high"></i>
            <span>Tổng quan</span>
            <i class="fas fa-chevron-right"></i>
          </a>
          <a href="/investor_list" class="bo-mobile-menu__link" t-att-class="state.currentPage === 'investor' ? 'active' : ''">
            <i class="fas fa-users"></i>
            <span>Nhà đầu tư</span>
            <i class="fas fa-chevron-right"></i>
          </a>
          <a href="/transaction-list" class="bo-mobile-menu__link" t-att-class="state.currentPage === 'transaction' ? 'active' : ''">
            <i class="fas fa-exchange-alt"></i>
            <span>Giao dịch</span>
            <i class="fas fa-chevron-right"></i>
          </a>
          <a href="/nav_management/nav_transaction" class="bo-mobile-menu__link" t-att-class="state.currentPage === 'nav' ? 'active' : ''">
            <i class="fas fa-chart-line"></i>
            <span>NAV</span>
            <i class="fas fa-chevron-right"></i>
          </a>
          <a href="/report-balance" class="bo-mobile-menu__link">
            <i class="fas fa-file-alt"></i>
            <span>Báo cáo</span>
            <i class="fas fa-chevron-right"></i>
          </a>
        </nav>
      </div>
    </header>
    <div class="bo-header-spacer"></div>
    </div>
    `;

    setup() {
        this.listenersAttached = false;
        this.state = useState({
            currentPage: this.getCurrentPage(),
            userName: '',
            accountNo: '',
            isLoggedIn: false,
            isReportDropdownOpen: false,
            isNavDropdownOpen: false,
            isTransactionDropdownOpen: false,
            isUserDropdownOpen: false,
            isMobileMenuOpen: false,
            scrolled: false,
        });

        // Scroll Animation Logic
        const handleScroll = () => {
             const isScrolled = window.scrollY > 10;
             if (this.state.scrolled !== isScrolled) {
                 this.state.scrolled = isScrolled;
             }
        };
        
        onMounted(() => {
             window.addEventListener('scroll', handleScroll);
             handleScroll();
        });
        
        onWillUnmount(() => {
             window.removeEventListener('scroll', handleScroll);
             // Cleanup other listeners
             if (this.cleanup) this.cleanup();
             if (this.dropdownListenerAdded) document.removeEventListener('click', this.dropdownClickHandler);
        });

        this.fetchUserInfo();

        // Cập nhật currentPage khi URL thay đổi
        this.updateCurrentPage = () => {
            this.state.currentPage = this.getCurrentPage();
        };

        // Lắng nghe sự kiện popstate (back/forward button)
        window.addEventListener('popstate', this.updateCurrentPage);

        // Cleanup function để remove event listener
        this.cleanup = () => {
            window.removeEventListener('popstate', this.updateCurrentPage);
        };

        onPatched(() => {
            // Cập nhật currentPage mỗi khi component được patch
            this.updateCurrentPage();
            
            // Add click outside listener for dropdowns
            if (!this.dropdownListenerAdded) {
                this.dropdownClickHandler = (e) => {
                    const reportDropdown = document.querySelector('.bo-nav-item.dropdown:has(.bo-nav-link:nth-child(5))');
                    const navDropdown = document.querySelector('.bo-nav-item.dropdown:has(.bo-nav-link:nth-child(4))');
                    const transactionDropdown = document.querySelector('.bo-nav-item.dropdown:has(.bo-nav-link:nth-child(3))');
                    const userMenu = document.getElementById('boUserMenu');
                    
                    // Close dropdowns when clicking outside
                    if (!e.target.closest('.bo-nav-item.dropdown')) {
                        this.closeAllNavDropdowns();
                    }
                    if (userMenu && !userMenu.contains(e.target)) {
                        this.state.isUserDropdownOpen = false;
                    }
                };
                document.addEventListener('click', this.dropdownClickHandler);
                this.dropdownListenerAdded = true;
            }

            if (this.state.isLoggedIn && (window.location.pathname === '/web' || window.location.pathname === '/web/')) {
                window.location.href = '/investor_list';
            }
        });
    }

    toggleUserDropdown(e) {
        e.stopPropagation();
        this.state.isUserDropdownOpen = !this.state.isUserDropdownOpen;
    }

    toggleMobileMenu() {
        this.state.isMobileMenuOpen = !this.state.isMobileMenuOpen;
    }

    closeAllNavDropdowns() {
        this.state.isReportDropdownOpen = false;
        this.state.isNavDropdownOpen = false;
        this.state.isTransactionDropdownOpen = false;
    }

    toggleReportDropdown(e) {
        e.stopPropagation();
        const wasOpen = this.state.isReportDropdownOpen;
        this.closeAllNavDropdowns();
        this.state.isReportDropdownOpen = !wasOpen;
    }

    closeReportDropdown() {
        this.state.isReportDropdownOpen = false;
    }

    toggleNavDropdown(e) {
        e.stopPropagation();
        const wasOpen = this.state.isNavDropdownOpen;
        this.closeAllNavDropdowns();
        this.state.isNavDropdownOpen = !wasOpen;
    }

    closeNavDropdown() {
        this.state.isNavDropdownOpen = false;
    }

    toggleTransactionDropdown(e) {
        e.stopPropagation();
        const wasOpen = this.state.isTransactionDropdownOpen;
        this.closeAllNavDropdowns();
        this.state.isTransactionDropdownOpen = !wasOpen;
    }

    closeTransactionDropdown() {
        this.state.isTransactionDropdownOpen = false;
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
                // Gọi API lấy số tài khoản từ status.info
                const soTk = await this.fetchStatusInfo();
                this.state.accountNo = soTk || '';
                this.state.isLoggedIn = true;
            } else {
                this.state.userName = '';
                this.state.accountNo = '';
                this.state.isLoggedIn = false;
            }
        } catch (e) {
            this.state.userName = '';
            this.state.accountNo = '';
            this.state.isLoggedIn = false;
        }
    }

    async fetchStatusInfo() {
        try {
            const response = await fetch('/get_status_info', {
                method: 'GET',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data && Array.isArray(data) && data.length > 0) {
                return data[0].so_tk || '';
            } else if (data && data.so_tk) {
                return data.so_tk;
            }
            return '';
        } catch (e) {
            return '';
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



    getCurrentPage() {
        const path = window.location.pathname;
        
        // Xác định trang hiện tại theo thứ tự ưu tiên
        if (path.includes('/investor_list')) return 'investor';
        if (path.includes('/fund-management-dashboard')) return 'dashboard';
        if (path.includes('/order-book')) return 'order-book';
        if (path.includes('/transaction-list')) return 'transaction';
        if (path.includes('/nav_management/nav_transaction')) return 'nav-transaction';
        if (path.includes('/fund_widget') || path.includes('/nav')) return 'nav';
        if (path.includes('/report-balance')) return 'report-balance';
        if (path.includes('/report-transaction')) return 'report-transaction';
        if (path.includes('/investor_report')) return 'investor-report';
        if (path.includes('/list_tenors_interest_rates')) return 'list-tenors-interest-rates';
        if (path.includes('/asset-management')) return 'report';
        if (path.includes('/personal_profile')) return 'utils';
        
        // Mặc định về trang investor nếu không khớp với bất kỳ trang nào
        return 'investor';
    }
}

window.Header = Header;
