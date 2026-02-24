/** @odoo-module **/
import { mount } from "@odoo/owl";
import { PendingWidget } from "./pending_widget";
import { OrderWidget } from "./order_widget";
import { PeriodicWidget } from "./periodic_widget";

document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo widget cho trang pending
    const pendingContainer = document.getElementById("pending-widget-container");
    if (pendingContainer) {
        let orders = [];
        if (pendingContainer.dataset.orders) {
            try {
                orders = JSON.parse(pendingContainer.dataset.orders);
            } catch (error) {
                console.error('Lỗi khi parse dữ liệu orders:', error);
                orders = [];
            }
        }
        
        try {
            mount(PendingWidget, pendingContainer, {
                props: { orders }
            });
        } catch (error) {
            console.error('Lỗi khi mount pending widget:', error);
                        pendingContainer.textContent = '';
                        pendingContainer.insertAdjacentHTML('beforeend', '<div class="text-center text-red-500 py-4">Có lỗi xảy ra khi tải widget: ' + error.message + '</div>');
        }
    }

    // Khởi tạo widget cho trang order
    const orderContainer = document.getElementById("order-widget-container");
    if (orderContainer) {
        let orders = [];
        if (orderContainer.dataset.orders) {
            try {
                orders = JSON.parse(orderContainer.dataset.orders);
            } catch (error) {
                console.error('Lỗi khi parse dữ liệu orders:', error);
                orders = [];
            }
        }
        
        try {
            mount(OrderWidget, orderContainer, {
                props: { orders }
            });
        } catch (error) {
            console.error('Lỗi khi mount order widget:', error);
                        orderContainer.textContent = '';
                        orderContainer.insertAdjacentHTML('beforeend', '<div class="text-center text-red-500 py-4">Có lỗi xảy ra khi tải widget: ' + error.message + '</div>');
        }
    }

    // Khởi tạo widget cho trang periodic
    const periodicContainer = document.getElementById("periodic-widget-container");
    if (periodicContainer) {
        let orders = [];
        if (periodicContainer.dataset.orders) {
            try {
                orders = JSON.parse(periodicContainer.dataset.orders);
            } catch (error) {
                console.error('Lỗi khi parse dữ liệu orders:', error);
                orders = [];
            }
        }
        
        try {
            mount(PeriodicWidget, periodicContainer, {
                props: { orders }
            });
        } catch (error) {
            console.error('Lỗi khi mount periodic widget:', error);
                        periodicContainer.textContent = '';
                        periodicContainer.insertAdjacentHTML('beforeend', '<div class="text-center text-red-500 py-4">Có lỗi xảy ra khi tải widget: ' + error.message + '</div>');
        }
    }
});
