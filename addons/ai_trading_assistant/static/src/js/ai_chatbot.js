/** @odoo-module **/

import { Component, useState, useRef, onMounted, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class AIChatbot extends Component {
    setup() {
        console.error("ODOO AI DEBUG: AIChatbot Component is MOUNTING now.");
        this.orm = useService("orm");
        this.chatBodyRef = useRef("chatBody");

        this.state = useState({
            isOpen: false,
            isTyping: false,
            inputValue: "",
            messages: [
                {
                    id: 0,
                    sender: 'bot',
                    text: 'Xin chào! Tôi là ARC - Chuyên gia tư vấn đầu tư chứng khoán của bạn. Tôi có thể giúp gì cho danh mục đầu tư của bạn hôm nay?',
                    isHtml: false
                }
            ],
            msgCounter: 1
        });
    }

    toggleChat() {
        this.state.isOpen = !this.state.isOpen;
        if (this.state.isOpen) {
            this.scrollToBottom();
        }
    }

    sendSuggestedMessage(text) {
        if (this.state.isTyping) return;
        this.state.inputValue = text;
        this.sendMessage();
    }

    async sendMessage() {
        const text = this.state.inputValue.trim();
        if (!text || this.state.isTyping) return;

        // Add user message
        this.state.messages.push({
            id: this.state.msgCounter++,
            sender: 'user',
            text: text,
            isHtml: false
        });

        this.state.inputValue = "";
        this.state.isTyping = true;
        this.scrollToBottom();

        try {
            // Gửi API lên Model (Dùng ORM call để ổn định hơn RPC)
            const result = await this.orm.call("stock.ticker", "ai_chat", [text]);


            // Handle response
            this.state.messages.push({
                id: this.state.msgCounter++,
                sender: 'bot',
                text: result.response_html ? markup(result.response_html) : "Có lỗi xảy ra khi phân tích ngoại tuyến.",
                isHtml: true
            });

        } catch (error) {
            this.state.messages.push({
                id: this.state.msgCounter++,
                sender: 'bot',
                text: "Lỗi: Mất kết nối tới máy chủ của hệ thống.",
                isHtml: false
            });
        } finally {
            this.state.isTyping = false;
            this.scrollToBottom();
        }
    }

    onKeyUp(ev) {
        if (ev.key === "Enter") {
            this.sendMessage();
        }
    }

    scrollToBottom() {
        // Cần setTimeout để chờ DOM update xong
        setTimeout(() => {
            if (this.chatBodyRef.el) {
                this.chatBodyRef.el.scrollTop = this.chatBodyRef.el.scrollHeight;
            }
        }, 50);
    }
}

AIChatbot.template = "ai_trading_assistant.AIChatbot";

// Đăng ký component vào systray để đảm bảo nạp toàn cầu trên backend
registry.category("systray").add("ai_trading_assistant.AIChatbot", {
    Component: AIChatbot,
});
