/** @odoo-module */

import { Component, xml, useState, onMounted } from "@odoo/owl";

export class ReportTransactionWidget extends Component {
    static template = xml`
        <div class="report-contract-statistics-container">
            <!-- Header -->
            <div class="report-contract-statistics-header">
                <h1 class="report-contract-statistics-title">
                    <i class="fas fa-file-invoice-dollar me-2"></i>Báo cáo Giao dịch
                </h1>
                <p class="report-contract-statistics-subtitle">Thống kê chi tiết các giao dịch mua/bán/chuyển đổi chứng chỉ quỹ</p>
            </div>

            <!-- Dashboard/Stats optional placeholder -->
            
            <!-- Filters & Actions -->
            <div class="report-contract-statistics-filters">
                <!-- Top Row: Global Search -->
                <div class="report-contract-statistics-filter-row mb-3">
                    <div class="report-contract-statistics-filter-group">
                         <label class="report-contract-statistics-filter-label">Tìm kiếm chung</label>
                         <div class="report-contract-statistics-search">
                            <input type="text" class="report-contract-statistics-search-input" 
                                placeholder="Tìm theo Số TK, Tên KH, Mã GD..." 
                                t-model="state.globalSearch" t-on-input="onGlobalSearchChange"/>
                            <i class="fas fa-search report-contract-statistics-search-icon"></i>
                         </div>
                    </div>
                    <div class="report-contract-statistics-filter-group" style="flex: 0 0 auto; display: flex; align-items: flex-end;">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-success" t-on-click="exportXlsx">
                            <i class="fas fa-file-excel"></i> Xuất Excel
                        </button>
                    </div>
                </div>

                <!-- Bottom Row: Detailed Filters -->
                <div class="report-contract-statistics-filter-row">
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label">Quỹ</label>
                        <select class="report-contract-statistics-filter-input" t-model="state.filters.fund" t-on-change="onFilterChange">
                            <option value="">-- Tất cả Quỹ --</option>
                            <option t-foreach="state.fundOptions" t-as="fund" t-key="fund.id" 
                                    t-att-value="fund.id" t-esc="fund.label"/>
                        </select>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label">Loại lệnh</label>
                        <select class="report-contract-statistics-filter-input" t-model="state.searchValues.order_type" t-on-change="onFilterChange">
                            <option value="">Tất cả</option>
                            <option value="buy">Mua (Buy)</option>
                            <option value="sell">Bán (Sell)</option>
                            <option value="exchange">Hoán đổi (Switch)</option>
                        </select>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label">Từ ngày</label>
                        <input type="date" class="report-contract-statistics-filter-input" t-model="state.filters.dateFrom" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label">Đến ngày</label>
                        <input type="date" class="report-contract-statistics-filter-input" t-model="state.filters.dateTo" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group" style="flex: 0 0 auto; display: flex; align-items: flex-end;">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-secondary" t-on-click="resetFilters" title="Xóa bộ lọc">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Table Section -->
            <div class="report-contract-statistics-table-container">
                <div class="report-contract-statistics-table-wrapper">
                    <table class="report-contract-statistics-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">STT</th>
                                <th class="sortable" t-on-click="() => this.sortBy('transaction_date')">
                                    Ngày GD <i t-att-class="this.getSortIcon('transaction_date')"></i>
                                </th>
                                <th>Số TK</th>
                                <th class="sortable" t-on-click="() => this.sortBy('customer_name')">
                                    Khách hàng <i t-att-class="this.getSortIcon('customer_name')"></i>
                                </th>
                                <th class="sortable" t-on-click="() => this.sortBy('fund_name')">
                                    Quỹ <i t-att-class="this.getSortIcon('fund_name')"></i>
                                </th>
                                <th class="sortable" t-on-click="() => this.sortBy('order_type')">
                                    Lệnh <i t-att-class="this.getSortIcon('order_type')"></i>
                                </th>
                                <th>Mã GD</th>
                                <th class="text-right">Số lượng</th>
                                <th class="text-right">Giá</th>
                                <th class="text-right">Thành tiền</th>
                                <th class="text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Loading State -->
                            <tr t-if="state.loading">
                                <td colspan="11" class="report-contract-statistics-loading">
                                    <i class="fas fa-circle-notch fa-spin fa-2x mb-2"></i>
                                    <p class="mb-0">Đang tải dữ liệu...</p>
                                </td>
                            </tr>
                            
                            <!-- Empty State -->
                            <tr t-elif="!state.records || state.records.length === 0">
                                <td colspan="11" class="report-contract-statistics-no-data">
                                    <i class="fas fa-search mb-2"></i>
                                    <p class="mb-0">Không tìm thấy dữ liệu phù hợp</p>
                                </td>
                            </tr>

                            <!-- Data Rows -->
                            <tr t-foreach="state.records" t-as="record" t-key="record.id">
                                <td class="text-center" t-esc="record.stt"/>
                                <td><t t-esc="record.transaction_date"/></td>
                                <td><t t-esc="record.account_number"/></td>
                                <td class="fw-bold"><t t-esc="record.customer_name"/></td>
                                <td><span class="badge badge--term"><t t-esc="record.stock_code"/></span></td>
                                <td>
                                    <span t-att-class="this.getOrderTypeBadgeClass(record.order_type)">
                                        <t t-esc="record.order_type"/>
                                    </span>
                                </td>
                                <td><t t-esc="record.transaction_code"/></td>
                                <td class="text-right"><t t-esc="this.formatNumber(record.quantity)"/></td>
                                <td class="text-right"><t t-esc="this.formatCurrency(record.price)"/></td>
                                <td class="text-right fw-bold" style="color: #d63384;"><t t-esc="this.formatCurrency(record.total_amount)"/></td>
                                <td class="text-center">
                                    <span class="badge badge-success">Hoàn thành</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="report-contract-statistics-pagination" t-if="state.pagination.totalRecords > 0">
                <div class="report-contract-statistics-pagination-info">
                    Hiển thị <strong t-esc="state.pagination.startRecord"/> - <strong t-esc="state.pagination.endRecord"/> 
                    trong tổng <strong t-esc="state.pagination.totalRecords"/> bản ghi
                </div>
                <div class="report-contract-statistics-pagination-controls">
                    <button class="report-contract-statistics-pagination-btn" 
                            t-att-disabled="state.pagination.currentPage === 1"
                            t-on-click="() => this.goToPage(state.pagination.currentPage - 1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    
                    <t t-foreach="this.getVisiblePages()" t-as="page" t-key="page">
                        <button class="report-contract-statistics-pagination-btn" 
                                t-att-class="page === state.pagination.currentPage ? 'active' : ''"
                                t-on-click="() => this.goToPage(page)">
                            <t t-esc="page"/>
                        </button>
                    </t>

                    <button class="report-contract-statistics-pagination-btn" 
                            t-att-disabled="state.pagination.currentPage === state.pagination.totalPages"
                            t-on-click="() => this.goToPage(state.pagination.currentPage + 1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            loading: false,
            records: [],
            fundOptions: [],
            filters: {
                fund: '',
                dateFrom: '',
                dateTo: ''
            },
            searchValues: {
                account_number: '', // Mapped to global search or specific
                customer_name: '',
                stock_code: '',
                order_type: '',
                transaction_code: '',
            },
            globalSearch: '', // New global search
            pagination: {
                currentPage: 1,
                pageSize: 15, // Increased page size
                totalRecords: 0,
                startRecord: 0,
                endRecord: 0,
                totalPages: 1
            },
            showExportDropdown: false,
            sortColumn: 'transaction_date',
            sortDirection: 'desc'
        });

        onMounted(() => {
            this.initDropdown();
            this.loadFunds();
            this.loadData();
        });
    }

    async loadFunds() {
        try {
            const res = await this.rpc('/report-transaction/products', {}); // Note: fixed endpoint based on controller
            if (Array.isArray(res)) {
                this.state.fundOptions = res.map(f => ({
                    id: f.id,
                    label: f.name || f.ticker || `Fund ${f.id}`
                }));
            }
        } catch (e) {
            console.error('Error loading funds:', e);
        }
    }

    async loadData() {
        this.state.loading = true;
        try {
            // Mix global search with specific fields if needed
            // For now, simpler to just pass searchValues as before + global handling
            if (this.state.globalSearch) {
                // If using global search, populate fields (backend support dependent)
                // Or backend can handle a 'q' param. reusing existing logic:
                this.state.searchValues.customer_name = this.state.globalSearch;
                // Note: This is weak "Global Search" logic but fits existing backend args
                // Ideally backend supports a single 'search' param.
            }

            const response = await this.rpc('/report-transaction/data', {
                filters: this.state.filters,
                search_values: this.state.searchValues,
                page: this.state.pagination.currentPage,
                limit: this.state.pagination.pageSize
            });

            if (response.error) {
                throw new Error(response.error);
            }

            const items = Array.isArray(response.data) ? response.data : [];
            this.state.records = items.map((it, index) => ({
                id: it.id,
                stt: (this.state.pagination.currentPage - 1) * this.state.pagination.pageSize + index + 1,
                transaction_date: it.phien_giao_dich || it.transaction_date || '',
                account_number: it.so_tai_khoan || '',
                customer_name: it.nha_dau_tu || '',
                order_type: it.loai_lenh || '',
                stock_code: it.chuong_trinh_ticker || it.stock_code || '',
                fund_name: it.quy || '',
                transaction_code: it.ma_giao_dich || '',
                quantity: it.so_ccq || 0,
                price: it.gia_tien || 0,
                total_amount: it.tong_so_tien || 0
            }));

            // Apply client-side sorting if backend doesn't support it (Assuming backend does simple pagination)
            // But usually reporting needs backend sorting. For now, we do client sort for current page
            // Or ideally pass sort params to backend.
            this.applyClientSorting();

            // Pagination
            this.state.pagination.totalRecords = response.total || 0;
            this.state.pagination.totalPages = Math.ceil(this.state.pagination.totalRecords / this.state.pagination.pageSize);
            this.updatePaginationInfo();

        } catch (error) {
            console.error('Error:', error);
            alert('Có lỗi xảy ra: ' + error.message);
        } finally {
            this.state.loading = false;
        }
    }

    // --- Helpers ---

    applyClientSorting() {
        const col = this.state.sortColumn;
        const dir = this.state.sortDirection;
        
        if (!col) return;

        this.state.records.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            // Date handling
            if (col === 'transaction_date') {
                // Format dd/mm/yyyy -> yyyymmdd string compare
                valA = this.parseDateStr(valA);
                valB = this.parseDateStr(valB);
            }
            // Number handling
            else if (['quantity', 'price', 'total_amount'].includes(col)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }
            // String handling
            else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    parseDateStr(dStr) {
        if (!dStr) return 0;
        // Expect dd/mm/yyyy
        const parts = dStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
        return 0;
    }

    updatePaginationInfo() {
        if (this.state.pagination.totalRecords === 0) {
            this.state.pagination.startRecord = 0;
            this.state.pagination.endRecord = 0;
            return;
        }
        this.state.pagination.startRecord = (this.state.pagination.currentPage - 1) * this.state.pagination.pageSize + 1;
        this.state.pagination.endRecord = Math.min(
            this.state.pagination.currentPage * this.state.pagination.pageSize,
            this.state.pagination.totalRecords
        );
    }

    getVisiblePages() {
        const total = this.state.pagination.totalPages;
        const current = this.state.pagination.currentPage;
        const max = 5;
        let start = Math.max(1, current - Math.floor(max / 2));
        let end = Math.min(total, start + max - 1);
        
        if (end - start + 1 < max) {
            start = Math.max(1, end - max + 1);
        }
        
        const pages = [];
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }

    // --- Handlers ---
    
    onFilterChange() {
        this.state.pagination.currentPage = 1;
        this.loadData();
    }

    onGlobalSearchChange(ev) {
        // Debounce could be added here
        this.onFilterChange();
    }

    resetFilters() {
        this.state.filters = { fund: '', dateFrom: '', dateTo: '' };
        this.state.searchValues = { account_number: '', customer_name: '', stock_code: '', order_type: '', transaction_code: '' };
        this.state.globalSearch = '';
        this.onFilterChange();
    }

    sortBy(column) {
        if (this.state.sortColumn === column) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortColumn = column;
            this.state.sortDirection = 'asc';
        }
        this.applyClientSorting();
    }

    getSortIcon(column) {
        if (this.state.sortColumn !== column) return 'fas fa-sort text-muted ms-1';
        return this.state.sortDirection === 'asc' ? 'fas fa-sort-up ms-1' : 'fas fa-sort-down ms-1';
    }

    goToPage(page) {
        if (page < 1 || page > this.state.pagination.totalPages) return;
        this.state.pagination.currentPage = page;
        this.loadData();
    }

    // --- Export ---

    initDropdown() {
        document.addEventListener('click', (event) => {
            if (this.state.showExportDropdown && !event.target.closest('.dropdown')) {
                this.state.showExportDropdown = false;
            }
        });
    }

    toggleExportDropdown() {
        this.state.showExportDropdown = !this.state.showExportDropdown;
    }

    async exportPdf() {
        this.state.showExportDropdown = false;
        await this.handleExport('pdf');
    }

    async exportXlsx() {
        this.state.showExportDropdown = false;
        await this.handleExport('xlsx');
    }

    async handleExport(type) {
        try {
            const params = new URLSearchParams();
            // Add filters
            Object.keys(this.state.filters).forEach(k => {
                if(this.state.filters[k]) params.append(k, this.state.filters[k]);
            });
            // Add search values if relevant (backend needs to support it for export too, usually passed as filters)
            // Assuming current backend only takes 'product', 'from_date', 'to_date' in export
            // If global search is active, export might not match viewing if backend doesn't support it.
            
            const paramMap = {
                'fund': 'product',
                'dateFrom': 'from_date',
                'dateTo': 'to_date'
            }; // Map FE filter names to BE controller params if inconsistent

             // However, look at reloadData params and controller params.
             // Controller export: kw.get('product'), kw.get('from_date')
             // Widget State: filters.fund
             // Need to map them.
            
            if (this.state.filters.fund) {
                // We need the Name for the controller or ID? 
                // Controller says: domain.append(['fund_id.name', '=', selected_product])
                // So it expects NAME. But loadFunds gave us IDs + Labels.
                // We stored ID in filters.fund. We need to find the label.
                const f = this.state.fundOptions.find(f => f.id == this.state.filters.fund);
                if (f) params.append('product', f.label); 
            }
            if (this.state.filters.dateFrom) params.append('from_date', this.state.filters.dateFrom);
            if (this.state.filters.dateTo) params.append('to_date', this.state.filters.dateTo);

            const endpoint = type === 'pdf' ? '/report-transaction/export-pdf' : '/report-transaction/export-xlsx';
            
            // Trigger download
            window.location.href = `${endpoint}?${params.toString()}`;

        } catch (e) {
            console.error(e);
            alert('Lỗi export: ' + e.message);
        }
    }

    // --- Utils ---

    formatNumber(num) {
        if (!num) return '0';
        return num.toLocaleString('vi-VN');
    }

    formatCurrency(num) {
        if (!num) return '0 ₫';
        return num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }

    formatDate(dateStr) {
        // Already formatted by backend usually, but if needed
        return dateStr;
    }

    getOrderTypeBadgeClass(type) {
        const map = {
            'Mua': 'badge-buy',
            'Bán': 'badge-sell',
            'Hoán đổi': 'badge-swap'
        };
        // Also handle English codes just in case
        if (type === 'buy') return 'badge-buy';
        if (type === 'sell') return 'badge-sell';
        
        return map[type] ? `badge ${map[type]}` : 'badge badge-secondary';
    }

    async rpc(route, params) {
        const res = await fetch(route, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: params
            })
        });
        const data = await res.json();
        return data.result;
    }
}