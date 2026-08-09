#!/bin/bash
#
# 100,000,000 Developers — build a snapshot APK into .apk/ (git-ignored).
#
# A debug build with a timestamp for a version, for putting the current tree on
# a handset. Not a release build: it is signed with the debug key and it is not
# what goes to Play.
#

set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  100M Developers — Snapshot APK Builder"
echo "============================================"
echo ""

SNAPSHOT_VERSION=$(date +"%Y%m%d-%H%M%S")
APK_NAME="m100devs-snapshot-${SNAPSHOT_VERSION}.apk"

# VITE_BENCH=1 ./build-snapshot.sh puts the GDD §23.3 acceptance button in the
# build. A shipping build never carries it — see App.tsx.
if [[ "$VITE_BENCH" == "1" ]]; then
    echo "  (VITE_BENCH=1 — the §7.5 bench trigger will be in this build)"
    echo ""
fi

echo "[1/4] Building web app..."
npm run build
echo ""

echo "[2/4] Syncing to Android..."
npx cap sync android
echo ""

echo "[3/4] Building Android APK..."
(cd android && chmod +x gradlew && ./gradlew assembleDebug)
echo ""

echo "[4/4] Copying APK..."
mkdir -p .apk
cp "android/app/build/outputs/apk/debug/app-debug.apk" ".apk/${APK_NAME}"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    SIZE=$(stat -f%z ".apk/${APK_NAME}")
else
    SIZE=$(stat -c%s ".apk/${APK_NAME}")
fi

echo "============================================"
echo "  BUILD SUCCESSFUL!"
echo "============================================"
echo ""
echo "  APK: ${APK_NAME}"
echo "  Location: $(pwd)/.apk/${APK_NAME}"
echo "  Size: ${SIZE} bytes"
echo ""
echo "  Install it with ./deploy.sh --skip, or by hand:"
echo "    adb install -r .apk/${APK_NAME}"
echo "============================================"
