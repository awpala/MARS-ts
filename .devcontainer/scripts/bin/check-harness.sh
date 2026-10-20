#!/usr/bin/env bash
# Verify the agent harness is internally consistent.
#
# The harness spans several tools' file formats that must agree with one
# another, and none of the disagreements are visible from a single file:
#
# - CLAUDE.md must stay a relative symlink to AGENTS.md (one entry point).
# - Every canonical role in .agents/agents/ needs a Claude adapter (a file
#   symlink in .claude/agents/) and a Codex adapter (.codex/agents/<role>.toml),
#   and no adapter may exist without its canonical role.
# - .claude/skills/ must be a byte-for-byte mirror of .agents/skills/.
# - Strict-JSON configuration must parse.
# - Relative Markdown links in authored docs must resolve.
# - Codex rules must load and satisfy their own match/not_match examples
#   (only where the codex CLI is installed; reported, never silently passed).
#
# Usage: check-harness.sh
set -uo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)
cd "$WORKSPACE_DIR" || exit 1

declare -a PROBLEMS=()

problem() {
  printf '  FAIL  %s\n' "$1"
  PROBLEMS+=("$1")
}

# --- Required files ----------------------------------------------------------
for path in \
  AGENTS.md \
  .claude/settings.json \
  .mcp.json \
  .codex/config.toml \
  .codex/rules/default.rules \
  .devcontainer/devcontainer.json \
  .devcontainer/devcontainer-lock.json \
  .devcontainer/scripts/setup-env.sh \
  docs/README.md \
  docs/adrs/0000-port-plan.md; do
  [ -e "$path" ] || problem "missing required file ${path}"
done

# --- Single entry point --------------------------------------------------------
if [ ! -L CLAUDE.md ] || [ "$(readlink CLAUDE.md)" != "AGENTS.md" ]; then
  problem "CLAUDE.md must be a relative symlink to AGENTS.md"
fi

# --- Role adapters -------------------------------------------------------------
# Per-file symlinks, not a directory link: host file sync has been observed to
# replace a directory symlink with an empty directory, while file symlinks
# (like CLAUDE.md) survive.
for canonical in .agents/agents/*.md; do
  [ -f "$canonical" ] || continue
  role=$(basename "$canonical" .md)
  claude_link=".claude/agents/${role}.md"
  if [ ! -L "$claude_link" ] || [ "$(readlink "$claude_link")" != "../../.agents/agents/${role}.md" ]; then
    problem "${claude_link} must be a symlink to ../../.agents/agents/${role}.md"
  fi
  [ -f ".codex/agents/${role}.toml" ] || problem "missing Codex adapter .codex/agents/${role}.toml"
done
for adapter in .claude/agents/*; do
  [ -e "$adapter" ] || [ -L "$adapter" ] || continue
  role=$(basename "$adapter" .md)
  [ -f ".agents/agents/${role}.md" ] || problem "${adapter} has no canonical .agents/agents/${role}.md"
done
for adapter in .codex/agents/*.toml; do
  [ -f "$adapter" ] || continue
  role=$(basename "$adapter" .toml)
  [ -f ".agents/agents/${role}.md" ] || problem "${adapter} has no canonical .agents/agents/${role}.md"
done

# --- Skill mirror --------------------------------------------------------------
if ! diff -r .agents/skills .claude/skills >/dev/null 2>&1; then
  problem ".claude/skills differs from .agents/skills (copy the canonical tree)"
  diff -rq .agents/skills .claude/skills | sed 's/^/          /'
fi
for skill in .agents/skills/*/; do
  [ -f "${skill}SKILL.md" ] || problem "${skill} has no SKILL.md"
done

# --- Strict JSON -----------------------------------------------------------------
# devcontainer.json is JSONC (comments, trailing commas) and is validated by
# the devcontainer CLI when the container is built, not here.
if command -v jq >/dev/null 2>&1; then
  for json in .claude/settings.json .mcp.json .devcontainer/devcontainer-lock.json; do
    jq empty "$json" >/dev/null 2>&1 || problem "${json} is not valid JSON"
  done
else
  problem "jq is not on PATH; cannot validate JSON configuration"
fi

# --- Relative Markdown links ------------------------------------------------------
# Authored Markdown only: reference repositories, logs, build output, and
# dependencies are excluded. External, mailto, and in-page links are ignored;
# a fragment on a file link is stripped before resolving the file.
while IFS= read -r file; do
  dir=$(dirname "$file")
  while IFS= read -r target; do
    case "$target" in
      http://* | https://* | mailto:* | '#'*) continue ;;
    esac
    path=${target%%#*}
    [ -n "$path" ] || continue
    [ -e "${dir}/${path}" ] || problem "${file#./}: broken link ${target}"
  done < <(grep -oE '\]\([^)[:space:]]+\)' "$file" | sed -E 's/^\]\((.*)\)$/\1/')
done < <(
  find . -name '*.md' \
    -not -path './node_modules/*' \
    -not -path './.git/*' \
    -not -path './__refs/*' \
    -not -path './__logs/*' \
    -not -path './__build/*' \
    -not -path './.svelte-kit/*' \
    -not -path './build/*' \
    | LC_ALL=C sort
)

# --- Codex rules ---------------------------------------------------------------------
if command -v codex >/dev/null 2>&1; then
  if ! codex execpolicy check --rules .codex/rules/default.rules git status >/dev/null 2>&1; then
    problem ".codex/rules/default.rules failed to load or its match/not_match examples failed"
  fi
else
  echo "  note  codex CLI not installed; Codex rules not validated here"
fi

echo
if [ ${#PROBLEMS[@]} -eq 0 ]; then
  echo "Harness is consistent."
  exit 0
fi
echo "Harness problems (${#PROBLEMS[@]})." >&2
exit 1
