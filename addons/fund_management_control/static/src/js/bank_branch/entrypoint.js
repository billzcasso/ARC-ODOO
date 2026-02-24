/** @odoo-module **/
import BankBranchWidget from './bank_branch_widget';
window.BankBranchWidget = BankBranchWidget;
// entrypoint.js cho bank_branch
// Bạn có thể import bank_branch_widget.js ở đây nếu cần
console.log('Bank Branch JS loaded');
console.log('BankBranchWidget entrypoint.js loaded');
let mountAttempts = 0;
const maxAttempts = 50;
function mountBankBranchWidget() {
    mountAttempts++;
    if (typeof owl !== 'undefined' && typeof window.BankBranchWidget !== 'undefined') {
        const widgetContainer = document.getElementById('bankBranchWidget');
        if (widgetContainer) {
            try {
                widgetContainer.textContent = '';
                const app = new owl.App(window.BankBranchWidget);
                app.mount(widgetContainer);
                return;
            } catch (error) {
                try {
                    widgetContainer.textContent = '';
                    owl.mount(window.BankBranchWidget, widgetContainer);
                    return;
                } catch (fallbackError) {}
            }
        }
    }
    if (mountAttempts < maxAttempts) setTimeout(mountBankBranchWidget, 100);
}
document.addEventListener('DOMContentLoaded', mountBankBranchWidget);
window.addEventListener('load', () => { if (mountAttempts === 0) mountBankBranchWidget(); });
if (document.readyState !== 'loading') setTimeout(mountBankBranchWidget, 50); 
