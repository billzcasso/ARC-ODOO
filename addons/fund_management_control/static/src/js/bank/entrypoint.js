/** @odoo-module **/
import BankWidget from './bank_widget';
window.BankWidget = BankWidget;
// entrypoint.js cho bank
// Bạn có thể import bank_widget.js ở đây nếu cần
console.log('Bank JS loaded');
console.log('BankWidget entrypoint.js loaded');
let mountAttempts = 0;
const maxAttempts = 50;
function mountBankWidget() {
    mountAttempts++;
    if (typeof owl !== 'undefined' && typeof window.BankWidget !== 'undefined') {
        const widgetContainer = document.getElementById('bankWidget');
        if (widgetContainer) {
            try {
                widgetContainer.textContent = '';
                const app = new owl.App(window.BankWidget);
                app.mount(widgetContainer);
                return;
            } catch (error) {
                try {
                    widgetContainer.textContent = '';
                    owl.mount(window.BankWidget, widgetContainer);
                    return;
                } catch (fallbackError) {}
            }
        }
    }
    if (mountAttempts < maxAttempts) setTimeout(mountBankWidget, 100);
}
document.addEventListener('DOMContentLoaded', mountBankWidget);
window.addEventListener('load', () => { if (mountAttempts === 0) mountBankWidget(); });
if (document.readyState !== 'loading') setTimeout(mountBankWidget, 50); 
