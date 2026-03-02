/** @odoo-module **/

import { Header } from './header';
import { mount } from '@odoo/owl';

// Hàm mount component
async function mountHeader() {
    const headerContainer = document.getElementById('headermana-container');
    if (headerContainer) {
        // Luôn mount Header. Logic tự ẩn / hiện tuỳ theo user_type được xử lý trong header.js (Vue/Owl t-if)
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