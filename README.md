# PromoCode Manager

Мини-приложение для управления промокодами с CQRS-подходом: записи идут в MongoDB, аналитика — в ClickHouse, Redis используется для кэша, блокировок и rate limiting.

## Запуск

### Полный стек через Docker Compose

```bash
docker compose up --build
```

После запуска:
- Frontend: http://localhost:5173
- Backend / Swagger: http://localhost:3001/docs

При первом запуске автоматически создаются демо-данные.

Демо-аккаунт:
- Email: `demo@promocode.local`
- Password: `password123`

### Локальная разработка

```bash
docker compose up -d mongo redis clickhouse
npm install
npm run dev:backend
npm run dev:frontend
```

## Архитектура

- **MongoDB** — источник истины для всех мутаций.
- **ClickHouse** — денормализованные таблицы для аналитики и таблиц на фронтенде.
- **Redis** — кэш аналитических запросов, distributed lock при применении промокода, rate limiting логина.

### Таблицы ClickHouse

- `users` — пользователи и агрегаты по заказам/скидкам.
- `promocodes` — промокоды, лимиты, сроки действия, метрики использования.
- `orders` — заказы с денормализованными данными пользователя и промокода.
- `promo_usages` — история применений промокодов с данными пользователя и заказа.

### Синхронизация MongoDB → ClickHouse

После каждой мутации backend пишет в MongoDB, затем добавляет/обновляет денормализованный снимок в ClickHouse. Это касается создания, обновления и деактивации сущностей, а также применения промокода к заказу.

### Server-side таблицы

Фронтенд отправляет в backend параметры `page`, `pageSize`, `sortBy`, `sortDirection`, `search` и диапазон дат. Backend применяет пагинацию, сортировку и фильтры в запросах ClickHouse и возвращает уже готовые данные.

## Переменные окружения

Backend:
- `MONGO_URL`
- `REDIS_URL`
- `CLICKHOUSE_URL`
- `CLICKHOUSE_DATABASE`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`

Frontend:
- `VITE_API_URL`
