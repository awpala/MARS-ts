#!/usr/bin/env bash
# Verify that the decision-record index in docs/README.md and the ADRs on disk
# describe the same set.
#
# An ADR that exists but is not indexed is half-filed: the index is the only
# surface anyone browses, so an unlisted record is one nobody finds and the
# decision silently reverts to tribal knowledge. An index row pointing at a file
# that no longer exists is the same failure from the other side -- a reader
# follows the link, gets nothing, and concludes the decision was withdrawn.
#
# Neither case is visible in review: both files look fine on their own, and the
# mismatch only exists between them.
#
# Usage: check-adr-index.sh
set -uo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)
ADR_DIR="${WORKSPACE_DIR}/docs/adrs"
INDEX="${WORKSPACE_DIR}/docs/README.md"

if [ ! -d "$ADR_DIR" ]; then
  echo "ADR directory missing at ${ADR_DIR#"$WORKSPACE_DIR"/}" >&2
  exit 1
fi
if [ ! -f "$INDEX" ]; then
  echo "decision-record index not found at ${INDEX#"$WORKSPACE_DIR"/}" >&2
  exit 1
fi

declare -a unindexed=()
declare -a dangling=()
total=0

# On disk but absent from the index.
for file in "$ADR_DIR"/*.md; do
  [ -f "$file" ] || continue
  total=$((total + 1))
  name="$(basename "$file")"
  if grep -qF "adrs/${name}" "$INDEX"; then
    printf '  ok    %s\n' "$name"
  else
    printf '  FAIL  %s (not linked from docs/README.md)\n' "$name"
    unindexed+=("$name")
  fi
done

# Linked from the index but missing on disk.
while IFS= read -r name; do
  [ -n "$name" ] || continue
  if [ ! -f "${ADR_DIR}/${name}" ]; then
    printf '  FAIL  %s (indexed but no such file)\n' "$name"
    dangling+=("$name")
  fi
done < <(grep -o 'adrs/[A-Za-z0-9._-]*\.md' "$INDEX" | sed 's|^adrs/||' | sort -u)

echo
if [ "$total" -eq 0 ]; then
  echo "No ADRs found in ${ADR_DIR#"$WORKSPACE_DIR"/}."
  exit 1
fi
if [ ${#unindexed[@]} -eq 0 ] && [ ${#dangling[@]} -eq 0 ]; then
  echo "All ${total} ADR(s) are indexed in docs/README.md."
  exit 0
fi
if [ ${#unindexed[@]} -gt 0 ]; then
  echo "ADRs missing from the index (${#unindexed[@]}):" >&2
  printf '  - %s\n' "${unindexed[@]}" >&2
  echo "  Add a row to the 'Decision records' table in docs/README.md." >&2
fi
if [ ${#dangling[@]} -gt 0 ]; then
  echo "Index rows with no ADR file (${#dangling[@]}):" >&2
  printf '  - %s\n' "${dangling[@]}" >&2
fi
exit 1
