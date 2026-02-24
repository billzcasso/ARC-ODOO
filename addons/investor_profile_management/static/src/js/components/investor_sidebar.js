// Shared Investor Sidebar Component
// Used across personal_profile, bank_info, address_info, verification widgets

// console.log('Loading InvestorSidebar component...');

const { Component, xml, useState, onMounted } = owl;

/**
 * InvestorSidebar - Shared sidebar component for investor profile pages
 * 
 * Props:
 * - profile: Object containing profile.name
 * - statusInfo: Object containing account_status, profile_status, account_number, referral_code, rm_name, etc.
 * - activePage: String - 'personal' | 'bank' | 'address' | 'verification'
 */
class InvestorSidebar extends Component {
    static template = xml`
        <aside class="investor-sidebar">
            <div class="sidebar-header">
                <div class="logo-container">
                    <i class="fa fa-user-circle"></i>
                </div>
                <h3><t t-esc="props.profile.name || 'Investor'" /></h3>
                <div class="mt-2">
                    <span t-if="props.statusInfo.account_status == 'approved'" class="status-badge status-complete">Đã duyệt</span>
                    <span t-elif="props.statusInfo.account_status == 'pending'" class="status-badge status-incomplete">Chờ duyệt</span>
                    <span t-elif="props.statusInfo.account_status == 'rejected'" class="status-badge status-incomplete">Từ chối</span>
                    <span t-else="" class="status-badge status-incomplete">Chưa có</span>
                </div>
                
                <div class="mt-4 px-2">
                    <div class="d-flex justify-content-between mb-2 small">
                        <span class="text-muted">Số Tài Khoản:</span>
                        <span class="fw-bold text-dark"><t t-esc="props.statusInfo.account_number || '---'" /></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2 small">
                        <span class="text-muted">Mã Giới Thiệu:</span>
                        <span class="fw-bold text-dark"><t t-esc="props.statusInfo.referral_code || '---'" /></span>
                    </div>
                    <div class="d-flex justify-content-between mb-2 small">
                        <span class="text-muted">Hồ sơ:</span>
                        <span t-if="props.statusInfo.profile_status == 'complete'" class="text-success fw-bold">Đã hoàn tất</span>
                        <span t-else="" class="text-warning fw-bold">Chưa hoàn tất</span>
                    </div>
                </div>

                <t t-if="props.statusInfo.rm_name">
                    <div class="mt-3 pt-3 border-top small text-center text-muted">
                        <i class="fa fa-id-card-o me-1"></i> RM: <t t-esc="props.statusInfo.rm_name"/>
                    </div>
                </t>
            </div>
            
            <nav class="sidebar-nav mt-3">
                <a href="/personal_profile" t-att-class="'nav-item' + (props.activePage === 'personal' ? ' active' : '')">
                    <i class="fa fa-user"></i> Thông tin cá nhân
                </a>
                <a href="/bank_info" t-att-class="'nav-item' + (props.activePage === 'bank' ? ' active' : '') + (props.statusInfo.has_bank_info ? ' is-completed' : '')">
                    <i class="fa fa-university"></i> TK Ngân hàng
                </a>
                <a href="/address_info" t-att-class="'nav-item' + (props.activePage === 'address' ? ' active' : '') + (props.statusInfo.has_address_info ? ' is-completed' : '')">
                    <i class="fa fa-map-marker"></i> Thông tin địa chỉ
                </a>
                <a href="/verification" t-att-class="'nav-item' + (props.activePage === 'verification' ? ' active' : '') + (props.statusInfo.ekyc_verified ? ' is-completed' : '')">
                    <i class="fa fa-shield"></i> Xác thực &amp; eKYC
                </a>
            </nav>
        </aside>
    `;

    static props = {
        profile: { type: Object, optional: true },
        statusInfo: { type: Object, optional: true },
        activePage: { type: String, optional: true }
    };

    static defaultProps = {
        profile: {},
        statusInfo: {},
        activePage: 'personal'
    };
}

// Make component globally available
window.InvestorSidebar = InvestorSidebar;
// console.log('InvestorSidebar component loaded and available globally');
