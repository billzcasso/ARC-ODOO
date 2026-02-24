/** @odoo-module */

import { UserPermissionWidget } from './user_permission_widget';
import { SidebarPanel } from "@fund_management_dashboard/js/dashboard/sidebar_panel";
import { mount } from '@odoo/owl';
import { registry } from "@web/core/registry";

const SIDEBAR_CONTAINER_ID = "sidebarContainer";
const WIDGET_CONTAINER_ID = "userPermissionWidget";
const USER_PERMISSION_DATA_SCRIPT_ID = "fmd-user-permission-data";

function hasContainers() {
    return Boolean(document.getElementById(SIDEBAR_CONTAINER_ID) && document.getElementById(WIDGET_CONTAINER_ID));
}

function displayError(message) {
    if (typeof window.showError === 'function') {
        window.showError(message);
        return;
    }
    const widgetContainer = document.getElementById(WIDGET_CONTAINER_ID);
    if (widgetContainer) {
        widgetContainer.textContent = '';
        widgetContainer.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger text-center" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `);
    }
}

function readUserPermissionData() {
    // user_permission_data đã được render trực tiếp vào window.userPermissionData
    if (window.userPermissionData) {
        // Nếu là string, parse nó
        if (typeof window.userPermissionData === 'string') {
            try {
                return JSON.parse(window.userPermissionData);
            } catch (error) {
                console.error('Unable to parse user permission data:', error);
                return {};
            }
        }
        // Nếu đã là object, return trực tiếp
        return window.userPermissionData;
    }
    return {};
}

async function mountUserPermissionWidget(userPermissionData) {
    // Mount SidebarPanel
    const sidebarContainer = document.getElementById(SIDEBAR_CONTAINER_ID);
    if (sidebarContainer && !sidebarContainer.hasAttribute('data-mounted')) {
        try {
                mount(SidebarPanel, sidebarContainer, {
                    dev: true,
                });
                sidebarContainer.setAttribute('data-mounted', 'true');
                console.log('SidebarPanel mounted successfully');
        } catch (error) {
            console.error('Error mounting SidebarPanel:', error);
            // Hide sidebar container if mount fails
            if (sidebarContainer) {
                sidebarContainer.style.display = 'none';
            }
        }
    }

    // Mount user permission widget
    const widgetContainer = document.getElementById(WIDGET_CONTAINER_ID);
    if (!widgetContainer) {
        console.warn('User permission widget container not found; abort mounting.');
        return;
    }
    try {
        mount(UserPermissionWidget, widgetContainer, {
            dev: true,
            props: {
                initialData: userPermissionData,
            },
        });
        console.log('UserPermissionWidget mounted successfully');
    } catch (error) {
        console.error('Error mounting widget:', error);
        displayError('Có lỗi xảy ra khi tải dữ liệu: ' + error.message);
    }
}

// Đợi DOM load xong
document.addEventListener('DOMContentLoaded', async () => {
    if (!hasContainers()) {
        return;
    }
    console.log("DOM Content Loaded - Initializing User Permission Widget...");

    const userPermissionData = readUserPermissionData();
    await mountUserPermissionWidget(userPermissionData);
});

async function init() {
    if (!hasContainers()) {
        return;
    }
    console.log("Initializing User Permission Widget...");

    const userPermissionData = readUserPermissionData();
    console.log("Mounting widget...");
    await mountUserPermissionWidget(userPermissionData);
}

// Đăng ký hàm init để chạy khi Odoo sẵn sàng
registry.category("website_frontend_ready").add("user_permission_management.user_permission_init", init);
