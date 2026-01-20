    /** @odoo-module */

    import { FundCertificateWidget } from './fund_certificate_widget';

    import { mount } from "@odoo/owl";

    document.addEventListener('DOMContentLoaded', async () => {


        // Mount FundCertificateWidget
        const widgetContainer = document.getElementById("fundCertificateWidget");
        if (widgetContainer) {
            // Clear loading spinner
            widgetContainer.innerHTML = ''; 
            try {
                await mount(FundCertificateWidget, widgetContainer);
                console.log("FundCertificateWidget mounted successfully.");
            } catch (e) {
                console.error("Failed to mount FundCertificateWidget", e);
                widgetContainer.innerHTML = `<div class="alert alert-danger">Error loading component: ${e.message}</div>`;
            }
        }
    });
