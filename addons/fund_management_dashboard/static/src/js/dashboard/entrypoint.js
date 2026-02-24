/** @odoo-module */

import { DashboardWidget } from './dashboard_widget';
import { mount } from '@odoo/owl';
import { registry } from "@web/core/registry";

const CHART_JS_URL = "https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js";
const DASHBOARD_DATA_SCRIPT_ID = "fmd-dashboard-data";
const DASHBOARD_ROOT_ID = "dashboard-widget";

function hasDashboardContainer() {
    return Boolean(document.getElementById(DASHBOARD_ROOT_ID));
}

// Hàm tiện ích để quản lý spinner
function showDashboardSpinner() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById(DASHBOARD_ROOT_ID);
    const errorContainer = document.getElementById('error-container');

    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'none';
    }
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

function hideDashboardSpinner() {
    if (typeof window.hideSpinner === 'function') {
        window.hideSpinner();
        return;
    }
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById(DASHBOARD_ROOT_ID);
    const errorContainer = document.getElementById('error-container');

    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'block';
    }
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

function displayDashboardError(message) {
    if (typeof window.showError === 'function') {
        window.showError(message);
        return;
    }
    const widgetContainer = document.getElementById(DASHBOARD_ROOT_ID);
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    if (widgetContainer) {
        widgetContainer.textContent = '';
        widgetContainer.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger text-center" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `);
        widgetContainer.style.display = 'block';
    }
    if (errorContainer) {
        errorContainer.style.display = 'block';
    }
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    hideDashboardSpinner();
}

function ensureChartJs() {
    if (window.Chart) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const existingScript = document.getElementById('fmd-chartjs');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', reject);
            return;
        }
        const script = document.createElement('script');
        script.id = 'fmd-chartjs';
        script.src = CHART_JS_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        document.head.appendChild(script);
    });
}

function readDashboardData() {
    const dataNode = document.getElementById(DASHBOARD_DATA_SCRIPT_ID);
    if (dataNode) {
        try {
            return JSON.parse(dataNode.textContent || '{}');
        } catch (error) {
            console.error('Unable to parse dashboard data', error);
        }
    }
    if (window.dashboardData) {
        return window.dashboardData;
    }
    return null;
}

// Đợi DOM load xong
document.addEventListener('DOMContentLoaded', () => {
    if (!hasDashboardContainer()) {
        return;
    }
    // console.log("DOM Content Loaded - Initializing Fund Management Dashboard Widget...");

    // Hiển thị spinner ban đầu
    showDashboardSpinner();

    const dashboardData = readDashboardData();
    ensureChartJs()
        .then(() => mountDashboardWidget(dashboardData))
        .catch((error) => {
            console.error("Unable to load Chart.js", error);
            displayDashboardError('Không thể tải thư viện biểu đồ');
        });
});

function mountDashboardWidget(dashboardData) {
    const widgetContainer = document.getElementById(DASHBOARD_ROOT_ID);
    if (!widgetContainer) {
        console.warn('Dashboard widget container not found; abort mounting.');
        return;
    }
    try {
        mount(DashboardWidget, widgetContainer, {
            dev: true,
            props: {
                initialData: dashboardData,
            },
        });
        hideDashboardSpinner();
    } catch (error) {
        console.error('Error mounting widget:', error);
        displayDashboardError('Có lỗi xảy ra khi tải dữ liệu: ' + error.message);
    }
}

function init() {
    if (!hasDashboardContainer()) {
        return;
    }
    // console.log("Initializing Fund Management Dashboard Widget...");

    // Hiển thị spinner
    showDashboardSpinner();

    // Lấy widget container
    const widgetContainer = document.getElementById(DASHBOARD_ROOT_ID);
    if (!widgetContainer) {
        console.warn('Dashboard widget container not found; abort init.');
        return;
    }

    const dashboardData = readDashboardData();
    ensureChartJs()
        .then(() => {
            // console.log("Mounting widget...");
            mount(DashboardWidget, widgetContainer, {
                dev: true,
                props: {
                    initialData: dashboardData,
                },
            });
            // console.log("Widget mounted successfully");
            hideDashboardSpinner();
        })
        .catch((error) => {
            console.error('Error mounting widget:', error);
            displayDashboardError('Có lỗi xảy ra khi tải widget: ' + error.message);
        });
}

// Đăng ký hàm init để chạy khi Odoo sẵn sàng
registry.category("website_frontend_ready").add("fund_management_dashboard.init", init);

