/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount } from "@odoo/owl";

export class UserPermissionWidget extends Component {
    static props = {
        initialData: { type: Object, optional: true },
    };

    setup() {
        // Get data from props or fallback to URL
        const initialData = this.props.initialData || {};
        let permissionType = initialData.permission_type || '';
        let pageTitle = initialData.page_title || 'Quản lý Phân quyền Hệ thống';
        let breadcrumbTitle = initialData.breadcrumb_title || 'Quản lý Phân quyền Hệ thống';

        // Fallback to URL if no data from props
        if (!permissionType) {
            const currentPath = window.location.pathname;
            if (currentPath.includes('/system-admin')) {
                permissionType = 'system_admin';
                pageTitle = 'Danh sách Quản trị viên hệ thống';
                breadcrumbTitle = 'Danh sách Quản trị viên hệ thống';
            } else if (currentPath.includes('/investor-user')) {
                permissionType = 'investor_user';
                pageTitle = 'Danh sách Nhà đầu tư';
                breadcrumbTitle = 'Danh sách nhà đầu tư';
            } else if (currentPath.includes('/fund-operator')) {
                permissionType = 'fund_operator';
                pageTitle = 'Danh sách nhân viên quản lý quỹ';
                breadcrumbTitle = 'Danh sách nhân viên quản lý quỹ';
            }
        }

        this.state = useState({
            users: [],
            loading: true,
            searchTerm: '',
            permissionType: permissionType, // Fixed permission type for this page
            statusFilter: '',
            total: 0,
            currentPage: 1,
            pageSize: 20,
            showModal: false,
            editingUser: null,
            pageTitle: pageTitle,
            breadcrumbTitle: breadcrumbTitle,
            formData: {
                name: '',
                email: '',
                phone: '',
                password: '',
                position: '',
                permission_type: permissionType,
                is_market_maker: false, // Chỉ áp dụng cho investor_user
                active: true,
            },
            formErrors: {},
        });

        this.debounceTimer = null;
        onMounted(() => {
            this.loadUsers();
        });
        onWillUnmount(() => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
        });
    }

    onSearchInput(event) {
        this.state.searchTerm = event.target.value;
        this.debounceSearch();
    }

    onSearchClick() {
        this.loadUsers();
    }

    onStatusFilterChange(event) {
        this.state.statusFilter = event.target.value;
        this.loadUsers();
    }

    debounceSearch() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.loadUsers();
        }, 500);
    }

    goToPage(page) {
        if (page < 1 || page > this.getTotalPages()) {
            return;
        }
        this.state.currentPage = page;
        this.loadUsers();
    }

    getTotalPages() {
        return Math.ceil(this.state.total / this.state.pageSize);
    }

    getPaginationPages() {
        const totalPages = this.getTotalPages();
        const currentPage = this.state.currentPage;
        const pages = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    }

    onPrevPage() {
        if (this.state.currentPage > 1) {
            this.goToPage(this.state.currentPage - 1);
        }
    }

    onNextPage() {
        if (this.state.currentPage < this.getTotalPages()) {
            this.goToPage(this.state.currentPage + 1);
        }
    }

    async loadUsers() {
        this.state.loading = true;
        try {
            const domain = [];

            if (this.state.statusFilter) {
                domain.push(['active', '=', this.state.statusFilter === 'active']);
            }

            const fetchResponse = await fetch('/api/user-permission/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain: domain,
                    search: this.state.searchTerm,
                    permission_type: this.state.permissionType, // Gửi permission_type để filter
                    limit: this.state.pageSize,
                    offset: (this.state.currentPage - 1) * this.state.pageSize,
                }),
            });
            const data = await fetchResponse.json();
            if (data.success) {
                this.state.users = data.users || [];
                this.state.total = data.total || 0;
            } else {
                console.error('Error loading users:', data.error);
                this.showNotification('Lỗi khi tải danh sách user', 'danger');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Lỗi khi tải danh sách user', 'danger');
        } finally {
            this.state.loading = false;
        }
    }

    async openCreateModal() {
        this.state.editingUser = null;
        this.state.formData = {
            name: '',
            email: '',
            phone: '',
            password: '',
            position: '',
            permission_type: this.state.permissionType,
            is_market_maker: false,
            active: true,
        };
        this.state.formErrors = {};
        this.state.showModal = true;
    }

    openEditModal(user) {
        this.state.editingUser = user;
        this.state.formData = {
            name: user.name || '',
            email: user.email,
            phone: user.phone || '',
            password: '', // Don't show password when editing
            position: user.notes || '', // Use notes field for position
            permission_type: user.permission_type,
            is_market_maker: user.is_market_maker || false,
            active: user.active,
        };
        this.state.formErrors = {};
        this.state.showModal = true;
    }

    closeModal() {
        this.state.showModal = false;
        this.state.editingUser = null;
        this.state.formData = {
            name: '',
            email: '',
            phone: '',
            password: '',
            position: '',
            permission_type: this.state.permissionType,
            is_market_maker: false,
            active: true,
        };
        this.state.formErrors = {};
    }

    validateForm() {
        const errors = {};

        if (!this.state.editingUser) {
            // Khi tạo mới, validate các field bắt buộc
            if (!this.state.formData.name || !this.state.formData.name.trim()) {
                errors.name = 'Tên người dùng không được để trống';
            }
            if (!this.state.formData.email || !this.state.formData.email.trim()) {
                errors.email = 'Email không được để trống';
            } else {
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(this.state.formData.email)) {
                    errors.email = 'Email không hợp lệ';
                }
            }
            if (!this.state.formData.password || !this.state.formData.password.trim()) {
                errors['password'] = 'Mật khẩu không được để trống';
            } else if (this.state.formData.password.length < 6) {
                errors['password'] = 'Mật khẩu phải có ít nhất 6 ký tự';
            }
        }

        // Chức vụ không bắt buộc nữa

        this.state.formErrors = errors;
        return Object.keys(errors).length === 0;
    }

    async saveUser() {
        if (!this.validateForm()) {
            return;
        }

        try {
            const url = this.state.editingUser
                ? '/api/user-permission/update'
                : '/api/user-permission/create';

            const payload = {
                notes: this.state.formData.position, // Store position in notes field
                permission_type: this.state.formData.permission_type,
                active: this.state.formData.active,
                phone: this.state.formData.phone || '',
            };

            if (!this.state.editingUser) {
                // Khi tạo mới, gửi thông tin user mới
                // Sử dụng email làm login
                payload.name = this.state.formData.name.trim();
                payload.email = this.state.formData.email.trim();
                payload.login = this.state.formData.email.trim(); // Email được dùng làm login
                payload.password = this.state.formData.password;
                // Thêm is_market_maker nếu là investor_user
                if (this.state.formData.permission_type === 'investor_user') {
                    payload.is_market_maker = this.state.formData.is_market_maker || false;
                }
            } else {
                // Khi cập nhật
                // Nếu user có permission record (có id), gửi id
                // Nếu user chưa có permission record (id là null), gửi user_id để tạo mới
                if (this.state.editingUser.id) {
                    payload.id = this.state.editingUser.id;
                } else if (this.state.editingUser.user_id) {
                    payload.user_id = this.state.editingUser.user_id;
                } else {
                    this.showNotification('Không thể xác định user để cập nhật', 'danger');
                    return;
                }

                // Include password if provided
                if (this.state.formData.password && this.state.formData.password.trim()) {
                    payload.password = this.state.formData.password;
                }
                // Cập nhật is_market_maker nếu là investor_user
                if (this.state.formData.permission_type === 'investor_user') {
                    payload.is_market_maker = this.state.formData.is_market_maker || false;
                }
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data && data.success) {
                this.showNotification(data.message || 'Lưu thành công', 'success');
                this.closeModal();
                this.loadUsers();
            } else {
                this.showNotification(data?.error || 'Lỗi khi lưu', 'danger');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.showNotification('Lỗi khi lưu user', 'danger');
        }
    }

    toggleFormMarketMaker() {
        // Toggle cho form (không cần confirm)
        this.state.formData.is_market_maker = !this.state.formData.is_market_maker;
    }

    async toggleMarketMakerButton(user) {
        // Kiểm tra disabled
        if (!user.has_permission && !user.user_id) {
            return;
        }

        const currentValue = user.is_market_maker || false;
        const newValue = !currentValue;

        // Hiển thị popup xác nhận
        const actionText = newValue ? 'bật' : 'tắt';
        const confirmMessage = `Bạn có chắc chắn muốn ${actionText} "Nhà tạo lập" cho ${user.name}?\n\n${newValue ? 'User này sẽ được phép truy cập trang sổ lệnh (order_matching).' : 'User này sẽ không còn được phép truy cập trang sổ lệnh (order_matching).'}`;

        if (!confirm(confirmMessage)) {
            // User hủy, không làm gì cả
            return;
        }

        try {
            const payload = {
                is_market_maker: newValue,
            };

            // Nếu có permission record, gửi id
            if (user.id) {
                payload.id = user.id;
            } else if (user.user_id) {
                // Nếu chưa có permission record, gửi user_id để tạo mới
                payload.user_id = user.user_id;
                payload.permission_type = 'investor_user';
                payload.notes = '';
                payload.phone = user.phone || '';
            } else {
                this.showNotification('Không thể xác định user để cập nhật', 'danger');
                this.loadUsers();
                return;
            }

            const response = await fetch('/api/user-permission/toggle-market-maker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data && data.success) {
                const statusText = newValue ? 'bật' : 'tắt';
                this.showNotification(`Đã ${statusText} "Nhà tạo lập" cho ${user.name} thành công`, 'success');
                // Cập nhật giá trị trong state
                user.is_market_maker = newValue;
                // Reload để đảm bảo đồng bộ
                this.loadUsers();
            } else {
                this.showNotification(data?.error || 'Lỗi khi cập nhật nhà tạo lập', 'danger');
                // Reload để đảm bảo đồng bộ
                this.loadUsers();
            }
        } catch (error) {
            console.error('Error toggling market maker:', error);
            this.showNotification('Lỗi khi cập nhật nhà tạo lập', 'danger');
            // Reload để đảm bảo đồng bộ
            this.loadUsers();
        }
    }

    async deleteUser(user) {
        if (!confirm(`Bạn có chắc chắn muốn xóa user "${user.name}"?`)) {
            return;
        }

        try {
            const response = await fetch('/api/user-permission/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: user.id }),
            });
            const data = await response.json();

            if (data && data.success) {
                this.showNotification('Xóa user thành công', 'success');
                this.loadUsers();
            } else {
                this.showNotification(data?.error || 'Lỗi khi xóa', 'danger');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Lỗi khi xóa user', 'danger');
        }
    }

    getPermissionTypeLabel(type) {
        const labels = {
            'system_admin': 'System Admin',
            'investor_user': 'Investor User',
            'fund_operator': 'Fund Operator',
        };
        return labels[type] || type;
    }

    getPermissionTypeBadgeClass(type) {
        const classes = {
            'system_admin': 'bg-danger',
            'investor_user': 'bg-warning',
            'fund_operator': 'bg-info',
        };
        return classes[type] || 'bg-secondary';
    }

    showNotification(message, type = 'info') {
        // Tạo notification container nếu chưa có
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        // Tạo notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.textContent = '×';
        closeButton.onclick = () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        };

        notification.appendChild(messageSpan);
        notification.appendChild(closeButton);
        container.appendChild(notification);

        // Tự động xóa sau 5 giây
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    static template = xml`
        <div class="user-permission-page">
            <!-- Page Header -->
            <div class="page-header">
                <div class="header-content">
                    <div>
                        <nav aria-label="breadcrumb" class="breadcrumb-nav">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item">
                                    <a href="/fund-management-dashboard" class="breadcrumb-link">
                                        <i class="fas fa-home me-1"></i>Dashboard
                                    </a>
                                </li>
                                <li class="breadcrumb-item active" aria-current="page" t-esc="state.breadcrumbTitle"/>
                            </ol>
                        </nav>
                        <h1 class="page-title" t-esc="state.pageTitle"/>
                        <p class="page-subtitle">Quản lý và phân quyền người dùng trong hệ thống</p>
                    </div>
                    <button type="button" class="btn-create" t-on-click="openCreateModal">
                        <i class="fas fa-plus me-2"></i>
                        <span>Tạo mới</span>
                    </button>
                </div>
            </div>

            <!-- Search and Filter Section -->
            <div class="search-section">
                <div class="search-card">
                    <div class="search-content">
                        <div class="search-input-wrapper">
                            <i class="fas fa-search search-icon"></i>
                            <input 
                                type="text" 
                                class="search-input" 
                                t-model="state.searchTerm" 
                                t-on-input="onSearchInput" 
                                placeholder="Tìm kiếm theo tên, email..."/>
                        </div>
                        <div class="search-actions">
                            <span class="result-count" t-esc="'Tổng: ' + state.total + ' kết quả'"/>
                            <button type="button" class="btn-search" t-on-click="onSearchClick">
                                <i class="fas fa-search me-1"></i>Tìm kiếm
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Users Table Section -->
            <div class="table-section">
                <div class="table-card">
                    <t t-if="state.loading">
                        <div class="loading-container">
                            <div class="spinner-wrapper">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="loading-text">Đang tải dữ liệu...</p>
                            </div>
                        </div>
                    </t>
                    <t t-if="!state.loading">
                        <div class="table-wrapper">
                            <table class="users-table">
                                <thead>
                                    <tr>
                                        <th>Tên người dùng</th>
                                        <th>Email</th>
                                        <th>Điện thoại</th>
                                        <t t-if="state.permissionType === 'investor_user'">
                                            <th class="text-center">Nhà tạo lập</th>
                                        </t>
                                        <th class="text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <t t-if="state.users.length === 0">
                                        <tr>
                                            <td t-attf-colspan="#{state.permissionType === 'investor_user' ? '5' : '4'}" class="empty-state">
                                                <div class="empty-content">
                                                    <i class="fas fa-users empty-icon"></i>
                                                    <p class="empty-text">Không có dữ liệu</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </t>
                                    <t t-foreach="state.users" t-as="user" t-key="user.user_id">
                                        <tr class="table-row">
                                            <td>
                                                <div class="user-info">
                                                    <div class="user-avatar">
                                                        <i class="fas fa-user"></i>
                                                    </div>
                                                    <span class="user-name" t-esc="user.name"/>
                                                </div>
                                            </td>
                                            <td>
                                                <span class="email-text" t-esc="user.email"/>
                                            </td>
                                            <td>
                                                <span t-esc="user.phone || '-'"/>
                                            </td>
                                            <t t-if="state.permissionType === 'investor_user'">
                                                <td class="text-center">
                                                    <div 
                                                        t-att-class="'toggle-button' + ((user.is_market_maker || false) ? ' active' : '') + ((!user.has_permission &amp;&amp; !user.user_id) ? ' disabled' : '')"
                                                        t-on-click="() => this.toggleMarketMakerButton(user)"
                                                        t-att-title="(user.is_market_maker || false) ? 'Nhà tạo lập (Bật)' : 'Nhà đầu tư (Tắt)'">
                                                        <span class="toggle-button-slider"></span>
                                                    </div>
                                            </td>
                                            </t>
                                            <td class="text-center">
                                                <button 
                                                    type="button" 
                                                    class="btn-action" 
                                                    t-on-click="() => this.openEditModal(user)" 
                                                    title="Chỉnh sửa">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    </t>
                                </tbody>
                            </table>
                        </div>
                        <div class="pagination-wrapper">
                            <div class="pagination-info">
                                <span t-esc="'Hiển thị ' + ((state.currentPage - 1) * state.pageSize + 1) + ' - ' + Math.min(state.currentPage * state.pageSize, state.total) + ' của ' + state.total + ' kết quả'"/>
                            </div>
                            <div class="pagination-controls">
                                <button 
                                    type="button" 
                                    class="btn-pagination" 
                                    t-on-click="onPrevPage" 
                                    t-att-disabled="state.currentPage === 1">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <span class="page-number" t-esc="state.currentPage"/>
                                <button 
                                    type="button" 
                                    class="btn-pagination" 
                                    t-on-click="onNextPage" 
                                    t-att-disabled="state.currentPage * state.pageSize >= state.total">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </t>
                </div>
            </div>

            <!-- Create/Edit Modal -->
            <t t-if="state.showModal">
                <div class="modal-overlay">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 class="modal-title">
                                <i t-attf-class="fas #{state.editingUser ? 'fa-user-edit' : 'fa-user-plus'} me-2"></i>
                                <t t-esc="state.editingUser ? 'Chỉnh sửa tài khoản' : 'Tạo mới tài khoản'"/>
                            </h3>
                            <button type="button" class="modal-close" t-on-click="closeModal">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="form-grid">
                                <t t-if="!state.editingUser">
                                    <!-- Khi tạo mới: Form tạo user mới -->
                                    <div class="form-group full-width">
                                        <label class="form-label">
                                            <i class="fas fa-user me-1"></i>Tên người dùng <span class="required">*</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            class="form-input" 
                                            t-model="state.formData.name" 
                                            t-att-class="state.formErrors.name ? 'is-invalid' : ''"
                                            placeholder="Nhập tên đầy đủ"/>
                                        <t t-if="state.formErrors.name">
                                            <div class="error-message" t-esc="state.formErrors.name"/>
                                        </t>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">
                                            <i class="fas fa-envelope me-1"></i>Email <span class="required">*</span>
                                        </label>
                                        <input 
                                            type="email" 
                                            class="form-input" 
                                            t-model="state.formData.email" 
                                            t-att-class="state.formErrors.email ? 'is-invalid' : ''"
                                            placeholder="email@example.com"/>
                                        <t t-if="state.formErrors.email">
                                            <div class="error-message" t-esc="state.formErrors.email"/>
                                        </t>
                                        <small class="form-hint">Dùng để đăng nhập vào hệ thống</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">
                                            <i class="fas fa-lock me-1"></i>Mật khẩu <span class="required">*</span>
                                        </label>
                                        <input 
                                            type="password" 
                                            class="form-input" 
                                            t-model="state.formData.password" 
                                            t-att-class="state.formErrors.password ? 'is-invalid' : ''"
                                            placeholder="••••••••"/>
                                        <t t-if="state.formErrors.password">
                                            <div class="error-message" t-esc="state.formErrors.password"/>
                                        </t>
                                        <small class="form-hint">Ít nhất 6 ký tự</small>
                                    </div>
                                </t>
                                <t t-if="state.editingUser">
                                    <!-- Khi chỉnh sửa: Hiển thị thông tin readonly -->
                                    <div class="form-group full-width">
                                        <label class="form-label">
                                            <i class="fas fa-user me-1"></i>Tên người dùng
                                        </label>
                                        <input 
                                            type="text" 
                                            class="form-input" 
                                            t-model="state.formData.name" 
                                            readonly="readonly"/>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">
                                            <i class="fas fa-envelope me-1"></i>Email
                                        </label>
                                        <input 
                                            type="email" 
                                            class="form-input" 
                                            t-model="state.formData.email" 
                                            readonly="readonly"/>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">
                                            <i class="fas fa-lock me-1"></i>Mật khẩu mới
                                        </label>
                                        <input 
                                            type="password" 
                                            class="form-input" 
                                            t-model="state.formData.password" 
                                            placeholder="••••••••"/>
                                        <small class="form-hint">Để trống nếu không muốn đổi</small>
                                    </div>
                                </t>
                                <div class="form-group">
                                    <label class="form-label">
                                        <i class="fas fa-phone me-1"></i>Điện thoại
                                    </label>
                                    <input 
                                        type="text" 
                                        class="form-input" 
                                        t-model="state.formData.phone" 
                                        placeholder="0123456789"/>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">
                                        <i class="fas fa-briefcase me-1"></i>Chức vụ
                                    </label>
                                    <input 
                                        type="text" 
                                        class="form-input" 
                                        t-model="state.formData.position" 
                                        t-att-class="state.formErrors.position ? 'is-invalid' : ''"
                                        placeholder="Nhập chức vụ"/>
                                    <t t-if="state.formErrors.position">
                                        <div class="error-message" t-esc="state.formErrors.position"/>
                                    </t>
                                </div>
                                <t t-if="state.formData.permission_type === 'investor_user'">
                                    <div class="form-group full-width">
                                        <label class="form-label toggle-button-label" t-on-click="() => this.toggleFormMarketMaker()">
                                            <div 
                                                class="toggle-button"
                                                t-att-class="state.formData.is_market_maker ? 'active' : ''">
                                                <span class="toggle-button-slider"></span>
                                            </div>
                                            <span>
                                                <i class="fas fa-user-shield me-1"></i>Nhà tạo lập (Market Maker)
                                            </span>
                                        </label>
                                        <small class="form-hint">Truy cập trang sổ lệnh (order_matching)</small>
                                    </div>
                                </t>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" t-on-click="closeModal">
                                <i class="fas fa-times me-1"></i>Hủy
                            </button>
                            <button type="button" class="btn-save" t-on-click="saveUser">
                                <i class="fas fa-save me-1"></i>Lưu
                            </button>
                        </div>
                    </div>
                </div>
            </t>
        </div>
    `;
}

