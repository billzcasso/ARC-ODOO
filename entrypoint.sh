#!/bin/bash

set -e

# set the postgres database host, port, user and password according to the environment
# and pass them as arguments to the odoo process if not present in the config file
: ${HOST:=${DB_PORT_5432_TCP_ADDR:='db'}}
: ${PORT:=${DB_PORT_5432_TCP_PORT:=5432}}
: ${USER:=${DB_ENV_POSTGRES_USER:=${POSTGRES_USER:='odoo'}}}
: ${PASSWORD:=${DB_ENV_POSTGRES_PASSWORD:=${POSTGRES_PASSWORD:='odoo18@2024'}}}

# Cài đặt system dependencies
apt-get update && apt-get install -y git swig gcc g++ python3-venv

# Thiết lập Virtual Environment cô lập (Isolating AI environment)
VENV_PATH="/opt/odoo_venv"
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv --system-site-packages "$VENV_PATH"
fi
source "$VENV_PATH/bin/activate"

# Nâng cấp pip và cài đặt requirements (Xóa --ignore-installed để tránh hỏng package gốc của Odoo)
pip install --upgrade pip
echo "ARC-ODOO: Đang kiểm tra và cài đặt thư viện Python..."
pip install --no-cache-dir -r /etc/odoo/requirements.txt || echo "CẢNH BÁO: pip install có lỗi/cảnh báo nhưng vẫn tiếp tục..."

# Đảm bảo Odoo nhận diện được thư viện trong venv khi chạy
export PYTHONPATH="$VENV_PATH/lib/python$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')/site-packages:$PYTHONPATH"
# sed -i 's|raise werkzeug.exceptions.BadRequest(msg)|self.jsonrequest = {}|g' /usr/lib/python3/dist-packages/odoo/http.py

# Install logrotate if not already installed
if ! dpkg -l | grep -q logrotate; then
    apt-get update && apt-get install -y logrotate
fi

# Copy logrotate config
cp /etc/odoo/logrotate /etc/logrotate.d/odoo

# Start cron daemon (required for logrotate)
cron

DB_ARGS=()
function check_config() {
    param="$1"
    value="$2"
    if grep -q -E "^\s*\b${param}\b\s*=" "$ODOO_RC" ; then       
        value=$(grep -E "^\s*\b${param}\b\s*=" "$ODOO_RC" |cut -d " " -f3|sed 's/["\n\r]//g')
    fi;
    DB_ARGS+=("--${param}")
    DB_ARGS+=("${value}")
}
check_config "db_host" "$HOST"
check_config "db_port" "$PORT"
check_config "db_user" "$USER"
check_config "db_password" "$PASSWORD"

case "$1" in
    -- | odoo)
        shift
        if [[ "$1" == "scaffold" ]] ; then
            exec odoo "$@"
        else
            wait-for-psql.py ${DB_ARGS[@]} --timeout=30
            exec odoo "$@" "${DB_ARGS[@]}"
        fi
        ;;
    -*)
        wait-for-psql.py ${DB_ARGS[@]} --timeout=30
        exec odoo "$@" "${DB_ARGS[@]}"
        ;;
    *)
        exec "$@"
esac

exit 1