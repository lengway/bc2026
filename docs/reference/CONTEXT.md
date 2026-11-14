# CONTEXT.md — общий контекст проекта

> Этот файл читают все трое (backend, frontend, design) перед любой работой. Он — источник правды. Если код расходится с этим файлом, прав файл; если файл надо поменять — договариваемся втроём.
> Рабочее название продукта: **[PRODUCT]** (заменить, когда выберем).

---

## 1. Хакатон и критерии

**Задача:** веб-продукт, который закрывает фундаментальную боль взрослых в США и за который они заплатят.
**Ограничения (pass/fail):** только B2C · только веб (никаких мобильных приложений) · 24 часа · все 3 пункта сабмишена.
**Трек:** 03 — Skills.

| Вес | Критерий                | Что это значит для нас                                                                                                        |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 40% | Does it work?           | Работает end-to-end в проде. Ключевая ценность настоящая, не захардкожена. Качество UX и кода — **судьи читают репозиторий**. |
| 20% | What do we sell?        | Понятно, за что платят и почему вернутся завтра.                                                                              |
| 15% | Who do we sell to?      | Чёткий пользователь и боль.                                                                                                   |
| 15% | Why does it make money? | Большая/растущая ниша, LTV > CAC.                                                                                             |
| 10% | Is it new?              | Не копия существующего бизнеса.                                                                                               |

## 2. Продукт одной фразой

**Duolingo для рабочих навыков с доказательством, а не бумажкой.** Пользователь решает уникальный, сгенерированный под него реалистичный рабочий кейс в нашем рабочем пространстве (со встроенным ИИ-ассистентом), получает разбор каждого своего хода как в шахматах (chess.com game review) и публичную ссылку-сертификат, по которой работодатель за 30 секунд видит, **как** человек работает.

## 3. Пользователь и боль

**Пользователь:** работающий взрослый в США, 25–45, офисная профессия (в демо — **продажи**: SDR/AE/account manager), боится отстать из-за ИИ и не может доказать, что реально умеет.

**Боль (из исследования, ноябрь 2026):**

- 43% работников считают, что их ИИ-навыки отстают от нужного уровня (Resume Now, авг 2026).
- 30% готовы платить из своего кармана за ИИ-навыки из страха отстать (сент 2026).
- 93% откликались на вакансию и не получили ответа; 86% встречали «призрачные» вакансии.
- Сертификаты курсов «фармятся» и ничего не доказывают: ИИ проходит онлайн-курсы за минуты.
- Ближайший конкурент — Forage: бесплатные симуляции от работодателей, но кейс одинаковый для всех (сверка с образцом), работодатель **не видит** работу студента, 4–6 часов, аудитория — студенты. Мы: уникальный кейс, видимый процесс, 10 минут в день, работающие взрослые, B2C.

## 4. Ключевые фичи (что делает продукт ценным)

1. **Уникальный кейс** под профиль пользователя: сфера, подсфера, уровень, боли. Каждый раз новый.
2. **Рабочее пространство (workspace)**, где всё происходит: чат с живым персонажем (клиент/стейкхолдер), документы кейса, встроенный ИИ-ассистент (copilot). Никаких вариантов ответа — только свободный ввод.
3. **Живые персонажи**: у каждого характер, стиль речи, скрытый мотив, ограничения, триггеры. Персонаж реагирует на ходы, доверие растёт/падает, он может уйти.
4. **Разбор ходов как в шахматах**: каждый ход получает метку (`!!` brilliant, `!` best, good, `?!` inaccuracy, `?` mistake, `??` blunder), объяснение, «лучший ход был бы…», «что в этот момент думал клиент». Итоговая **Accuracy %** и **кривая доверия** (как график оценки в шахматах).
5. **Ловушка**: встроенный ассистент один раз подкидывает тонкую ошибку. Подтвердил ошибку документом и исправил — свидетельство критической проверки совета. Это не гарантия отсутствия внешней помощи. Различаем: caught / missed / not_presented / insufficient_evidence.
6. **Использование ИИ и проверка его советов** оцениваются раздельно: наблюдаемое использование copilot, вставки с неизвестным источником и качество проверки/применения советов. Вставка, быстрый набор или «ИИшный» стиль сами по себе не снижают оценку навыка. История действий и границы наблюдения видны в разборе; правила и формулы — в §12.
7. **Сертификат-ссылка**: limited (бесплатно) — краткая характеристика; full (подписка) — полный разбор процесса. Работодатель видит выжимку за 30 секунд, полный разбор по клику.
8. **Путь по навыкам**: уровни навыков, XP, серия практики, daily (5–10 мин) и weekly (30–40 мин) кейсы.
9. **Прозрачный скоринг:** у каждого оценённого хода есть критерий, ссылка на конкретное сообщение/документ, баллы и объяснение. Итог раскрывается до формулы; отдельно видны сложность кейса, покрытие критериев, версия рубрики и наблюдаемое использование помощи. Сертификат подтверждает запись прохождения, а не гарантированное авторство без ИИ.
10. **Наблюдения взаимодействия с сайтом:** агрегаты движений/кликов мыши, ввода, правок и доступные браузеру признаки автоматизации. Это вспомогательный профиль процесса с ограничениями, отдельно от оценки навыка и происхождения текста. «Знаков, которыми пользуется только ИИ», нет.

## 5. Монетизация (предложение, можно менять)

|                       | Free       | Pro — $19/мес или $149/год |
| --------------------- | ---------- | -------------------------- |
| Онбординг-кейс        | ✅         | ✅                         |
| Daily кейсы           | 1 в неделю | безлимит                   |
| Weekly «большой» кейс | —          | ✅                         |
| Сертификат            | limited    | full (полный разбор)       |
| Путь по навыкам       | базовый    | полный + рекомендации      |

Почему вернутся: daily-кейс + серия + рост уровня навыка. Вирусный цикл: каждая ссылка-сертификат несёт CTA «Пройди такой кейс сам».

## 6. User stories

1. **Новичок (aha до пейвола).** SDR, 29 лет. Лендинг → регистрация (magic link) → пишет о себе свободным текстом + выбирает сферу и уровень → экран «готовим кейс» → бриф → 10 минут чата с клиентом → сдача → разбор (Accuracy 74%, 1 `!!`, 1 `??`) → limited-сертификат со ссылкой → предложение Pro.
2. **Подписчик, daily.** Открывает дашборд → серия 6 дней → daily-кейс по подсфере → разбор → +XP, уровень навыка растёт.
3. **Weekly.** Кейс на 30–40 мин с 2 поворотами сюжета → full-сертификат → шерит в LinkedIn.
4. **Работодатель.** Открывает ссылку → Accuracy, 3 ключевых хода, навыки, кривая доверия → «View full review» → внизу CTA «Try a case like this».
5. **Смена профессии.** Учитель → PM. Выбирает новую сферу, уровень beginner → кейсы проще, с подсказками. _(в демо — макет)_
6. **Провал.** Давит на клиента → терпение 0 → клиент уходит → исход «Deal lost» → разбор показывает зевок и лучший ход.
7. **Использование помощи.** Копирует ответы copilot → в разборе видны сохранённые вставки и совпадения с подсказками. Если перенёс ошибочный совет — отдельная содержательная ошибка с доказательством; если проверил и исправил — положительный результат проверки. Внешняя вставка имеет неизвестный источник. Сертификат показывает наблюдаемые факты и ограничения, без вывода «85% вероятность списывания».

## 7. Скоуп на 24 часа

- **Полностью работает:** сфера **Sales**, workspace **chat**, весь цикл из user stories 1, 2, 4, 6, 7 + оплата (Stripe test mode).
- **Макеты для питча:** Project Management (workspace `board`, 3 стейкхолдера), IT (workspace `ide`).
- **Демо-режим:** 2–3 заранее сгенерированных кейса, которые подхватываются, если LLM API упал на питче.
- **UI на английском** (рынок США). Код, коммиты, комментарии — на английском.

---

## 8. Архитектура: модульный монолит

Один Next.js проект на собственном VPS + обычный PostgreSQL на том же сервере. Приложение, БД, сессии, очередь задач и журналы размещаем сами, без Supabase и Vercel. Внутри — жёсткие модули с публичным API. Не микросервисы (нет времени), но без каши: любой модуль потом выносится в сервис без переписывания. Worker — отдельный процесс того же проекта для генерации и оценки; деплой через Docker Compose (`web`, `worker`, `postgres`, `caddy`). Внешние LLM API, Stripe test mode и доставка писем через настроенный SMTP остаются по исходному скоупу.

### Принципы

1. **Contract-first.** `/src/contracts` пишем в первый час втроём. Дальше меняем только по договорённости.
2. **Event log — источник правды.** Каждое действие кейса → запись в `events`; детальные операции редактора → закрытый append-only журнал `editor_events`, связанный с отправленными сообщениями через `draft_id`. Состояние персонажа, разбор, replay, «переиграть с хода N» — производные от лога. Клиентская телеметрия остаётся наблюдением со стороны браузера, а не доказательством авторства.
3. **Профессии — конфиги, а не код.** Новая сфера = новая папка в `/src/field-packs`.
4. **Все вызовы ИИ — через `modules/llm`.** Никто не импортирует SDK провайдера в фичах.
5. **Скрытое не покидает сервер.** `personas.hidden`, `rubrics`, `innerThought` до сдачи — только на сервере. Браузер не подключается к PostgreSQL: каждый API/SSE-ответ проходит публичную проекцию. Сырые события редактора, черновики и `llm_calls` не публикуются в сертификате. Иначе DevTools = ответы = мёртвый сертификат.
6. **Права — через `billing.can()`.** Нигде нет `if (user.subStatus === 'pro')`.
7. **Публичные данные — только через проекции** `credentials.toPublicLimited()` / `toPublicFull()`.
8. **Модуль импортирует другой модуль только через его `index.ts`.** (ESLint `no-restricted-imports` это проверяет.)

### Стек

Next.js (App Router, latest stable, TypeScript strict, Node.js runtime) · PostgreSQL (`pg`, SQL-миграции) · серверная auth magic link + cookie-сессии · SSE через собственный API с резервным поллингом · очередь задач в PostgreSQL + worker · Docker Compose + Caddy/HTTPS на VPS · zod · LLM-провайдер через env (`LLM_PROVIDER`, `LLM_MODEL`) · Stripe (test mode) · Tailwind + shadcn/ui · Vitest + Testing Library · Playwright · MSW · GitHub Actions (lint, typecheck, test).

### Модули

| Модуль        | Ответственность                                                                 | Публичный API (index.ts)                                                                                       |
| ------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `identity`    | профиль, разбор анкеты, magic link и серверные сессии                           | `getProfile`, `upsertProfileFromIntake`, `requestMagicLink`, `consumeMagicLink`, `getSession`, `revokeSession` |
| `catalog`     | field packs: сферы, архетипы, навыки                                            | `getPack`, `pickArchetype`, `listFields`                                                                       |
| `case-engine` | генерация кейса, персонажей, рубрики, поворотов                                 | `generateCase`, `getCaseForUser`                                                                               |
| `simulation`  | живой кейс: ход → персонаж → режиссёр → copilot                                 | `startCase`, `handleMove`, `askCopilot`, `submitCase`                                                          |
| `evaluation`  | метки ходов, accuracy, свидетельства, профиль помощи, проверка советов, ловушки | `evaluateCase`, `getReview`                                                                                    |
| `credentials` | сертификаты, публичные проекции                                                 | `issueCertificate`, `toPublicLimited`, `toPublicFull`, `getBySlug`                                             |
| `progress`    | XP, уровни, серия, daily/weekly                                                 | `award`, `getSkillPath`, `getTodayCases`                                                                       |
| `billing`     | Stripe, права                                                                   | `can(user, action)`, `createCheckout`, `handleWebhook`                                                         |
| `llm`         | шлюз, реестр промптов, валидация, ретраи, логи                                  | `llm.run(promptId, input, schema)`                                                                             |
| `events`      | append-only лог кейса и закрытый журнал редактора, безопасные проекции для SSE  | `append`, `listByCase`, `appendEditorBatch`, `listEditorByDraft`, `toPublicEvent`                              |
| `jobs`        | устойчивая очередь генерации/оценки в PostgreSQL, retry и lease                 | `enqueue`, `claim`, `complete`, `fail`                                                                         |

### Структура папок

```
/src
  /contracts            zod-схемы + типы (общие)
  /modules
    /<module>/index.ts  публичный API
    /<module>/service.ts
    /<module>/repo.ts   доступ к БД
    /<module>/__tests__
  /field-packs/sales    pack.json, skills.json, archetypes/*.json, personas/*.json, labels.json
  /prompts              case.generate.v1.md, case.rubric.v1.md, persona.reply.v1.md,
                        copilot.reply.v1.md, director.twist.v1.md, eval.moves.v1.md, intake.parse.v1.md
  /workspaces/chat      плагин рабочего пространства (frontend)
  /ui                   дизайн-система: токены, базовые компоненты (design)
  /screens              презентационные экраны, только props (design)
  /app                  роуты и контейнеры с данными (frontend)
    /(marketing)        лендинг, pricing
    /(app)              dashboard, onboarding, case/[id], review/[id], path
    /c/[slug]           публичный сертификат
    /api/*              route handlers (backend)
  /mocks                фикстуры по контрактам + MSW handlers
/db/migrations           SQL-миграции PostgreSQL
/src/worker              обработчик фоновых задач того же проекта
/deploy                  Docker Compose, Dockerfile, Caddyfile, инструкция VPS
/tests/e2e              Playwright
```

**Владение папками (чтобы не было конфликтов при мерже):**

- backend: `/src/contracts` (совместно), `/src/modules`, `/src/field-packs`, `/src/prompts`, `/src/app/api`, `/db`, `/src/worker`, `/deploy`
- frontend: `/src/app` (кроме `api`), `/src/workspaces`, `/src/mocks`, `/tests/e2e`
- design: `/src/ui`, `/src/screens`, `tailwind`/`globals.css` токены

**Граница design ↔ frontend:** design делает **презентационные** компоненты (только props, никаких fetch/хуков данных), типы props — из `/src/contracts`. Frontend делает **контейнеры** в `/src/app`, которые грузят данные и передают в экраны.

---

## 9. Модель данных (PostgreSQL на собственном VPS)

```sql
users           (id uuid pk, email unique, display_name, timezone, created_at)
auth_tokens     (id, user_id, token_hash unique, expires_at, consumed_at) -- одноразовые magic links
sessions        (id, user_id, token_hash unique, expires_at, revoked_at)  -- cookie содержит случайный токен
profiles        (user_id pk, intake_text, field, subfield, level, years int, pains text[], goals text[], updated_at)
subscriptions   (user_id pk, status: free|pro, stripe_customer_id, current_period_end)
cases           (id uuid, user_id, field, subfield, archetype_id, type: onboarding|daily|weekly,
                 workspace: chat|board|ide, status: generating|ready|in_progress|submitted|evaluated|failed,
                 brief jsonb, docs jsonb, time_limit_sec int, model text, prompt_version text, seed text,
                 is_demo bool, created_at, started_at, submitted_at)
personas        (id, case_id, public jsonb, hidden jsonb)            -- hidden: только сервер
persona_state   (case_id, persona_id, turn int, trust int, patience int, mood text,
                 revealed text[], outcome: null|won|lost|left, updated_at)
rubrics         (case_id pk, key_moments jsonb, traps jsonb, twists jsonb, success_criteria jsonb) -- только сервер
events          (id, case_id, seq int, actor: user|persona|copilot|system, persona_id null,
                 type: message|copilot_prompt|copilot_reply|doc_open|twist|submit,
                 content text, meta jsonb, client_msg_id text unique null, draft_id uuid null, created_at)
editor_drafts   (id uuid pk, case_id, user_id, message_event_id uuid null, created_at)
editor_events   (id uuid pk, case_id, user_id, draft_id uuid, seq int, kind text, input_mode text,
                 payload jsonb, client_at, received_at, unique(draft_id, seq)) -- только сервер
interaction_windows (id uuid pk, case_id, user_id, draft_id, started_at, ended_at, received_at,
                     metrics jsonb) -- агрегаты активности workspace, только сервер
move_reviews    (event_id pk, case_id, label: brilliant|best|good|inaccuracy|mistake|blunder,
                 why text, better_move text, inner_thought text, rubric_ref text null, trust_after int,
                 points int, evidence jsonb, assessment_status text)
evaluations     (case_id pk, accuracy int, label_counts jsonb, ai_dependency int, trap_caught bool,
                 outcome text, top_move_ids uuid[], summary text, skills jsonb,
                 assistance jsonb, ai_use_skill jsonb, trap_result text, score_audit jsonb,
                 process_observations jsonb)
certificates    (id, case_id, user_id, slug unique, skill text, issued_at)
skill_progress  (user_id, skill, level int, xp int, primary key(user_id, skill))
streaks         (user_id pk, current int, best int, last_practice_date date)
llm_calls       (id, case_id null, prompt_id, model, input jsonb, output jsonb, ok bool,
                 latency_ms int, tokens_in int, tokens_out int, created_at)
jobs            (id, kind, case_id, dedupe_key unique, payload jsonb, status, attempts,
                 available_at, locked_until, locked_by, last_error, created_at, updated_at)
```

**Доступ:** PostgreSQL находится во внутренней сети Docker; порт БД не публикуется в интернет. Запросы к БД делает только backend/worker через `repo.ts` и параметризованный SQL. Каждый приватный API и SSE-поток проверяет серверную сессию и владельца кейса; чужой кейс → 404. `personas.hidden`, `rubrics`, `editor_events`, `llm_calls` и приватный `events.meta` никогда не отдаются прямым SQL/Realtime-клиентом. Ответы формируются allowlist-проекциями; публичный сертификат — только через `credentials`. Сессии: случайный токен в HttpOnly/Secure/SameSite cookie, в БД только hash; magic link ограничен по времени и одноразовый, redirect только на разрешённые пути. Мутации защищены от CSRF, запросы magic link — rate limit. Политики авторизации проверяются интеграционными тестами API.

## 10. Контракты (эскиз; финализируем в первый час)

```ts
// /src/contracts/case.ts
export const Field = z.enum(["sales", "project_management", "software"]);
export const Level = z.enum(["beginner", "intermediate", "advanced"]);
export const CaseType = z.enum(["onboarding", "daily", "weekly"]);
export const WorkspaceType = z.enum(["chat", "board", "ide"]);

export const CaseDoc = z.object({
  id: z.string(),
  kind: z.enum(["email_thread", "crm_record", "slack_thread", "table", "note"]),
  title: z.string(),
  content: z.unknown(), // форма зависит от kind, см. /src/contracts/docs.ts
  arrivesAtTurn: z.number().int().nullable(), // null = доступен сразу
});

export const PersonaPublic = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  location: z.string(),
  avatarSeed: z.string(),
  context: z.string(),
});
export const PersonaHidden = z.object({
  personality: z.string(),
  style: z.string(),
  realMotive: z.string(),
  constraints: z.array(z.string()),
  triggersOpen: z.array(z.string()),
  triggersClose: z.array(z.string()),
  knows: z.array(z.string()),
  willNeverSayFirst: z.array(z.string()),
  patience: z.number().int().min(3).max(10),
  initialTrust: z.number().int().min(0).max(100),
});

export const CaseBrief = z.object({
  title: z.string(),
  mission: z.string(),
  yourRole: z.string(),
  successLooksLike: z.string(),
  timeLimitSec: z.number().int(),
});

export const CaseView = z.object({
  // что получает клиент
  id: z.string().uuid(),
  type: CaseType,
  workspace: WorkspaceType,
  status: z.enum(["ready", "in_progress", "evaluating", "evaluated"]),
  startedAt: z.string().datetime().nullable(),
  field: Field,
  subfield: z.string(),
  brief: CaseBrief,
  personas: z.array(PersonaPublic),
  docs: z.array(CaseDoc), // только уже доступные docs
  scoringGuide: PublicScoringGuide, // критерии, шкала, формулы; без секретов кейса
});
export const CaseResponse = z.union([
  CaseView,
  z.object({ id: z.string().uuid(), status: z.enum(["generating", "failed"]) }),
]); // до готовности не выдумываем brief/scoringGuide; внутренний submitted проецируется как evaluating

// /src/contracts/rubric.ts — только сервер
export const Rubric = z.object({
  version: z.string(),
  criteria: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      required: z.boolean(),
    }),
  ),
  aiUseChecks: z.array(
    z.object({
      id: z.string(),
      criterionId: z.string(),
      description: z.string(),
      maxPoints: z.number().int().positive(),
      passConditions: z.array(z.string()),
      failureConditions: z.array(z.string()),
      sourceRefs: z.array(z.string()),
    }),
  ),
  keyMoments: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      idealMove: z.string(),
      why: z.string(),
    }),
  ),
  traps: z.array(
    z.object({
      id: z.string(),
      injectAtCopilotCall: z.number().int(),
      errorToInject: z.string(),
      howToCatch: z.string(),
    }),
  ),
  twists: z.array(
    z.object({
      id: z.string(),
      trigger: z.union([
        z.object({ afterUserTurn: z.number().int() }),
        z.object({ trustBelow: z.number().int() }),
      ]),
      event: z.object({
        kind: z.enum(["email", "slack", "persona_message"]),
        from: z.string(),
        content: z.string(),
      }),
    }),
  ),
  successCriteria: z.array(z.string()),
});

// /src/contracts/events.ts
export const Event = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  seq: z.number().int(),
  actor: z.enum(["user", "persona", "copilot", "system"]),
  personaId: z.string().nullable(),
  type: z.enum([
    "message",
    "copilot_prompt",
    "copilot_reply",
    "doc_open",
    "twist",
    "submit",
  ]),
  content: z.string(),
  meta: PublicEventMeta,
  createdAt: z.string(),
  clientMsgId: z.string().uuid().nullable(),
  draftId: z.string().uuid().nullable(),
});

// /src/contracts/evaluation.ts
export const MoveLabel = z.enum([
  "brilliant",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
]);
export const MoveReview = z.object({
  eventId: z.string().uuid(),
  seq: z.number().int(),
  userText: z.string(),
  label: MoveLabel,
  why: z.string(),
  betterMove: z.string().nullable(),
  innerThought: z.string(),
  trustAfter: z.number().int(),
  rubricRef: z.string().nullable(),
  points: z.number().int().min(0).max(100).nullable(),
  evidence: z.array(ScoreEvidence),
  assessmentStatus: z.enum(["assessed", "insufficient_evidence"]),
});
export const Evaluation = z.object({
  caseId: z.string().uuid(),
  accuracy: z.number().int().min(0).max(100).nullable(),
  labelCounts: z.record(MoveLabel, z.number().int()),
  aiDependency: z.number().int().min(0).max(100).nullable(),
  trapCaught: z.boolean(), // legacy: сходство текста, не вероятность ИИ
  assistance: AssistanceProfile,
  aiUseSkill: AiUseSkill,
  trapResult: TrapResult,
  scoreAudit: ScoreAudit,
  processObservations: ProcessObservations, // только owner review, см. проекции сертификата ниже
  outcome: z.enum(["won", "lost", "left", "incomplete"]),
  topMoves: z.array(MoveReview).max(3),
  summary: z.string(),
  skills: z.array(z.object({ skill: z.string(), score: z.number().int() })),
  trustCurve: z.array(
    z.object({ seq: z.number().int(), trust: z.number().int() }),
  ),
});

// /src/contracts/certificate.ts
export const CertificateLimited = z.object({
  slug: z.string(),
  holderName: z.string(),
  skill: z.string(),
  field: Field,
  level: Level,
  issuedAt: z.string(),
  caseTitle: z.string(),
  accuracy: z.number().int().nullable(),
  outcome: z.string(),
  headline: z.string(), // короткая характеристика
  verified: z.literal(true),
  verificationScope: z.literal("recorded_simulation"),
  assistance: AssistanceProfile,
  aiUseSkillSummary: AiUseSkillSummary,
  scoringSummary: ScoringSummary,
});
export const PublicEvaluation = Evaluation.omit({ processObservations: true });
export const CertificateFull = CertificateLimited.extend({
  evaluation: PublicEvaluation,
  moves: z.array(MoveReview),
  personas: z.array(PersonaPublic),
  transcript: z.array(
    Event.pick({
      id: true,
      seq: true,
      actor: true,
      type: true,
      content: true,
      createdAt: true,
    }),
  ),
});

// /src/contracts/progress.ts
export const SkillPath = z.object({
  skills: z.array(
    z.object({
      skill: z.string(),
      level: z.number().int(),
      xp: z.number().int(),
      nextLevelXp: z.number().int(),
    }),
  ),
  streak: z.object({ current: z.number().int(), best: z.number().int() }),
  today: z.object({ daily: CaseView.nullable(), weekly: CaseView.nullable() }),
  history: z.array(
    z.object({
      caseId: z.string(),
      title: z.string(),
      accuracy: z.number().int().nullable(),
      date: z.string(),
    }),
  ),
});
```

### Дополнения к контрактам для скоринга и наблюдаемого процесса

Типы ниже оформляем zod-схемами в `/src/contracts/scoring.ts`, `/src/contracts/telemetry.ts`, `/src/contracts/auth.ts`; экспортируем из общего `index.ts`. Публичные типы не импортируют серверную рубрику. Численные диапазоны и смысл одинаковы для backend/frontend/design.

- `PublicScoringGuide`: `version`, `criteria[{id,title,description}]`, `labelPoints`, `accuracyFormula`, `aiUseFormula`, `requiredCheckCount`, `allowedTools[]`, `observationNotice`. Показывается до старта; не содержит idealMove, скрытые мотивы, конкретную ловушку или будущие повороты.
- `PublicEventMeta`: allowlist `typingMs?`, `trustAfter?`, `documentIds?`; никакого произвольного `meta` из БД, `innerThought` или `trapId` в событиях клиента.
- `ScoreEvidence`: `source: 'user_event'|'persona_event'|'case_doc'|'copilot_event'|'editor_aggregate'`, `sourceId`, `quote`, `explanation`. Ссылки и дословные цитаты backend сверяет с реально существующими, доступными на момент действия материалами. Сырые операции редактора не являются публичным evidence.
- `TrapResult`: `caught | missed | not_presented | insufficient_evidence`; `trapCaught` — совместимое производное `trapResult === 'caught'`.
- `AssistanceProfile`: `copilotRequests`, `knownCopilotRetainedChars`, `totalSubmittedChars`, `copilotRetainedPercent: number|null`, `copilotTextSimilarityPercent: number|null`, `unknownPasteCount`, `unknownPasteChars`, `observedInputModes[]`, `observationStatus: 'available'|'partial'|'unavailable'`, `limitations[]`. Это описание наблюдений; даже available не гарантирует отсутствие внешнего ИИ.
- `AiUseCheck`: `id`, `criterionId`, `status: 'passed'|'failed'|'not_observed'|'not_applicable'`, `earnedPoints`, `maxPoints`, `evidence[]`, `reason`. Баллы соответствуют заранее сохранённой рубрике.
- `AiUseSkill`: `score: number|null` (0–100), `checks: AiUseCheck[]`, `assessedChecks`, `applicableChecks`, `earnedPoints`, `assessedMaxPoints`, `applicableMaxPoints`. `AiUseSkillSummary` — тот же агрегат без `checks`; для limited-сертификата.
- `ScoreAudit`: `rubricVersion`, `scorerModel`, `scorerPromptVersion`, `caseLevel`, `labelPoints`, `formula`, `scoredMoveCount`, `totalUserMoveCount`, `pointsSum`, `maxPoints`, `criterionCoverage[{criterionId,status}]`, `completionStatus: 'complete'|'partial'|'insufficient_evidence'`, `limitations[]`. Объясняет именно сохранённую оценку; повторный LLM-вызов не считается гарантированным воспроизведением.
- `ScoringSummary`: публичная выжимка `rubricVersion`, `scorerModel`, `scorerPromptVersion`, `caseLevel`, `scoredMoveCount`, `totalUserMoveCount`, `pointsSum`, `maxPoints`, `formula`, `completionStatus`, `limitations[]`. Полный `scoreAudit`, evidence и ходы — в owner review / full-сертификате; базовая методика доступна и в limited.
- `criterionCoverage.status`: `met | partially_met | not_met | not_observed | not_applicable`. `completionStatus=complete` означает, что все обязательные применимые критерии получили наблюдаемую оценку (не обязательно успешную); partial — оценена только часть; insufficient_evidence — нет достаточной основы для результата. Покрытие не увеличивается от повторных бессодержательных сообщений. `requiredCheckCount` в scoringGuide — число обязательных критериев кейса; AI-use coverage считается отдельно по AiUseSkill.
- `EditorEvent`: `id`, `draftId`, `seq`, `kind: 'insert'|'delete'|'paste'|'copilot_insert'|'undo'|'redo'|'composition'|'other'`, `inputMode: 'keyboard'|'ime'|'dictation'|'assistive'|'unknown'`, `clientAt`, `rangeStart`, `rangeEnd`, `insertedText`, `sourceEventId: string|null`. Для undo/redo/composition передаётся фактически применённая замена диапазона. Неопределимый способ ввода — unknown; диктовку/assistive не угадывать по темпу, можно указать самому. Новый draftId для каждого сообщения персонажу. HTTP-тело `EditorBatch = {draftId, batchId, events: EditorEvent[]}`. У сообщения `/move` — тот же `draftId` (nullable для старого клиента/пропусков); отсутствие телеметрии не блокирует кейс, а отмечает ограничение наблюдения.
- `EventsPage = {events: Event[], lastSeq: number}`; `EditorBatchAck = {acceptedCount, lastDraftSeq}`. `SessionView = {user: {id, email, displayName}, expiresAt} | null`. Cookie-токены и хеши не входят в ответы.
- `draftId` создаётся клиентом при открытии редактора, до первой правки. Первый пакет (в том числе только с окнами) или `/move` атомарно связывает его с owner/case в editor_drafts; повторное использование для другого кейса/пользователя отклоняется. После принятого `/move` draft закрывается, frontend создаёт новый id; при смене draft закрывается текущее окно активности.
- Дополнение `EditorEvent`: `inputType: string|null`, `isComposing: boolean|null`, `isTrusted: boolean|null`. Это доступные браузеру наблюдения, не аттестация подлинности. `EditorBatch` дополнительно принимает `interactionWindows?: InteractionWindow[]`; пакет может содержать только окна при пустом `events`. Ack включает `acceptedWindowCount`; повторные окна дедуплицируются по id.
- `InteractionWindow`: `id`, `startedAt`, `endedAt`, `durationMs`, `pointerTypes[]`, `pointerMoveSamples`, `pointerDownCount`, `clickCount`, `wheelCount`, `pathLengthNormalized`, `directionChanges`, `movementIntervalSummary`, `inputIntervalSummary`, `editCount`, `focusTransitionCount`, `visibleDurationMs`, `trustedEventCount`, `untrustedEventCount`, `webdriverReported: boolean|null`, `capabilityGaps[]`. Не поддерживаемые/не наблюдаемые метрики — null/явное ограничение, а не ноль человеческой активности. Координаты и движения вне workspace не собираются; сырые траектории не сохраняются.
- `ProcessObservations`: `rulesVersion`, `observationStatus`, `automationStatus: 'signals_observed'|'no_signals_observed'|'insufficient_data'`, `signals[{code,observedValue,windowId?,messageId?,explanation,limitation}]`, `textFeatures[{messageId,charCount,punctuationCounts,listMarkerCount,editCount,languageIssues: {count,method,version}|null}]`, `limitations[]`. Это owner-only диагностический отчёт без вероятности «бот/человек». Пунктуация и languageIssues описательны, не участвуют в automationStatus или баллах. Полный объект не включается в CertificateFull.evaluation: там используется публичная проекция Evaluation без processObservations; aggregate observationStatus/limitations уже есть в assistance.

## 11. API (Next.js route handlers)

| Метод | Путь                           | Тело → ответ                                                                    | Права                                                               |
| ----- | ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| POST  | `/api/auth/magic-link`         | `{email}` → `{accepted:true}`                                                   | public, rate limit; одинаковый ответ для существующего/нового email |
| GET   | `/api/auth/verify`             | `?token=...` → cookie + redirect                                                | одноразовый magic link                                              |
| GET   | `/api/auth/session`            | → `SessionView`                                                                 | собственная сессия или null                                         |
| POST  | `/api/auth/logout`             | → `{ok:true}`                                                                   | auth, CSRF                                                          |
| POST  | `/api/intake`                  | `{text, field, level}` → `Profile`                                              | auth                                                                |
| POST  | `/api/cases`                   | `{type}` → `{caseId, status:'generating'}`                                      | auth, `can('start_case', type)`                                     |
| GET   | `/api/cases/:id`               | → `CaseResponse`                                                                | owner                                                               |
| POST  | `/api/cases/:id/start`         | → `{startedAt}`                                                                 | owner                                                               |
| POST  | `/api/cases/:id/move`          | `{clientMsgId, personaId, text, draftId}` → `{events: Event[], trust, outcome}` | owner                                                               |
| POST  | `/api/cases/:id/editor-events` | `EditorBatch` → `EditorBatchAck`                                                | owner, active case, rate/size limit                                 |
| GET   | `/api/cases/:id/events`        | `?afterSeq=N` → `EventsPage`                                                    | owner; безопасная проекция для догрузки/поллинга                    |
| GET   | `/api/cases/:id/stream`        | `?afterSeq=N`; SSE: `id=seq`, `event=case_event`, `data=Event`                  | owner, cookie-session; Last-Event-ID для продолжения                |
| POST  | `/api/cases/:id/copilot`       | `{clientMsgId, text}` → `{event: Event}`                                        | owner                                                               |
| POST  | `/api/cases/:id/submit`        | → `{status:'evaluating'}`                                                       | owner                                                               |
| GET   | `/api/cases/:id/review`        | → `{evaluation, moves}`                                                         | owner, после evaluated                                              |
| GET   | `/api/certificates/:slug`      | → `CertificateLimited \| CertificateFull`                                       | public; full если владелец Pro                                      |
| GET   | `/api/me/path`                 | → `SkillPath`                                                                   | auth                                                                |
| POST  | `/api/billing/checkout`        | → `{url}`                                                                       | auth                                                                |
| POST  | `/api/billing/webhook`         | Stripe                                                                          | stripe signature                                                    |

Ошибки: `{error: {code, message}}`, коды `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | PAYWALL | RATE_LIMIT | LLM_FAILED | VALIDATION`. Реалтайм: same-origin SSE через `/stream`; начальная загрузка/восстановление через `/events?afterSeq=N`, резервный поллинг каждые 2 с. SSE проверяет владельца и срок сессии, отправляет heartbeat и только публичные `Event`; приватный meta и editor_events не попадают в поток. После переподключения возобновляем с Last-Event-ID, дубли убираем по id/seq, оптимистичные сообщения связываем по clientMsgId. `persona_state.trust/outcome` приходят в ответе `move`; статус генерации/оценки можно поллить через GET кейса.

SSE сначала воспроизводит все публичные события после Last-Event-ID (при наличии), иначе после afterSeq; затем продолжает поток без промежутка между replay/live. lastSeq — последний обработанный серверный seq, даже если часть приватных событий не показывается. Native EventSource не отдаёт HTTP-статус в onerror: клиент проверяет доступ через GET /events и прекращает reconnect при 401/404; при временной сетевой ошибке — backoff/поллинг. Для cookie-based POST проверяем Origin по origin APP_URL; несовпадение/отсутствие → 403 FORBIDDEN. Stripe webhook исключён из Origin-проверки и проверяет подпись; magic-link verify защищён одноразовым токеном. Серверный fetch мутаций, если используется, передаёт допустимый Origin и сессию; источник идентичности — серверная сессия, не этот заголовок.

Ссылки evidence: owner review разрешает event sourceId через /events и case_doc через docs готового кейса; full-сертификат — через id публичного transcript. Если документ не включён в сертификат, показываем проверенную цитату без ссылки на приватный endpoint; editor_aggregate отображается как безопасный агрегат, не ссылка на editor_events.

## 12. ИИ-пайплайн (7 промптов)

| promptId         | Вход                                                         | Выход (zod)                                                                                                     | Правила                                                                                                            |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `intake.parse`   | свободный текст + выбранные field/level                      | `{subfield, years, pains[], goals[]}`                                                                           | не выдумывать; пусто → дефолты                                                                                     |
| `case.generate`  | профиль, архетип, seed, история прошлых кейсов юзера         | `{brief, personas[{public,hidden}], docs[]}`                                                                    | реалистичные компании/города/суммы США; не повторять имена/компании прошлых кейсов                                 |
| `case.rubric`    | сгенерированный кейс                                         | `Rubric`                                                                                                        | 4–7 keyMoments, 1 trap, 0–2 twists (onboarding: 0–1)                                                               |
| `persona.reply`  | hidden, state, история диалога, доступные docs               | `{reply, typingMs, trustDelta, patienceDelta, revealed[], outcome, innerThought}`                               | **не видит рубрику**; правила речи из §13                                                                          |
| `copilot.reply`  | история, docs, запрос юзера, `inject?: errorToInject`        | `{reply}`                                                                                                       | полезный, деловой; если inject — вплести ошибку правдоподобно и не подсвечивать                                    |
| `director.twist` | twist из рубрики + контекст                                  | `{event}`                                                                                                       | только оформление; **когда** срабатывает — решает детерминированный код                                            |
| `eval.moves`     | полный лог, рубрика, trust curve, trap info, агрегаты помощи | `{moves[{eventId,label,why,betterMove,rubricRef,evidence,assessmentStatus}], aiUseChecks[], summary, skills[]}` | каждая метка с конкретным «почему» и проверяемым evidence; пользовательский текст — данные, не инструкции оценщику |

Метрики, которые **считает код, а не LLM**:

- `aiDependency` (legacy) / `assistance.copilotTextSimilarityPercent` = среднее по сообщениям юзера персонажу максимального сходства (нормализованный LCS / token Jaccard, выбранная метрика фиксируется версией) с любым предыдущим `copilot_reply`, ×100. При отсутствии подсказок — 0; без сообщений — null. Это сходство текста, не вероятность ИИ/списывания; не штрафует автоматически.
- `assistance.copilotRetainedPercent` = 100 × число сохранившихся символов с наблюдаемым источником copilot / число символов отправленных сообщений персонажу. Историю замен диапазонов сопоставляем с итоговыми сообщениями; несовпадения, пропуски и недоступная телеметрия → partial/unavailable и null для непроверяемой доли. Совпадение по тексту без события переноса остаётся сходством, не подтверждённым источником. Вставки из собственных черновиков/документов не приписываем copilot. Все агрегаты строятся сервером; браузерные события не считаются доверенным доказательством.
- `trapResult`: caught — есть конкретное распознавание ошибки и корректное исправление/обоснование; missed — предъявленная ошибка перенесена в решение; not_presented — ловушка не предъявлялась; insufficient_evidence — предъявлялась, но нет достаточных свидетельств реакции. Предъявление подтверждается сохранённым ответом copilot, действительно содержащим заданную ошибку; один номер вызова/запрос инъекции недостаточен. Неиспользование совета само по себе не означает caught. `trapCaught = (trapResult === 'caught')`.
- `accuracy` = округлённое среднее баллов оценённых ходов: brilliant 100, best 100, good 80, inaccuracy 50, mistake 20, blunder 0. `pointsSum / maxPoints × 100`, где `maxPoints = 100 × scoredMoveCount`. Нет оценённых ходов → null. Покрытие критериев и complete/partial/insufficient_evidence показываем отдельно: один хороший ход не подтверждает полное прохождение. Если evidence нельзя подтвердить, ход получает assessmentStatus=insufficient_evidence и points=null; декоративную метку не используем как завершённую оценку.
- `aiUseSkill.score` = round(100 × earnedPoints / assessedMaxPoints) по проверкам со статусами passed/failed. Баллы и максимумы проверок фиксируются рубрикой до старта; not_observed не выдаётся за провал или успех и остаётся в applicableChecks/applicableMaxPoints для показателя покрытия. not_applicable исключается из покрытия. Нет оценённых проверок → null. Это качество проверки/применения советов в наблюдавшихся эпизодах, не «процент самостоятельности»; согласуется с измерением critical_ai_use в skills.
- `trustCurve` = из `persona_state` после каждого хода (храним в `move_reviews.trust_after`).

Каждый вызов: валидация zod → до 2 ретраев с текстом ошибки валидации → запись в `llm_calls`. У кейса храним `model`, `prompt_version`, `seed`.

### Прозрачность и ограничения скоринга

- Рубрику и её версию сохраняем до начала кейса. До старта доступны общие критерии/формулы и разрешённые инструменты; скрытые ответы, мотивы и ловушка не раскрываются.
- Для каждого хода после сдачи: действие → критерий → точное evidence → метка/баллы → why → betterMove. Числовые и документальные ограничения, которые можно проверить кодом, проверяем кодом; LLM оценивает содержательные аспекты по рубрике. Падение trust — реакция симулятора, а не самостоятельное доказательство ошибки.
- Полезное использование разрешённого copilot не ухудшает score автоматически. Оцениваем обнаружение/исправление ошибки, сверку условия с документом и применение нового условия. В существующий twist можно включить короткое уточнение «на чём основано решение / что меняется при новом бюджете»; ответ оцениваем по содержанию, не по скорости. Он тоже не гарантирует отсутствия внешней помощи.
- Не используем стиль, скорость набора, Backspace, смену вкладки, IME, диктовку или вставку как самостоятельное основание штрафа. Стилевой AI-detector и обученный по клавишам классификатор в MVP не входят. Не обещаем AI-free, доказанное авторство или вероятность списывания.
- События собираем только в редакторе кейса после понятного уведомления. Не читаем системный clipboard в фоне, другие приложения или глобальную клавиатуру. Сырые черновики и телеметрия доступны только серверу; сертификат получает безопасные агрегаты и ограничения.
- `verified=true` означает существующую запись этой симуляции (`verificationScope=recorded_simulation`). Limited/full различаются глубиной просмотра, а не достоверностью или способом подсчёта. Не заявляем подтверждение личности либо независимую сертификацию профессии.
- Сложность, полнота прохождения, версия рубрики и ограничения видны рядом с score. Проценты разных уникальных кейсов не объявляем стандартизированным рейтингом кандидатов без отдельной калибровки. Golden-транскрипты сравниваем с ручными оценками; объяснение модели само по себе не подтверждает правильность балла.
- Исследовательское основание: [Sadasivan et al., TMLR / 2025](https://arxiv.org/abs/2303.11156) — ограничения детекции при перефразировании; [Mehta et al., редакция 2026](https://arxiv.org/html/2511.12468v2) — сигналы набора в контролируемых длинных заданиях, не валидированная точность для нашего чата; [Schaller et al., препринт 09.11.2026](https://arxiv.org/html/2611.12487v1) — provenance по операциям редактора, смешанное/неизвестное происхождение и ограничения переноса; [Thakur et al., 2025](https://aclanthology.org/2025.gem-1.33/) — ограничения LLM-оценщиков. Предложенные продуктовые формулы не являются научно валидированной шкалой авторства.

### Движения мыши, набор и признаки автоматизации: только данные сайта

- Собираем после уведомления и только во время активного кейса в workspace: pointermove/pointerdown/click/wheel, pointerType (mouse/touch/pen), beforeinput/input/composition, focus/blur и visibilitychange нашей страницы. Уход вкладки в фон означает только отсутствие видимости; сайт не знает, какое приложение/страницу человек открыл.
- Мышь: частота событий, длина пути относительно размера workspace, изменения направления, интервалы между движениями и кликами. Сэмплирование pointermove не чаще 10 Гц, свёртка в 10-секундные окна; сырые точки остаются только в памяти окна и удаляются после агрегации. Touch, управление клавиатурой, assistive tools и отсутствие мыши не считаются признаком бота. Ровная/повторяющаяся траектория — слабое наблюдение, а не доказательство.
- Набор: интервалы ввода, вставки блоками, удаления, замены, композиция IME и история исправлений. Пауза не доказывает размышление, отсутствие исправлений не доказывает ИИ, ручное перепечатывание не доказывает авторство. Задержки сети, throttling фоновой вкладки и пакетная отправка не превращаются в «невозможную скорость набора».
- Текст: считаем явные характеристики (длина, тире, типографские кавычки, списки); сравниваем с предыдущими ответами нашего copilot. Число предполагаемых языковых ошибок допускается только с указанным методом/версией и как nullable диагностическое поле; browser spellcheck не предоставляет универсального списка ошибок. Не называем исправления клавиатурой орфографическими ошибками. Нет символов/пунктуации, эксклюзивных для ИИ, и нет надёжного «человечного» стиля; эти признаки не повышают подозрение автоматически.
- Автоматизация: navigator.webdriver (если доступен), isTrusted/inputType и согласованность последовательности событий с серверными запросами. У isTrusted=true нет значения «написал человек»: события может создавать браузер, в том числе программно. isTrusted=false означает конкретное синтетическое событие, а не злонамеренность; собственные Insert/undo и тестовые сценарии могут создавать такие события. Все клиентские сигналы могут быть скрыты/подделаны. Наблюдаемую автоматизацию браузера не смешиваем с использованием ИИ человеком.
- Для каждого сигнала храним observedValue, основание, версию правила и ограничение; явные дубли/нарушения API-лимитов обрабатывает обычная защита API. Ни один поведенческий/стилевой сигнал и их произвольная сумма не меняют accuracy/aiUseSkill, не выдают «доказанный бот» и не публикуют обвинение в сертификате. Без своей размеченной выборки не обучаем и не заявляем калиброванный anti-bot score. Неполные/неподдерживаемые наблюдения показываем как insufficient_data.
- Не делаем canvas/audio fingerprint, не пытаемся вывести инвалидность/здоровье или личность по моторике. Уведомление перечисляет редактор и агрегаты взаимодействия; диагностический owner review не выдаёт сырые траектории/черновики в публичную ссылку. Сбор отключается после завершения кейса/ухода из workspace.
- Основания: [MDN inputType](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/inputType), [MDN isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted), [MDN webdriver](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver) описывают доступные сигналы и их смысл. Исследования [BeCAPTCHA-Mouse](https://arxiv.org/abs/2005.00890) и [DMTG](https://arxiv.org/abs/2410.18233) показывают возможность классификации и имитации траекторий в своих условиях; их результаты не являются точностью нашего сайта.

## 13. Реализм (анти-синтетика) — обязательные правила

**Речь персонажа:**

- Коротко, как в мессенджере/почте: 1–3 предложения, без списков и markdown.
- Запрещено: «Great question», «I understand your concern», «Absolutely!», «I appreciate…», «As a…», длинные тире «—», эмодзи (если не в характере), идеальная вежливость, эссе.
- Не выдаёт `willNeverSayFirst`, пока юзер не задал правильный вопрос/не заработал доверие ≥ порога.
- Может отвечать не на тот вопрос, переспрашивать, перебивать темой, писать «sec, in a meeting», делать мелкие опечатки (≤1 на 3 сообщения, если в характере).
- Терпение убывает от триггеров закрытия, шаблонных фраз, игнора вопросов. `patience = 0` → вежливо или резко уходит → `outcome: 'left'`.
- `typingMs` ≈ длина ответа × 40–70 мс + 600–2500 мс «думания».

**Мир кейса:**

- Документы как настоящие: цепочка писем с подписями и таймстемпами, карточка CRM, тред Slack, таблица, где цифры слегка не сходятся.
- Шум: лишние детали, одно противоречие в данных.
- Реалистичные компании, города, роли и суммы США (не Acme Corp, не John Doe).
- Повороты сюжета (twists) — приходят как новое письмо/сообщение посреди кейса.
- Таймер: daily 10 мин, weekly 40 мин, onboarding 8 мин.
- Исход виден в конце: Deal won / Deal lost / Client left.

**Разнообразие:** 10–15 архетипов на подсферу × seed. Генератор получает список имён/компаний/сюжетов прошлых кейсов юзера и не повторяет их.

## 14. Шкала меток (общая для бэка, фронта и дизайна)

| label      | Глиф | Смысл (Sales)                                                       |
| ---------- | ---- | ------------------------------------------------------------------- |
| brilliant  | `!!` | нашёл скрытый мотив, поймал ошибку copilot, неочевидный сильный ход |
| best       | `!`  | совпадает с идеальным ходом в keyMoment                             |
| good       | —    | разумно, но не оптимально                                           |
| inaccuracy | `?!` | правильно по смыслу, но затянул/упустил возможность                 |
| mistake    | `?`  | неверное решение, доверие упало                                     |
| blunder    | `??` | грубая ошибка: давление, игнор, принял ложь copilot, клиент ушёл    |

## 15. Нефункциональное

- VPS: Next.js `output: standalone`, PostgreSQL и worker запускаются через Docker Compose; Caddy завершает HTTPS. БД — persistent volume + документированное резервное копирование/восстановление. CI проверяет сборку; preview — отдельное окружение на VPS/локальный Compose, не Vercel. SSE проходит reverse proxy без буферизации.
- Фоновая генерация/оценка ставится транзакционно в PostgreSQL jobs; worker забирает задания через блокировку/lease, повторяет после сбоя и обеспечивает идемпотентность результатов, сертификатов и XP. Не полагаемся на незавершённый Promise HTTP-обработчика. Redis и отдельный managed backend не требуются.
- Конфигурация VPS: `DATABASE_URL`, `APP_URL`, параметры SMTP, секреты сессий/подписей при необходимости, `LLM_PROVIDER`, `LLM_MODEL`, ключ LLM, Stripe test/webhook secrets. Только серверные env; миграции — `/db/migrations`, доступ БД — через repo.
- Генерация кейса асинхронная (20–40 с): `status: generating → ready`, клиент поллит/слушает realtime и показывает экран подготовки.
- Онбординг-кейсы для каждой подсферы Sales — пре-генерируем и кешируем пул (быстрый первый опыт).
- Демо-режим: `DEMO_MODE=true` или ошибка LLM → подставить seed-кейс из `/src/field-packs/sales/demo/*.json`.
- Идемпотентность ходов по `clientMsgId`.
- Rate limit: 30 ходов/мин на кейс, 10 генераций/час на юзера.
- Секреты только в env; `.env.example` в репо.
- Логи: каждый LLM-вызов в `llm_calls`; страница `/admin/llm` (только для нас) — опционально.
- Телеметрия редактора отправляется небольшими пакетами с retry/idempotency; перед move пытаемся flush, затем отправляем сообщение даже при недоступной телеметрии и помечаем ограничение. На submit фиксируем снимок наблюдений для этой оценки; поздние пакеты не меняют опубликованный score молча.

## 16. Тестирование и Definition of Done

**DoD для любой задачи:** типы без `any`, линт и typecheck зелёные, тесты на новую логику, нет утечки скрытых полей, работает на задеплоенном превью.

- **Unit (Vitest):** каждый модуль; LLM мокается фикстурами через `llm` шлюз.
- **Контрактные:** zod-схемы ↔ фикстуры в `/src/mocks` (фикстуры обязаны проходить схемы).
- **Golden-тесты оценщика:** 3 вручную написанных транскрипта (сильный, средний, «списывальщик») → ожидаемые диапазоны accuracy, aiDependency, trapCaught.
- **Скоринг/телеметрия:** внешняя вставка собственного текста, корректное использование copilot, исправление ошибочного совета, перенос ошибки, отсутствие предъявленной ловушки, пропуски/дубли пакетов, IME/диктовка, пустой/неполный кейс. Проверяем формулы, coverage, null при нехватке данных и отсутствие автоматического штрафа за способ ввода. Каждое evidence ссылается на существующий материал; поддельная ссылка/цитата не принимается.
- **Поведенческие наблюдения:** mouse/touch/keyboard-only, синтетическое событие собственного UI, недоступный webdriver/isTrusted, пауза/фон/разрыв сети, текст с длинными тире без ошибок. Никакой из этих сценариев сам по себе не ухудшает skill score и не выдаёт обвинение; корректны aggregation/deduplication/cleanup и owner-only проекция processObservations.
- **VPS/auth/stream:** одноразовый и истёкший magic link, отзыв сессии, ownership API/SSE/телеметрии, отсутствие скрытых meta в потоке, возобновление без дублей, повтор jobs после рестарта без повторного сертификата/XP. PostgreSQL-интеграция проверяется на настоящей тестовой БД.
- **Security-тест:** ответы `GET /api/cases/:id`, `/move`, `/certificates/:slug` не содержат полей `hidden`, `rubric`, `realMotive`, `innerThought` (до сдачи).
- **E2E (Playwright):** онбординг → кейс → 3 хода → сдача → разбор → сертификат; пейвол на full; демо-режим.
- **A11y:** axe в Playwright на ключевых экранах.
- **CI:** GitHub Actions — `lint`, `typecheck`, `test`, `e2e` (e2e на моках/демо-режиме, без реального LLM).

## 17. Команда, тайминг, git

| Часы  | Backend (ChatGPT #1)                                                         | Frontend (ChatGPT #2)             | Design (Claude)                        |
| ----- | ---------------------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
| 0–1   | **вместе:** контракты, API, миграции                                         | **вместе**                        | **вместе**                             |
| 1–4   | PostgreSQL, auth/сессии, VPS/worker, `llm`, `events`, `catalog` + sales pack | скелет, auth, MSW-моки, роутинг   | токены, дизайн-система `/src/ui`       |
| 4–9   | `case-engine` + `identity`                                                   | онбординг, экран подготовки, бриф | лендинг, онбординг, workspace          |
| 9–14  | `simulation` (persona, director, copilot)                                    | workspace chat (плагин)           | разбор, сертификат, путь, пейвол       |
| 14–18 | `evaluation`, `credentials`, `progress`                                      | разбор, сертификат, путь          | макеты PM/IT, состояния, полировка     |
| 18–21 | `billing`, демо-режим, интеграция                                            | переключение моков на API, Stripe | помощь в интеграции, визуальные правки |
| 21–24 | багфикс, golden-тесты                                                        | e2e, полировка                    | скриншоты/видео для сабмишена          |

**Git:** `main` защищён; ветки `be/*`, `fe/*`, `ds/*`; мерж в `main` каждые ~4 часа через PR с зелёным CI; изменения в `/src/contracts` — только с согласия всех троих. Conventional commits.

## 18. Глоссарий

case — кейс · persona — персонаж · move — ход (сообщение юзера персонажу; ходы в copilot учитываются в aiDependency) · rubric — скрытый ключ оценки · twist — поворот сюжета · trap — ловушка copilot · review — разбор · trust curve — кривая доверия · field pack — конфиг профессии · workspace — рабочее пространство · limited/full certificate — урезанный/полный сертификат.
