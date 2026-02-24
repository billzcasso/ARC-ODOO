const { Component, xml, useState, onMounted } = owl;

export class IDDocumentWidget extends Component {
    setup() {
        this.state = useState({
            frontImage: null,
            backImage: null,
            frontPreview: null,
            backPreview: null,
            uploading: false,
            error: null
        });

        onMounted(() => {
            // Initialize file inputs
            this.initFileInputs();
        });
    }

    initFileInputs() {
        const frontInput = document.getElementById('front_image_input');
        const backInput = document.getElementById('back_image_input');

        if (frontInput) {
            frontInput.addEventListener('change', (e) => this.handleImageSelect(e, 'front'));
        }
        if (backInput) {
            backInput.addEventListener('change', (e) => this.handleImageSelect(e, 'back'));
        }
    }

    handleImageSelect(event, type) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (type === 'front') {
                    this.state.frontImage = e.target.result;
                    this.state.frontPreview = URL.createObjectURL(file);
                } else {
                    this.state.backImage = e.target.result;
                    this.state.backPreview = URL.createObjectURL(file);
                }
                this.state.error = null;
            };
            reader.readAsDataURL(file);
        }
    }

    async uploadImages() {
        if (!this.state.frontImage || !this.state.backImage) {
            this.state.error = 'Vui lòng chọn đủ ảnh mặt trước và mặt sau CCCD';
            return;
        }

        this.state.uploading = true;
        this.state.error = null;

        try {
            const formData = new FormData();
            formData.append('front_image', this.state.frontImage);
            formData.append('back_image', this.state.backImage);

            const response = await fetch('/investor/upload/id_document', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            // Refresh the view to show updated images
            await this.env.model.load();

            // Clear the form
            this.state.frontImage = null;
            this.state.backImage = null;
            this.state.frontPreview = null;
            this.state.backPreview = null;

            // Show success message
            this.env.services.notification.add('Tải lên thành công', {
                type: 'success',
            });

        } catch (error) {
            this.state.error = error.message || 'Có lỗi xảy ra khi tải lên ảnh';
        } finally {
            this.state.uploading = false;
        }
    }
}

// Register the component template
IDDocumentWidget.template = xml`
    <div class="id-document-widget">
        <div class="row mb-3">
            <div class="col-md-6">
                <div class="form-group">
                    <label for="front_image_input">Mặt trước CCCD</label>
                    <input type="file" 
                           id="front_image_input" 
                           class="form-control" 
                           accept="image/*" />
                    <t t-if="state.frontPreview">
                        <img t-att-src="state.frontPreview" 
                             class="img-preview mt-2" />
                    </t>
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label for="back_image_input">Mặt sau CCCD</label>
                    <input type="file" 
                           id="back_image_input" 
                           class="form-control" 
                           accept="image/*" />
                    <t t-if="state.backPreview">
                        <img t-att-src="state.backPreview" 
                             class="img-preview mt-2" />
                    </t>
                </div>
            </div>
        </div>
        
        <t t-if="state.error" class="alert alert-danger">
            <p><t t-esc="state.error"/></p>
        </t>
        
        <button class="btn btn-primary" 
                t-on-click="uploadImages" 
                t-att-disabled="state.uploading">
            <t t-if="state.uploading">Đang tải lên...</t>
            <t t-else="">Tải lên</t>
        </button>
    </div>
`;

// Add CSS styles
const style = document.createElement('style');
style.textContent = `
    .id-document-widget .img-preview {
        max-width: 100%;
        height: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
`;
document.head.appendChild(style);

// Register the component globally
const container = document.getElementById('id_document_widget_container');
if (container) {
    owl.mount(IDDocumentWidget, container);
}
