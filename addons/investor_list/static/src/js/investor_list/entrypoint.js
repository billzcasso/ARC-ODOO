/** @odoo-module */

import { InvestorListWidget } from './investor_list_widget';
import { mount } from '@odoo/owl';
import { registry } from "@web/core/registry";

// Bus polling configuration
const BUS_POLL_INTERVAL = 10000; // 10 seconds
const BUS_CHANNEL = 'investor_list';
let busPollingInterval = null;
let lastBusId = 0;

// Utility functions for spinner
function showSpinner() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById('investor-list-widget');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'none';
    }
}

function hideSpinner() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const widgetContainer = document.getElementById('investor-list-widget');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    if (widgetContainer) {
        widgetContainer.style.display = 'block';
    }
}

function showError(message) {
    const widgetContainer = document.getElementById('investor-list-widget');
    if (widgetContainer) {
        widgetContainer.textContent = '';
        widgetContainer.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger text-center" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `);
        widgetContainer.style.display = 'block';
    }
    hideSpinner();
}

// Bus polling functions
async function pollBusUpdates() {
    try {
        const response = await fetch('/bus/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: {
                    channels: [BUS_CHANNEL],
                    last: lastBusId,
                },
                id: Date.now(),
            }),
        });

        if (!response.ok) {
            return;
        }

        const result = await response.json();
        
        if (result.result && result.result.length > 0) {
            for (const notification of result.result) {
                lastBusId = Math.max(lastBusId, notification.id);
                
                if (notification.message && notification.message.type) {
                    handleBusNotification(notification.message);
                }
            }
        }
    } catch (error) {
        // Silently ignore polling errors
    }
}

function handleBusNotification(message) {
    // Trigger custom event for widget to handle
    const event = new CustomEvent('investor-data-update', { 
        detail: message 
    });
    document.dispatchEvent(event);
}

function startBusPolling() {
    if (busPollingInterval) {
        return;
    }
    
    busPollingInterval = setInterval(pollBusUpdates, BUS_POLL_INTERVAL);
    pollBusUpdates(); // Initial poll
}

function stopBusPolling() {
    if (busPollingInterval) {
        clearInterval(busPollingInterval);
        busPollingInterval = null;
    }
}

// DOM Content Loaded handler
document.addEventListener('DOMContentLoaded', () => {
    showSpinner();

    if (window.allDashboardData) {
        try {
            const widgetContainer = document.getElementById('investor-list-widget');
            if (widgetContainer) {
                mount(InvestorListWidget, widgetContainer, {
                    props: window.allDashboardData
                });
                hideSpinner();
                
                // Start bus polling after widget is mounted
                startBusPolling();
            } else {
                showError('Khong tim thay container widget');
            }
        } catch (error) {
            showError('Co loi xay ra khi tai du lieu: ' + error.message);
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopBusPolling();
});

function init() {
    showSpinner();

    const widgetContainer = document.getElementById('investor-list-widget');
    if (!widgetContainer) {
        showError('Khong tim thay container widget');
        return;
    }

    let data = {
        funds: [],
        transactions: [],
        total_investment: 0,
        total_current_value: 0,
        total_profit_loss_percentage: 0,
        chart_data: '{}'
    };

    try {
        if (widgetContainer.dataset.funds) {
            data.funds = JSON.parse(widgetContainer.dataset.funds);
        }
        if (widgetContainer.dataset.transactions) {
            data.transactions = JSON.parse(widgetContainer.dataset.transactions);
        }
        if (widgetContainer.dataset.totalInvestment) {
            data.total_investment = parseFloat(widgetContainer.dataset.totalInvestment);
        }
        if (widgetContainer.dataset.totalCurrentValue) {
            data.total_current_value = parseFloat(widgetContainer.dataset.totalCurrentValue);
        }
        if (widgetContainer.dataset.totalProfitLossPercentage) {
            data.total_profit_loss_percentage = parseFloat(widgetContainer.dataset.totalProfitLossPercentage);
        }
        if (widgetContainer.dataset.chartData) {
            data.chart_data = widgetContainer.dataset.chartData;
        }
    } catch (e) {
        showError('Co loi xay ra khi phan tich du lieu: ' + e.message);
        return;
    }

    try {
        mount(InvestorListWidget, widgetContainer, {
            dev: true,
            props: data
        });
        hideSpinner();
        
        // Start bus polling after widget is mounted
        startBusPolling();
    } catch (error) {
        showError('Co loi xay ra khi tai widget: ' + error.message);
    }
}

// Register init function
registry.category("website_frontend_ready").add("investor_list.init", init);