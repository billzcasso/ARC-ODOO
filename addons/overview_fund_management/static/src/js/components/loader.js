/** @odoo-module **/

import { Component, xml, useState, mount, onWillStart } from "@odoo/owl";

/**
 * Global Loading Screen Component
 * Hiển thị màn hình loading với logo HDC Capital và hiệu ứng glassmorphism
 * Tự động kích hoạt khi reload trang hoặc chuyển trang
 */
export class GlobalLoader extends Component {
    static template = xml`
        <div id="global-loader" t-att-class="state.isVisible ? '' : 'hidden'">
            <div class="loader-content">
                <div class="logo-container">
                    <img src="/overview_fund_management/static/src/img/logo.png" alt="HDC Capital" class="loader-logo"/>
                    <div class="logo-pulse"></div>
                </div>
                <!-- <div class="loader-text">Đang tải dữ liệu...</div> -->
                <div class="loader-bar">
                    <div class="loader-bar-fill"></div>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            isVisible: true, // Mặc định hiển thị khi mới load script (đầu trang)
        });

        // Xử lý khi trang đã load xong hoàn toàn
        const onPageLoad = () => {
            // Delay nhẹ để đảm bảo assets load xong và animation mượt mà
            setTimeout(() => {
                this.hide();
            }, 800);
        };

        if (document.readyState === 'complete') {
            onPageLoad();
        } else {
            window.addEventListener('load', onPageLoad);
        }

        // Xử lý khi người dùng rời trang (click link, reload)
        window.addEventListener('beforeunload', () => {
            this.show();
        });

        // Xử lý click thẻ a nội bộ để hiện loader ngay lập tức (UX tốt hơn chờ beforeunload)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && 
                link.href && 
                !link.href.startsWith('javascript') && 
                !link.href.includes('#') && 
                link.target !== '_blank' &&
                link.href.includes(window.location.origin)) {
                
                // Tránh hiện loader khi chỉ click vào cùng trang
                 if (link.href !== window.location.href) {
                     this.show();
                 }
            }
        });
    }

    show() {
        this.state.isVisible = true;
    }

    hide() {
        this.state.isVisible = false;
    }
}

// Hàm khởi tạo Loader và mount vào body
export function mountGlobalLoader() {
    const loaderContainer = document.createElement('div');
    loaderContainer.id = 'hdc-global-loader-root';
    document.body.appendChild(loaderContainer);

    try {
        mount(GlobalLoader, loaderContainer);
    } catch (error) {
        console.error("Error mounting GlobalLoader:", error);
    }
}
