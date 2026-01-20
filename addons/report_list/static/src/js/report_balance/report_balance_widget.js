/** @odoo-module */

import { Component, xml, useState, onMounted } from "@odoo/owl";

class ReportBalanceWidget extends Component {
    static template = xml`
            <div class="report-contract-statistics-container">
            <!-- Header -->
                <div class="report-contract-statistics-header">
                <h1 class="report-contract-statistics-title">Báo cáo Số dư</h1>
                <p class="report-contract-statistics-subtitle">Thống kê số dư tài khoản</p>
                </div>

            <!-- Filters -->
            <div class="report-contract-statistics-filters">
                <div class="report-contract-statistics-filter-row">
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="filterFund">Quỹ:</label>
                        <select id="filterFund" class="report-contract-statistics-filter-input" t-model="state.filters.fund" t-on-change="onFilterChange">
                            <option value="">Tất cả</option>
                            <option t-foreach="state.fundOptions" t-as="fund" t-key="fund.id" 
                                    t-att-value="fund.id" t-esc="fund.label"/>
                        </select>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="dateFromFilter">Từ ngày:</label>
                        <input type="date" id="dateFromFilter" class="report-contract-statistics-filter-input" t-model="state.filters.dateFrom" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <label class="report-contract-statistics-filter-label" for="dateToFilter">Đến ngày:</label>
                        <input type="date" id="dateToFilter" class="report-contract-statistics-filter-input" t-model="state.filters.dateTo" t-on-change="onFilterChange"/>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-secondary" t-on-click="resetFilters">
                            <i class="fas fa-undo"></i> Làm mới
                        </button>
                    </div>
                    <div class="report-contract-statistics-filter-group">
                        <button class="report-contract-statistics-btn report-contract-statistics-btn-success" t-on-click="exportXlsx">
                            <i class="fas fa-file-excel"></i> Xuất Excel
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
                                <th>STT</th>
                                <th>Số TK</th>
                                <th>Số TK GDCK</th>
                                <th>Khách hàng</th>
                                <th>Mã CK</th>
                                <th>Số lượng</th>
                                <th>CN/TC</th>
                                <th>TN/NN</th>
                                <th>NVCS</th>
                                <th>Đơn vị</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr t-if="!state.records || state.records.length === 0">
                                <td colspan="10" class="text-center py-3" style="font-size: 0.85rem;">
                                    <i class="fas fa-inbox me-2"></i>Không có dữ liệu báo cáo số dư
                                </td>
                            </tr>
                            <tr t-foreach="state.records" t-as="record" t-key="record.id">
                                <td t-esc="state.records.indexOf(record) + 1"/>
                                <td t-esc="record.trading_account || ''"/>
                                <td t-esc="record.trading_account || ''"/>
                                <td t-esc="record.investor_name || ''"/>
                                <td t-esc="record.program_ticker || ''"/>
                                <td t-esc="record.ccq_quantity || 0"/>
                                <td>
                                    <span t-if="record.investor_type" 
                                          t-att-class="'chip-customer-type ' + this.getCustomerTypeChipClass(record.investor_type)"
                                          t-esc="this.getCustomerTypeLabel(record.investor_type)"/>
                                </td>
                                <td t-esc="record.nationality || ''"/>
                                <td t-esc="record.sales_staff || ''"/>
                                <td t-esc="record.currency || 'VND'"/>
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
            fundOptions: [],
            filters: {
                fund: '',
                dateFrom: '',
                dateTo: ''
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
            console.log('ReportBalanceWidget OWL component mounted');
            this.loadFunds();
            this.loadData();
        });
        }

    async loadFunds() {
        try {
            const res = await this.rpc('/report-balance/products', {});
            if (Array.isArray(res)) {
                this.state.fundOptions = res.map(f => ({
                    id: f.id,
                    label: f.ticker || f.name || ''
                }));
            }
        } catch (e) {
            console.error('Error loading funds:', e);
        }
    }

    async loadData() {
        this.state.loading = true;
        
        try {
            const response = await this.rpc('/report-balance/data', {
                filters: this.state.filters,
                page: this.state.pagination.currentPage,
                limit: this.state.pagination.pageSize
            });

            if (response.error) {
                console.error('Error loading data:', response.error);
                this.showError('Lỗi khi tải dữ liệu: ' + response.error);
                return;
            }

            // Use data directly from backend (already mapped)
            this.state.records = response.data || [];
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
            fund: '',
            dateFrom: '',
            dateTo: ''
        };
        this.state.pagination.currentPage = 1;
        this.loadData();
    }

    async exportXlsx() {
        this.state.showExportDropdown = false;
        try {
            this.state.loading = true;
            
            const params = new URLSearchParams();
            Object.keys(this.state.filters).forEach(key => {
                if (this.state.filters[key]) {
                    params.append(key, this.state.filters[key]);
                }
            });

            const response = await fetch(`/report-balance/export-xlsx?${params.toString()}`, {
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
            a.download = `report_balance_${new Date().toISOString().split('T')[0]}.xlsx`;
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

    getCustomerTypeLabel(customerType) {
        if (!customerType) return '';
        
        const typeMap = {
            'truc_tiep': 'CN',
            'ky_danh': 'TC',
            'Trực tiếp': 'CN',
            'Ký danh': 'TC',
            'Cá nhân': 'CN',
            'Tổ chức': 'TC'
        };
        
        return typeMap[customerType] || customerType;
    }

    getCustomerTypeChipClass(customerType) {
        if (!customerType) return '';
        
        const isPersonal = ['truc_tiep', 'Trực tiếp', 'Cá nhân', 'CN'].includes(customerType);
        return isPersonal ? 'chip-cn' : 'chip-tc';
    }
}

export { ReportBalanceWidget };