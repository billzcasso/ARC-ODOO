/** @odoo-module */

import { AssetManagementWidget } from './asset_management_widget';
import { mount } from '@odoo/owl';
import { registry } from "@web/core/registry";

// Biến để theo dõi trạng thái mount
let isMounted = false;

// Hàm mount widget với validation
function mountWidget() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById('asset-management-widget');

    // Kiểm tra các điều kiện cần thiết
    if (!widgetContainer) {
        return false;
    }

    if (isMounted) {
        return false;
    }

    if (!window.assetManagementData) {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        widgetContainer.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-danger py-4';
        errorDiv.textContent = 'Không tìm thấy dữ liệu';
        widgetContainer.appendChild(errorDiv);
        return false;
    }

    try {
        // Validate dữ liệu trước khi mount
        if (!validateData(window.assetManagementData)) {
            throw new Error('Dữ liệu không hợp lệ');
        }

        mount(AssetManagementWidget, widgetContainer, {
            props: window.assetManagementData
        });

        isMounted = true;
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        widgetContainer.style.display = 'block';
        return true;
    } catch (error) {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        widgetContainer.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-danger py-4';
        errorDiv.textContent = 'Có lỗi xảy ra khi tải widget: ' + error.message;
        widgetContainer.appendChild(errorDiv);
        return false;
    }
}

// Hàm validate dữ liệu
function validateData(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Kiểm tra các trường bắt buộc
    const requiredFields = ['totalAssets', 'fundCertificates', 'holdings', 'swapOrders'];
    for (const field of requiredFields) {
        if (!(field in data)) {
            return false;
        }
    }

    // Kiểm tra kiểu dữ liệu
    if (typeof data.totalAssets !== 'number') {
        return false;
    }

    if (!Array.isArray(data.fundCertificates)) {
        return false;
    }

    if (!Array.isArray(data.holdings)) {
        return false;
    }

    if (!data.swapOrders || typeof data.swapOrders !== 'object') {
        return false;
    }

    return true;
}

// Đợi DOM load xong
document.addEventListener('DOMContentLoaded', () => {
    mountWidget();
});

// Thêm timeout để đảm bảo DOM đã sẵn sàng (chỉ nếu chưa mount)
setTimeout(() => {
    if (!isMounted) {
        mountWidget();
    }
}, 1000);

// Đăng ký hàm mountWidget để chạy khi Odoo sẵn sàng
registry.category("website_frontend_ready").add("asset_management.init", mountWidget); 