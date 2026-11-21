# Borderfield

An offline Android geography quiz and illustrated pocket atlas for Android 8.0 and newer. The world quiz covers 193 UN members, Palestine and Vatican City. The installable release asset is named `Borderfield.apk`.

## Play

Name each country from its silhouette. A world run covers all 195 in random order without repeats. A quick round draws ten. Region, capital and first-letter hints are available. Common English aliases, punctuation and accents are accepted. Leaving a round saves its position.

The field guide includes a shape clue, capital, region and land neighbors for each country. Search by name or filter by region. Bookmark cards for later. The logbook tracks the distinct countries you have named, region totals and finished rounds. Wrong guesses and revealed answers enter the review queue. Naming a country on the first try without a hint clears it from that queue.

The app stores progress on the device. An update installed over the previous version preserves it. Uninstalling the app clears local progress.

## Install and update

Download the latest signed APK and open it on your Android device. Android may ask you to allow installs from the app that opened the download. [Download Borderfield.apk](https://github.com/bytexv/borderfield/releases/latest/download/Borderfield.apk)

Borderfield checks its configured public GitHub Releases feed on launch, at most once daily after a successful check. Settings also includes a manual check and a switch for automatic checks. A newer stable release prompts you to download. The app verifies its size, SHA-256 digest when provided by GitHub, package ID, version and signing certificate before opening the Android installer. Android asks you to confirm installation.

## Build locally

Install JDK 21, Android SDK Platform 35, Android SDK Build Tools 35.0.0 and the `zip` command. The application uses the platform WebView and the SDK build tools directly. App assets and fonts ship inside the APK.

```bash
export ANDROID_HOME=/path/to/android-sdk
export KEYSTORE=/private/path/borderfield.p12
export KEYSTORE_PASSWORD="$(cat /private/path/release.pass)"
export UPDATE_REPO=bytexv/borderfield
VERSION_NAME=1.0.0 ./tools/build.sh
```

The output is `build/Borderfield.apk`. Use the original signing key with alias `borderfield` for updates to existing installations. The repository contains no signing credentials.

## Publish releases

Installed copies check the stable releases of `bytexv/borderfield`. Each update needs a higher three-part version, the original signing key and an asset named `Borderfield.apk`.

### Sign locally

Set the build variables above and push the release commit to GitHub. From that commit, build the APK and upload it with the GitHub CLI. The command creates the matching tag and publishes the asset together with its release.

```bash
version=1.0.1
VERSION_NAME="$version" ./tools/build.sh &&
  gh release create "v$version" build/Borderfield.apk --repo "$UPDATE_REPO" \
    --target "$(git rev-parse HEAD)" --title "Borderfield $version" --generate-notes
```

### Sign with GitHub Actions

For automatic signing on tag pushes, a repository administrator can configure the two encrypted Actions secrets once using the private signing backup. With both secrets present, pushing a new version tag compiles, signs and publishes the update.

```bash
repo=bytexv/borderfield
base64 -w0 /private/path/borderfield.p12 | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$repo"
tr -d '\n' < /private/path/release.pass | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$repo"
git tag v1.0.1
git push origin v1.0.1
```

## Cartography and credits

Country outlines use Natural Earth’s 1:10m administrative polygons projected into a country-centered Lambert azimuthal equal-area view. Individual cards use independent scales. Some cards focus on a mainland or main island group and say so on the study plate. Tiny island polygons are enlarged as points. Natural Earth uses generalized boundaries and its map choices can differ from diplomatic claims. The globe illustration uses Natural Earth 1:110m land. [Natural Earth source](https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19)

Country names, capitals and neighbors are adapted from mledoze/countries, with editorial overrides. The bundled atlas database is available under ODbL 1.0. The 195 shape notes are in `tools/field-notes.tsv`. To regenerate the atlas, install Shapely and pyproj and run `python tools/build_atlas.py countries.json ne_10m_admin_0_countries.geojson` from the repository. [Country data source](https://github.com/mledoze/countries/tree/5d15c0ff8c87ef2f1f8e944093522d4b2de2dd5b)

Barlow Condensed, DM Sans and IBM Plex Mono ship under the SIL Open Font License. License texts for the data and fonts are included in `app/assets/licenses/`.
