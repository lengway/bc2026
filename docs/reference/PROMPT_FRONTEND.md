# PROMPT — Frontend (ноутбук #2, ChatGPT)

> Вставь в чат этот промпт **вместе с файлом CONTEXT.md**. CONTEXT.md — источник правды; если что-то здесь ему противоречит, прав CONTEXT.md.

---

Ты — senior frontend engineer (Next.js App Router, TypeScript, React Server Components, Tailwind, shadcn/ui) в команде из трёх человек на 24-часовом хакатоне. Мы строим [PRODUCT] — B2C веб-платформу, где пользователь решает уникальный сгенерированный рабочий кейс с живыми ИИ-персонажами в нашем workspace и получает разбор ходов как в шахматах + сертификат-ссылку. Полный контекст — в приложенном CONTEXT.md, прочитай его целиком.

**Твоя зона:** `/src/app` (кроме `/src/app/api`), `/src/workspaces`, `/src/mocks` (MSW handlers; фикстуры делает backend в T0), `/tests/e2e`, клиентские хуки данных.
**Не трогай:** `/src/modules`, `/src/app/api`, `/db`, `/src/worker`, `/deploy` (backend); `/src/ui`, `/src/screens`, токены темы (design).

**Как мы делим с дизайном:** дизайн делает **презентационные** экраны и компоненты в `/src/screens` и `/src/ui` — только props (типы из `/src/contracts`), без fetch и без хуков данных. Ты делаешь **контейнеры** в `/src/app/**/page.tsx` и хуки: грузишь данные, держишь состояние, передаёшь в экраны. Пока экранов дизайна нет — делай временный простой UI на shadcn в своих контейнерах с тем же props-интерфейсом, потом заменишь импорт. Не стилизуй «по-своему» сверх необходимого — финальный вид даёт дизайн.

Судьи **читают репозиторий** и смотрят на UX. Продукт должен работать end-to-end в проде.

## Правила работы

1. Итерации по задачам ниже: план → код (полные файлы с путями) → тесты → как проверить.
2. TypeScript strict, без `any`. Все ответы API парсятся zod-схемами из `/src/contracts` (никаких `as Type`).
3. Данные: RSC для начальной загрузки там, где можно; клиент — TanStack Query для мутаций/поллинга; same-origin SSE собственного API для событий кейса, резервный поллинг каждые 2 с. Backend и PostgreSQL на VPS; Supabase/Vercel и прямого доступа браузера к БД нет.
4. Каждый экран имеет состояния: loading (скелетоны), empty, error (с ретраем), а для кейса — ещё `generating`, `in_progress`, `time_up`, `ended_by_persona`, `evaluating`, `evaluated`.
5. Ошибки API `{error:{code,message}}` обрабатываются централизованно; `PAYWALL` → открывает модалку подписки.
6. Доступность: фокус-менеджмент, клавиатура (Enter — отправить, Shift+Enter — перенос), aria-live для новых сообщений, контраст AA.
7. Весь UI-текст — на английском (рынок США).
8. Используй согласованный скоринг из CONTEXT §10–12. Раздельно показывай результат кейса, наблюдаемое использование помощи и проверку/применение советов. Не подписывай вставку, сходство текста или быстрый набор как «AI probability», «cheating» или доказанное авторство. Сырые черновики/телеметрию не публикуй.
9. По запросу команды добавляются агрегаты мыши/ввода и браузерные признаки автоматизации только внутри workspace. Нет символов, используемых исключительно ИИ. Автоматизация браузера, ИИ-помощь человеку и навык — разные вещи; никаких автоматических обвинений или штрафов за тире, ошибки/их отсутствие, характер движений или отсутствие мыши.

## Задачи по порядку

### F0. Контракты (час 0–1, вместе)

Участвуй в согласовании `/src/contracts` и API (CONTEXT §10–11). Проверь, что тебе хватает полей для каждого экрана — если нет, скажи сейчас. Включи scoringGuide, assistance, aiUseSkill/summary, trapResult, scoreAudit/scoringSummary, points/evidence/assessmentStatus, verificationScope, EditorBatch/ack, PublicEventMeta, EventsPage и SessionView. Формулы не дублируй на клиенте: показывай сохранённые серверные составляющие и объяснение расчёта. У accuracy/процентных метрик возможен null: это «Not enough evidence», а не 0.

### F1. Скелет (1–4)

- Next.js, Tailwind, shadcn init (тему не настраивай — её даёт дизайн), ESLint/Prettier, Vitest + Testing Library, Playwright, MSW.
- Auth через backend: `/login` → POST `/api/auth/magic-link`; переход по письму обрабатывает GET `/api/auth/verify`, сервер устанавливает HttpOnly cookie. Состояние — GET `/api/auth/session`, logout — POST `/api/auth/logout`. RSC передаёт cookie серверному API; защищённый layout/middleware проверяет сессию, сам API повторяет проверку прав. Не храни токен в localStorage и не подключай auth SDK Supabase. Мутации соблюдают серверный CSRF-протокол.
  - CSRF: браузер отправляет same-origin POST с Origin; backend сравнивает с origin APP_URL. Серверные fetch мутаций передают тот же Origin и cookie явно; MSW воспроизводит 403 FORBIDDEN при несовпадении. Клиент не хранит дополнительный «секретный» заголовок вместо сессии.
- Слой API: `apiClient` (fetch + zod-парсинг + типизированные ошибки, same-origin cookie) и хуки: `useCase`, `useCaseEvents` (SSE + оптимистичные сообщения), `useSendMove`, `useCopilot`, `useSubmitCase`, `useReview`, `useSkillPath`, `useCheckout`.
- `useCaseEvents`: начальная загрузка `/api/cases/:id/events?afterSeq=0`, затем `/stream?afterSeq=<lastSeq>` (SSE case_event, id=seq, data=Event); сервер делает replay без зазора и при reconnect отдаёт приоритет Last-Event-ID. Закрывать поток при unmount/смене кейса. Догрузка через afterSeq, дедупликация по id/seq и clientMsgId. Native EventSource скрывает HTTP-статус: на onerror проверяй GET /events; при 401/404 прекрати поток, при временном сбое — backoff/поллинг. Сервер отдаёт только PublicEventMeta.
  - GET кейса парсится как CaseResponse: generating/failed содержат только id/status; остальные состояния — CaseView с startedAt. Не обращайся к brief/scoringGuide до ready. submitted из БД приходит публично как evaluating.
- MSW: handlers на все эндпоинты из CONTEXT §11 на фикстурах из `/src/mocks/fixtures`; переключатель `NEXT_PUBLIC_API_MOCKS=1`. В моке `move` возвращай ответ персонажа из заранее заготовленного сценария с задержкой `typingMs` — чтобы чат выглядел живым до готовности бэка.
- Моки покрывают cookie-session flow на уровне API, события/поллинг, подтверждение EditorBatch и варианты scoring/partial telemetry. Для E2E можно использовать резервный поллинг вместо эмуляции SSE; это не заменяет отдельную проверку SSE на реальном API/VPS.
- Роуты: `(marketing)/` лендинг, `(marketing)/pricing`, `/login`, `(app)/onboarding`, `(app)/dashboard`, `(app)/case/[id]`, `(app)/review/[id]`, `(app)/path`, `c/[slug]`.

### F2. Онбординг и подготовка кейса (4–9)

- `/onboarding`: шаг 1 — выбор field (Sales активен; PM и Software — «Coming soon») и level; шаг 2 — свободный текст «Tell us about your work» (с примерами-плейсхолдерами), опционально; → `POST /api/intake` → показ «We understood: Sales · SDR · 3 yrs» с возможностью поправить → `POST /api/cases {type:'onboarding'}`.
- Экран подготовки кейса (`status:'generating'`): прогресс по шагам («Building the scenario», «Writing the client's background», «Preparing documents», «Setting up your workspace») — шаги ведёт клиент по таймеру, переход по `status:'ready'` (realtime или поллинг каждые 2 с, таймаут 60 с → error с ретраем).
- Бриф кейса: миссия, твоя роль, что значит успех, таймер, карточка персонажа (public), список документов, кнопка «Start case» → `POST /start`. Добавь раскрываемый «How scoring works» из scoringGuide: критерии, шкала, формулы, требуемое покрытие, разрешённый copilot и уведомление о наблюдении действий в редакторе. Конкретные ответы/ловушка/скрытые мотивы до сдачи не приходят на клиент.

### F3. Workspace `chat` — главный экран (9–14)

Плагин `/src/workspaces/chat` по интерфейсу `WorkspacePlugin` из CONTEXT §8. Раскладка (финальный вид — от дизайна, функционал — твой):

- **Шапка:** название кейса, таймер (серверное `CaseView.startedAt` + `brief.timeLimitSec`; при 0 — блокировка ввода, авто-сабмит), кнопка Submit (с подтверждением).
- **Слева — документы:** вкладки по `docs` (email thread, CRM record, Slack thread, table, note — рендер по `kind`); новый документ от twist появляется с бейджем «New» и тостом. Открытие документа → событие `doc_open` (fire-and-forget).
- **Центр — чат с персонажем:** сообщения, индикатор «{name} is typing…» на `typingMs`, системные события twist (как входящее письмо/сообщение), опциональная полоска доверия (если `trust` пришёл в ответе), поле ввода. Оптимистичная отправка с `clientMsgId` (uuid), откат при ошибке. При `outcome` — блокировка и баннер исхода («Dana left the conversation» / «Deal won»).
- **Справа — Copilot:** отдельный чат с встроенным ИИ, пометка «Copilot is allowed. We review how you check and use its advice», кнопки «Copy» и «Insert into reply». Известный перенос связывается с sourceEventId ответа copilot; сам факт Copy без вставки не считается переносом. Использование помощи само по себе не штрафуется.
- Адаптив: на ширине < 1024 документы и copilot уходят в боковые sheet'ы.

**Наблюдение процесса в редакторе (в твоей зоне):**

- Только поле ответа персонажу: новый draftId на сообщение, последовательные операции insert/delete/paste/copilot_insert/undo/redo/composition/other с диапазоном и фактически вставленным текстом по EditorEvent из CONTEXT §10. Учитывай составной ввод (IME), автозамену, drag/drop и отмену; не выдавай непонятное событие за нажатие клавиши. Неизвестный inputMode остаётся unknown; пользователь может указать диктовку/assistive.
- «Insert into reply» даёт известный sourceEventId. Для paste учитывай наблюдаемое копирование внутри нашего workspace; собственный текст/документ не помечай как copilot. Сходство с подсказкой без наблюдаемого переноса рассчитывает backend отдельно. Внешняя вставка имеет неизвестный источник.
- Отправляй небольшие EditorBatch в POST `/api/cases/:id/editor-events` с batchId, retry и без дублей; flush перед `/move`, в move передавай draftId. Сбой телеметрии не блокирует отправку/сдачу: покажи ненавязчивое «Some editing activity could not be recorded», backend отметит ограничение. Не изменяй опубликованную оценку поздними пакетами.
  - draftId создаётся уже при открытии редактора; первый пакет, в том числе только с interactionWindows, привязывает его к кейсу на сервере. После принятого move закрывай текущее окно активности и создавай новый draftId; при retry move сохраняй прежний draftId/clientMsgId.
- Не читай системный clipboard в фоне, другие приложения или глобальную клавиатуру. Никаких блокировок paste, штрафов за темп/переключение вкладки или «красивый» текст. Сертификат не показывает сырые черновики и события редактора.

**Мышь, ввод и доступные сайту признаки автоматизации:**

- По контракту InteractionWindow считай pointermove (не чаще 10 Гц), pointerdown/click/wheel и pointerType внутри активного workspace: количество/интервалы, длину нормализованного пути и изменения направления. Раз в 10 с сворачивай в агрегат; сырые точки после свёртки удаляются. Touch, keyboard-only и assistive — нормальные режимы, не подозрение.
- Дополняй EditorEvent полями inputType, isComposing, isTrusted; интервалы ввода/правки, focus/blur и видимость своей страницы сворачивай в окна. navigator.webdriver передавай как browser-reported boolean/null, не как «isBot». Не опрашивай системные приложения, не делай fingerprint и не определяй происхождение мысли по моторике.
- Отправляй interactionWindows в EditorBatch (можно при events=[]), дедуплицируй id, flush при отправке/сдаче/завершении; throttling/потеря пакета → capabilityGaps/limitations. При unmount, завершении кейса или скрытой странице останавливай высокочастотный сбор, корректно фиксируй видимость. Уведомление до старта должно перечислять редактор и агрегаты взаимодействия.
- Характеристики текста и наблюдения автоматизации рассчитывает backend. В owner review добавь раскрываемый «Activity observations»: наблюдение → ограничение, метод/версия, no_signals_observed/signals_observed/insufficient_data без процента «человечности». Не называй редакторские удаления «орфографическими ошибками», не выводи происхождение текста из тире/кавычек/списков. Публичный сертификат не получает processObservations, сырые траектории или черновики.

### F4. Разбор, сертификат, путь (14–18)

- `/review/[id]`: пока `evaluating` — экран «Analyzing your moves…»; затем: Accuracy (крупно), исход, счётчики меток с глифами (`!!`, `!`, `?!`, `?`, `??`), **кривая доверия** (график по `trustCurve`, клик по точке → ход), список ходов (таймлайн), панель выбранного хода: текст юзера, метка/points, критерий, точные evidence со ссылкой на сообщение/документ, why, «Better move», «What {name} was thinking». assessmentStatus=insufficient_evidence — не показывать метку как подтверждённую оценку. Кнопки: «Share certificate», «Next case».
- На разборе три отдельные области: **Case performance**, **Observed assistance**, **Checking and applying AI advice**. assistance: copilotRequests, copilotRetainedPercent («Text retained from observed Copilot insertions»), copilotTextSimilarityPercent («Similarity to earlier Copilot replies»), unknownPasteCount/Chars, observationStatus/limitations. Legacy aiDependency не называй «вероятностью ИИ» или «зависимостью». aiUseSkill: score, assessed/applicable checks и раскрываемые проверки с evidence; not_observed/not_applicable не отображаются как провал. trapResult: caught / missed / not_presented / insufficient_evidence с понятными английскими подписями, вместо простого yes/no.
- «Why this score?» раскрывает scoreAudit: таблицу labelPoints, pointsSum/maxPoints, формулу, число оценённых/всех ходов, criterionCoverage, completionStatus, caseLevel, rubricVersion и scorerModel/scorerPromptVersion. Неполный кейс/недостаток данных видны рядом с числом; 100 за единственный ход не выглядит полным подтверждением навыка. Кривая trust — реакция симуляции, не независимое доказательство балла.
  - Для ссылок evidence в owner review догружай /events и доступные docs кейса. В full-сертификате находи сообщение по id публичного transcript; если документ не включён — показывай проверенную цитату без ссылки на приватный API. editor_aggregate отображай как безопасный агрегат, не как доступ к сырым событиям.
- `/c/[slug]` (публичный, без логина, SSR, OG-meta для превью в LinkedIn): limited — имя, навык, кейс, accuracy, исход, характеристика, бейдж **Recorded simulation**, CTA «Try a case like this», безопасные assistance/aiUseSkillSummary/scoringSummary и пояснение границ наблюдения; full — + topMoves, кривая доверия, полный разбор с evidence/формулой и транскрипт по клику. verificationScope=recorded_simulation: не писать «AI-free», «Identity verified», «Certified human» или вероятность списывания. Сырые editor_events/черновики/hidden не рендерить. Кнопки владельца: копировать ссылку, Share to LinkedIn.
- `/path`: навыки с уровнями и XP-прогрессом, серия практики, Today (daily/weekly), история кейсов.
- `/dashboard`: Today's case, weekly case (замок + апселл для free), серия, последние результаты.

### F5. Оплата и интеграция (18–21)

- Модалка/страница Pricing (Free vs Pro из CONTEXT §5) → `POST /api/billing/checkout` → редирект на Stripe → success/cancel страницы.
- Переключить `NEXT_PUBLIC_API_MOCKS=0`, пройти весь флоу на реальном API, починить расхождения (через согласование контрактов, а не хаками).
- Заменить временный UI на экраны из `/src/screens` дизайна.

### F6. Тесты и полировка (21–24)

- **Unit/компонентные (Vitest + Testing Library):** рендер сообщений чата по типам событий; оптимистичная отправка и откат; таймер и авто-сабмит; рендер документов по `kind`; обработка `PAYWALL`; парсинг ответов zod (битый ответ → понятная ошибка).
- **Скоринг/редактор:** provenance Copy vs Insert vs внешняя вставка; правки, IME, undo/redo, retry без дублей, flush и сбой телеметрии без блокировки сообщения. Корректные подписи observed/similarity/unknown, null вместо выдуманного процента, четыре trapResult, coverage, переход по evidence, раскрытие реального расчёта; тип ввода/вставка не вызывают клиентский штраф.
- **Поток/auth:** SSE resume/deduplication, fallback polling, cleanup, отзыв/истечение сессии; клиент не получает private meta. Авторизация через серверный API без Supabase SDK.
- **Активность:** агрегация pointer events и интервалы, touch/keyboard-only, composition, unmount/фон/сдача, повторы пакетов, null browser capabilities. Сам факт webdriver/isTrusted=false не рендерит «bot» и не снижает score. TextFeatures остаются owner-only диагностикой и отсутствуют в сертификате/OG.
- **E2E (Playwright, на MSW или `DEMO_MODE`):**
  1. Онбординг → подготовка → бриф → 3 хода → twist появился → сдача → разбор → сертификат limited.
  2. Free-юзер открывает weekly → пейвол.
  3. Персонаж уходит (`outcome:'left'`) → ввод заблокирован → разбор.
  4. Публичная страница `/c/[slug]` открывается без логина и **не содержит** полей `realMotive`/`hidden` в HTML.
  5. Пользователь вставляет собственный черновик → источник неизвестен, без обвинения; вставляет совет copilot и исправляет ошибку по документу → это видно в assistance/aiUseSkill/evidence. На сертификате отсутствуют сырые editor_events, доступен расчёт/ограничения.
  6. При наличии сообщений, но без copilot: similarity=0, trapResult=not_presented; это не надпись «0% AI». Отдельный сценарий с утратой событий редактора: observationStatus=partial/unavailable, непроверяемый retainedPercent=null/Not enough evidence, исход ловушки независимо определяется по диалогу.
- **A11y:** `@axe-core/playwright` на лендинге, workspace, разборе, сертификате — без serious/critical.
- Lighthouse лендинга ≥ 90 performance/accessibility.

## Definition of Done

Типы без `any` · zod-парсинг всех ответов · все состояния экранов · тесты зелёные · работает на preview-окружении VPS на реальном API · нет консольных ошибок · scoring/evidence/limitations совпадают с backend-контрактами · уведомление о событиях редактора и отсутствие ложных обещаний авторства.

## Начни так

Ответь планом F1–F6 в 10 строках с допущениями, затем сразу выдай F1: команды установки, конфиги, `apiClient`, хуки, MSW handlers и сценарий «живого» мок-диалога для чата.
