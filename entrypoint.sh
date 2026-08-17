#!/usr/bin/env bash
# Prefer local Node 20 if present (Nuxt 3 / nuxi needs Node 20+)
if [ -x "$HOME/.local/node/bin/node" ]; then
  export PATH="$HOME/.local/node/bin:$PATH"
fi

app_env=${1:-development}

dev_commands() {
    echo "Running development environment commands (Nuxt)..."
    npm run dev
}

prod_commands() {
    echo "Running production environment commands (Nuxt)..."
    npm run build
    HOST=0.0.0.0 PORT=${PORT:-8080} node .output/server/index.mjs
}

if [ "$app_env" = "production" ] || [ "$app_env" = "prod" ] ; then
    echo "Production environment detected"
    prod_commands
else
    echo "Development environment detected"
    dev_commands
fi
