// Bank Information Widget Component
console.log('Loading BankInfoWidget component...');

const { Component, xml, useState, onMounted } = owl;

class BankInfoWidget extends Component {
    static template = xml`
        <div class="investor-page">
            <div class="investor-layout">
                <!-- Sidebar -->
                <aside class="investor-sidebar">
                    <div class="sidebar-header">
                        <div class="logo-container">
                            <i class="fa fa-user-circle"></i>
                        </div>
                        <h3><t t-esc="state.profile.name || 'Investor'" /></h3>
                        <div class="mt-2">
                             <span t-if="state.statusInfo.account_status == 'approved'" class="status-badge status-complete">Đã duyệt</span>
                             <span t-elif="state.statusInfo.account_status == 'pending'" class="status-badge status-incomplete">Chờ duyệt</span>
                             <span t-elif="state.statusInfo.account_status == 'rejected'" class="status-badge status-incomplete">Từ chối</span>
                             <span t-else="" class="status-badge status-incomplete">Chưa có</span>
                        </div>
                        
                        <div class="mt-4 px-2">
                            <div class="d-flex justify-content-between mb-2 small">
                                <span class="text-muted">Số TK:</span>
                                <span class="fw-bold text-dark"><t t-esc="state.statusInfo.account_number || '---'" /></span>
                            </div>
                            <div class="d-flex justify-content-between mb-2 small">
                                <span class="text-muted">Mã GT:</span>
                                <span class="fw-bold text-dark"><t t-esc="state.statusInfo.referral_code || '---'" /></span>
                            </div>
                            <div class="d-flex justify-content-between mb-2 small">
                                <span class="text-muted">Hồ sơ:</span>
                                
                                <span t-if="state.statusInfo.profile_status == 'complete'" class="text-success fw-bold">Đã hoàn tất</span>
                                <span t-else="" class="text-warning fw-bold">Chưa hoàn tất</span>
                            </div>
                        </div>

                        <t t-if="state.statusInfo.rm_name">
                            <div class="mt-3 pt-3 border-top small text-center text-muted">
                                <i class="fa fa-id-card-o me-1"></i> RM: <t t-esc="state.statusInfo.rm_name"/>
                            </div>
                        </t>
                    </div>
                    
                    <nav class="sidebar-nav mt-3">
                        <a href="/personal_profile" class="nav-item">
                            <i class="fa fa-user"></i> Thông tin cá nhân
                        </a>
                        <a href="/bank_info" class="nav-item active">
                            <i class="fa fa-university"></i> TK Ngân hàng
                        </a>
                        <a href="/address_info" class="nav-item">
                            <i class="fa fa-map-marker"></i> Thông tin địa chỉ
                        </a>
                        <a href="/verification" class="nav-item">
                            <i class="fa fa-shield"></i> Xác thực &amp; eKYC
                        </a>
                    </nav>
                </aside>
                
                <!-- Main Content -->
                <div class="investor-content">
                    <div class="investor-card">
                        <div class="card-header-styled">
                             <h2>Thông tin tài khoản ngân hàng</h2>
                             <p>Cập nhật thông tin ngân hàng chính chủ của bạn</p>
                        </div>
                        
                        <form class="investor-form" t-on-submit.prevent="saveProfile">
                             <div class="row">
                                <div class="col-12 mb-4">
                                     <h5 class="text-primary fw-bold mb-3 border-bottom pb-2">1. Thông tin tài khoản</h5>
                                     
                                     <div class="mb-3">
                                          <label for="account_holder_name" class="form-label">Tên chủ tài khoản <span class="text-danger">*</span></label>
                                          <input id="account_holder_name" type="text" class="form-control" t-model="state.formData.account_holder" required="required" placeholder="Nhập tên chủ tài khoản (Viết in hoa)" />
                                     </div>
                                     
                                     <div class="row">
                                          <div class="col-md-6 mb-3">
                                               <label for="bank_name" class="form-label">Tên ngân hàng <span class="text-danger">*</span></label>
                                               <div style="position: relative;">
                                                    <input 
                                                         id="bank_name" 
                                                         type="text" 
                                                         class="form-control" 
                                                         t-model="state.formData.bank_name" 
                                                         t-on-input="filterBanks"
                                                         t-on-focus="() => this.state.showBankDropdown = true"
                                                         required="required" 
                                                         placeholder="Gõ để tìm ngân hàng..." 
                                                         autocomplete="off"
                                                    />
                                                    <div t-if="state.showBankDropdown and state.filteredBanks.length > 0" 
                                                         class="autocomplete-dropdown"
                                                         style="position: absolute; top: 100%; left: 0; right: 0; max-height: 300px; overflow-y: auto; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; margin-top: 4px;">
                                                         <div t-foreach="state.filteredBanks" t-as="bank" t-key="bank.id"
                                                              t-on-click="() => this.selectBank(bank)"
                                                              class="autocomplete-item"
                                                              style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;">
                                                              <div style="font-weight: 600; color: #333;"><t t-esc="bank.short_name" /></div>
                                                              <div style="font-size: 0.85rem; color: #666;"><t t-esc="bank.name" /></div>
                                                         </div>
                                                    </div>
                                               </div>
                                          </div>
                                          <div class="col-md-6 mb-3">
                                               <label for="bank_account_number" class="form-label">Số tài khoản <span class="text-danger">*</span></label>
                                               <input id="bank_account_number" type="text" class="form-control" t-model="state.formData.account_number" required="required" placeholder="Nhập số tài khoản" />
                                          </div>
                                     </div>
                                     
                                     <div class="mb-3">
                                          <label for="bank_branch" class="form-label">Chi nhánh <span class="text-danger">*</span></label>
                                          <div style="position: relative;">
                                               <input 
                                                    id="bank_branch" 
                                                    type="text" 
                                                    class="form-control" 
                                                    t-model="state.formData.branch" 
                                                    t-on-focus="() => this.state.showBranchDropdown = true"
                                                    required="required"
                                                    placeholder="Chọn chi nhánh..."
                                                    autocomplete="off"
                                               />
                                               <div t-if="state.showBranchDropdown and state.branches.length > 0" 
                                                    class="autocomplete-dropdown"
                                                    style="position: absolute; top: 100%; left: 0; right: 0; max-height: 250px; overflow-y: auto; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; margin-top: 4px;">
                                                    <div t-foreach="state.branches" t-as="branch" t-key="branch.id"
                                                         t-on-click="() => this.selectBranch(branch)"
                                                         class="autocomplete-item"
                                                         style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;">
                                                         <t t-esc="branch.name" />
                                                    </div>
                                               </div>
                                          </div>
                                     </div>
                                     <div class="form-text text-muted mb-2"><i class="fa fa-info-circle"></i> (*) Thông tin bắt buộc và tài khoản sẽ được dùng khi thực hiện lệnh bán</div>
                                </div>
                                
                                <div class="col-12">
                                     <h5 class="text-primary fw-bold mb-3 border-bottom pb-2">2. Thông tin nghề nghiệp &amp; Thu nhập</h5>
                                     
                                     <div class="row">
                                          <div class="col-md-6 mb-3">
                                               <label for="company_name" class="form-label">Công ty nơi làm việc</label>
                                               <input id="company_name" type="text" class="form-control" t-model="state.formData.company_name" />
                                          </div>
                                          <div class="col-md-6 mb-3">
                                               <label for="company_address" class="form-label">Địa chỉ công ty</label>
                                               <input id="company_address" type="text" class="form-control" t-model="state.formData.company_address" />
                                          </div>
                                     </div>
                                     
                                     <div class="row">
                                          <div class="col-md-4 mb-3">
                                              <label for="monthly_income" class="form-label">Thu nhập hàng tháng</label>
                                              <input id="monthly_income" type="text" placeholder="VNĐ" class="form-control" t-model="state.formData.monthly_income" t-on-input="formatCurrency"/>
                                          </div>
                                          <div class="col-md-4 mb-3">
                                              <label for="occupation" class="form-label">Nghề nghiệp</label>
                                              <input id="occupation" type="text" class="form-control" t-model="state.formData.occupation"/>
                                          </div>
                                          <div class="col-md-4 mb-3">
                                              <label for="position" class="form-label">Chức vụ</label>
                                              <input id="position" type="text" class="form-control" t-model="state.formData.position"/>
                                          </div>
                                     </div>
                                </div>
                             </div>
                             
                             <div class="d-flex justify-content-end pt-3 border-top gap-2">
                                 <button type="submit" class="btn btn-primary-investor px-5">
                                      <i class="fa fa-save me-2"></i> Lưu Thông Tin
                                 </button>
                             </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <div t-if="state.showModal" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5);">
              <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4">
                  <div class="modal-header border-0 bg-light rounded-top-4">
                    <h5 class="modal-title fw-bold text-primary"><t t-esc="state.modalTitle" /></h5>
                    <button type="button" class="btn-close" t-on-click="closeModal"></button>
                  </div>
                  <div class="modal-body text-center p-4">
                    <t t-if="state.modalTitle === 'Thành công'">
                      <div class="mb-3 text-success" style="font-size: 3rem;">
                        <i class="fa fa-check-circle"></i>
                      </div>
                    </t>
                    <p class="fs-5 text-secondary"><t t-esc="state.modalMessage" /></p>
                  </div>
                  <div class="modal-footer border-0 justify-content-center pb-4">
                    <button type="button" class="btn btn-primary-investor px-4 rounded-pill" t-on-click="closeModal">Đóng</button>
                  </div>
                </div>
              </div>
            </div>
        </div>
    `;

    setup() {
        console.log("🎯 BankInfoWidget - setup called!");

        this.state = useState({
            loading: true,
            profile: {},
            statusInfo: {},
            formData: {
                account_holder: '',
                account_number: '',
                bank_name: '',
                branch: '',
                company_name: '',
                company_address: '',
                monthly_income: '',
                occupation: '',
                position: ''
            },
            activeTab: 'bank',
            showModal: false,
            modalTitle: '',
            modalMessage: '',
            // Autocomplete states
            allBanks: [],
            filteredBanks: [],
            showBankDropdown: false,
            selectedBankId: null,
            branches: [],
            showBranchDropdown: false,
        });

        onMounted(async () => {
            // Hide loading spinner
            const loadingSpinner = document.getElementById('loadingSpinner');
            const widgetContainer = document.getElementById('bankInfoWidget');

            if (loadingSpinner && widgetContainer) {
                loadingSpinner.style.display = 'none';
                widgetContainer.style.display = 'block';
            }
            // Reset storage nếu user đổi
            const currentUserId = window.currentUserId || (window.odoo && window.odoo.session_info && window.odoo.session_info.uid);
            const storedUserId = sessionStorage.getItem('bankInfoUserId');
            if (storedUserId && String(storedUserId) !== String(currentUserId)) {
                sessionStorage.removeItem('bankInfoData');
                sessionStorage.removeItem('bankInfoUserId');
            }
            // Load banks list
            await this.loadBanks();
            // Load profile data and status info
            await this.loadProfileData();
            this.loadInitialFormData(); // Load form data after profile is loaded or from sessionStorage
            await this.loadStatusInfo();

            this.state.loading = false;

            // Close dropdowns when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#bank_name') && !e.target.closest('.autocomplete-dropdown')) {
                    this.state.showBankDropdown = false;
                }
                if (!e.target.closest('#bank_branch') && !e.target.closest('.autocomplete-dropdown')) {
                    this.state.showBranchDropdown = false;
                }
            });
        });
    }

    loadInitialFormData() {
        // Ưu tiên lấy từ sessionStorage
        const storedData = sessionStorage.getItem('bankInfoData');
        if (storedData) {
            const parsedData = JSON.parse(storedData);
            Object.assign(this.state.formData, parsedData);
            // Format monthly_income nếu có
            if (this.state.formData.monthly_income) {
                this.state.formData.monthly_income = this.formatCurrencyValue(this.state.formData.monthly_income);
            }
            console.log("✅ Form data loaded from sessionStorage:", this.state.formData);
        } else if (this.state.profile && Object.keys(this.state.profile).length > 0) {
            this.state.formData.account_holder = this.state.profile.account_holder || '';
            this.state.formData.account_number = this.state.profile.account_number || '';
            this.state.formData.bank_name = this.state.profile.bank_name || '';
            this.state.formData.branch = this.state.profile.branch || '';
            this.state.formData.company_name = this.state.profile.company_name || '';
            this.state.formData.company_address = this.state.profile.company_address || '';
            this.state.formData.monthly_income = this.formatCurrencyValue(this.state.profile.monthly_income) || '';
            this.state.formData.occupation = this.state.profile.occupation || '';
            this.state.formData.position = this.state.profile.position || '';
            console.log("✅ Form data initialized with existing profile data:", this.state.formData);
        } else {
            console.log("ℹ️ No existing bank data found, using default values");
        }
    }

    async loadStatusInfo() {
        try {
            const response = await fetch('/get_status_info');
            const data = await response.json();
            if (data && data.length > 0) {
                this.state.statusInfo = data[0];
            } else {
                this.state.statusInfo = {};
            }
            // Luôn lấy tên user từ profile
            const profileRes = await fetch('/data_personal_profile');
            const profileData = await profileRes.json();
            if (profileData && profileData.length > 0 && profileData[0].name) {
                this.state.profile.name = profileData[0].name;
            } else {
                this.state.profile.name = (window.odoo && window.odoo.session_info && window.odoo.session_info.name) || 'Chưa có thông tin';
            }
        } catch (error) {
            this.state.statusInfo = {};
            this.state.profile.name = (window.odoo && window.odoo.session_info && window.odoo.session_info.name) || 'Chưa có thông tin';
        }
    }

    async saveProfile() {
        try {
            const bankData = { ...this.state.formData };
            // Chuyển monthly_income về số nếu có dấu chấm
            if (bankData.monthly_income) {
                bankData.monthly_income = parseFloat(String(bankData.monthly_income).replace(/\./g, ''));
            }
            // ... kiểm tra dữ liệu ...
            // Gửi dữ liệu lên Odoo
            const response = await fetch('/save_bank_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bankData)
            });
            const result = await response.json();
            if (response.ok && result.success) {
                sessionStorage.setItem('bankInfoData', JSON.stringify(bankData));
                sessionStorage.setItem('bankInfoUserId', String(window.currentUserId || ''));
                this.state.modalTitle = 'Thành công';
                this.state.modalMessage = 'Lưu Thông Tin ngân hàng thành công!';
                this.state.showModal = true;
                setTimeout(() => { window.location.href = '/address_info'; }, 1500);
            } else {
                this.state.modalTitle = 'Lỗi';
                this.state.modalMessage = result.error || 'Có lỗi xảy ra, vui lòng thử lại.';
                this.state.showModal = true;
            }
        } catch (error) {
            this.state.modalTitle = 'Lỗi';
            this.state.modalMessage = error.message || 'Có lỗi xảy ra, vui lòng thử lại.';
            this.state.showModal = true;
        }
    }

    closeModal = () => {
        this.state.showModal = false;
    };

    async loadProfileData() {
        try {
            console.log("🔄 Loading bank profile data from server...");
            const response = await fetch('/data_bank_info');
            const data = await response.json();
            console.log("📥 Bank profile data received:", data);

            if (data && data.length > 0) {
                // For bank info, data might be an array of accounts, we'll take the first one or handle multiple later.
                // For now, assuming user only fills out one primary bank account for simplicity.
                this.state.profile = data[0];
                console.log("✅ Bank profile data loaded successfully:", this.state.profile);
            } else {
                console.log("ℹ️ No existing bank profile data found on server");
                this.state.profile = {};
            }
        } catch (error) {
            console.error("❌ Error fetching bank profiles:", error);
            this.state.profile = {};
        }
    }

    formatCurrency(ev) {
        // Lấy giá trị hiện tại
        let value = ev.target.value;

        // Loại bỏ tất cả ký tự không phải số
        value = value.replace(/[^\d]/g, '');

        // Format với dấu phẩy ngăn cách hàng nghìn
        if (value) {
            value = parseInt(value).toLocaleString('vi-VN');
        }

        // Cập nhật giá trị vào state
        this.state.formData.monthly_income = value;
    }

    formatCurrencyValue(value) {
        if (value) {
            return parseInt(value).toLocaleString('vi-VN');
        }
        return '';
    }

    parseCurrencyValue(value) {
        if (value) {
            // Loại bỏ tất cả ký tự không phải số
            return value.replace(/[^\d]/g, '');
        }
        return '';
    }

    async loadBanks() {
        try {
            const response = await fetch('/get_bank_data?limit=1000');
            const data = await response.json();
            if (data && data.records) {
                this.state.allBanks = data.records.filter(b => b.active);
                this.state.filteredBanks = [...this.state.allBanks];
                console.log('✅ Loaded', this.state.allBanks.length, 'banks');
            }
        } catch (error) {
            console.error('❌ Error loading banks:', error);
        }
    }

    filterBanks(ev) {
        const searchTerm = ev.target.value.toLowerCase();
        if (!searchTerm) {
            this.state.filteredBanks = [...this.state.allBanks];
            this.state.showBankDropdown = true;
            return;
        }

        this.state.filteredBanks = this.state.allBanks.filter(bank =>
            bank.name.toLowerCase().includes(searchTerm) ||
            bank.short_name.toLowerCase().includes(searchTerm) ||
            (bank.code && bank.code.toLowerCase().includes(searchTerm))
        );
        this.state.showBankDropdown = true;
    }

    async selectBank(bank) {
        this.state.formData.bank_name = bank.short_name || bank.name;
        this.state.selectedBankId = bank.id;
        this.state.showBankDropdown = false;

        // Load branches for selected bank
        await this.loadBranches(bank.id);
        console.log('✅ Selected bank:', bank.short_name);
    }

    async loadBranches(bankId) {
        try {
            const response = await fetch(`/get_bank_branch_data?limit=1000`);
            const data = await response.json();
            if (data && data.records) {
                // Filter branches by bank name (since API doesn't support bank_id filter)
                const selectedBank = this.state.allBanks.find(b => b.id === bankId);
                if (selectedBank) {
                    this.state.branches = data.records.filter(br =>
                        br.bank_id === selectedBank.name && br.active
                    );
                    console.log('✅ Loaded', this.state.branches.length, 'branches for', selectedBank.short_name);
                }
            }
        } catch (error) {
            console.error('❌ Error loading branches:', error);
            this.state.branches = [];
        }
    }

    selectBranch(branch) {
        this.state.formData.branch = branch.name;
        this.state.showBranchDropdown = false;
        console.log('✅ Selected branch:', branch.name);
    }
}

// Make component globally available
window.BankInfoWidget = BankInfoWidget;
console.log('BankInfoWidget component loaded and available globally');

// Auto-mount when script is loaded
if (typeof owl !== 'undefined') {
    const widgetContainer = document.getElementById('bankInfoWidget');
    if (widgetContainer) {
        console.log('Mounting BankInfoWidget');
        owl.mount(BankInfoWidget, widgetContainer);
    }
} 