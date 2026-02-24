// Address Information Widget Component
// console.log('Loading AddressInfoWidget component...');

const { Component, xml, useState, onMounted } = owl;

class AddressInfoWidget extends Component {
    static components = { InvestorSidebar: window.InvestorSidebar };

    static template = xml`
        <div class="investor-page">
            <div class="investor-layout">
                <!-- Sidebar -->
                <InvestorSidebar profile="this.state.profile" statusInfo="this.state.statusInfo" activePage="'address'" />
                
                <!-- Main Content -->
                <div class="investor-content">
                    <div class="investor-card">
                        <div class="card-header-styled">
                            <h2>Thông tin địa chỉ</h2>
                            <p>Cập nhật địa chỉ liên hệ và thường trú của bạn</p>
                        </div>
                        
                        <form class="investor-form" t-on-submit.prevent="saveProfile">
                            <div class="row">
                                <div class="col-12 mb-4">
                                     <h5 class="text-primary fw-bold mb-3 border-bottom pb-2">Địa chỉ liên hệ chính</h5>
                                     
                                     <div class="mb-3">
                                          <label for="street" class="form-label">Số nhà, Tên đường <span class="text-danger">*</span></label>
                                          <input id="street" type="text" class="form-control" t-model="state.formData.street" required="required" placeholder="Số nhà, đường, ngõ..." />
                                     </div>
                                     
                                     <div class="row">
                                         <div class="col-md-6 mb-3">
                                              <label for="country_id" class="form-label">Quốc gia <span class="text-danger">*</span></label>
                                              <select id="country_id" t-model="state.formData.country_id" required="required" class="form-select">
                                                <option value="">Chọn quốc gia</option>
                                                <t t-foreach="state.countries" t-as="country" t-key="country.id">
                                                  <option t-att-value="country.id + ''"><t t-esc="country.name" /></option>
                                                </t>
                                              </select>
                                         </div>
                                         <div class="col-md-6 mb-3">
                                              <label for="state_id" class="form-label">Tỉnh/Thành phố <span class="text-danger">*</span></label>
                                              <select id="state_id" t-model="state.formData.state" required="required" class="form-select">
                                                <option value="">Chọn tỉnh/thành phố</option>
                                                <t t-foreach="state.states" t-as="stateItem" t-key="stateItem.id">
                                                  <option t-att-value="stateItem.id + ''" t-att-selected="(stateItem.id + '') === (state.formData.state + '') ? 'selected' : false">
                                                    <t t-esc="stateItem.name" />
                                                  </option>
                                                </t>
                                              </select>
                                         </div>
                                     </div>
                                     
                                     <div class="row">
                                         <div class="col-md-4 mb-3">
                                              <label for="district" class="form-label">Quận/Huyện <span class="text-danger">*</span></label>
                                              <input id="district" type="text" class="form-control" t-model="state.formData.district" required="required" />
                                         </div>
                                         <div class="col-md-4 mb-3">
                                              <label for="ward" class="form-label">Phường/Xã <span class="text-danger">*</span></label>
                                              <input id="ward" type="text" class="form-control" t-model="state.formData.ward" required="required" />
                                         </div>
                                         <div class="col-md-4 mb-3">
                                              <label for="zip" class="form-label">Mã bưu điện</label>
                                              <input id="zip" type="text" class="form-control" t-model="state.formData.zip" />
                                         </div>
                                     </div>
                                     <div class="form-text text-muted mb-2"><i class="fa fa-info-circle"></i> (*) Thông tin bắt buộc</div>
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


    // Helper to normalize state/province names for better matching
    normalizeStateName(name) {
        if (!name) return '';
        let s = String(name).toLowerCase().trim();
        // Remove common Vietnamese prefixes
        s = s.replace(/^tỉnh\s+/, '');
        s = s.replace(/^thành phố\s+/, '');
        s = s.replace(/^tp\.?\s*/, '');
        return s.trim();
    }

    // Remove Vietnamese diacritics for broad matching
    removeDiacritics(str) {
        if (!str) return '';
        return String(str)
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '')
            .toLowerCase();
    }

    // Known aliases mapping for difficult provinces/cities
    getAliasesForStateName(name) {
        const n = this.normalizeStateName(name);
        const noAcc = this.removeDiacritics(n);
        const aliases = new Set([n, noAcc]);
        // Common special cases
        if (noAcc.includes('ho chi minh')) {
            ['hcm', 'hcmc', 'sai gon', 'tp hcm', 'tp.hcm', 'tphcm'].forEach(a => aliases.add(a));
        }
        if (noAcc === 'ha noi') {
            ['hn', 'tp hn', 'tp.hn', 'ha noi'].forEach(a => aliases.add(a));
        }
        if (noAcc === 'da nang') {
            ['dn', 'danang', 'da nng'].forEach(a => aliases.add(a));
        }
        if (noAcc.includes('thua thien hue') || noAcc === 'hue') {
            ['hue'].forEach(a => aliases.add(a));
        }
        if (noAcc.includes('ba ria') || noAcc.includes('vung tau')) {
            ['brvt', 'ba ria vung tau', 'vung tau'].forEach(a => aliases.add(a));
        }
        return Array.from(aliases);
    }

    // Resolve an Odoo state by any name variant against the loaded states list (IDs from Odoo)
    resolveStateByAnyName(inputName) {
        if (!inputName || !Array.isArray(this.state.states)) return null;
        const targetNorm = this.normalizeStateName(inputName);
        const targetNoAcc = this.removeDiacritics(targetNorm);

        // Pass 1: direct exact (normalized) match
        let found = this.state.states.find(s => this.normalizeStateName(s.name) === targetNorm);
        if (found) return found;

        // Pass 2: contains/contained (normalized)
        found = this.state.states.find(s => {
            const sn = this.normalizeStateName(s.name);
            return sn.includes(targetNorm) || targetNorm.includes(sn);
        });
        if (found) return found;

        // Pass 3: de-accent exact and contains
        found = this.state.states.find(s => {
            const sn = this.removeDiacritics(this.normalizeStateName(s.name));
            return sn === targetNoAcc || sn.includes(targetNoAcc) || targetNoAcc.includes(sn);
        });
        if (found) return found;

        // Pass 4: alias-based search using states' own aliases
        // Build alias table once per call; list is small
        for (const s of this.state.states) {
            const aliases = this.getAliasesForStateName(s.name);
            if (aliases.some(a => a === targetNorm || a === targetNoAcc || a.includes(targetNorm) || a.includes(targetNoAcc) || targetNorm.includes(a) || targetNoAcc.includes(a))) {
                return s;
            }
        }

        return null;
    }

    setup() {
        // console.log("🎯 AddressInfoWidget - setup called!");

        this.state = useState({
            loading: true,
            profile: {},
            statusInfo: {},
            formData: {
                street: '',
                state: '',
                zip: '',
                district: '',
                ward: '',
                country_id: '',
            },
            activeTab: 'address',
            countries: [],
            states: [],
            pendingStateName: '',
            showModal: false,
            modalTitle: '',
            modalMessage: '',
        });

        onMounted(async () => {
            // Hide loading spinner
            const loadingSpinner = document.getElementById('loadingSpinner');
            const widgetContainer = document.getElementById('addressInfoWidget');

            if (loadingSpinner && widgetContainer) {
                loadingSpinner.style.display = 'none';
                widgetContainer.style.display = 'block';
            }
            // Reset storage nếu user đổi
            const currentUserId = window.currentUserId || (window.odoo && window.odoo.session_info && window.odoo.session_info.uid);
            const storedUserId = sessionStorage.getItem('addressInfoUserId');
            if (storedUserId && String(storedUserId) !== String(currentUserId)) {
                sessionStorage.removeItem('addressInfoData');
                sessionStorage.removeItem('addressInfoUserId');
            }
            // Load profile data and status info
            await Promise.all([
                this.loadProfileData(),
                this.loadCountries()
            ]);
            await this.loadInitialFormData(); // Load form data after profile and countries are loaded
            await this.loadStatusInfo();
            // Load states theo country_id đầu tiên (nếu có)
            if (this.state.formData.country_id) {
                await this.loadStates(this.state.formData.country_id);
            }

            this.state.loading = false;
        });
        // Theo dõi thay đổi country_id để load lại states
        this.observeCountryChange();
    }

    async loadInitialFormData() {
        // First, try to load from sessionStorage
        const storedData = sessionStorage.getItem('addressInfoData');

        // Check for individual city/state in session storage as fallback
        const cityFromSession = sessionStorage.getItem('addressInfo_city');
        const stateFromSession = sessionStorage.getItem('addressInfo_state');

        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);

                // Check if this is fresh eKYC address data
                const isEkycData = parsedData.permanent_address || parsedData.birth_place || parsedData.hometown;

                if (isEkycData) {
                    // console.log("🔄 Fresh eKYC address data detected, applying to form");
                    // Ensure Vietnam states are loaded first to resolve province immediately
                    try {
                        if (!this.state.formData.country_id) {
                            const vn = this.state.countries.find(c => {
                                const name = (c.name || '').toLowerCase();
                                return name.includes('vietnam') || name.includes('việt nam') || name.includes('viet nam');
                            });
                            if (vn && vn.id !== undefined && vn.id !== null) {
                                this.state.formData.country_id = String(vn.id);
                            }
                        }
                        if (this.state.formData.country_id) {
                            await this.loadStates(this.state.formData.country_id);
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not pre-load states before parsing address:', e);
                    }

                    // Parse eKYC address data
                    if (parsedData.permanent_address) {
                        this.parseAddressString(parsedData.permanent_address);
                    }
                    if (parsedData.birth_place && !this.state.formData.street) {
                        this.parseAddressString(parsedData.birth_place);
                    }
                    if (parsedData.hometown && !this.state.formData.street) {
                        this.parseAddressString(parsedData.hometown);
                    }

                    // console.log("✅ eKYC address data applied to form:", this.state.formData);
                } else {
                    // Regular session storage data
                    // Ensure country_id is string if present, do NOT wipe valid numeric IDs
                    if (parsedData.country_id !== undefined && parsedData.country_id !== null && parsedData.country_id !== '') {
                        parsedData.country_id = String(parsedData.country_id);
                    } else {
                        parsedData.country_id = '';
                    }
                    parsedData.state = String(parsedData.state || '');

                    // Ensure city is set from the state if not already present
                    if (!parsedData.city && parsedData.state) {
                        const selectedState = this.state.states.find(s => String(s.id) === parsedData.state);
                        if (selectedState) {
                            parsedData.city = selectedState.name;
                        }
                    }

                    Object.assign(this.state.formData, parsedData);
                    // console.log("✅ Form data loaded from sessionStorage:", this.state.formData);
                }
            } catch (error) {
                console.error("❌ Error parsing stored address data:", error);
            }
        }
        // Check for individual city/state in session storage as fallback
        else if (cityFromSession || stateFromSession) {
            if (cityFromSession) this.state.formData.city = cityFromSession;
            if (stateFromSession) this.state.formData.state = stateFromSession;
            /* console.log("✅ Loaded city/state from individual session storage:", { 
                city: cityFromSession, 
                state: stateFromSession 
            }); */
        }
        // Load from profile if available
        else if (this.state.profile && Object.keys(this.state.profile).length > 0) {
            this.state.formData.street = this.state.profile.street || '';
            this.state.formData.city = this.state.profile.city || '';
            this.state.formData.district = this.state.profile.district || '';
            this.state.formData.ward = this.state.profile.ward || '';
            this.state.formData.state = this.state.profile.state_id ? String(this.state.profile.state_id) : '';
            this.state.formData.zip = this.state.profile.zip || '';
            // console.log("✅ Form data initialized with existing profile data:", this.state.formData);
        } else {
            // console.log("ℹ️ No existing address data found, using default values");
        }
    }

    parseAddressString(addressString) {
        // Basic address parsing for Vietnamese addresses
        if (!addressString) return;

        // Set country by name (default to Vietnam/Việt Nam if present in list)
        const vn = this.state.countries.find(c => {
            const name = (c.name || '').toLowerCase();
            return name.includes('vietnam') || name.includes('việt nam') || name.includes('viet nam');
        });
        if (vn && vn.id !== undefined && vn.id !== null) {
            this.state.formData.country_id = String(vn.id);
        }

        // Try to extract components from address string
        // Format: "Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố"
        const parts = addressString.split(',').map(part => part.trim());

        if (parts.length >= 1) {
            this.state.formData.street = parts[0];
        }
        if (parts.length >= 2) {
            this.state.formData.ward = parts[1];
        }
        if (parts.length >= 3) {
            this.state.formData.district = parts[2];
        }
        if (parts.length >= 4) {
            // Find state by name
            const stateName = parts[3];
            const foundState = this.resolveStateByAnyName(stateName);
            if (foundState) {
                this.state.formData.state = String(foundState.id);
                if (!this.state.formData.city) {
                    this.state.formData.city = foundState.name;
                }
            } else {
                // Defer matching until states are loaded
                this.state.pendingStateName = stateName;
            }
        }
        // If address string contains a country part (5th element), try to map it as well
        if (parts.length >= 5) {
            const countryName = parts[4].toLowerCase();
            const matched = this.state.countries.find(c => (c.name || '').toLowerCase().includes(countryName) || countryName.includes((c.name || '').toLowerCase()));
            if (matched) {
                this.state.formData.country_id = String(matched.id);
            }
        }

        /* console.log("📍 Parsed address components:", {
            street: this.state.formData.street,
            ward: this.state.formData.ward,
            district: this.state.formData.district,
            state: this.state.formData.state
        }); */
    }

    showEkycSuccessMessage() {
        // Show success message for eKYC address data
        this.state.modalTitle = 'Thành công';
        this.state.modalMessage = 'Thông tin địa chỉ từ CCCD đã được tự động điền vào form. Vui lòng kiểm tra và lưu thông tin.';
        this.state.showModal = true;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.state.showModal = false;
        }, 5000);
    }

    async loadCountries() {
        try {
            const response = await fetch('/get_countries');
            const data = await response.json();
            this.state.countries = data;
            // console.log("📥 Countries loaded:", data);
        } catch (error) {
            console.error("❌ Error fetching countries:", error);
            // Fallback countries, ensure these are loaded for testing if API fails
            this.state.countries = [
                { id: 1, name: 'Vietnam' },
                { id: 2, name: 'USA' },
                { id: 3, name: 'UK' }
            ];
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
            // console.log("💾 Lưu Thông Tin địa chỉ lên Odoo...");
            const addressData = { ...this.state.formData };

            // Ensure country_id is a valid string
            if (addressData.country_id === null || addressData.country_id === undefined) {
                addressData.country_id = '';
            } else {
                addressData.country_id = String(addressData.country_id);
            }

            // Ensure state is a valid string
            addressData.state = String(addressData.state || '');

            // Get the selected state name for the city field
            const selectedState = this.state.states.find(s => String(s.id) === addressData.state);
            if (selectedState) {
                // Add city name to the address data
                addressData.city = selectedState.name;
            }

            // Validate required fields
            if (!addressData.country_id || isNaN(Number(addressData.country_id))) {
                alert('Bạn chưa chọn quốc gia hoặc quốc gia không hợp lệ!');
                console.error('Country_id invalid:', addressData.country_id);
                return;
            }
            if (!addressData.state || isNaN(Number(addressData.state))) {
                alert('Bạn chưa chọn tỉnh/thành hoặc tỉnh/thành không hợp lệ!');
                console.error('State invalid:', addressData.state);
                return;
            }

            // Log the data being sent
            // console.log('📤 Sending address data to server:', addressData);

            // Call API to save to Odoo
            const response = await fetch('/save_address_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addressData)
            });

            const result = await response.json();
            if (result.success) {
                // Save to session storage for verification step
                sessionStorage.setItem('addressInfoSaved', 'true');
                sessionStorage.setItem('addressInfoData', JSON.stringify(addressData));
                sessionStorage.setItem('addressInfoUserId', String(window.currentUserId || ''));

                // Also save to a more accessible location for verification
                sessionStorage.setItem('addressInfo_city', addressData.city || '');
                sessionStorage.setItem('addressInfo_state', addressData.state || '');

                this.state.modalTitle = 'Thành công';
                this.state.modalMessage = 'Lưu Thông Tin địa chỉ thành công!';
                this.state.showModal = true;

                // Redirect to verification after a short delay
                setTimeout(() => { window.location.href = '/verification'; }, 1500);
            } else {
                alert('Lỗi khi lưu thông tin địa chỉ: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error("❌ Error saving address info data:", error);
            alert("Failed to save address information. Please try again.");
        }
    }

    closeModal = () => {
        this.state.showModal = false;
    };

    async loadProfileData() {
        try {
            console.log("🔄 Loading address profile data from server...");
            const response = await fetch('/data_address_info');
            const data = await response.json();
            console.log("📥 Address profile data received:", data);

            if (data && data.length > 0) {
                // console.log("✅ Address profile data loaded successfully:", this.state.profile);
            } else {
                // console.log("ℹ️ No existing address profile data found on server");
                this.state.profile = {};
            }
        } catch (error) {
            console.error("❌ Error fetching address profiles:", error);
            this.state.profile = {};
        }
    }

    observeCountryChange() {
        let lastCountry = this.state.formData.country_id;
        setInterval(async () => {
            if (this.state.formData.country_id !== lastCountry) {
                lastCountry = this.state.formData.country_id;
                const prevStateId = this.state.formData.state ? String(this.state.formData.state) : '';
                await this.loadStates(this.state.formData.country_id);
                // Try to preserve previous state if it belongs to the new country
                if (prevStateId) {
                    const stillExists = this.state.states.some(s => String(s.id) === prevStateId);
                    if (stillExists) {
                        this.state.formData.state = prevStateId;
                    } else {
                        // Not in new list, try deferred/pending name or clear
                        const match = this.state.pendingStateName ? this.resolveStateByAnyName(this.state.pendingStateName) : null;
                        if (match) {
                            this.state.formData.state = String(match.id);
                            if (!this.state.formData.city) {
                                this.state.formData.city = match.name;
                            }
                            this.state.pendingStateName = '';
                            // console.log('✅ Applied deferred state selection after country change:', match);
                        } else {
                            this.state.formData.state = '';
                        }
                    }
                } else {
                    // No previous state, try pending name
                    if (this.state.pendingStateName) {
                        const match = this.resolveStateByAnyName(this.state.pendingStateName);
                        if (match) {
                            this.state.formData.state = String(match.id);
                            if (!this.state.formData.city) {
                                this.state.formData.city = match.name;
                            }
                            this.state.pendingStateName = '';
                            // console.log('✅ Applied deferred state selection after country change:', match);
                        }
                    }
                }
            }
        }, 500);
    }

    async loadStates(country_id) {
        if (!country_id) {
            this.state.states = [];
            return;
        }
        try {
            const response = await fetch(`/get_states?country_id=${country_id}`);
            const data = await response.json();
            this.state.states = data;
            // If we have a pending state name from earlier parsing, try to match now
            if (this.state.pendingStateName) {
                const match = this.resolveStateByAnyName(this.state.pendingStateName);
                if (match) {
                    this.state.formData.state = String(match.id);
                    if (!this.state.formData.city) {
                        this.state.formData.city = match.name;
                    }
                    this.state.pendingStateName = '';
                    console.log('✅ Applied deferred state selection:', match);
                }
            }
        } catch (error) {
            this.state.states = [];
        }
    }
}

// Make component globally available
window.AddressInfoWidget = AddressInfoWidget;
// console.log('AddressInfoWidget component loaded and available globally');

// Auto-mount when script is loaded
if (typeof owl !== 'undefined') {
    const widgetContainer = document.getElementById('addressInfoWidget');
    if (widgetContainer) {
        // console.log('Mounting AddressInfoWidget');
        owl.mount(AddressInfoWidget, widgetContainer);
    }
}