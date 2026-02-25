/** @odoo-module */

import { Component, xml, useState, onMounted, useRef, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";


export class FundCertificateWidget extends Component {
    static template = xml`
    <div class="fund-certificate-container slide-in-bottom">
        <!-- Header Section -->
        <div class="page-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
                <h1 class="h3 mb-1">Chứng chỉ quỹ</h1>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="#"><i class="fas fa-home me-1"></i>Trang chủ</a></li>
                        <li class="breadcrumb-item active" aria-current="page">Danh mục Quỹ</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex gap-2">

                <button t-on-click="createNewFund" class="btn btn-fmc-primary d-flex align-items-center gap-2">
                    <i class="fas fa-plus"></i>
                    <span>Tạo Chứng chỉ quỹ</span>
                </button>
            </div>
        </div>

        <!-- Filter and Search Section -->
        <div class="card-fmc">
            <div class="card-body">
                <div class="row g-3 align-items-center">
                    <!-- Search Input -->
                    <div class="col-lg-4 col-md-6">
                        <div class="position-relative">
                            <i class="fas fa-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                            <input type="text" 
                                placeholder="Tìm kiếm quỹ..."
                                class="form-control fmc-search-input ps-5"
                                t-ref="searchInput"
                                t-on-input="onSearchInput"
                                t-model="state.searchTerm"
                            />
                        </div>
                    </div>
                    <!-- Filter by Status -->
                    <div class="col-lg-2 col-md-3 col-sm-6">
                        <select class="form-select" t-model="state.filter.status" t-on-change="performSearch">
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Đang hoạt động</option>
                            <option value="inactive">Ngừng hoạt động</option>
                        </select>
                    </div>
                    <!-- Filter by Type -->
                    <div class="col-lg-2 col-md-3 col-sm-6">
                        <select class="form-select" t-model="state.filter.type" t-on-change="performSearch">
                            <option value="">Tất cả loại quỹ</option>
                            <option value="stock">Quỹ Cổ phiếu</option>
                            <option value="bond">Quỹ Trái phiếu</option>
                        </select>
                    </div>
                    <!-- Actions -->
                    <div class="col-lg-4 col-md-12 text-end">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button t-on-click="performSearch" class="btn btn-light border fw-semibold">
                                <i class="fas fa-sync-alt me-1"></i>
                            </button>
                            <div class="dropdown" t-if="state.selectedIds.size > 0">
                                <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-cog me-1"></i> Đã chọn (<t t-esc="state.selectedIds.size"></t>)
                                </button>
                                <ul class="dropdown-menu shadow">
                                    <li><a class="dropdown-item" href="#" t-on-click="() => handleBulkAction('approve')"><i class="fas fa-check text-success me-2"></i>Duyệt nhanh</a></li>
                                    <li><a class="dropdown-item" href="#" t-on-click="() => handleBulkAction('deactivate')"><i class="fas fa-ban text-warning me-2"></i>Ngừng hoạt động</a></li>
                                    <li><hr class="dropdown-divider"/></li>
                                    <li><a class="dropdown-item text-danger" href="#" t-on-click="() => handleBulkAction('delete')"><i class="fas fa-trash me-2"></i>Xóa</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Data Table Section -->
        <div class="card-fmc">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-fmc table-hover align-middle">
                        <thead>
                            <tr>
                                <th style="width: 40px;" class="text-center">
                                    <input class="form-check-input" type="checkbox" t-on-change="toggleSelectAll"/>
                                </th>
                                <th style="width: 250px;">Tên Quỹ</th>
                                <th class="text-center">Mã CK</th>
                                <th class="text-center">Màu</th>
                                <th class="text-center">Giá hiện tại (VND)</th>
                                <th class="text-center">Phân loại</th>
                                <th class="text-center">Trạng thái</th>
                                <th class="text-center" style="width: 120px;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            <t t-if="state.loading">
                                <tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Đang tải dữ liệu...</p></td></tr>
                            </t>
                            <t t-if="!state.loading and state.certificates.length === 0">
                                <tr>
                                    <td colspan="8" class="text-center py-5">
                                        <div class="d-flex flex-column align-items-center">
                                            <div class="bg-light rounded-circle p-4 mb-3">
                                                <i class="fas fa-chart-pie fa-3x text-secondary opacity-50"></i>
                                            </div>
                                            <h5 class="text-dark fw-bold">Chưa có dữ liệu</h5>
                                            <p class="text-muted mb-3">Chưa có chứng chỉ quỹ nào được tạo.</p>
                                            <button class="btn btn-fmc-primary" t-on-click="createNewFund">
                                                <i class="fas fa-plus me-2"></i>Tạo mới ngay
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </t>
                            <t t-foreach="state.certificates" t-as="cert" t-key="cert.id">
                                <tr t-att-class="state.selectedIds.has(cert.id) ? 'active' : ''">
                                    <td class="text-center">
                                        <input class="form-check-input" type="checkbox" t-att-checked="state.selectedIds.has(cert.id)" t-on-change="() => toggleSelection(cert.id)"/>
                                    </td>
                                    <td>
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="fund-icon flex-shrink-0" t-attf-style="#{cert.fund_image ? '' : 'background-color:' + this.getFundColor(cert.symbol) + '20; color:' + this.getFundColor(cert.symbol)}">
                                                <t t-if="cert.fund_image">
                                                    <img t-att-src="cert.fund_image" alt="Logo"/>
                                                </t>
                                                <t t-else="">
                                                    <i class="fas fa-coins"></i>
                                                </t>
                                            </div>
                                            <div>
                                                <div class="fw-bold text-dark" t-esc="cert.short_name_vn or cert.symbol"></div>
                                                <small class="text-muted" t-esc="cert.short_name_en"></small>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge bg-light text-dark border fw-bold" t-esc="cert.symbol"></span>
                                    </td>
                                    <td class="text-center">
                                        <div class="rounded-circle border mx-auto" t-attf-style="width: 24px; height: 24px; background-color: #{this.getFundColor(cert.symbol)};" title="Màu đại diện"></div>
                                    </td>
                                    <td class="text-center">
                                        <div class="fw-bold text-success" t-esc="formatCurrency(cert.current_price or cert.reference_price or 0)"></div>
                                        <small class="text-muted" t-if="!cert.current_price and !cert.reference_price">Chưa cập nhật</small>
                                    </td>
                                    <td class="text-center"><span class="text-secondary" t-esc="cert.product_type"></span></td>
                                    <td class="text-center">
                                        <span t-if="cert.product_status === 'Đang hoạt động'" class="badge bg-success-subtle text-success px-2 py-1">
                                            <i class="fas fa-check-circle me-1" style="font-size: 0.8em;"></i>Active
                                        </span>
                                        <span t-else="" class="badge bg-danger-subtle text-danger px-2 py-1">
                                            <i class="fas fa-times-circle me-1" style="font-size: 0.8em;"></i>Inactive
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <div class="btn-group">
                                            <button t-on-click="() => this.handleEdit(cert.id)" class="btn btn-sm btn-light border text-secondary" title="Chỉnh sửa">
                                                <i class="fas fa-pen"></i>
                                            </button>
                                            <button t-on-click="() => this.confirmDelete(cert.id, cert.short_name_vn or cert.symbol)" class="btn btn-sm btn-light border text-danger" title="Xóa">
                                                <i class="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </t>
                        </tbody>
                    </table>
                </div>
            </div>

                <!-- Mobile Cards -->
                <div class="d-lg-none mt-3">
                    <t t-if="state.loading">
                        <div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Đang tải...</p></div>
                    </t>
                    <t t-if="!state.loading and state.certificates.length === 0">
                        <div class="text-center py-5 px-3">
                            <div class="mb-4">
                                <i class="fas fa-file-signature fa-4x text-muted opacity-50"></i>
                            </div>
                            <h5 class="text-muted mb-3">Chưa có chứng chỉ quỹ nào</h5>
                            <p class="text-muted mb-4">Bắt đầu bằng cách tạo chứng chỉ quỹ đầu tiên của bạn.</p>
                            <button class="btn btn-fmc-primary" t-on-click="createNewFund">
                                <i class="fas fa-plus me-2"></i>Tạo chứng chỉ quỹ
                            </button>
                        </div>
                    </t>
                    <t t-foreach="state.certificates" t-as="cert" t-key="cert.id">
                        <div class="card-fmc mb-3" t-att-class="state.selectedIds.has(cert.id) ? 'border-primary' : ''">
                             <div class="card-body p-3">
                                <div class="d-flex gap-3">
                                    <div class="form-check pt-1">
                                        <input class="form-check-input" type="checkbox" t-att-checked="state.selectedIds.has(cert.id)" t-on-change="() => toggleSelection(cert.id)"/>
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                <h6 class="fw-bold mb-0 text-dark" t-esc="cert.short_name_vn or cert.symbol"></h6>
                                                <small class="text-muted" t-esc="cert.symbol"></small>
                                            </div>
                                            <span t-if="cert.product_status === 'Đang hoạt động'" class="badge-fmc badge-success">Active</span>
                                            <span t-else="" class="badge-fmc badge-danger">Inactive</span>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-end mt-3">
                                            <div>
                                                <div class="small text-muted mb-1">Giá hiện tại</div>
                                                <div class="fw-bold text-success fs-5" t-esc="formatCurrency(cert.current_price or cert.reference_price or 0)"></div>
                                            </div>
                                            <div class="btn-group">
                                                <button t-on-click="() => this.handleEdit(cert.id)" class="btn btn-sm btn-light border">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button t-on-click="() => this.confirmDelete(cert.id, cert.short_name_vn or cert.symbol)" class="btn btn-sm btn-light border text-danger">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </t>
                </div>
            
            <!-- Pagination Controls -->
            <t t-if="totalPages > 1">
                <div class="card-footer border-0 pt-3">
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-muted small">Hiển thị</span>
                            <select class="form-select form-select-sm" style="width: 70px;" t-model="state.limit" t-on-change="() => { state.currentPage = 1; loadFundData(); }">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                             <span class="text-muted small">mỗi trang</span>
                        </div>
                        <nav aria-label="Page navigation">
                            <ul class="pagination pagination-sm mb-0">
                                <li t-attf-class="page-item #{state.currentPage === 1 ? 'disabled' : ''}">
                                    <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage - 1)">«</a>
                                </li>
                                <t t-foreach="visiblePages" t-as="page" t-key="page_index">
                                    <li t-attf-class="page-item #{page === state.currentPage ? 'active' : ''} #{page === '...' ? 'disabled' : ''}">
                                        <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.onPageClick(page)" t-esc="page"/>
                                    </li>
                                </t>
                                <li t-attf-class="page-item #{state.currentPage === totalPages ? 'disabled' : ''}">
                                    <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage + 1)">»</a>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </t>
        </div>



        <!-- Delete Confirmation Modal -->
        <div class="modal fade" id="deleteConfirmModal" tabindex="-1" aria-labelledby="deleteConfirmModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title text-danger" id="deleteConfirmModalLabel">
                            <i class="fas fa-exclamation-triangle me-2"></i>Xác nhận xóa
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body pt-2">
                        <div class="alert alert-danger d-flex align-items-center" role="alert">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            <div>
                                <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác!
                            </div>
                        </div>
                        <p class="mb-3">Bạn có chắc chắn muốn xóa chứng chỉ quỹ:</p>
                        <div class="bg-light p-3 rounded">
                            <strong t-esc="state.deleteTarget.name"></strong>
                        </div>
                        <p class="mt-3 text-muted small">Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn.</p>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-1"></i>Hủy
                        </button>
                        <button type="button" class="btn btn-danger" t-on-click="handleDelete">
                            <i class="fas fa-trash me-1"></i>Xác nhận xóa
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast Notification -->
        <div class="position-fixed top-0 end-0 p-3" style="z-index: 1100">
            <div id="deleteToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas fa-check-circle text-success me-2"></i>
                    <strong class="me-auto">Thông báo</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body" t-esc="state.toastMessage">
                </div>
            </div>
        </div>
    </div>
    `;

    setup() {
        this.state = useState({
            certificates: [],
            searchTerm: "",
            filter: {
                status: "",
                type: ""
            },
            loading: true,
            currentPage: 1,
            totalRecords: 0,
            limit: 10,
            selectedIds: new Set(),
            deleteTarget: {
                id: null,
                name: ''
            },
            toastMessage: '',
            // Sync Config

        });

        this.searchTimeout = null;
        this._refreshInterval = null;  // Auto-refresh interval

        // Bus service for realtime updates
        try {
            this.bus = useService?.('bus_service');
        } catch (e) {
            this.bus = null;
        }

        onMounted(() => {
            this.loadFundData();

            // Realtime updates via Bus
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
                            // console.log('[FundCertificate] ⚡ Realtime Update Received, refreshing...');
                            this._smartRefresh();
                        }
                    });
                    console.log('[FundCertificate] Bus listener attached');
                } else {
                    // Fallback: poll every 10s
                    console.log('[FundCertificate] Bus not available, using polling (10s)');
                    this._refreshInterval = setInterval(() => {
                        this._smartRefresh();
                    }, 10000);
                }
            } catch (e) {
                console.warn('[FundCertificate] Bus init failed, fallback to polling', e);
                this._refreshInterval = setInterval(() => {
                    this._smartRefresh();
                }, 10000);
            }
        });

        onWillUnmount(() => {
            // Clean up interval
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
                this._refreshInterval = null;
            }
        });
    }

    /**
     * Smart refresh - update data without losing selection or showing loading
     */
    async _smartRefresh() {
        try {
            const params = new URLSearchParams({
                page: this.state.currentPage,
                limit: this.state.limit,
                search: this.state.searchTerm.trim(),
                status: this.state.filter.status,
                type: this.state.filter.type,
            });

            const response = await fetch(`/get_fund_certificate_data?${params.toString()}`);
            if (!response.ok) return;

            const result = await response.json();
            if (result.error) return;

            // Only update if data changed (compare by checking prices)
            const newCerts = result.records || [];
            let changedCount = 0;

            for (const newCert of newCerts) {
                const existing = this.state.certificates.find(c => c.id === newCert.id);
                if (existing) {
                    const oldPrice = existing.current_price || existing.reference_price || 0;
                    const newPrice = newCert.current_price || newCert.reference_price || 0;
                    if (Math.abs(newPrice - oldPrice) > 0.001) {
                        changedCount++;
                    }
                }
            }

            // Update data without affecting selection
            this.state.certificates = newCerts;
            this.state.totalRecords = result.total_records || 0;

            if (changedCount > 0) {
                console.log(`[FundCertificate] Smart refresh: ${changedCount} price changes`);
            }
        } catch (error) {
            console.error('[FundCertificate] Smart refresh error:', error);
        }
    }



    get totalPages() {
        return Math.ceil(this.state.totalRecords / this.state.limit);
    }

    get visiblePages() {
        const current = this.state.currentPage;
        const total = this.totalPages;
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    }

    async loadFundData() {
        this.state.loading = true;
        this.state.selectedIds.clear(); // Clear selection on data load
        const params = new URLSearchParams({
            page: this.state.currentPage,
            limit: this.state.limit,
            search: this.state.searchTerm.trim(),
            status: this.state.filter.status,
            type: this.state.filter.type,
        });

        try {
            const response = await fetch(`/get_fund_certificate_data?${params.toString()}`);
            if (!response.ok) throw new Error(`Network response was not ok`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);

            this.state.certificates = result.records || [];
            this.state.totalRecords = result.total_records || 0;
        } catch (error) {
            console.error("Error fetching fund certificates:", error);
            this.state.certificates = [];
            this.state.totalRecords = 0;
        } finally {
            this.state.loading = false;
        }
    }

    onPageClick(page) { if (page !== '...') this.changePage(page); }

    changePage(newPage) {
        if (newPage > 0 && newPage <= this.totalPages && newPage !== this.state.currentPage) {
            this.state.currentPage = newPage;
            this.loadFundData();
        }
    }

    onSearchInput() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
        }, 300); // Debounce time: 300ms
    }

    performSearch() {
        this.state.currentPage = 1;
        this.loadFundData();
    }

    toggleSelection(certId) {
        if (this.state.selectedIds.has(certId)) {
            this.state.selectedIds.delete(certId);
        } else {
            this.state.selectedIds.add(certId);
        }
    }

    toggleSelectAll(ev) {
        const isChecked = ev.target.checked;
        this.state.selectedIds.clear();
        if (isChecked) {
            this.state.certificates.forEach(cert => this.state.selectedIds.add(cert.id));
        }
    }

    handleBulkAction(action) {
        const selectedCount = this.state.selectedIds.size;
        if (selectedCount === 0) {
            alert("Vui lòng chọn ít nhất một mục.");
            return;
        }

        const selectedIds = Array.from(this.state.selectedIds);
        if (confirm(`Bạn có chắc muốn ${action} ${selectedCount} mục đã chọn?`)) {
            console.log(`Performing action '${action}' on IDs:`, selectedIds);
        }
    }

    confirmDelete(certId, certName) {
        this.state.deleteTarget.id = certId;
        this.state.deleteTarget.name = certName;
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        modal.show();
    }

    async handleDelete() {
        if (!this.state.deleteTarget.id) return;
        const modalElement = document.getElementById('deleteConfirmModal');
        const modal = bootstrap.Modal.getInstance(modalElement);

        try {
            const response = await fetch('/fund_certificate/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    cert_id: this.state.deleteTarget.id
                })
            });

            if (modal) {
                modal.hide();
            }

            const result = await response.json().catch(() => null);
            if (response.ok && result && result.success) {
                this.state.toastMessage = result.message || `Đã xóa thành công "${this.state.deleteTarget.name}"`;
                this.showToast();
                await this.loadFundData();
            } else {
                const errorMessage = result ? result.error : `Lỗi từ máy chủ (HTTP ${response.status})`;
                console.error('Delete failed:', errorMessage);
                alert(`Lỗi khi xóa: ${errorMessage || 'Không thể kết nối hoặc phản hồi không hợp lệ.'}`);
            }

        } catch (error) {
            console.error('Error during delete operation:', error);
            if (modal && modal._isShown) {
                modal.hide();
            }
            alert(`Có lỗi ngoại lệ xảy ra khi xóa: ${error.message}`);
        } finally {
            this.state.deleteTarget.id = null;
            this.state.deleteTarget.name = '';
        }
    }

    showToast() {
        const toastElement = document.getElementById('deleteToast');
        if (toastElement) {
            const toast = new bootstrap.Toast(toastElement);
            toast.show();
        }
    }

    handleEdit(certId) {
        window.location.href = `/fund_certificate/edit/${certId}`;
    }

    createNewFund() {
        window.location.href = '/fund_certificate/new';
    }

    formatCurrency(value) {
        if (typeof value !== 'number') return value;
        return new Intl.NumberFormat('vi-VN', { style: 'decimal' }).format(value);
    }

    getFundColor(symbol) {
        if (!symbol) return '#4A90E2';

        // Palette of premium, distinct colors
        const colors = [
            '#2563EB', // Blue 600
            '#DB2777', // Pink 600
            '#059669', // Emerald 600
            '#D97706', // Amber 600
            '#7C3AED', // Violet 600
            '#DC2626', // Red 600
            '#0891B2', // Cyan 600
            '#4F46E5', // Indigo 600
            '#EA580C', // Orange 600
            '#65A30D', // Lime 600
            '#BE185D', // Rose 700
            '#0D9488', // Teal 600
        ];

        // Simple hash function to get consistent index
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        }

        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }
}

