# DESIGN_HANDOFF.md — что готово в дизайне и что осталось сделать

> Читать вместе с CONTEXT.md (продукт, контракты) и PROMPT_DESIGN.md (исходное ТЗ на дизайн).
> Этот файл — состояние на момент передачи и спецификация оставшихся экранов, чтобы их мог доделать любой из команды.

## 1. Как запустить и посмотреть

```bash
npm install
npm run dev        # http://localhost:3000/design — галерея компонентов
npm run lint && npm run typecheck && npm test
```

- `/design` — все компоненты дизайн-системы на фикстурах, есть переключатель тёмной темы.
- `/design/review` — экран разбора, сверху переключатель состояний.
- `/design/landing` — лендинг.

Стек, который реально установлен: Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind 4, shadcn (`radix-nova`, утилита `cn` из пакета `cn`), zod 4, motion, Vitest + Testing Library. Перед тем как писать код под Next, загляните в `AGENTS.md`: версия новая, часть привычных API изменилась.

MCP-серверы для агентов описаны в `.mcp.json` (shadcn, Magic UI, 21st.dev). Для 21st.dev нужен ключ в переменной окружения `API_KEY_21ST`.

## 2. Что готово

| Что | Где |
|---|---|
| Токены: цвета, метки ходов, радиусы, типографика, тени, движение, тёмная тема | `src/app/globals.css` |
| Шрифты: Geist, Geist Mono, Instrument Serif | `src/ui/fonts.ts` |
| Примитивы shadcn и Magic UI | `src/ui/primitives/*` |
| Продуктовые компоненты (20 шт.) | `src/ui/*`, экспорт из `src/ui/index.ts` |
| Экран Review, 4 состояния | `src/screens/review` |
| Лендинг | `src/screens/landing` |
| Галерея и фикстуры одного цельного кейса | `src/app/design/*` |
| Контракты по CONTEXT §10 | `src/contracts/*` |
| Тесты: 35 штук | `src/ui/__tests__`, `src/screens/review/__tests__`, `src/app/design/fixtures.test.ts` |

Компоненты в `src/ui`: `MoveLabelBadge`, `LabelCounts`, `AccuracyStat`, `TrustCurveChart`, `MoveTimeline`, `MoveDetail`, `OutcomeBadge`, `Meter`, `PersonaCard`, `PersonaAvatar`, `DocViewer`, `ChatMessage`, `TypingIndicator`, `TwistNotice`, `CaseTimer`, `CertificateCard`, `SkillProgress`, `PracticeRecord`, `PricingTable`, `StepChecklist`, `Reveal`.

### Решения, которые надо подтвердить втроём
1. **`src/contracts/docs.ts` — предложение дизайна.** CONTEXT ссылается на файл, но формы содержимого документов не описывает. Сейчас там: `email_thread {subject, messages[{from,to,sentAt,body}]}`, `crm_record {account, fields[{label,value}], activity[{at,text}]}`, `slack_thread {channel, messages[{author,sentAt,text}]}`, `table {caption, columns[], rows[][]}`, `note {body}`. Под эти формы написан `DocViewer`, и промпт `case.generate` должен выдавать именно их. Если содержимое не подходит под форму, `DocViewer` не падает, а показывает сырой текст.
2. **`Event.meta` записан как `z.record(z.string(), z.unknown())`** — в zod 4 запись из эскиза не компилируется.
3. **В FAQ лендинга прямо сказано, что copilot один раз ошибается намеренно.** Если ловушку держим в секрете, ответ надо переписать.
4. **Название продукта** везде приходит пропсом `productName` / `issuer`, по умолчанию `[PRODUCT]`.

## 3. Правила дизайн-системы (обязательны для новых экранов)

**Характер:** строгая профессиональная платформа, не игра. Ориентиры — Stripe, Linear, Mercury. Никаких эмодзи, конфетти, градиентов, маскотов, «пилюль».

- **Цвета только через токены.** Классы: `bg-background`, `bg-surface`, `bg-card`, `bg-muted`, `border-border`, `border-border-strong`, `text-foreground`, `text-muted-foreground`, акцент `bg-ink` / `text-ink` / `bg-ink-soft` / `border-ink-border`, метки `text-label-{brilliant|best|good|inaccuracy|mistake|blunder}` и `bg-label-*-soft`. Hex и `rgb()` в компонентах запрещены.
- **Один акцент — ink navy.** Только основные кнопки, активные состояния, ссылки, печать сертификата. Не использовать как фон секций.
- **Типографика.** Интерфейс — `font-sans`. Числа, ID, таймеры, даты в таблицах — `font-mono tabular-nums`. `font-serif` — только заголовки лендинга и сертификата. Размеры: `text-xs/sm/base/xl/2xl` (12/14/16/20/24) и `text-display-sm/display/display-lg` (32/48/64).
- **Форма.** Радиусы `rounded-md/lg/xl` (6/8/10px). Карточка = `rounded-xl border bg-card`, без тени. Тень `shadow-raised` — только для всплывающих слоёв и превью в hero.
- **Мелкие заголовки секций:** `font-mono text-xs tracking-wider uppercase text-muted-foreground`.
- **Иконки:** Lucide, `strokeWidth={1.5}`, всегда `aria-hidden`, только по смыслу.
- **Движение:** 150–250 мс, `ease-out`. Появление секций — `Reveal` (только ниже первого экрана). Числа — `AccuracyStat animate`. `prefers-reduced-motion` уже учтён глобально и в компонентах.
- **Метка хода никогда не передаётся только цветом** — всегда `MoveLabelBadge` с глифом.
- **Доступность:** контраст AA, настоящие `<button>` / `<a>`, видимый фокус (`focus-visible:ring-2 focus-visible:ring-ring`), цели нажатия от 44px на мобильном, без горизонтального скролла на 375px.
- **Тон текстов:** английский, деловой, короткие фразы, без восклицательных знаков, точные числа. Имена и компании реалистичные (Dana Whitfield, Brightline Logistics, Columbus OH).

**Граница с frontend:** экран в `src/screens/<name>/` получает только props (типы из `@/contracts`) и колбэки. Никаких `fetch`, хуков данных, `useRouter`. Локальное UI-состояние (`useState`) допустимо. Ссылки — через `next/link` с href из props. Каждый экран добавляется в галерею как `src/app/design/<name>/page.tsx` с переключателем состояний (образец — `src/app/design/review/review-gallery.tsx`) и ссылкой из `src/app/design/gallery.tsx`.

## 4. Оставшиеся экраны

Порядок — по важности для демо. Для каждого: файл, props, раскладка, состояния, тексты.

### 4.1 Workspace — chat (главный рабочий экран)
`src/screens/workspace/workspace-chat-screen.tsx`

```ts
type WorkspaceChatScreenProps = {
  caseView: CaseView;                 // brief, personas, docs
  events: Event[];                    // лог: message, twist, copilot_*
  remainingSec: number;
  status: "in_progress" | "time_up" | "persona_left" | "submitting";
  personaTyping: boolean;
  copilotPending: boolean;
  newDocIds: string[];                // документы, пришедшие твистом и ещё не открытые
  activeDocId: string | null;
  onSelectDoc(docId: string): void;
  onSend(text: string): void;         // ход персонажу
  onAskCopilot(text: string): void;
  onSubmit(): void;
};
```

- **Шапка** (`h-14 border-b`): название кейса, `PersonaCard variant="compact"`, справа `CaseTimer` и кнопка `Submit case`.
- **Три колонки** на `lg`: `grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,20rem)]`, каждая со своим скроллом (`ScrollArea`), высота `calc(100dvh - шапка)`.
  - **Слева — документы.** Вкладки (`Tabs`) по `caseView.docs`, у новых — бейдж `New`. Содержимое — `DocViewer`.
  - **Центр — диалог.** `events` с `type: "message"` → `ChatMessage` (actor `user` / `persona`), `type: "twist"` → `TwistNotice` с `onOpen`, при `personaTyping` → `TypingIndicator`. Внизу поле ввода: `textarea` на 2–4 строки, Enter отправляет, Shift+Enter переносит строку, кнопка `Send`. Вариантов ответа нет.
  - **Справа — Copilot.** Заголовок `Copilot` и постоянная строка `Copilot usage is part of your evaluation.` Сообщения `copilot_prompt` / `copilot_reply` → `ChatMessage actor="copilot"`. Своё поле ввода. Кнопки «вставить в ответ» не делать: текст переносят вручную, это часть оценки.
- **< 1024px:** документы и Copilot уезжают в `Sheet` (слева и справа), в шапке две кнопки-иконки для их открытия; центр на всю ширину.
- **Состояния:**
  - `in_progress` — обычное.
  - твист пришёл — `TwistNotice` в ленте и бейдж `New` на вкладке документа.
  - `time_up` — таймер в состоянии expired, ввод заблокирован, над полем баннер `Time is up. Submit your case to see the review.`
  - `persona_left` — системная строка `Dana left the conversation.`, баннер `The client has left. Submit to see what happened.`, ввод заблокирован.
  - `submitting` — кнопка `Submitting`, ввод заблокирован.
- Тёмная тема: класс `dark` на корневом элементе экрана, токены уже есть (опционально).

### 4.2 Certificate `/c/[slug]`
`src/screens/certificate/certificate-screen.tsx`

```ts
type CertificateScreenProps = {
  certificate: CertificateLimited | CertificateFull;
  productName?: string;
  verifyUrl: string;        // канонический адрес этой страницы
  tryHref: string;          // CTA «Try a case like this»
  viewer: "public" | "owner";
  onShare?(): void;         // только для owner
};
```

- Узкая колонка `max-w-4xl`, фон `bg-surface`, сверху минимальная шапка с названием продукта.
- Основное — готовый `CertificateCard` с `titleAs="h1"`. Для full он сам добавляет 3 ключевых хода и кривую доверия.
- Под карточкой блок **What this proves** — три пункта (тексты есть в лендинге, `EMPLOYER_POINTS`).
- **Limited:** карточка + блок выше + CTA `Try a case like this`.
- **Full:** кнопка `View full review` раскрывает на этой же странице `MoveTimeline` + `MoveDetail` (как в Review) и транскрипт (`certificate.transcript` → `ChatMessage`).
- Внизу всегда CTA `Try a case like this — free, 8 minutes`. Это вирусная петля, не убирать.
- **OG-изображение 1200×630:** `src/app/c/[slug]/opengraph-image.tsx` (`next/og`). Белый фон, слева serif `Certificate of demonstrated skill`, имя, навык и уровень; справа крупно Accuracy (mono) и исход; внизу ID и название продукта. Цвета взять из токенов (значения `--ink`, `--foreground`, `--border`).

### 4.3 Onboarding
`src/screens/onboarding/onboarding-screen.tsx`

```ts
type OnboardingScreenProps = {
  step: 1 | 2 | 3;
  field: Field | null; level: Level | null; intakeText: string;
  parsed: { subfield: string; years: number | null; pains: string[] } | null; // шаг 3
  pending: boolean;
  onFieldChange(f: Field): void; onLevelChange(l: Level): void;
  onIntakeChange(text: string): void;
  onBack(): void; onNext(): void; onEditParsed(): void; onConfirm(): void;
};
```

- Одна колонка `max-w-xl`, сверху индикатор `Step 1 of 3` (mono) и тонкая полоска прогресса.
- **Шаг 1.** `Choose your field` — три карточки-радио: Sales (активна), Project management и Software с пометкой `Coming soon` и `disabled`. Ниже `Your level` — три радио: Beginner, Intermediate, Advanced.
- **Шаг 2.** `Tell us about your work` — `textarea` на 5 строк. Плейсхолдер: `I'm an SDR at a logistics software company, 3 years in. I book meetings fine but lose deals when price comes up.` Под полем: `Optional. The more specific you are, the closer the case will be to your real work.`
- **Шаг 3.** `We understood:` — строка-резюме `Sales · SDR · 3 years · Struggles with price objections`, кнопки `Edit` и `Looks right, prepare my case`.
- Состояния: `pending` (кнопка заблокирована, текст `Reading your answer`), пустой текст на шаге 2 допустим.

### 4.4 Preparing your case
`src/screens/preparing/preparing-screen.tsx` — props: `steps: ChecklistStep[]`, `failed?: boolean`, `onRetry?()`.

- По центру карточка `max-w-md`: заголовок `Preparing your case`, подзаголовок `This takes 20 to 40 seconds.`, внутри `StepChecklist`. Образец шагов — `preparingSteps` в фикстурах.
- Никакого спиннера на весь экран.
- Состояние ошибки: `We could not prepare this case.` + кнопка `Try again`.

### 4.5 Case brief
`src/screens/brief/case-brief-screen.tsx` — props: `caseView: CaseView`, `onStart()`, `starting: boolean`.

- Выглядит как служебная записка: `max-w-3xl`, сверху mono-строка `Case brief · Daily · Sales`, заголовок `brief.title`.
- Секции с мелкими заголовками: **Mission** (`brief.mission`), **Your role** (`brief.yourRole`), **Success looks like** (`brief.successLooksLike`).
- Справа или ниже: `PersonaCard` собеседника, время (`formatClock(brief.timeLimitSec)` и слово `minutes`), список документов (иконка по `kind` + `title`).
- Кнопка `Start case`. Под ней: `The timer starts when you press Start.`

### 4.6 Dashboard
`src/screens/dashboard/dashboard-screen.tsx` — props: `path: SkillPath`, `plan: "free" | "pro"`, `onStartCase(type)`, `onUpgrade()`.

- Сетка из карточек:
  - **Today's case** — подсфера, время `10 min`, кнопка `Start`. Если `today.daily === null`: `You have done today's case. Next one tomorrow.`
  - **Weekly case** — для Pro кнопка `Start`, `30–40 min`. Для Free — иконка замка, текст `Included in Pro` и ссылка `See plans`. Апселл сдержанный, без баннеров.
  - **Practice record** — `PracticeRecord`.
  - **Recent results** — таблица из `path.history`: название, дата, Accuracy (mono, по правому краю).
- Пустое состояние (история пуста): `No cases yet. Your first one takes 8 minutes.`

### 4.7 Skill path `/path`
`src/screens/path/skill-path-screen.tsx` — props: `path: SkillPath`, `practiceDays?`, `onOpenCase(caseId)`.

- Слева список навыков — `SkillProgress` на каждый (`discovery`, `objection_handling`, `value_articulation`, `critical_ai_use`, `closing`).
- Справа `PracticeRecord` и блок **Today** (daily / weekly, как в Dashboard).
- Ниже история кейсов — таблица (`Table` из примитивов): Case, Date, Accuracy. Строка кликабельна.
- Формулировки взрослые: `Level 3 · Objection handling`, `12 days in a row`. Никаких огоньков и XP-салютов.

### 4.8 Pricing / Paywall
- **Страница:** `src/screens/pricing/pricing-screen.tsx` — заголовок как на лендинге (`Start free. Pay when the proof matters.`) + `PricingTable` + FAQ.
- **Модалка:** `src/screens/pricing/paywall-dialog.tsx` на `Dialog` — props: `open`, `onOpenChange`, `reason: "weekly_case" | "full_certificate" | "daily_limit"`, `billing`, `onBillingChange`, `onUpgrade()`, `pending`.
  - Заголовок зависит от `reason`: `The weekly case is part of Pro` / `Show the full review on your certificate` / `You have used this week's free case`.
  - Внутри только колонка Pro из `PricingTable` и кнопка `Upgrade to Pro`. Акцент на `Full verifiable review` и `Unlimited daily cases`.

### 4.9 Login
`src/screens/login/login-screen.tsx` — props: `status: "idle" | "sending" | "sent" | "error"`, `email`, `onEmailChange`, `onSubmit`.

- По центру карточка `max-w-sm`: название продукта, `Sign in with a link`, поле email с `<label>`, кнопка `Send link`.
- `sent`: `Check your inbox. The link works for 10 minutes.` (срок уточнить у backend). `error`: `We could not send the link. Try again.`

### 4.10 Макеты для питча (статика, без логики)
- `src/screens/mockups/workspace-board-screen.tsx` — Project management. Три стейкхолдера с конфликтующими целями (три `PersonaCard compact` с бейджем цели), по центру канбан из трёх колонок (`Now / Next / Later`) с карточками задач, справа чат с выбранным стейкхолдером. Шапка та же, что в chat-workspace.
- `src/screens/mockups/workspace-ide-screen.tsx` — Software. Слева дерево файлов, по центру редактор (моноширинный блок с номерами строк), снизу терминал, справа Copilot. Подсветку синтаксиса не делать: достаточно `font-mono` и приглушённых комментариев.
- Данные — константы внутри файлов, пометка `Coming soon` в шапке.

### 4.11 Системные
- `src/app/not-found.tsx` — `This page does not exist.` + ссылка на главную.
- `src/app/error.tsx` — `Something went wrong on our side.` + `Try again`.
- Тосты — `Sonner` из примитивов (`Link copied`, `Case submitted`). `<Toaster />` добавить в `src/app/layout.tsx`.
- Скелетоны — по образцу состояния `analyzing` в Review: те же карточки, внутри `Skeleton`.
- Пустые состояния — одна строка текста и одно действие, без иллюстраций.

## 5. Чек-лист перед мержем экрана
- [ ] Только props, типы из `@/contracts`, нет `fetch` / `useRouter`.
- [ ] Нет hex/rgb вне `globals.css`, нет эмодзи.
- [ ] Все состояния из спецификации есть в галерее `/design/<name>`.
- [ ] Проверено на 375px и 1280px, нет горизонтального скролла.
- [ ] Клавиатура: всё достижимо через Tab, фокус виден.
- [ ] `npm run lint && npm run typecheck && npm test` зелёные; на новую логику есть тест.
