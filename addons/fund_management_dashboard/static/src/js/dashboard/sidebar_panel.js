/** @odoo-module */

import { Component, xml, useState } from "@odoo/owl";

const PRODUCT_MENU = [
    { label: "Chứng chỉ quỹ", href: "/fund_certificate_list" },
    { label: "Kỳ hạn / Lãi suất", href: "/term_rate_list" },
];

const DATA_MENU = [
    { label: "Ngày lễ", href: "/holiday_list" },
    { label: "Ngân hàng", href: "/bank_list" },
    { label: "Chi nhánh ngân hàng", href: "/bank_branch_list" },
];

const USER_MENU = [
    { label: "Quản trị hệ thống", href: "/user-management/system-admin", permissionType: "system_admin" },
    { label: "Nhân viên quỹ", href: "/user-management/fund-operator", permissionType: "fund_operator" },
    { label: "Nhà đầu tư", href: "/user-management/investor-user", permissionType: "investor_user" },
];

export class SidebarPanel extends Component {
    setup() {
        this.productMenu = PRODUCT_MENU;
        this.dataMenu = DATA_MENU;
        this.userMenu = USER_MENU;
        this.userName = "";

        // Get current path to determine active menu
        const currentPath = window.location.pathname;

        // Check if any product menu item is active
        const activeProductItem = this.productMenu.find(item =>
            currentPath === item.href || currentPath.startsWith(item.href + '/')
        );

        // Check if any data menu item is active
        const activeDataItem = this.dataMenu.find(item =>
            currentPath === item.href || currentPath.startsWith(item.href + '/')
        );

        // Check if any user menu item is active
        const activeUserItem = this.userMenu.find(item => {
            // Check by exact path match
            return currentPath === item.href || currentPath.startsWith(item.href + '/');
        });

        this.state = useState({
            collapsed: false,
            openMenus: {
                product: !!activeProductItem, // Auto-open if active item found
                data: !!activeDataItem, // Auto-open if active item found
                user: !!activeUserItem, // Auto-open if active item found
            },
            currentPath: currentPath,
            userName: "Loading...",
        });

        this.fetchUserInfo();
    }

    async fetchUserInfo() {
        try {
            const response = await fetch('/web/session/get_session_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            const data = await response.json();
            if (data.result && data.result.name) {
                this.state.userName = data.result.name;
            }
        } catch (e) {
            console.error("Failed to fetch user info", e);
        }
    }

    async logout() {
        try {
            await fetch('/web/session/destroy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            window.location.href = '/web/login';
        } catch (e) {
            console.error("Logout failed", e);
        }
    }

    toggleCollapse() {
        // Keeping for compatibility but making it a no-op if toggled externally
    }

    toggleMenu(menuKey) {
        this.state.openMenus[menuKey] = !this.state.openMenus[menuKey];
    }

    isMenuOpen(menuKey) {
        return Boolean(this.state.openMenus[menuKey]);
    }

    isActive(href) {
        const currentPath = this.state.currentPath || window.location.pathname;
        return currentPath === href || currentPath.startsWith(href + '/');
    }

    isUserMenuActive(permissionType) {
        const currentPath = this.state.currentPath || window.location.pathname;
        const menuItem = this.userMenu.find(item => item.permissionType === permissionType);
        if (menuItem) {
            return currentPath === menuItem.href || currentPath.startsWith(menuItem.href + '/');
        }
        return false;
    }

    isDashboardActive() {
        const currentPath = this.state.currentPath || window.location.pathname;
        return currentPath === '/fund-management-dashboard' || currentPath.startsWith('/fund-management-dashboard');
    }

    static template = xml`
        <aside class="dashboard-sidebar">
            <div class="sidebar-logo">
                <img src="/fund_management_dashboard/static/src/img/logo.png" alt="Logo" class="sidebar-logo-img"/>
            </div>
            <div class="sidebar-menu">
                <p class="sidebar-group">Danh mục</p>
                <ul>
                    <li t-attf-class="#{this.isDashboardActive() ? 'active' : ''}">
                        <a href="/fund-management-dashboard" class="sidebar-link">
                            <i class="fas fa-chart-pie"></i>
                            <span>Dashboard</span>
                        </a>
                    </li>
                </ul>

                <div class="sidebar-dropdown">
                    <button t-attf-class="nav-main-item justify-content-between #{this.isMenuOpen('user') ? 'active expanded' : ''}"
                            type="button"
                            t-on-click="() => this.toggleMenu('user')">
                        <span class="d-flex align-items-center">
                            <i class="fas fa-user-check fa-fw me-3"></i>
                            <span>Người dùng</span>
                        </span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div t-attf-class="sidebar-submenu #{this.isMenuOpen('user') ? 'show' : ''}">
                        <a t-foreach="this.userMenu"
                           t-as="item"
                           t-key="item.href"
                           t-att-href="item.href"
                           t-attf-class="sidebar-submenu-item #{this.isUserMenuActive(item.permissionType) ? 'active' : ''}">
                            <t t-esc="item.label"/>
                        </a>
                    </div>
                </div>

                <div class="sidebar-dropdown">
                    <button t-attf-class="nav-main-item justify-content-between #{this.isMenuOpen('product') ? 'active expanded' : ''}"
                            type="button"
                            t-on-click="() => this.toggleMenu('product')">
                        <span class="d-flex align-items-center">
                            <i class="fas fa-box fa-fw me-3"></i>
                            <span>Sản phẩm</span>
                        </span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div t-attf-class="sidebar-submenu #{this.isMenuOpen('product') ? 'show' : ''}">
                        <a t-foreach="this.productMenu"
                           t-as="item"
                           t-key="item.href"
                           t-att-href="item.href"
                           t-attf-class="sidebar-submenu-item #{this.isActive(item.href) ? 'active' : ''}">
                            <t t-esc="item.label"/>
                        </a>
                    </div>
                </div>

                <div class="sidebar-dropdown">
                    <button t-attf-class="nav-main-item justify-content-between #{this.isMenuOpen('data') ? 'active expanded' : ''}"
                            type="button"
                            t-on-click="() => this.toggleMenu('data')">
                        <span class="d-flex align-items-center">
                            <i class="fas fa-database fa-fw me-3"></i>
                            <span>Dữ liệu</span>
                        </span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div t-attf-class="sidebar-submenu #{this.isMenuOpen('data') ? 'show' : ''}">
                        <a t-foreach="this.dataMenu"
                           t-as="item"
                           t-key="item.href"
                           t-att-href="item.href"
                           t-attf-class="sidebar-submenu-item #{this.isActive(item.href) ? 'active' : ''}">
                            <t t-esc="item.label"/>
                        </a>
                    </div>
                </div>

                </div>

                <div class="sidebar-footer">
                    <div class="user-info">
                        <div class="user-avatar">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div class="user-details">
                            <span class="user-name" t-esc="state.userName"/>
                        </div>
                    </div>
                    <button class="logout-btn" t-on-click="logout" title="Đăng xuất">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Đăng xuất</span>
                    </button>
                </div>
        </aside>
    `;
}

// Export to window for use in other modules (e.g., fund_management_control)
if (typeof window !== 'undefined') {
    window.SidebarPanel = SidebarPanel;
}

