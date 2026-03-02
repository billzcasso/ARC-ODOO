/** @odoo-module **/

import { Component, useState, useRef, onMounted, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class AIChatbot extends Component {
    setup() {
        // console.error("ODOO AI DEBUG: AIChatbot Component is MOUNTING now.");
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
                    type: 'text',
                    text: 'Xin chào! Tôi là ARC - Chuyên gia tư vấn đầu tư của bạn. Tôi có thể giúp gì cho danh mục đầu tư của bạn hôm nay?',
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



    async sendMessage() {
        const text = this.state.inputValue.trim();
        if (!text || this.state.isTyping) return;

        // Add user message
        this.state.messages.push({
            id: this.state.msgCounter++,
            sender: 'user',
            type: 'text',
            text: text
        });

        this.state.inputValue = "";
        this.state.isTyping = true;
        this.scrollToBottom();

        try {
            // Gửi API lên Model (Dùng ORM call để ổn định hơn RPC)
            const result = await this.orm.call("stock.ticker", "ai_chat", [text]);

            // Handle response logic JSON format
            if (result.status === 'success') {
                if (result.type === 'general') {
                    // Regex rendering for Bold and Italic text (Client-side)
                    let textHtml = result.data.text_content;
                    textHtml = textHtml.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #60a5fa; font-size: 15px;">$1</strong>');
                    textHtml = textHtml.replace(/\*(.*?)\*/g, '<em style="color: #94a3b8;">$1</em>');
                    result.data.text_html = markup(textHtml);
                } else if (result.type === 'multi') {
                    for (let item of result.data) {
                        if (item.data) {
                            if (item.data.expert_comment) item.data.expert_comment = markup(item.data.expert_comment);

                            // Render stars client-side
                            const renderStars = (n) => {
                                const starIcon = '<i class="fa fa-star" style="color: #f59e0b;"></i>';
                                return markup(`${n} ${Array(n).fill(starIcon).join(' ')}`);
                            };

                            if (item.data.price_stars) item.data.price_stars_html = renderStars(item.data.price_stars);
                            if (item.data.trend_stars) item.data.trend_stars_html = renderStars(item.data.trend_stars);
                            if (item.data.pos_stars) item.data.pos_stars_html = renderStars(item.data.pos_stars);
                            if (item.data.flow_stars) item.data.flow_stars_html = renderStars(item.data.flow_stars);
                            if (item.data.volat_stars) item.data.volat_stars_html = renderStars(item.data.volat_stars);
                            if (item.data.base_stars) item.data.base_stars_html = renderStars(item.data.base_stars);
                        }
                    }
                }

                this.state.messages.push({
                    id: this.state.msgCounter++,
                    sender: 'bot',
                    type: result.type,
                    data: result.data
                });
            } else {
                this.state.messages.push({
                    id: this.state.msgCounter++,
                    sender: 'bot',
                    type: 'text',
                    text: result.message || "Lỗi xử lý phản hồi."
                });
            }

        } catch (error) {
            this.state.messages.push({
                id: this.state.msgCounter++,
                sender: 'bot',
                type: 'text',
                text: "Lỗi: Mất kết nối tới máy chủ của hệ thống."
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

// Đăng ký component vào main_components cho Odoo 18 để widget tự động nổi trên toàn bộ màn hình backend
// Đăng ký component vào main_components cho Odoo 18 để widget tự động nổi trên toàn bộ màn hình backend
registry.category("main_components").add("ai_trading_assistant.AIChatbot", {
    Component: AIChatbot,
});

// Thêm vào frontend cho các trang Controller public (Website)
import { mountComponent } from "@web/env";
import { getTemplate } from "@web/core/templates";

registry.category("website_frontend_ready").add("ai_trading_assistant.AIChatbot_init", () => {
    // Chờ DOM sẵn sàng
    if (document.body) {
        // Tạo container cho Chatbot
        const chatbotContainer = document.createElement("div");
        document.body.appendChild(chatbotContainer);

        // Mount OWL component thẳng vào container
        mountComponent(AIChatbot, chatbotContainer);
    }
});
