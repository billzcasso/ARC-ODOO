/** @odoo-module **/

import { Header } from './header';
import { mount } from '@odoo/owl';

// Hàm kiểm tra xem có nên ẩn header không (nhà đầu tư truy cập trang sổ lệnh)
async function shouldHideHeader() {
    const currentPath = window.location.pathname;
    const isOrderMatchingPage = currentPath.includes('/order-book') ||
        currentPath.includes('/completed-orders') ||
        currentPath.includes('/negotiated-orders');
    const isDashboardPage = currentPath === '/fund-management-dashboard' || currentPath.startsWith('/fund-management-dashboard/');
    const isUserManagementPage = currentPath.startsWith('/user-management/');

    if (!isOrderMatchingPage && !isDashboardPage && !isUserManagementPage) {
        return false;
    }

    try {
        const response = await fetch('/api/user-permission/check-user-type', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: {},
                id: Math.floor(Math.random() * 1000000)
            }),
        });

        if (!response.ok) {
            return false;
        }

        const jsonRpcResponse = await response.json();
        const data = jsonRpcResponse.result || jsonRpcResponse;

        if (data && data.success) {
            // Nếu user là portal (nhà đầu tư), ẩn header ở trang sổ lệnh
            if (isOrderMatchingPage) {
                return data.user_type === 'portal';
            }
            // Nếu user là system_admin, ẩn header ở trang dashboard hoặc quản lý người dùng
            if (isDashboardPage || isUserManagementPage) {
                return data.user_type === 'system_admin';
            }
        }
    } catch (error) {
        console.error('Error checking user type:', error);
    }

    return false;
}

// Hàm mount component
async function mountHeader() {
    const headerContainer = document.getElementById('headermana-container');
    if (headerContainer) {
        // Kiểm tra xem có nên ẩn header không
        const hideHeader = await shouldHideHeader();
        if (hideHeader) {
            // Ẩn header container
            headerContainer.style.display = 'none';
            return;
        }

        mount(Header, headerContainer, {
            props: {
                userName: window.userName || "TRẦN NGUYÊN TRƯỜNG PHÁT",
                accountNo: window.accountNo || "N/A"
            }
        });
    } else {
        setTimeout(mountHeader, 100);
    }
}

// Đợi DOM load xong
document.addEventListener('DOMContentLoaded', () => {
    mountHeader();
}); 