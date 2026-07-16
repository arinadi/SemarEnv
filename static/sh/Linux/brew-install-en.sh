#!/bin/bash
# Homebrew installer script (Linux version)
# æ£€æµ‹å¹¶å®‰è£…ï¼ˆéœ€è¦ rootï¼‰
install_packages() {
    if [ $# -eq 0 ]; then
        echo "Usage: install_packages package1 package2 ..."
        return 1
    fi
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y "$@"
    elif command -v yum &> /dev/null; then
        sudo yum install -y "$@"
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y "$@"
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm "$@"
    elif command -v zypper &> /dev/null; then
        sudo zypper install -y "$@"
    elif command -v apk &> /dev/null; then
        sudo apk add "$@"
    else
        echo "UnKnow Package Manager"
        exit 1
    fi
}

# æ”¹è¿›ï¼šé…ç½®çŽ¯å¢ƒå˜é‡çš„å‡½æ•°ï¼Œæ”¯æŒ bash å’Œ zshï¼Œå¹¶é˜²æ­¢é‡å¤å†™å…¥
configure_env() {
    local brew_path="$1"
    local shell_configs=("$HOME/.bashrc" "$HOME/.zshrc")

    for config in "${shell_configs[@]}"; do
        if [ -f "$config" ]; then
            # æ£€æŸ¥æ˜¯å¦å·²ç»åŒ…å« eval è¯­å¥ï¼Œé¿å…é‡å¤æ·»åŠ 
            if ! grep -q "$brew_path/bin/brew shellenv" "$config"; then
                echo -e "${tty_green}Updating $config...${tty_reset}"
                echo "eval \"\$($brew_path/bin/brew shellenv)\"" >> "$config"
            fi
        fi
    done
    # åœ¨å½“å‰è¿›ç¨‹ç«‹å³ç”Ÿæ•ˆ
    eval "$($brew_path/bin/brew shellenv)"
}

# String coloring functions
if [[ -t 1 ]]; then
  tty_escape() { printf "\033[%sm" "$1"; }
else
  tty_escape() { :; }
fi
tty_universal() { tty_escape "0;$1"; } # Normal display
tty_green="$(tty_universal 32)"        # Green
tty_reset="$(tty_escape 0)"            # Reset color

# Check if Homebrew is already installed (Linux version)
if command -v brew &>/dev/null; then
    echo -e "${tty_green}\nDetected that brew is already installed. The installer script will exit automatically.${tty_reset}"
    echo "SemarEnv-End of Homebrew installation"
    exit 0
fi

# User confirmation
echo -e "\n              ${tty_green}Starting the Homebrew installer${tty_reset}"
echo -n "${tty_green}-> Do you want to proceed with the installation now? (Y/N) "
read user_input
echo "${tty_reset}"

case "$user_input" in
    [yY])
        echo "--> Beginning script execution"
        ;;
    *)
        echo "You entered '$user_input'. Installation aborted. To continue, please type Y or y."
        echo "SemarEnv-End of Homebrew installation"
        exit 0
        ;;
esac

echo -e "${tty_green}Installing prerequisites...${tty_reset}"
install_packages git curl
if command -v apt-get &> /dev/null; then
    install_packages build-essential
elif command -v dnf &> /dev/null; then
    install_packages gcc gcc-c++ make
elif command -v yum &> /dev/null; then
    install_packages gcc gcc-c++ make
elif command -v zypper &> /dev/null; then
    install_packages gcc gcc-c++ make
elif command -v pacman &> /dev/null; then
    install_packages base-devel
elif command -v apk &> /dev/null; then
    install_packages build-base
fi

# Linux-specific Homebrew installation command
echo -e "${tty_green}Installing Homebrew (Linux version)...${tty_reset}"
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Configure environment variables (Linux-specific paths)
if [[ -f "$HOME/.linuxbrew/bin/brew" ]]; then
    configure_env "$HOME/.linuxbrew"
elif [[ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]]; then
    configure_env "/home/linuxbrew/.linuxbrew"
fi

brew install gcc

echo "SemarEnv-End of Homebrew installation"
