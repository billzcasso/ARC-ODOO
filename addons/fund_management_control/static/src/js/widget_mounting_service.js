/**
 * Widget Mounting Service
 * * This service provides a robust and centralized way to mount OWL components,
 * avoiding race conditions by ensuring that both the OWL library and the target
 * component are fully loaded before attempting to mount.
 * * How it works:
 * 1. `mountWhenReady`: Other scripts call this function, providing the component's
 * class name (string) and the ID of the container element.
 * 2. Queueing: The request is added to a queue (`widgetsToMount`). It doesn't
 * try to mount immediately.
 * 3. Polling: A single, efficient interval (`mountInterval`) runs periodically.
 * 4. Checking & Mounting: In each interval, the service checks for three conditions
 * for each widget in the queue:
 * a) Is the OWL library available (`window.owl`)?
 * b) Is the widget's class defined on the window object (e.g., `window['FundCertificateWidget']`)?
 * c) Does the target DOM container exist?
 * 5. Success/Cleanup: If all conditions are met, the widget is mounted, and the
 * request is removed from the queue.
 * 6. Timeout: If a widget cannot be mounted after a certain time (e.g., 10 seconds),
 * an error is logged, and the process stops for that widget to prevent infinite loops.
 */

(function() {
    // Ensure the service is only initialized once.
    if (window.WidgetMountingService) {
        return;
    }

    const service = {
        widgetsToMount: [],
        mountInterval: null,
        mountedWidgets: new Set(), // Track mounted widgets to prevent duplicates
        MAX_ATTEMPTS: 100, // 100 attempts * 100ms = 10 seconds timeout

        /**
         * Public method to register a widget for mounting.
         * @param {string} widgetClassName The name of the widget class (e.g., 'FundCertificateWidget').
         * @param {string} containerId The ID of the DOM element to mount the widget into.
         */
        mountWhenReady(widgetClassName, containerId) {
            // Check if this widget is already mounted or in queue
            const widgetKey = `${widgetClassName}:${containerId}`;
            if (this.mountedWidgets.has(widgetKey)) {
                return;
            }

            // Check if already in queue
            const existingInQueue = this.widgetsToMount.find(w => 
                w.widgetClassName === widgetClassName && w.containerId === containerId
            );
            if (existingInQueue) {
                return;
            }

            // Check if the target container exists in the DOM.
            const container = document.getElementById(containerId);
            if (!container) {
                // This is not an error, the widget might just not be on the current page.
                return;
            }

            // Check if container already has content (potential duplicate mount)
            if (container.children.length > 0 && !container.querySelector('.spinner-border')) {
                this.mountedWidgets.add(widgetKey);
                return;
            }
            this.widgetsToMount.push({
                widgetClassName,
                containerId,
                attempts: 0,
                widgetKey
            });

            // Start the mounting process if it's not already running.
            if (!this.mountInterval) {
                this.startMountingProcess();
            }
        },

        /**
         * Starts the interval to check and mount widgets from the queue.
         */
        startMountingProcess() {
            this.mountInterval = setInterval(this.tryToMountWidgets.bind(this), 100);
        },

        /**
         * The core logic that runs on each interval.
         */
        tryToMountWidgets() {
            // If the queue is empty, stop the interval to save resources.
            if (this.widgetsToMount.length === 0) {
                clearInterval(this.mountInterval);
                this.mountInterval = null;
                return;
            }

            // Use a reverse loop to safely remove items while iterating.
            for (let i = this.widgetsToMount.length - 1; i >= 0; i--) {
                const widgetInfo = this.widgetsToMount[i];
                widgetInfo.attempts++;

                const WidgetClass = window[widgetInfo.widgetClassName];
                const container = document.getElementById(widgetInfo.containerId);

                // Check if everything is ready.
                if (window.owl && WidgetClass && container) {
                    // Double-check if widget is already mounted
                    if (this.mountedWidgets.has(widgetInfo.widgetKey)) {
                        this.widgetsToMount.splice(i, 1);
                        continue;
                    }

                    try {
                        // Clear the container (e.g., remove loading spinner).
                        container.textContent = '';

                        // Use owl.App for modern OWL applications.
                        const app = new window.owl.App(WidgetClass);
                        app.mount(container);
                        
                        // Mark as mounted to prevent duplicates
                        this.mountedWidgets.add(widgetInfo.widgetKey);
                        
                        // Remove from queue after successful mount.
                        this.widgetsToMount.splice(i, 1);

                    } catch (error) {
                        // Remove from queue to prevent retrying a failed mount.
                        this.widgetsToMount.splice(i, 1);
                    }
                } else if (widgetInfo.attempts > this.MAX_ATTEMPTS) {
                    // Handle timeout.
                    // Remove from queue to stop trying.
                    this.widgetsToMount.splice(i, 1);
                }
            }
        },

        /**
         * Method to manually clear mounted widgets tracking (for development/debugging)
         */
        clearMountedWidgets() {
            this.mountedWidgets.clear();
        }
    };

    // Attach the service to the window object for global access.
    window.WidgetMountingService = service;

})();
