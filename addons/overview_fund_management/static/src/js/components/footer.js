/** @odoo-module **/
import { Component, xml } from "@odoo/owl";

export class Footer extends Component {
    static template = xml`
    <div>
        <!-- Spacer to create distance from body content -->
        <div class="footer-spacer"></div>
        
        <footer class="main-footer">
            <div class="footer-main">
                <div class="container-fluid">
                    <div class="row">
                        <!-- Column 1: Brand & About -->
                        <div class="col-lg-3 col-md-6 mb-4 mb-lg-0">
                            <div class="footer-brand">
                                <img src="/overview_fund_management/static/src/img/logo.png" alt="App Logo" class="footer-logo"/>
                            </div>
                            <p class="footer-desc">
                                Cung cấp giải pháp quản lý quỹ tiên tiến giúp theo dõi danh mục đầu tư hiệu quả và tăng trưởng bền vững.
                            </p>
                        </div>

                        <!-- Column 2: Quick Links -->
                        <div class="col-lg-3 col-md-6 mb-4 mb-lg-0">
                            <h5 class="footer-heading">Liên kết nhanh</h5>
                            <ul class="footer-links">
                                <li><a href="#">Trang chủ</a></li>
                                <li><a href="#">Bảng tin</a></li>
                                <li><a href="#">Danh mục đầu tư</a></li>
                                <li><a href="#">Phân tích thị trường</a></li>
                            </ul>
                        </div>

                        <!-- Column 3: Resources -->
                        <div class="col-lg-3 col-md-6 mb-4 mb-lg-0">
                            <h5 class="footer-heading">Tài nguyên</h5>
                            <ul class="footer-links">
                                <li><a href="#">Trung tâm trợ giúp</a></li>
                                <li><a href="#">Tài liệu</a></li>
                                <li><a href="#">Chính sách bảo mật</a></li>
                                <li><a href="#">Điều khoản sử dụng</a></li>
                            </ul>
                        </div>

                        <!-- Column 4: Contact -->
                        <div class="col-lg-3 col-md-6">
                            <h5 class="footer-heading">Liên hệ</h5>
                            <div class="footer-contact">
                                <p><i class="fa fa-map-marker me-2"></i> 69/68 Đặng Thùy Trâm, P. 13, Q. Bình Thạnh, Tp. HCM</p>
                                <p><i class="fa fa-envelope me-2"></i>truongphattrans.dev@gmail.com</p>
                                <p><i class="fa fa-phone me-2"></i> 0345608614</p>
                            </div>
                            <div class="footer-social">
                                <a href="https://www.facebook.com/truongphattransss/" target="_blank" class="social-icon"><i class="fab fa-facebook-f"></i></a>
                                <a href="https://www.youtube.com/@truongphattrans" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer Bottom -->
            <div class="footer-bottom">
                <div class="container-fluid">
                    <div class="row align-items-center">
                        <div class="col-12 text-center">
                            <p class="mb-0">© 2026 Hệ thống Quản lý Quỹ. Bảo lưu mọi quyền.</p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    </div>
    `;
}

// Export for other modules to import
Footer.props = {};
