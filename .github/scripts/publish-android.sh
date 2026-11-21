set -eu
tag="android-$DEVICE-beta-$BETA_NUMBER"
tags=$(gh api "repos/$GITHUB_REPOSITORY/releases?per_page=100" --paginate --jq '.[].tag_name')
latest=$(sed -nE "s/^android-($DEVICE-)?beta-([0-9]+)$/\2/p" <<< "$tags" | sort -nr | sed -n '1p')
(( BETA_NUMBER > ${latest:-0} )) || { echo "Choose a version higher than $latest for $DEVICE."; exit 1; }
refs=$(gh api "repos/$GITHUB_REPOSITORY/git/matching-refs/tags/$tag" --jq '.[].ref')
if grep -Fxq "refs/tags/$tag" <<< "$refs"; then echo 'That tag already exists.'; exit 1; fi
gh release create "$tag" --repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA" --title "GlycoTwin $DEVICE beta $BETA_NUMBER" --notes "Android tester build. Use synthetic data." "glycotwin-$DEVICE.apk" SHA256SUMS.txt
