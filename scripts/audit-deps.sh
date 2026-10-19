#!/bin/sh
# Collect the two audit documents, then hand them to the gate.
#
# `npm audit --json` exits non-zero the moment it finds anything at or above the
# level, which is the normal state of a repo with disclosed dev-tree advisories — so
# its exit code is tolerated here and the verdict comes from the documents. That is
# safe in exactly one direction: if npm cannot produce a report (no network, no
# lockfile), the file it leaves is not parseable JSON and the gate exits non-zero
# rather than reading "no advisories". A missing report is a failure, never a pass.
#
# Two arguments, both defaulted so the original `npm run audit:deps` keeps working
# unchanged: which tree to audit, and which register discloses its dev-only
# criticals. The sibling app is a separate dependency tree with its own answers —
# the same package can be a disclosed runner-only advisory here and a shipped one
# there, and reading one tree's register for the other's report is how an exception
# gets granted to a package that never asked for one.
set -u
prefix=${1:-.}
register=${2:-docs/audit/deps-critical.json}
prod=$(mktemp)
full=$(mktemp)
trap 'rm -f "$prod" "$full"' EXIT INT TERM
npm --prefix "$prefix" audit --json --omit=dev > "$prod" || true
npm --prefix "$prefix" audit --json > "$full" || true
node scripts/audit-deps.mjs --prod-doc "$prod" --full-doc "$full" --register "$register"
