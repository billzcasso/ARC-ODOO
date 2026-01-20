/** @odoo-module */

import { TermRateWidget } from './term_rate_widget';

import { mount } from "@odoo/owl";

document.addEventListener('DOMContentLoaded', async () => {


    const widgetContainer = document.getElementById("termRateWidget");
    if (widgetContainer) {
        widgetContainer.innerHTML = '';
        try {
            await mount(TermRateWidget, widgetContainer);
            console.log("TermRateWidget mounted.");
        } catch (e) {
            console.error("Failed to mount TermRateWidget", e);
            widgetContainer.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
        }
    }
});
