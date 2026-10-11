#!/bin/sh
# ignoreCommand для Vercel.
# exit 0 — пропустить сборку, exit 1 — собирать.
# Прод (VERCEL_ENV=production) собирается всегда.
# Для любого другого окружения сборка пропускается, только если между
# VERCEL_GIT_PREVIOUS_SHA и HEAD (если переменной нет — между HEAD^ и HEAD)
# изменились лишь:
#   docs/**/*.md
#   **/*.test.*
#   tests/**
#   **/__tests__/**
#   .github/**
# Любая ошибка (нет истории git, битый SHA, сбой diff) — собирать, exit 1.
# Проверка списков без git: sh scripts/vercel-ignore.sh --paths < paths.txt

is_skippable() {
  case "$1" in
    docs/*.md) return 0 ;;
    *.test.*) return 0 ;;
    tests | tests/*) return 0 ;;
    __tests__ | __tests__/* | */__tests__ | */__tests__/*) return 0 ;;
    .github | .github/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Читает пути со stdin. Пустой список — пропускать (exit 0 из этой функции).
decide_paths() {
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    if ! is_skippable "$path"; then
      return 1
    fi
  done
  return 0
}

if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi

if [ "${1:-}" = "--paths" ]; then
  if decide_paths; then
    exit 0
  fi
  exit 1
fi

if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  prev=$VERCEL_GIT_PREVIOUS_SHA
else
  prev=$(git rev-parse --verify HEAD^ 2>/dev/null) || exit 1
fi

git cat-file -e "${prev}^{commit}" 2>/dev/null || exit 1
files=$(git diff --name-only "$prev" HEAD 2>/dev/null) || exit 1

if printf '%s\n' "$files" | decide_paths; then
  exit 0
fi
exit 1
