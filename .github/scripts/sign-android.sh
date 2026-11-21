set -eu
umask 077
key="$RUNNER_TEMP/glycotwin.p12"
trap 'rm -f "$key"' EXIT
if [[ -z "${KEYSTORE_BASE64:-}" ]]; then
  echo "::error::The android-beta publish job received no ANDROID_KEYSTORE_BASE64 value."
  exit 1
fi
if ! printf '%s'  "$KEYSTORE_BASE64" | tr -d '[:space:]' | base64 --decode > "$key" || [[ ! -s "$key" ]]; then
  echo "::error::ANDROID_KEYSTORE_BASE64 was supplied, but did not decode into a nonempty file."
  exit 1
fi
if [[ -z "${KEYSTORE_PASSWORD:-}" ]]; then
  echo "::error::The android-beta publish job received no ANDROID_KEYSTORE_PASSWORD value."
  exit 1
fi
if ! keytool -list -storetype PKCS12 -keystore "$key" -storepass:env KEYSTORE_PASSWORD >/dev/null 2>&1; then
  # Compare only on failure. A re-export of the same signing key can have different file bytes.
  if printf '%s  %s\n' '72824f766864bd77ec5f0f5ebf14580172a105c00fb7494ef481e211a0a967fe' "$key" | sha256sum --check --status; then
    echo "::error::The keystore matches the original file. Check ANDROID_KEYSTORE_PASSWORD."
  else
    echo "::error::The decoded keystore differs from the original glycotwin.p12 and cannot be opened. Check ANDROID_KEYSTORE_BASE64 first."
  fi
  exit 1
fi
sdk="$ANDROID_HOME/build-tools/36.0.0"
apk="glycotwin-$DEVICE.apk"
"$sdk/apksigner" sign --ks-type PKCS12 --ks "$key" --ks-key-alias "$KEY_ALIAS" --ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEYSTORE_PASSWORD --out "$apk" "app-release-unsigned.apk"
cert=$("$sdk/apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
test -n "$cert"
test "$cert" = "$EXPECTED_CERT"
"$sdk/aapt" dump badging "$apk" > "$RUNNER_TEMP/badging"
grep -F "package: name='me.glycotwin.patient' versionCode='$BETA_NUMBER'" "$RUNNER_TEMP/badging"
sha256sum "$apk" > SHA256SUMS.txt
