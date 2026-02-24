/** @odoo-module **/

import { mount, App } from "@odoo/owl";
import { NormalOrderFormComponent } from "./normal_order_form";

let isMounted = false;
let app = null;

function validateElement(element) {
    if (!element) return false;
    if (!(element instanceof Element)) return false;
    if (!element.isConnected) return false;
    return true;
}

/**
 * Mount NormalOrderFormComponent to target container
 * Called when user switches to "Normal Order" tab
 */
export async function mountNormalOrderForm(targetId = 'normal-order-form-container') {
    if (isMounted) {
        console.log('[NormalOrderForm] Already mounted');
        return;
    }

    const target = document.getElementById(targetId);
    if (!validateElement(target)) {
        console.warn('[NormalOrderForm] Target not found:', targetId);
        throw new Error('Target not found');
    }

    // Check if already has component
    if (target.querySelector('.normal-order-form-container')) {
        isMounted = true;
        return;
    }

    // Clear target safely
    target.textContent = '';

    // Get props from page context
    const fundSelect = document.getElementById('fund-select');
    const fundId = fundSelect?.options[fundSelect.selectedIndex]?.dataset?.id;

    const props = {
        fundId: fundId ? parseInt(fundId) : null,
        transactionType: 'buy',
        onOrderCreated: (result) => {
            console.log('[NormalOrderForm] Order created:', result);
        }
    };

    try {
        // Primary: use OWL App class (Odoo 18)
        if (App) {
            app = new App(NormalOrderFormComponent, { props });
            await app.mount(target);
            isMounted = true;
            console.log('[NormalOrderForm] Mounted via App class');
            return;
        }
    } catch (error) {
        console.warn('[NormalOrderForm] App mount failed, trying mount():', error);
    }

    try {
        // Fallback: use standalone mount function
        await mount(NormalOrderFormComponent, target, { props });
        isMounted = true;
        console.log('[NormalOrderForm] Mounted via mount() function');
    } catch (error) {
        target.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.textContent = 'Lỗi tải form đặt lệnh: ' + error.message;
        target.appendChild(errorDiv);
        throw error;
    }
}

/**
 * Unmount NormalOrderFormComponent
 * Called when user switches away from "Normal Order" tab
 */
export function unmountNormalOrderForm() {
    if (app) {
        app.destroy();
        app = null;
        isMounted = false;
        console.log('[NormalOrderForm] Unmounted');
    }
}

/**
 * Check if component is mounted
 */
export function isNormalOrderFormMounted() {
    return isMounted;
}

// Export for global access (called by fund_buy.js vanilla JS)
window.NormalOrderFormMount = {
    mount: mountNormalOrderForm,
    unmount: unmountNormalOrderForm,
    isMounted: isNormalOrderFormMounted
};
