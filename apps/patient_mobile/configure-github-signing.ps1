param([string]$Repository = 'Hellkryptonium/glycotwin')
$ErrorActionPreference = 'Stop'
Get-Command gh, keytool -ErrorAction Stop | Out-Null
$signDir = Join-Path $env:USERPROFILE '.glycotwin-signing'
$key = Join-Path $signDir 'glycotwin.p12'
$secret = Import-Clixml (Join-Path $signDir 'password.xml')
$password = [System.Net.NetworkCredential]::new('', $secret).Password
$env:GT_SIGNING_PASSWORD = $password
try {
    $details = keytool -list -v -alias glycotwin -keystore $key -storepass:env GT_SIGNING_PASSWORD
    if ($LASTEXITCODE) { throw 'Unable to verify the signing key.' }
    $match = [regex]::Match(($details -join "`n"), 'SHA256:\s*([\dA-Fa-f:]+)')
    $digest = $match.Groups[1].Value.Replace(':','').ToLowerInvariant()
    if ($digest.Length -ne 64) { throw 'Unable to read the certificate fingerprint.' }
    $target = @('--repo', $Repository, '--env', 'android-beta')
    [Convert]::ToBase64String([IO.File]::ReadAllBytes($key)) | gh secret set ANDROID_KEYSTORE_BASE64 @target
    if ($LASTEXITCODE) { throw 'Could not store the keystore in GitHub.' }
    $password | gh secret set ANDROID_KEYSTORE_PASSWORD @target
    if ($LASTEXITCODE) { throw 'Could not store the signing password in GitHub.' }
    gh variable set ANDROID_KEY_ALIAS --body glycotwin @target
    if ($LASTEXITCODE) { throw 'Could not store the key alias.' }
    gh variable set ANDROID_CERT_SHA256 --body $digest @target
    if ($LASTEXITCODE) { throw 'Could not store the certificate fingerprint.' }
} finally {
    Remove-Item Env:GT_SIGNING_PASSWORD
}
