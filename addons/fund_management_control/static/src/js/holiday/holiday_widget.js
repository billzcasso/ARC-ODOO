/** @odoo-module **/
// holiday_widget.js cho holiday
console.log("Loading HolidayWidget...");

const { Component, xml, useState, onMounted } = window.owl;

class HolidayWidget extends Component {
    static template = xml`
    <div class="container-fluid p-0 slide-in-bottom">
        <!-- Search and Filter Section -->
        <div class="card-fmc mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <button t-on-click="createNew" class="btn btn-fmc-primary d-flex align-items-center gap-2">
                        <i class="fas fa-plus"></i>
                        <span>Tạo mới</span>
                    </button>
                    <div class="d-flex align-items-center gap-2">
                        <label class="form-label m-0 text-muted small">Năm</label>
                        <input type="number" min="1900" max="2100" class="form-control form-control-sm" style="width: 80px;"
                            t-model="state.syncYear"
                        />
                         <button t-on-click="syncFromApi" t-att-disabled="state.syncingApi" class="btn btn-fmc-light d-flex align-items-center gap-2">
                             <i t-if="state.syncingApi" class="fas fa-spinner fa-spin text-primary"></i>
                             <i t-else="" class="fas fa-cloud-download-alt text-primary"></i>
                             <span t-if="state.syncingApi">Đang đồng bộ...</span>
                             <span t-else="">API</span>
                        </button>

                    </div>
                </div>
                <div class="row g-2 align-items-center">
                     <div class="col-lg-6 col-md-8">
                         <div class="position-relative">
                            <i class="fas fa-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                            <input type="text" placeholder="Tìm kiếm ngày lễ..." class="form-control fmc-search-input ps-5"
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

        <!-- Holiday Table Section -->
        <div class="card-fmc">
          <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-fmc table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Tên ngày lễ</th>
                            <th>Mã ngày lễ</th>
                            <th>Ngày trong năm</th>
                            <th>Giá trị</th>
                            <th class="text-center">Trạng thái</th>
                            <th class="text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <t t-if="state.loading">
                            <tr>
                                <td colspan="6" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status"></div>
                                    <p class="mt-2 text-muted">Đang tải dữ liệu...</p>
                                </td>
                            </tr>
                        </t>
                        <t t-if="!state.loading and state.holidays.length === 0">
                            <tr>
                                <td colspan="6" class="text-center py-5">
                                     <div class="d-flex flex-column align-items-center">
                                        <i class="fas fa-calendar-times fa-3x text-muted opacity-50 mb-3"></i>
                                        <h5 class="text-muted">Chưa có dữ liệu</h5>
                                        <p class="text-muted mb-0">Không tìm thấy ngày lễ nào.</p>
                                    </div>
                                </td>
                            </tr>
                        </t>
                        <t t-foreach="state.holidays" t-as="holiday" t-key="holiday.id">
                            <tr>
                                <td><div class="fw-bold text-dark" t-esc="holiday.name"/></td>
                                <td class="text-muted small" t-esc="holiday.code"/>
                                <td><span class="badge bg-light text-dark border" t-esc="holiday.date"/></td>
                                <td><span class="badge bg-light text-primary border" t-esc="holiday.value"/></td>
                                <td class="text-center">
                                    <span t-if="holiday.active" class="badge-fmc badge-success">Active</span>
                                    <span t-else="" class="badge-fmc badge-danger">Inactive</span>
                                </td>
                                <td class="text-center">
                                    <div class="btn-group">
                                        <a href="#" t-on-click.prevent="() => this.handleEdit(holiday.id)" class="btn btn-sm btn-light border text-secondary">
                                            <i class="fas fa-pencil-alt"></i>
                                        </a>
                                        <a href="#" t-on-click.prevent="() => this.handleDelete(holiday.id)" class="btn btn-sm btn-light border text-danger">
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
    </div>
    `;

    setup() {
        this.state = useState({
            holidays: [],
            searchTerm: "",
            loading: true,
            currentPage: 1,
            totalRecords: 0,
            limit: 10,
            syncYear: String(new Date().getFullYear()),
            syncingApi: false,
        });

        onMounted(() => {
            console.log("HolidayWidget mounted, loading data...");
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
        console.log("Loading holiday data...");
        this.state.loading = true;
        const searchTerm = encodeURIComponent(this.state.searchTerm.trim());
        try {
            const url = `/get_holiday_data?page=${this.state.currentPage}&limit=${this.state.limit}&search=${searchTerm}`;
            console.log("Fetching from URL:", url);

            const response = await fetch(url);
            console.log("Response status:", response.status);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const result = await response.json();
            console.log("API Response:", result);

            if (result.error) {
                throw new Error(result.error);
            }

            this.state.holidays = result.records || [];
            this.state.totalRecords = result.total_records || 0;
            console.log("Loaded holidays:", this.state.holidays.length);

        } catch (error) {
            console.error("Error fetching holidays:", error);
            this.state.holidays = [];
            this.state.totalRecords = 0;
        } finally {
            this.state.loading = false;
            console.log("Loading finished, loading state:", this.state.loading);
        }
    }

    onPageClick(page) { if (page !== '...') this.changePage(page); }

    changePage(newPage) {
        if (newPage > 0 && newPage <= this.totalPages && newPage !== this.state.currentPage) {
            this.state.currentPage = newPage;
            this.loadData();
        }
    }

    onSearchKeyup(ev) {
        if (ev.key === 'Enter') {
            this.performSearch();
        }
    }

    performSearch() {
        this.state.currentPage = 1;
        this.loadData();
    }

    handleEdit(holidayId) {
        window.location.href = `/holiday/edit/${holidayId}`;
    }

    handleDelete(holidayId) {
        if (confirm('Bạn có chắc muốn xóa ngày lễ này?')) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/holiday/delete/${holidayId}`;
            document.body.appendChild(form);
            form.submit();
        }
    }

    createNew() {
        window.location.href = '/holiday/new';
    }

    async _sync(endpoint, stateKey, successLabel) {
        const year = parseInt(this.state.syncYear, 10);
        if (Number.isNaN(year)) {
            window.alert('Vui lòng nhập năm hợp lệ.');
            return;
        }
        this.state[stateKey] = true;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                const message = result.error || 'Không thể đồng bộ ngày lễ.';
                window.alert(message);
                return;
            }

            const created = result.created || 0;
            const updated = result.updated || 0;
            window.alert(`${successLabel} năm ${result.year}. Thêm mới: ${created}, cập nhật: ${updated}.`);
            this.state.currentPage = 1;
            await this.loadData();
        } catch (error) {
            console.error('Sync holiday error:', error);
            window.alert('Có lỗi xảy ra khi đồng bộ ngày lễ. Vui lòng thử lại.');
        } finally {
            this.state[stateKey] = false;
        }
    }

    async syncFromApi() {
        await this._sync('/holiday/sync', 'syncingApi', 'Đã đồng bộ ngày lễ từ API');
    }
}

window.HolidayWidget = HolidayWidget;
export default HolidayWidget;
console.log("HolidayWidget component loaded successfully."); 
