# CONTEXT.md — общий контекст проекта

> Этот файл читают все трое (backend, frontend, design) перед любой работой. Он — источник правды. Если код расходится с этим файлом, прав файл; если файл надо поменять — договариваемся втроём.
> Рабочее название продукта: **[PRODUCT]** (заменить, когда выберем).

---

## 1. Хакатон и критерии

**Задача:** веб-продукт, который закрывает фундаментальную боль взрослых в США и за который они заплатят.
**Ограничения (pass/fail):** только B2C · только веб (никаких мобильных приложений) · 24 часа · все 3 пункта сабмишена.
**Трек:** 03 — Skills.

| Вес | Критерий | Что это значит для нас |
|---|---|---|
| 40% | Does it work? | Работает end-to-end в проде. Ключевая ценность настоящая, не захардкожена. Качество UX и кода — **судьи читают репозиторий**. |
| 20% | What do we sell? | Понятно, за что платят и почему вернутся завтра. |
| 15% | Who do we sell to? | Чёткий пользователь и боль. |
| 15% | Why does it make money? | Большая/растущая ниша, LTV > CAC. |
| 10% | Is it new? | Не копия существующего бизнеса. |

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
5. **Ловушка**: встроенный ассистент один раз подкидывает тонкую ошибку. Поймал — блестящий ход. Это доказывает, что человек думает сам.
6. **Зависимость от ИИ** считается измеримо (сколько скопировано из ассистента), а не «на глаз».
7. **Сертификат-ссылка**: limited (бесплатно) — краткая характеристика; full (подписка) — полный разбор процесса. Работодатель видит выжимку за 30 секунд, полный разбор по клику.
8. **Путь по навыкам**: уровни навыков, XP, серия практики, daily (5–10 мин) и weekly (30–40 мин) кейсы.

## 5. Монетизация (предложение, можно менять)

| | Free | Pro — $19/мес или $149/год |
|---|---|---|
| Онбординг-кейс | ✅ | ✅ |
| Daily кейсы | 1 в неделю | безлимит |
| Weekly «большой» кейс | — | ✅ |
| Сертификат | limited | full (полный разбор) |
| Путь по навыкам | базовый | полный + рекомендации |

Почему вернутся: daily-кейс + серия + рост уровня навыка. Вирусный цикл: каждая ссылка-сертификат несёт CTA «Пройди такой кейс сам».

## 6. User stories

1. **Новичок (aha до пейвола).** SDR, 29 лет. Лендинг → регистрация (magic link) → пишет о себе свободным текстом + выбирает сферу и уровень → экран «готовим кейс» → бриф → 10 минут чата с клиентом → сдача → разбор (Accuracy 74%, 1 `!!`, 1 `??`) → limited-сертификат со ссылкой → предложение Pro.
2. **Подписчик, daily.** Открывает дашборд → серия 6 дней → daily-кейс по подсфере → разбор → +XP, уровень навыка растёт.
3. **Weekly.** Кейс на 30–40 мин с 2 поворотами сюжета → full-сертификат → шерит в LinkedIn.
4. **Работодатель.** Открывает ссылку → Accuracy, 3 ключевых хода, навыки, кривая доверия → «View full review» → внизу CTA «Try a case like this».
5. **Смена профессии.** Учитель → PM. Выбирает новую сферу, уровень beginner → кейсы проще, с подсказками. *(в демо — макет)*
6. **Провал.** Давит на клиента → терпение 0 → клиент уходит → исход «Deal lost» → разбор показывает зевок и лучший ход.
7. **Списывальщик.** Копирует всё из copilot → AI-dependency 85%, ловушку пропустил → это честно видно в сертификате. Именно поэтому сертификату можно верить.

## 7. Скоуп на 24 часа

- **Полностью работает:** сфера **Sales**, workspace **chat**, весь цикл из user stories 1, 2, 4, 6, 7 + оплата (Stripe test mode).
- **Макеты для питча:** Project Management (workspace `board`, 3 стейкхолдера), IT (workspace `ide`).
- **Демо-режим:** 2–3 заранее сгенерированных кейса, которые подхватываются, если LLM API упал на питче.
- **UI на английском** (рынок США). Код, коммиты, комментарии — на английском.

---

## 8. Архитектура: модульный монолит

Один Next.js проект, один деплой (Vercel) + Supabase. Внутри — жёсткие модули с публичным API. Не микросервисы (нет времени), но без каши: любой модуль потом выносится в сервис без переписывания.

### Принципы
1. **Contract-first.** `/src/contracts` пишем в первый час втроём. Дальше меняем только по договорённости.
2. **Event log — источник правды.** Каждое действие → запись в `events`. Состояние персонажа, разбор, replay, «переиграть с хода N» — производные от лога.
3. **Профессии — конфиги, а не код.** Новая сфера = новая папка в `/src/field-packs`.
4. **Все вызовы ИИ — через `modules/llm`.** Никто не импортирует SDK провайдера в фичах.
5. **Скрытое не покидает сервер.** `personas.hidden`, `rubrics`, `innerThought` до сдачи — только на сервере (service role). Иначе DevTools = ответы = мёртвый сертификат.
6. **Права — через `billing.can()`.** Нигде нет `if (user.subStatus === 'pro')`.
7. **Публичные данные — только через проекции** `credentials.toPublicLimited()` / `toPublicFull()`.
8. **Модуль импортирует другой модуль только через его `index.ts`.** (ESLint `no-restricted-imports` это проверяет.)

### Стек
Next.js (App Router, latest stable, TypeScript strict) · Supabase (Postgres, Auth magic link, Realtime, RLS) · zod · LLM-провайдер через env (`LLM_PROVIDER`, `LLM_MODEL`) · Stripe (test mode) · Tailwind + shadcn/ui · Vitest + Testing Library · Playwright · MSW · GitHub Actions (lint, typecheck, test).

### Модули

| Модуль | Ответственность | Публичный API (index.ts) |
|---|---|---|
| `identity` | профиль, разбор анкеты | `getProfile`, `upsertProfileFromIntake` |
| `catalog` | field packs: сферы, архетипы, навыки | `getPack`, `pickArchetype`, `listFields` |
| `case-engine` | генерация кейса, персонажей, рубрики, поворотов | `generateCase`, `getCaseForUser` |
| `simulation` | живой кейс: ход → персонаж → режиссёр → copilot | `startCase`, `handleMove`, `askCopilot`, `submitCase` |
| `evaluation` | метки ходов, accuracy, AI-dependency, ловушки | `evaluateCase`, `getReview` |
| `credentials` | сертификаты, публичные проекции | `issueCertificate`, `toPublicLimited`, `toPublicFull`, `getBySlug` |
| `progress` | XP, уровни, серия, daily/weekly | `award`, `getSkillPath`, `getTodayCases` |
| `billing` | Stripe, права | `can(user, action)`, `createCheckout`, `handleWebhook` |
| `llm` | шлюз, реестр промптов, валидация, ретраи, логи | `llm.run(promptId, input, schema)` |
| `events` | append-only лог | `append`, `listByCase` |

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
/supabase/migrations
/tests/e2e              Playwright
```

**Владение папками (чтобы не было конфликтов при мерже):**
- backend: `/src/contracts` (совместно), `/src/modules`, `/src/field-packs`, `/src/prompts`, `/src/app/api`, `/supabase`
- frontend: `/src/app` (кроме `api`), `/src/workspaces`, `/src/mocks`, `/tests/e2e`
- design: `/src/ui`, `/src/screens`, `tailwind`/`globals.css` токены

**Граница design ↔ frontend:** design делает **презентационные** компоненты (только props, никаких fetch/хуков данных), типы props — из `/src/contracts`. Frontend делает **контейнеры** в `/src/app`, которые грузят данные и передают в экраны.

---

## 9. Модель данных (Postgres / Supabase)

```sql
users           -- supabase auth.users
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
                 content text, meta jsonb, client_msg_id text unique null, created_at)
move_reviews    (event_id pk, case_id, label: brilliant|best|good|inaccuracy|mistake|blunder,
                 why text, better_move text, inner_thought text, rubric_ref text null, trust_after int)
evaluations     (case_id pk, accuracy int, label_counts jsonb, ai_dependency int, trap_caught bool,
                 outcome text, top_move_ids uuid[], summary text, skills jsonb)
certificates    (id, case_id, user_id, slug unique, skill text, issued_at)
skill_progress  (user_id, skill, level int, xp int, primary key(user_id, skill))
streaks         (user_id pk, current int, best int, last_practice_date date)
llm_calls       (id, case_id null, prompt_id, model, input jsonb, output jsonb, ok bool,
                 latency_ms int, tokens_in int, tokens_out int, created_at)
```
**RLS:** пользователь читает свои `profiles`, `cases`, `events`, `evaluations`, `skill_progress`, `streaks`, `persona_state` (только trust/outcome через API). `personas.hidden`, `rubrics`, `llm_calls` — **без клиентского доступа вообще**. Всё отдаём через API-роуты, которые режут скрытое.

## 10. Контракты (эскиз; финализируем в первый час)

```ts
// /src/contracts/case.ts
export const Field = z.enum(['sales', 'project_management', 'software']);
export const Level = z.enum(['beginner', 'intermediate', 'advanced']);
export const CaseType = z.enum(['onboarding', 'daily', 'weekly']);
export const WorkspaceType = z.enum(['chat', 'board', 'ide']);

export const CaseDoc = z.object({
  id: z.string(), kind: z.enum(['email_thread', 'crm_record', 'slack_thread', 'table', 'note']),
  title: z.string(), content: z.unknown(), // форма зависит от kind, см. /src/contracts/docs.ts
  arrivesAtTurn: z.number().int().nullable(), // null = доступен сразу
});

export const PersonaPublic = z.object({
  id: z.string(), name: z.string(), role: z.string(), company: z.string(),
  location: z.string(), avatarSeed: z.string(), context: z.string(),
});
export const PersonaHidden = z.object({
  personality: z.string(), style: z.string(), realMotive: z.string(),
  constraints: z.array(z.string()), triggersOpen: z.array(z.string()),
  triggersClose: z.array(z.string()), knows: z.array(z.string()),
  willNeverSayFirst: z.array(z.string()), patience: z.number().int().min(3).max(10),
  initialTrust: z.number().int().min(0).max(100),
});

export const CaseBrief = z.object({
  title: z.string(), mission: z.string(), yourRole: z.string(),
  successLooksLike: z.string(), timeLimitSec: z.number().int(),
});

export const CaseView = z.object({ // что получает клиент
  id: z.string().uuid(), type: CaseType, workspace: WorkspaceType, status: z.string(),
  field: Field, subfield: z.string(), brief: CaseBrief,
  personas: z.array(PersonaPublic), docs: z.array(CaseDoc), // только уже доступные docs
});

// /src/contracts/rubric.ts — только сервер
export const Rubric = z.object({
  keyMoments: z.array(z.object({ id: z.string(), description: z.string(), idealMove: z.string(), why: z.string() })),
  traps: z.array(z.object({ id: z.string(), injectAtCopilotCall: z.number().int(), errorToInject: z.string(), howToCatch: z.string() })),
  twists: z.array(z.object({ id: z.string(), trigger: z.union([
    z.object({ afterUserTurn: z.number().int() }),
    z.object({ trustBelow: z.number().int() }),
  ]), event: z.object({ kind: z.enum(['email', 'slack', 'persona_message']), from: z.string(), content: z.string() }) })),
  successCriteria: z.array(z.string()),
});

// /src/contracts/events.ts
export const Event = z.object({
  id: z.string().uuid(), caseId: z.string().uuid(), seq: z.number().int(),
  actor: z.enum(['user', 'persona', 'copilot', 'system']), personaId: z.string().nullable(),
  type: z.enum(['message', 'copilot_prompt', 'copilot_reply', 'doc_open', 'twist', 'submit']),
  content: z.string(), meta: z.record(z.unknown()), createdAt: z.string(),
});

// /src/contracts/evaluation.ts
export const MoveLabel = z.enum(['brilliant', 'best', 'good', 'inaccuracy', 'mistake', 'blunder']);
export const MoveReview = z.object({
  eventId: z.string().uuid(), seq: z.number().int(), userText: z.string(),
  label: MoveLabel, why: z.string(), betterMove: z.string().nullable(),
  innerThought: z.string(), trustAfter: z.number().int(),
});
export const Evaluation = z.object({
  caseId: z.string().uuid(), accuracy: z.number().int().min(0).max(100),
  labelCounts: z.record(MoveLabel, z.number().int()),
  aiDependency: z.number().int().min(0).max(100), trapCaught: z.boolean(),
  outcome: z.enum(['won', 'lost', 'left', 'incomplete']),
  topMoves: z.array(MoveReview).max(3), summary: z.string(),
  skills: z.array(z.object({ skill: z.string(), score: z.number().int() })),
  trustCurve: z.array(z.object({ seq: z.number().int(), trust: z.number().int() })),
});

// /src/contracts/certificate.ts
export const CertificateLimited = z.object({
  slug: z.string(), holderName: z.string(), skill: z.string(), field: Field, level: Level,
  issuedAt: z.string(), caseTitle: z.string(), accuracy: z.number().int(),
  outcome: z.string(), headline: z.string(), // короткая характеристика
  verified: z.literal(true),
});
export const CertificateFull = CertificateLimited.extend({
  evaluation: Evaluation, moves: z.array(MoveReview), personas: z.array(PersonaPublic),
  transcript: z.array(Event.pick({ seq: true, actor: true, type: true, content: true, createdAt: true })),
});

// /src/contracts/progress.ts
export const SkillPath = z.object({
  skills: z.array(z.object({ skill: z.string(), level: z.number().int(), xp: z.number().int(), nextLevelXp: z.number().int() })),
  streak: z.object({ current: z.number().int(), best: z.number().int() }),
  today: z.object({ daily: CaseView.nullable(), weekly: CaseView.nullable() }),
  history: z.array(z.object({ caseId: z.string(), title: z.string(), accuracy: z.number().int(), date: z.string() })),
});
```

## 11. API (Next.js route handlers)

| Метод | Путь | Тело → ответ | Права |
|---|---|---|---|
| POST | `/api/intake` | `{text, field, level}` → `Profile` | auth |
| POST | `/api/cases` | `{type}` → `{caseId, status:'generating'}` | auth, `can('start_case', type)` |
| GET | `/api/cases/:id` | → `CaseView` (+ status) | owner |
| POST | `/api/cases/:id/start` | → `{startedAt}` | owner |
| POST | `/api/cases/:id/move` | `{clientMsgId, personaId, text}` → `{events: Event[], trust, outcome}` | owner |
| POST | `/api/cases/:id/copilot` | `{clientMsgId, text}` → `{event: Event}` | owner |
| POST | `/api/cases/:id/submit` | → `{status:'evaluating'}` | owner |
| GET | `/api/cases/:id/review` | → `{evaluation, moves}` | owner, после evaluated |
| GET | `/api/certificates/:slug` | → `CertificateLimited \| CertificateFull` | public; full если владелец Pro |
| GET | `/api/me/path` | → `SkillPath` | auth |
| POST | `/api/billing/checkout` | → `{url}` | auth |
| POST | `/api/billing/webhook` | Stripe | stripe signature |

Ошибки: `{error: {code, message}}`, коды `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | PAYWALL | RATE_LIMIT | LLM_FAILED | VALIDATION`. Реалтайм: клиент подписывается на `events` своего кейса через Supabase Realtime (фильтр `case_id`), а `persona_state.trust/outcome` приходят в ответе `move`.

## 12. ИИ-пайплайн (7 промптов)

| promptId | Вход | Выход (zod) | Правила |
|---|---|---|---|
| `intake.parse` | свободный текст + выбранные field/level | `{subfield, years, pains[], goals[]}` | не выдумывать; пусто → дефолты |
| `case.generate` | профиль, архетип, seed, история прошлых кейсов юзера | `{brief, personas[{public,hidden}], docs[]}` | реалистичные компании/города/суммы США; не повторять имена/компании прошлых кейсов |
| `case.rubric` | сгенерированный кейс | `Rubric` | 4–7 keyMoments, 1 trap, 0–2 twists (onboarding: 0–1) |
| `persona.reply` | hidden, state, история диалога, доступные docs | `{reply, typingMs, trustDelta, patienceDelta, revealed[], outcome, innerThought}` | **не видит рубрику**; правила речи из §13 |
| `copilot.reply` | история, docs, запрос юзера, `inject?: errorToInject` | `{reply}` | полезный, деловой; если inject — вплести ошибку правдоподобно и не подсвечивать |
| `director.twist` | twist из рубрики + контекст | `{event}` | только оформление; **когда** срабатывает — решает детерминированный код |
| `eval.moves` | полный лог, рубрика, trust curve, trap info | `{moves[{eventId,label,why,betterMove}], summary, skills[]}` | каждая метка с конкретным «почему», ссылкой на keyMoment если есть |

Метрики, которые **считает код, а не LLM**:
- `aiDependency` = среднее по сообщениям юзера персонажу максимального сходства (нормализованный LCS / token Jaccard) с любым предыдущим `copilot_reply`, ×100.
- `trapCaught` = юзер не перенёс ошибку в сообщение персонажу **и/или** явно оспорил её в copilot (проверка: детерминированный поиск ключевых значений ошибки + подтверждение LLM в `eval.moves`).
- `accuracy` = взвешенное среднее по ходам юзера: brilliant 100, best 100, good 80, inaccuracy 50, mistake 20, blunder 0.
- `trustCurve` = из `persona_state` после каждого хода (храним в `move_reviews.trust_after`).

Каждый вызов: валидация zod → до 2 ретраев с текстом ошибки валидации → запись в `llm_calls`. У кейса храним `model`, `prompt_version`, `seed`.

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

| label | Глиф | Смысл (Sales) |
|---|---|---|
| brilliant | `!!` | нашёл скрытый мотив, поймал ошибку copilot, неочевидный сильный ход |
| best | `!` | совпадает с идеальным ходом в keyMoment |
| good | — | разумно, но не оптимально |
| inaccuracy | `?!` | правильно по смыслу, но затянул/упустил возможность |
| mistake | `?` | неверное решение, доверие упало |
| blunder | `??` | грубая ошибка: давление, игнор, принял ложь copilot, клиент ушёл |

## 15. Нефункциональное
- Генерация кейса асинхронная (20–40 с): `status: generating → ready`, клиент поллит/слушает realtime и показывает экран подготовки.
- Онбординг-кейсы для каждой подсферы Sales — пре-генерируем и кешируем пул (быстрый первый опыт).
- Демо-режим: `DEMO_MODE=true` или ошибка LLM → подставить seed-кейс из `/src/field-packs/sales/demo/*.json`.
- Идемпотентность ходов по `clientMsgId`.
- Rate limit: 30 ходов/мин на кейс, 10 генераций/час на юзера.
- Секреты только в env; `.env.example` в репо.
- Логи: каждый LLM-вызов в `llm_calls`; страница `/admin/llm` (только для нас) — опционально.

## 16. Тестирование и Definition of Done

**DoD для любой задачи:** типы без `any`, линт и typecheck зелёные, тесты на новую логику, нет утечки скрытых полей, работает на задеплоенном превью.

- **Unit (Vitest):** каждый модуль; LLM мокается фикстурами через `llm` шлюз.
- **Контрактные:** zod-схемы ↔ фикстуры в `/src/mocks` (фикстуры обязаны проходить схемы).
- **Golden-тесты оценщика:** 3 вручную написанных транскрипта (сильный, средний, «списывальщик») → ожидаемые диапазоны accuracy, aiDependency, trapCaught.
- **Security-тест:** ответы `GET /api/cases/:id`, `/move`, `/certificates/:slug` не содержат полей `hidden`, `rubric`, `realMotive`, `innerThought` (до сдачи).
- **E2E (Playwright):** онбординг → кейс → 3 хода → сдача → разбор → сертификат; пейвол на full; демо-режим.
- **A11y:** axe в Playwright на ключевых экранах.
- **CI:** GitHub Actions — `lint`, `typecheck`, `test`, `e2e` (e2e на моках/демо-режиме, без реального LLM).

## 17. Команда, тайминг, git

| Часы | Backend (ChatGPT #1) | Frontend (ChatGPT #2) | Design (Claude) |
|---|---|---|---|
| 0–1 | **вместе:** контракты, API, миграции | **вместе** | **вместе** |
| 1–4 | БД, RLS, `llm`, `events`, `catalog` + sales pack | скелет, auth, MSW-моки, роутинг | токены, дизайн-система `/src/ui` |
| 4–9 | `case-engine` + `identity` | онбординг, экран подготовки, бриф | лендинг, онбординг, workspace |
| 9–14 | `simulation` (persona, director, copilot) | workspace chat (плагин) | разбор, сертификат, путь, пейвол |
| 14–18 | `evaluation`, `credentials`, `progress` | разбор, сертификат, путь | макеты PM/IT, состояния, полировка |
| 18–21 | `billing`, демо-режим, интеграция | переключение моков на API, Stripe | помощь в интеграции, визуальные правки |
| 21–24 | багфикс, golden-тесты | e2e, полировка | скриншоты/видео для сабмишена |

**Git:** `main` защищён; ветки `be/*`, `fe/*`, `ds/*`; мерж в `main` каждые ~4 часа через PR с зелёным CI; изменения в `/src/contracts` — только с согласия всех троих. Conventional commits.

## 18. Глоссарий
case — кейс · persona — персонаж · move — ход (сообщение юзера персонажу; ходы в copilot учитываются в aiDependency) · rubric — скрытый ключ оценки · twist — поворот сюжета · trap — ловушка copilot · review — разбор · trust curve — кривая доверия · field pack — конфиг профессии · workspace — рабочее пространство · limited/full certificate — урезанный/полный сертификат.
