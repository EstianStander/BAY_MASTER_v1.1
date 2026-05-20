#!/bin/bash
# ============================================================
#  BayMaster – Ubuntu Server Deployment Script
#  Run this ONCE on your server to install & start everything.
#  Usage:  bash deploy-ubuntu.sh
# ============================================================

set -e   # exit immediately on any error

APP_DIR="$HOME/Documents/BAY_Master"   # change if you copied it elsewhere

echo "===== 1. Update system packages ====="
sudo apt update && sudo apt upgrade -y

echo "===== 2. Install Node.js 20.x (LTS) ====="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Node version: $(node -v)"
echo "NPM  version: $(npm -v)"

echo "===== 3. Install PM2 globally ====="
sudo npm install -g pm2

echo "===== 4. Install backend dependencies ====="
cd "$APP_DIR"
npm install --omit=dev

echo "===== 5. Build the preplanner React UI ====="
cd "$APP_DIR/preplanner-ui"
npm install
npm run build           # outputs to preplanner-ui/dist  (served by Express)
cd "$APP_DIR"

echo "===== 6. Create .env file if it doesn't already exist ====="
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<'EOF'
# ---------- Server ----------
PORT=3000
NODE_ENV=production

# ---------- MongoDB ----------
# Replace the URI below with your own if needed
MONGO_URI=mongodb+srv://stormfoxstudi_db_user:WjZLMVHXEpfSdtAU@inductotrackdb.q5ekljf.mongodb.net/baymaster

# ---------- Media storage (optional – defaults used if left blank) ----------
# PROJECT_IMAGES_DIR=
# EQUIPMENT_UPLOADS_DIR=
# VISITOR_SIGNATURES_DIR=
EOF
  echo ".env created – edit $APP_DIR/.env to change values."
else
  echo ".env already exists – skipping creation."
fi

echo "===== 7. Start app with PM2 ====="
pm2 start server.js --name bay_master --restart-delay=3000

echo "===== 8. Save PM2 process list ====="
pm2 save

echo "===== 9. Register PM2 as a systemd service (survives reboots/power cuts) ====="
# This prints a command you need to run – we capture and execute it automatically
PM2_STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1)
echo "Running: $PM2_STARTUP_CMD"
eval "$PM2_STARTUP_CMD"

pm2 save   # save again after startup hook is set

echo ""
echo "====================================================="
echo "  BayMaster is running!"
echo "  URL  : http://$(hostname -I | awk '{print $1}'):3000"
echo "  Logs : pm2 logs bay_master"
echo "  Status: pm2 status"
echo "====================================================="



http://192.168.0.167:3000
