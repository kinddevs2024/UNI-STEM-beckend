#!/usr/bin/env bash
# Run on the server to start the olympiad backend on port 3000 (for nginx).
# Usage: cd ~/UNI-STEM-beckend && ./scripts/start-on-port-3000.sh

set -e
cd "$(dirname "$0")/.."
echo "=== UNI-STEM-beckend: start on port 3000 ==="

# Stop old PM2 apps that might be using wrong port/name
for name in backend olympiad-backend; do
  pm2 delete "$name" 2>/dev/null || true
done

# Build and start with ecosystem (PORT=3000)
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo "Waiting 5s for server to bind..."
sleep 5

# Check port 3000
if sudo ss -tlnp 2>/dev/null | grep -q ":3000 "; then
  echo "OK: Port 3000 is listening"
else
  echo "WARN: Port 3000 is NOT listening. Check: pm2 logs olympiad-backend"
fi

# Health check
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://127.0.0.1:3000/api/health 2>/dev/null) || HTTP="fail"
if [ "$HTTP" = "200" ] || [ "$HTTP" = "503" ]; then
  echo "OK: /api/health returned HTTP $HTTP"
else
  echo "FAIL: /api/health returned HTTP $HTTP. Run: pm2 logs olympiad-backend"
fi

echo ""
echo "Done. Restart later with: pm2 restart olympiad-backend --update-env"
