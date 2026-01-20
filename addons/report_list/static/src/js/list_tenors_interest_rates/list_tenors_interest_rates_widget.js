/** @odoo-module */

import { Component, xml, useState, onMounted } from "@odoo/owl";

class ListTenorsInterestRatesWidget extends Component {
    static template = xml`
        <div class="report-contract-statistics-container">
            <!-- Header -->
            <div class="report-contract-statistics-header">
                <h1 class="report-contract-statistics-title">Danh sách Kỳ hạn và Lãi suất</h1>
                <p class="report-contract-statistics-subtitle">Thống kê danh sách kỳ hạn và lãi suất</p>
            </div>

            <!-- Filters -->
            <div class="report-contract-statistics-filters">
                <!-- Inline search by fields -->
                <div class="report-contract-statistics-filter-row">
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="searchProduct">Sản phẩm:</label>
                        <input id="searchProduct" type="text" class="report-contract-statistics-filter-input" placeholder="Nhập tên sản phẩm"
                            t-model="state.searchValues.product_name" t-on-input="onSearchChange"/>
                    </div>
                </div>
                <div class="report-contract-statistics-filter-row">
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="dateFromFilter">Từ ngày:</label>
                        <input type="date" id="dateFromFilter" class="report-contract-statistics-filter-input" t-model="state.filters.dateFrom" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="dateToFilter">Đến ngày:</label>
                        <input type="date" id="dateToFilter" class="report-contract-statistics-filter-input" t-model="state.filters.dateTo" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="termFilter">Kỳ hạn:</label>
                        <select id="termFilter" class="report-contract-statistics-filter-input" t-model="state.filters.term" t-on-change="onFilterChange">
                            <option value="">Tất cả</option>
                            <option value="1">1 tháng</option>
                            <option value="2">2 tháng</option>
                            <option value="3">3 tháng</option>
                            <option value="4">4 tháng</option>
                            <option value="5">5 tháng</option>
                            <option value="6">6 tháng</option>
                            <option value="7">7 tháng</option>
                            <option value="8">8 tháng</option>
                            <option value="9">9 tháng</option>
                            <option value="10">10 tháng</option>
                            <option value="11">11 tháng</option>
                            <option value="12">12 tháng</option>
                        </select>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-secondary" t-on-click="resetFilters">
                            <i class="fas fa-undo"></i> Làm mới
                        </button>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-success" t-on-click="exportXlsx">
                            <i class="fas fa-file-excel"></i> Xuất XLSX
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading -->
            <div t-if="state.loading" class="report-contract-statistics-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Đang tải dữ liệu...</p>
            </div>

            <!-- Table -->
            <div class="report-contract-statistics-table-container">
                <div class="report-contract-statistics-table-wrapper">
                    <table class="report-contract-statistics-table">
                        <thead>
                            <tr>
                                <th style="width: 60px;">STT</th>
                                <th style="width: 160px;">SP</th>
                                <th style="width: 140px;">Ngày tạo SP</th>
                                <th style="width: 140px;">Ngày hiệu lực</th>
                                <th style="width: 140px;">Ngày kết thúc</th>
                                <th style="width: 100px;">Kỳ hạn</th>
                                <th style="width: 120px;">Lãi suất</th>
                                <th style="width: 180px;">Người nhập/Điều chỉnh</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr t-if="!state.records or state.records.length === 0">
                                <td colspan="8" class="text-center py-3" style="font-size: 0.85rem;">
                                    <i class="fas fa-inbox me-2"></i>Không có dữ liệu kỳ hạn và lãi suất
                                </td>
                            </tr>
                            <tr t-foreach="state.records" t-as="record" t-key="record.id">
                                <td style="font-size: 0.8rem;" t-esc="record.stt"/>
                                <td style="font-size: 0.8rem;" t-esc="record.product_name"/>
                                <td style="font-size: 0.8rem;" t-esc="record.product_creation_date"/>
                                <td style="font-size: 0.8rem;" t-esc="record.effective_date"/>
                                <td style="font-size: 0.8rem;" t-esc="record.expiry_date"/>
                                <td style="font-size: 0.8rem;" t-esc="record.term"/>
                                <td style="font-size: 0.8rem;" t-esc="record.interest_rate"/>
                                <td style="font-size: 0.8rem;" t-esc="record.creator_name"/>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="report-contract-statistics-pagination">
                <div class="report-contract-statistics-pagination-info">
                    Hiển thị <span t-esc="state.pagination.startRecord"/> đến <span t-esc="state.pagination.endRecord"/> 
                    trong tổng số <span t-esc="state.pagination.totalRecords"/> bản ghi
                </div>
                <div class="report-contract-statistics-pagination-controls">
                    <button t-foreach="state.pagination.pages" t-as="page" t-key="page" 
                            class="report-contract-statistics-pagination-btn" 
                            t-att-class="page === state.pagination.currentPage ? 'active' : ''"
                            t-on-click="() => this.goToPage(page)"
                            t-esc="page"/>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            loading: false,
            records: [],
            filters: {
                dateFrom: '',
                dateTo: '',
                term: ''
            },
            searchValues: {
                product_name: ''
            },
            pagination: {
                currentPage: 1,
                pageSize: 10,
                totalRecords: 0,
                startRecord: 0,
                endRecord: 0,
                pages: []
            }
        });

        onMounted(() => {
            console.log('ListTenorsInterestRatesWidget OWL component mounted');
            this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        
        try {
            const response = await this.rpc('/list_tenors_interest_rates/get_data', {
                filters: this.state.filters,
                search_values: this.state.searchValues,
                page: this.state.pagination.currentPage,
                limit: this.state.pagination.pageSize
            });

            if (response.error) {
                console.error('Error loading data:', response.error);
                this.showError('Lỗi khi tải dữ liệu: ' + response.error);
                return;
            }

            const raw = response && (response.data || response.records) || [];
            const items = Array.isArray(raw) ? raw : [];
            this.state.records = items.map((it) => ({
                id: it.id,
                stt: it.stt,
                product_name: it.product_name || '',
                product_creation_date: it.product_creation_date || '',
                effective_date: it.effective_date || '',
                expiry_date: it.end_date || '',
                term: it.term || '',
                interest_rate: it.interest_rate || '',
                creator_name: it.creator_name || '',
                status: it.status || 'active'
            }));
            if (response.page) this.state.pagination.currentPage = response.page;
            if (response.limit) this.state.pagination.pageSize = response.limit;
            this.state.pagination.totalRecords = response.total || 0;
            this.updatePaginationInfo();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Lỗi khi tải dữ liệu');
        } finally {
            this.state.loading = false;
        }
    }

    onFilterChange() {
        this.state.pagination.currentPage = 1;
        this.loadData();
    }

    onSearchChange() {
        this.state.pagination.currentPage = 1;
        this.loadData();
    }

    updatePaginationInfo() {
        const startRecord = this.state.pagination.totalRecords > 0 ? 
            (this.state.pagination.currentPage - 1) * this.state.pagination.pageSize + 1 : 0;
        const endRecord = Math.min(
            this.state.pagination.currentPage * this.state.pagination.pageSize, 
            this.state.pagination.totalRecords
        );
        
        this.state.pagination.startRecord = startRecord;
        this.state.pagination.endRecord = endRecord;
        
        // Generate page numbers
        const totalPages = Math.ceil(this.state.pagination.totalRecords / this.state.pagination.pageSize);
        this.state.pagination.pages = [];
        for (let i = 1; i <= totalPages; i++) {
            this.state.pagination.pages.push(i);
        }
    }

    goToPage(page) {
        this.state.pagination.currentPage = page;
        this.loadData();
    }

    resetFilters() {
        this.state.filters = {
            dateFrom: '',
            dateTo: '',
            term: ''
        };
        this.state.searchValues = {
            product_name: ''
        };
        this.state.pagination.currentPage = 1;
        this.loadData();
    }

    async exportXlsx() {
        try {
            this.state.loading = true;
            
            const params = new URLSearchParams();
            Object.keys(this.state.filters).forEach(key => {
                if (this.state.filters[key]) {
                    params.append(key, this.state.filters[key]);
                }
            });

            const response = await fetch(`/list_tenors_interest_rates/export_xlsx?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `list_tenors_interest_rates_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (error) {
            console.error('Error exporting XLSX:', error);
            this.showError('Lỗi khi xuất XLSX: ' + error.message);
        } finally {
            this.state.loading = false;
        }
    }

    showError(message) {
        alert(message);
    }

    async rpc(route, params) {
        try {
            const response = await fetch(route, {
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

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('RPC Error:', error);
            throw error;
        }
    }
}

export { ListTenorsInterestRatesWidget };