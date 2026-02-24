/** @odoo-module */

import { AccessDeniedWidget } from './access_denied_widget';
import { mount } from '@odoo/owl';
import { registry } from "@web/core/registry";

const WIDGET_CONTAINER_ID = "accessDeniedWidget";

function hasContainer() {
    return Boolean(document.getElementById(WIDGET_CONTAINER_ID));
}

function readAccessDeniedData() {
    // Đọc dữ liệu từ window nếu có
    if (window.accessDeniedData) {
        if (typeof window.accessDeniedData === 'string') {
            try {
                return JSON.parse(window.accessDeniedData);
            } catch (error) {
                console.error('Unable to parse access denied data:', error);
                return {};
            }
        }
        return window.accessDeniedData;
    }
    return {};
}

async function mountAccessDeniedWidget() {
    const widgetContainer = document.getElementById(WIDGET_CONTAINER_ID);
    if (!widgetContainer) {
        console.warn('Access denied widget container not found; abort mounting.');
        return;
    }
    
    try {
        const data = readAccessDeniedData();
        
        mount(AccessDeniedWidget, widgetContainer, {
            dev: true,
            props: {
                errorTitle: data.error_title || 'Không có quyền truy cập',
                errorMessage: data.error_message || 'Bạn không có quyền truy cập trang này.',
                allowedTypes: data.allowed_types || [],
            },
        });
        console.log('AccessDeniedWidget mounted successfully');
    } catch (error) {
        console.error('Error mounting AccessDeniedWidget:', error);
        widgetContainer.textContent = '';
        widgetContainer.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger text-center" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Có lỗi xảy ra khi tải trang: ${error.message}
            </div>
        `);
    }
}

// Đợi DOM load xong
document.addEventListener('DOMContentLoaded', async () => {
    if (!hasContainer()) {
        return;
    }
    console.log("DOM Content Loaded - Initializing Access Denied Widget...");
    await mountAccessDeniedWidget();
});

async function init() {
    if (!hasContainer()) {
        return;
    }
    console.log("Initializing Access Denied Widget...");
    await mountAccessDeniedWidget();
}

// Đăng ký hàm init để chạy khi Odoo sẵn sàng
registry.category("website_frontend_ready").add("user_permission_management.access_denied_init", init);

