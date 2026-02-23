from odoo import models, fields, api

class AITrainingHistory(models.Model):
    _name = 'ai.training.history'
    _description = 'AI Training History'
    _order = 'create_date desc'

    name = fields.Char(string='Tên Phiên Huấn Luyện', required=True)
    algorithm = fields.Char(string='Thuật toán')
    tickers = fields.Char(string='Mã Chứng Khoán')
    epochs = fields.Integer(string='Tổng Epochs')
    
    # Hyperparameters
    learning_rate = fields.Float(string='Learning Rate', digits=(16, 6))
    batch_size = fields.Integer(string='Batch Size')
    ent_coef = fields.Float(string='Entropy Coefficient', digits=(16, 4))

    # Kết quả
    final_loss = fields.Float(string='Final Loss')
    episode_reward_mean = fields.Float(string='Mean Reward')
    sharpe_ratio = fields.Float(string='Sharpe Ratio')
    max_drawdown = fields.Float(string='Max Drawdown (%)')
    training_time = fields.Char(string='Thời gian huấn luyện')
    
    # File Model đính kèm
    model_file = fields.Binary(string='File Mô hình (.zip)', attachment=True)
    model_filename = fields.Char(string='Tên File')
    
    log_text = fields.Text(string='Console Log')

    def action_create_strategy(self):
        """Tạo một AI Strategy mới từ Lịch sử Huấn luyện này."""
        self.ensure_one()
        new_strategy = self.env['ai.strategy'].create({
            'name': f"Strategy từ {self.name}",
            'algorithm': self.algorithm if self.algorithm in ['ppo', 'a2c', 'ddpg'] else 'ppo',
            'sharpe_ratio': self.sharpe_ratio,
            'model_file': self.model_file,
            'model_filename': self.model_filename,
            'description': f"Trích xuất tự động từ lịch sử huấn luyện ID {self.id}.\n{self.log_text or ''}",
            'status': 'trained'
        })
        return {
            'type': 'ir.actions.act_window',
            'name': 'AI Strategy',
            'res_model': 'ai.strategy',
            'res_id': new_strategy.id,
            'view_mode': 'form',
            'target': 'current',
        }
