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

# The serial of the first wireless (ip:port) device connected as "device", if any.
wifi_device_serial() {
    "$ADB_PATH" devices | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+[[:space:]]+device$' \
        | head -1 | awk '{print $1}' | tr -d '\r'
}

# Returns 0 if at least one wireless (ip:port) device is connected as "device".
wifi_device_connected() {
    [[ -n "$(wifi_device_serial)" ]]
}

# Strip carriage returns / surrounding whitespace (MinGW `read` can leave \r).
_clean() { echo "$1" | tr -d '\r' | xargs; }

# Wait for an authorized USB device, prompting through the auth dialog if needed.
#
# `-d` throughout this section: it means "the one connected USB device", which
# is exactly what these three functions are talking to. Bare `adb get-state` /
# `adb shell` fail with "more than one device/emulator" the moment anything else
# is attached, and this whole path exists to run *while* setting up a second
# (wireless) entry for the same handset.
ensure_usb_authorized() {
    if "$ADB_PATH" devices | grep -q "unauthorized"; then
        echo -e "${YELLOW}Phone shows 'unauthorized'. Accept the 'Allow USB debugging' dialog on the phone${NC}"
        read -rp "(check 'Always allow from this computer'), then press Enter... " _
    fi
    [[ "$("$ADB_PATH" -d get-state 2>/dev/null | tr -d '\r')" == "device" ]]
}

# Auto-detect the phone's Wi-Fi (wlan0) IP via the authorized USB device.
detect_phone_ip() {
    local ip
    ip=$("$ADB_PATH" -d shell ip -f inet addr show wlan0 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}' | head -1 | tr -d '\r')
    [[ -z "$ip" ]] && ip=$("$ADB_PATH" -d shell ip route 2>/dev/null | grep -oE 'src [0-9.]+' | awk '{print $2}' | head -1 | tr -d '\r')
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
    # --ip is checked before the already-connected shortcut, not after: asking
    # for a specific handset while a different one happens to be connected is
    # exactly when the flag is being used, and the shortcut would swallow it.
    if [[ -n "$TARGET_IP" ]]; then
        try_connect "$TARGET_IP" && return 0
        echo -e "${RED}Could not connect to ${TARGET_IP}.${NC}"
    fi

    if wifi_device_connected; then
        echo -e "${GREEN}✓ Wireless device already connected${NC}"
        return 0
    fi

    if [[ -f "$IP_CACHE" ]]; then
        try_connect "$(cat "$IP_CACHE")" && return 0
    fi

    if usb_device_connected; then
        echo -e "${YELLOW}USB device detected — enabling Wi-Fi ADB (tcpip 5555)...${NC}"
        if ensure_usb_authorized; then
            local phone_ip
            phone_ip=$(detect_phone_ip)
            "$ADB_PATH" -d tcpip 5555 || true
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

# ─── Pick one device ──────────────────────────────────────────────────────────
#
# **Every adb call from here down is `-s "$ADB_TARGET"`, and that is the whole
# point of this block.** The success case of `connect_wifi_if_needed` is a phone
# attached over USB *and* connected over Wi-Fi — the same handset, listed twice,
# because switching it to `tcpip 5555` does not unplug the cable. Bare
# `adb install` then fails with "more than one device/emulator" and reports it
# as an installation failure, which sends you looking at storage space and USB
# cables for a problem that is neither.
#
# Wireless wins the tie: it is the connection this script goes out of its way to
# establish, and preferring it means the cable can come out mid-session without
# the next run behaving differently.

echo -e "${CYAN}Checking for connected devices...${NC}"

# An explicit --ip is the answer to "which device", if it connected.
ADB_TARGET=""
if [[ -n "$TARGET_IP" ]]; then
    WANTED=$(_clean "$TARGET_IP")
    [[ "$WANTED" != *:* ]] && WANTED="${WANTED}:5555"
    "$ADB_PATH" devices | grep -E "[[:space:]]device$" | grep -q "^${WANTED}" && ADB_TARGET="$WANTED"
fi

[[ -z "$ADB_TARGET" ]] && ADB_TARGET=$(wifi_device_serial)
if [[ -n "$ADB_TARGET" ]]; then
    echo -e "${GREEN}✓ Target: ${ADB_TARGET} (wireless)${NC}"
else
    # Anything left that is ready: a USB handset, or an emulator if that is all
    # there is. `tail -n +2` drops the "List of devices attached" header.
    ADB_TARGET=$("$ADB_PATH" devices | tail -n +2 | grep -E "[[:space:]]device$" \
        | head -1 | awk '{print $1}' | tr -d '\r')
    if [[ -z "$ADB_TARGET" ]]; then
        echo -e "${RED}No Android device connected via USB/ADB.${NC}"
        echo -e "${YELLOW}  1. Connect your phone via USB${NC}"
        echo -e "${YELLOW}  2. Enable Developer Options${NC}"
        echo -e "${YELLOW}  3. Enable USB Debugging${NC}"
        echo -e "${YELLOW}  4. Check 'Always allow from this computer' when prompted${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Target: ${ADB_TARGET}${NC}"
fi

# Say so when there is more than one, because "it installed on the other phone"
# is otherwise a silent outcome.
DEVICE_COUNT=$("$ADB_PATH" devices | tail -n +2 | grep -cE "[[:space:]]device$" || true)
if [[ $DEVICE_COUNT -gt 1 ]]; then
    echo -e "${YELLOW}  ($DEVICE_COUNT devices attached — installing to ${ADB_TARGET} only.${NC}"
    echo -e "${YELLOW}   Use --ip <addr> to pick a different one.)${NC}"
fi

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

# **adb says why it failed. Print that.**
#
# This block used to swallow adb's output and offer three guesses — uninstall,
# storage space, USB cable — none of which is the usual cause and all of which
# take a while to rule out. The block twenty lines above already makes this
# complaint about a different failure ("sends you looking at storage space and
# USB cables for a problem that is neither") and then this one did it anyway.
#
# Every real cause names itself in the output. INSTALL_FAILED_UPDATE_INCOMPATIBLE
# is a signing-key mismatch and is by far the most common: a snapshot built here
# and a build from another machine are signed with *different debug keys*, so the
# phone refuses the upgrade. INSTALL_FAILED_INSUFFICIENT_STORAGE is the one the
# old advice was written for and is rare. So the output is captured and shown,
# and the hint is chosen from what adb actually said.
install_apk() {
    "$ADB_PATH" -s "$ADB_TARGET" install "$@" "$APK_PATH" 2>&1
}

INSTALL_OUT=$(install_apk -r) && INSTALL_OK=1 || INSTALL_OK=0
if [[ $INSTALL_OK -eq 0 ]]; then
    echo -e "${YELLOW}Retrying without -r flag...${NC}"
    INSTALL_OUT=$(install_apk) && INSTALL_OK=1 || INSTALL_OK=0
fi

# A signature mismatch means the phone holds a build from a machine using a
# different keystore. The APK is now signed with the committed snapshot key
# (see android/app/build.gradle), so this can only be a leftover build from
# before that key existed. Wipe it and reinstall — snapshot data is disposable.
if [[ $INSTALL_OK -eq 0 ]]; then
    case "$INSTALL_OUT" in
        *UPDATE_INCOMPATIBLE*|*INCONSISTENT_CERTIFICATES*|*signatures\ do\ not\ match*)
            echo -e "${YELLOW}Installed app is signed with a different key — uninstalling and reinstalling.${NC}"
            "$ADB_PATH" -s "$ADB_TARGET" uninstall "$APP_ID" >/dev/null 2>&1 || true
            INSTALL_OUT=$(install_apk) && INSTALL_OK=1 || INSTALL_OK=0
            ;;
    esac
fi

if [[ $INSTALL_OK -eq 1 ]]; then
    echo -e "${GREEN}✓ APK installed${NC}"
else
    echo -e "${RED}APK installation failed. adb said:${NC}"
    echo "$INSTALL_OUT" | sed 's/^/    /'
    echo ""
    case "$INSTALL_OUT" in
        *UPDATE_INCOMPATIBLE*|*INCONSISTENT_CERTIFICATES*|*signatures\ do\ not\ match*)
            echo -e "${YELLOW}Signature mismatch that uninstall-and-reinstall could not fix.${NC}"
            echo -e "${BOLD}    $ADB_PATH -s $ADB_TARGET uninstall ${APP_ID}${NC}"
            echo -e "${YELLOW}then re-run this script.${NC}"
            ;;
        *INSUFFICIENT_STORAGE*)
            echo -e "${YELLOW}The phone is out of space. Free some and re-run.${NC}"
            ;;
        *device\ offline*|*device\ not\ found*|*closed*)
            echo -e "${YELLOW}Lost the device mid-install. If this was the Wi-Fi connection, replug${NC}"
            echo -e "${YELLOW}the cable and re-run — the script will re-establish it.${NC}"
            ;;
        *)
            echo -e "${YELLOW}Not a failure this script has a canned answer for — the adb line above${NC}"
            echo -e "${YELLOW}is the thing to search for.${NC}"
            ;;
    esac
    exit 1
fi

if [[ $LAUNCH -eq 1 ]]; then
    echo -e "${CYAN}Launching app...${NC}"
    if "$ADB_PATH" -s "$ADB_TARGET" shell am start -n ${APP_ID}/.MainActivity; then
        echo -e "${GREEN}✓ App launched${NC}"
    else
        echo -e "${YELLOW}Could not launch automatically — open the app manually.${NC}"
    fi
fi

echo -e "${GREEN}✅ Mobile deploy complete!${NC}"
echo -e "${CYAN}APK: $LATEST_APK${NC}"
echo -e "${CYAN}Logs: adb -s $ADB_TARGET logcat -s Capacitor:V Capacitor/Console:V${NC}"
