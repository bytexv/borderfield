#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME to an SDK with platforms;android-35 and build-tools;35.0.0}"
: "${KEYSTORE:?Set KEYSTORE to the private release keystore}"
: "${KEYSTORE_PASSWORD:?Set KEYSTORE_PASSWORD to the keystore password}"
export KEYSTORE_PASSWORD
version=${VERSION_NAME:-1.0.0}
repo=${UPDATE_REPO:-bytexv/borderfield}
[[ "$repo" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]] || { echo "Invalid repository" >&2; exit 1; }
[[ "$version" =~ ^([1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$ ]] || { echo "Expected MAJOR.MINOR.PATCH" >&2; exit 1; }
code=$((BASH_REMATCH[1]*1000000 + BASH_REMATCH[2]*1000 + BASH_REMATCH[3]))
bt="$ANDROID_HOME/build-tools/35.0.0"
platform="$ANDROID_HOME/platforms/android-35/android.jar"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
mkdir -p "$out/classes" "$out/dex" build
printf 'package io.github.bytexv.borderfield; final class Release { static final String REPOSITORY = "%s"; }\n' "$repo" > "$out/Release.java"
"$bt/aapt2" compile --dir app/res -o "$out/resources.zip"
"$bt/aapt2" link -I "$platform" --manifest app/AndroidManifest.xml --version-code "$code" --version-name "$version" -A app/assets -o "$out/base.apk" "$out/resources.zip"
javac -encoding UTF-8 -source 8 -target 8 -Xlint:-options -bootclasspath "$platform" -classpath "$bt/core-lambda-stubs.jar" -d "$out/classes" app/java/io/github/bytexv/borderfield/*.java "$out/Release.java"
jar cf "$out/classes.jar" -C "$out/classes" .
"$bt/d8" --release --min-api 26 --lib "$platform" --output "$out/dex" "$out/classes.jar"
(cd "$out/dex" && zip -q "$out/base.apk" classes.dex)
"$bt/zipalign" -f 4 "$out/base.apk" "$out/aligned.apk"
"$bt/apksigner" sign --ks "$KEYSTORE" --ks-key-alias borderfield --ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEYSTORE_PASSWORD --v4-signing-enabled false --out "$out/Borderfield.apk" "$out/aligned.apk"
"$bt/apksigner" verify --verbose "$out/Borderfield.apk"
cp "$out/Borderfield.apk" build/Borderfield.apk
echo "Built build/Borderfield.apk (v$version, updates from $repo)"
