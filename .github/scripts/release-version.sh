#!/usr/bin/env bash
# Turns a release tag into the version strings release.yml needs, as key=value lines for $GITHUB_OUTPUT.
#
#   vX.Y.Z               stable
#   vX.Y.Z-(alpha|beta|rc).N   pre-release (the release is created with --prerelease)
#
# For a stable tag every value equals what the workflow used before (the tag without its "v"), so a stable
# release is built exactly as it always was. Anything else is rejected, so a stray tag such as v1.2.3-foo
# fails here, in the one cheap job that gates every build.
#
#   version     the tag without "v"; stamped into the build (-p:Version=) and used in every asset name
#   numeric     X.Y.Z only; the macOS bundle version, which Apple limits to digits and dots
#   deb         the .deb version; "~" makes a pre-release sort BEFORE its release (a "-" would sort after)
#   prerelease  true / false
set -euo pipefail

tag="${1:?usage: release-version.sh <tag>}"
re='^v([0-9]+\.[0-9]+\.[0-9]+)(-(alpha|beta|rc)\.[0-9]+)?$'

if [[ ! "$tag" =~ $re ]]; then
  echo "::error::Tag '$tag' is not vX.Y.Z or vX.Y.Z-(alpha|beta|rc).N" >&2
  exit 1
fi

version="${tag#v}"
numeric="${BASH_REMATCH[1]}"
if [[ -n "${BASH_REMATCH[2]}" ]]; then
  prerelease=true
  deb="${numeric}~${version#"${numeric}-"}"
else
  prerelease=false
  deb="$version"
fi

printf 'version=%s\nnumeric=%s\ndeb=%s\nprerelease=%s\n' "$version" "$numeric" "$deb" "$prerelease"
