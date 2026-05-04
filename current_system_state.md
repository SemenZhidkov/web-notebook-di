# current_system_state.md

Фактическое состояние проекта после выполнения P0-доработок из backlog. Документ описывает только то, что найдено в проекте, без сравнения с внешней идеальной методологией.

## 1. Назначение системы

Система сейчас является локальным frontend-блокнотом менеджера по ипотечному звонку. Это не полноценная ипотечная АБС/CRM и не backend-сервис: данные хранятся в браузере через `localStorage`, а вся бизнес-логика находится в одном статическом приложении. Источник: `app/app.js`, `app/index.html`.

| Аспект | Фактическое состояние | Статус | Источник |
| :--- | :--- | :--- | :--- |
| Тип продукта | Интерактивный веб-блокнот менеджера по ипотечному звонку. | implemented | `app/app.js`, `app/index.html` |
| Целевая роль | Менеджер, который ведет карточки звонков, pre-check, документы, итог и follow-up. | implemented | `renderBrandHeader`, `renderManagerProfile`, `renderJournalOutcomeSignals` в `app/app.js` |
| Основная задача | Зафиксировать цель, программу, pre-check, поля 1-го/2-го звонка, документы, сигналы, итог звонка и экспорт/импорт сессии. | implemented | `fieldCatalog`, `precheckSections`, `nodes`, `documentSections`, `buildSessionBackup` в `app/app.js` |
| Полноценная ипотечная система | Не найдена: нет backend, ролей, внешних API, подписания, реального APICS, реального календаря. | not_found | `app/app.js`, структура проекта |
| Текущая версия факта | `APP_SCHEMA_VERSION = "0.0.1-p0-completion"`, `CURRENT_JOURNAL_SCHEMA_VERSION = 2`. | implemented | `app/app.js:3519` |

## 2. Источники анализа

| Источник | Что содержит | Статус источника |
| :--- | :--- | :--- |
| `app/app.js` | Главная фактическая реализация: правила, поля, UI-render, state, localStorage, import/export, документы, сигналы. | source_of_truth |
| `app/index.html` | Контейнеры приложения и подключение `app.js`/`styles.css`. | source_of_truth |
| `app/styles.css` | Визуальные стили блокнота, drawer, modal, календаря, документов. | source_of_truth_for_ui |
| `docs/testing/methodology_rule_test_matrix.md` | Ручная regression matrix: 77 тестов, 76 уникальных ruleId, все ruleId найдены в `app/app.js`. | implemented |
| `docs/testing/methodology_manual_regression_checklist.md` | Ручной чек-лист регресса по методологическому слою. | documented_only |
| `current_system_state.md` | Настоящий файл, инвентаризация факта. | documentation |

## 3. Архитектура текущей системы

| Слой | Фактическое состояние | Статус | Источник |
| :--- | :--- | :--- | :--- |
| Runtime | Static HTML/CSS/JS без сборки. | implemented | `app/index.html`, `app/app.js` |
| Business rules | `rulesRegistry` + функции `computePrecheckIssues`, `computeMissingSignals`, `computeValidationSignals`, `computeContradictionSignals`, `computeDealReleaseSignals`. | implemented | `app/app.js:112`, `app/app.js:9891`, `app/app.js:11000` |
| Rule status model | Каждый rule имеет `implementationStatus`; поддерживаются `runtime_implemented`, `registered_only`, `deprecated_or_alias`. В `rulesRegistry` сейчас 243 записи, 224 уникальных `ruleId`: 136 runtime и 107 registered; deprecated alias как активная запись не используется. | implemented | `RULE_IMPLEMENTATION_STATUSES`, `createRule` в `app/app.js:43` |
| Field catalog | 190 полей: 97 `sourceKind=apics`, 70 `method`, 23 `csv_no_id`; 15 полей имеют прямой `apicsId`. | implemented | `fieldCatalog` в `app/app.js:905` |
| Pre-check | 14 секций pre-check, включая APICS identity, common gov, family, IT, DVA, military, build, refi, land, house. | implemented | `precheckSections` в `app/app.js:3280` |
| Documents | 22 секции, 85 документных элементов, 0 элементов без `ruleId`. | implemented | `documentSections` в `app/app.js:6152` |
| Storage | `journalState`, `uiState`, `managerProfile` в `localStorage`; есть миграции схемы журнала. | implemented | `JOURNAL_STORAGE_KEY`, `migrations`, `loadJournalState` в `app/app.js:3516` |
| Backend/API | Не найден. APICS/ЦП/ДБО указаны как источники/метаданные, но реальной интеграции нет. | not_found | `app/app.js` |

## 4. Сущности и данные

| Сущность | Поля / состав | Где хранится | Как используется | Правила | Статус |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Заявка/карточка звонка | `id`, `title`, `callName`, `clientName`, `createdAt`, `updatedAt`, `route`, `form`, `touched`, `participants`, `documents`, `outcome`, `call2Enabled`, `activeStage`. | `journalState.calls[]` | Карточка в журнале, активный workspace. | Нормализация через `normalizeCallRecord`. | implemented |
| Звонок | 1-й звонок и 2-й звонок через `activeStage`, `call2Enabled`; поля разделены `callType`. | Внутри call record | Граф вопросов, output, КД-готовность. | `getSignalStageFromCallType`, `computeDealReleaseSignals`. | implemented |
| Клиент | ФИО, контакт, согласие СОПД, регион, параметры кредита. | `call.form` | APICS identity/pre-check, summary, export. | `APX-001`, `APX-004`, `APX-005`. | implemented |
| Менеджер | `fullName`, `lastExportAt`, `lastImportedAt`, `lastImportedFileName`. | `managerProfile` localStorage | Topbar/profile/export filename/import metadata. | Export требует ФИО менеджера. | implemented |
| Цель кредита | `route.purpose`: ready, build, izhs, izhs_land, refi, pledge. | `call.route` | Pickers, routing matrix, nodes, documents. | `compatibilityMatrix`. | implemented |
| Программа | `route.program`: base, family, it, dv, military, family_military. | `call.route` | Pickers, pre-check, documents, route blockers. | `GOV-*`, `FAM-*`, `IT-*`, `DVA-*`, `MIL-*`, `FMIL-*`. | implemented |
| Объект недвижимости | `propertyType`, адрес, кадастр, площадь, дом, земля, стройка, refi-объект. | `call.form` | Object nodes, pre-check, documents. | `LAND-*`, `HOUSE-*`, `BUILD-*`, `REFI-*`. | implemented |
| Продавец | `sellerType`, ФЛ/ЮЛ поля, `sellerOwnershipDoc`, email/ИНН/телефон. | `call.form` | Object branch and KD readiness. | `BUILD-*`, `KD-006`, document flags. | implemented |
| Подрядчик | `contractorType`, ИП/ЮЛ поля, `contractorContractNumber`, `contractorAccredited`. | `call.form` | ИЖС branch, documents. | `DOC-IZHS-*`, object filters. | implemented |
| Участники сделки | Array participants with role, flags, docs. | `call.participants`, legacy from `form.dealParticipants` | Participants UI and signals. | `PART-001..004`. | implemented |
| Документы | `documents.items[itemId].checked`, flags, filter, drawer state. | `call.documents` | Document drawer, missing signals. | `DOC-*`; all 85 items have ruleId. | implemented |
| Сигналы | Computed, not persisted as lifecycle entities. | Computed from call | Insights panel/export snapshots. | missing/validation/contradiction/info/postDeal. | partial |
| Pre-check | Required pre-check fields and redlines. | Computed from route/form | Gate before opening graph. | `computePrecheckIssues`, `computeMissingSignals`. | implemented |
| Итог звонка | `status`, `confirmedSummary`, `unresolvedSummary`, `riskSummary`, `promisedDocs`, `nextStep`, `followUp`. | `call.outcome` | Outcome block, calendar tasks. | `validateOutcome`, `KD-002`. | implemented |
| Задачи/follow-up | Derived from `outcome.followUp` and promised docs. | Внутри outcome | Calendar drawer: overdue/today/tomorrow/later grouping. | Date/time validation. | implemented |
| Экспорт/импорт | Session backup JSON, CSV export rows. | Generated file/imported file | Backup, restore, merge, CSV. | `EXPORT-001..003`, `STORAGE-001`. | implemented |

## 5. Интерфейс

| Блок UI | Что показывает | Действия менеджера | Что сохраняется | Статус | Источник |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Topbar / profile | ФИО менеджера, export/import status. | Ввести ФИО, импортировать, сменить менеджера. | `managerProfile`. | implemented | `renderManagerProfile`, `renderBrandHeader` |
| Создание звонка | Кнопка создания карточки. | Создать call record. | `journalState.calls[]`. | implemented | `createCallRecord`, handlers в `app/app.js` |
| Журнал карточек | Список звонков, outcome strip, active call. | Выбрать карточку, удалить/экспортировать CSV. | `journalState.activeCallId`, calls. | implemented | `renderJournalOutcomeSignals` |
| Route pickers | Цель кредита и программа. | Выбрать 6 целей и 6 программ. | `call.route`. | implemented | `routeOptions`, `compatibilityMatrix` |
| Summary | Совместимость, готовность, счетчики сигналов. | Readonly. | Не сохраняется, computed. | implemented | `summarizeSignals`, render summary |
| Pre-check | 14 секций с required fields и redlines. | Заполнять поля pre-check. | `call.form`, `call.touched`. | implemented | `precheckSections`, `renderPrecheck` |
| Граф звонка | Узлы 1-го и 2-го звонка по активной цели/программе. | Заполнять поля, открыть 2-й звонок. | `call.form`, `call2Enabled`, `activeStage`. | implemented | `nodes`, `renderGraph` |
| Сигналы | Группы: пропуски, валидации, противоречия, информационные допуски. | Просмотр. Закрытие/ack сигналов не найдено. | Computed, не persisted. | partial | `renderInsights`, `computeAllSignals` |
| Документы | Drawer с 22 секциями и флагами сценария. | Отмечать документы, фильтровать, копировать missing list. | `call.documents`. | implemented | `documentSections`, document handlers |
| Итог звонка | Статус, подтверждено, неясно, риски, обещанные документы, next step, follow-up. | Заполнить итог, добавить promised docs, дату/канал follow-up. | `call.outcome`. | implemented | `createOutcomeState`, outcome render |
| Календарь/задачи | Follow-up задачи из outcome. | Открыть drawer, перейти к карточке, отметить done. | `outcome.followUp.done/doneAt`. | implemented | calendar functions in `app/app.js` |
| Экспорт CSV | Single/all calls CSV. | Скачать CSV. | Файл, localStorage не меняется. | implemented | `buildCallExportRow`, `exportAllCalls` |
| Export/import session | JSON backup, preview, replace, merge. | Скачать backup, выбрать JSON, заменить или добавить звонки. | `journalState`, `managerProfile`, `uiState`. | implemented | `buildSessionBackup`, `renderSessionModal`, `applyImportedSession` |
| Авторизация | Не найдена; только ФИО менеджера. | not_found | localStorage profile only. | not_found | `app/app.js` |

## 6. State-management и хранение

| State | Состав | localStorage key | Статус | Источник |
| :--- | :--- | :--- | :--- | :--- |
| `journalState` | `calls`, `activeCallId`, `schemaVersion`. | `mortgage_call_notebook_v3` | implemented | `loadJournalState`, `persistJournalState` |
| `uiState` | detail/question mode, output state, calendar filters, drawer transient flags. | `mortgage_call_notebook_ui_v1` | implemented | `createUiState`, `loadUiState` |
| `managerProfile` | ФИО менеджера, last export/import metadata. | `mortgage_call_notebook_manager_v1` | implemented | `createManagerProfile` |
| Session state | Нет отдельного backend session; session = localStorage + backup JSON. | localStorage/JSON | partial | `buildSessionBackup` |
| Documents state | `drawerOpen`, `pinned`, `activeView`, `filter`, `search`, `flags`, `items`, `expandedSections`, `copyMessage`. | внутри `call.documents` | implemented | `createDocumentsState` |
| Outcome state | Status, summaries, promised docs, follow-up. | внутри `call.outcome` | implemented | `createOutcomeState` |

Versioning и миграции:

| Механизм | Фактическое состояние | Статус | Источник |
| :--- | :--- | :--- | :--- |
| App schema | `APP_SCHEMA_VERSION = "0.0.1-p0-completion"`. | implemented | `app/app.js:3519` |
| Journal schema | `CURRENT_JOURNAL_SCHEMA_VERSION = 2`. | implemented | `app/app.js:3520` |
| `migrations[]` | 2 миграции: legacy call records, legacy documents/participants. | implemented | `app/app.js:3524` |
| `normalizeLegacyCallRecord()` | Нормализует form, participants, documents, outcome старых карточек. | implemented | `app/app.js:3837` |
| `normalizeLegacyDocuments()` | Нормализует документы, сбрасывает transient UI. | implemented | `app/app.js:3829` |
| `normalizeLegacyParticipants()` | Нормализует массив участников. | implemented | `app/app.js:3833` |
| Конфликт backup version | `SESSION_BACKUP_VERSION` должен совпадать; иначе импорт отклоняется. | implemented | `validateSessionBackup` |
| Конфликт journal schema | Импортируемый journalState мигрируется до текущей схемы. | implemented | `normalizeImportedJournalState` |

## 7. Маршрутизация цель × программа

Источник: `compatibilityMatrix` в `app/app.js:551`; ruleId для блокировок/условных связок выдается через `getRouteCompatibilityRuleId`.

| Цель кредита | Стандарт | Семейная | ИТ | ДВиАИ | Военная | Семейная для военнослужащих |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Готовое жилье | allowed | allowed | allowed | allowed | allowed | allowed |
| Строящееся жилье | allowed | allowed | allowed | allowed | allowed | allowed |
| ИЖС | allowed | allowed | allowed | allowed | allowed | allowed |
| ИЖС + земля | allowed | allowed | conditional | conditional | conditional | conditional |
| Перекредитование | allowed | allowed | blocked | blocked | allowed | allowed |
| Залог имеющейся квартиры | allowed | blocked | blocked | blocked | blocked | blocked |

| Rule ID | Связка | Поведение | Статус |
| :--- | :--- | :--- | :--- |
| `IT-006` | ИТ + refi/pledge | Блокировка маршрута. | implemented |
| `IT-007` | ИТ + ИЖС + земля | Conditional, нужен `routeConditionalApproved`. | implemented |
| `DVA-007` | ДВиАИ + refi | Блокировка маршрута. | implemented |
| `DVA-008` | ДВиАИ + ИЖС + земля | Conditional, нужен `routeConditionalApproved`. | implemented |
| `MIL-007` | Военная + ИЖС + земля | Conditional, нужен `routeConditionalApproved`. | implemented |
| `PLEDGE-001` | Залог + льготные/военные программы | Блокировка всех кроме `base`. | implemented |

## 8. Pre-check и красные границы

Общее правило классификации после P0: пустые обязательные поля создают только `missing`; форматные ошибки создают `validation`; методологические конфликты создают `contradiction`; разрешающее исключение `GOV-003` создает `info`. Источник: `computeMissingSignals`, `computeValidationSignals`, `computeContradictionSignals`.

| Программа/блок | Правило | Статус реализации | Поля | Поведение системы | Источник |
| :--- | :--- | :--- | :--- | :--- | :--- |
| APICS | Нет даты СОПД | implemented | `dataProcessingConsentDate` | `missing`, `STOP`, blocksGraph. Не дублируется как contradiction. | `APX-004`, `computeMissingSignals` |
| APICS | Нет контакта клиента | implemented | `contactValue` | `missing`, `WARNING`, не блокирует граф; `requiredMode=soft_required`. | `APX-005`, `fieldCatalog` |
| Госпрограммы | Повторная льготная ипотека после 23.12.2023 без исключения | implemented | `hasPriorGovMortgage`, `newChildAfterPriorLoan`, `oldLoanClosed` | `contradiction`, `STOP`. | `GOV-001`, `computePrecheckIssues` |
| Госпрограммы | Семейное исключение после прошлой льготной ипотеки | implemented | `hasPriorGovMortgage`, `newChildAfterPriorLoan`, `oldLoanClosed` | `info`, `INFO`, без блокировки. | `GOV-003`, `computeInsights`, `computeContradictionSignals` |
| Госпрограммы | Не подтверждена целевая группа | implemented | `programTargetGroupConfirmed` | `contradiction`, `STOP`. | `GOV-004` |
| Семейная | Нет семейного основания / 0 детей | implemented | `childrenCount` | `contradiction`, `STOP`. | `FAM-001` |
| Семейная | Супруг РФ не включен в сделку | implemented | `spouseRussianCitizen`, `spouseIncludedInDeal` | `contradiction`, `STOP`. | `FAM-002` |
| Семейная | Дата ребенка раньше 01.01.2018 для основания post2018 | implemented | `familyBasis`, `childDob` | `contradiction`, `STOP`. | `FAM-003` |
| ИТ | Возраст, основное место работы, аккредитация, локация, доход | implemented | `itAgeCompliance`, `itMainJob`, `itEmployerAccredited`, `itEmployerLocation`, `itIncomeCompliance` | `contradiction`, `STOP` при нарушении. | `IT-001..005` |
| ДВиАИ | Не выбрана категория | implemented | `dvCategory` | `missing`, `STOP`; не дублируется как contradiction. | `DVA-001`, `computeMissingSignals` |
| ДВиАИ | Возраст молодой семьи | implemented | `dvCategory`, `dvAgeCompliance` | `contradiction`, `STOP`. | `DVA-002` |
| ДВиАИ | Структура собственников | implemented | `dvOwnershipStructureAllowed` | `contradiction`, `STOP`. | `DVA-003` |
| ДВиАИ | Регион не ДФО/Арктика | implemented | `purchaseRegion` | `contradiction`, `STOP`. | `DVA-004` |
| ДВиАИ | Льготная ипотека супруга | implemented | `dvSpousePriorGovMortgage` | `contradiction`, `STOP`. | `DVA-005` |
| ДВиАИ | Пост-сделочная регистрация | implemented | `dvPostRegistrationRequired`, `dvPostRegistrationAcknowledged` | `missing`, `POST_DEAL_REQUIRED`, не blocksFlow. | `DVA-006` |
| Военная | Возраст, НИС, созаемщики, иной залогодатель | implemented | `militaryAgeCompliance`, `militaryNisConfirmed`, `militaryCoborrowersCount`, `otherPledgorPresent` | `contradiction`, `STOP`. | `MIL-001`, `MIL-003..005` |
| Семейная военная | Брак с супругом-гражданином РФ | implemented | `familyStatus`, `spouseRussianCitizen` | `contradiction`, `STOP`. | `FMIL-001` |
| Перекредитование | Правопреемство и ПСК | implemented | `refiBorrowerLinkedToOld`, `refiBorrowerRemains`, `refiAllPledgorsRemain`, `refiObjectSameAsOld`, `refiPskAvailable` | `contradiction`, `STOP`. | `REFI-001..004`, `REFI-006` |

## 9. Объектные проверки

| Блок | Правило | Поля | Поведение | Статус | Источник |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Земля | Допустимое право | `landOwnershipAllowed` | `LAND-001`, STOP. | implemented | `computePrecheckIssues` |
| Земля | Площадь больше 4000 кв. м | `landArea` | `LAND-002`, STOP. | implemented | `computePrecheckIssues` |
| Земля | Границы не установлены | `landBoundariesKnown` | `LAND-003`, STOP. | implemented | `computePrecheckIssues` |
| Земля | ВРИ/категория не позволяют жилье | `landUseAllowed` | `LAND-004`, STOP. | implemented | `computePrecheckIssues` |
| Земля | Запрещенные зоны/категории | `landZoneAllowed` | `LAND-005`, STOP. | implemented | `computePrecheckIssues` |
| Земля | Недопустимые строения на участке ИЖС | `izhsNoExtraBuildings` | `LAND-006`, STOP. | implemented | `computePrecheckIssues` |
| Земля | Регион/территория участка | `landRegionAllowed` | `LAND-007`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Год постройки раньше 1990 | `houseBuiltYear` | `HOUSE-001`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Нет зарегистрированного права при покупке дома | `houseRightsRegistered` | `HOUSE-002`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Непригоден для круглогодичного проживания | `houseYearRoundReady` | `HOUSE-003`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Нет круглогодичного доступа | `houseAllSeasonAccess` | `HOUSE-004`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Площадь вне 60-345 кв. м | `objectArea` | `HOUSE-005`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Недопустимый фундамент/конструктив | `foundationAllowed` | `HOUSE-007`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Нет обязательного конструктива | `houseStructureReady` | `HOUSE-008`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Недопустимая территория | `houseTerritoryAllowed` | `HOUSE-009`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Коммуникации не готовы | `houseCommunicationsReady` | `HOUSE-011`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Только печное отопление | `houseHeatingAllowed` | `HOUSE-012`, STOP. | implemented | `computePrecheckIssues` |
| Дом | Нет санузла/условий | `houseSanitaryReady` | `HOUSE-013`, STOP. | implemented | `computePrecheckIssues` |
| Стройка | Продавец ФЛ, цепочка прав не подтверждена | `sellerType`, `buildRightsChainClear` | `BUILD-001`, STOP. | implemented | `app/app.js:10201` |
| Стройка | Документы цепочки уступок не подтверждены | `sellerType`, `buildAssignmentDocsReady` | `BUILD-002`, STOP. | implemented | `app/app.js:10212` |
| Стройка | Проблемный объект без документов | `problemObject`, `buildProblemDocsReady` | `BUILD-003`, STOP. | implemented | `app/app.js:10223` |
| Стройка | Ввод без права и без документа ввода | `buildCommissionedWithoutRights`, `buildCommissionPermitReady` | `BUILD-004`, STOP. | implemented | `app/app.js:10238` |
| Стройка | Не подтвержден базовый договор | `buildBaseContractReady`, `sellerOwnershipDoc` | `BUILD-005`, STOP. | implemented | `app/app.js:10249` |

## 10. Документная матрица

Факт после P0: `documentSections` содержит 22 секции и 85 элементов; каждый документный элемент имеет `ruleId`; missing-сигнал документа использует `item.ruleId`. Источник: `documentSections` и `computeMissingSignals`.

| Группа | Rule ID диапазон | Примеры документов | Requiredness | Статус |
| :--- | :--- | :--- | :--- | :--- |
| Базовый пакет | `DOC-BASE-001..010` | СОПД, СиЗ, паспорт, СНИЛС/АДИ-РЕГ, опека, доход/занятость, брачный блок. | required/conditional/critical | implemented |
| Вторичка/залог | `DOC-SEC-001..014` | ЕГРН, оценка, ДКП, кадастровые сведения, основание права, зарегистрированные лица, доверенность, опека. | required/conditional | implemented |
| Строящееся жилье | `DOC-BUILD-001..009` | Проект договора, застройщик, проектная декларация, уступка, цепочка прав, проблемный объект, ввод. | required/conditional/critical | implemented |
| ИЖС | `DOC-IZHS-001..015` | Сценарий, исполнитель, паспорт дома, проект, ЕГРН земли, границы, договор подряда, подрядчик, permits, транши, акт осмотра. | required/conditional/critical | implemented |
| Перекредитование | `DOC-REFI-001..011` | Старый кредит, график, ПСК, остаток, реквизиты погашения, цепочка refi. | required/conditional/critical | implemented |
| ПВ и расчеты | `DOC-PAY-001..004` | Подтверждение ПВ, ПВ-документ, аккредитив, внешние реквизиты. | required/conditional | implemented |
| Программы | `DOC-FAM-*`, `DOC-IT-*`, `DOC-DVA-*`, `DOC-MIL-*`, `DOC-PROG-*` | Дети, ИТ-доход/договор/СТД/ЕГРЮЛ, ДВиАИ категория/регистрация, НИС/ЦЖЗ, МСК, субсидия. | required/conditional/critical | implemented |
| День сделки | `DOC-DEAL-001..003` | Финальные договоры, страховые документы, идентификация/полномочия. | required/displayed | implemented |
| Постконтроль | `DOC-POST-001..003` | ЕГРН после регистрации, регистрация ДВиАИ, завершение ИЖС. | required/conditional/critical | implemented |
| Финальный чек | `DOC-FINAL-001..002` | Все обязательные закрыты, missing list отправлен. | required/critical/displayed | implemented |

Особо проверенные документы:

| Документ | Фактический ruleId | Когда требуется | Как отображается | Статус |
| :--- | :--- | :--- | :--- | :--- |
| СОПД заемщика | `DOC-BASE-001` | Любой маршрут | Базовый пакет, critical required. | implemented |
| СиЗ | `DOC-BASE-002` | Любой маршрут | Базовый пакет. | implemented |
| Паспорт | `DOC-BASE-003` | Совершеннолетний участник | Базовый пакет. | implemented |
| СНИЛС / АДИ-РЕГ | `DOC-BASE-006` | Госпрограмма/дети/участники | Conditional required. | implemented |
| Свидетельства детей | `DOC-FAM-001` | Семейная/семейная военная | Program overlays. | implemented |
| ИТ-документы | `DOC-IT-001..004` | ИТ-программа | Program overlays. | implemented |
| ДВиАИ документы | `DOC-DVA-001..002` | ДВиАИ | Program overlays. | implemented |
| НИС/ЦЖЗ | `DOC-MIL-001..002` | Военная/НИС | Program overlays. | implemented |
| ИЖС пакет | `DOC-IZHS-001..015` | ИЖС/ИЖС+земля | ИЖС sections. | implemented |
| Рефинансирование | `DOC-REFI-001..011` | refi | Refi section. | implemented |
| ЕГРН | `DOC-SEC-003`, `DOC-IZHS-006`, `DOC-POST-001` | Вторичка/земля/пострегистрация | В разных секциях. | implemented |
| Отчет об оценке | `DOC-SEC-004` | Вторичка/залог | Secondary object. | implemented |
| Разрешение опеки | `DOC-BASE-008`, `DOC-SEC-014` | Несовершеннолетние | Critical. | implemented |
| Брачный статус | `DOC-BASE-010`, `DOC-SEC-012` | Брачный блок | Conditional. | implemented |
| Материнский капитал | `DOC-PROG-001` | `hasMsk` flag | Program overlays. | implemented |

## 11. Поля АПИКС / системные поля

| Field ID | Название в интерфейсе | Блок | Тип | Required | Readonly | Источник автозаполнения | Где используется | Статус |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `surname` | Фамилия заемщика (`borrowerSurname`) | APICS identity | text | yes | softReadonly, manualFallback | ЦП/ДБО | pre-check, export | implemented |
| `first_name` | Имя заемщика (`borrowerName`) | APICS identity | text | yes | softReadonly, manualFallback | ЦП/ДБО | pre-check, export | implemented |
| `patronymic` | Отчество заемщика (`borrowerPatronymic`) | APICS identity | text | no | softReadonly, manualFallback | ЦП/ДБО | pre-check, export | implemented |
| `contact_value` | Телефон / email клиента (`contactValue`) | APICS identity | text | soft_required | soft | ЦП/ДБО | missing WARNING, no graph block | implemented |
| `data_processing_consent_date` | Дата СОПД | APICS identity | date | hard_required | soft | ЦП/ДБО | missing STOP, graph block | implemented |
| `credit_product` | Программа (`routeProgram`) | route | route | yes | hardReadonly | route picker | routing | implemented |
| `credit_purpose` | Цель кредита (`routePurpose`) | route | route | yes | hardReadonly | route picker | routing | implemented |
| `loan_amount` | Сумма кредита | APICS | money | yes | soft, manual edit allowed | QR/форма | call1/export | implemented |
| `loan_term` | Срок кредита | APICS | number | yes | soft, manual edit allowed | QR/форма | call1/call2/export | implemented |
| `income_confirmation_type` | Тип подтверждения дохода | APICS | select | yes | editable | manual/APICS metadata | docs/base/KD | implemented |
| `property_type` | Тип объекта | APICS | select | yes | editable | manual/APICS metadata | object gates | implemented |
| `cadastral_number` | Кадастровый номер объекта | APICS | text/mask | yes | editable | manual/APICS metadata | object fields | implemented |
| `land_area` | Площадь участка | APICS | number | yes | editable | manual/APICS metadata | `LAND-002` | implemented |
| `land_survey_flag` | `landBoundariesKnown` | APICS proxy | boolean | yes | editable | direct boolean mapping | `LAND-003`, `APX-OBJ-001` | implemented |
| `heating_type` | `heatingType`; also logical `houseHeatingAllowed` | APICS/method | select/boolean | partial | editable | manual/APICS metadata | `HOUSE-012` uses boolean field | partial |
| `foundation_type` | `foundationAllowed` | APICS proxy | boolean | yes | editable | proxy boolean mapping | `HOUSE-007`, `APX-OBJ-002` | implemented |
| `appraisal_report_number` | Номер отчета об оценке | APICS | text | no | soft, simulated/manual autoload | отчет об оценке | secondary/pledge/IZHS | implemented |
| `ownership_form` | Форма собственности | APICS | select | yes | editable | manual/APICS metadata | `KD-001` warning | implemented |
| `payment_method` | Способ расчетов | APICS | select | yes | editable | manual/APICS metadata | `KD-002`, docs flags | implemented |
| `client_identification_method` | Способ идентификации клиента | APICS | select | yes | editable | manual/APICS metadata | `KD-004` | implemented |
| `contract_conclusion_location` | Место заключения договора | APICS | textarea | yes | soft, manualFallback | регион объекта, soft warning | `KD-005` | implemented |
| `seller_company_email` | Email контактного лица продавца | APICS | email | conditional | editable | manual/APICS metadata | `KD-006` | implemented |
| `insurance_type` | Тип страхования | APICS | select | yes | editable | manual/APICS metadata | call2/KD | implemented |
| `rate_reduction_period` | Период снижения ставки | APICS | select/text | conditional | editable | manual/APICS metadata | `KD-008` | implemented |

## 12. Сигналы и противоречия

| Тип сигнала | Условие возникновения | Severity | Блокирует ли сценарий | Статус | Источник |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `missing` | Пустое required поле, required документ, outcome gap, post-deal obligation. | WARNING/STOP/POST_DEAL_REQUIRED | Да, если `blocksFlow` или STOP; contactValue no. | implemented | `computeMissingSignals` |
| `validation` | Поле touched и не проходит формат/маску/диапазон. | WARNING | Обычно нет. | implemented | `computeValidationSignals` |
| `contradiction` | Методологический конфликт pre-check, object, participants, KD. | WARNING/STOP | Да при STOP/blocker. | implemented | `computeContradictionSignals` |
| `info` | Разрешающее исключение или информационная подсказка без блокировки. | INFO | Нет. | implemented | `GOV-003`, `computeContradictionSignals` |
| `postDeal` | DVA post registration required. | POST_DEAL_REQUIRED | Нет. | implemented | `DVA-006`, `computeMissingSignals`, `computeDealReleaseSignals` |

Сигналы не имеют lifecycle: подтверждение, закрытие, назначение ответственного, audit trail и persistent severity override не найдены. Статус: `partial`. Источник: `computeAllSignals`, `renderInsights`.

## 13. Итог звонка и follow-up

| Проверка | Фактическое состояние | Статус | Источник |
| :--- | :--- | :--- | :--- |
| Чем закончился звонок | `outcome.status` с вариантами completed/waiting/need_recheck/blocked/etc. | implemented | `outcomeStatusOptions` |
| Что подтверждено | `confirmedSummary`. | implemented | `createOutcomeState` |
| Что осталось неясным | `unresolvedSummary`. | implemented | `createOutcomeState` |
| Риски | `riskSummary`. | implemented | `createOutcomeState` |
| Документы, обещанные клиентом | `promisedDocs[]` с name/dueDate/comment/received. | implemented | `createPromisedDoc` |
| Следующий шаг | `nextStep`. | implemented | `createOutcomeState` |
| Дата/время возврата | `followUp.date`, `followUp.time`. | implemented | `createOutcomeState` |
| Канал контакта | `followUp.channel`: call/whatsapp/telegram/documents/recheck/internal. | implemented | `followUpChannelOptions` |
| Причина контакта | `followUp.reason`. | implemented | `createOutcomeState` |
| Календарные группы | Просрочено/сегодня/завтра/позже реализованы как derived tasks. | implemented | calendar functions |
| Переход из задачи к сделке | Есть переход к карточке звонка. | implemented | calendar handlers |
| Внешний календарь | Google/Outlook интеграция не найдена. | not_found | project files |

## 14. Экспорт и импорт сессии

| Функция | Фактическое состояние | Что входит | Ограничения | Статус |
| :--- | :--- | :--- | :--- | :--- |
| CSV all calls | Экспорт всех карточек в CSV. | Route, fields, outcome, participants JSON, triggered rule ids/json, signal counts. | Не импортируется обратно. | implemented |
| CSV single call | Экспорт одной карточки в CSV. | Один row из `buildCallExportRow`. | Не импортируется обратно. | implemented |
| JSON session backup | Скачивается JSON backup. | `version`, `appSchemaVersion`, `journalSchemaVersion`, `exportedAt`, `managerProfile`, `journalState`, `uiState`, `meta`. | Место сохранения выбирает браузер. | implemented |
| Import preview | Перед применением показывается файл, менеджер, дата, кол-во звонков, активная карточка, backup/schema version, текущий размер журнала. | `pendingSessionImport`. | Только валидный JSON backup. | implemented |
| Import replace | Заменяет calls, activeCallId, managerProfile, recoverable uiState. | Вся сессия. | Backup version должен совпадать. | implemented |
| Import merge | Добавляет звонки из backup к текущему журналу. При конфликте id генерируется новый id. UI-state не заменяется. | `journalState.calls`; ФИО не заменяется, если уже есть. | Конфликты содержимого не мержатся внутри карточки. | implemented |
| Import validation | Проверяет format, backup version, managerProfile.fullName, journalState.calls. | JSON backup. | Нет интерактивного diff. | implemented |
| Schema migration | `journalState` мигрируется через `migrations[]` до schema v2. | calls/documents/participants. | Нет миграции backend, потому backend отсутствует. | implemented |

## 15. Нормализованная таблица правил для сравнения

| Rule ID | Категория | Сущность | Условие | Ожидаемое поведение в системе | Фактическое поведение | Статус | Источник |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GOV-001` | precheck | программа | Повторная льготная без исключения | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `GOV-003` | precheck | программа | Семейное исключение выполнено | Allow/info | info INFO, no block | implemented | `computeInsights` |
| `APX-004` | ui_rule | СОПД | Дата СОПД пустая | Missing STOP | missing STOP only | implemented | `computeMissingSignals` |
| `APX-005` | ui_rule | контакт | Контакт пустой | Soft missing | missing WARNING, no block | implemented | `fieldCatalog` |
| `DVA-001` | precheck | ДВиАИ | Категория пустая | Missing STOP | missing STOP only | implemented | `computeMissingSignals` |
| `DVA-006` | product_rule | ДВиАИ | Нужно post-deal подтверждение | Post-deal required | POST_DEAL_REQUIRED, no block | implemented | `computeMissingSignals` |
| `BUILD-001` | object_rule | стройка | ФЛ-продавец, цепочка прав неясна | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `BUILD-002` | object_rule | стройка | Документы уступки не подтверждены | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `BUILD-003` | object_rule | стройка | Проблемный объект без документов | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `BUILD-004` | object_rule | стройка | Ввод без права и без документа | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `BUILD-005` | object_rule | стройка | Нет базового договора | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `LAND-001..007` | object_rule | земля | Земельные redlines | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `HOUSE-001..013` | object_rule | дом | Домовые redlines | STOP | contradiction STOP | implemented | `computePrecheckIssues` |
| `DOC-BASE-*` | document_rule | документы | Базовый пакет | Missing docs | missing WARNING/STOP | implemented | `documentSections` |
| `DOC-SEC-*` | document_rule | вторичка | Вторичные документы | Missing docs | missing WARNING/STOP | implemented | `documentSections` |
| `DOC-BUILD-*` | document_rule | стройка | Документы стройки | Missing docs | missing WARNING/STOP | implemented | `documentSections` |
| `DOC-IZHS-*` | document_rule | ИЖС | ИЖС документы | Missing docs | missing WARNING/STOP | implemented | `documentSections` |
| `DOC-REFI-*` | document_rule | refi | Refi документы | Missing docs | missing WARNING/STOP | implemented | `documentSections` |
| `PART-001..004` | signal_rule | участники | Роли/залог/опека/родство | Signal | missing WARNING/STOP | implemented | `computeParticipantSignals` |
| `KD-001..010` | call_flow_rule | 2-й звонок | КД-готовность | STOP/WARNING | missing/validation/contradiction | implemented | `computeDealReleaseSignals` |
| `STORAGE-001` | storage_rule | localStorage | Legacy data loaded/imported | Migration | schema v2 normalization | implemented | `migrations` |
| `EXPORT-001` | export_import_rule | session | Replace import | Replace session | replace implemented | implemented | `applyImportedSession` |
| `EXPORT-002` | export_import_rule | session | Merge import | Merge calls | merge implemented with id conflict handling | implemented | `mergeImportedJournalState` |
| `EXPORT-003` | export_import_rule | session | Valid backup selected | Preview | preview modal implemented | implemented | `renderSessionModal` |

## 16. Пробелы и неподтвержденные зоны

| Зона | Фактическое состояние | Статус |
| :--- | :--- | :--- |
| Backend/API | Не найден. | not_found |
| Реальная APICS интеграция | Есть `apicsId`/metadata, но нет fetch/API. | documented_only |
| Роли и авторизация | Только ФИО менеджера. | not_found |
| Audit trail действий | Нет persistent audit log. | not_found |
| Signal lifecycle | Нет close/ack/assign/comment. | not_found |
| Rules engine как отдельный слой | Правила реализованы функциями в `app.js`, отдельного engine/config runtime нет. | partial |
| Автоматические unit/e2e tests | Ручная matrix есть; тестового runner/build pipeline не найдено. | documented_only |
| Import diff | Есть preview/replace/merge; построчного diff конфликтов нет. | partial |
| Backend calendar | Только локальный drawer; внешней синхронизации нет. | not_found |
| P1-P3 backlog: roles, integrations, analytics, admin, backend | В текущем frontend-only проекте не реализованы. | documented_only |

## 17. Итоговый вывод

1. Хорошо формализованы: route matrix, field catalog, pre-check, object redlines, document matrix, computed signals, outcome/follow-up, session backup/import.
2. Реально реализованы: `APX-004` как missing STOP only, `GOV-003` как info allow-exception, `DVA-001` как missing STOP, атомарные `BUILD-001..005`, document ruleId для всех 85 документов, schema migrations, import preview/replace/merge.
3. Только описаны или частично покрыты: ручной regression process, будущие P1-P3 зоны, внешние интеграции, отдельный rules engine.
4. Критичные отсутствующие части: backend, авторизация, audit trail, signal lifecycle, реальный APICS/API, автотестовый runner.
5. Зоны ручной проверки: 77 строк `docs/testing/methodology_rule_test_matrix.md`, особенно BUILD, DVA, APX, import merge/replace, документы ИЖС/refi/secondary.
6. Основной источник истины: `app/app.js`. Документы `docs/testing/*` являются проверочными/описательными источниками.
7. Потенциальные дубли: testing markdown-файлы пересекаются по смыслу с `current_system_state.md`; `rulesRegistry` и `documentSections` частично дублируют document rule semantics.
8. Что уточнить у разработчика: нужны ли P1-P3 в рамках frontend-only прототипа или следующий этап должен включать backend, роли, audit, API и автоматические тесты.
