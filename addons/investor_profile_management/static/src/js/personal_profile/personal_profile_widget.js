// Personal Profile Widget Component
console.log('Loading PersonalProfileWidget component...');

const { Component, xml, useState, onMounted } = owl;

class PersonalProfileWidget extends Component {
    // Configuration constants
    static CONFIG = {
        FACE_API: {
            VERSION: '0.22.2',
            VLADMANDIC_VERSION: '1.7.14',
            CDN_SOURCES: [
                'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
                'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js',
                'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.js'
            ],
            MODEL_SOURCES: [
                'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model',
                'https://unpkg.com/@vladmandic/face-api@1.7.14/model',
                'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
                'https://unpkg.com/face-api.js@0.22.2/weights'
            ],
            LOCAL_PATHS: [
                '/web/static/lib/face-api/face-api.min.js',
                '/static/lib/face-api/face-api.min.js',
                '/face-api.min.js'
            ],
            TIMEOUTS: {
                SCRIPT_LOAD: 8000,
                MODEL_LOAD: 12000,
                INITIALIZATION: 1000
            }
        },
        DETECTION: {
            INPUT_SIZE: 320,
            SCORE_THRESHOLD: 0.3,
            INTERVAL: 1000,
            PERFECT_FACE_THRESHOLD: 3
        },
        CAPTURE: {
            REQUIREMENTS: {
                front: 3,
                left: 2,
                right: 2
            },
            INSTRUCTIONS: {
                front: 'Nhìn thẳng vào camera và giữ nguyên tư thế',
                left: 'Quay mặt sang trái một góc 45 độ',
                right: 'Quay mặt sang phải một góc 45 độ'
            }
        }
    };

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
                        <a href="/personal_profile" class="nav-item active" data-step="1">
                            <i class="fa fa-user"></i> Thông tin cá nhân
                        </a>
                        <a href="/bank_info" class="nav-item" data-step="2" t-att-class="{'is-completed': state.statusInfo.has_bank_info}">
                            <i class="fa fa-university"></i> TK Ngân hàng
                        </a>
                        <a href="/address_info" class="nav-item" data-step="3" t-att-class="{'is-completed': state.statusInfo.has_address_info}">
                            <i class="fa fa-map-marker"></i> Thông tin địa chỉ
                        </a>
                        <a href="/verification" class="nav-item" data-step="4" t-att-class="{'is-completed': state.statusInfo.ekyc_verified}">
                            <i class="fa fa-shield"></i> Xác thực &amp; eKYC
                        </a>
                    </nav>
                </aside>

                <!-- Main Content -->
                <div class="investor-content">
                    <div class="investor-card">
                        <div class="card-header-styled">
                            <h2>Thông tin cá nhân</h2>
                            <p>Cập nhật thông tin định danh và liên hệ của bạn</p>
                        </div>

                        <form class="investor-form" t-on-submit.prevent="saveProfile">
                            <div class="row">
                                <div class="col-12 mb-4">
                                    <h5 class="text-primary fw-bold mb-3 border-bottom pb-2">1. Thông tin cơ bản</h5>
                                    
                                    <div class="mb-3">
                                        <label for="fullname" class="form-label">Họ &amp; Tên đầy đủ <span class="text-danger">*</span></label>
                                        <input id="fullname" type="text" class="form-control" t-model="state.formData.name" required="required" placeholder="Nhập họ tên đầy đủ" />
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Giới tính <span class="text-danger">*</span></label>
                                        <div class="d-flex gap-3">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="gender" value="male" t-model="state.formData.gender" id="gender_male" />
                                                <label class="form-check-label" for="gender_male">Nam</label>
                                            </div>
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="gender" value="female" t-model="state.formData.gender" id="gender_female" />
                                                <label class="form-check-label" for="gender_female">Nữ</label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="birth_date" class="form-label">Ngày sinh <span class="text-danger">*</span></label>
                                            <input id="birth_date" type="date" t-model="state.formData.birth_date" required="required" class="form-control" />
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="nationality" class="form-label">Quốc tịch <span class="text-danger">*</span></label>
                                            <select id="nationality" t-model="state.formData.nationality" required="required" class="form-select">
                                                <option value="">Chọn quốc tịch</option>
                                                <t t-foreach="state.countries" t-as="country" t-key="country.id">
                                                    <option t-att-value="toString(country.id)"><t t-esc="country.name" /></option>
                                                </t>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="email" class="form-label">Email</label>
                                            <input id="email" type="email" t-model="state.formData.email" class="form-control" placeholder="example@email.com" />
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="phone" class="form-label">Số điện thoại <span class="text-danger">*</span></label>
                                            <input id="phone" type="tel" t-model="state.formData.phone" 
                                                   pattern="[0-9]{10}" 
                                                   title="Số điện thoại phải có đúng 10 chữ số"
                                                   maxlength="10"
                                                   required="required" 
                                                   t-on-input="onPhoneInput"
                                                   class="form-control" placeholder="09xxxxxxxx" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-12">
                                    <h5 class="text-primary fw-bold mb-3 border-bottom pb-2">2. Giấy tờ tùy thân</h5>
                                    
                                    <div class="row">
                                        <div class="col-md-4 mb-3">
                                            <label for="id-type" class="form-label">Loại giấy tờ <span class="text-danger">*</span></label>
                                            <select id="id-type" t-model="state.formData.id_type" required="required" class="form-select">
                                                <option value="id_card">CMND/CCCD</option>
                                                <option value="passport">Hộ chiếu</option>
                                                <option value="other">Khác</option>
                                            </select>
                                        </div>
                                        <div class="col-md-8 mb-3">
                                            <label for="id-number" class="form-label">Số hiệu giấy tờ <span class="text-danger">*</span></label>
                                            <input id="id-number" type="text" t-model="state.formData.id_number" required="required" class="form-control" />
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="id_issue_date" class="form-label">Ngày cấp <span class="text-danger">*</span></label>
                                            <input id="id_issue_date" type="date" t-model="state.formData.id_issue_date" required="required" class="form-control" />
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="id_issue_place" class="form-label">Nơi cấp <span class="text-danger">*</span></label>
                                            <input id="id_issue_place" type="text" t-model="state.formData.id_issue_place" required="required" class="form-control" />
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Hình ảnh giấy tờ (Mặt trước &amp; Mặt sau) <span class="text-danger">*</span></label>
                                        <div class="row g-3">
                                            <!-- Front Image -->
                                            <div class="col-md-6">
                                                <label class="ekyc-upload-area h-100 d-flex flex-column justify-content-center align-items-center">
                                                    <input type="file" accept="image/*" style="display:none;" t-on-change="onEkycFront" />
                                                    
                                                    <t t-if="!state.ekycFiles.frontPreview and !state.ocrLoading.front">
                                                        <i class="fa fa-id-card upload-icon"></i>
                                                        <h4 class="fs-6 fw-bold">Mặt trước</h4>
                                                        <p class="mb-0">Nhấn để tải ảnh lên</p>
                                                    </t>
                                                    
                                                    <t t-if="state.ocrLoading.front">
                                                        <div class="spinner-border text-primary" role="status"></div>
                                                        <div class="mt-2 text-primary small">Đang xử lý...</div>
                                                    </t>
                                                    
                                                    <t t-if="state.ekycFiles.frontPreview and !state.ocrLoading.front">
                                                        <img t-att-src="state.ekycFiles.frontPreview" class="img-fluid rounded mb-2" style="max-height: 150px;" />
                                                        <button type="button" class="btn btn-sm btn-outline-danger w-auto" t-on-click.stop="removeFrontImage">
                                                            <i class="fa fa-trash"></i> Xóa
                                                        </button>
                                                    </t>
                                                </label>
                                            </div>
                                            
                                            <!-- Back Image -->
                                            <div class="col-md-6">
                                                <label class="ekyc-upload-area h-100 d-flex flex-column justify-content-center align-items-center">
                                                    <input type="file" accept="image/*" style="display:none;" t-on-change="onEkycBack" />
                                                    
                                                    <t t-if="!state.ekycFiles.backPreview and !state.ocrLoading.back">
                                                        <i class="fa fa-id-card upload-icon"></i>
                                                        <h4 class="fs-6 fw-bold">Mặt sau</h4>
                                                        <p class="mb-0">Nhấn để tải ảnh lên</p>
                                                    </t>
                                                    
                                                    <t t-if="state.ocrLoading.back">
                                                        <div class="spinner-border text-primary" role="status"></div>
                                                        <div class="mt-2 text-primary small">Đang xử lý...</div>
                                                    </t>
                                                    
                                                    <t t-if="state.ekycFiles.backPreview and !state.ocrLoading.back">
                                                        <img t-att-src="state.ekycFiles.backPreview" class="img-fluid rounded mb-2" style="max-height: 150px;" />
                                                        <button type="button" class="btn btn-sm btn-outline-danger w-auto" t-on-click.stop="removeBackImage">
                                                            <i class="fa fa-trash"></i> Xóa
                                                        </button>
                                                    </t>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                     <div class="d-flex align-items-center gap-3 mb-4">
                                        <button type="button" class="btn btn-ekyc" t-att-class="{'is-verified': state.statusInfo.ekyc_verified}" t-on-click="startEkycVerification" t-att-disabled="state.ekycLoading">
                                            <i class="fa fa-camera"></i> Xác thực eKYC
                                        </button>
                                        <div t-if="state.ekycLoading" class="text-primary small"><i class="fa fa-spinner fa-spin"></i> Đang xác thực...</div>
                                        <div t-if="state.ekycError" class="text-danger small"><t t-esc="state.ekycError" /></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="d-flex justify-content-end pt-3 border-top">
                                <button type="submit" class="btn btn-primary-investor px-5">
                                    <i class="fa fa-save me-2"></i> Lưu Thông Tin
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- eKYC Camera Modal -->
        <div t-if="state.showEkycModal" class="modal fade show d-block" tabindex="-1" style="background:linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(20,20,30,0.95) 100%); backdrop-filter: blur(10px); z-index: 9999;">
          <style>
            .ekyc-modal-content {
              background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(249,115,22,0.2);
              overflow: hidden;
            }
            
            .ekyc-modal-header {
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              border: none;
              padding: 20px 30px;
              color: white;
            }
            
            .ekyc-modal-title {
              font-size: 1.5rem;
              font-weight: 700;
              display: flex;
              align-items: center;
              gap: 12px;
              margin: 0;
            }
            
            .ekyc-modal-title i {
              font-size: 1.8rem;
              animation: cameraPulse 2s infinite;
            }
            
            @keyframes cameraPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.9; }
            }
            
            .ekyc-modal-body {
              padding: 30px;
              background: linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%);
            }
            
            .camera-container {
              position: relative;
              display: inline-block;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2), 0 0 0 4px rgba(249,115,22,0.1);
              background: #000;
              padding: 8px;
            }
            
            #ekycVideoPreview {
              width: 100%;
              max-width: 600px;
              height: auto;
              border-radius: 15px;
              display: block;
              background: #000;
              box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
            }
            
            .face-frame-main {
              animation: faceFramePulse 2s infinite ease-in-out;
            }
            
            @keyframes faceFramePulse {
              0%, 100% { 
                transform: scale(1);
                opacity: 0.9;
              }
              50% { 
                transform: scale(1.03);
                opacity: 1;
              }
            }
            
            .face-frame-overlay {
              filter: drop-shadow(0 0 20px rgba(249,115,22,0.4));
            }
            
            .progress-ring {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
            
            .progress-ring-svg {
              transform: rotate(-90deg);
              filter: drop-shadow(0 0 8px rgba(249,115,22,0.6));
            }
            
            .progress-ring-bg {
              stroke: rgba(255, 255, 255, 0.2);
              stroke-width: 5;
              fill: none;
            }
            
            .progress-ring-fill {
              stroke: #f97316;
              stroke-linecap: round;
              stroke-width: 5;
              fill: none;
              filter: drop-shadow(0 0 6px rgba(249,115,22,0.8));
              transition: stroke-dashoffset 0.3s ease;
            }
            
            .camera-status {
              background: linear-gradient(135deg, rgba(249,115,22,0.95) 0%, rgba(234,88,12,0.95) 100%);
              backdrop-filter: blur(10px);
              padding: 12px 24px;
              border-radius: 25px;
              font-size: 14px;
              font-weight: 600;
              box-shadow: 0 4px 15px rgba(249,115,22,0.4);
              border: 2px solid rgba(255,255,255,0.3);
              animation: statusSlideIn 0.5s ease-out;
            }
            
            @keyframes statusSlideIn {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }
            
            .camera-instructions {
              background: linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(20,20,30,0.9) 100%);
              backdrop-filter: blur(10px);
              padding: 14px 28px;
              border-radius: 25px;
              font-size: 15px;
              font-weight: 600;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
              border: 2px solid rgba(249,115,22,0.3);
              animation: instructionsSlideUp 0.5s ease-out;
            }
            
            @keyframes instructionsSlideUp {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }
            
            .camera-instructions i {
              color: #f97316;
              animation: iconBounce 2s infinite;
            }
            
            @keyframes iconBounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
            
            .camera-error-alert {
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              border: 2px solid #ef4444;
              border-radius: 15px;
              padding: 20px;
              box-shadow: 0 4px 15px rgba(239,68,68,0.2);
            }
            
            .processing-spinner {
              width: 60px;
              height: 60px;
              border-width: 5px;
              border-color: #f97316;
              border-right-color: transparent;
              animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            
            .ekyc-result-success {
              background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
              border: 2px solid #10b981;
              border-radius: 15px;
              padding: 20px;
              box-shadow: 0 4px 15px rgba(16,185,129,0.2);
            }
            
            .ekyc-result-error {
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              border: 2px solid #ef4444;
              border-radius: 15px;
              padding: 20px;
              box-shadow: 0 4px 15px rgba(239,68,68,0.2);
            }
            
            .btn-ekyc-primary {
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              border: none;
              color: white;
              font-weight: 600;
              padding: 12px 28px;
              border-radius: 12px;
              box-shadow: 0 4px 15px rgba(249,115,22,0.4);
              transition: all 0.3s ease;
            }
            
            .btn-ekyc-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(249,115,22,0.5);
            }
            
            .btn-ekyc-primary:active {
              transform: translateY(0);
            }
          </style>
          <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content ekyc-modal-content">
              <div class="modal-header ekyc-modal-header">
                <h5 class="modal-title ekyc-modal-title">
                  <i class="fas fa-camera"></i> Xác thực eKYC
                </h5>
                <button type="button" class="btn-close btn-close-white" t-on-click="closeEkycModal" style="opacity: 0.9;"></button>
              </div>
              <div class="modal-body ekyc-modal-body text-center">
                <!-- Camera Preview -->
                <div class="camera-container mb-4">
                  <video id="ekycVideoPreview" autoplay="autoplay" muted="muted" 
                         t-att-class="state.cameraActive ? 'd-block' : 'd-none'">
                  </video>
                  
                  <!-- Circular Face Frame Overlay -->
                  <div t-if="state.cameraActive" 
                       class="face-frame-overlay position-absolute"
                       style="top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; pointer-events: none; z-index: 10;">
                    
                    <!-- Main Circular Face Frame -->
                    <div class="face-frame-main" t-att-style="getFaceFrameStyle()">
                      <!-- Progress Ring -->
                      <div class="progress-ring" t-att-style="getProgressRingStyle()">
                        <svg class="progress-ring-svg" width="300" height="300">
                          <circle class="progress-ring-bg" cx="150" cy="150" r="140" stroke-width="4" fill="none"/>
                          <circle class="progress-ring-fill" cx="150" cy="150" r="140" stroke-width="4" fill="none" 
                                  t-att-style="getProgressRingFillStyle()"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Camera Status -->
                  <div t-if="state.cameraActive" 
                       class="camera-status position-absolute text-center text-white fw-bold"
                       style="top: 25px; left: 50%; transform: translateX(-50%); z-index: 15;">
                    <i class="fas fa-camera me-2"></i>
                    <t t-esc="state.cameraStatus" />
                  </div>
                  
                  <!-- Camera Instructions -->
                  <div t-if="state.cameraActive" 
                       class="camera-instructions position-absolute text-center text-white fw-bold"
                       style="bottom: 25px; left: 50%; transform: translateX(-50%); z-index: 15;">
                    <i class="fas fa-user-circle me-2"></i>
                    <t t-esc="state.cameraInstructions" />
                  </div>
                  
                  <!-- Camera Error -->
                  <div t-if="state.cameraError" class="camera-error-alert mt-3">
                    <div class="d-flex align-items-start">
                      <i class="fas fa-exclamation-triangle me-3 mt-1" style="color: #ef4444; font-size: 1.5rem;"></i>
                      <div class="flex-grow-1 text-start">
                        <strong style="color: #dc2626; font-size: 1.1rem;">Lỗi truy cập camera:</strong>
                        <div style="white-space: pre-line; margin-top: 10px; color: #991b1b; line-height: 1.6;"><t t-esc="state.cameraError" /></div>
                      </div>
                    </div>
                    <div class="mt-4 d-flex gap-3 justify-content-center">
                      <button type="button" class="btn btn-ekyc-primary" t-on-click="initCamera">
                        <i class="fas fa-redo me-2"></i> Thử lại
                      </button>
                      <button type="button" class="btn btn-secondary" style="padding: 12px 28px; border-radius: 12px; font-weight: 600;" t-on-click="closeEkycModal">
                        <i class="fas fa-times me-2"></i> Đóng
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Progress Display - Hidden -->
                <!-- <div class="progress-container mt-3">
                  <div class="progress-text">
                    <strong>Tiến độ chụp ảnh:</strong>
                  </div>
                  <div class="row text-center mt-2">
                    <div class="col-4">
                      <div class="progress-step" t-att-class="getProgressStepClass('front')">
                        <div class="step-dot"></div>
                        <div class="progress-text small mt-1">Chỉnh diện</div>
                        <div class="progress-percentage">
                          <t t-esc="getCapturedCount('front')" />/<t t-esc="state.captureRequirements.front" />
                        </div>
                      </div>
                    </div>
                    <div class="col-4">
                      <div class="progress-step" t-att-class="getProgressStepClass('left')">
                        <div class="step-dot"></div>
                        <div class="progress-text small mt-1">Góc trái</div>
                        <div class="progress-percentage">
                          <t t-esc="getCapturedCount('left')" />/<t t-esc="state.captureRequirements.left" />
                        </div>
                      </div>
                    </div>
                    <div class="col-4">
                      <div class="progress-step" t-att-class="getProgressStepClass('right')">
                        <div class="step-dot"></div>
                        <div class="progress-text small mt-1">Góc phải</div>
                        <div class="progress-percentage">
                          <t t-esc="getCapturedCount('right')" />/<t t-esc="state.captureRequirements.right" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div> -->
                
                <!-- Captured Images Summary - Hidden -->
                <!-- <div class="mt-3">
                  <div class="row text-center">
                    <div class="col-4">
                      <div class="small text-white">
                        <i class="fas fa-user-circle"></i> Chỉnh diện: <t t-esc="getCapturedCount('front')" />/<t t-esc="state.captureRequirements.front" />
                      </div>
                    </div>
                    <div class="col-4">
                      <div class="small text-white">
                        <i class="fas fa-arrow-left"></i> Góc trái: <t t-esc="getCapturedCount('left')" />/<t t-esc="state.captureRequirements.left" />
                      </div>
                    </div>
                    <div class="col-4">
                      <div class="small text-white">
                        <i class="fas fa-arrow-right"></i> Góc phải: <t t-esc="getCapturedCount('right')" />/<t t-esc="state.captureRequirements.right" />
                      </div>
                    </div>
                  </div>
                </div> -->
                
                <!-- Camera Controls - Hidden -->
                <!-- <div class="camera-controls d-flex justify-content-center mt-4">
                  <div class="d-flex gap-4">
                    <button t-if="!state.cameraActive and !state.cameraError" 
                            type="button" 
                            class="btn btn-primary px-4 py-2" 
                            t-on-click="initCamera">
                      <i class="fas fa-camera me-2"></i> Kích hoạt Camera
                    </button>
                    <button type="button" class="btn px-4 py-2" style="background-color:#f97316;border-color:#f97316;color:white" 
                            t-on-click="processEkycVerification" 
                            t-att-disabled="!isAllImagesCaptured() or state.isProcessing">
                      <i class="fas fa-check me-2"></i> Xác thực eKYC
                    </button>
                  </div>
                </div> -->
                
                <!-- Current Phase Indicator - Hidden -->
                <!-- <div class="mt-3">
                  <div class="alert alert-info text-center">
                    <i class="fas fa-camera"></i>
                    <strong>Đang chụp: </strong>
                    <span t-if="state.currentCapturePhase === 'front'">
                      <i class="fas fa-user-circle"></i> Chỉnh diện
                    </span>
                    <span t-elif="state.currentCapturePhase === 'left'">
                      <i class="fas fa-arrow-left"></i> Góc trái
                    </span>
                    <span t-elif="state.currentCapturePhase === 'right'">
                      <i class="fas fa-arrow-right"></i> Góc phải
                    </span>
                  </div>
                </div> -->
                
                <!-- Processing Status -->
                <div t-if="state.isProcessing" class="mt-4">
                  <div class="processing-spinner spinner-border mx-auto" role="status">
                    <span class="visually-hidden">Đang xử lý...</span>
                  </div>
                  <p class="mt-3 fw-semibold" style="color: #f97316; font-size: 1.1rem;">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Đang xác thực thông tin eKYC...
                  </p>
                  <p class="text-muted small mt-2">Vui lòng đợi trong giây lát</p>
                </div>
                
                <!-- eKYC Result Display -->
                <div t-if="state.ekycResult" class="mt-4">
                  <div t-if="state.ekycResult.success" class="ekyc-result-success">
                    <div class="mb-3">
                      <i class="fas fa-check-circle" style="font-size: 3rem; color: #10b981;"></i>
                    </div>
                    <h5 class="fw-bold mb-3" style="color: #047857;">Xác thực eKYC thành công!</h5>
                    <p class="mb-2" style="color: #065f46;">Thông tin đã được cập nhật tự động vào form.</p>
                    <p class="mb-0" style="color: #065f46;">
                      <i class="fas fa-check-circle me-2"></i> 
                      <strong>Bạn có thể tiếp tục hoàn thiện thông tin cá nhân.</strong>
                    </p>
                  </div>
                  <div t-if="!state.ekycResult.success" class="ekyc-result-error">
                    <div class="mb-3">
                      <i class="fas fa-times-circle" style="font-size: 3rem; color: #ef4444;"></i>
                    </div>
                    <h5 class="fw-bold mb-3" style="color: #dc2626;">Xác thực eKYC thất bại!</h5>
                    <p class="mb-3" style="color: #991b1b; line-height: 1.6;" t-esc="state.ekycResult.error" />
                    <div class="mt-4">
                      <button type="button" class="btn btn-ekyc-primary" t-on-click="resetEkycVerification">
                        <i class="fas fa-redo me-2"></i> Xác thực lại
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Success/Error Modal -->
        <div t-if="state.showModal" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5);">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="border:2px solid #f97316;">
              <div class="modal-header" style="border-bottom:1px solid #f97316;">
                <h5 class="modal-title" style="color:#f97316;"><t t-esc="state.modalTitle" /></h5>
                <button type="button" class="btn-close" t-on-click="closeModal"></button>
              </div>
              <div class="modal-body" t-att-class="state.modalTitle === 'Thành công' ? 'text-center' : ''">
                <t t-if="state.modalTitle === 'Thành công'">
                  <div style="font-size:3rem;color:#43a047;margin-bottom:20px;">
                    <i class="fa fa-check-circle"></i>
                  </div>
                </t>
                <div t-raw="state.modalMessage" class="mt-3"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn" style="background-color:#f97316;border-color:#f97316;color:white" t-on-click="closeModal">Đóng</button>
              </div>
            </div>
          </div>
        </div>
    `;

    setup() {
        console.log("🎯 PersonalProfileWidget - setup called!");

        this.state = useState({
            loading: true,
            profile: {},
            statusInfo: {},
            countries: [],
            formData: {
                name: '',
                gender: '',
                birth_date: '',
                nationality: '',
                email: '',
                phone: '',
                id_type: 'id_card',
                id_number: '',
                id_issue_date: '',
                id_issue_place: ''
            },
            activeTab: 'personal',
            ekycFiles: {
                front: null,
                back: null,
                frontPreview: null,
                backPreview: null
            },
            ekycLoading: false,
            ekycError: '',
            showModal: false,
            modalTitle: '',
            modalMessage: '',
            // eKYC Camera states
            showEkycModal: false,
            cameraActive: false,
            cameraError: '',
            cameraStatus: 'Đang khởi tạo...',
            cameraInstructions: 'Vui lòng đặt khuôn mặt vào đúng vi trí!',
            capturedImages: [],
            capturedImageTypes: [], // Track what type of image was captured
            isProcessing: false,
            _mediaStream: null,
            faceStatus: null,
            autoCaptureEnabled: true,
            autoCaptureInterval: null,
            lastCaptureTime: 0,
            perfectFaceStartTime: 0, // Track when face becomes perfect
            ekycResult: null,
            currentCapturePhase: 'front', // 'front', 'left', 'right'
            captureRequirements: {
                front: 3,  // 3 ảnh chỉnh diện
                left: 2,   // 2 ảnh góc trái
                right: 2   // 2 ảnh góc phải
            },
            // OCR Loading states
            ocrLoading: {
                front: false,
                back: false
            }
        });

        onMounted(async () => {
            // Hide loading spinner
            const loadingSpinner = document.getElementById('loadingSpinner');
            const widgetContainer = document.getElementById('personalProfileWidget');

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
                // Reset formData và preview ảnh/video
                Object.assign(this.state.formData, {
                    name: '',
                    gender: 'male',
                    birth_date: '',
                    nationality: '',
                    email: '',
                    phone: '',
                    id_type: 'id_card',
                    id_number: '',
                    id_issue_date: '',
                    id_issue_place: ''
                });
                this.state.ekycFiles.front = null;
                this.state.ekycFiles.back = null;
                this.state.ekycFiles.frontPreview = null;
                this.state.ekycFiles.backPreview = null;
            }

            // Load countries, profile data and status info
            await Promise.all([
                this.loadCountries(),
                this.loadProfileData()
            ]);
            this.loadInitialFormData(); // Load form data after profile is loaded
            await this.loadStatusInfo();

            this.state.loading = false;
        });
    }

    loadInitialFormData() {
        // Ưu tiên lấy từ sessionStorage
        const storedData = sessionStorage.getItem('personalProfileData');
        if (storedData) {
            const parsedData = JSON.parse(storedData);

            // Check if this is fresh eKYC data (has OCR fields and CCCD images)
            const isEkycData = parsedData.name && parsedData.id_number && (parsedData.frontPreviewBase64 || parsedData.backPreviewBase64);

            if (isEkycData) {
                console.log("🔄 Fresh eKYC data detected, applying OCR data to form");

                // Apply OCR data to form
                this.state.formData.name = parsedData.name || '';
                this.state.formData.gender = parsedData.gender || 'male';
                this.state.formData.birth_date = parsedData.birth_date || '';
                this.state.formData.nationality = parsedData.nationality ? String(parsedData.nationality) : '';
                this.state.formData.id_type = parsedData.id_type || 'id_card';
                this.state.formData.id_number = parsedData.id_number || '';
                this.state.formData.id_issue_date = parsedData.id_issue_date || '';
                this.state.formData.id_issue_place = parsedData.id_issue_place || '';

                // Load CCCD images from eKYC và convert thành File objects để lưu thực sự
                if (parsedData.frontPreviewBase64) {
                    this.state.ekycFiles.frontPreview = parsedData.frontPreviewBase64;
                    // Convert base64 thành File object để có thể lưu vào database
                    this.state.ekycFiles.front = this.base64ToFile(parsedData.frontPreviewBase64, 'cccd_front.jpg');
                    console.log("✅ Front CCCD converted to File object for saving");
                }
                if (parsedData.backPreviewBase64) {
                    this.state.ekycFiles.backPreview = parsedData.backPreviewBase64;
                    // Convert base64 thành File object để có thể lưu vào database
                    this.state.ekycFiles.back = this.base64ToFile(parsedData.backPreviewBase64, 'cccd_back.jpg');
                    console.log("✅ Back CCCD converted to File object for saving");
                }

                // Keep existing email and phone if available, or set defaults
                if (this.state.profile && Object.keys(this.state.profile).length > 0) {
                    this.state.formData.email = this.state.profile.email || parsedData.email || '';
                    this.state.formData.phone = this.state.profile.phone || parsedData.phone || '';
                } else {
                    // Set default values if no existing profile
                    this.state.formData.email = parsedData.email || '';
                    this.state.formData.phone = parsedData.phone || '';
                }

                // Show success message

                console.log("✅ eKYC OCR data and CCCD images applied to form:", this.state.formData);
            } else {
                // Regular session storage data (with preview images)
                if (parsedData.nationality && typeof parsedData.nationality === 'number') {
                    parsedData.nationality = String(parsedData.nationality);
                }
                Object.assign(this.state.formData, parsedData);

                // If có preview base64 thì tạo lại preview
                if (parsedData.frontPreviewBase64) {
                    this.state.ekycFiles.frontPreview = parsedData.frontPreviewBase64;
                }
                if (parsedData.backPreviewBase64) {
                    this.state.ekycFiles.backPreview = parsedData.backPreviewBase64;
                }
                console.log("✅ Form data loaded from sessionStorage:", this.state.formData);
            }
        } else if (this.state.profile && Object.keys(this.state.profile).length > 0) {
            this.state.formData.name = this.state.profile.name || '';
            this.state.formData.gender = this.state.profile.gender || 'male';
            this.state.formData.email = this.state.profile.email || '';
            this.state.formData.phone = this.state.profile.phone || '';
            this.state.formData.id_type = this.state.profile.id_type || 'id_card';
            this.state.formData.id_number = this.state.profile.id_number || '';
            this.state.formData.id_issue_date = this.state.profile.id_issue_date || '';
            this.state.formData.id_issue_place = this.state.profile.id_issue_place || '';
            this.state.formData.birth_date = this.state.profile.birth_date || '';
            this.state.formData.nationality = this.state.profile.nationality ? Number(this.state.profile.nationality) : '';

            // Load CCCD images từ database nếu có
            console.log("🔍 Checking for CCCD images in profile:", this.state.profile);

            if (this.state.profile.id_front && this.state.profile.id_front !== '') {
                this.state.ekycFiles.frontPreview = this.state.profile.id_front;
                console.log("✅ Front CCCD loaded from database:", this.state.profile.id_front);

                // Convert URL images thành File objects để có thể save lại
                this.loadImageAsFile(this.state.profile.id_front, 'front');
            } else {
                console.log("ℹ️ No front CCCD image found in database");
            }

            if (this.state.profile.id_back && this.state.profile.id_back !== '') {
                this.state.ekycFiles.backPreview = this.state.profile.id_back;
                console.log("✅ Back CCCD loaded from database:", this.state.profile.id_back);

                // Convert URL images thành File objects để có thể save lại
                this.loadImageAsFile(this.state.profile.id_back, 'back');
            } else {
                console.log("ℹ️ No back CCCD image found in database");
            }

            console.log("✅ Form data initialized with existing profile data:", this.state.formData);
        } else {
            console.log("ℹ️ No existing profile data found, using default values");
        }
    }

    showEkycSuccessMessage() {
        // Show success message for eKYC data
        this.state.modalTitle = 'Thành công';
        this.state.modalMessage = 'Thông tin từ CCCD đã được tự động điền vào form thông tin cá nhân và địa chỉ. Vui lòng kiểm tra và lưu thông tin.';
        this.state.showModal = true;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.state.showModal = false;
        }, 5000);
    }

    async loadCountries() {
        try {
            const response = await fetch('/get_countries');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No countries data received');
            }

            this.state.countries = data;

            // Create a mapping for quick lookup
            this.state.countryMapping = {};
            data.forEach(country => {
                this.state.countryMapping[String(country.id)] = country.name;
                // Also add common variations
                const name = country.name.toLowerCase();
                this.state.countryMapping[name] = String(country.id);
                this.state.countryMapping[country.name] = String(country.id);
            });

        } catch (error) {
            console.error("❌ Error fetching countries:", error);

            // Create fallback countries array
            this.state.countries = [
                { id: '241', name: 'Vietnam', code: 'VN' },
                { id: '233', name: 'USA', code: 'US' },
                { id: '231', name: 'UK', code: 'GB' },
                { id: '113', name: 'Japan', code: 'JP' },
                { id: '48', name: 'China', code: 'CN' },
                { id: '121', name: 'South Korea', code: 'KR' },
                { id: '197', name: 'Singapore', code: 'SG' },
                { id: '217', name: 'Thailand', code: 'TH' },
                { id: '132', name: 'Malaysia', code: 'MY' },
                { id: '103', name: 'Indonesia', code: 'ID' },
                { id: '174', name: 'Philippines', code: 'PH' },
                { id: '14', name: 'Australia', code: 'AU' },
                { id: '39', name: 'Canada', code: 'CA' },
                { id: '82', name: 'Germany', code: 'DE' },
                { id: '75', name: 'France', code: 'FR' },
                { id: '107', name: 'Italy', code: 'IT' },
                { id: '195', name: 'Spain', code: 'ES' },
                { id: '156', name: 'Netherlands', code: 'NL' },
                { id: '207', name: 'Switzerland', code: 'CH' },
                { id: '203', name: 'Sweden', code: 'SE' }
            ];

            // Fallback mapping with common countries
            this.state.countryMapping = {
                // Vietnam
                '241': 'Vietnam', 'vietnam': '241', 'việt nam': '241', 'vn': '241', 'viet nam': '241',
                'cộng hòa xã hội chủ nghĩa việt nam': '241', 'chxhcn việt nam': '241',

                // USA
                '233': 'USA', 'usa': '233', 'united states': '233', 'us': '233', 'hoa kỳ': '233', 'mỹ': '233',
                'united states of america': '233', 'america': '233',

                // UK
                '231': 'UK', 'uk': '231', 'united kingdom': '231', 'england': '231', 'anh': '231',
                'great britain': '231', 'britain': '231',

                // Japan
                '113': 'Japan', 'japan': '113', 'jp': '113', 'nhật bản': '113', 'japanese': '113',

                // China
                '48': 'China', 'china': '48', 'cn': '48', 'trung quốc': '48', 'chinese': '48',

                // Korea
                '121': 'South Korea', 'south korea': '121', 'korea': '121', 'kr': '121', 'hàn quốc': '121',

                // Singapore
                '197': 'Singapore', 'singapore': '197', 'sg': '197',

                // Thailand
                '217': 'Thailand', 'thailand': '217', 'th': '217', 'thái lan': '217',

                // Malaysia
                '132': 'Malaysia', 'malaysia': '132', 'my': '132',

                // Indonesia
                '103': 'Indonesia', 'indonesia': '103', 'id': '103',

                // Philippines
                '174': 'Philippines', 'philippines': '174', 'ph': '174',

                // Australia
                '14': 'Australia', 'australia': '14', 'au': '14',

                // Canada
                '39': 'Canada', 'canada': '39', 'ca': '39',

                // Germany
                '82': 'Germany', 'germany': '82', 'de': '82', 'đức': '82',

                // France
                '75': 'France', 'france': '75', 'fr': '75', 'pháp': '75',

                // Italy
                '107': 'Italy', 'italy': '107', 'it': '107', 'ý': '107',

                // Spain
                '195': 'Spain', 'spain': '195', 'es': '195', 'tây ban nha': '195',

                // Netherlands
                '156': 'Netherlands', 'netherlands': '156', 'nl': '156', 'hà lan': '156',

                // Switzerland
                '207': 'Switzerland', 'switzerland': '207', 'ch': '207', 'thụy sĩ': '207',

                // Sweden
                '203': 'Sweden', 'sweden': '203', 'se': '203', 'thụy điển': '203'
            };
        }
    }

    async loadStatusInfo() {
        try {
            const response = await fetch('/get_status_info');
            const data = await response.json();
            console.log("📥 Status info data:", data);

            if (data && data.length > 0) {
                this.state.statusInfo = data[0];
                console.log("✅ Status info loaded:", this.state.statusInfo);
            } else {
                console.log("ℹ️ No status info found");
            }
        } catch (error) {
            console.error("❌ Error fetching status info:", error);
        }
    }

    // Thêm hàm chuyển file sang base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Thêm hàm chuyển base64 thành File object
    base64ToFile(base64String, filename) {
        try {
            // Extract the base64 data and mime type
            const arr = base64String.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);

            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }

            return new File([u8arr], filename, { type: mime });
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    }

    // Thêm hàm load image từ URL thành File object  
    async loadImageAsFile(imageUrl, side) {
        try {
            console.log(`🔄 Loading ${side} CCCD image from URL:`, imageUrl);

            // Kiểm tra URL hợp lệ
            const isWebImage = imageUrl && imageUrl.startsWith('/web/image');
            const isDiskImage = imageUrl && imageUrl.startsWith('/id_images/');
            if (!imageUrl || imageUrl === '' || (!isWebImage && !isDiskImage)) {
                console.log(`⚠️ Invalid URL for ${side} CCCD image:`, imageUrl);
                return;
            }

            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            if (blob.size === 0) {
                throw new Error('Image blob is empty');
            }

            const filename = `cccd_${side}.jpg`;
            const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

            if (side === 'front') {
                this.state.ekycFiles.front = file;
                console.log(`✅ Front CCCD image converted to File object:`, file.name, `(${file.size} bytes)`);
            } else if (side === 'back') {
                this.state.ekycFiles.back = file;
                console.log(`✅ Back CCCD image converted to File object:`, file.name, `(${file.size} bytes)`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${side} CCCD image:`, error);
            // Không set file nếu có lỗi, để user có thể upload lại
        }
    }

    // Thêm hàm convert URL thành base64
    async urlToBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error converting URL to base64:', error);
            return '';
        }
    }

    async saveProfile() {
        try {
            const profileData = { ...this.state.formData };
            // Đảm bảo nationality là số nguyên ID
            if (!profileData.nationality || isNaN(profileData.nationality) || Number(profileData.nationality) <= 0) {
                this.state.modalTitle = 'Lỗi';
                this.state.modalMessage = 'Bạn chưa chọn quốc tịch!';
                this.state.showModal = true;
                return;
            }

            // Kiểm tra số điện thoại phải có đúng 10 chữ số
            if (profileData.phone) {
                const phoneDigits = profileData.phone.replace(/[^0-9]/g, '');
                if (phoneDigits.length !== 10) {
                    this.state.modalTitle = 'Lỗi';
                    this.state.modalMessage = 'Số điện thoại phải có đúng 10 chữ số!';
                    this.state.showModal = true;
                    return;
                }
                // Cập nhật phone với chỉ số
                profileData.phone = phoneDigits;
            }
            // Ràng buộc phải có ảnh mặt trước, mặt sau CCCD (từ eKYC, upload, hoặc database)
            const hasFrontImage = this.state.ekycFiles.front || this.state.ekycFiles.frontPreview;
            const hasBackImage = this.state.ekycFiles.back || this.state.ekycFiles.backPreview;

            if (!hasFrontImage || !hasBackImage) {
                this.state.modalTitle = 'Lỗi';
                this.state.modalMessage = 'Bạn phải có đủ ảnh mặt trước và mặt sau CCCD! Vui lòng thực hiện eKYC hoặc upload ảnh CCCD.';
                this.state.showModal = true;
                return;
            }
            profileData.nationality = Number(profileData.nationality);
            // Convert images sang base64 cho việc lưu
            if (this.state.ekycFiles.front) {
                profileData.frontPreviewBase64 = await this.fileToBase64(this.state.ekycFiles.front);
                console.log("✅ Front CCCD File object converted to base64 for saving");
            } else if (this.state.ekycFiles.frontPreview && this.state.ekycFiles.frontPreview.startsWith('data:')) {
                profileData.frontPreviewBase64 = this.state.ekycFiles.frontPreview;
                console.log("✅ Front CCCD base64 data ready for saving");
            } else if (this.state.ekycFiles.frontPreview && (this.state.ekycFiles.frontPreview.startsWith('/web/image') || this.state.ekycFiles.frontPreview.startsWith('/id_images/'))) {
                // Image từ database - convert URL sang base64
                profileData.frontPreviewBase64 = await this.urlToBase64(this.state.ekycFiles.frontPreview);
                console.log("✅ Front CCCD URL converted to base64 for saving");
            } else {
                profileData.frontPreviewBase64 = '';
            }

            if (this.state.ekycFiles.back) {
                profileData.backPreviewBase64 = await this.fileToBase64(this.state.ekycFiles.back);
                console.log("✅ Back CCCD File object converted to base64 for saving");
            } else if (this.state.ekycFiles.backPreview && this.state.ekycFiles.backPreview.startsWith('data:')) {
                profileData.backPreviewBase64 = this.state.ekycFiles.backPreview;
                console.log("✅ Back CCCD base64 data ready for saving");
            } else if (this.state.ekycFiles.backPreview && (this.state.ekycFiles.backPreview.startsWith('/web/image') || this.state.ekycFiles.backPreview.startsWith('/id_images/'))) {
                // Image từ database - convert URL sang base64
                profileData.backPreviewBase64 = await this.urlToBase64(this.state.ekycFiles.backPreview);
                console.log("✅ Back CCCD URL converted to base64 for saving");
            } else {
                profileData.backPreviewBase64 = '';
            }

            console.log("📤 Sending profile data with CCCD images:", {
                hasfront: !!profileData.frontPreviewBase64,
                hasBack: !!profileData.backPreviewBase64,
                frontSize: profileData.frontPreviewBase64 ? `${profileData.frontPreviewBase64.length} chars` : '0',
                backSize: profileData.backPreviewBase64 ? `${profileData.backPreviewBase64.length} chars` : '0'
            });

            // Gửi dữ liệu lên Odoo
            const response = await fetch('/save_personal_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            const result = await response.json();
            if (response.ok && result.success) {
                sessionStorage.setItem('personalProfileData', JSON.stringify(profileData));
                sessionStorage.setItem('personalProfileUserId', String(window.currentUserId || ''));

                // Reload profile data để đảm bảo ảnh được hiển thị
                console.log("🔄 Reloading profile data after successful save...");
                await this.loadProfileData();
                this.loadInitialFormData();

                this.state.modalTitle = 'Thành công';
                this.state.modalMessage = 'Lưu Thông Tin cá nhân thành công!';
                this.state.showModal = true;
                setTimeout(() => { window.location.href = '/bank_info'; }, 1500);
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

    async loadProfileData() {
        try {
            console.log("🔄 Loading profile data from server...");
            const response = await fetch('/data_personal_profile');
            const data = await response.json();
            console.log("📥 Personal profile data received:", data);

            if (data && data.length > 0) {
                this.state.profile = data[0];
                console.log("✅ Profile data loaded successfully:", this.state.profile);
            } else {
                console.log("ℹ️ No existing profile data found on server");
                this.state.profile = {};
            }
        } catch (error) {
            console.error("❌ Error fetching personal profile data:", error);
            this.state.profile = {};
        }
    }

    onUploadIdFront(ev) {
        const file = ev.target.files[0];
        if (file) {
            this.uploadIdImage(file, 'front');
        }
    }

    onUploadIdBack(ev) {
        const file = ev.target.files[0];
        if (file) {
            this.uploadIdImage(file, 'back');
        }
    }

    onPhoneInput(ev) {
        // Chỉ cho phép nhập số và giới hạn 10 ký tự
        let value = ev.target.value.replace(/[^0-9]/g, '');
        if (value.length > 10) {
            value = value.substring(0, 10);
        }
        this.state.formData.phone = value;
        ev.target.value = value;
    }

    async uploadIdImage(file, side) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('side', side);

            const response = await fetch('/upload_id_image', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                console.log(`✅ ${side} ID image uploaded successfully.`);
                // Optionally, refresh profile data to show the new image
                await this.loadProfileData();
            } else {
                const errorData = await response.json();
                console.error(`❌ Failed to upload ${side} ID image:`, errorData.error);
                alert(`Failed to upload ${side} ID image: ${errorData.error}`);
            }
        } catch (error) {
            console.error(`❌ Error uploading ${side} ID image:`, error);
            alert(`Error uploading ${side} ID image.`);
        }
    }

    async onEkycFront(ev) {
        const file = ev.target.files[0];
        if (file) {
            this.state.ekycFiles.front = file;
            if (this.state.ekycFiles.frontPreview && this.state.ekycFiles.frontPreview.startsWith('blob:')) {
                URL.revokeObjectURL(this.state.ekycFiles.frontPreview);
            }
            this.state.ekycFiles.frontPreview = URL.createObjectURL(file);

            // Auto-detect OCR from front CCCD
            await this.detectOCRFromImage(file, 'front');
        }
    }

    async onEkycBack(ev) {
        const file = ev.target.files[0];
        if (file) {
            this.state.ekycFiles.back = file;
            if (this.state.ekycFiles.backPreview && this.state.ekycFiles.backPreview.startsWith('blob:')) {
                URL.revokeObjectURL(this.state.ekycFiles.backPreview);
            }
            this.state.ekycFiles.backPreview = URL.createObjectURL(file);

            // Auto-detect OCR from back CCCD
            await this.detectOCRFromImage(file, 'back');
        }
    }

    async detectOCRFromImage(file, side) {
        try {
            console.log(`🔍 Detecting OCR from ${side} CCCD...`);

            // Set loading state
            this.state.ocrLoading[side] = true;

            const formData = new FormData();
            formData.append(side === 'front' ? 'frontID' : 'backID', file);

            const endpoint = side === 'front' ? '/api/ekyc/frontID' : '/api/ekyc/backID';
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            console.log(`✅ OCR result for ${side}:`, result);

            if (response.ok && result.success) {
                // Success - update form with OCR data
                // For front OCR: result.data contains the OCR data directly
                // For back OCR: result.data.data contains the OCR data (nested structure)
                const ocrData = side === 'back' && result.data && result.data.data ? result.data.data : result.data;
                this.updateFormWithOCRData(ocrData, side);
                const sideText = side === 'front' ? 'mặt trước' : 'mặt sau';
                this.showModal('Thành công', `Trích xuất thông tin ${sideText} CCCD thành công!`);
            } else {
                // Failed
                const errorMsg = result.error || `Lỗi trích xuất thông tin ${side === 'front' ? 'mặt trước' : 'mặt sau'} CCCD.`;
                this.showModal('Lỗi', errorMsg);
            }
        } catch (error) {
            const errorText = side === 'front' ? 'mặt trước' : 'mặt sau';
            this.showModal('Lỗi', `Có lỗi xảy ra khi trích xuất thông tin từ CCCD ${errorText}. Vui lòng thử lại.`);
            console.error(`❌ Error detecting OCR from ${side} CCCD:`, error);
        } finally {
            // Clear loading state
            this.state.ocrLoading[side] = false;
        }
    }

    updateFormWithOCRData(ocrData, side) {
        const updatedFields = [];

        if (side === 'front') {
            // Update front OCR data
            if (ocrData.idNumber) {
                this.state.formData.id_number = ocrData.idNumber;
                updatedFields.push('Số CCCD');
            }
            if (ocrData.fullName) {
                this.state.formData.name = ocrData.fullName;
                updatedFields.push('Họ và tên');
            }
            if (ocrData.dob) {
                this.state.formData.birth_date = this.formatDateForInput(ocrData.dob);
                updatedFields.push('Ngày sinh');
            }
            if (ocrData.gender) {
                this.state.formData.gender = (ocrData.gender === 'Nam' || ocrData.gender === 'Male') ? 'male' : 'female';
                updatedFields.push('Giới tính');
            }
            if (ocrData.nationality) {
                const countryId = this.findCountryIdByName(ocrData.nationality);
                if (countryId) {
                    // Convert to string for select dropdown
                    this.state.formData.nationality = String(countryId);
                    updatedFields.push('Quốc tịch');

                    // Force re-render of the select dropdown
                    this.render();
                }
            }

            // Propagate address-related data for AddressInfoWidget via sessionStorage
            try {
                const addressPayload = {};
                if (ocrData.address) {
                    addressPayload.permanent_address = ocrData.address;
                }
                if (ocrData.place_of_birth) {
                    addressPayload.birth_place = ocrData.place_of_birth;
                }
                if (ocrData.place_of_origin || ocrData.hometown) {
                    addressPayload.hometown = ocrData.place_of_origin || ocrData.hometown;
                }
                if (Object.keys(addressPayload).length > 0) {
                    const existingRaw = sessionStorage.getItem('addressInfoData');
                    let merged = {};
                    if (existingRaw) {
                        try { merged = JSON.parse(existingRaw) || {}; } catch (e) { merged = {}; }
                    }
                    const finalData = { ...merged, ...addressPayload };
                    sessionStorage.setItem('addressInfoData', JSON.stringify(finalData));
                    sessionStorage.setItem('addressInfoFromEkyc', 'true');
                    console.log('🔗 Saved eKYC address data for AddressInfoWidget:', finalData);
                }
            } catch (e) {
                console.warn('⚠️ Failed to store eKYC address data to sessionStorage:', e);
            }
        } else if (side === 'back') {
            // Update back OCR data
            // OCR back returns: {init_date: '...', issue_date: '...', place_of_birth: '...'}
            if (ocrData.init_date) {
                this.state.formData.id_issue_date = this.formatDateForInput(ocrData.init_date);
                updatedFields.push('Ngày cấp');
            } else if (ocrData.issue_date) {
                this.state.formData.id_issue_date = this.formatDateForInput(ocrData.issue_date);
                updatedFields.push('Ngày cấp');
            }
            if (ocrData.place_of_birth) {
                this.state.formData.id_issue_place = ocrData.place_of_birth;
                updatedFields.push('Nơi cấp');
            }

            // Propagate birth place if available (some services return on back side)
            try {
                if (ocrData.place_of_birth) {
                    const existingRaw = sessionStorage.getItem('addressInfoData');
                    let merged = {};
                    if (existingRaw) {
                        try { merged = JSON.parse(existingRaw) || {}; } catch (e) { merged = {}; }
                    }
                    const finalData = { ...merged, birth_place: ocrData.place_of_birth };
                    sessionStorage.setItem('addressInfoData', JSON.stringify(finalData));
                    sessionStorage.setItem('addressInfoFromEkyc', 'true');
                    console.log('🔗 Updated eKYC birth place for AddressInfoWidget:', finalData);
                }
            } catch (e) {
                console.warn('⚠️ Failed to update eKYC birth place in sessionStorage:', e);
            }
        }

        console.log(`✅ Form updated with ${side} OCR data:`, this.state.formData);
        console.log(`📝 Updated fields: ${updatedFields.join(', ')}`);

        // Show detailed success message
        if (updatedFields.length > 0) {
            const sideText = side === 'front' ? 'mặt trước' : 'mặt sau';
            const fieldsText = updatedFields.join(', ');
            this.showModal('Thành công!', `Đã trích xuất thông tin từ CCCD ${sideText}:\n${fieldsText}`);

            // Auto-close success message after 3 seconds
            setTimeout(() => {
                this.state.showModal = false;
            }, 3000);
        }
    }

    startEkycVerification() {
        // Check if both CCCD images are uploaded
        if (!this.state.ekycFiles.front || !this.state.ekycFiles.back) {
            this.showModal('Lỗi', 'Vui lòng upload đầy đủ ảnh CCCD mặt trước và mặt sau trước khi xác thực eKYC.');
            return;
        }

        // Show eKYC camera modal
        this.state.showEkycModal = true;
        this.state.capturedImages = [];
        this.state.capturedImageTypes = [];
        this.state.isProcessing = false;
        this.state.lastCaptureTime = 0;
        this.state.perfectFaceStartTime = 0; // Reset perfect face timer
        this.state.currentCapturePhase = 'front'; // Start with front-facing
        this.state.cameraStatus = 'Đang khởi tạo camera...';

        // Set initial camera instructions based on current phase
        this.updateCameraInstructionsForPhase('front');

        // Auto-initialize camera
        setTimeout(() => {
            this.initCamera();
        }, 500);
    }

    closeEkycModal() {
        this.state.showEkycModal = false;
        this.stopCamera();

        // Ensure form data is preserved after closing modal
        if (this.state.formData && Object.keys(this.state.formData).length > 0) {
            const profileData = {
                ...this.state.formData,
                // Preserve CCCD images
                frontPreviewBase64: this.state.ekycFiles.frontPreview,
                backPreviewBase64: this.state.ekycFiles.backPreview
            };

            sessionStorage.setItem('personalProfileData', JSON.stringify(profileData));
            sessionStorage.setItem('personalProfileUserId', String(window.currentUserId || ''));

            console.log('✅ Form data preserved after closing eKYC modal');
            console.log('📋 Form data:', JSON.stringify(this.state.formData, null, 2));
        }

        // Force render to ensure form is visible with updated data
        this.render();
    }

    resetEkycVerification() {
        // Reset all eKYC related states
        this.state.capturedImages = [];
        this.state.capturedImageTypes = [];
        this.state.isProcessing = false;
        this.state.lastCaptureTime = 0;
        this.state.perfectFaceStartTime = 0;
        this.state.ekycResult = null;
        this.state.currentCapturePhase = 'front';
        this.state.cameraStatus = 'Camera đã sẵn sàng';

        // Set initial camera instructions
        this.updateCameraInstructionsForPhase('front');

        // Re-initialize camera
        setTimeout(() => {
            this.initCamera();
        }, 500);

        console.log('🔄 eKYC verification reset, ready to start again');
    }

    // Helper methods for new capture logic
    getCapturedCount(phase) {
        return this.state.capturedImageTypes.filter(type => type === phase).length;
    }

    isAllImagesCaptured() {
        const frontCount = this.getCapturedCount('front');
        const leftCount = this.getCapturedCount('left');
        const rightCount = this.getCapturedCount('right');

        return frontCount >= this.state.captureRequirements.front &&
            leftCount >= this.state.captureRequirements.left &&
            rightCount >= this.state.captureRequirements.right;
    }

    getProgressStepClass(phase) {
        const count = this.getCapturedCount(phase);
        const required = this.state.captureRequirements[phase];

        if (count >= required) {
            return 'completed';
        } else if (count > 0) {
            return 'partial';
        } else {
            return 'pending';
        }
    }

    getNextCapturePhase() {
        const frontCount = this.getCapturedCount('front');
        const leftCount = this.getCapturedCount('left');
        const rightCount = this.getCapturedCount('right');

        if (frontCount < this.state.captureRequirements.front) {
            return 'front';
        } else if (leftCount < this.state.captureRequirements.left) {
            return 'left';
        } else if (rightCount < this.state.captureRequirements.right) {
            return 'right';
        }
        return null; // All phases completed
    }

    getPhaseName(phase) {
        const phaseNames = {
            'front': 'chỉnh diện',
            'left': 'góc phải',
            'right': 'góc trái'
        };
        return phaseNames[phase] || phase;
    }

    updateCameraInstructionsForPhase(phase) {
        const phaseInstructions = {
            'front': 'Vui lòng nhìn thẳng vào camera và giữ nguyên vị trí',
            'left': 'Vui lòng quay mặt sang trái để đạt góc phải và giữ nguyên vị trí',
            'right': 'Vui lòng quay mặt sang phải để đạt góc trái và giữ nguyên vị trí'
        };

        this.updateCameraInstructions(phaseInstructions[phase] || 'Vui lòng điều chỉnh khuôn mặt');
        console.log(`📋 Updated camera instructions for phase: ${phase} - ${this.state.cameraInstructions}`);
    }

    updateCameraInstructions(message) {
        if (this.state.cameraInstructions !== message) {
            this.state.cameraInstructions = message;
            console.log(`📋 Camera instructions: ${message}`);
        }
    }

    updateCapturePhase() {
        const nextPhase = this.getNextCapturePhase();
        if (nextPhase && nextPhase !== this.state.currentCapturePhase) {
            this.state.currentCapturePhase = nextPhase;
            this.state.perfectFaceStartTime = 0; // Reset timer for new phase
            console.log(`🔄 Switching to capture phase: ${nextPhase}`);

            // Update camera instructions for new phase
            this.updateCameraInstructionsForPhase(nextPhase);
        }
    }

    showModal(title, message) {
        this.state.modalTitle = title;
        this.state.modalMessage = message;
        this.state.showModal = true;
    }

    async initCamera() {
        this.stopCamera();
        this.state.cameraError = '';
        this.state.cameraStatus = 'Đang khởi tạo camera...';

        try {
            // Check if browser supports getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Trình duyệt không hỗ trợ truy cập camera. Vui lòng sử dụng trình duyệt hiện đại.');
            }

            // Check if running on HTTPS or localhost
            const isSecureContext = window.isSecureContext ||
                location.protocol === 'https:' ||
                location.hostname === 'localhost' ||
                location.hostname === '127.0.0.1';

            if (!isSecureContext) {
                throw new Error('Camera chỉ hoạt động trên HTTPS hoặc localhost. Vui lòng truy cập qua HTTPS.');
            }

            console.log('📹 Initializing camera...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            this.state._mediaStream = stream;
            const video = document.getElementById('ekycVideoPreview');

            if (video) {
                video.srcObject = stream;
                this.state.cameraActive = true;
                this.state.cameraStatus = 'Camera đã sẵn sàng';
                // Keep existing camera instructions or set default for current phase
                if (!this.state.cameraInstructions) {
                    this.updateCameraInstructionsForPhase(this.state.currentCapturePhase);
                }
                console.log('✅ Camera initialized successfully');

                // Start face detection after camera is ready
                video.onloadedmetadata = () => {
                    setTimeout(async () => {
                        // Check if Face API is already loaded from template
                        if (window.faceapi && this.areModelsLoaded()) {
                            console.log('✅ Face API and models already available from template');
                            this.startFaceDetection();
                            this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                        } else if (window.faceapi && !this.areModelsLoaded()) {
                            console.log('🔄 Face API loaded but models not ready, loading models...');
                            await this.loadFaceAPIModels();
                            this.startFaceDetection();
                            this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                        } else {
                            // Try to load Face API in background
                            await this.loadFaceAPI();

                            // Check if Face API loaded successfully
                            if (window.faceapi) {
                                this.startFaceDetection();
                                this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                            } else {
                                console.warn('⚠️ Face API not available, using fallback detection');
                                this.startFaceDetection();
                                this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt (chế độ cơ bản)...');
                            }
                        }
                    }, 1000); // Small delay to ensure video is fully loaded
                };

                // Backup: Start face detection immediately if video is already loaded
                if (video.readyState >= 2) {
                    setTimeout(async () => {
                        // Check if Face API is already loaded from template
                        if (window.faceapi && this.areModelsLoaded()) {
                            console.log('✅ Face API and models already available from template (backup)');
                            this.startFaceDetection();
                            this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                        } else if (window.faceapi && !this.areModelsLoaded()) {
                            console.log('🔄 Face API loaded but models not ready (backup), loading models...');
                            await this.loadFaceAPIModels();
                            this.startFaceDetection();
                            this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                        } else {
                            // Try to load Face API in background
                            await this.loadFaceAPI();

                            // Check if Face API loaded successfully
                            if (window.faceapi) {
                                this.startFaceDetection();
                                this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt...');
                            } else {
                                console.warn('⚠️ Face API not available, using fallback detection');
                                this.startFaceDetection();
                                this.updateFaceStatus('detecting', 'fas fa-search', 'Đang phát hiện khuôn mặt (chế độ cơ bản)...');
                            }
                        }
                    }, 1000);
                }
            } else {
                throw new Error('Video element not found');
            }
        } catch (error) {
            console.error('❌ Error accessing camera:', error);
            this.state.cameraActive = false;
            this.state.cameraStatus = 'Lỗi camera';

            // Provide detailed error messages based on error type
            let errorMessage = 'Không thể truy cập camera. ';

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Quyền truy cập camera bị từ chối. ';
                errorMessage += 'Vui lòng:\n';
                errorMessage += '1. Click vào biểu tượng camera trên thanh địa chỉ trình duyệt\n';
                errorMessage += '2. Chọn "Cho phép" để cấp quyền truy cập camera\n';
                errorMessage += '3. Làm mới trang và thử lại';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'Không tìm thấy camera. ';
                errorMessage += 'Vui lòng kiểm tra:\n';
                errorMessage += '1. Camera đã được kết nối\n';
                errorMessage += '2. Không có ứng dụng khác đang sử dụng camera\n';
                errorMessage += '3. Thử lại sau khi đóng các ứng dụng khác';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Camera đang được sử dụng bởi ứng dụng khác. ';
                errorMessage += 'Vui lòng:\n';
                errorMessage += '1. Đóng các ứng dụng đang sử dụng camera (Zoom, Teams, Skype, etc.)\n';
                errorMessage += '2. Làm mới trang và thử lại';
            } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                errorMessage += 'Camera không hỗ trợ yêu cầu. ';
                errorMessage += 'Vui lòng thử lại hoặc sử dụng camera khác.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Trình duyệt không hỗ trợ truy cập camera. ';
                errorMessage += 'Vui lòng sử dụng trình duyệt hiện đại (Chrome, Firefox, Edge, Safari).';
            } else if (error.message && error.message.includes('HTTPS')) {
                errorMessage += 'Camera chỉ hoạt động trên HTTPS hoặc localhost. ';
                errorMessage += 'Vui lòng truy cập qua HTTPS hoặc localhost.';
            } else {
                errorMessage += 'Vui lòng kiểm tra quyền truy cập và thử lại.';
                if (error.message) {
                    errorMessage += `\n\nChi tiết lỗi: ${error.message}`;
                }
            }

            this.state.cameraError = errorMessage;

            // Show error notification
            this.showModal('Lỗi Camera', errorMessage);
        }
    }

    async loadFaceAPI() {
        if (window.faceapi) {
            console.log('✅ Face API already loaded from CDN');
            return;
        }

        try {
            console.log('🔄 Face API not found, trying to load...');

            // Check if Face API is already loaded from CDN in template
            if (window.faceapi) {
                console.log('✅ Face API loaded from template CDN');
                return;
            }

            // Try multiple CDN sources for better reliability
            const cdnSources = this.constructor.CONFIG.FACE_API.CDN_SOURCES;

            let loadSuccess = false;
            let lastError = null;

            for (const cdnUrl of cdnSources) {
                try {
                    console.log(`🔄 Trying CDN: ${cdnUrl}`);
                    await Promise.race([
                        this.loadScript(cdnUrl),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Script load timeout')), this.constructor.CONFIG.FACE_API.TIMEOUTS.SCRIPT_LOAD))
                    ]);

                    // Wait for script to initialize
                    await new Promise(resolve => setTimeout(resolve, this.constructor.CONFIG.FACE_API.TIMEOUTS.INITIALIZATION));

                    if (window.faceapi) {
                        loadSuccess = true;
                        console.log(`✅ Face API loaded from: ${cdnUrl}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load from ${cdnUrl}:`, error);
                    lastError = error;
                    continue;
                }
            }

            if (!loadSuccess || !window.faceapi) {
                console.warn('⚠️ All CDNs failed, trying local fallback...');
                await this.loadFaceAPILocal();

                if (!window.faceapi) {
                    throw new Error(`Face API not available after trying all CDNs and local fallback. Last error: ${lastError?.message || 'Unknown'}`);
                }
            }

            // Load models with better error handling
            const modelUrls = this.constructor.CONFIG.FACE_API.MODEL_SOURCES;

            let modelsLoaded = false;
            let modelError = null;

            for (const modelUrl of modelUrls) {
                try {
                    console.log(`🔄 Loading models from: ${modelUrl}`);
                    await Promise.race([
                        Promise.all([
                            window.faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
                            window.faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
                            window.faceapi.nets.faceExpressionNet.loadFromUri(modelUrl)
                        ]),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), this.constructor.CONFIG.FACE_API.TIMEOUTS.MODEL_LOAD))
                    ]);
                    modelsLoaded = true;
                    console.log(`✅ Models loaded from: ${modelUrl}`);
                    break;
                } catch (error) {
                    console.warn(`⚠️ Failed to load models from ${modelUrl}:`, error);
                    modelError = error;
                    continue;
                }
            }

            if (!modelsLoaded) {
                console.warn('⚠️ All CDN model sources failed, trying local fallback...');
                await this.loadFaceAPIModelsLocal();

                if (!this.areModelsLoaded()) {
                    throw new Error(`Models not loaded from CDN or local. Last error: ${modelError?.message || 'Unknown'}`);
                }
            }

            // Wait for models to be fully initialized
            await new Promise(resolve => setTimeout(resolve, this.constructor.CONFIG.FACE_API.TIMEOUTS.INITIALIZATION));

            // Verify models are ready
            if (!this.areModelsLoaded()) {
                throw new Error('Models not properly loaded');
            }

            console.log('✅ Face API and models loaded successfully');
        } catch (error) {
            console.error('❌ Error loading Face API:', error);
            // Don't throw error, just log it and let fallback methods handle detection
            console.warn('⚠️ Face API failed to load, will use fallback detection methods');
        }
    }

    async loadFaceAPIModels() {
        try {
            console.log('🔄 Loading Face API models...');

            // Load models with better error handling
            const modelUrls = this.constructor.CONFIG.FACE_API.MODEL_SOURCES;

            let modelsLoaded = false;
            let modelError = null;

            for (const modelUrl of modelUrls) {
                try {
                    console.log(`🔄 Loading models from: ${modelUrl}`);
                    await Promise.race([
                        Promise.all([
                            window.faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
                            window.faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
                            window.faceapi.nets.faceExpressionNet.loadFromUri(modelUrl)
                        ]),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), this.constructor.CONFIG.FACE_API.TIMEOUTS.MODEL_LOAD))
                    ]);
                    modelsLoaded = true;
                    console.log(`✅ Models loaded from: ${modelUrl}`);
                    break;
                } catch (error) {
                    console.warn(`⚠️ Failed to load models from ${modelUrl}:`, error);
                    modelError = error;
                    continue;
                }
            }

            if (!modelsLoaded) {
                console.warn('⚠️ All CDN model sources failed, trying local fallback...');
                await this.loadFaceAPIModelsLocal();

                if (!this.areModelsLoaded()) {
                    throw new Error(`Models not loaded from CDN or local. Last error: ${modelError?.message || 'Unknown'}`);
                }
            }

            // Wait for models to be fully initialized
            await new Promise(resolve => setTimeout(resolve, this.constructor.CONFIG.FACE_API.TIMEOUTS.INITIALIZATION));

            // Verify models are ready
            if (!this.areModelsLoaded()) {
                throw new Error('Models not properly loaded');
            }

            console.log('✅ Face API models loaded successfully');
        } catch (error) {
            console.error('❌ Error loading Face API models:', error);
            throw error;
        }
    }

    async loadFaceAPIModelsLocal() {
        try {
            console.log('🔄 Trying to load Face API models from local assets...');

            // Try to load models from local assets
            const localModelPaths = [
                '/web/static/lib/face-api/models',
                '/static/lib/face-api/models',
                '/models'
            ];

            for (const localModelPath of localModelPaths) {
                try {
                    await Promise.all([
                        window.faceapi.nets.tinyFaceDetector.loadFromUri(localModelPath),
                        window.faceapi.nets.faceLandmark68Net.loadFromUri(localModelPath),
                        window.faceapi.nets.faceExpressionNet.loadFromUri(localModelPath)
                    ]);
                    console.log(`✅ Models loaded from local: ${localModelPath}`);
                    return;
                } catch (error) {
                    console.warn(`⚠️ Failed to load models from local path ${localModelPath}:`, error);
                    continue;
                }
            }

            console.warn('⚠️ Local models not found, will use fallback detection');
        } catch (error) {
            console.warn('⚠️ Error loading local models:', error);
        }
    }

    async loadFaceAPILocal() {
        try {
            console.log('🔄 Trying to load Face API from local assets...');

            // Try to load from local assets
            const localPaths = this.constructor.CONFIG.FACE_API.LOCAL_PATHS;

            for (const localPath of localPaths) {
                try {
                    await this.loadScript(localPath);
                    if (window.faceapi) {
                        console.log(`✅ Face API loaded from local: ${localPath}`);
                        return;
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load from local path ${localPath}:`, error);
                    continue;
                }
            }

            console.warn('⚠️ Local Face API not found, will use fallback detection');
        } catch (error) {
            console.warn('⚠️ Error loading local Face API:', error);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script already exists
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                console.log(`✅ Script already loaded: ${src}`);
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.type = 'text/javascript';

            script.onload = () => {
                console.log(`✅ Script loaded successfully: ${src}`);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`❌ Failed to load script: ${src}`, error);
                // Remove failed script
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error(`Failed to load script: ${src}`));
            };

            // Add timeout
            const timeoutId = setTimeout(() => {
                console.error(`❌ Script load timeout: ${src}`);
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error(`Script load timeout: ${src}`));
            }, 8000);

            // Clear timeout on successful load
            const originalOnload = script.onload;
            script.onload = () => {
                clearTimeout(timeoutId);
                originalOnload();
            };

            document.head.appendChild(script);
        });
    }

    stopCamera() {
        this.state.cameraActive = false;
        this.state.cameraError = '';
        this.state.cameraStatus = 'Camera đã tắt';
        this.stopFaceDetection();

        if (this.state._mediaStream) {
            this.state._mediaStream.getTracks().forEach(track => track.stop());
            this.state._mediaStream = null;
        }

        const video = document.getElementById('ekycVideoPreview');
        if (video) {
            video.srcObject = null;
        }
        console.log('📹 Camera stopped');
    }

    captureImage(isAutoCapture = false) {
        if (!this.state.cameraActive || this.isAllImagesCaptured()) return;

        try {
            const video = document.getElementById('ekycVideoPreview');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            this.state.capturedImages.push(imageData);
            this.state.capturedImageTypes.push(this.state.currentCapturePhase);

            // Update last capture time for auto-capture
            this.state.lastCaptureTime = Date.now();

            // Get current phase info
            const currentPhase = this.state.currentCapturePhase;
            const currentCount = this.getCapturedCount(currentPhase);
            const requiredCount = this.state.captureRequirements[currentPhase];

            // Show capture feedback
            this.updateCameraInstructions(`✅ Chụp ${this.getPhaseName(currentPhase)} thành công! (${currentCount}/${requiredCount})`);

            // Check if current phase is completed
            if (currentCount >= requiredCount) {
                this.updateCapturePhase();

                if (this.isAllImagesCaptured()) {
                    this.state.cameraInstructions = '🎉 Hoàn thành chụp ảnh! Đang tự động xác thực eKYC...';
                    this.stopFaceDetection();
                    this.state.cameraStatus = 'Đang tự động xác thực eKYC...';

                    // Auto-verify eKYC after a short delay
                    setTimeout(() => {
                        this.processEkycVerification();
                    }, 2000); // Wait 2 seconds before auto-verification
                } else {
                    // Move to next phase
                    const nextPhase = this.state.currentCapturePhase;
                    this.updateCameraInstructions(`🔄 Chuyển sang chụp ${this.getPhaseName(nextPhase)}. Vui lòng điều chỉnh khuôn mặt.`);
                }
            }

            // Reset perfect face timer for next capture
            this.state.perfectFaceStartTime = 0;

        } catch (error) {
            console.error('❌ Error capturing image:', error);
            this.showModal('Lỗi', 'Xác thực thất bại. Vui lòng thử lại.');
        }
    }

    removeCapturedImage(index) {
        const removedType = this.state.capturedImageTypes[index];
        this.state.capturedImages.splice(index, 1);
        this.state.capturedImageTypes.splice(index, 1);

        this.state.lastCaptureTime = 0; // Reset capture time to allow immediate re-capture
        this.state.perfectFaceStartTime = 0; // Reset perfect face timer

        // Update current phase if needed
        this.updateCapturePhase();

        this.updateCameraInstructions(`🗑️ Đã xóa ảnh ${this.getPhaseName(removedType)}. Vui lòng chụp lại.`);
        console.log(`🗑️ Removed ${removedType} image ${index}, reset timers for re-capture`);
    }

    async processEkycVerification() {
        if (!this.isAllImagesCaptured()) {
            const frontCount = this.getCapturedCount('front');
            const leftCount = this.getCapturedCount('left');
            const rightCount = this.getCapturedCount('right');

            this.showModal('Thiếu ảnh',
                `Vui lòng chụp đủ ảnh theo yêu cầu:\n` +
                `- Chỉnh diện: ${frontCount}/${this.state.captureRequirements.front}\n` +
                `- Góc trái: ${leftCount}/${this.state.captureRequirements.left}\n` +
                `- Góc phải: ${rightCount}/${this.state.captureRequirements.right}`
            );
            return;
        }

        this.state.isProcessing = true;
        this.state.cameraStatus = 'Đang xử lý xác thực...';

        try {
            const formData = new FormData();

            // Add CCCD front image only (eKYC service only needs frontID)
            formData.append('frontID', this.state.ekycFiles.front);

            // Add 7 portrait images
            for (let i = 0; i < this.state.capturedImages.length; i++) {
                const imageFile = this.dataURLtoFile(this.state.capturedImages[i], `portrait_${i + 1}.jpg`);
                console.log(`📸 Adding portrait image ${i + 1}:`, imageFile.name, imageFile.type, imageFile.size);
                formData.append('portraitImages', imageFile);
            }

            console.log('🚀 Sending eKYC verification request...');
            console.log('📁 FormData contents:');
            for (let [key, value] of formData.entries()) {
                console.log(`  ${key}:`, value instanceof File ? `${value.name} (${value.type}, ${value.size} bytes)` : value);
            }

            const response = await fetch('/api/ekyc-process', {
                method: 'POST',
                body: formData
            });

            console.log('📡 Response status:', response.status);
            console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                let errorMessage = `Lỗi server: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage = errorText.substring(0, 500); // Limit error message length
                    }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('🔍 eKYC verification result:', result);

            if (result.success) {
                // Success - update form with OCR data FIRST
                console.log('🔄 Updating form with eKYC result...');
                this.updateFormWithEkycResult(result);

                // Force immediate render to show updated data
                this.render();

                // Wait a bit for render to complete
                await new Promise(resolve => setTimeout(resolve, 100));

                // Set eKYC result state
                this.state.ekycResult = {
                    success: true,
                    message: 'Xác thực eKYC thành công! Thông tin đã được cập nhật tự động.'
                };

                // Get list of updated fields with their values
                const updatedFieldsList = this.getUpdatedFieldsList(result);

                // Build success message with table
                let successMessage = '<div style="text-align: left;">';
                successMessage += '<p style="margin-bottom: 15px; font-weight: 600;">Xác thực eKYC thành công!</p>';

                if (updatedFieldsList.length > 0) {
                    successMessage += `<p style="margin-bottom: 10px;">Đã tự động điền <strong>${updatedFieldsList.length}</strong> trường thông tin:</p>`;
                    successMessage += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">';
                    successMessage += '<thead><tr style="background-color: #f8f9fa;"><th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">Trường</th><th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">Giá trị</th></tr></thead>';
                    successMessage += '<tbody>';

                    updatedFieldsList.forEach(field => {
                        successMessage += '<tr>';
                        successMessage += `<td style="padding: 8px; border: 1px solid #dee2e6; font-weight: 600;">${field.label}</td>`;
                        successMessage += `<td style="padding: 8px; border: 1px solid #dee2e6;">${field.value || '<em style="color: #6c757d;">N/A</em>'}</td>`;
                        successMessage += '</tr>';
                    });

                    successMessage += '</tbody></table>';
                    successMessage += '<p style="color: #28a745; font-weight: 600;"><i class="fas fa-check-circle"></i> Vui lòng kiểm tra và hoàn thiện các thông tin còn lại.</p>';
                } else {
                    successMessage += '<p style="color: #ffc107;">Không tìm thấy dữ liệu OCR để điền tự động. Vui lòng nhập thủ công.</p>';
                }

                successMessage += '</div>';

                this.showModal('Thành công', successMessage);

                // Close eKYC modal after 5 seconds to give user time to see the data
                setTimeout(() => {
                    this.closeEkycModal();
                    // Force render again after closing modal to ensure form data is visible
                    setTimeout(() => {
                        this.render();
                    }, 200);
                }, 5000);

            } else {
                // Failed
                const errorMsg = result.error || 'Xác thực eKYC thất bại. Vui lòng thử lại.';
                this.state.ekycResult = {
                    success: false,
                    error: errorMsg
                };

                // Show error message for auto-verification
                this.showModal('Lỗi', errorMsg);
            }

        } catch (error) {
            console.error('❌ Error during eKYC verification:', error);

            // Provide detailed error message based on error type
            let errorMessage = 'Lỗi kết nối đến server eKYC. ';

            if (error instanceof TypeError) {
                if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
                    errorMessage = 'Không thể kết nối đến server eKYC. Vui lòng:\n' +
                        '1. Kiểm tra kết nối mạng\n' +
                        '2. Kiểm tra cấu hình eKYC trong Odoo Settings\n' +
                        '3. Thử lại sau vài giây';
                } else {
                    errorMessage = `Lỗi hệ thống: ${error.message}`;
                }
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage += 'Vui lòng thử lại sau.';
            }

            this.state.ekycResult = {
                success: false,
                error: errorMessage
            };

            this.showModal('Lỗi', errorMessage);
        } finally {
            this.state.isProcessing = false;
            this.state.cameraStatus = 'Camera đã sẵn sàng';
        }
    }

    updateFormWithEkycResult(result) {
        console.log('✅ eKYC verification successful, updating form with OCR data:', result);

        // Extract OCR data from result
        // VNPT eKYC returns: { success: true, data: { ocr: {...}, face_compare: {...}, face_liveness: {...} } }
        // OR: { success: true, ocr: {...}, face_compare: {...}, face_liveness: {...} }
        let ocrData = null;

        // Try different paths to find OCR data
        if (result.data && result.data.ocr) {
            // Most common structure: result.data.ocr
            ocrData = result.data.ocr;
            console.log('📋 Found OCR data in result.data.ocr');
        } else if (result.ocr) {
            // Alternative structure: result.ocr
            ocrData = result.ocr;
            console.log('📋 Found OCR data in result.ocr');
        } else if (result.data && typeof result.data === 'object') {
            // Check if data itself is OCR data
            const excludedKeys = ['success', 'message', 'error', 'face_compare', 'face_liveness'];
            const hasOcrFields = ['id', 'name', 'birth_day', 'gender', 'nationality'].some(key => key in result.data);
            if (hasOcrFields) {
                ocrData = result.data;
                console.log('📋 Found OCR data directly in result.data');
            }
        }

        // Handle nested structure: sometimes OCR data is in result.ocr.object or result.data.ocr.object
        if (ocrData && ocrData.object) {
            ocrData = ocrData.object;
            console.log('📋 Extracted OCR data from .object');
        }

        // Log all available OCR fields for debugging
        if (ocrData) {
            console.log('📋 Extracted OCR data:', ocrData);
            console.log('📋 All OCR keys:', Object.keys(ocrData));
        } else {
            console.warn('⚠️ No OCR data found in result. Available keys:', Object.keys(result));
            if (result.data) {
                console.warn('⚠️ result.data keys:', Object.keys(result.data));
            }
            this.showModal('Cảnh báo', 'Không tìm thấy dữ liệu OCR trong kết quả eKYC. Vui lòng kiểm tra lại.');
            return;
        }

        // Map VNPT eKYC OCR fields to form fields
        // Based on actual VNPT API response structure:
        // - id: "046204003748"
        // - name: "VÕ VĂN NHÂN"
        // - birth_day: "21/02/2004" (format: DD/MM/YYYY)
        // - gender: "Nam" or "Nữ"
        // - nationality: "Việt Nam"
        // - issue_date: "-" or date string
        // - issue_place: "-" or place string
        // - recent_location: address string
        // - origin_location: hometown string
        const ocrFields = {
            // ID number - VNPT uses: id
            idNumber: ocrData.id || ocrData.idNumber || ocrData.id_number || ocrData.cmnd || ocrData.cccd || ocrData.so_cmnd || ocrData.so_cccd,
            // Full name - VNPT uses: name
            fullName: ocrData.name || ocrData.fullName || ocrData.full_name || ocrData.ho_ten || ocrData.ho_va_ten || ocrData.ten,
            // Date of birth - VNPT uses: birth_day (format: DD/MM/YYYY)
            dob: ocrData.birth_day || ocrData.dob || ocrData.date_of_birth || ocrData.birth_date || ocrData.ngay_sinh || ocrData.ngay_thang_nam_sinh || ocrData.birthday,
            // Gender - VNPT uses: gender ("Nam" or "Nữ")
            gender: ocrData.gender || ocrData.gioi_tinh || ocrData.sex || ocrData.gioiTinh,
            // Nationality - VNPT uses: nationality
            nationality: ocrData.nationality || ocrData.quoc_tich || ocrData.country || ocrData.quoc_gia || ocrData.quocTich,
            // Address - VNPT uses: recent_location
            address: ocrData.recent_location || ocrData.address || ocrData.dia_chi || ocrData.permanent_address || ocrData.ho_khau_thuong_tru || ocrData.diaChi,
            // Place of birth - from address or origin_location
            place_of_birth: ocrData.origin_location || ocrData.place_of_birth || ocrData.noi_sinh || ocrData.birth_place || ocrData.noi_sinh_quan_huyen || ocrData.noiSinh,
            // Place of origin / Hometown - VNPT uses: origin_location
            place_of_origin: ocrData.origin_location || ocrData.place_of_origin || ocrData.que_quan || ocrData.hometown || ocrData.nguyen_quan || ocrData.queQuan,
            // Issue date - VNPT uses: issue_date (can be "-" if not available)
            issue_date: (ocrData.issue_date && ocrData.issue_date !== '-') ? ocrData.issue_date : (ocrData.init_date || ocrData.ngay_cap || ocrData.ngay_ky || ocrData.date_of_issue || ocrData.ngayCap),
            // Issue place - VNPT uses: issue_place (can be "-" if not available)
            // Also check post_code for city/district information that might indicate issue place
            issue_place: (() => {
                // First try direct issue_place field (if not "-")
                if (ocrData.issue_place && ocrData.issue_place !== '-') {
                    return ocrData.issue_place;
                }
                // Try alternative field names
                const altFields = [
                    ocrData.noi_cap,
                    ocrData.place_of_issue,
                    ocrData.co_quan_cap,
                    ocrData.issued_by,
                    ocrData.noiCap,
                    ocrData.coQuanCap
                ];
                for (const field of altFields) {
                    if (field && field !== '-') {
                        return field;
                    }
                }
                // If not found, try to extract from post_code or new_post_code
                // post_code contains city/district/ward information
                if (ocrData.post_code && Array.isArray(ocrData.post_code) && ocrData.post_code.length > 0) {
                    const addressInfo = ocrData.post_code[0];
                    if (addressInfo && addressInfo.city && Array.isArray(addressInfo.city) && addressInfo.city.length > 1) {
                        const cityName = addressInfo.city[1];
                        if (addressInfo.district && Array.isArray(addressInfo.district) && addressInfo.district.length > 1) {
                            const districtName = addressInfo.district[1];
                            return `${districtName}, ${cityName}`;
                        }
                        return cityName;
                    }
                }
                // Try new_post_code as fallback
                if (ocrData.new_post_code && Array.isArray(ocrData.new_post_code) && ocrData.new_post_code.length > 0) {
                    const addressInfo = ocrData.new_post_code[0];
                    if (addressInfo && addressInfo.city && Array.isArray(addressInfo.city) && addressInfo.city.length > 1) {
                        const cityName = addressInfo.city[1];
                        if (addressInfo.district && Array.isArray(addressInfo.district) && addressInfo.district.length > 1) {
                            const districtName = addressInfo.district[1];
                            return `${districtName}, ${cityName}`;
                        }
                        return cityName;
                    }
                }
                // Last resort: use origin_location or recent_location if available
                if (ocrData.origin_location) {
                    return ocrData.origin_location;
                }
                if (ocrData.recent_location) {
                    // Extract city/district from recent_location if it's a full address
                    const locationParts = ocrData.recent_location.split(',');
                    if (locationParts.length >= 2) {
                        return locationParts.slice(-2).join(',').trim();
                    }
                    return ocrData.recent_location;
                }
                return null;
            })(),
        };

        // Log which fields were found
        console.log('📋 Mapped OCR fields:', ocrFields);
        const foundFields = Object.keys(ocrFields).filter(key => ocrFields[key]);
        const missingFields = Object.keys(ocrFields).filter(key => !ocrFields[key]);
        console.log('✅ Found fields:', foundFields);
        console.log('❌ Missing fields:', missingFields);

        const updatedFields = [];

        // Update form fields with OCR data
        if (ocrFields.idNumber) {
            this.state.formData.id_number = ocrFields.idNumber;
            updatedFields.push('Số CCCD');
        }

        if (ocrFields.fullName) {
            this.state.formData.name = ocrFields.fullName;
            updatedFields.push('Họ và tên');
        }

        if (ocrFields.dob) {
            this.state.formData.birth_date = this.formatDateForInput(ocrFields.dob);
            updatedFields.push('Ngày sinh');
        }

        if (ocrFields.gender) {
            const genderValue = ocrFields.gender.toString().toLowerCase();
            if (genderValue.includes('nam') || genderValue.includes('male') || genderValue === 'm') {
                this.state.formData.gender = 'male';
            } else if (genderValue.includes('nữ') || genderValue.includes('female') || genderValue === 'f') {
                this.state.formData.gender = 'female';
            }
            updatedFields.push('Giới tính');
        }

        if (ocrFields.nationality) {
            const countryId = this.findCountryIdByName(ocrFields.nationality);
            if (countryId) {
                this.state.formData.nationality = String(countryId);
                updatedFields.push('Quốc tịch');
            }
        }

        if (ocrFields.issue_date) {
            this.state.formData.id_issue_date = this.formatDateForInput(ocrFields.issue_date);
            updatedFields.push('Ngày cấp');
        }

        if (ocrFields.issue_place) {
            this.state.formData.id_issue_place = ocrFields.issue_place.trim();
            updatedFields.push('Nơi cấp');
            console.log('✅ Set issue_place:', ocrFields.issue_place);
        } else {
            console.warn('⚠️ issue_place not found. Available OCR keys:', Object.keys(ocrData));
            console.warn('⚠️ issue_place value:', ocrData.issue_place);
            console.warn('⚠️ post_code:', ocrData.post_code);
            console.warn('⚠️ new_post_code:', ocrData.new_post_code);
        }

        // Propagate address-related data for AddressInfoWidget via sessionStorage
        try {
            const addressPayload = {};
            if (ocrFields.address) {
                addressPayload.permanent_address = ocrFields.address;
            }
            if (ocrFields.place_of_birth) {
                addressPayload.birth_place = ocrFields.place_of_birth;
            }
            if (ocrFields.place_of_origin) {
                addressPayload.hometown = ocrFields.place_of_origin;
            }
            if (Object.keys(addressPayload).length > 0) {
                const existingRaw = sessionStorage.getItem('addressInfoData');
                let merged = {};
                if (existingRaw) {
                    try { merged = JSON.parse(existingRaw) || {}; } catch (e) { merged = {}; }
                }
                const finalData = { ...merged, ...addressPayload };
                sessionStorage.setItem('addressInfoData', JSON.stringify(finalData));
                sessionStorage.setItem('addressInfoFromEkyc', 'true');
                console.log('🔗 Saved eKYC address data for AddressInfoWidget:', finalData);
            }
        } catch (e) {
            console.warn('⚠️ Failed to store eKYC address data to sessionStorage:', e);
        }

        // Save current form data to session storage with CCCD images
        const profileData = {
            ...this.state.formData,
            // Preserve CCCD images
            frontPreviewBase64: this.state.ekycFiles.frontPreview,
            backPreviewBase64: this.state.ekycFiles.backPreview
        };

        sessionStorage.setItem('personalProfileData', JSON.stringify(profileData));
        sessionStorage.setItem('personalProfileUserId', String(window.currentUserId || ''));

        console.log('✅ Form updated with eKYC OCR data:', this.state.formData);
        console.log(`📝 Updated fields: ${updatedFields.join(', ')}`);
        console.log('📋 Current formData state:', JSON.stringify(this.state.formData, null, 2));

        // Show success message with updated fields and missing fields
        if (updatedFields.length > 0) {
            const fieldsText = updatedFields.join(', ');
            console.log(`✅ Đã tự động điền ${updatedFields.length} trường thông tin: ${fieldsText}`);
        } else {
            console.warn('⚠️ Không có trường nào được điền tự động từ OCR');
            console.warn('📋 Full result structure:', JSON.stringify(result, null, 2));
        }

        // Force re-render multiple times to ensure data is displayed
        this.render();
        setTimeout(() => this.render(), 100);
        setTimeout(() => this.render(), 300);
    }

    getUpdatedFieldsCount(result) {
        // Helper method to count how many fields were updated
        const fieldsList = this.getUpdatedFieldsList(result);
        return fieldsList.length;
    }

    getUpdatedFieldsList(result) {
        // Helper method to get list of updated fields with their values
        let ocrData = null;

        // Extract OCR data from result
        if (result.data && result.data.ocr) {
            ocrData = result.data.ocr;
        } else if (result.ocr) {
            ocrData = result.ocr;
        } else if (result.data && typeof result.data === 'object') {
            const hasOcrFields = ['id', 'name', 'birth_day', 'gender', 'nationality'].some(key => key in result.data);
            if (hasOcrFields) {
                ocrData = result.data;
            }
        }

        if (ocrData && ocrData.object) {
            ocrData = ocrData.object;
        }

        if (!ocrData || Object.keys(ocrData).length === 0) {
            return [];
        }

        const fieldsList = [];

        // Map OCR fields to form fields with labels
        const fieldMappings = [
            {
                key: 'idNumber',
                label: 'Số CCCD',
                value: ocrData.id || ocrData.idNumber || ocrData.id_number || ocrData.cmnd || ocrData.cccd || ocrData.so_cmnd || ocrData.so_cccd
            },
            {
                key: 'fullName',
                label: 'Họ và tên',
                value: ocrData.name || ocrData.fullName || ocrData.full_name || ocrData.ho_ten || ocrData.ho_va_ten || ocrData.ten
            },
            {
                key: 'dob',
                label: 'Ngày sinh',
                value: ocrData.birth_day || ocrData.dob || ocrData.date_of_birth || ocrData.birth_date || ocrData.ngay_sinh || ocrData.ngay_thang_nam_sinh || ocrData.birthday
            },
            {
                key: 'gender',
                label: 'Giới tính',
                value: (() => {
                    const gender = ocrData.gender || ocrData.gioi_tinh || ocrData.sex || ocrData.gioiTinh;
                    if (gender) {
                        const genderValue = gender.toString().toLowerCase();
                        if (genderValue.includes('nam') || genderValue.includes('male') || genderValue === 'm') {
                            return 'Nam';
                        } else if (genderValue.includes('nữ') || genderValue.includes('female') || genderValue === 'f') {
                            return 'Nữ';
                        }
                        return gender;
                    }
                    return null;
                })()
            },
            {
                key: 'nationality',
                label: 'Quốc tịch',
                value: ocrData.nationality || ocrData.quoc_tich || ocrData.country || ocrData.quoc_gia || ocrData.quocTich
            },
            {
                key: 'issue_date',
                label: 'Ngày cấp',
                value: (() => {
                    const date = (ocrData.issue_date && ocrData.issue_date !== '-') ? ocrData.issue_date : (ocrData.init_date || ocrData.ngay_cap || ocrData.ngay_ky || ocrData.date_of_issue || ocrData.ngayCap);
                    return date && date !== '-' ? date : null;
                })()
            },
            {
                key: 'issue_place',
                label: 'Nơi cấp',
                value: (() => {
                    if (ocrData.issue_place && ocrData.issue_place !== '-') {
                        return ocrData.issue_place;
                    }
                    // Try alternative fields
                    const altFields = [ocrData.noi_cap, ocrData.place_of_issue, ocrData.co_quan_cap, ocrData.issued_by, ocrData.noiCap, ocrData.coQuanCap];
                    for (const field of altFields) {
                        if (field && field !== '-') {
                            return field;
                        }
                    }
                    // Try to extract from post_code
                    if (ocrData.post_code && Array.isArray(ocrData.post_code) && ocrData.post_code.length > 0) {
                        const addressInfo = ocrData.post_code[0];
                        if (addressInfo && addressInfo.city && Array.isArray(addressInfo.city) && addressInfo.city.length > 1) {
                            const cityName = addressInfo.city[1];
                            if (addressInfo.district && Array.isArray(addressInfo.district) && addressInfo.district.length > 1) {
                                const districtName = addressInfo.district[1];
                                return `${districtName}, ${cityName}`;
                            }
                            return cityName;
                        }
                    }
                    // Try new_post_code as fallback
                    if (ocrData.new_post_code && Array.isArray(ocrData.new_post_code) && ocrData.new_post_code.length > 0) {
                        const addressInfo = ocrData.new_post_code[0];
                        if (addressInfo && addressInfo.city && Array.isArray(addressInfo.city) && addressInfo.city.length > 1) {
                            const cityName = addressInfo.city[1];
                            if (addressInfo.district && Array.isArray(addressInfo.district) && addressInfo.district.length > 1) {
                                const districtName = addressInfo.district[1];
                                return `${districtName}, ${cityName}`;
                            }
                            return cityName;
                        }
                    }
                    return null;
                })()
            }
        ];

        // Only include fields that have values
        fieldMappings.forEach(field => {
            if (field.value && field.value !== '-' && field.value.toString().trim() !== '') {
                fieldsList.push({
                    label: field.label,
                    value: field.value.toString().trim()
                });
            }
        });

        return fieldsList;
    }

    dataURLtoFile(dataURL, filename) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        // Ensure correct mimetype for images
        const fileType = mime || 'image/jpeg';
        console.log(`📸 Creating file: ${filename}, type: ${fileType}, size: ${u8arr.length} bytes`);

        return new File([u8arr], filename, { type: fileType });
    }

    formatDateForInput(dateStr) {
        if (!dateStr) return '';

        const cleanDateStr = dateStr.toString().trim();
        console.log(`📅 Formatting date: "${cleanDateStr}"`);

        const patterns = [
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
            /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
            /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/
        ];

        for (const pattern of patterns) {
            const match = cleanDateStr.match(pattern);
            if (match) {
                let day, month, year;

                if (pattern.source.startsWith('^(\\d{4})')) {
                    year = match[1];
                    month = match[2];
                    day = match[3];
                } else {
                    day = match[1];
                    month = match[2];
                    year = match[3];
                }

                const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                console.log(`📅 Date formatted: "${cleanDateStr}" -> "${formattedDate}"`);
                return formattedDate;
            }
        }

        console.log(`⚠️ Date format not recognized: "${cleanDateStr}"`);
        return '';
    }

    findCountryIdByName(countryName) {
        if (!countryName) {
            return '';
        }

        const normalizedName = countryName.trim().toLowerCase();

        // First, try to map Vietnamese names to English names
        const vietnameseToEnglish = {
            'việt nam': 'vietnam',
            'viet nam': 'vietnam',
            'cộng hòa xã hội chủ nghĩa việt nam': 'vietnam',
            'chxhcn việt nam': 'vietnam',
            'chxhcnvn': 'vietnam',
            'hoa kỳ': 'united states',
            'mỹ': 'united states',
            'anh': 'united kingdom',
            'nhật bản': 'japan',
            'nhật': 'japan',
            'trung quốc': 'china',
            'hàn quốc': 'south korea',
            'hàn': 'south korea',
            'thái lan': 'thailand',
            'thái': 'thailand',
            'đức': 'germany',
            'pháp': 'france',
            'ý': 'italy',
            'tây ban nha': 'spain',
            'hà lan': 'netherlands',
            'thụy sĩ': 'switzerland',
            'thụy điển': 'sweden'
        };

        // Convert Vietnamese to English if possible
        let searchName = normalizedName;
        if (vietnameseToEnglish[normalizedName]) {
            searchName = vietnameseToEnglish[normalizedName];
        }

        // Use mapping from database if available
        if (this.state.countryMapping) {
            // Try exact match first
            let countryId = this.state.countryMapping[searchName];
            if (countryId) {
                return countryId;
            }

            // Try original name
            countryId = this.state.countryMapping[countryName];
            if (countryId) {
                return countryId;
            }

            // Try partial matches
            for (const [key, id] of Object.entries(this.state.countryMapping)) {
                if (typeof key === 'string' && (searchName.includes(key) || key.includes(searchName))) {
                    return id;
                }
            }
        }

        // Fallback to hardcoded mapping if database mapping fails
        const fallbackMap = {
            // Vietnam variations
            'việt nam': '241', 'vietnam': '241', 'vn': '241', 'viet nam': '241', 'việt': '241', 'viet': '241',
            'cộng hòa xã hội chủ nghĩa việt nam': '241', 'chxhcn việt nam': '241', 'chxhcnvn': '241',

            // USA variations
            'hoa kỳ': '233', 'usa': '233', 'united states': '233', 'us': '233', 'mỹ': '233', 'america': '233',
            'united states of america': '233', 'u.s.a': '233', 'u.s': '233',

            // UK variations
            'anh': '231', 'uk': '231', 'united kingdom': '231', 'england': '231', 'great britain': '231',
            'britain': '231', 'gb': '231', 'u.k': '231',

            // Japan variations
            'nhật bản': '113', 'japan': '113', 'jp': '113', 'japanese': '113', 'nhật': '113',

            // China variations
            'trung quốc': '48', 'china': '48', 'cn': '48', 'chinese': '48',
            'people\'s republic of china': '48', 'prc': '48',

            // Korea variations
            'hàn quốc': '121', 'south korea': '121', 'korea': '121', 'kr': '121', 'republic of korea': '121',
            'rok': '121', 'hàn': '121',

            // Other common countries
            'singapore': '197', 'sg': '197',
            'thailand': '217', 'th': '217', 'thái lan': '217', 'thái': '217',
            'malaysia': '132', 'my': '132',
            'indonesia': '103', 'id': '103',
            'philippines': '174', 'ph': '174',
            'australia': '14', 'au': '14',
            'canada': '39', 'ca': '39',
            'germany': '82', 'de': '82', 'đức': '82',
            'france': '75', 'fr': '75', 'pháp': '75',
            'italy': '107', 'it': '107', 'ý': '107',
            'spain': '195', 'es': '195', 'tây ban nha': '195',
            'netherlands': '156', 'nl': '156', 'hà lan': '156',
            'switzerland': '207', 'ch': '207', 'thụy sĩ': '207',
            'sweden': '203', 'se': '203', 'thụy điển': '203'
        };

        // Try fallback exact match
        const fallbackId = fallbackMap[normalizedName];
        if (fallbackId) {
            return fallbackId;
        }

        // Try fallback partial matches
        for (const [key, id] of Object.entries(fallbackMap)) {
            if (normalizedName.includes(key) || key.includes(normalizedName)) {
                return id;
            }
        }

        // Special case for Vietnam (most common)
        if (normalizedName.includes('việt') || normalizedName.includes('viet')) {
            return '241';
        }

        return '';
    }



    removeFrontImage = () => {
        if (this.state.ekycFiles.frontPreview && this.state.ekycFiles.frontPreview.startsWith('blob:')) {
            URL.revokeObjectURL(this.state.ekycFiles.frontPreview);
        }
        this.state.ekycFiles.front = null;
        this.state.ekycFiles.frontPreview = null;
        this.updatePersonalProfileDataSession('frontPreviewBase64', '');
    }

    removeBackImage = () => {
        if (this.state.ekycFiles.backPreview && this.state.ekycFiles.backPreview.startsWith('blob:')) {
            URL.revokeObjectURL(this.state.ekycFiles.backPreview);
        }
        this.state.ekycFiles.back = null;
        this.state.ekycFiles.backPreview = null;
        this.updatePersonalProfileDataSession('backPreviewBase64', '');
    }



    // Hàm tiện ích cập nhật sessionStorage
    updatePersonalProfileDataSession(key, value) {
        let data = {};
        try {
            data = JSON.parse(sessionStorage.getItem('personalProfileData')) || {};
        } catch (e) { data = {}; }
        data[key] = value;
        sessionStorage.setItem('personalProfileData', JSON.stringify(data));
    }

    closeModal = () => {
        this.state.showModal = false;
    };

    // Face Detection Methods
    startFaceDetection() {
        if (this.state.faceDetectionInterval) {
            clearInterval(this.state.faceDetectionInterval);
        }
        // Do not start detection if already captured all required images
        if (this.isAllImagesCaptured()) {
            console.log('🔍 Skipping startFaceDetection: already have all required images');
            return;
        }

        // Ensure camera instructions are set for current phase when starting detection
        this.updateCameraInstructionsForPhase(this.state.currentCapturePhase);

        // Determine detection method based on available APIs
        const detectionMethod = this.getBestDetectionMethod();
        console.log(`🔍 Starting face detection with method: ${detectionMethod}`);

        this.state.faceDetectionInterval = setInterval(() => {
            this.detectFace();
        }, this.constructor.CONFIG.DETECTION.INTERVAL); // Check every 1 second for better responsiveness
    }

    getBestDetectionMethod() {
        if (window.faceapi && this.areModelsLoaded()) {
            return 'Face API';
        } else {
            return 'Fallback (eKYC + Canvas)';
        }
    }

    areModelsLoaded() {
        if (!window.faceapi) {
            return false;
        }

        try {
            return window.faceapi.nets.tinyFaceDetector.isLoaded &&
                window.faceapi.nets.faceLandmark68Net.isLoaded &&
                window.faceapi.nets.faceExpressionNet.isLoaded;
        } catch (error) {
            console.warn('⚠️ Error checking model status:', error);
            return false;
        }
    }

    stopFaceDetection() {
        if (this.state.faceDetectionInterval) {
            clearInterval(this.state.faceDetectionInterval);
            this.state.faceDetectionInterval = null;
        }
        this.state.faceStatus = null;
        console.log('🔍 Face detection stopped');
    }

    async detectFace() {
        const video = document.getElementById('ekycVideoPreview');
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
            // Set waiting status if video not ready
            this.updateFaceStatus('waiting', 'fas fa-clock', 'Chờ camera khởi động...');
            // Ensure camera instructions are set for current phase
            if (!this.state.cameraInstructions) {
                this.updateCameraInstructionsForPhase(this.state.currentCapturePhase);
            }
            return;
        }

        // If already captured all required images, stop further detection to speed up flow
        if (this.isAllImagesCaptured()) {
            this.stopFaceDetection();
            this.updateCameraInstructions('Đã chụp đủ ảnh theo yêu cầu. Sẵn sàng xác thực.');
            return;
        }

        try {
            // Create canvas to analyze video frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // Try Face API first, fallback to eKYC API, then canvas detection
            if (window.faceapi) {
                try {
                    await this.detectFaceWithFaceAPI(canvas);
                } catch (faceApiError) {
                    console.warn('⚠️ Face API detection failed, trying eKYC fallback:', faceApiError);
                    try {
                        await this.detectFaceWithEkycAPI(canvas);
                    } catch (ekycError) {
                        console.warn('⚠️ eKYC API failed, using enhanced canvas detection:', ekycError);
                        this.detectFaceWithCanvas(canvas);
                    }
                }
            } else {
                // Face API not available, try eKYC API first
                try {
                    await this.detectFaceWithEkycAPI(canvas);
                } catch (ekycError) {
                    console.warn('⚠️ eKYC API failed, using enhanced canvas detection:', ekycError);
                    this.detectFaceWithCanvas(canvas);
                }
            }
        } catch (error) {
            console.error('Error in face detection:', error);
            // Show helpful error message to user
            this.updateFaceStatus('error', 'fas fa-exclamation-triangle',
                'Lỗi phát hiện khuôn mặt - Vui lòng thử lại hoặc kiểm tra camera');
            // Final fallback to basic detection
            this.detectFaceWithCanvas(canvas);
        }
    }

    async detectFaceWithFaceAPI(canvas) {
        try {
            // Check if models are loaded before using
            if (!this.areModelsLoaded()) {
                console.warn('⚠️ Face API models not loaded, using fallback detection');
                this.detectFaceWithCanvas(canvas);
                return;
            }

            // Use more lenient detection options
            const options = new window.faceapi.TinyFaceDetectorOptions({
                inputSize: this.constructor.CONFIG.DETECTION.INPUT_SIZE,
                scoreThreshold: this.constructor.CONFIG.DETECTION.SCORE_THRESHOLD
            });

            const detections = await window.faceapi.detectAllFaces(canvas, options)
                .withFaceLandmarks()
                .withFaceExpressions();

            console.log('🔍 Face API detections:', detections);

            if (detections.length === 0) {
                this.updateFaceStatus('no_face', 'fas fa-user-slash', 'Không tìm thấy khuôn mặt - Hãy di chuyển gần camera hơn và đảm bảo ánh sáng tốt');
                return;
            }

            if (detections.length > 1) {
                this.updateFaceStatus('multiple_faces', 'fas fa-users', 'Phát hiện nhiều khuôn mặt - Chỉ một người trong khung hình');
                return;
            }

            const detection = detections[0];
            const landmarks = detection.landmarks;

            // Check face position and orientation with more lenient criteria
            const isCentered = this.checkFaceCentered(landmarks, canvas);
            const isFrontFacing = this.checkFaceFrontFacing(landmarks);
            const isGoodSize = this.checkFaceSize(detection, canvas);

            console.log('📊 Face checks:', { isCentered, isFrontFacing, isGoodSize });

            // More lenient conditions - only require good size and basic positioning
            if (isGoodSize && (isCentered || isFrontFacing)) {
                const currentPhase = this.state.currentCapturePhase;
                const currentCount = this.getCapturedCount(currentPhase);
                const requiredCount = this.state.captureRequirements[currentPhase];

                // Track when face becomes perfect
                if (this.state.perfectFaceStartTime === 0) {
                    this.state.perfectFaceStartTime = Date.now();
                    console.log(`🎯 Face position perfect for ${currentPhase}, starting auto-capture timer...`);
                }

                const timeInPerfectPosition = Date.now() - this.state.perfectFaceStartTime;
                const remainingTime = Math.max(0, 2000 - timeInPerfectPosition);

                if (remainingTime > 0) {
                    this.updateFaceStatus('perfect', 'fas fa-check-circle',
                        `Giữ nguyên vị trí ${this.getPhaseName(currentPhase)} ${Math.ceil(remainingTime / 500)}s (${currentCount}/${requiredCount})`);
                } else {
                    this.updateFaceStatus('perfect', 'fas fa-check-circle',
                        `Đang chụp ${this.getPhaseName(currentPhase)}... (${currentCount}/${requiredCount})`);
                }

                // Auto-capture logic for eKYC API
                if (this.state.autoCaptureEnabled &&
                    currentCount < requiredCount &&
                    timeInPerfectPosition >= 500 &&
                    (!this.state.lastCaptureTime || Date.now() - this.state.lastCaptureTime > 500)) {

                    this.captureImage(true);
                    this.state.perfectFaceStartTime = 0; // Reset timer for next capture
                }
            } else {
                // Face not in perfect position, reset timer
                if (this.state.perfectFaceStartTime > 0) {
                    this.state.perfectFaceStartTime = 0;
                    console.log('🔄 Face moved out of perfect position (eKYC API), resetting timer');
                }

                let message = 'Điều chỉnh khuôn mặt: ';
                let detailedMessage = '';

                if (!isCentered) {
                    message += 'Căn giữa, ';
                    detailedMessage += '• Di chuyển khuôn mặt vào giữa khung\n';
                }
                if (!isFrontFacing) {
                    message += 'Nhìn thẳng, ';
                    detailedMessage += '• Nhìn thẳng\n';
                }
                if (!isGoodSize) {
                    message += 'Tiến gần hơn';
                    detailedMessage += '• Di chuyển gần hơn';
                }

                this.updateFaceStatus('adjusting', 'fas fa-arrows-alt', message, detailedMessage);
            }

        } catch (error) {
            console.error('❌ Face API detection error:', error);
            throw error;
        }
    }

    checkFaceCentered(landmarks, canvas) {
        const nose = landmarks.getNose()[3]; // Bottom of nose
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const distanceFromCenter = Math.sqrt(
            Math.pow(nose.x - centerX, 2) + Math.pow(nose.y - centerY, 2)
        );

        // More lenient - allow face to be further from center
        const maxDistance = Math.min(canvas.width, canvas.height) * 0.25;
        return distanceFromCenter < maxDistance;
    }

    checkFaceFrontFacing(landmarks) {
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Check if eyes are roughly horizontal (front-facing)
        const leftEyeY = leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length;
        const rightEyeY = rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length;

        const eyeHeightDiff = Math.abs(leftEyeY - rightEyeY);
        const maxHeightDiff = 20; // More lenient tolerance

        return eyeHeightDiff < maxHeightDiff;
    }

    checkFaceSize(detection, canvas) {
        const faceArea = detection.detection.box.area;
        const canvasArea = canvas.width * canvas.height;
        const faceRatio = faceArea / canvasArea;

        // More lenient size requirements - face should be between 5% and 50% of canvas area
        return faceRatio >= 0.05 && faceRatio <= 0.5;
    }

    async detectFaceWithEkycAPI(canvas) {
        try {
            // Skip calling detection API if already captured all required images
            if (this.isAllImagesCaptured()) {
                console.log('⏭️ Skipping eKYC detection API: already have all required images');
                return;
            }
            // Convert canvas to blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const file = new File([blob], 'face_frame.jpg', { type: 'image/jpeg' });

            // Create form data
            const formData = new FormData();
            formData.append('frame', file);
            formData.append('expected', this.state.currentCapturePhase); // Expect current phase orientation

            // Call eKYC detection API
            const response = await fetch('/api/ekyc/detection', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('🔍 eKYC detection result:', result);

                // Process detection result
                const currentPhase = this.state.currentCapturePhase;
                const currentCount = this.getCapturedCount(currentPhase);
                const requiredCount = this.state.captureRequirements[currentPhase];

                if (result.orientation === currentPhase && result.match) {
                    // Track when face becomes perfect
                    if (this.state.perfectFaceStartTime === 0) {
                        this.state.perfectFaceStartTime = Date.now();
                        console.log(`🎯 Face position perfect for ${currentPhase} (eKYC API), starting auto-capture timer...`);
                    }

                    const timeInPerfectPosition = Date.now() - this.state.perfectFaceStartTime;
                    const remainingTime = Math.max(0, 1000 - timeInPerfectPosition);

                    if (remainingTime > 0) {
                        this.updateFaceStatus('perfect', 'fas fa-check-circle',
                            `Bắt đầu chụp ${this.getPhaseName(currentPhase)} sau ${Math.ceil(remainingTime / 500)}s (${currentCount}/${requiredCount})`);
                    } else {
                        this.updateFaceStatus('perfect', 'fas fa-check-circle',
                            `Đang chụp ${this.getPhaseName(currentPhase)}... (${currentCount}/${requiredCount})`);
                    }

                    // Auto-capture logic for eKYC API
                    if (this.state.autoCaptureEnabled &&
                        currentCount < requiredCount &&
                        timeInPerfectPosition >= 1000 &&
                        (!this.state.lastCaptureTime || Date.now() - this.state.lastCaptureTime > 1000)) {

                        console.log(`📸 Auto-capturing ${currentPhase} image due to perfect face position (eKYC API)`);
                        this.captureImage(true);
                        this.state.perfectFaceStartTime = 0; // Reset timer for next capture
                    }
                } else {
                    // Face not in perfect position, reset timer
                    if (this.state.perfectFaceStartTime > 0) {
                        this.state.perfectFaceStartTime = 0;
                        console.log(`🔄 Face moved out of perfect position for ${currentPhase} (eKYC API), resetting timer`);
                    }

                    // Set common instruction for all cases
                    this.updateCameraInstructions(`Đang chụp ${this.getPhaseName(currentPhase)}. Vui lòng điều chỉnh khuôn mặt.`);

                    if (result.orientation === 'left') {
                        this.updateFaceStatus('turn_right', 'fas fa-arrow-right', 'Quay sang phải', '• Quay mặt sang phải\n• Giữ nguyên vị trí khi quay');
                    } else if (result.orientation === 'right') {
                        this.updateFaceStatus('turn_left', 'fas fa-arrow-left', 'Quay sang trái', '• Quay mặt sang trái\n• Giữ nguyên vị trí khi quay');
                    } else {
                        this.updateFaceStatus('no_face', 'fas fa-user-slash', 'Không phát hiện khuôn mặt', '• Đặt khuôn mặt vào đúng vị trí\n• Đảm bảo ánh sáng đủ sáng');
                    }
                }
            } else {
                // Fallback to basic detection
                this.detectFaceWithCanvas(canvas);
            }
        } catch (error) {
            console.error('Error calling eKYC detection API:', error);
            // Fallback to basic detection
            this.detectFaceWithCanvas(canvas);
        }
    }

    detectFaceWithCanvas(canvas) {
        // Basic face detection using canvas analysis
        if (!canvas) {
            canvas = document.createElement('canvas');
            const video = document.getElementById('ekycVideoPreview');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
        }

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple skin tone detection
        let skinPixels = 0;
        let totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Basic skin tone detection
            if (r > 95 && g > 40 && b > 20 &&
                Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                Math.abs(r - g) > 15 && r > g && r > b) {
                skinPixels++;
            }
        }

        const skinRatio = skinPixels / totalPixels;

        // Determine status based on skin tone ratio
        let status, icon, message, instructions;

        if (skinRatio < 0.1) {
            // Reset timer if face not detected
            if (this.state.perfectFaceStartTime > 0) {
                this.state.perfectFaceStartTime = 0;
                console.log('🔄 No face detected (Canvas), resetting timer');
            }
            status = 'no_face';
            icon = 'fas fa-user-slash';
            message = 'Không phát hiện khuôn mặt';
            instructions = '';
        } else if (skinRatio < 0.2) {
            // Reset timer if face too far
            if (this.state.perfectFaceStartTime > 0) {
                this.state.perfectFaceStartTime = 0;
                console.log('🔄 Face too far (Canvas), resetting timer');
            }
            status = 'too_far';
            icon = 'fas fa-arrows-alt-v';
            message = 'Khuôn mặt quá xa';
            instructions = 'Vui lòng tiến lại gần hơn';
        } else if (skinRatio > 0.6) {
            // Reset timer if face too close
            if (this.state.perfectFaceStartTime > 0) {
                this.state.perfectFaceStartTime = 0;
                console.log('🔄 Face too close (Canvas), resetting timer');
            }
            status = 'too_close';
            icon = 'fas fa-arrows-alt-v';
            message = 'Khuôn mặt quá gần';
            instructions = 'Vui lòng lùi ra xa hơn';
        } else {
            const currentPhase = this.state.currentCapturePhase;
            const currentCount = this.getCapturedCount(currentPhase);
            const requiredCount = this.state.captureRequirements[currentPhase];

            // Track when face becomes perfect
            if (this.state.perfectFaceStartTime === 0) {
                this.state.perfectFaceStartTime = Date.now();
                console.log(`🎯 Face position perfect for ${currentPhase} (Canvas), starting auto-capture timer...`);
            }

            const timeInPerfectPosition = Date.now() - this.state.perfectFaceStartTime;
            const remainingTime = Math.max(0, 2000 - timeInPerfectPosition);

            if (remainingTime > 0) {
                status = 'perfect';
                icon = 'fas fa-check-circle';
                message = `Giữ nguyên vị trí ${this.getPhaseName(currentPhase)}! Bắt đầu chụp sau ${Math.ceil(remainingTime / 1000)}s (${currentCount}/${requiredCount})`;
                instructions = `Giữ nguyên vị trí ${this.getPhaseName(currentPhase)}!`;
            } else {
                status = 'perfect';
                icon = 'fas fa-check-circle';
                message = `Đang chụp ${this.getPhaseName(currentPhase)}... (${currentCount}/${requiredCount})`;
                instructions = `Đang chụp ${this.getPhaseName(currentPhase)}...`;
            }

            // Auto-capture logic for canvas detection
            if (this.state.autoCaptureEnabled &&
                currentCount < requiredCount &&
                timeInPerfectPosition >= 2000 &&
                (!this.state.lastCaptureTime || Date.now() - this.state.lastCaptureTime > 2000)) {

                console.log(`📸 Auto-capturing ${currentPhase} image due to perfect face position (Canvas)`);
                this.captureImage(true);
                this.state.perfectFaceStartTime = 0; // Reset timer for next capture
            }
        }

        // Only update if status changed
        if (!this.state.faceStatus || this.state.faceStatus.status !== status) {
            this.updateFaceStatus(status, icon, message);
            this.updateCameraInstructions(instructions);
        }
    }

    updateFaceStatus(status, icon, message, detailedMessage = '') {
        this.state.faceStatus = {
            status: status,
            icon: icon,
            message: message,
            detailedMessage: detailedMessage
        };
        console.log('👤 Face status updated:', status, message);
        if (detailedMessage) {
            console.log('📋 Detailed instructions:', detailedMessage);
        }
    }

    getFaceFrameStyle() {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const borderColor = isPerfect ? '#28a745' : '#ffffff';
        const backgroundColor = isPerfect ? 'rgba(40, 167, 69, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        return `width: 100%; height: 100%; border: 2px solid ${borderColor}; border-radius: 50%; position: relative; transition: all 0.3s ease; background: ${backgroundColor}; box-shadow: 0 0 20px ${isPerfect ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 255, 255, 0.2)'}; opacity: 0.8;`;
    }

    getCornerStyle(position) {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? '#28a745' : '#d32f2f';
        const size = '20px';
        const thickness = '3px';

        let style = `position: absolute; width: ${size}; height: ${size}; border: ${thickness} solid ${color}; transition: all 0.3s ease; opacity: 0.7;`;

        switch (position) {
            case 'top-left':
                style += 'top: -2px; left: -2px; border-right: none; border-bottom: none; border-radius: 20px 0 0 0;';
                break;
            case 'top-right':
                style += 'top: -2px; right: -2px; border-left: none; border-bottom: none; border-radius: 0 20px 0 0;';
                break;
            case 'bottom-left':
                style += 'bottom: -2px; left: -2px; border-right: none; border-top: none; border-radius: 0 0 0 20px;';
                break;
            case 'bottom-right':
                style += 'bottom: -2px; right: -2px; border-left: none; border-top: none; border-radius: 0 0 20px 0;';
                break;
        }

        return style;
    }

    getGuideLineStyle(type) {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? 'rgba(40, 167, 69, 0.6)' : 'rgba(211, 47, 47, 0.4)';

        if (type === 'horizontal') {
            return `position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: ${color}; transform: translateY(-50%); transition: all 0.3s ease;`;
        } else {
            return `position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: ${color}; transform: translateX(-50%); transition: all 0.3s ease;`;
        }
    }

    getFacePositionIndicatorStyle() {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? '#28a745' : '#d32f2f';
        return `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120px; height: 160px; border: 2px dashed ${color}; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; transition: all 0.3s ease; opacity: ${isPerfect ? '1' : '0.7'};`;
    }

    getProgressRingStyle() {
        return `position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;`;
    }

    getProgressRingFillStyle() {
        const progress = (this.state.capturedImages.length / 7) * 100;
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? '#28a745' : '#ffffff';
        const circumference = 2 * Math.PI * 140;
        const strokeDasharray = circumference;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        return `stroke: ${color}; stroke-dasharray: ${strokeDasharray}; stroke-dashoffset: ${strokeDashoffset}; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.5s ease;`;
    }

    getFacePositionIndicatorStyle() {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? '#28a745' : '#d32f2f';
        return `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; border: 2px dashed ${color}; border-radius: 50%; transition: all 0.3s ease; opacity: ${isPerfect ? '1' : '0.7'}; z-index: 2;`;
    }

    getCenterCrosshairStyle() {
        return `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; z-index: 3;`;
    }

    getFaceInstructionsStyle() {
        const isPerfect = this.state.faceStatus && this.state.faceStatus.status === 'perfect';
        const color = isPerfect ? '#28a745' : '#d32f2f';
        return `position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.8); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid ${color}; transition: all 0.3s ease;`;
    }

    toString(value) {
        return String(value);
    }

    // Cleanup method
    willUnmount() {
        this.stopCamera();
        this.stopFaceDetection();
        if (this.state.ekycFiles.frontPreview && this.state.ekycFiles.frontPreview.startsWith('blob:')) {
            URL.revokeObjectURL(this.state.ekycFiles.frontPreview);
        }
        if (this.state.ekycFiles.backPreview && this.state.ekycFiles.backPreview.startsWith('blob:')) {
            URL.revokeObjectURL(this.state.ekycFiles.backPreview);
        }
    }
}

// Expose the component globally for the entrypoint to mount
Object.assign(window, { PersonalProfileWidget });

// Auto-mount when script is loaded
if (typeof owl !== 'undefined') {
    const widgetContainer = document.getElementById('personalProfileWidget');
    if (widgetContainer) {
        owl.mount(PersonalProfileWidget, widgetContainer);
    }
} 
