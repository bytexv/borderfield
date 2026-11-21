#!/usr/bin/env bash
# Publish an already signed APK by tagging a temporary checkout of the source.
set -euo pipefail
cd "$(dirname "$0")/.."
tag=${1:?Usage: tools/publish-signed.sh vMAJOR.MINOR.PATCH [APK]}
apk=${2:-build/Borderfield.apk}
./tools/verify-release.sh "$tag" "$apk"
release_dir=$(mktemp -d)
git worktree add --quiet --detach "$release_dir" HEAD
trap 'git worktree remove "$release_dir"' EXIT
mkdir -p "$release_dir/release"
cp "$apk" "$release_dir/release/Borderfield.apk"
git -C "$release_dir" add release/Borderfield.apk
git -C "$release_dir" commit --quiet -m "Stage the signed Borderfield ${tag#v} APK"
git -C "$release_dir" push origin "HEAD:refs/tags/$tag"
