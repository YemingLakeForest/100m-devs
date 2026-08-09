#!/bin/bash
#
# 100,000,000 Developers — deploy to a phone.
#
# The web build goes to Cloudflare Pages from GitHub Actions on push to main
# (.github/workflows/deploy-web.yml); nothing here touches the web. This script
# is only the handset: build the snapshot APK and stream it over ADB.
#
# Usage:
#   ./deploy.sh              # Build APK and install via ADB
#   ./deploy.sh --skip       # Install latest APK without rebuilding
#   ./deploy.sh --launch     # Build, install, and launch the app
#
# The game is landscape-locked (GDD §23.4, `sensorLandscape` in the manifest),
# so the phone will rotate itself on launch whatever way up you are holding it.
#

set -e
cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

APP_ID="com.mercilessstudio.m100devs"

echo -e "${CYAN}${BOLD}100M Developers Deploy${NC}"
echo -e "${CYAN}======================${NC}"

# ─── Parse arguments ──────────────────────────────────────────────────────────

SKIP_BUILD=0
LAUNCH=0
TARGET_IP=""
IP_CACHE=".adb-wifi-ip"

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip|-s)      SKIP_BUILD=1; shift ;;
        --launch|-l)    LAUNCH=1;     shift ;;
        --ip|-i)        TARGET_IP="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Builds the snapshot APK and installs it on the connected phone via ADB."
            echo "Connects over Wi-Fi automatically (cached IP, USB tcpip setup, or known IPs)."
            echo ""
            echo "Options:"
            echo "  -s, --skip      Install latest APK without rebuilding"
            echo "  -l, --launch    Build, install, and launch the app"
            echo "  -i, --ip ADDR   Connect to a specific phone IP (port defaults to 5555)"
            echo ""
            echo "Env:"
            echo "  VITE_BENCH=1    Include the GDD §23.3 on-device bench button"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
    esac
done

# ─── Platform detection ───────────────────────────────────────────────────────

detect_platform() {
    case "$(uname -s)" in
        Linux*)  PLATFORM="Linux" ;;
        Darwin*) PLATFORM="macOS" ;;
        CYGWIN*) PLATFORM="Cygwin" ;;
        MINGW*)  PLATFORM="MinGW" ;;
        MSYS*)   PLATFORM="MSYS" ;;
        *)       PLATFORM="Unknown" ;;
    esac
}

find_adb() {
    local adb_locations=()
    if [[ "$PLATFORM" == "Linux" || "$PLATFORM" == "macOS" ]]; then
        adb_locations=(
            "$HOME/Android/Sdk/platform-tools/adb"
            "/usr/bin/adb"
            "/usr/local/bin/adb"
            "adb"
        )
    elif [[ "$PLATFORM" == "Cygwin" || "$PLATFORM" == "MinGW" || "$PLATFORM" == "MSYS" ]]; then
        [[ -n "$LOCALAPPDATA" ]] && adb_locations+=("$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe")
        [[ -n "$USERPROFILE" ]]  && adb_locations+=("$USERPROFILE/AppData/Local/Android/Sdk/platform-tools/adb.exe")
        adb_locations+=("adb.exe")
    else
        adb_locations=("adb")
    fi

    for location in "${adb_locations[@]}"; do
        if command -v "$location" &> /dev/null; then
            ADB_PATH="$location"
            return 0
        fi
    done
    return 1
}

# ─── Wi-Fi debugging ──────────────────────────────────────────────────────────

# Returns 0 if at least one wireless (ip:port) device is connected as "device".
wifi_device_connected() {
    "$ADB_PATH" devices | grep -qE '^[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+[[:space:]]+device$'
}

# Strip carriage returns / surrounding whitespace (MinGW `read` can leave \r).
_clean() { echo "$1" | tr -d '\r' | xargs; }

# Wait for an authorized USB device, prompting through the auth dialog if needed.
ensure_usb_authorized() {
    if "$ADB_PATH" devices | grep -q "unauthorized"; then
        echo -e "${YELLOW}Phone shows 'unauthorized'. Accept the 'Allow USB debugging' dialog on the phone${NC}"
        read -rp "(check 'Always allow from this computer'), then press Enter... " _
    fi
    [[ "$("$ADB_PATH" get-state 2>/dev/null | tr -d '\r')" == "device" ]]
}

# Auto-detect the phone's Wi-Fi (wlan0) IP via the authorized USB device.
detect_phone_ip() {
    local ip
    ip=$("$ADB_PATH" shell ip -f inet addr show wlan0 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}' | head -1 | tr -d '\r')
    [[ -z "$ip" ]] && ip=$("$ADB_PATH" shell ip route 2>/dev/null | grep -oE 'src [0-9.]+' | awk '{print $2}' | head -1 | tr -d '\r')
    echo "$ip"
}

# Returns 0 if a USB (non ip:port) device is attached as "device".
usb_device_connected() {
    "$ADB_PATH" devices | tail -n +2 | grep -v ':' | grep -qE 'device$'
}

# Connect to an address (port defaults to 5555) and VERIFY; cache on success.
try_connect() {
    local addr
    addr=$(_clean "$1")
    [[ -z "$addr" ]] && return 1
    [[ "$addr" != *:* ]] && addr="${addr}:5555"
    echo -e "${CYAN}Trying ${addr}...${NC}"
    "$ADB_PATH" connect "$addr" >/dev/null 2>&1 || true
    sleep 1
    if "$ADB_PATH" devices | grep -E "[[:space:]]device$" | grep -q "^${addr}"; then
        echo "$addr" > "$IP_CACHE"
        echo -e "${GREEN}✓ Connected to ${addr}${NC}"
        return 0
    fi
    return 1
}

# Wi-Fi connect, in order of least friction (the adb tcpip route — the one that
# has worked on this setup — not the Android 11 pairing-code flow):
#   1. already-connected wireless device
#   2. --ip argument
#   3. cached last-known address (.adb-wifi-ip)
#   4. USB attached -> adb tcpip 5555 -> auto-detect IP -> connect
#   5. common home-network IPs
#   6. fall back to plain USB install if a cable is attached
connect_wifi_if_needed() {
    if wifi_device_connected; then
        echo -e "${GREEN}✓ Wireless device already connected${NC}"
        return 0
    fi

    if [[ -n "$TARGET_IP" ]]; then
        try_connect "$TARGET_IP" && return 0
        echo -e "${RED}Could not connect to ${TARGET_IP}.${NC}"
    fi

    if [[ -f "$IP_CACHE" ]]; then
        try_connect "$(cat "$IP_CACHE")" && return 0
    fi

    if usb_device_connected; then
        echo -e "${YELLOW}USB device detected — enabling Wi-Fi ADB (tcpip 5555)...${NC}"
        if ensure_usb_authorized; then
            local phone_ip
            phone_ip=$(detect_phone_ip)
            "$ADB_PATH" tcpip 5555 || true
            sleep 2
            if [[ -n "$phone_ip" ]] && try_connect "$phone_ip"; then
                echo -e "${YELLOW}You can unplug the USB cable now.${NC}"
                return 0
            fi
            echo -e "${YELLOW}Wi-Fi connect failed — continuing with the USB connection.${NC}"
            return 0
        fi
    fi

    local ip
    for ip in 192.168.1.173 192.168.1.100 192.168.0.100 10.0.0.100; do
        try_connect "$ip" && return 0
    done

    if usb_device_connected; then
        echo -e "${YELLOW}No Wi-Fi connection — using the USB device.${NC}"
        return 0
    fi

    echo -e "${RED}No device reachable over Wi-Fi and no USB device attached.${NC}"
    echo -e "${YELLOW}First-time setup:${NC}"
    echo -e "${YELLOW}  1. Connect the phone via USB (USB debugging on) and re-run ./deploy.sh${NC}"
    echo -e "${YELLOW}     (it will switch the phone to Wi-Fi ADB automatically), or${NC}"
    echo -e "${YELLOW}  2. Run ./deploy.sh --ip <phone-ip> with the IP from Settings -> About -> Status${NC}"
    exit 1
}

# ─── Mobile deploy ────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}${BOLD}[ Mobile Deploy ]${NC}"

detect_platform
echo -e "${CYAN}Platform: $PLATFORM${NC}"

echo -e "${CYAN}Looking for ADB...${NC}"
if ! find_adb; then
    echo -e "${RED}ADB not found!${NC}"
    echo -e "${YELLOW}Make sure Android SDK is installed and ADB is in your PATH.${NC}"
    echo -e "${YELLOW}  Linux/macOS: ~/Android/Sdk/platform-tools/adb${NC}"
    echo -e "${YELLOW}  Windows:     %LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe${NC}"
    exit 1
fi
echo -e "${GREEN}Found ADB at: $ADB_PATH${NC}"

connect_wifi_if_needed

echo -e "${CYAN}Checking for connected devices...${NC}"
DEVICES=$("$ADB_PATH" devices | grep -E "device$|emulator-" | wc -l)
if [[ $DEVICES -eq 0 ]]; then
    echo -e "${RED}No Android device connected via USB/ADB.${NC}"
    echo -e "${YELLOW}  1. Connect your phone via USB${NC}"
    echo -e "${YELLOW}  2. Enable Developer Options${NC}"
    echo -e "${YELLOW}  3. Enable USB Debugging${NC}"
    echo -e "${YELLOW}  4. Check 'Always allow from this computer' when prompted${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Device detected${NC}"

if [[ $SKIP_BUILD -eq 0 ]]; then
    echo -e "${CYAN}Building APK...${NC}"
    bash build-snapshot.sh
    echo -e "${GREEN}✓ APK built${NC}"
fi

echo -e "${CYAN}Finding latest APK...${NC}"
shopt -s nullglob
APK_FILES=(.apk/m100devs-snapshot-*.apk)
shopt -u nullglob
if [[ ${#APK_FILES[@]} -eq 0 ]]; then
    echo -e "${RED}No APK files found in .apk/!${NC}"
    echo -e "${YELLOW}Run ./deploy.sh without --skip to build one.${NC}"
    exit 1
fi

# The names carry a sortable YYYYMMDD-HHMMSS, so newest is last alphabetically.
LATEST_APK=""
for file in "${APK_FILES[@]}"; do
    [[ -z "$LATEST_APK" || "$file" > "$LATEST_APK" ]] && LATEST_APK="$file"
done

echo -e "${GREEN}Latest APK: $LATEST_APK${NC}"

APK_PATH="$LATEST_APK"
if [[ "$PLATFORM" == "Cygwin" || "$PLATFORM" == "MinGW" || "$PLATFORM" == "MSYS" ]]; then
    APK_PATH=$(cygpath -w "$LATEST_APK" 2>/dev/null || echo "$LATEST_APK")
fi

echo -e "${CYAN}Installing APK (streamed)...${NC}"
if "$ADB_PATH" install -r "$APK_PATH"; then
    echo -e "${GREEN}✓ APK installed${NC}"
else
    echo -e "${YELLOW}Retrying without -r flag...${NC}"
    if "$ADB_PATH" install "$APK_PATH"; then
        echo -e "${GREEN}✓ APK installed${NC}"
    else
        echo -e "${RED}APK installation failed!${NC}"
        echo -e "${YELLOW}  1. Uninstall existing app from phone (adb uninstall ${APP_ID})${NC}"
        echo -e "${YELLOW}  2. Check phone storage space${NC}"
        echo -e "${YELLOW}  3. Verify USB connection${NC}"
        exit 1
    fi
fi

if [[ $LAUNCH -eq 1 ]]; then
    echo -e "${CYAN}Launching app...${NC}"
    if "$ADB_PATH" shell am start -n ${APP_ID}/.MainActivity; then
        echo -e "${GREEN}✓ App launched${NC}"
    else
        echo -e "${YELLOW}Could not launch automatically — open the app manually.${NC}"
    fi
fi

echo -e "${GREEN}✅ Mobile deploy complete!${NC}"
echo -e "${CYAN}APK: $LATEST_APK${NC}"
echo -e "${CYAN}Logs: adb logcat -s Capacitor:V Capacitor/Console:V${NC}"
