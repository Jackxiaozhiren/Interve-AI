#!/bin/sh
# Collect the two audit documents, then hand them to the gate.
#
# `npm audit --json` exits non-zero the moment it finds anything at or above the
# level, which is the normal state of a repo with disclosed dev-tree advisories — so
# its exit code is tolerated here and the verdict comes from the documents. That is
# safe in exactly one direction: if npm cannot produce a report (no network, no
# lockfile), the file it leaves is not parseable JSON and the gate exits non-zero
# rather than reading "no advisories". A missing report is a failure, never a pass.
set -u
prod=$(mktemp)
full=$(mktemp)
trap 'rm -f "$prod" "$full"' EXIT INT TERM
npm audit --json --omit=dev > "$prod" || true
npm audit --json > "$full" || true
node scripts/audit-deps.mjs --prod-doc "$prod" --full-doc "$full"
