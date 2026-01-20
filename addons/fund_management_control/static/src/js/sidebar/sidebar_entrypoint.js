/** @odoo-module */

import { SidebarPanel } from "@fund_management_dashboard/js/dashboard/sidebar_panel";
import { mount } from "@odoo/owl";

document.addEventListener('DOMContentLoaded', async () => {
    // Mount Sidebar
    // This script replaces sidebar mounting in individual widget entrypoints.
    // It runs once per page load effectively due to standard DOM ready event.
    
    const sidebarContainer = document.getElementById("sidebarWidget");
    if (sidebarContainer) {
        // Prevent double mounting if this script somehow runs twice or race conditions
        if (sidebarContainer.hasChildNodes()) {
            return;
        }

        try {
            await mount(SidebarPanel, sidebarContainer);
        } catch (e) {
            console.error("Failed to mount SidebarPanel", e);
        }
    }
});
