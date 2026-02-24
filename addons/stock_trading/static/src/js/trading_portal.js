/** @odoo-module **/

import { Component, useState, mount, App } from "@odoo/owl";
import { xml } from "@odoo/owl";

/**
 * Trading Portal Page - Modern OWL Component
 * Hỗ trợ nhiều tài khoản trading
 */
export class TradingPortalPage extends Component {
    static template = xml`
        <div class="trading-portal">
            <div class="container">
                <div class="trading-portal__header">
                    <h1><i class="fas fa-wallet"></i>Tài khoản giao dịch</h1>
                    <p>Quản lý số dư và liên kết tài khoản chứng khoán</p>
                </div>
                
                <t t-if="state.accounts.length > 0">
                    <t t-foreach="state.accounts" t-as="account" t-key="account.id">
                        <div class="mb-4">
                            <div class="balance-card">
                                <div class="balance-card__header">
                                    <h5>
                                        <i class="fas fa-chart-line"></i>
                                        <t t-esc="account.name || account.account"/>
                                        <span class="badge bg-light text-dark ms-2" t-esc="account.account"></span>
                                    </h5>
                                    <button class="balance-card__refresh" 
                                            t-on-click="() => this.refreshAccountBalance(account.id)"
                                            t-att-disabled="state.loadingAccounts[account.id]">
                                        <i class="fas fa-sync-alt" t-att-class="{'fa-spin': state.loadingAccounts[account.id]}"></i>
                                        Làm mới
                                    </button>
                                </div>
                                
                                <div class="balance-card__body">
                                    <t t-if="state.loadingAccounts[account.id]">
                                        <div class="balance-card__loading">
                                            <div class="spinner-border" role="status"></div>
                                            <p>Đang tải số dư...</p>
                                        </div>
                                    </t>
                                    
                                    <t t-elif="account.balance">
                                        <div class="balance-card__grid">
                                            <div class="balance-card__item">
                                                <div class="balance-card__item-label">
                                                    <i class="fas fa-coins"></i> Số dư tiền mặt
                                                </div>
                                                <div class="balance-card__item-value" t-esc="formatCurrency(account.balance.cash_balance)"></div>
                                            </div>
                                            <div class="balance-card__item">
                                                <div class="balance-card__item-label">
                                                    <i class="fas fa-hand-holding-usd"></i> Tiền khả dụng
                                                </div>
                                                <div class="balance-card__item-value" t-esc="formatCurrency(account.balance.available_cash)"></div>
                                            </div>
                                            <div class="balance-card__item">
                                                <div class="balance-card__item-label">
                                                    <i class="fas fa-bolt"></i> Sức mua
                                                </div>
                                                <div class="balance-card__item-value" t-esc="formatCurrency(account.balance.purchasing_power)"></div>
                                            </div>
                                        </div>
                                        <t t-if="account.balance.last_sync">
                                            <div class="balance-card__footer">
                                                <i class="fas fa-clock"></i> Cập nhật: <t t-esc="account.balance.last_sync"/>
                                            </div>
                                        </t>
                                    </t>
                                    
                                    <t t-else="">
                                        <div class="balance-card__empty">
                                            <i class="fas fa-sync"></i>
                                            <h5>Chưa có dữ liệu</h5>
                                            <p>Nhấn "Làm mới" để lấy số dư</p>
                                        </div>
                                    </t>
                                </div>
                            </div>
                        </div>
                    </t>
                </t>
                
                <t t-else="">
                    <div class="mb-4">
                        <div class="balance-card">
                            <div class="balance-card__header">
                                <h5><i class="fas fa-chart-line"></i> Số dư tài khoản</h5>
                            </div>
                            <div class="balance-card__body">
                                <div class="balance-card__empty">
                                    <i class="fas fa-wallet"></i>
                                    <h5>Chưa có tài khoản</h5>
                                    <p>Vui lòng liên kết tài khoản chứng khoán bên dưới</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </t>
                
                <div class="link-section">
                    <div class="link-section__header">
                        <h5><i class="fas fa-link"></i> Liên kết tài khoản mới</h5>
                    </div>
                    <div class="link-section__body">
                        <div class="row">
                            <div class="col-md-4 col-sm-6">
                                <div class="ssi-box" t-on-click="openModal">
                                    <img class="ssi-box__logo" 
                                         src="/stock_trading/static/src/img/logo_ssi.png" 
                                         alt="SSI"/>
                                    <div class="ssi-box__title">SSI</div>
                                    <p class="ssi-box__text">Nhấp để thêm tài khoản</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <t t-if="state.showModal">
                <div class="link-modal__backdrop" t-on-click="closeModal"></div>
                <div class="link-modal__dialog">
                    <div class="link-modal__content">
                        <div class="link-modal__header">
                            <h5><i class="fas fa-link"></i> Liên kết tài khoản SSI</h5>
                            <button class="link-modal__close" t-on-click="closeModal">×</button>
                        </div>
                        <div class="link-modal__body">
                            <t t-if="state.success">
                                <div class="alert alert-success">
                                    <i class="fas fa-check-circle"></i>
                                    <span>Đã liên kết tài khoản thành công! Trang sẽ tự động tải lại...</span>
                                </div>
                            </t>
                            
                            <t t-if="state.formError">
                                <div class="alert alert-danger">
                                    <i class="fas fa-exclamation-circle"></i>
                                    <span t-esc="state.formError"></span>
                                </div>
                            </t>
                            
                            <form t-on-submit="onSubmit">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="consumer_id_input"><i class="fas fa-key"></i>Consumer ID<span class="required">*</span></label>
                                            <input type="text" 
                                                   id="consumer_id_input"
                                                   class="form-control" 
                                                   t-model="state.form.consumer_id" 
                                                   placeholder="Nhập Consumer ID từ SSI"
                                                   required="required"/>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="consumer_secret_input"><i class="fas fa-lock"></i>Consumer Secret<span class="required">*</span></label>
                                            <input type="password" 
                                                   id="consumer_secret_input"
                                                   class="form-control" 
                                                   t-model="state.form.consumer_secret" 
                                                   placeholder="Nhập Consumer Secret"
                                                   required="required"/>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="account_input"><i class="fas fa-credit-card"></i>Số tài khoản<span class="required">*</span></label>
                                    <input type="text" 
                                           id="account_input"
                                           class="form-control" 
                                           t-model="state.form.account" 
                                           placeholder="Nhập số tài khoản SSI"
                                           required="required"/>
                                </div>
                                <div class="form-group">
                                    <label for="private_key_input"><i class="fas fa-file-code"></i>Private Key (Base64)<span class="required">*</span></label>
                                    <textarea class="form-control" 
                                              id="private_key_input"
                                              t-model="state.form.private_key" 
                                              placeholder="Nhập Private Key từ SSI"
                                              required="required"></textarea>
                                    <div class="form-text">Dán Private Key đã được mã hóa Base64</div>
                                </div>
                                
                                <div class="link-modal__footer">
                                    <button type="submit" 
                                            class="btn btn-primary btn-lg" 
                                            t-att-disabled="state.submitting">
                                        <t t-if="state.submitting">
                                            <span class="spinner"></span> Đang xử lý...
                                        </t>
                                        <t t-else="">
                                            <i class="fas fa-link"></i> Liên kết tài khoản
                                        </t>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </t>
        </div>
    `;

    setup() {
        const data = window.tradingPortalData || {};

        // Khởi tạo loadingAccounts object từ accounts
        const loadingAccounts = {};
        (data.accounts || []).forEach(acc => {
            loadingAccounts[acc.id] = false;
        });

        this.state = useState({
            // Accounts array - hỗ trợ nhiều tài khoản
            accounts: data.accounts || [],
            loadingAccounts: loadingAccounts,

            // Backward compatible
            balance: data.balance || null,
            loading: false,
            error: null,

            // Modal
            showModal: false,
            submitting: false,
            success: false,
            formError: null,

            // Form - reset cho tài khoản mới
            form: {
                consumer_id: '',
                consumer_secret: '',
                account: '',
                private_key: '',
            },
        });
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    }

    openModal() {
        // Reset form cho tài khoản mới
        this.state.form = {
            consumer_id: '',
            consumer_secret: '',
            account: '',
            private_key: '',
        };
        this.state.showModal = true;
        this.state.formError = null;
        this.state.success = false;
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.state.showModal = false;
        document.body.style.overflow = '';
    }

    async refreshAccountBalance(accountId) {
        this.state.loadingAccounts[accountId] = true;

        try {
            const response = await fetch('/my-account/get_balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ account_id: accountId }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                throw new Error('Server trả về dữ liệu không hợp lệ');
            }

            const data = await response.json();

            if (data.status === 'success') {
                // Cập nhật balance cho account cụ thể
                const accountIndex = this.state.accounts.findIndex(a => a.id === accountId);
                if (accountIndex !== -1) {
                    this.state.accounts[accountIndex].balance = data.balance;
                }
            }
        } catch (error) {
            console.error('Error refreshing balance:', error);
        } finally {
            this.state.loadingAccounts[accountId] = false;
        }
    }

    // Legacy method cho backward compatibility
    async refreshBalance() {
        if (this.state.accounts.length > 0) {
            await this.refreshAccountBalance(this.state.accounts[0].id);
        }
    }

    async onSubmit(ev) {
        ev.preventDefault();

        this.state.submitting = true;
        this.state.formError = null;
        this.state.success = false;

        try {
            const response = await fetch('/my-account/link_account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify(this.state.form),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                throw new Error('Server trả về dữ liệu không hợp lệ');
            }

            const data = await response.json();

            if (data.status === 'success') {
                this.state.success = true;
                setTimeout(() => window.location.reload(), 2000);
            } else {
                this.state.formError = data.message || 'Không thể liên kết tài khoản';
            }
        } catch (error) {
            console.error('Error linking account:', error);
            this.state.formError = 'Lỗi kết nối: ' + error.message;
        } finally {
            this.state.submitting = false;
        }
    }
}

// Auto-mount when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('trading_portal_page');
    if (container) {
        try {
            const app = new App(TradingPortalPage);
            app.mount(container);
        } catch (error) {
            console.error('Error mounting TradingPortalPage:', error);
            // Fallback
            try {
                mount(TradingPortalPage, container);
            } catch (e) {
                console.error('Fallback mount failed:', e);
            }
        }
    }
});
