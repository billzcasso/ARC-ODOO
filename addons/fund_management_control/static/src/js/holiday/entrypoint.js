/** @odoo-module **/
import HolidayWidget from './holiday_widget';
window.HolidayWidget = HolidayWidget;
// entrypoint.js cho holiday
// Bạn có thể import holiday_widget.js ở đây nếu cần
// Ví dụ: import './holiday_widget';

// entrypoint.js cho HolidayWidget

let mountAttempts = 0;
const maxAttempts = 50;

function mountHolidayWidget() {
    mountAttempts++;
    if (typeof owl !== 'undefined' && typeof window.HolidayWidget !== 'undefined') {
        const widgetContainer = document.getElementById('holidayWidget');
        if (widgetContainer) {
            try {
                widgetContainer.textContent = '';
                const app = new owl.App(window.HolidayWidget);
                app.mount(widgetContainer);
                return;
            } catch (error) {
                console.error('Error mounting HolidayWidget:', error);
            }
        }
    }
    if (mountAttempts < maxAttempts) setTimeout(mountHolidayWidget, 100);
}
document.addEventListener('DOMContentLoaded', mountHolidayWidget);
window.addEventListener('load', () => { if (mountAttempts === 0) mountHolidayWidget(); });
if (document.readyState !== 'loading') setTimeout(mountHolidayWidget, 50); 
