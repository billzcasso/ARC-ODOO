/** @odoo-module **/
// bank_branch_widget.js cho bank_branch
console.log("Loading BankBranchWidget...");

const { Component, xml, useState, onMounted } = window.owl;

class BankBranchWidget extends Component {
    static template = xml`
    <div class="fund-management-widget slide-in-bottom">
        <!-- Header Section -->
        <div class="page-header d-flex flex-wrap justify-content-between align-items-center gap-3">
             <div>
                <h1 class="h3 mb-1">Danh mục Chi nhánh Ngân hàng</h1>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="#"><i class="fas fa-home me-1"></i>Trang chủ</a></li>
                        <li class="breadcrumb-item active" aria-current="page">Danh mục Chi nhánh Ngân hàng</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex align-items-center gap-2">
                 <button t-on-click="syncBasic" t-att-disabled="state.syncing || state.syncingAll" class="btn btn-fmc-light d-flex align-items-center gap-2">
                    <i t-if="state.syncing" class="fas fa-spin fa-spinner text-primary"></i>
                    <i t-else="" class="fas fa-sync text-primary"></i>
                    <span t-if="state.syncing">Đang đồng bộ...</span>
                    <span t-else="">Đồng bộ cơ bản</span>
                </button>
                 <button t-on-click="syncNationwide" t-att-disabled="state.syncingAll || state.syncing" class="btn btn-fmc-light d-flex align-items-center gap-2">
                     <i t-if="state.syncingAll" class="fas fa-spin fa-spinner text-primary"></i>
                    <i t-else="" class="fas fa-globe text-primary"></i>
                    <span t-if="state.syncingAll">Đang đồng bộ...</span>
                    <span t-else="">Đồng bộ toàn quốc</span>
                </button>
                <button t-on-click="createNew" class="btn btn-fmc-primary d-flex align-items-center gap-2">
                    <i class="fas fa-plus"></i>
                    <span>Tạo mới</span>
                </button>
            </div>
        </div>

        <!-- Filter and Search Section -->
         <div class="card-fmc">
            <div class="card-body">
                <div class="row g-3 align-items-center">
                    <div class="col-lg-5 col-md-12">
                        <div class="position-relative">
                            <i class="fas fa-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                            <input type="text" 
                                placeholder="Tìm theo tên hoặc mã chi nhánh..."
                                class="form-control fmc-search-input ps-5"
                                t-on-keyup="onSearchKeyup"
                                t-model="state.searchTerm"
                            />
                        </div>
                    </div>
                     <div class="col-lg-7 col-md-12 text-end">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                             <span class="text-muted small">
                                Tổng <strong class="text-primary" t-esc="state.totalRecords"/> kết quả
                            </span>
                             <button t-on-click="performSearch" class="btn btn-light border fw-semibold">
                                <i class="fas fa-sync-alt me-1"></i> Tìm kiếm
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
                                <th>Tên chi nhánh</th>
                                <th>Ngân hàng</th>
                                <th>Mã chi nhánh</th>
                                <th>Địa chỉ</th>
                                <th class="text-center">Trạng thái</th>
                                <th class="text-center" style="width: 120px;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            <t t-if="state.loading">
                                <tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Đang tải dữ liệu...</p></td></tr>
                            </t>
                            <t t-if="!state.loading and state.bank_branches.length === 0">
                                <tr>
                                    <td colspan="6" class="text-center py-5">
                                        <div class="d-flex flex-column align-items-center">
                                             <div class="bg-light rounded-circle p-4 mb-3">
                                                 <i class="fas fa-code-branch fa-3x text-secondary opacity-50"></i>
                                            </div>
                                            <h5 class="text-dark fw-bold">Chưa có dữ liệu</h5>
                                            <p class="text-muted mb-3">Không tìm thấy chi nhánh nào.</p>
                                            <button class="btn btn-fmc-primary" t-on-click="createNew">
                                                <i class="fas fa-plus me-2"></i>Tạo mới ngay
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </t>
                            <t t-foreach="state.bank_branches" t-as="branch" t-key="branch.id">
                                <tr>
                                    <td>
                                        <div class="fw-bold text-dark" t-esc="branch.name"/>
                                    </td>
                                    <td>
                                        <span class="text-muted" t-esc="branch.bank_name"/>
                                    </td>
                                    <td>
                                        <span class="badge bg-light text-dark border fw-bold" t-esc="branch.code"/>
                                    </td>
                                    <td>
                                        <span class="text-truncate d-block" style="max-width: 200px;" t-att-title="branch.address" t-esc="branch.address"/>
                                    </td>
                                    <td class="text-center">
                                        <span t-if="branch.active" class="badge-fmc badge-success">Kích hoạt</span>
                                        <span t-else="" class="badge-fmc badge-danger">Không kích hoạt</span>
                                    </td>
                                    <td class="text-center">
                                         <div class="d-flex justify-content-center gap-2">
                                            <button t-on-click.prevent="() => this.handleEdit(branch.id)" class="btn btn-sm btn-light border" title="Chỉnh sửa">
                                                <i class="fas fa-edit text-primary"></i>
                                            </button>
                                            <button t-on-click.prevent="() => this.handleDelete(branch.id)" class="btn btn-sm btn-light border" title="Xóa">
                                                <i class="fas fa-trash text-danger"></i>
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
            <div t-if="totalPages > 1" class="card-footer d-flex justify-content-end bg-white border-top-0 py-3">
                 <nav aria-label="Page navigation">
                    <ul class="pagination mb-0">
                         <li t-attf-class="page-item #{state.currentPage === 1 ? 'disabled' : ''}">
                            <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage - 1)">
                                <i class="fas fa-chevron-left"></i>
                            </a>
                        </li>
                        <t t-foreach="visiblePages" t-as="page" t-key="page_index">
                             <li t-attf-class="page-item #{page === state.currentPage ? 'active' : ''} #{page === '...' ? 'disabled' : ''}">
                                <a class="page-link shadow-none" href="#" t-on-click.prevent="() => page !== '...' &amp;&amp; this.changePage(page)" t-esc="page"/>
                            </li>
                        </t>
                         <li t-attf-class="page-item #{state.currentPage === totalPages ? 'disabled' : ''}">
                            <a class="page-link shadow-none" href="#" t-on-click.prevent="() => this.changePage(state.currentPage + 1)">
                                <i class="fas fa-chevron-right"></i>
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    </div>
    `;
    setup() {
        this.state = useState({
            bank_branches: [],
            searchTerm: "",
            loading: true,
            currentPage: 1,
            totalRecords: 0,
            limit: 10,
            syncing: false,
            syncingAll: false
        });
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
        const url = `/get_bank_branch_data?page=${this.state.currentPage}&limit=${this.state.limit}&search=${encodeURIComponent(this.state.searchTerm.trim())}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Tải dữ liệu thất bại");
            const data = await res.json();
            this.state.bank_branches = data.records;
            this.state.totalRecords = data.total_records;
        } catch (e) { console.error(e); } finally { this.state.loading = false; }
    }
    changePage(page) { if (page > 0 && page <= this.totalPages) { this.state.currentPage = page; this.loadData(); } }
    onSearchKeyup(ev) { if (ev.key === 'Enter') this.performSearch(); }
    performSearch() { this.state.currentPage = 1; this.loadData(); }
    handleEdit(id) { window.location.href = `/bank_branch/edit/${id}`; }
    createNew() { window.location.href = '/bank_branch/new'; }
    async syncBasic() {
        this.state.syncing = true;
        try {
            const res = await fetch('/bank_branch/sync/basic', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                window.alert(err.error || `HTTP ${res.status}`);
                return;
            }
            const result = await res.json();
            if (!result.success) {
                window.alert(result.error || 'Đồng bộ thất bại.');
                return;
            }
            window.alert(`Đã đồng bộ chi nhánh cơ bản. Thêm mới: ${result.created || 0}, cập nhật: ${result.updated || 0}.`);
            this.state.currentPage = 1;
            await this.loadData();
        } catch (e) {
            console.error('Sync branch error:', e);
            window.alert('Có lỗi xảy ra khi đồng bộ chi nhánh.');
        } finally {
            this.state.syncing = false;
        }
    }

    async syncNationwide() {
        this.state.syncingAll = true;
        try {
            const res = await fetch('/bank_branch/sync/nationwide', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                window.alert(err.error || `HTTP ${res.status}`);
                return;
            }
            const result = await res.json();
            if (!result.success) {
                window.alert(result.error || 'Đồng bộ thất bại.');
                return;
            }
            window.alert(`Đã đồng bộ chi nhánh toàn quốc. Thêm mới: ${result.created || 0}, cập nhật: ${result.updated || 0}.`);
            this.state.currentPage = 1;
            await this.loadData();
        } catch (e) {
            console.error('Sync nationwide error:', e);
            window.alert('Có lỗi xảy ra khi đồng bộ chi nhánh toàn quốc.');
        } finally {
            this.state.syncingAll = false;
        }
    }
}
window.BankBranchWidget = BankBranchWidget;
export default BankBranchWidget; 
