#!/usr/bin/env bash
set -euo pipefail
tag=${1:?Pass a release tag and the signed APK}
apk=${2:?Pass the signed APK}
[[ "$tag" =~ ^v([1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$ ]] || { echo "Invalid release tag: $tag" >&2; exit 1; }
code=$((BASH_REMATCH[1]*1000000 + BASH_REMATCH[2]*1000 + BASH_REMATCH[3]))
tools="${ANDROID_HOME:?Set ANDROID_HOME}/build-tools/35.0.0"
identity=$("$tools/apksigner" verify --print-certs "$apk")
cert='802918772a93718565b6e9ee348347238d40b096b4556d3ec934a1066843abf2'
if ! grep -Fxq "Signer #1 certificate SHA-256 digest: $cert" <<< "$identity" || grep -Fq 'Signer #2 certificate' <<< "$identity"; then
  echo "The APK must use the original Borderfield signing key." >&2
  exit 1
fi
metadata=$("$tools/aapt" dump badging "$apk")
expected="package: name='io.github.bytexv.borderfield' versionCode='$code' versionName='${tag#v}'"
[[ "$metadata" == "$expected "* ]] || { echo "The package ID or version does not match $tag." >&2; exit 1; }
sha256sum "$apk"
