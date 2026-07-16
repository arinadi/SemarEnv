#!/bin/zsh
PLIST_SRC="$1"
BIN="$2"
DATA_PATH="$4"
APP_ROOT="$5"

PLIST_PATH="/Library/LaunchDaemons/com.semarenv.helper.plist"
BIN_DEST="/Library/Application Support/SemarEnv/Helper/semarenv-helper"
ALLOW_ROOTS_PATH="/usr/local/share/SemarEnv/semarenv.allowed-roots"

OS_VERSION=$(sw_vers -productVersion | cut -d. -f1)

# Check if plist file already exists
if [ -f "$PLIST_PATH" ]; then
  echo "Existing plist found. Unloading the existing Launch Daemon..."
  sudo launchctl enable "system/com.semarenv.helper" 2>/dev/null
  if [ "$OS_VERSION" -ge 13 ]; then
    echo "launchctl bootout system \"$PLIST_PATH\""
    sudo launchctl bootout system "$PLIST_PATH" 2>/dev/null
  else
    echo "launchctl unload \"$PLIST_PATH\""
    sudo launchctl unload "$PLIST_PATH" 2>/dev/null
  fi
fi

if [ -e "/tmp/semarenv-helper.sock" ]; then
  sudo chown "$3" "/tmp/semarenv-helper.sock"
fi

sudo mkdir -p "/usr/local/share/SemarEnv"
echo "$3" | sudo tee "/tmp/semarenv.role" >/dev/null
echo "$3" | sudo tee "/usr/local/share/SemarEnv/semarenv.role" >/dev/null
sudo chown "$3" "/tmp/semarenv.role"
sudo chmod 0600 "/tmp/semarenv.role"
sudo chown root:wheel "/usr/local/share/SemarEnv/semarenv.role"
sudo chmod 0644 "/usr/local/share/SemarEnv/semarenv.role"

if [ -n "$DATA_PATH" ]; then
  {
    printf '%s\n' "$DATA_PATH"
    if [ -n "$APP_ROOT" ]; then
      printf '%s\n' "$APP_ROOT"
    fi
  } | sudo tee "$ALLOW_ROOTS_PATH" >/dev/null
  sudo chown root:wheel "$ALLOW_ROOTS_PATH"
  sudo chmod 0644 "$ALLOW_ROOTS_PATH"
fi

# Copy the new plist file
echo "Copying new plist file..."
sudo rm -rf "$PLIST_PATH" 2>/dev/null
sudo cp "$PLIST_SRC" "$PLIST_PATH"
sudo mkdir -p "/Library/Application Support/SemarEnv/Helper"
sudo rm -rf "$BIN_DEST" 2>/dev/null
sudo cp "$BIN" "$BIN_DEST"

# Set the correct permissions
sudo chmod 644 "$PLIST_PATH"
sudo chmod 755 "$BIN_DEST"

# Load the new Launch Daemon
echo "Loading new Launch Daemon..."
sudo launchctl enable "system/com.semarenv.helper" 2>/dev/null
if [ "$OS_VERSION" -ge 13 ]; then
  echo "launchctl bootstrap system \"$PLIST_PATH\""
  sudo launchctl bootstrap system "$PLIST_PATH"
else
  echo "launchctl load \"$PLIST_PATH\""
  sudo launchctl load "$PLIST_PATH"
fi

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to load daemon. Please grant permission"
    exit 1
fi

echo "Installation complete."
