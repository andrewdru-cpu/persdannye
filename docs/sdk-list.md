# Сторонние скрипты и запросы

Список для сверки с политикой. Отдельного тега аналитики, рекламного пикселя и SDK в браузере нет.

| Что | Где | Когда уходит запрос |
| --- | --- | --- |
| API РФ | `https://api.scanweb.pro/public/lead`, `https://api.scanweb.pro/public/check` | Только если сбор включён. Браузер шлёт форму напрямую. Этот origin тело заявки не читает. |
| Прокси статуса | `GET /api/scan/:id`, `GET /api/scan/:id/pdf` | Форма проверки их не вызывает. Маршрут принимает id, не поля заявки. |
| Парсер | `PARSER_API_BASE` на сервере (`lib/lead-bff.ts`) | Только `GET` статуса и PDF с сервера, заголовок `Authorization: Bearer` и `X-PD-Client-IP`. Персональные данные на диск сайта не пишутся и в лог не попадают. |
| `AnalyticsGate` | `components/layout/AnalyticsGate.tsx` | Скрипт не монтирует. До согласия `analytics === true` ничего не грузит. После согласия в development пишет `console.info`, тега Метрики или GA нет. |
| Vercel Analytics | пакет `@vercel/analytics` не установлен | Компонент не подключён, запроса нет. |
| Vercel Speed Insights | пакет `@vercel/speed-insights` не установлен | Компонент не подключён, запроса нет. |
| Google Fonts | раньше `next/font/google` | Сейчас шрифты в `app/fonts/`. Запроса к fonts.googleapis.com и fonts.gstatic.com нет. См. `docs/font-licenses.md`. |
| DB-IP | ссылки в футере | Только если `NEXT_PUBLIC_SHOW_DBIP_ATTRIBUTION=true`. По умолчанию выключено, в том числе на превью. Геолокацию в браузере не запрашиваем, страну и сеть IP на сайте не показываем. |
| framer-motion, React, Next.js | зависимости бандла | Отдельного запроса к CDN этих вендоров нет: код в сборке сайта. |

Необязательные cookie (аналитические и маркетинговые) в баннере по умолчанию выключены. «Отклонить» оставляет только необходимые.
