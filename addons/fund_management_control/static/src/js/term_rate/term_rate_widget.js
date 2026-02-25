/** @odoo-module */

import { Component, xml, useState, onMounted, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class TermRateWidget extends Component {
    static template = xml`
    <div class="term-rate-container slide-in-bottom">
        <!-- Header Section -->
        <div class="page-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
                <h1 class="h3 mb-1">Kỳ hạn / Lãi suất</h1>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="#"><i class="fas fa-home me-1"></i>Trang chủ</a></li>
                        <li class="breadcrumb-item"><a href="#">Master Data</a></li>
                        <li class="breadcrumb-item active" aria-current="page">Kỳ hạn &amp; Lãi suất</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex gap-2">
                <button t-on-click="createNewRate" class="btn btn-fmc-primary d-flex align-items-center gap-2">
                    <i class="fas fa-plus"></i>
                    <span>Tạo Mới</span>
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
                                placeholder="Tìm kiếm kỳ hạn..."
                                class="form-control fmc-search-input ps-5"
                                t-model="state.searchTerm"
                                t-on-input="onSearchInput"
                            />
                        </div>
                    </div>
                    <!-- Actions -->
                    <div class="col-lg-8 col-md-6 text-end">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button t-on-click="performSearch" class="btn btn-light border fw-semibold" title="Làm mới">
                                <i class="fas fa-sync-alt"></i>
                            </button>
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
                                <th style="width: 150px;">Kỳ hạn (tháng)</th>
                                <th class="text-center">Lãi suất (%)</th>
                                <th class="text-center">Ngày hiệu lực</th>
                                <th class="text-center">Ngày kết thúc</th>
                                <th class="text-center">Trạng thái</th>
                                <th class="text-center" style="width: 100px;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            <t t-if="state.loading">
                                <tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Đang tải dữ liệu...</p></td></tr>
                            </t>
                            <t t-if="!state.loading and state.rates.length === 0">
                                <tr>
                                    <td colspan="6" class="text-center py-5">
                                        <div class="d-flex flex-column align-items-center">
                                            <div class="bg-light rounded-circle p-4 mb-3">
                                                <i class="fas fa-percentage fa-3x text-secondary opacity-50"></i>
                                            </div>
                                            <h5 class="text-dark fw-bold">Chưa có dữ liệu</h5>
                                            <p class="text-muted mb-3">Chưa có cấu hình lãi suất nào.</p>
                                        </div>
                                    </td>
                                </tr>
                            </t>
                            <t t-foreach="state.rates" t-as="rate" t-key="rate.id">
                                <tr>
                                    <td class="fw-bold text-primary" t-esc="rate.term_months + ' tháng'"></td>
                                    <td class="text-center fw-bold" t-esc="formatPercent(rate.interest_rate)"></td>
                                    <td class="text-center" t-esc="formatDate(rate.effective_date)"></td>
                                    <td class="text-center" t-esc="formatDate(rate.end_date) or '-'"></td>
                                    <td class="text-center">
                                        <span t-if="rate.active" class="badge bg-success-subtle text-success px-2 py-1">Active</span>
                                        <span t-else="" class="badge bg-secondary-subtle text-secondary px-2 py-1">Inactive</span>
                                    </td>
                                    <td class="text-center">
                                        <div class="btn-group">
                                            <!-- Simple Backend Form Edit for now -->
                                            <button t-on-click="() => this.handleEdit(rate.id)" class="btn btn-sm btn-light border text-secondary" title="Chỉnh sửa">
                                                <i class="fas fa-pen"></i>
                                            </button>
                                            <button t-on-click="() => this.confirmDelete(rate.id)" class="btn btn-sm btn-light border text-danger" title="Xóa">
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
             <!-- Pagination Controls -->
            <t t-if="totalPages > 1">
                <div class="card-footer border-0 pt-3">
                     <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div class="d-flex align-items-center gap-2">
                             <span class="text-muted small">Trang <t t-esc="state.currentPage"/> / <t t-esc="totalPages"/></span>
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
        <div class="modal fade" id="deleteRateModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title text-danger">Xác nhận xóa</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Bạn có chắc muốn xóa cấu hình này?</p>
                    </div>
                     <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
                        <button type="button" class="btn btn-danger" t-on-click="handleDelete">Xóa</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    setup() {
        this.state = useState({
            rates: [],
            searchTerm: "",
            loading: true,
            currentPage: 1,
            totalRecords: 0,
            limit: 10,
            deleteTargetId: null,
        });

        this.searchTimeout = null;

        onMounted(() => {
            this.loadData();
        });
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

    async loadData() {
        this.state.loading = true;
        const params = new URLSearchParams({
            page: this.state.currentPage,
            limit: this.state.limit,
            search: this.state.searchTerm.trim()
        });

        try {
            const response = await fetch(`/get_term_rate_data?${params.toString()}`);
            if (!response.ok) throw new Error('Network error');
            const result = await response.json();

            this.state.rates = result.records || [];
            this.state.totalRecords = result.total_records || 0;
        } catch (error) {
            console.error(error);
            this.state.rates = [];
        } finally {
            this.state.loading = false;
        }
    }

    onSearchInput() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.state.currentPage = 1;
            this.loadData();
        }, 300);
    }

    performSearch() {
        this.state.currentPage = 1;
        this.loadData();
    }

    onPageClick(page) { if (page !== '...') this.changePage(page); }

    changePage(newPage) {
        if (newPage > 0 && newPage <= this.totalPages) {
            this.state.currentPage = newPage;
            this.loadData();
        }
    }

    formatPercent(value) {
        return value ? value.toFixed(2) + '%' : '0.00%';
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN');
    }

    // Navigation to backend forms (Simplest way to support Create/Edit in Hybrid)
    // We can use the window.location or standard Odoo action calls if we had the Action ID.
    // For now, let's assume we can navigate to the form view by URL if we know the ID.
    // Odoo backend URLs usually look like /web#id=...&model=...&view_type=form
    // But since we are inside a "Website" controller context potentially, we should use a specific route if we want to stay "Custom".
    // However, the user didn't ask for a Custom Form, just "Standard OWL page" which usually implies the List.
    // I will try to redirect to the Odoo backend form for editing/creating to save time and complexity, 
    // OR create a simple route /term_rate/edit/<id> that renders a simple form template like FundCertificate.
    // Let's stick to the FundCertificate pattern: /term_rate/new and /term_rate/edit/<id>.

    createNewRate() {
        // Redirect to a controller route that renders the form
        window.location.href = '/term_rate/new';
    }

    handleEdit(id) {
        window.location.href = `/term_rate/edit/${id}`;
    }

    confirmDelete(id) {
        this.state.deleteTargetId = id;
        const modal = new bootstrap.Modal(document.getElementById('deleteRateModal'));
        modal.show();
    }

    async handleDelete() {
        if (!this.state.deleteTargetId) return;

        try {
            const response = await fetch('/term_rate/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: this.state.deleteTargetId })
            });
            const result = await response.json();

            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteRateModal'));
                modal.hide();
                this.loadData();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('Delete failed');
        }
    }
}
