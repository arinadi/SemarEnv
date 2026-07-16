#!/bin/bash
# ä»…é€‚ç”¨äºŽä¸­å›½ç”¨æˆ·ã€‚è¯·å‹¿ç¼–è¾‘ã€‚
# å­—ç¬¦ä¸²æŸ“è‰²ç¨‹åº

if [[ -t 1 ]]; then
    tty_escape() { printf "\033[%sm" "$1"; }
else
    tty_escape() { :; }
fi

tty_universal() { tty_escape "0;$1"; }  # æ­£å¸¸æ˜¾ç¤º
tty_blue="$(tty_universal 34)"          # è“è‰²
tty_red="$(tty_universal 31)"           # çº¢è‰²
tty_green="$(tty_universal 32)"         # ç»¿è‰²
tty_yellow="$(tty_universal 33)"        # é»„è‰²
tty_bold="$(tty_universal 39)"          # åŠ é»‘
tty_cyan="$(tty_universal 36)"          # é’è‰²
tty_reset="$(tty_escape 0)"             # åŽ»é™¤é¢œè‰²

# æ£€æµ‹æ˜¯å¦å·²å®‰è£… Homebrewï¼ˆLinux é€‚é…ç‰ˆï¼‰
if command -v brew &>/dev/null; then
    echo -n "${tty_green}
    æ£€æµ‹åˆ°brewå·²å®‰è£…, å®‰è£…è„šæœ¬è‡ªåŠ¨é€€å‡º${tty_reset}"
    echo "SemarEnv-Homebrewå®‰è£…ç»“æŸ"
    exit 0
fi

echo "
              ${tty_green} å¼€å§‹æ‰§è¡ŒHomebrewå®‰è£…ç¨‹åº ${tty_reset}
"

# é€‰æ‹©ä¸€ä¸ªbrewä¸‹è½½æº
echo -n "${tty_green}
è¯·é€‰æ‹©brewå®‰è£…è„šæœ¬
1. brewå®˜æ–¹è„šæœ¬, ä»Žgithubå®‰è£…, æ— æ³•è®¿é—®githubæˆ–githubè®¿é—®æ…¢çš„ä¸å»ºè®®é€‰æ‹©
2. brewå›½å†…å®‰è£…è„šæœ¬, å¯é€‰brewè½¯ä»¶æº, brewå®˜æ–¹è„šæœ¬æ— æ³•å®‰è£…æ—¶å¯é€‰ç”¨ ${tty_reset}"
echo -n "
${tty_blue}è¯·è¾“å…¥åºå·: "
read MY_DOWN_NUM
echo "${tty_reset}"

case $MY_DOWN_NUM in
    "1")
        echo "
        ä½ é€‰æ‹©äº†brewå®˜æ–¹è„šæœ¬
        "
        ;;
    "2")
        echo "
        brewå›½å†…å®‰è£…è„šæœ¬
        "
        ;;
    *)
        echo "
        brewå›½å†…å®‰è£…è„šæœ¬
        "
        MY_DOWN_NUM="2"
        ;;
esac

echo -n "${tty_green}
->æ˜¯å¦çŽ°åœ¨å¼€å§‹æ‰§è¡Œè„šæœ¬ï¼ˆN/Yï¼‰ "
read MY_Del_Old
echo "${tty_reset}"

case $MY_Del_Old in
    "y")
        echo "--> è„šæœ¬å¼€å§‹æ‰§è¡Œ"
        ;;
    "Y")
        echo "--> è„šæœ¬å¼€å§‹æ‰§è¡Œ"
        ;;
    *)
        echo "ä½ è¾“å…¥äº† $MY_Del_Old ï¼Œå®‰è£…é€€å‡º, å¦‚æžœç»§ç»­è¿è¡Œè„šæœ¬åº”è¯¥è¾“å…¥Yæˆ–è€…y
        "
        echo "SemarEnv-Homebrewå®‰è£…ç»“æŸ"
        exit 0
        ;;
esac

sudo echo 'å¼€å§‹æ‰§è¡Œ'

case $MY_DOWN_NUM in
    "1")
        # Linux ç‰ˆå®˜æ–¹å®‰è£…å‘½ä»¤
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # è‡ªåŠ¨é…ç½® Linuxbrew çŽ¯å¢ƒå˜é‡
        if [[ -f "$HOME/.linuxbrew/bin/brew" ]]; then
            echo -e "${tty_green}æ£€æµ‹åˆ° Linuxbrewï¼Œé…ç½®çŽ¯å¢ƒå˜é‡...${tty_reset}"
            echo 'eval "$($HOME/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc
            eval "$($HOME/.linuxbrew/bin/brew shellenv)"
        fi

        if [[ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]]; then
            echo -e "${tty_green}æ£€æµ‹åˆ° Linuxbrewï¼Œé…ç½®çŽ¯å¢ƒå˜é‡...${tty_reset}"
            echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        fi
        ;;
    "2")
        # å›½å†…å®‰è£…è„šæœ¬ï¼ˆæ³¨æ„ç¡®è®¤è¯¥è„šæœ¬æ˜¯å¦æ”¯æŒ Linuxï¼‰
        /bin/bash -c "$(curl -fsSL https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh)"

        # å›½å†…è„šæœ¬å¯èƒ½ä¸ä¼šè‡ªåŠ¨é…ç½® Linux è·¯å¾„ï¼Œéœ€è¦æ‰‹åŠ¨å¤„ç†
        if [[ -f "$HOME/.linuxbrew/bin/brew" ]]; then
            echo -e "${tty_green}æ£€æµ‹åˆ° Linuxbrewï¼Œé…ç½®çŽ¯å¢ƒå˜é‡...${tty_reset}"
            echo 'eval "$($HOME/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc
            eval "$($HOME/.linuxbrew/bin/brew shellenv)"
        fi

        if [[ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]]; then
            echo -e "${tty_green}æ£€æµ‹åˆ° Linuxbrewï¼Œé…ç½®çŽ¯å¢ƒå˜é‡...${tty_reset}"
            echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        fi
        ;;
esac

sudo apt-get install build-essential > /dev/null 2>&1
brew install gcc

echo "${tty_green}Homebrew å®‰è£…å®Œæˆï¼Œå»ºè®®è¿è¡Œä»¥ä¸‹å‘½ä»¤æ£€æµ‹ï¼š${tty_reset}"
echo "brew doctor"
echo "SemarEnv-Homebrewå®‰è£…ç»“æŸ"
