#!/usr/bin/env bash
# Idempotent shell-profile entries for the dev container.
#
# Setup re-runs on every container rebuild, so an entry whose definition changed
# is rewritten in place rather than appended a second time. Two `alias
# run-checks=` lines in one file is not an error bash reports -- whichever is
# sourced last silently wins, which is how a stale alias survives the change that
# was supposed to replace it.
#
# Both functions write to the file named by MARS_BASH_ALIASES_FILE, which the caller sets.
# They are a library, not a script: this file is sourced, never executed.

# upsert_export writes or replaces an exported variable in the profile.
upsert_export() {
  local name=$1 value=$2
  if grep -q "^export ${name}=" "$MARS_BASH_ALIASES_FILE" 2>/dev/null; then
    sed -i "s|^export ${name}=.*$|export ${name}=\"${value}\"|" "$MARS_BASH_ALIASES_FILE"
  else
    echo "export ${name}=\"${value}\"" >> "$MARS_BASH_ALIASES_FILE"
  fi
}

# upsert_alias writes or replaces an alias in the profile.
upsert_alias() {
  local name=$1 value=$2
  if grep -q "^alias ${name}=" "$MARS_BASH_ALIASES_FILE" 2>/dev/null; then
    sed -i "s|^alias ${name}=.*$|alias ${name}='${value}'|" "$MARS_BASH_ALIASES_FILE"
  else
    echo "alias ${name}='${value}'" >> "$MARS_BASH_ALIASES_FILE"
  fi
}
