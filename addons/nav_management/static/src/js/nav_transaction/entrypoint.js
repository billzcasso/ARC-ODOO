/** @odoo-module */

import { NavTransactionWidget } from './nav_transaction_widget';
import { mount } from '@odoo/owl';

// Hàm tiện ích để quản lý spinner
function showSpinner() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById('navTransactionWidget');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'none';
    }
}

function hideSpinner() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById('navTransactionWidget');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'block';
    }
}

function showError(message) {
    const widgetContainer = document.getElementById('navTransactionWidget');
    if (widgetContainer) {
        widgetContainer.textContent = '';
        widgetContainer.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger text-center" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `);
        widgetContainer.style.display = 'block';
    }
    hideSpinner();
}

function init() {
    // Kiểm tra flag để đảm bảo chỉ mount một lần
    if (isNavTransactionWidgetMounted) {
        return;
    }

    // Lấy widget container
    const widgetContainer = document.getElementById('navTransactionWidget');
    if (!widgetContainer) {
        showError('Không tìm thấy container widget');
        return;
    }

    // Kiểm tra xem widget đã được mount chưa
    if (widgetContainer.hasChildNodes()) {
        return;
    }

    // Hiển thị spinner
    showSpinner();

    // Dữ liệu mặc định
    let data = {
        funds: [],
        selectedFundId: null
    };

    try {
        // Lấy dữ liệu từ window.navTransactionData
        if (window.navTransactionData) {
            data.funds = window.navTransactionData.funds || [];
            data.selectedFundId = window.navTransactionData.selected_fund_id || null;
        }
    } catch (e) {
        showError('Có lỗi xảy ra khi phân tích dữ liệu: ' + e.message);
        return;
    }

    try {
        // Mount widget với dữ liệu
        mount(NavTransactionWidget, widgetContainer, {
            props: data
        });
        isNavTransactionWidgetMounted = true;
        hideSpinner();
    } catch (error) {
        showError('Có lỗi xảy ra khi tải widget: ' + error.message);
    }
}

// Thử mount ngay lập tức
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 1000);
});

// Fallback: thử mount sau khi window load
window.addEventListener('load', () => {
    setTimeout(init, 2000);
});

// Global function để mount từ bên ngoài
window.mountNavTransactionWidget = init;

// Flag để đảm bảo chỉ mount một lần
let isNavTransactionWidgetMounted = false;
