/** @odoo-module **/

import { Component, useState, mount, onMounted, xml } from "@odoo/owl";

// Constants
const OTP_CONFIG = {
    LENGTH: 6,
    FOCUS_DELAY_MS: 100,
    INPUT_MOVE_DELAY_MS: 0,
    INPUT_SELECTOR: '.smart-otp-input',
    DIGIT_REGEX: /^\d$/,
    NON_DIGIT_REGEX: /[^0-9]/g,
    TIMEOUT_SECONDS: 60,
    TIMER_INTERVAL_MS: 1000,
};

const MESSAGES = {
    TITLE_SMART: 'Xác thực Smart OTP',
    TITLE_SMS_EMAIL: 'Xác thực OTP',
    DESCRIPTION_SMART: 'Vui lòng kiểm tra mã Smart OTP trên ứng dụng SSI Iboard Pro',
    DESCRIPTION_SMS_EMAIL: 'Vui lòng nhập mã OTP đã được gửi qua SMS hoặc Email',
    INSTRUCTION_TITLE: 'Hướng dẫn:',
    INSTRUCTION_STEP_1_SMART: 'Mở ứng dụng SSI Iboard Pro trên điện thoại của bạn',
    INSTRUCTION_STEP_1_SMS_EMAIL: 'Kiểm tra SMS hoặc Email để lấy mã OTP',
    INSTRUCTION_STEP_2_SMART: 'Kiểm tra mã Smart OTP (6 chữ số)',
    INSTRUCTION_STEP_2_SMS_EMAIL: 'Lấy mã OTP 6 chữ số từ SMS hoặc Email',
    INSTRUCTION_STEP_3: 'Nhập mã OTP vào các ô bên dưới',
    LABEL_INPUT: 'Nhập mã OTP',
    BUTTON_CANCEL: 'Hủy',
    BUTTON_CONFIRM: 'Xác nhận',
    BUTTON_PROCESSING: 'Đang xử lý...',
    ERROR_INVALID_OTP: 'Mã OTP không hợp lệ',
    ERROR_INCOMPLETE_OTP: 'Vui lòng nhập đầy đủ 6 số OTP',
    TIMER_PREFIX: 'Thời gian còn lại:',
    TIMER_SUFFIX: 'giây',
};

const APP_NAME = 'SSI Iboard Pro';

export class SmartOtpModal extends Component {
    static template = xml`
        <div t-if="props.show" class="smart-otp-overlay">
            <div class="smart-otp-modal">
                <!-- Close Button -->
                <button type="button" class="smart-otp-close" t-on-click="onClose">
                    <i class="fas fa-times"></i>
                </button>
                
                <!-- Header -->
                <div class="smart-otp-header">
                    <div t-att-class="'otp-icon ' + state.iconState">
                        <i t-att-class="getIconClass()"></i>
                    </div>
                    <h3 class="otp-title"><t t-esc="getTitle()"/></h3>
                    <p class="otp-subtitle"><t t-esc="getDescription()"/></p>
                </div>
                
                <!-- Error Message -->
                <div t-if="state.error" class="otp-error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <span><t t-esc="state.error"/></span>
                </div>
                
                <!-- Success Message -->
                <div t-if="state.success" class="otp-success-message">
                    <i class="fas fa-check-circle"></i>
                    <span>Xác thực thành công!</span>
                </div>
                
                <!-- OTP Input Container -->
                <div class="smart-otp-input-container">
                    <div class="otp-input-group">
                        <t t-foreach="otpIndices" t-as="i" t-key="i">
                            <input 
                                type="text" 
                                maxlength="1" 
                                t-att-class="'otp-input ' + (state.otpCodes[i] ? 'filled' : '') + (state.error ? ' error' : '')"
                                t-att-data-index="i"
                                t-att-value="state.otpCodes[i]"
                                t-on-input="onOTPInput"
                                t-on-keydown="onOTPKeydown"
                                inputmode="numeric"
                                pattern="[0-9]*"
                            />
                        </t>
                    </div>
                </div>
                
                <!-- Timer -->
                <div class="otp-timer-container" t-att-class="{hidden: state.loading}">
                    <p class="otp-timer">
                        <i class="fas fa-clock me-1"></i>
                        <t t-esc="messages.TIMER_PREFIX"/> 
                        <span class="timer-value"><t t-esc="state.timer"/></span> 
                        <t t-esc="messages.TIMER_SUFFIX"/>
                    </p>
                </div>
                
                <!-- Action Buttons -->
                <div class="smart-otp-actions">
                    <button 
                        type="button" 
                        t-att-class="'otp-confirm-btn ' + (state.loading ? 'loading' : '')"
                        t-att-disabled="!isValid() || state.loading"
                        t-on-click="onVerify"
                    >
                        <t t-if="state.loading">
                            <div class="spinner"></div>
                        </t>
                        <t t-else="">
                            <i class="fas fa-check me-2"></i>
                            <t t-esc="messages.BUTTON_CONFIRM"/>
                        </t>
                    </button>
                    <button type="button" class="otp-cancel-btn" t-on-click="onClose">
                        <t t-esc="messages.BUTTON_CANCEL"/>
                    </button>
                </div>
                

            </div>
        </div>
    `;


    setup() {
        this.messages = MESSAGES;
        this.config = OTP_CONFIG;
        // Lấy loại OTP từ props, default là 'smart'
        this.otpType = this.props.otpType || 'smart';
        this._initializeState();
        this._initializeIndices();
        this._setupFocusOnMount();
    }

    getTitle() {
        return this.otpType === 'sms_email' ? this.messages.TITLE_SMS_EMAIL : this.messages.TITLE_SMART;
    }

    getDescription() {
        return this.otpType === 'sms_email' ? this.messages.DESCRIPTION_SMS_EMAIL : this.messages.DESCRIPTION_SMART;
    }

    getInstructionStep1() {
        return this.otpType === 'sms_email' ? this.messages.INSTRUCTION_STEP_1_SMS_EMAIL : this.messages.INSTRUCTION_STEP_1_SMART;
    }

    getInstructionStep2() {
        return this.otpType === 'sms_email' ? this.messages.INSTRUCTION_STEP_2_SMS_EMAIL : this.messages.INSTRUCTION_STEP_2_SMART;
    }

    getIconClass() {
        if (this.state.success) return 'fas fa-check';
        if (this.state.error) return 'fas fa-times';
        return 'fas fa-shield-alt';
    }

    _initializeState() {
        this.state = useState({
            otpCodes: Array(this.config.LENGTH).fill(''),
            error: '',
            success: false,
            loading: false,
            timer: this.config.TIMEOUT_SECONDS,
            iconState: '' // 'success' hoặc 'error' hoặc ''
        });
        this.timerInterval = null;
    }

    _initializeIndices() {
        this.otpIndices = Array.from({ length: this.config.LENGTH }, (_, i) => i);
    }

    _setupFocusOnMount() {
        onMounted(() => {
            setTimeout(() => {
                this._focusInput(0);
            }, this.config.FOCUS_DELAY_MS);

            // Khởi động timer đếm ngược
            this._startTimer();
        });
    }

    _startTimer() {
        // Clear timer cũ nếu có
        this._clearTimer();

        // Reset timer về giá trị ban đầu
        this.state.timer = this.config.TIMEOUT_SECONDS;

        // Bắt đầu đếm ngược
        this.timerInterval = setInterval(() => {
            if (this.state.timer > 0) {
                this.state.timer--;
            } else {
                // Hết thời gian - tự động đóng popup
                this._clearTimer();
                this._handleTimeout();
            }
        }, this.config.TIMER_INTERVAL_MS);
    }

    _clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _handleTimeout() {
        // Đóng popup khi hết thời gian
        this._closePopup();
    }

    isValid() {
        return this.state.otpCodes.every(code => this.config.DIGIT_REGEX.test(code));
    }

    _getOTPInputs(parentElement) {
        return parentElement?.querySelectorAll(this.config.INPUT_SELECTOR) || [];
    }

    _focusInput(index) {
        const inputs = this._getOTPInputs(document);
        if (inputs && inputs[index]) {
            inputs[index].focus();
        }
    }

    _sanitizeInputValue(value) {
        return value.replace(this.config.NON_DIGIT_REGEX, '').slice(0, 1);
    }

    _moveToNextInput(currentIndex) {
        if (currentIndex >= this.config.LENGTH - 1) {
            return;
        }

        // Sử dụng document để tìm inputs thay vì parentElement (OWL compatibility)
        setTimeout(() => {
            const inputs = document.querySelectorAll('.otp-input');
            if (inputs && inputs[currentIndex + 1]) {
                inputs[currentIndex + 1].focus();
            }
        }, this.config.INPUT_MOVE_DELAY_MS);
    }

    _moveToPreviousInput(currentIndex) {
        if (currentIndex <= 0) {
            return;
        }

        setTimeout(() => {
            const inputs = document.querySelectorAll('.otp-input');
            if (inputs && inputs[currentIndex - 1]) {
                inputs[currentIndex - 1].focus();
            }
        }, this.config.INPUT_MOVE_DELAY_MS);
    }

    _clearInputAtIndex(index) {
        this.state.otpCodes[index] = '';
    }

    _updateInputValue(index, value) {
        this.state.otpCodes[index] = value;
        this.state.error = '';
    }

    onOTPInput(ev) {
        const index = parseInt(ev.target.dataset.index);
        const sanitizedValue = this._sanitizeInputValue(ev.target.value);

        this._updateInputValue(index, sanitizedValue);
        ev.target.value = sanitizedValue;

        if (sanitizedValue) {
            this._moveToNextInput(index);
        }
    }

    onOTPKeydown(ev) {
        const index = parseInt(ev.target.dataset.index);
        const isBackspace = ev.key === 'Backspace';
        const hasValue = !!ev.target.value;

        if (isBackspace && hasValue) {
            this._clearInputAtIndex(index);
            ev.target.value = '';
            return;
        }

        if (isBackspace && !hasValue) {
            this._moveToPreviousInput(index);
        }
    }

    _getOTPCode() {
        return this.state.otpCodes.join('');
    }

    _validateOTPCode() {
        if (!this.isValid()) {
            this.state.error = this.messages.ERROR_INCOMPLETE_OTP;
            return false;
        }
        return true;
    }

    _setLoadingState(loading) {
        this.state.loading = loading;
    }

    _setError(message) {
        this.state.error = message || this.messages.ERROR_INVALID_OTP;
        this.state.iconState = 'error';
        this.state.success = false;
    }

    _clearError() {
        this.state.error = '';
        this.state.iconState = '';
    }

    _setSuccess() {
        this.state.success = true;
        this.state.iconState = 'success';
        this.state.error = '';
    }



    async onVerify() {
        if (!this._validateOTPCode() || this.state.loading) {
            return;
        }

        const otp = this._getOTPCode();
        this._setLoadingState(true);
        this._clearError();

        // Dừng timer khi đang verify
        this._clearTimer();

        try {
            if (typeof this.props.onConfirm === 'function') {
                await this.props.onConfirm(otp);
                // Xác nhận thành công - hiển thị icon xanh
                this._setSuccess();
                // Đợi một chút để user thấy trạng thái success
                await new Promise(r => setTimeout(r, 500));
                // Đóng popup
                this._closePopup();
            }
        } catch (error) {
            // Lỗi - hiển thị icon đỏ
            this._setError(error?.message || this.messages.ERROR_INVALID_OTP);
            this._setLoadingState(false);
            // Khởi động lại timer nếu verify thất bại
            this._startTimer();
        }
    }

    _closePopup() {
        // Dừng timer trước khi đóng
        this._clearTimer();

        if (typeof this.props.onClose === 'function') {
            this.props.onClose();
        }
    }

    _handleVerifyError(error) {
        this._setError(error?.message);
    }

    onClose() {
        // Dừng timer khi đóng popup
        this._clearTimer();

        if (typeof this.props.onClose === 'function') {
            this.props.onClose();
        }
    }

    // Cleanup khi component unmount
    willUnmount() {
        this._clearTimer();
    }
}

function createContainer() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
}

function createProps(options, cleanup) {
    return {
        show: true,
        otpType: options.otpType || 'smart', // Lấy loại OTP từ options
        onConfirm: async (otp) => {
            if (typeof options.onConfirm === 'function') {
                await options.onConfirm(otp);
            }
            // Cleanup sau khi callback hoàn tất để đảm bảo container được xóa
            cleanup();
        },
        onClose: () => {
            if (typeof options.onClose === 'function') {
                options.onClose();
            }
            // Cleanup khi đóng popup (khi user click Hủy hoặc close button)
            cleanup();
        }
    };
}

function cleanupContainer(container) {
    if (container && container.parentNode) {
        container.parentNode.removeChild(container);
    }
}

function mountComponent(container, props) {
    try {
        mount(SmartOtpModal, container, { props });
    } catch (error) {
        console.error('Error mounting SmartOtpModal:', error);
        cleanupContainer(container);
        throw error;
    }
}

export function openSmartOtp(options = {}) {
    // Find or create a container for the OTP modal
    let container = document.querySelector('#smart-otp-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'smart-otp-container';
        // Container không cần style - để overlay SCSS xử lý full-screen positioning
        document.body.appendChild(container);
    }

    let isCleanedUp = false;
    const cleanup = () => {
        if (!isCleanedUp && container && container.parentNode) {
            isCleanedUp = true;
            container.innerHTML = '';
            // Xóa container khỏi DOM sau khi cleanup
            container.parentNode.removeChild(container);
        }
    };

    const props = createProps(options, cleanup);

    mountComponent(container, props);

    return { close: cleanup };
}

// Expose constants and config for testing/debugging
SmartOtpModal.OTP_CONFIG = OTP_CONFIG;
SmartOtpModal.MESSAGES = MESSAGES;

window.FundManagementSmartOTP = {
    open: openSmartOtp
};

