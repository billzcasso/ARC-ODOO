/** @odoo-module **/
// bank_widget.js cho bank
console.log("Loading BankWidget...");

const { Component, xml, useState, onMounted } = window.owl;

class BankWidget extends Component {
    static template = xml`
    <div class="container-fluid p-0 slide-in-bottom">
        <!-- Search and Filter Section -->
        <div class="card-fmc mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                     <button t-on-click="createNew" class="btn btn-fmc-primary d-flex align-items-center gap-2">
                        <i class="fas fa-plus"></i>
                        <span>Tạo mới</span>
                    </button>
                    <button t-on-click="syncVietQR" t-att-disabled="state.syncing" class="btn btn-fmc-light d-flex align-items-center gap-2">
                        <i class="fas fa-sync text-primary" t-att-class="{'fa-spin': state.syncing}"></i>
                        <span t-if="state.syncing">Đang đồng bộ...</span>
                        <span t-else="">Đồng bộ VietQR</span>
                    </button>
                </div>
                <div class="row g-2 align-items-center">
                    <div class="col-lg-6 col-md-8">
                         <div class="position-relative">
                            <i class="fas fa-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                            <input type="text" placeholder="Tìm kiếm ngân hàng..." class="form-control fmc-search-input ps-5"
                                t-model="state.searchTerm"
                                t-on-keyup="onSearchKeyup"
                            />
                        </div>
                    </div>
                    <div class="col-lg-6 col-md-4 text-end">
                         <div class="d-flex align-items-center justify-content-end gap-2">
                            <span class="text-muted small">Tổng <strong class="text-primary" t-esc="state.totalRecords"/> bản ghi</span>
                            <button t-on-click="performSearch" class="btn btn-light border fw-semibold">
                                <i class="fas fa-sync-alt me-1"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bank Table Section -->
        <div class="card-fmc">
          <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-fmc table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Tên ngân hàng</th>
                            <th>Tiếng Anh</th>
                            <th>Viết tắt</th>
                            <th>Mã GD</th>
                            <th>Swift Code</th>
                            <th>Logo</th>
                            <th class="text-center">Trạng thái</th>
                            <th class="text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <t t-if="state.loading">
                            <tr>
                                <td colspan="8" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status"></div>
                                    <p class="mt-2 text-muted">Đang tải dữ liệu...</p>
                                </td>
                            </tr>
                        </t>
                        <t t-if="!state.loading and state.banks.length === 0">
                            <tr>
                                <td colspan="8" class="text-center py-5">
                                    <div class="d-flex flex-column align-items-center">
                                        <i class="fas fa-university fa-3x text-muted opacity-50 mb-3"></i>
                                        <h5 class="text-muted">Chưa có dữ liệu</h5>
                                        <p class="text-muted mb-0">Không tìm thấy ngân hàng nào.</p>
                                    </div>
                                </td>
                            </tr>
                        </t>
                        <t t-foreach="state.banks" t-as="bank" t-key="bank.id">
                            <tr>
                                <td><div class="fw-bold text-dark" t-esc="bank.name"/></td>
                                <td class="text-muted small" t-esc="bank.english_name"/>
                                <td><span class="badge bg-light text-dark border" t-esc="bank.short_name"/></td>
                                <td t-esc="bank.code"/>
                                <td t-esc="bank.swift_code"/>
                                <td>
                                    <t t-if="bank.website">
                                        <img t-att-src="bank.website" t-att-alt="bank.short_name || bank.name" style="height: 24px; object-fit: contain;"/>
                                    </t>
                                    <t t-else=""><span class="text-muted small">—</span></t>
                                </td>
                                <td class="text-center">
                                    <span t-if="bank.active" class="badge-fmc badge-success">Active</span>
                                    <span t-else="" class="badge-fmc badge-danger">Inactive</span>
                                </td>
                                <td class="text-center">
                                    <div class="btn-group">
                                        <a href="#" t-on-click.prevent="() => this.handleEdit(bank.id)" class="btn btn-sm btn-light border text-secondary">
                                            <i class="fas fa-pencil-alt"></i>
                                        </a>
                                        <a href="#" t-on-click.prevent="() => this.handleDelete(bank.id)" class="btn btn-sm btn-light border text-danger">
                                            <i class="fas fa-trash"></i>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        </t>
                    </tbody>
                </table>
            </div>
          </div>
          <!-- Pagination Controls -->
          <div t-if="totalPages > 1" class="card-footer border-0 pt-3">
            <nav aria-label="Page navigation" class="d-flex justify-content-end">
              <ul class="pagination pagination-sm mb-0">
                <li t-attf-class="page-item #{state.currentPage === 1 ? 'disabled' : ''}">
                  <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage - 1)">«</a>
                </li>
                <t t-foreach="visiblePages" t-as="page" t-key="page_index">
                    <li t-attf-class="page-item #{page === state.currentPage ? 'active' : ''} #{page === '...' ? 'disabled' : ''}">
                        <a class="page-link shadow-none" href="#" t-on-click.prevent="() => page !== '...' &amp;&amp; this.changePage(page)" t-esc="page"/>
                    </li>
                </t>
                <li t-attf-class="page-item #{state.currentPage === totalPages ? 'disabled' : ''}">
                  <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage + 1)">»</a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
    </div>
    `;
    setup() {
        this.state = useState({ banks: [], searchTerm: "", loading: true, currentPage: 1, totalRecords: 0, limit: 10, syncing: false });
        onMounted(() => this.loadData());
    }
    get totalPages() { return Math.ceil(this.state.totalRecords / this.state.limit); }

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
        const url = `/get_bank_data?page=${this.state.currentPage}&limit=${this.state.limit}&search=${encodeURIComponent(this.state.searchTerm.trim())}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Tải dữ liệu thất bại");
            const data = await res.json();
            this.state.banks = data.records;
            this.state.totalRecords = data.total_records;
        } catch (e) { console.error(e); } finally { this.state.loading = false; }
    }
    changePage(page) { if (page > 0 && page <= this.totalPages) { this.state.currentPage = page; this.loadData(); } }
    onSearchKeyup(ev) { if (ev.key === 'Enter') this.performSearch(); }
    performSearch() { this.state.currentPage = 1; this.loadData(); }
    handleEdit(id) { window.location.href = `/bank/edit/${id}`; }
    createNew() { window.location.href = '/bank/new'; }
    async syncVietQR() {
        this.state.syncing = true;
        try {
            const res = await fetch('/bank/sync/vietqr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const message = err.error || `HTTP ${res.status}`;
                window.alert(message);
                return;
            }
            const result = await res.json();
            if (!result.success) {
                window.alert(result.error || 'Đồng bộ thất bại.');
                return;
            }
            window.alert(`Đã đồng bộ VietQR. Thêm mới: ${result.created || 0}, cập nhật: ${result.updated || 0}.`);
            this.state.currentPage = 1;
            await this.loadData();
        } catch (error) {
            console.error('Sync VietQR error:', error);
            window.alert('Có lỗi xảy ra khi đồng bộ VietQR. Vui lòng thử lại.');
        } finally {
            this.state.syncing = false;
        }
    }
}
window.BankWidget = BankWidget;
export default BankWidget; 
