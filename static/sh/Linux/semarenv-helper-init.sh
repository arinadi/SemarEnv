#!/bin/bash
# Linux version of the SemarEnv helper installer (using systemd)

BIN="$1"  # Now only takes the binary path as argument (no plist needed)
DATA_PATH="$3"
APP_ROOT="$4"

SERVICE_NAME="semarenv-helper"
BIN_DEST="/usr/local/bin/semarenv-helper"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
ALLOW_ROOTS_PATH="/usr/local/share/SemarEnv/semarenv.allowed-roots"

# Remove existing service if it exists
if [ -f "$SERVICE_PATH" ]; then
  echo "Existing service found. Stopping and disabling..."
  sudo systemctl stop "$SERVICE_NAME"
  sudo systemctl disable "$SERVICE_NAME"
  sudo rm -f "$SERVICE_PATH"
fi

if [ -e "/tmp/semarenv-helper.sock" ]; then
  sudo chown "$2" "/tmp/semarenv-helper.sock"
fi

sudo mkdir -p "/usr/local/share/SemarEnv"
echo "$2" | sudo tee "/tmp/semarenv.role" >/dev/null
echo "$2" | sudo tee "/usr/local/share/SemarEnv/semarenv.role" >/dev/null
sudo chown "$2" "/tmp/semarenv.role"
sudo chmod 0600 "/tmp/semarenv.role"
sudo chown root:root "/usr/local/share/SemarEnv/semarenv.role"
sudo chmod 0644 "/usr/local/share/SemarEnv/semarenv.role"

if [ -n "$DATA_PATH" ]; then
  {
    printf '%s\n' "$DATA_PATH"
    if [ -n "$APP_ROOT" ]; then
      printf '%s\n' "$APP_ROOT"
    fi
  } | sudo tee "$ALLOW_ROOTS_PATH" >/dev/null
  sudo chown root:root "$ALLOW_ROOTS_PATH"
  sudo chmod 0644 "$ALLOW_ROOTS_PATH"
fi

# Copy the binary
echo "Installing binary..."
sudo mkdir -p "/usr/local/bin"
sudo rm -rf "$BIN_DEST" 2>/dev/null
echo "Copy $BIN to $BIN_DEST"
sudo cp "$BIN" "$BIN_DEST"
sudo chmod 755 "$BIN_DEST"

# Create systemd service file
echo "Creating systemd service..."
sudo tee "$SERVICE_PATH" > /dev/null <<EOL
[Unit]
Description=SemarEnv Helper Service

[Service]
ExecStart=/usr/local/bin/semarenv-helper
Restart=always
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and enable service
echo "Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start service. Check journalctl -u $SERVICE_NAME for details"
    exit 1
fi

echo "Installation complete. Service is running."
echo "To check status: sudo systemctl status $SERVICE_NAME"
echo "To view logs: sudo journalctl -u $SERVICE_NAME -f"
