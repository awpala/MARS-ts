#!/usr/bin/env bash
# Idempotent shell-profile entries for the dev container.
#
# Setup re-runs on every container rebuild, so an entry whose definition changed
# is rewritten in place rather than appended a second time. Two `alias
# run-checks=` lines in one file is not an error bash reports -- whichever is
# sourced last silently wins, which is how a stale alias survives the change that
# was supposed to replace it.
#
# Both functions write to the file named by BASH_ALIASES, which the caller sets.
# They are a library, not a script: this file is sourced, never executed.

# upsert_export writes or replaces an exported variable in the profile.
upsert_export() {
  local name=$1 value=$2
  if grep -q "^export ${name}=" "$BASH_ALIASES" 2>/dev/null; then
    sed -i "s|^export ${name}=.*$|export ${name}=\"${value}\"|" "$BASH_ALIASES"
  else
    echo "export ${name}=\"${value}\"" >> "$BASH_ALIASES"
  fi
}

# upsert_alias writes or replaces an alias in the profile.
upsert_alias() {
  local name=$1 value=$2
  if grep -q "^alias ${name}=" "$BASH_ALIASES" 2>/dev/null; then
    sed -i "s|^alias ${name}=.*$|alias ${name}='${value}'|" "$BASH_ALIASES"
  else
    echo "alias ${name}='${value}'" >> "$BASH_ALIASES"
  fi
}
