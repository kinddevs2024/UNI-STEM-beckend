#!/usr/bin/env bash
# Run this on the server to diagnose 502 Bad Gateway.
# Usage: ./scripts/check-502.sh

set -e
PORT="${PORT:-3000}"

echo "=== 502 Diagnostic: backend must listen on port $PORT ==="
echo ""

echo "1. Process listening on port $PORT:"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep ":$PORT " || echo "   (none)"
else
  netstat -tlnp 2>/dev/null | grep ":$PORT " || echo "   (none)"
fi
echo ""

echo "2. Node processes:"
ps aux | grep -E "node|server.js" | grep -v grep || echo "   (none)"
echo ""

echo "3. Local health check (curl http://127.0.0.1:$PORT/api/health):"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$PORT/api/health" 2>/dev/null) || HTTP="failed"
if [ "$HTTP" = "200" ] || [ "$HTTP" = "503" ]; then
  echo "   OK (HTTP $HTTP) - backend is responding"
else
  echo "   FAIL (HTTP $HTTP or connection failed) - backend not responding on port $PORT"
fi
echo ""

echo "4. If using PM2:"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || echo "   pm2 not running"
else
  echo "   PM2 not installed"
fi
echo ""

echo "See docs/502-TROUBLESHOOTING.md for full steps."
