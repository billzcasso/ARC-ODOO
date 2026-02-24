/** @odoo-module **/

import { mount } from "@odoo/owl";
import { FundWidget } from "./fund_widget";

// Improved mount logic

let isMounted = false; // Thêm biến cờ để kiểm tra đã gắn hay chưa
let mountAttempts = 0;
const maxAttempts = 1;

function validateElement(element) {
    if (!element) return false;
    if (!(element instanceof Element)) return false;
    if (element.nodeType !== 1) return false;
    if (!element.isConnected) return false;
    if (!document.contains(element)) return false;
    return true;
}

function autoMount() {
    if (isMounted) { // Nếu đã gắn rồi, không làm gì nữa
        return;
    }

    const target = document.getElementById("fund-widget-root");

    if (!validateElement(target)) {
        return;
    }

    // Kiểm tra xem component đã có trong target chưa
    if (target.querySelector('.fund-widget-container')) { // Kiểm tra dựa trên class của template root
        isMounted = true;
        return;
    }

    target.textContent = '';
    //    console.log("Target info:", {
    //        id: target.id,
    //        tagName: target.tagName,
    //        className: target.className,
    //        isConnected: target.isConnected,
    //        innerHTML: target.innerHTML
    //    });

    try {
        const app = new owl.App(FundWidget);
        app.mount(target)
            .then(() => {
                isMounted = true; // Đặt cờ thành true khi thành công
            })
            .catch(error => {
                return mount(FundWidget, { target });
            })
            .then(() => {
                isMounted = true; // Đặt cờ thành true khi thành công
            })
            .catch(error => {
            });

    } catch (syncError) {
    }
}

// Enhanced mounting strategy

function tryMount() {
    if (isMounted) { // Nếu đã gắn rồi, không thử nữa
        return;
    }

    mountAttempts++;

    if (mountAttempts > maxAttempts) {
        return;
    }

    const target = document.getElementById("fund-widget-root");
    if (target && validateElement(target)) {
        autoMount();
    } else {
        setTimeout(tryMount, 500 * mountAttempts);
    }
}

// Multiple timing strategies
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(tryMount, 100);
    });
} else {
    setTimeout(tryMount, 100);
}

window.addEventListener("load", () => {
    setTimeout(tryMount, 200);
});

// Backup timer
setTimeout(() => {
    tryMount();
}, 2000);

// Observer for dynamic content
const observer = new MutationObserver((mutations) => {
    if (isMounted) { // Nếu đã gắn rồi, không cần quan sát nữa
        observer.disconnect(); // Ngắt kết nối observer
        return;
    }

    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            const target = document.getElementById("fund-widget-root");
            // Chỉ gọi tryMount nếu target có vẻ đã xuất hiện và chưa có component bên trong
            if (target && !target.querySelector('.fund-widget-container')) {
                setTimeout(tryMount, 100);
            }
        }
    });
});

if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
} else {
    document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}