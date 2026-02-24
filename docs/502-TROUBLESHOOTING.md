# 502 Bad Gateway — что проверить на сервере

Ошибка **502 Bad Gateway** от nginx значит: **бэкенд (Node) не отвечает** на том порту, на который nginx отправляет запросы. Ниже — что проверить на сервере.

## Быстрый запуск для global-olimpiads.biz

На сервере выполни **из каталога бэкенда**:

```bash
cd ~/UNI-STEM-beckend
git pull
chmod +x scripts/start-on-port-3000.sh
./scripts/start-on-port-3000.sh
```

Скрипт соберёт проект, запустит бэкенд через PM2 с именем **olympiad-backend** на порту **3000** и проверит ответ `/api/health`. Дальше nginx (если у него `proxy_pass http://127.0.0.1:3000`) будет отдавать API без 502.

Перезапуск в будущем: `pm2 restart olympiad-backend --update-env`

## 1. Запущен ли процесс бэкенда

На сервере выполни:

```bash
# Если используешь PM2:
pm2 list
pm2 logs global-olympiad-backend --lines 50

# Или поиск процесса Node:
ps aux | grep "server.js"
ps aux | grep "node.*3000"
```

- Если процесса нет — бэкенд не запущен. Запусти его (см. п. 4).
- Если процесс есть — проверь порт (п. 2).

## 2. Слушает ли бэкенд нужный порт

Nginx в конфиге проксирует на **3000** порт (`proxy_pass http://127.0.0.1:3000`). Убедись, что приложение слушает тот же порт:

```bash
# Кто слушает порт 3000:
sudo ss -tlnp | grep 3000
# или
sudo netstat -tlnp | grep 3000
```

- Если порт 3000 не занят — процесс не слушает или слушает другой порт (часто из‑за `PORT` в `.env`). Проверь `.env`: переменная **PORT** должна быть **3000** (или измени nginx, чтобы он проксировал на тот порт, который указан в PORT).
- Если порт занят — проверь логи nginx и бэкенда (п. 3).

## 3. Логи nginx и бэкенда

```bash
# Ошибки nginx (часто: "connection refused" или "upstream timed out"):
sudo tail -50 /var/log/nginx/error.log

# Логи приложения (PM2, имя приложения: olympiad-backend):
pm2 logs olympiad-backend --lines 100
```

- **Connection refused** — ничего не слушает на том порту (запусти бэкенд или поправь PORT/nginx).
- **Upstream timed out** — бэкенд зависает при обработке (смотри логи приложения и БД).

## 4. Как правильно запустить бэкенд

На сервере в каталоге бэкенда (UNI-STEM-beckend):

```bash
cd /path/to/UNI-STEM-beckend

# 1) Убедись, что есть .env с JWT_SECRET, PORT, MONGODB_URI и т.д.
cat .env | grep -E 'PORT|JWT_SECRET|MONGODB'

# 2) Сборка для production
npm ci
npm run build

# 3) Запуск (PORT должен совпадать с nginx, по умолчанию 3000)
export NODE_ENV=production
export PORT=3000
node server.js
```

Проверка без nginx:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s -X POST http://127.0.0.1:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'
```

Если здесь запросы проходят, а через браузер на https://global-olimpiads.biz — 502, значит проблема в nginx (хост, порт, proxy_pass).

## 5. Автозапуск через PM2 (рекомендуется)

```bash
cd ~/UNI-STEM-beckend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Имя приложения в PM2: **olympiad-backend**. В `ecosystem.config.cjs` уже задано `PORT=3000`.

## 6. Конфиг nginx для global-olimpiads.biz

На сервере домен, скорее всего, описан в отдельном конфиге. Проверь, что для **https://global-olimpiads.biz** есть что‑то вроде:

```nginx
location /api {
    proxy_pass http://127.0.0.1:3000;   # порт должен совпадать с PORT бэкенда
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

После правок:

```bash
sudo nginx -t && sudo nginx -s reload
```

## Краткий чеклист

| Проверка | Команда |
|----------|--------|
| Процесс запущен | `pm2 list` или `ps aux \| grep server.js` |
| Порт 3000 слушается | `ss -tlnp \| grep 3000` |
| Ответ с локального сервера | `curl http://127.0.0.1:3000/api/health` |
| PORT в .env | `grep PORT .env` → должно быть 3000 (или поправить nginx) |
| Ошибки nginx | `tail -50 /var/log/nginx/error.log` |

Итог: **502** почти всегда решается запуском бэкенда на нужном порту и совпадением этого порта с `proxy_pass` в nginx.
