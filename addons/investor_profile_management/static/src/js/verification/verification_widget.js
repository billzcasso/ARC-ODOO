// Verification Completion Widget Component
// console.log('Loading VerificationWidget component...');

const { Component, xml, useState, onMounted } = owl;

class VerificationWidget extends Component {
    static components = { InvestorSidebar: window.InvestorSidebar };

    static template = xml`
        <div class="investor-page">
            <div class="investor-layout">
                <!-- Sidebar -->
                <InvestorSidebar profile="this.state.profile" statusInfo="this.state.statusInfo" activePage="'verification'" />
                
                <!-- Main Content -->
                <div class="investor-content">
                    <div class="investor-card border-0 shadow-sm" style="background: white; border-radius: 12px; padding: 2rem;">
                         <!-- Brand Header Style -->
                        <div class="d-flex align-items-center mb-4 pb-2 border-bottom">
                            <div style="width: 4px; height: 32px; background-color: #ff9900; margin-right: 12px; border-radius: 2px;"></div>
                            <div>
                                <h2 class="mb-0 fw-bold text-dark" style="font-size: 1.75rem;">Xác thực hoàn tất</h2>
                                <p class="text-muted mb-0 small">Xác nhận thông tin và hoàn tất hồ sơ đăng ký</p>
                            </div>
                        </div>

                        <div class="mb-4">
                             <h5 class="text-primary fw-bold mb-3">Xác nhận thông tin</h5>
                        </div>
                        
                        <form class="investor-form" t-on-submit.prevent="completeVerification">
                             
                             <!-- Instruction Box -->
                             <div class="p-4 bg-light rounded-3 mb-4" style="border: 1px solid #e9ecef;">
                                 <p class="mb-3 text-secondary">
                                  Để đảm bảo quyền lợi và tính pháp lý, Quý khách vui lòng kiểm tra kỹ lại toàn bộ thông tin đã cung cấp.
                                 </p>
                                 <p class="mb-3 text-secondary">
                                  Bằng việc nhấn nút <span class="fw-bold text-primary">"Hoàn tất"</span> bên dưới, Quý khách xác nhận rằng mọi thông tin là chính xác và đồng ý ký kết Hợp đồng mở tài khoản giao dịch chứng chỉ quỹ.
                                 </p>
                                 <p class="mb-0 text-secondary">
                                  Hệ thống sẽ tự động ghi nhận hồ sơ và kích hoạt tài khoản ngay sau khi yêu cầu được phê duyệt.
                                 </p>
                             </div>
                             
                             <!-- Commitment List (International Standard Style) -->
                             <div class="mb-4 ps-2">
                                  <div class="d-flex align-items-start mb-3">
                                      <i class="fa fa-check text-success mt-1 me-3 fs-5"></i>
                                      <span class="text-dark">Tôi cam kết các thông tin đã cung cấp là chính xác và trung thực.</span>
                                  </div>
                                  <div class="d-flex align-items-start mb-3">
                                      <i class="fa fa-check text-success mt-1 me-3 fs-5"></i>
                                      <span class="text-dark">Tôi đồng ý tuân thủ các quy định giao dịch của công ty quản lý quỹ.</span>
                                  </div>
                                  <div class="d-flex align-items-start mb-3">
                                      <i class="fa fa-check text-success mt-1 me-3 fs-5"></i>
                                      <span class="text-dark">Tôi đã đọc, hiểu và đồng ý với các điều khoản trong hợp đồng mở tài khoản.</span>
                                  </div>
                                  <div class="d-flex align-items-start mb-3">
                                      <i class="fa fa-check text-success mt-1 me-3 fs-5"></i>
                                      <span class="text-dark">Tôi cam kết sẽ thông báo cho công ty khi có thay đổi về thông tin cá nhân.</span>
                                  </div>
                             </div>
                             
                             <!-- Highlighted Agreement Checkbox -->
                             <div class="form-check p-3 rounded-3 mb-5 d-flex align-items-center" 
                                  style="background-color: #ffcc00; border: 1px solid #e6b800; min-height: 56px;">
                                  <input type="checkbox" id="agree_terms" t-model="state.agreedToTerms" required="required" 
                                         class="form-check-input me-3" 
                                         style="width: 24px; height: 24px; margin-top: 0; cursor: pointer;" />
                                  <label for="agree_terms" class="form-check-label fw-bold text-dark fs-5" style="cursor: pointer;">
                                      Tôi đồng ý với các điều khoản và điều kiện trên <span class="text-danger">*</span>
                                  </label>
                             </div>
                             
                             <!-- Action Buttons -->
                             <div class="d-flex justify-content-end gap-3 border-top pt-4">
                                 <button type="button" class="btn btn-link text-decoration-none text-secondary fw-bold px-4" t-on-click="onBack">
                                     <i class="fa fa-arrow-left me-2"></i> Quay lại
                                 </button>
                                 <button type="submit" class="btn btn-warning text-white fw-bold px-5 py-2 rounded-pill shadow-sm" style="background-color: #ff9900; border: none; font-size: 1.1rem;">
                                      <i class="fa fa-check-circle me-2"></i> Hoàn tất
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
                    <t t-if="state.modalTitle === 'Thành công' || state.modalTitle === 'Xác nhận hoàn tất'">
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
        // console.log("🎯 VerificationWidget - setup called!");

        this.state = useState({
            loading: true,
            profile: {},
            statusInfo: {},
            agreedToTerms: false,
            contractEmail: 'nhaltp7397@gmail.com', // Hardcoded for now, will fetch dynamically later
            companyAddress: '123 Fincorp St, Financial City, Country', // Hardcoded for now
            showModal: false,
            modalTitle: '',
            modalMessage: '',
        });

        onMounted(async () => {
            // Hide loading spinner
            const loadingSpinner = document.getElementById('loadingSpinner');
            const widgetContainer = document.getElementById('verificationWidget');

            if (loadingSpinner && widgetContainer) {
                loadingSpinner.style.display = 'none';
                widgetContainer.style.display = 'block';
            }
            // Reset storage nếu user đổi
            const currentUserId = window.currentUserId || (window.odoo && window.odoo.session_info && window.odoo.session_info.uid);
            const storedUserId = sessionStorage.getItem('personalProfileUserId');
            if (storedUserId && String(storedUserId) !== String(currentUserId)) {
                sessionStorage.removeItem('personalProfileData');
                sessionStorage.removeItem('personalProfileUserId');
                sessionStorage.removeItem('bankInfoData');
                sessionStorage.removeItem('bankInfoUserId');
                sessionStorage.removeItem('addressInfoData');
                sessionStorage.removeItem('addressInfoUserId');
            }
            // Load profile data and status info
            await this.loadProfileData();
            this.loadInitialFormData(); // Load form data from sessionStorage
            await this.loadStatusInfo();
            await this.checkAllInfoCompleted();

            this.state.loading = false;
        });
    }

    loadInitialFormData() {
        // Load data from sessionStorage if available
        const storedPersonalData = sessionStorage.getItem('personalProfileData');
        const storedBankData = sessionStorage.getItem('bankInfoData');
        const storedAddressData = sessionStorage.getItem('addressInfoData');

        if (storedPersonalData) {
            // console.log("✅ Loaded personalProfileData from sessionStorage:", JSON.parse(storedPersonalData));
        } else {
            // console.log("ℹ️ No personal profile data in sessionStorage");
        }
        if (storedBankData) {
            // console.log("✅ Loaded bankInfoData from sessionStorage:", JSON.parse(storedBankData));
        } else {
            // console.log("ℹ️ No bank info data in sessionStorage");
        }
        if (storedAddressData) {
            // console.log("✅ Loaded addressInfoData from sessionStorage:", JSON.parse(storedAddressData));
        } else {
            // console.log("ℹ️ No address info data in sessionStorage");
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

    async checkAllInfoCompleted() {
        // Gọi API kiểm tra đủ thông tin 3 phần
        try {
            const [personal, bank, address] = await Promise.all([
                fetch('/data_personal_profile').then(r => r.json()),
                fetch('/data_bank_info').then(r => r.json()),
                fetch('/data_address_info').then(r => r.json()),
            ]);
            if (!personal.length) {
                this.state.modalTitle = 'Thiếu thông tin';
                this.state.modalMessage = 'Bạn cần nhập đầy đủ thông tin cá nhân trước khi xác thực.';
                this.state.showModal = true;
                setTimeout(() => { window.location.href = '/personal_profile'; }, 1800);
                return;
            }
            if (!bank.length) {
                this.state.modalTitle = 'Thiếu thông tin';
                this.state.modalMessage = 'Bạn cần nhập đầy đủ thông tin ngân hàng trước khi xác thực.';
                this.state.showModal = true;
                setTimeout(() => { window.location.href = '/bank_info'; }, 1800);
                return;
            }
            if (!address.length) {
                this.state.modalTitle = 'Thiếu thông tin';
                this.state.modalMessage = 'Bạn cần nhập đầy đủ thông tin địa chỉ trước khi xác thực.';
                this.state.showModal = true;
                setTimeout(() => { window.location.href = '/address_info'; }, 1800);
                return;
            }
        } catch (error) {
            this.state.modalTitle = 'Lỗi';
            this.state.modalMessage = 'Không kiểm tra được thông tin hồ sơ. Vui lòng thử lại.';
            this.state.showModal = true;
        }
    }

    async completeVerification() {
        // Kiểm tra xác nhận điều khoản
        if (!this.state.agreedToTerms) {
            this.state.modalTitle = 'Thiếu xác nhận';
            this.state.modalMessage = 'Vui lòng đồng ý với các điều khoản và điều kiện để hoàn tất.';
            this.state.showModal = true;
            return;
        }

        try {
            // Kiểm tra thông tin từ các bước trước
            const personalData = JSON.parse(sessionStorage.getItem('personalProfileData') || '{}');
            const bankData = JSON.parse(sessionStorage.getItem('bankInfoData') || '{}');
            const addressData = JSON.parse(sessionStorage.getItem('addressInfoData') || '{}');

            // Kiểm tra thông tin cá nhân
            const requiredPersonalFields = ['name', 'birth_date', 'gender', 'nationality', 'id_type', 'id_number', 'id_issue_date', 'id_issue_place'];
            const missingPersonalFields = requiredPersonalFields.filter(field => !personalData[field]);

            // Kiểm tra thông tin ngân hàng
            const requiredBankFields = ['bank_name', 'account_number', 'account_holder', 'branch'];
            const missingBankFields = requiredBankFields.filter(field => !bankData[field]);

            // Kiểm tra thông tin địa chỉ (chỉ yêu cầu các trường bắt buộc)
            const requiredAddressFields = ['city', 'district', 'ward'];
            const missingAddressFields = requiredAddressFields.filter(field => !addressData[field]);

            // Tạo thông báo lỗi nếu có trường bắt buộc bị thiếu
            let errorMessage = '';

            if (missingPersonalFields.length > 0) {
                errorMessage += 'Thiếu thông tin cá nhân: ' + missingPersonalFields.join(', ') + '\n';
            }

            if (missingBankFields.length > 0) {
                errorMessage += 'Thiếu thông tin ngân hàng: ' + missingBankFields.join(', ') + '\n';
            }

            if (missingAddressFields.length > 0) {
                errorMessage += 'Thiếu thông tin địa chỉ: ' + missingAddressFields.join(', ');
            }

            // Nếu có lỗi thiếu thông tin, hiển thị thông báo
            if (errorMessage) {
                this.state.modalTitle = 'Thiếu thông tin';
                this.state.modalMessage = 'Vui lòng điền đầy đủ thông tin trước khi xác thực.\n\n' + errorMessage;
                this.state.showModal = true;
                return;
            }

            // Nếu đã đủ thông tin, hiển thị thông báo hoàn tất
            this.state.modalTitle = 'Xác nhận hoàn tất';
            this.state.modalMessage = 'Bạn đã hoàn tất việc xác thực thông tin. Vui lòng đợi hệ thống xử lý.';
            this.state.showModal = true;

            // Chuyển hướng về trang chủ sau 3 giây
            if (this.state.agreedToTerms) {
                // Call API to complete verification
                fetch('/api/verification/complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert('Có lỗi xảy ra: ' + (data.error || data.message));
                        }
                    })
                    .catch(error => {
                        console.error('Error completing verification:', error);
                        alert('Có lỗi xảy ra khi hoàn tất xác thực.');
                    });
            } else {
                alert("Vui lòng đồng ý với điều khoản sử dụng.");
            }

        } catch (error) {
            console.error('Lỗi khi xác thực:', error);
            this.state.modalTitle = 'Lỗi';
            this.state.modalMessage = 'Có lỗi xảy ra khi xác thực: ' + error.message;
            this.state.showModal = true;
        }
    }

    onBack() {
        window.location.href = '/address_info';
    }

    getCSRFToken() {
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        return csrfToken ? csrfToken.getAttribute('content') : '';
    }

    async loadProfileData() {
        try {
            console.log("🔄 Loading verification profile data from server...");
            const response = await fetch('/data_verification');
            const data = await response.json();
            console.log("📥 Verification profile data received:", data);

            if (data && data.length > 0) {
                this.state.profile = data[0];
                console.log("✅ Verification profile data loaded successfully:", this.state.profile);
            } else {
                console.log("ℹ️ No existing verification profile data found on server");
                this.state.profile = {};
            }
        } catch (error) {
            console.error("❌ Error fetching verification profiles:", error);
            this.state.profile = {};
        }
    }

    closeModal = () => {
        this.state.showModal = false;
    };
}

// Make component globally available
window.VerificationWidget = VerificationWidget;
// console.log('VerificationWidget component loaded and available globally');

// Auto-mount when script is loaded
if (typeof owl !== 'undefined') {
    const widgetContainer = document.getElementById('verificationWidget');
    if (widgetContainer) {
        // console.log('Mounting VerificationWidget');
        owl.mount(VerificationWidget, widgetContainer);
    }
}