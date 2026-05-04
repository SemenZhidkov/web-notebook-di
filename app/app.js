const routeOptions = {
  purpose: [
    { value: "ready", label: "Готовое жилье" },
    { value: "build", label: "Строящееся жилье" },
    { value: "izhs", label: "ИЖС" },
    { value: "izhs_land", label: "ИЖС + земля" },
    { value: "refi", label: "Перекредитование" },
    { value: "pledge", label: "Залог имеющейся квартиры" },
  ],
  program: [
    { value: "base", label: "Стандарт" },
    { value: "family", label: "Семейная" },
    { value: "it", label: "ИТ" },
    { value: "dv", label: "ДВиАИ" },
    { value: "military", label: "Военная" },
    { value: "family_military", label: "Семейная для военнослужащих" },
  ],
};

const boolOptions = [
  { value: "yes", label: "Да" },
  { value: "no", label: "Нет" },
];

const docStatusOptions = [
  { value: "", label: "Не выбрано" },
  { value: "auto", label: "Подтягивается автоматически" },
  { value: "requested", label: "Запрошено" },
  { value: "received", label: "Получено" },
];

const regionOptions = [
  { value: "", label: "Выберите регион" },
  { value: "moscow", label: "Москва" },
  { value: "spb", label: "Санкт-Петербург" },
  { value: "mo", label: "Московская область" },
  { value: "len", label: "Ленинградская область" },
  { value: "dfo", label: "ДФО / Арктика" },
  { value: "other", label: "Иной регион" },
];

const METHODOLOGY_SOURCE = "tz_methodology_completion.md";
const RULE_IMPLEMENTATION_STATUSES = {
  runtime: "runtime_implemented",
  registered: "registered_only",
  deprecated: "deprecated_or_alias",
};

function createRule({
  ruleId,
  layer,
  stage = "1_call",
  purpose = "all",
  program = "all",
  given = "",
  when = "",
  then = "",
  severity = "INFO",
  fields = [],
  source = METHODOLOGY_SOURCE,
  confidence = "confirmed",
  implementationStatus = RULE_IMPLEMENTATION_STATUSES.runtime,
}) {
  return {
    ruleId,
    layer,
    stage,
    purpose,
    program,
    given,
    when,
    then,
    severity,
    fields,
    source,
    confidence,
    implementationStatus,
  };
}

function createRuleRange(prefix, count, layer, stage = "1_call") {
  return Array.from({ length: count }, (_, index) => {
    const ruleId = `${prefix}-${String(index + 1).padStart(3, "0")}`;
    return createRule({
      ruleId,
      layer,
      stage,
      given: "Правило зарезервировано целевой методологией.",
      when: "Условие детализируется в методологическом слое.",
      then: "Система связывает сработавший сигнал с машинным ruleId.",
      severity: "REVIEW",
      confidence: "needs_confirmation",
      implementationStatus: RULE_IMPLEMENTATION_STATUSES.registered,
    });
  });
}

function createDocumentRuleRange(prefix, count, stage = "call1") {
  const normalizedStage = stage === "call2" ? "2_call" : stage;
  return Array.from({ length: count }, (_, index) =>
    createRule({
      ruleId: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      layer: "document_matrix",
      stage: normalizedStage,
      when: "Документная матрица показывает атомарный документ для активного сценария.",
      then: "Система отображает документ и создает missing-сигнал, если документ обязателен и не закрыт.",
      severity: "REQUIRED",
    })
  );
}

const rulesRegistry = [
  ...createRuleRange("GOV", 5, "precheck"),
  ...createRuleRange("FAM", 5, "precheck"),
  ...createRuleRange("IT", 8, "precheck"),
  ...createRuleRange("DVA", 8, "precheck"),
  ...createRuleRange("MIL", 7, "precheck"),
  ...createRuleRange("FMIL", 7, "precheck"),
  ...createRuleRange("READY", 5, "object_filters"),
  ...createRuleRange("BUILD", 5, "object_filters"),
  ...createRuleRange("IZHS", 7, "object_filters"),
  ...createRuleRange("IZHS-LAND", 5, "object_filters"),
  ...createRuleRange("REFI", 8, "object_filters", "2_call"),
  ...createRuleRange("PLEDGE", 5, "object_filters"),
  ...createRuleRange("LAND", 8, "object_filters"),
  ...createRuleRange("HOUSE", 13, "object_filters"),
  ...createRuleRange("APX", 11, "apics_mapping"),
  createRule({
    ruleId: "GOV-001",
    layer: "precheck",
    when: "Выбрана государственная программа и есть прошлый льготный кредит после 23.12.2023.",
    then: "Показать STOP, если не выполняется семейное исключение.",
    severity: "STOP",
    fields: ["hasPriorGovMortgage", "newChildAfterPriorLoan", "oldLoanClosed"],
  }),
  createRule({
    ruleId: "GOV-003",
    layer: "precheck",
    when: "Семейная программа, прошлый льготный кредит закрыт и после него родился новый ребенок.",
    then: "Показать информационное разрешающее исключение без блокировки маршрута.",
    severity: "ALLOW_EXCEPTION",
    fields: ["hasPriorGovMortgage", "newChildAfterPriorLoan", "oldLoanClosed"],
  }),
  createRule({
    ruleId: "GOV-004",
    layer: "precheck",
    when: "Выбрана государственная программа.",
    then: "Блокировать программу, если целевая группа не подтверждена.",
    severity: "STOP",
    fields: ["programTargetGroupConfirmed"],
  }),
  createRule({
    ruleId: "IT-006",
    layer: "routing",
    when: "ИТ-ипотека выбрана для refi или залога имеющейся квартиры.",
    then: "Блокировать маршрут как неподтвержденный продуктовой методологией.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram"],
  }),
  createRule({
    ruleId: "IT-007",
    layer: "routing",
    when: "ИТ-ипотека выбрана для цели ИЖС + земля.",
    then: "Требовать ручное подтверждение паспорта продукта до открытия графа.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram", "routeConditionalApproved"],
  }),
  createRule({
    ruleId: "DVA-006",
    layer: "post_deal_obligation",
    when: "Для ДВиАИ требуется пост-сделочная регистрация.",
    then: "Показать post-deal obligation без объектного STOP.",
    severity: "POST_DEAL_REQUIRED",
    fields: ["dvPostRegistrationRequired", "dvPostRegistrationAcknowledged"],
  }),
  createRule({
    ruleId: "DVA-007",
    layer: "routing",
    when: "ДВиАИ выбрана для перекредитования.",
    then: "Блокировать маршрут как неподтвержденный продуктовой методологией.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram"],
  }),
  createRule({
    ruleId: "DVA-008",
    layer: "routing",
    when: "ДВиАИ выбрана для цели ИЖС + земля.",
    then: "Требовать ручное подтверждение паспорта продукта до открытия графа.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram", "routeConditionalApproved"],
  }),
  createRule({
    ruleId: "MIL-007",
    layer: "routing",
    when: "Военная ипотека выбрана для цели ИЖС + земля.",
    then: "Требовать ручное подтверждение паспорта продукта до открытия графа.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram", "routeConditionalApproved"],
  }),
  createRule({
    ruleId: "PLEDGE-001",
    layer: "routing",
    when: "Залог имеющейся квартиры выбран с льготной или военной программой.",
    then: "Блокировать маршрут; базовый сценарий допускается только для стандартной программы.",
    severity: "STOP",
    fields: ["routePurpose", "routeProgram"],
  }),
  createRule({
    ruleId: "BUILD-001",
    layer: "object_filters",
    purpose: "build",
    when: "Строящееся жилье, продавец-физлицо и цепочка прав не подтверждена.",
    then: "Показать STOP по сценарию уступки / продавца-физлица.",
    severity: "STOP",
    fields: ["sellerType", "buildRightsChainClear"],
  }),
  createRule({
    ruleId: "BUILD-002",
    layer: "object_filters",
    purpose: "build",
    when: "Строящееся жилье, продавец-физлицо и документы по цепочке уступок не подтверждены.",
    then: "Показать отдельный STOP по документам цепочки уступки.",
    severity: "STOP",
    fields: ["sellerType", "buildAssignmentDocsReady"],
  }),
  createRule({
    ruleId: "BUILD-003",
    layer: "object_filters",
    purpose: "build",
    when: "Объект отмечен как проблемный, но пакет проблемного объекта не подтвержден.",
    then: "Показать STOP по проблемному объекту.",
    severity: "STOP",
    fields: ["problemObject", "buildProblemDocsReady"],
  }),
  createRule({
    ruleId: "BUILD-004",
    layer: "object_filters",
    purpose: "build",
    when: "Дом введен в эксплуатацию, право не зарегистрировано, документа по вводу нет.",
    then: "Показать STOP по документу ввода объекта в эксплуатацию.",
    severity: "STOP",
    fields: ["buildCommissionedWithoutRights", "buildCommissionPermitReady"],
  }),
  createRule({
    ruleId: "BUILD-005",
    layer: "object_filters",
    purpose: "build",
    when: "Для строящегося объекта не подтвержден базовый договор / документ-основание.",
    then: "Показать STOP по отсутствию базового договора строящегося объекта.",
    severity: "STOP",
    fields: ["buildBaseContractReady", "sellerOwnershipDoc"],
  }),
  createRule({
    ruleId: "REFI-006",
    layer: "precheck",
    stage: "2_call",
    when: "Выбрана цель Перекредитование, но ПСК логически не подтвержден.",
    then: "Показать STOP в refi-check / КД-готовности.",
    severity: "STOP",
    fields: ["refiPskAvailable"],
  }),
  createRule({
    ruleId: "DOC-BASE-001",
    layer: "document_matrix",
    when: "Любой ипотечный маршрут.",
    then: "Показать СОПД заемщика и залогодателя-физлица как обязательный документ.",
    severity: "REQUIRED",
    fields: ["documents.items.sopd_borrower"],
  }),
  createRule({
    ruleId: "DOC-BASE-002",
    layer: "document_matrix",
    when: "Любой ипотечный маршрут.",
    then: "Показать СиЗ как обязательный базовый документ.",
    severity: "REQUIRED",
  }),
  createRule({
    ruleId: "DOC-BASE-003",
    layer: "document_matrix",
    when: "В сделке есть совершеннолетний участник.",
    then: "Запросить паспорт РФ.",
    severity: "REQUIRED",
  }),
  createRule({
    ruleId: "DOC-BASE-004",
    layer: "document_matrix",
    when: "В сделке есть несовершеннолетний без паспорта.",
    then: "Запросить свидетельство о рождении.",
    severity: "REQUIRED",
    fields: ["minorParticipants", "dealParticipants"],
  }),
  createRule({
    ruleId: "DOC-BASE-005",
    layer: "document_matrix",
    when: "В паспорте нет нужных сведений о регистрации.",
    then: "Запросить документ о регистрации.",
    severity: "REQUIRED",
  }),
  createRule({
    ruleId: "DOC-BASE-006",
    layer: "document_matrix",
    when: "Госпрограмма или детский/участнический пакет.",
    then: "Запросить СНИЛС / АДИ-РЕГ.",
    severity: "REQUIRED",
    fields: ["childSnils", "dealParticipants"],
  }),
  createRule({
    ruleId: "DOC-BASE-007",
    layer: "document_matrix",
    when: "Залогодатель не является заемщиком.",
    then: "Запросить документы о родстве.",
    severity: "REQUIRED",
    fields: ["nonBorrowerPledgorPresent", "pledgorKinshipDocsReady"],
  }),
  createRule({
    ruleId: "DOC-BASE-008",
    layer: "document_matrix",
    when: "Участник или залогодатель несовершеннолетний.",
    then: "Запросить разрешение органов опеки.",
    severity: "STOP",
    fields: ["minorParticipants", "guardianshipStatus"],
  }),
  createRule({
    ruleId: "DOC-BASE-009",
    layer: "document_matrix",
    when: "Продукт или категория требует подтверждение дохода и занятости.",
    then: "Запросить документы о доходе и занятости.",
    severity: "REQUIRED",
    fields: ["incomeConfirmationType"],
  }),
  createRule({
    ruleId: "DOC-BASE-010",
    layer: "document_matrix",
    when: "Сделка включает супруга или брачный режим.",
    then: "Показать документы по супругу / брачному режиму.",
    severity: "REQUIRED",
    fields: ["documents.items.base.spouse_docs"],
  }),
  ...Array.from({ length: 11 }, (_, index) =>
    createRule({
      ruleId: `DOC-REFI-${String(index + 1).padStart(3, "0")}`,
      layer: "document_matrix",
      stage: "2_call",
      purpose: "refi",
      when: "Выбрана цель Перекредитование.",
      then: "Показать атомарный документ refi-сценария.",
      severity: index === 2 ? "STOP" : "REQUIRED",
      fields: [index === 2 ? "documents.items.refi_psk_notification" : "documents.items.refi"],
    })
  ),
  createRule({
    ruleId: "DOC-IT-001",
    layer: "document_matrix",
    when: "Выбрана ИТ-ипотека.",
    then: "Показать справку о доходах от ИТ-организации.",
    severity: "REQUIRED",
    fields: ["documents.items.it_income_certificate"],
  }),
  createRule({
    ruleId: "DOC-IT-002",
    layer: "document_matrix",
    when: "Выбрана ИТ-ипотека.",
    then: "Показать трудовой договор / СТД как подтверждение занятости.",
    severity: "REQUIRED",
    fields: ["documents.items.it_labor_contract", "documents.items.it_std"],
  }),
  createRule({
    ruleId: "DOC-DVA-001",
    layer: "document_matrix",
    when: "Выбрана ДВиАИ.",
    then: "Показать документ по категории заемщика.",
    severity: "REQUIRED",
    fields: ["documents.items.dva_category_doc"],
  }),
  createRule({
    ruleId: "DOC-MIL-001",
    layer: "document_matrix",
    when: "Выбрана Военная ипотека или семейная программа для военнослужащих.",
    then: "Показать документ НИС / Росвоенипотеки.",
    severity: "STOP",
    fields: ["documents.items.military_nis_doc"],
  }),
  ...createDocumentRuleRange("DOC-SEC", 14),
  ...createDocumentRuleRange("DOC-BUILD", 9),
  ...createDocumentRuleRange("DOC-IZHS", 15),
  ...createDocumentRuleRange("DOC-PAY", 4, "call2"),
  ...createDocumentRuleRange("DOC-FAM", 2, "call2"),
  createRule({
    ruleId: "DOC-IT-003",
    layer: "document_matrix",
    stage: "2_call",
    when: "Выбрана ИТ-ипотека и требуется дополнительное подтверждение условий занятости.",
    then: "Показать допсоглашение к трудовому договору как отдельный документ ИТ-пакета.",
    severity: "REQUIRED",
    fields: ["documents.items.program.it.addendum"],
  }),
  createRule({
    ruleId: "DOC-IT-004",
    layer: "document_matrix",
    stage: "2_call",
    when: "Выбрана ИТ-ипотека.",
    then: "Показать выписку ЕГРЮЛ по работодателю как отдельный документ ИТ-пакета.",
    severity: "REQUIRED",
    fields: ["documents.items.program.it.egrul"],
  }),
  createRule({
    ruleId: "DOC-DVA-002",
    layer: "document_matrix",
    stage: "2_call",
    when: "Для ДВиАИ требуется пост-сделочная регистрация.",
    then: "Показать обязательство пост-сделочной регистрации как отдельный документ.",
    severity: "POST_DEAL_REQUIRED",
    fields: ["documents.items.program.dv.region_commitment"],
  }),
  createRule({
    ruleId: "DOC-MIL-002",
    layer: "document_matrix",
    stage: "2_call",
    when: "Включена военная программа или НИС.",
    then: "Показать свидетельство о праве на ЦЖЗ как отдельный документ.",
    severity: "REQUIRED",
    fields: ["documents.items.program.military.czhz"],
  }),
  createRule({
    ruleId: "DOC-PROG-001",
    layer: "document_matrix",
    stage: "2_call",
    when: "Первоначальный взнос включает материнский капитал.",
    then: "Показать сертификат и справку об остатке МСК.",
    severity: "REQUIRED",
    fields: ["documents.items.program.msk.certificate"],
  }),
  createRule({
    ruleId: "DOC-PROG-002",
    layer: "document_matrix",
    stage: "2_call",
    when: "Первоначальный взнос включает субсидию или сертификат.",
    then: "Показать документы по субсидии / сертификату.",
    severity: "REQUIRED",
    fields: ["documents.items.program.subsidy.docs"],
  }),
  createRule({
    ruleId: "STORAGE-001",
    layer: "storage_rule",
    when: "Загружается журнал из localStorage или backup.",
    then: "Применить миграции localStorage и нормализовать legacy calls/documents/participants.",
    severity: "INFO",
    fields: ["journalState.schemaVersion", "calls", "documents", "participants"],
  }),
  createRule({
    ruleId: "EXPORT-001",
    layer: "export_import_rule",
    when: "Менеджер подтверждает импорт в режиме replace.",
    then: "Заменить журнал, профиль менеджера и восстановимое UI-состояние данными файла.",
    severity: "INFO",
    fields: ["journalState", "managerProfile", "uiState"],
  }),
  createRule({
    ruleId: "EXPORT-002",
    layer: "export_import_rule",
    when: "Менеджер подтверждает импорт в режиме merge.",
    then: "Добавить звонки из файла к текущему журналу и сохранить текущий UI-state.",
    severity: "INFO",
    fields: ["journalState.calls"],
  }),
  createRule({
    ruleId: "EXPORT-003",
    layer: "export_import_rule",
    when: "Менеджер выбирает JSON backup для импорта.",
    then: "Показать preview файла до применения replace или merge.",
    severity: "INFO",
    fields: ["pendingSessionImport", "journalState", "managerProfile"],
  }),
  ...createDocumentRuleRange("DOC-DEAL", 3, "call2"),
  ...createDocumentRuleRange("DOC-POST", 3, "post"),
  ...createDocumentRuleRange("DOC-FINAL", 2, "call2"),
  createRule({
    ruleId: "APX-001",
    layer: "apics_mapping",
    when: "ФИО заемщика отображается в блокноте.",
    then: "Пометить ФИО как imported/soft-readonly из ЦП/ДБО.",
    severity: "INFO",
    fields: ["borrowerSurname", "borrowerName", "borrowerPatronymic"],
  }),
  createRule({
    ruleId: "APX-004",
    layer: "apics_mapping",
    when: "Дата СОПД не заполнена.",
    then: "Показать STOP до запуска основного графа.",
    severity: "STOP",
    fields: ["dataProcessingConsentDate"],
  }),
  createRule({
    ruleId: "APX-005",
    layer: "apics_mapping",
    when: "Контакт из ЦП/ДБО отсутствует.",
    then: "Показать warning про ДБО-верификацию email/phone.",
    severity: "WARNING",
    fields: ["contactValue"],
  }),
  createRule({
    ruleId: "APX-OBJ-001",
    layer: "apics_mapping",
    when: "Проверяется установление границ участка.",
    then: "Связать APICS land_survey_flag с системным landBoundariesKnown.",
    severity: "INFO",
    fields: ["landBoundariesKnown"],
  }),
  createRule({
    ruleId: "APX-OBJ-002",
    layer: "apics_mapping",
    when: "Проверяется фундамент дома.",
    then: "Связать APICS foundation_type с системным foundationAllowed.",
    severity: "INFO",
    fields: ["foundationAllowed"],
  }),
  ...Array.from({ length: 11 }, (_, index) =>
    createRule({
      ruleId: `APX-KD-${String(index + 1).padStart(3, "0")}`,
      layer: "apics_mapping",
      stage: "2_call",
      when: "Проверяется кредитное дело и выпуск документов.",
      then: "Показать КД-сигнал по готовности данных.",
      severity: index === 8 ? "POST_DEAL_REQUIRED" : "STOP",
    })
  ),
  ...Array.from({ length: 10 }, (_, index) =>
    createRule({
      ruleId: `KD-${String(index + 1).padStart(3, "0")}`,
      layer: "call_flow",
      stage: "2_call",
      when: "Проверяется готовность второго звонка и КД.",
      then: "Показать статус готовности к выпуску документов.",
      severity: index === 8 ? "POST_DEAL_REQUIRED" : "STOP",
    })
  ),
  ...Array.from({ length: 7 }, (_, index) =>
    createRule({
      ruleId: `PART-${String(index + 1).padStart(3, "0")}`,
      layer: "ui_validation",
      when: "Проверяется состав участников сделки.",
      then: "Показать сигнал по роли, залогу, расчету дохода или документам участника.",
      severity: index >= 3 ? "STOP" : "WARNING",
      fields: ["dealParticipants"],
    })
  ),
];

const rulesRegistryById = Object.fromEntries(rulesRegistry.map((rule) => [rule.ruleId, rule]));

const compatibilityMatrix = {
  ready: {
    base: {
      status: "allowed",
      reason: "Базовый сценарий покупки готового жилья поддержан без дополнительных продуктовых ограничений.",
    },
    family: {
      status: "allowed",
      reason: "Семейная программа подтверждена для приобретения готового жилья при наличии семейного основания.",
    },
    it: {
      status: "allowed",
      reason: "ИТ-программа подтверждена для приобретения объекта недвижимости.",
    },
    dv: {
      status: "allowed",
      reason: "ДВиАИ подтверждена для приобретения объекта недвижимости при соблюдении категории заемщика.",
    },
    military: {
      status: "allowed",
      reason: "Военная программа подтверждена для приобретения объекта недвижимости.",
    },
    family_military: {
      status: "allowed",
      reason: "Семейная программа для военнослужащих подтверждена для приобретения объекта недвижимости.",
    },
  },
  build: {
    base: {
      status: "allowed",
      reason: "Базовый сценарий строительства поддержан.",
    },
    family: {
      status: "allowed",
      reason: "Семейная программа подтверждена для покупки или строительства.",
    },
    it: {
      status: "allowed",
      reason: "ИТ-программа подтверждена для приобретения объекта недвижимости, включая стройку.",
    },
    dv: {
      status: "allowed",
      reason: "ДВиАИ подтверждена для приобретения или строительства при соблюдении категории заемщика.",
    },
    military: {
      status: "allowed",
      reason: "Военная программа подтверждена для приобретения или строительства.",
    },
    family_military: {
      status: "allowed",
      reason: "Семейная программа для военнослужащих подтверждена для приобретения или строительства.",
    },
  },
  izhs: {
    base: {
      status: "allowed",
      reason: "Базовый сценарий ИЖС поддержан.",
    },
    family: {
      status: "allowed",
      reason: "Семейная программа применяется к ИЖС и требует проверки семейного основания и объектных фильтров.",
    },
    it: {
      status: "allowed",
      reason: "ИТ-программа не конфликтует с ИЖС в текущих методологических материалах.",
    },
    dv: {
      status: "allowed",
      reason: "ДВиАИ не конфликтует с ИЖС, но требует проверки категории заемщика и объектных фильтров.",
    },
    military: {
      status: "allowed",
      reason: "Военная программа подтверждена для индивидуального строительства жилого дома.",
    },
    family_military: {
      status: "allowed",
      reason: "Семейная программа для военнослужащих применяется к приобретению / строительству, включая ИЖС.",
    },
  },
  izhs_land: {
    base: {
      status: "allowed",
      reason: "Базовый сценарий ИЖС с землей поддержан.",
    },
    family: {
      status: "allowed",
      reason: "Семейная программа для ИЖС с землей подтверждается оговорками методологии.",
    },
    it: {
      status: "conditional",
      reason: "Комбинированная цель ИЖС + земля не запрещена, но требует отдельного подтверждения паспортом продукта.",
    },
    dv: {
      status: "conditional",
      reason: "Комбинированная цель ИЖС + земля требует дополнительной проверки по паспорту продукта и категории заемщика.",
    },
    military: {
      status: "conditional",
      reason: "Военная программа для ИЖС + земля требует ручного подтверждения продуктовым паспортом.",
    },
    family_military: {
      status: "conditional",
      reason: "Для семейной программы военнослужащих цель ИЖС + земля лучше подтверждать отдельно паспортом продукта.",
    },
  },
  refi: {
    base: {
      status: "allowed",
      reason: "Базовый сценарий перекредитования поддержан.",
    },
    family: {
      status: "allowed",
      reason: "Семейная программа имеет отдельный подтвержденный сценарий перекредитования.",
    },
    it: {
      status: "blocked",
      reason: "В текущей методологии ИТ-программа подтверждена только для приобретения / строительства, без отдельной ветки рефинанса.",
    },
    dv: {
      status: "blocked",
      reason: "В текущей методологии ДВиАИ подтверждена только для приобретения / строительства, без отдельной ветки рефинанса.",
    },
    military: {
      status: "allowed",
      reason: "Военная программа имеет отдельный подтвержденный сценарий перекредитования.",
    },
    family_military: {
      status: "allowed",
      reason: "Семейная программа для военнослужащих имеет отдельный подтвержденный сценарий перекредитования.",
    },
  },
  pledge: {
    base: {
      status: "allowed",
      reason: "Залог имеющейся квартиры ведется как стандартный нелъготный сценарий.",
    },
    family: {
      status: "blocked",
      reason: "Льготная семейная программа не подтверждена для цели залога имеющейся квартиры.",
    },
    it: {
      status: "blocked",
      reason: "ИТ-программа не подтверждена для цели залога имеющейся квартиры.",
    },
    dv: {
      status: "blocked",
      reason: "ДВиАИ не подтверждена для цели залога имеющейся квартиры.",
    },
    military: {
      status: "blocked",
      reason: "Военная программа не подтверждена для цели залога имеющейся квартиры.",
    },
    family_military: {
      status: "blocked",
      reason: "Семейная программа для военнослужащих не подтверждена для цели залога имеющейся квартиры.",
    },
  },
};

const expectedCoverage = {
  call1Apics: [
    "appraisal_report_number",
    "area_with_reduction_factor",
    "bathrooms_count",
    "cadastral_number",
    "ceiling_height",
    "child_dob",
    "children_birth_certificates",
    "construction_completion_date",
    "contract_price",
    "contractor_company_inn",
    "contractor_company_name",
    "contractor_construction_doc",
    "contractor_ip_full_name",
    "contractor_ip_inn",
    "contractor_type",
    "credit_product",
    "credit_purpose",
    "egrn_extract_doc",
    "electricity_supply",
    "finishing_type",
    "first_name",
    "floors_above_ground",
    "floors_count",
    "gas_supply",
    "guardianship_decision_doc",
    "has_basement",
    "heating_type",
    "house_type",
    "income_confirmation_type",
    "kitchen_area",
    "land_address",
    "land_area",
    "land_category",
    "land_contract_price",
    "land_lending_restrictions",
    "land_use_type",
    "living_area",
    "loan_amount",
    "loan_term",
    "patronymic",
    "poa_person",
    "property_address",
    "property_type",
    "purchase_region",
    "rate_discount_size",
    "rate_reduction_period",
    "refinance_seller_sole_proprietor",
    "rooms_count",
    "seller_company_email",
    "seller_company_inn",
    "seller_company_name",
    "seller_company_phone",
    "seller_full_name",
    "seller_ownership_doc_type",
    "seller_phone",
    "seller_type",
    "sewerage_izhs",
    "surname",
    "utility_electricity",
    "utility_gas",
    "utility_sewerage",
    "utility_water",
    "water_supply",
  ],
  call1NoId: [
    "Дети < 18>::СНИЛС",
    "Дети < 18>::Адрес регистрации",
    "Предмет ипотеки (ИЖС)::Исполнитель строительства",
    "Данные об объекте недвижимости::Дом",
    "Данные об объекте недвижимости::Корпус",
    "Данные об объекте недвижимости::Строение",
    "Данные об объекте недвижимости::Квартира",
    "Данные продавца::Родственные связи с заёмщиком",
    "Данные продавца::Заполнить продавца данными застройщика",
    "Стоимостные характеристики объекта (ИЖС)::Стоимость дома по договору (для готового жилья) / цена по договору подряда (для строющегося жилья) ",
    "Характеристики объекта (ИЖС)::Дом",
    "Характеристики объекта (ИЖС)::Корпус",
    "Характеристики объекта (ИЖС)::Строение",
  ],
  call2Apics: [
    "client_identification_method",
    "contract_conclusion_location",
    "down_payment",
    "insurance_policyholder",
    "insurance_type",
    "loan_term",
    "ownership_form",
    "payment_method",
    "personal_insurance_flag",
    "pv_control",
    "pv_domrf_amount",
    "rate_discount_size",
    "rate_reduction_period",
    "refinance_org_name",
    "refinance_org_type",
    "refinance_original_contract_date",
    "refinance_original_contract_number",
    "refinance_prev_contract_date",
    "refinance_prev_contract_number",
    "refinance_prev_contract_type",
    "refinance_prev_domrf_flag",
    "special_account_flag",
    "subsidy_amount",
    "subsidy_name",
    "title_doc_date",
    "title_doc_name",
    "title_doc_number",
    "title_doc_type",
    "transaction_location",
  ],
  call2NoId: [
    "Параметры кредита::Эскроу счет открыт",
    "Параметры кредита::Предоставляется документ при расчетах ПВ на сумму ",
    "Параметры кредита::Сумма субсидии в ПВ",
    "Контактная информация::Использовать для ДБО",
    "Информация о сделке::Дата и время сделки",
    "Информация о сделке::День платежа",
    "Реквизиты получателя::Владелец счета",
    "Реквизиты получателя::ФИО владельца счета",
    "Реквизиты получателя::Банк получателя",
    "Реквизиты получателя::Расчетный счет получателя",
  ],
};

const sourceCanonicalByFieldKey = {
  routeProgram: "credit_product",
  routePurpose: "credit_purpose",
  contactValue: "contact_value",
  dataProcessingConsentDate: "data_processing_consent_date",
  borrowerSurname: "surname",
  borrowerName: "first_name",
  borrowerPatronymic: "patronymic",
  purchaseRegion: "purchase_region",
  eiszhcsId: "eiszhcs_id",
  objectAddress: "property_address",
  buildingFloors: "floors_count",
  unitFloor: "floors_count",
  objectArea: "area_with_reduction_factor",
  sellerIsEntrepreneur: "refinance_seller_sole_proprietor",
  sellerOwnershipDoc: "seller_ownership_doc_type",
  representativeName: "poa_person",
  egrnStatus: "egrn_extract_doc",
  birthCertificatesStatus: "children_birth_certificates",
  guardianshipStatus: "guardianship_decision_doc",
  houseAddress: "property_address",
  landBoundariesKnown: "land_survey_flag",
  foundationAllowed: "foundation_type",
  sewerageHouse: "sewerage_izhs",
  houseFloorsAboveGround: "floors_above_ground",
  landRestrictions: "land_lending_restrictions",
  contractorIpName: "contractor_ip_full_name",
  finalLoanTerm: "loan_term",
  refiOriginalContractNumber: "refinance_original_contract_number",
  refiOriginalContractDate: "refinance_original_contract_date",
  refiOrgType: "refinance_org_type",
  refiOrgName: "refinance_org_name",
  refiPrevDomrf: "refinance_prev_domrf_flag",
  refiPrevContractNumber: "refinance_prev_contract_number",
  refiPrevContractDate: "refinance_prev_contract_date",
  refiPrevContractType: "refinance_prev_contract_type",
  finalRateReductionPeriod: "rate_reduction_period",
  finalRateDiscountSize: "rate_discount_size",
  personalInsurance: "personal_insurance_flag",
  clientIdentificationMethod: "client_identification_method",
};

const sourceNoIdTokenByFieldKey = {
  childSnils: "Дети < 18>::СНИЛС",
  childRegistrationAddress: "Дети < 18>::Адрес регистрации",
  constructionExecutor: "Предмет ипотеки (ИЖС)::Исполнитель строительства",
  objectHouse: "Данные об объекте недвижимости::Дом",
  objectBuilding: "Данные об объекте недвижимости::Корпус",
  objectStructure: "Данные об объекте недвижимости::Строение",
  apartmentNumber: "Данные об объекте недвижимости::Квартира",
  sellerRelationToBorrower: "Данные продавца::Родственные связи с заёмщиком",
  fillSellerFromDeveloper: "Данные продавца::Заполнить продавца данными застройщика",
  houseContractPrice:
    "Стоимостные характеристики объекта (ИЖС)::Стоимость дома по договору (для готового жилья) / цена по договору подряда (для строющегося жилья) ",
  houseAddressHouse: "Характеристики объекта (ИЖС)::Дом",
  houseAddressBuilding: "Характеристики объекта (ИЖС)::Корпус",
  houseAddressStructure: "Характеристики объекта (ИЖС)::Строение",
  escrowOpened: "Параметры кредита::Эскроу счет открыт",
  pvDocAmount: "Параметры кредита::Предоставляется документ при расчетах ПВ на сумму ",
  subsidyInPvAmount: "Параметры кредита::Сумма субсидии в ПВ",
  useForDbo: "Контактная информация::Использовать для ДБО",
  dealDateTime: "Информация о сделке::Дата и время сделки",
  paymentDay: "Информация о сделке::День платежа",
  recipientAccountOwnerRole: "Реквизиты получателя::Владелец счета",
  recipientAccountOwnerName: "Реквизиты получателя::ФИО владельца счета",
  recipientBank: "Реквизиты получателя::Банк получателя",
  recipientSettlementAccount: "Реквизиты получателя::Расчетный счет получателя",
};

const fieldCatalog = {
  routePurpose: {
    kind: "route",
    label: "Цель кредита",
    sourceKind: "apics",
    callType: 1,
    apicsId: "credit_purpose",
    ruleId: "APX-002",
    readonly: true,
    readonlyPolicy: "hardReadonly",
    sourceText: "1-й звонок · бизнес-сущность из обязательного реестра",
  },
  routeProgram: {
    kind: "route",
    label: "Программа",
    sourceKind: "apics",
    callType: 1,
    apicsId: "credit_product",
    ruleId: "APX-002",
    readonly: true,
    readonlyPolicy: "hardReadonly",
    sourceText: "1-й звонок · бизнес-сущность из обязательного реестра",
  },
  routeConditionalApproved: {
    kind: "boolean",
    label: "Паспорт продукта подтверждает эту связку цели и программы",
    sourceKind: "method",
    required: true,
    ruleId: "GOV-002",
    visibleWhen: (route) => getProgramCompatibility(route.purpose, route.program).status === "conditional",
    note: "Для условных сочетаний ветка не должна открываться без явного подтверждения со стороны продуктовой методологии.",
  },
  programTargetGroupConfirmed: {
    kind: "boolean",
    label: "Заемщик соответствует целевой группе программы",
    sourceKind: "method",
    required: true,
    ruleId: "GOV-004",
    visibleWhen: (route) => route.program && route.program !== "base",
    note: "Общий фильтр для льготных программ: до графа нужно подтвердить, что клиент вообще попадает в целевую группу продукта.",
  },
  loanAmount: {
    kind: "money",
    label: "Сумма кредита",
    sourceKind: "apics",
    callType: 1,
    required: true,
    apicsId: "loan_amount",
    ruleId: "APX-003",
    readonlyMode: "soft",
    editPolicy: "manual_edit_allowed",
    manualFallback: true,
    importedSource: "QR/форма",
    placeholder: "Например 6 500 000",
    note: "На старте заявки этот параметр должен быть зафиксирован до перехода к объекту.",
  },
  loanTerm: {
    kind: "number",
    label: "Срок кредита, мес.",
    sourceKind: "apics",
    callType: 1,
    required: true,
    apicsId: "loan_term",
    ruleId: "APX-003",
    readonlyMode: "soft",
    editPolicy: "manual_edit_allowed",
    manualFallback: true,
    importedSource: "QR/форма",
    placeholder: "Например 240",
    note: "Срок участвует и в первом, и во втором звонке. Во втором звонке менеджер подтверждает финальную версию.",
  },
  purchaseRegion: {
    kind: "select",
    label: "Регион приобретения",
    sourceKind: "apics",
    callType: 1,
    required: true,
    apicsId: "purchase_region",
    ruleId: "APX-006",
    options: regionOptions,
    note: "Регион нужен и для маршрута сделки, и для части государственных программ.",
  },
  borrowerSurname: {
    kind: "text",
    label: "Фамилия заемщика",
    sourceKind: "apics",
    callType: 1,
    required: true,
    apicsId: "surname",
    ruleId: "APX-001",
    readonlyMode: "soft",
    readonlyPolicy: "softReadonly",
    manualFallback: true,
    importedSource: "ЦП/ДБО",
    placeholder: "Иванов",
  },
  borrowerName: {
    kind: "text",
    label: "Имя заемщика",
    sourceKind: "apics",
    callType: 1,
    required: true,
    apicsId: "first_name",
    ruleId: "APX-001",
    readonlyMode: "soft",
    readonlyPolicy: "softReadonly",
    manualFallback: true,
    importedSource: "ЦП/ДБО",
    placeholder: "Иван",
  },
  borrowerPatronymic: {
    kind: "text",
    label: "Отчество заемщика",
    sourceKind: "apics",
    callType: 1,
    apicsId: "patronymic",
    ruleId: "APX-001",
    readonlyMode: "soft",
    readonlyPolicy: "softReadonly",
    manualFallback: true,
    importedSource: "ЦП/ДБО",
    placeholder: "Иванович",
  },
  contactValue: {
    kind: "text",
    label: "Телефон / email клиента",
    sourceKind: "apics",
    callType: 1,
    required: true,
    requiredMode: "soft_required",
    blocksGraph: false,
    apicsId: "contact_value",
    ruleId: "APX-005",
    readonlyMode: "soft",
    importedSource: "ЦП/ДБО",
    placeholder: "+7 (999) 000-00-00 или client@example.ru",
    note: "Если email не пришел из ЦП, менеджер фиксирует warning про ДБО-верификацию.",
  },
  dataProcessingConsentDate: {
    kind: "date",
    label: "Дата предоставления СОПД",
    sourceKind: "apics",
    callType: 1,
    required: true,
    requiredMode: "hard_required",
    blocksGraph: true,
    apicsId: "data_processing_consent_date",
    ruleId: "APX-004",
    readonlyMode: "soft",
    importedSource: "ЦП/ДБО",
    note: "Отсутствие даты СОПД блокирует запуск основного графа.",
  },
  dealParticipants: {
    kind: "participants",
    label: "Состав участников сделки",
    sourceKind: "method",
    callType: 1,
    required: true,
    note: "Методологический контур: кто участвует в сделке и в каком качестве.",
    roles: [
      { value: "borrower", label: "Заемщик" },
      { value: "coborrower", label: "Созаемщик" },
      { value: "spouse", label: "Супруг(а)" },
      { value: "pledgor", label: "Залогодатель" },
      { value: "representative", label: "Представитель" },
      { value: "seller", label: "Продавец" },
      { value: "other", label: "Иная роль" },
    ],
  },
  nonBorrowerPledgorPresent: {
    kind: "boolean",
    label: "Есть залогодатель, который не является заемщиком",
    sourceKind: "method",
    required: true,
    note: "Если залогодатель не является заемщиком, методология требует личный пакет и документы о родстве с заемщиком.",
  },
  pledgorKinshipDocsReady: {
    kind: "boolean",
    label: "Документы о родстве залогодателя с заемщиком готовы",
    sourceKind: "method",
    required: true,
    visibleWhen: (route, state) => state.nonBorrowerPledgorPresent === "yes",
  },
  familyStatus: {
    kind: "select",
    label: "Семейный статус",
    sourceKind: "method",
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "single", label: "Не состоит в браке" },
      { value: "married", label: "Состоит в браке" },
      { value: "divorced", label: "Разведен(а)" },
      { value: "widowed", label: "Вдовец / вдова" },
    ],
  },
  incomeConfirmationType: {
    kind: "select",
    label: "Тип подтверждения дохода",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "creditor_form", label: "Справка по форме кредитора" },
      { value: "sfr", label: "Выписка из СФР" },
    ],
  },
  hasPriorGovMortgage: {
    kind: "boolean",
    label: "У заемщика или созаемщика была льготная ипотека после 23.12.2023",
    sourceKind: "method",
    required: true,
    ruleId: "GOV-001",
    note: "Для госпрограмм это ранний фильтр правила одной льготной ипотеки. Для семейных программ возможно исключение при новом ребенке и закрытом старом кредите.",
  },
  dvSpousePriorGovMortgage: {
    kind: "boolean",
    label: "У супруга заемщика была льготная ипотека после 23.12.2023",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-005",
    visibleWhen: (route) => route.program === "dv",
    note: "Для ДВиАИ правило отсутствия другой льготной ипотеки отдельно распространяется на супруга заемщика.",
  },
  useRateDiscount: {
    kind: "boolean",
    label: "Используется ли снижение ставки",
    sourceKind: "method",
    required: true,
  },
  rateReductionPeriod: {
    kind: "select",
    label: "Срок снижения ставки",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите срок" },
      { value: "1y", label: "На 1 год" },
      { value: "5y", label: "На 5 лет" },
    ],
    visibleWhen: (route, state) => state.useRateDiscount === "yes",
  },
  rateDiscountSize: {
    kind: "number",
    label: "Размер скидки по ставке",
    sourceKind: "apics",
    callType: 1,
    required: true,
    placeholder: "Например 2",
    visibleWhen: (route, state) => state.useRateDiscount === "yes",
  },
  childrenCount: {
    kind: "number",
    label: "Количество детей",
    sourceKind: "method",
    required: true,
    placeholder: "0",
  },
  familyBasis: {
    kind: "select",
    label: "Основание семейной программы",
    sourceKind: "method",
    required: true,
    options: [
      { value: "", label: "Выберите основание" },
      { value: "post2018", label: "Есть ребенок после 01.01.2018" },
      { value: "disabled_child", label: "Есть ребенок-инвалид" },
      { value: "other_family", label: "Иное подтвержденное семейное основание" },
    ],
  },
  childDob: {
    kind: "date",
    label: "Дата рождения целевого ребенка",
    sourceKind: "apics",
    callType: 1,
    required: true,
  },
  childSnils: {
    kind: "text",
    label: "СНИЛС ребенка",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    placeholder: "123-456-789 01",
    mask: "snils",
  },
  childRegistrationAddress: {
    kind: "textarea",
    label: "Адрес регистрации ребенка",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    placeholder: "Укажите адрес регистрации",
  },
  spouseRussianCitizen: {
    kind: "boolean",
    label: "Есть супруг(а) с гражданством РФ",
    sourceKind: "method",
    required: true,
  },
  spouseIncludedInDeal: {
    kind: "boolean",
    label: "Супруг(а)-гражданин РФ включен(а) в состав созаемщиков",
    sourceKind: "method",
    required: true,
    visibleWhen: (route, state) => route.program === "family" && state.spouseRussianCitizen === "yes",
  },
  newChildAfterPriorLoan: {
    kind: "boolean",
    label: "После прошлого льготного кредита родился новый ребенок",
    sourceKind: "method",
    required: true,
    ruleId: "GOV-003",
    visibleWhen: (route, state) => state.hasPriorGovMortgage === "yes",
  },
  oldLoanClosed: {
    kind: "boolean",
    label: "Предыдущий льготный кредит уже погашен",
    sourceKind: "method",
    required: true,
    ruleId: "GOV-003",
    visibleWhen: (route, state) => state.hasPriorGovMortgage === "yes",
  },
  childDisabilityDoc: {
    kind: "select",
    label: "Подтверждение инвалидности ребенка",
    sourceKind: "method",
    required: true,
    options: docStatusOptions,
    visibleWhen: (route, state) => state.familyBasis === "disabled_child",
  },
  itMainJob: {
    kind: "boolean",
    label: "Работа в ИТ-компании является основным местом работы",
    sourceKind: "method",
    required: true,
    ruleId: "IT-002",
  },
  itAgeCompliance: {
    kind: "boolean",
    label: "Возраст клиента в диапазоне 21-50 лет включительно",
    sourceKind: "method",
    required: true,
    ruleId: "IT-001",
  },
  itEmployerAccredited: {
    kind: "boolean",
    label: "Работодатель подтвержден как аккредитованная ИТ-организация",
    sourceKind: "method",
    required: true,
    ruleId: "IT-003",
  },
  itEmployerLocation: {
    kind: "select",
    label: "Локация работодателя или подразделения",
    sourceKind: "method",
    required: true,
    ruleId: "IT-004",
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "moscow", label: "Москва" },
      { value: "spb", label: "Санкт-Петербург" },
      { value: "other", label: "Иной регион" },
    ],
  },
  itLaborContractAvailable: {
    kind: "boolean",
    label: "Есть трудовой договор или допсоглашение",
    sourceKind: "method",
    required: true,
  },
  itIncomeCompliance: {
    kind: "boolean",
    label: "Доход клиента соответствует порогу программы",
    sourceKind: "method",
    required: true,
    ruleId: "IT-005",
  },
  dvCategory: {
    kind: "select",
    label: "Категория заемщика по ДВиАИ",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-001",
    options: [
      { value: "", label: "Выберите категорию" },
      { value: "young_family", label: "Молодая семья" },
      { value: "hectare", label: "Гектар" },
      { value: "doctor", label: "Медработник" },
      { value: "teacher", label: "Педработник" },
      { value: "defense", label: "Работник ОПК" },
      { value: "other", label: "Иная предусмотренная категория" },
    ],
  },
  dvPostRegistration: {
    kind: "boolean",
    label: "Клиент подтверждает пост-сделочную регистрацию",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.program === "dv",
  },
  dvPostRegistrationRequired: {
    kind: "boolean",
    label: "ДВиАИ: требуется пост-сделочная регистрация",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-006",
    visibleWhen: (route) => route.program === "dv",
  },
  dvPostRegistrationAcknowledged: {
    kind: "boolean",
    label: "Клиент принял обязательство регистрации после сделки",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-006",
    visibleWhen: (route, state) =>
      route.program === "dv" && state.dvPostRegistrationRequired === "yes",
  },
  dvAgeCompliance: {
    kind: "boolean",
    label: "Возраст соответствует категории программы",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-002",
    visibleWhen: (route, state) =>
      route.program === "dv" && state.dvCategory === "young_family",
  },
  dvOwnershipStructureAllowed: {
    kind: "boolean",
    label: "Структура собственников соответствует категории ДВиАИ",
    sourceKind: "method",
    required: true,
    ruleId: "DVA-003",
    visibleWhen: (route) => route.program === "dv",
  },
  militaryNisConfirmed: {
    kind: "boolean",
    label: "Статус участника НИС подтвержден",
    sourceKind: "method",
    required: true,
    ruleId: "MIL-003",
  },
  militaryAgeCompliance: {
    kind: "boolean",
    label: "Возраст от 25 лет и в пределах службы на дату погашения",
    sourceKind: "method",
    required: true,
    ruleId: "MIL-001",
  },
  militaryNisNumber: {
    kind: "text",
    label: "Номер НИС / идентификатор Росвоенипотеки",
    sourceKind: "method",
    required: true,
    placeholder: "20 цифр",
    mask: "nis20",
  },
  militaryCoborrowersCount: {
    kind: "number",
    label: "Количество созаемщиков",
    sourceKind: "method",
    required: true,
    ruleId: "MIL-004",
    placeholder: "0",
  },
  otherPledgorPresent: {
    kind: "boolean",
    label: "Есть иной залогодатель, кроме заемщика",
    sourceKind: "method",
    required: true,
    ruleId: "MIL-005",
    visibleWhen: (route) => route.program === "military" || route.program === "family_military",
  },
  propertyType: {
    kind: "select",
    label: "Тип недвижимости",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите тип" },
      { value: "flat", label: "Квартира" },
      { value: "house", label: "Жилой дом" },
      { value: "apartments", label: "Апартаменты" },
      { value: "room", label: "Комната" },
      { value: "townhouse", label: "Таунхаус" },
      { value: "blocked_house", label: "Жилой дом блокированной застройки" },
    ],
  },
  objectAddress: {
    kind: "textarea",
    label: "Адрес объекта",
    sourceKind: "apics",
    callType: 1,
    required: true,
    placeholder: "Улица, дом, корпус, квартира",
  },
  objectHouse: {
    kind: "text",
    label: "Дом",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
  },
  objectBuilding: {
    kind: "text",
    label: "Корпус",
    sourceKind: "csv_no_id",
    callType: 1,
  },
  objectStructure: {
    kind: "text",
    label: "Строение",
    sourceKind: "csv_no_id",
    callType: 1,
  },
  apartmentNumber: {
    kind: "text",
    label: "Квартира",
    sourceKind: "csv_no_id",
    callType: 1,
  },
  cadastralNumber: {
    kind: "text",
    label: "Кадастровый номер объекта",
    sourceKind: "apics",
    callType: 1,
    required: true,
    placeholder: "77:01:0004012:345",
    mask: "cadastral",
  },
  problemObject: {
    kind: "boolean",
    label: "Объект относится к проблемным или незавершенным правам",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "build",
  },
  buildRightsChainClear: {
    kind: "boolean",
    label: "Цепочка прав по строящемуся объекту понятна",
    sourceKind: "method",
    required: true,
    ruleId: "BUILD-001",
    visibleWhen: (route, state) => route.purpose === "build" && state.sellerType === "individual",
  },
  buildAssignmentDocsReady: {
    kind: "boolean",
    label: "Документы по цепочке уступок подтверждены",
    sourceKind: "method",
    required: true,
    ruleId: "BUILD-002",
    visibleWhen: (route, state) => route.purpose === "build" && state.sellerType === "individual",
  },
  buildProblemDocsReady: {
    kind: "boolean",
    label: "По проблемному объекту есть понимание документов и обязанного лица",
    sourceKind: "method",
    required: true,
    ruleId: "BUILD-003",
    visibleWhen: (route, state) => route.purpose === "build" && state.problemObject === "yes",
  },
  buildCommissionedWithoutRights: {
    kind: "boolean",
    label: "Дом введен в эксплуатацию, но право застройщика не зарегистрировано",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "build",
  },
  buildCommissionPermitReady: {
    kind: "boolean",
    label: "Есть документ по вводу объекта в эксплуатацию",
    sourceKind: "method",
    required: true,
    ruleId: "BUILD-004",
    visibleWhen: (route, state) =>
      route.purpose === "build" && state.buildCommissionedWithoutRights === "yes",
  },
  buildBaseContractReady: {
    kind: "boolean",
    label: "Базовый договор / документ-основание по строящемуся объекту подтвержден",
    sourceKind: "method",
    required: true,
    ruleId: "BUILD-005",
    visibleWhen: (route) => route.purpose === "build",
  },
  constructionCompletionDate: {
    kind: "date",
    label: "Срок завершения строительства",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) =>
      route.purpose === "build" ||
      route.purpose === "izhs" ||
      route.purpose === "izhs_land",
  },
  buildingFloors: {
    kind: "number",
    label: "Этажность здания",
    sourceKind: "apics",
    callType: 1,
    required: true,
  },
  unitFloor: {
    kind: "number",
    label: "Этаж помещения",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "ready" || route.purpose === "build",
  },
  roomsCount: {
    kind: "number",
    label: "Количество комнат",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "ready" || route.purpose === "build",
  },
  objectArea: {
    kind: "number",
    label: "Общая площадь",
    sourceKind: "apics",
    callType: 1,
    required: true,
  },
  kitchenArea: {
    kind: "number",
    label: "Площадь кухни",
    sourceKind: "apics",
    callType: 1,
    visibleWhen: (route) => route.purpose === "ready",
  },
  contractPrice: {
    kind: "money",
    label: "Стоимость по договору",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "ready" || route.purpose === "build",
  },
  sellerType: {
    kind: "radio",
    label: "Тип продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "individual", label: "Физическое лицо" },
      { value: "company", label: "Юридическое лицо" },
    ],
  },
  sellerFullName: {
    kind: "text",
    label: "ФИО продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "individual",
  },
  sellerPhone: {
    kind: "text",
    label: "Контактный телефон продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "individual",
    placeholder: "+7 (___) ___-__-__",
    mask: "phone",
  },
  sellerRelationToBorrower: {
    kind: "boolean",
    label: "Есть родственные связи с заемщиком",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "individual",
  },
  sellerIsEntrepreneur: {
    kind: "boolean",
    label: "Продавец является ИП",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "individual",
  },
  sellerOwnershipDoc: {
    kind: "select",
    label: "Документ-основание права продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите документ" },
      { value: "sale", label: "Договор купли-продажи" },
      { value: "ddu", label: "Договор участия в долевом строительстве" },
      { value: "inheritance", label: "Свидетельство о наследстве" },
      { value: "gift", label: "Договор дарения" },
      { value: "court", label: "Решение суда" },
      { value: "other", label: "Иной документ" },
    ],
  },
  representativeNeeded: {
    kind: "boolean",
    label: "Есть представитель по доверенности",
    sourceKind: "method",
    required: true,
  },
  representativeName: {
    kind: "text",
    label: "Доверенное лицо",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.representativeNeeded === "yes",
  },
  fillSellerFromDeveloper: {
    kind: "boolean",
    label: "Данные продавца нужно заполнить от застройщика",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "company" && route.purpose === "build",
  },
  sellerCompanyEmail: {
    kind: "email",
    label: "Email контактного лица продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "company",
    placeholder: "example@company.ru",
  },
  sellerCompanyInn: {
    kind: "text",
    label: "ИНН продавца",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "company",
    placeholder: "10 или 12 цифр",
    mask: "inn10or12",
  },
  sellerCompanyName: {
    kind: "text",
    label: "Наименование юридического лица",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => state.sellerType === "company",
  },
  sellerCompanyPhone: {
    kind: "text",
    label: "Телефон юридического лица",
    sourceKind: "apics",
    callType: 1,
    visibleWhen: (route, state) => state.sellerType === "company",
    placeholder: "+7 (___) ___-__-__",
    mask: "phone",
  },
  egrnStatus: {
    kind: "select",
    label: "Статус выписки ЕГРН",
    sourceKind: "apics",
    callType: 1,
    options: docStatusOptions,
    visibleWhen: (route) => route.purpose === "ready" || route.purpose === "pledge",
  },
  birthCertificatesStatus: {
    kind: "select",
    label: "Статус свидетельств о рождении",
    sourceKind: "apics",
    callType: 1,
    options: docStatusOptions,
    visibleWhen: (route, state) =>
      route.program === "family" ||
      route.program === "family_military" ||
      state.minorParticipants === "yes",
  },
  guardianshipStatus: {
    kind: "select",
    label: "Статус решения органов опеки",
    sourceKind: "apics",
    callType: 1,
    options: docStatusOptions,
    visibleWhen: (route, state) => state.minorParticipants === "yes",
  },
  appraisalReportNumber: {
    kind: "text",
    label: "Номер отчета об оценке",
    sourceKind: "apics",
    callType: 1,
    apicsId: "appraisal_report_number",
    ruleId: "APX-OBJ-003",
    readonlyMode: "soft",
    autoloadMode: "simulated_manual",
    manualFallback: true,
    importedSource: "отчет об оценке",
    placeholder: "Укажите номер отчета",
    visibleWhen: (route) =>
      route.purpose === "ready" ||
      route.purpose === "pledge" ||
      route.purpose === "izhs" ||
      route.purpose === "izhs_land",
  },
  minorParticipants: {
    kind: "boolean",
    label: "Есть несовершеннолетние участники или собственники",
    sourceKind: "method",
    required: true,
  },
  constructionExecutor: {
    kind: "select",
    label: "Кто исполняет строительство",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "ip", label: "ИП" },
      { value: "company", label: "Юридическое лицо" },
      { value: "self", label: "Собственными силами" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  eiszhcsId: {
    kind: "text",
    label: "Идентификатор ЕИСЖС / строим.дом.рф",
    sourceKind: "apics",
    callType: 1,
    apicsId: "eiszhcs_id",
    ruleId: "APX-OBJ-004",
    readonlyMode: "soft",
    importedSource: "ЕИСЖС / строим.дом.рф",
    placeholder: "ID объекта или проекта",
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landCadastralNumber: {
    kind: "text",
    label: "Кадастровый номер участка",
    sourceKind: "method",
    required: true,
    placeholder: "77:01:0004012:345",
    mask: "cadastral",
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landBoundariesKnown: {
    kind: "boolean",
    label: "Границы участка установлены",
    sourceKind: "method",
    required: true,
    apicsId: "land_survey_flag",
    ruleId: "APX-OBJ-001",
    mappingStatus: "direct_boolean",
    sourceText: "APICS land_survey_flag → системная проверка границ участка",
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  landOwnershipAllowed: {
    kind: "boolean",
    label: "На участок оформлено допустимое право собственности",
    sourceKind: "method",
    required: true,
    ruleId: "LAND-001",
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  landRegionAllowed: {
    kind: "boolean",
    label: "Участок находится в допустимом регионе и на допустимой территории",
    sourceKind: "method",
    required: true,
    ruleId: "LAND-007",
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  landZoneAllowed: {
    kind: "boolean",
    label: "По участку нет запрещенных зон и категорий земель",
    sourceKind: "method",
    required: true,
    ruleId: "LAND-005",
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  landUseAllowed: {
    kind: "boolean",
    label: "ВРИ и категория земли допускают законное строительство жилья",
    sourceKind: "method",
    required: true,
    ruleId: "LAND-004",
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  foundationAllowed: {
    kind: "boolean",
    label: "Конструктив и фундамент допустимы",
    sourceKind: "method",
    required: true,
    apicsId: "foundation_type",
    ruleId: "APX-OBJ-002",
    mappingStatus: "proxy_boolean",
    apicsProxyFor: "foundation_type",
    sourceText: "APICS foundation_type → boolean-проверка допустимости фундамента",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  izhsNoExtraBuildings: {
    kind: "boolean",
    label: "На участке нет недопустимых посторонних капитальных строений",
    sourceKind: "method",
    required: true,
    ruleId: "LAND-006",
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseTerritoryAllowed: {
    kind: "boolean",
    label: "Дом находится на допустимой территории",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-009",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseBuiltYear: {
    kind: "number",
    label: "Год постройки дома",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-001",
    placeholder: "Например 2008",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseRightsRegistered: {
    kind: "boolean",
    label: "Право собственности на дом зарегистрировано",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-002",
    visibleWhen: (route, state) => isPurchasedHousePrecheck(route, state),
  },
  houseYearRoundReady: {
    kind: "boolean",
    label: "Дом пригоден для круглогодичного проживания",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-003",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseAllSeasonAccess: {
    kind: "boolean",
    label: "Есть круглогодичный доступ к дому",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-004",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseStructureReady: {
    kind: "boolean",
    label: "Обязательные конструктивные элементы дома подтверждены",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-008",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseCommunicationsReady: {
    kind: "boolean",
    label: "Коммуникации дома соответствуют методологии",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-011",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseHeatingAllowed: {
    kind: "boolean",
    label: "Отопление дома не является только печным",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-012",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
    note: "По check_metodic_v2.md отопление только печное является стоп-фактором для жилого дома.",
  },
  houseSanitaryReady: {
    kind: "boolean",
    label: "Есть санузел или подтвержденные коммуникации для его устройства",
    sourceKind: "method",
    required: true,
    ruleId: "HOUSE-013",
    visibleWhen: (route, state) => isHousePrecheck(route, state),
  },
  houseAddress: {
    kind: "textarea",
    label: "Адрес жилого дома",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseAddressHouse: {
    kind: "text",
    label: "Дом",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseAddressBuilding: {
    kind: "text",
    label: "Корпус",
    sourceKind: "csv_no_id",
    callType: 1,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseAddressStructure: {
    kind: "text",
    label: "Строение",
    sourceKind: "csv_no_id",
    callType: 1,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  livingArea: {
    kind: "number",
    label: "Жилая площадь дома",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseType: {
    kind: "select",
    label: "Тип дома",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "wood", label: "Деревянный" },
      { value: "brick", label: "Кирпичный" },
      { value: "blocks", label: "Дом из блоков" },
      { value: "frame", label: "Каркасный" },
      { value: "monolith", label: "Монолитный" },
      { value: "panel", label: "Панельный" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  finishingType: {
    kind: "select",
    label: "Тип отделки",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "none", label: "Без отделки" },
      { value: "final", label: "Финишная" },
      { value: "preclean", label: "Предчистовая" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  heatingType: {
    kind: "select",
    label: "Отопление",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "mixed", label: "Смешанное газово-электрическое" },
      { value: "central", label: "Центральное" },
      { value: "electric", label: "Электрическое" },
      { value: "gas_boiler", label: "Газовый котел" },
      { value: "solid_boiler", label: "Твердотопливный котел" },
      { value: "other", label: "Иное" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  electricitySupply: {
    kind: "select",
    label: "Электроснабжение",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "central", label: "Центральное" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  gasSupply: {
    kind: "select",
    label: "Газоснабжение",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "central", label: "Центральное" },
      { value: "autonomous", label: "Автономное" },
      { value: "none", label: "Нет" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  waterSupply: {
    kind: "select",
    label: "Водоснабжение",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "central", label: "Центральное" },
      { value: "well", label: "Скважина с автоподачей воды" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  sewerageHouse: {
    kind: "select",
    label: "Водоотведение дома",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "central", label: "Центральное" },
      { value: "septic", label: "Септик" },
      { value: "bio", label: "Станция биоочистки" },
      { value: "other", label: "Иное" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseFloorsAboveGround: {
    kind: "number",
    label: "Количество надземных этажей",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  bathroomsCount: {
    kind: "number",
    label: "Количество санузлов",
    sourceKind: "apics",
    callType: 1,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  ceilingHeight: {
    kind: "number",
    label: "Высота помещений, м",
    sourceKind: "apics",
    callType: 1,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  hasBasement: {
    kind: "boolean",
    label: "Есть цокольный этаж",
    sourceKind: "apics",
    callType: 1,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landArea: {
    kind: "number",
    label: "Площадь земельного участка",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) => hasLandPrecheck(route, state),
  },
  landCategory: {
    kind: "text",
    label: "Категория земель",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landUseType: {
    kind: "text",
    label: "Вид разрешенного использования",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landRestrictions: {
    kind: "boolean",
    label: "Есть ограничения по кредитованию земли",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  utilityElectricity: {
    kind: "boolean",
    label: "Электричество подведено",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  utilityGas: {
    kind: "boolean",
    label: "Газоснабжение на участке доступно",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  utilityWater: {
    kind: "boolean",
    label: "Водоснабжение на участке доступно",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  utilitySewerage: {
    kind: "boolean",
    label: "Водоотведение на участке доступно",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landAddress: {
    kind: "textarea",
    label: "Адрес земельного участка",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  landContractPrice: {
    kind: "money",
    label: "Стоимость участка по договору",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  houseContractPrice: {
    kind: "money",
    label: "Стоимость дома / цена подряда",
    sourceKind: "csv_no_id",
    callType: 1,
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  contractorType: {
    kind: "radio",
    label: "Тип подрядчика",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "ip", label: "ИП" },
      { value: "company", label: "Юридическое лицо" },
      { value: "self", label: "Собственными силами" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  contractorIpInn: {
    kind: "text",
    label: "ИНН подрядчика ИП",
    sourceKind: "apics",
    callType: 1,
    required: true,
    placeholder: "12 цифр",
    mask: "inn12",
    visibleWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") && state.contractorType === "ip",
  },
  contractorIpName: {
    kind: "text",
    label: "Полное наименование ИП",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") && state.contractorType === "ip",
  },
  contractorCompanyInn: {
    kind: "text",
    label: "ИНН подрядчика",
    sourceKind: "apics",
    callType: 1,
    required: true,
    placeholder: "10 цифр",
    mask: "inn10",
    visibleWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") && state.contractorType === "company",
  },
  contractorCompanyName: {
    kind: "text",
    label: "Наименование подрядчика",
    sourceKind: "apics",
    callType: 1,
    required: true,
    visibleWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") && state.contractorType === "company",
  },
  contractorConstructionDoc: {
    kind: "select",
    label: "Документ-основание строительства",
    sourceKind: "apics",
    callType: 1,
    required: true,
    options: [
      { value: "", label: "Выберите документ" },
      { value: "construction", label: "Договор подряда" },
      { value: "future_sale", label: "Договор купли-продажи будущей недвижимости" },
      { value: "pre_sale", label: "Предварительный договор купли-продажи" },
      { value: "house_land_sale", label: "Договор купли-продажи дома с участком" },
      { value: "ddu", label: "Договор участия в долевом строительстве" },
    ],
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  finalLoanTerm: {
    kind: "number",
    label: "Финальный срок кредита",
    sourceKind: "apics",
    callType: 2,
    required: true,
    placeholder: "Например 240",
  },
  ownershipForm: {
    kind: "select",
    label: "Форма собственности",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "sole", label: "Собственность" },
      { value: "shared", label: "Общая долевая собственность" },
    ],
  },
  titleDocType: {
    kind: "select",
    label: "Тип документа-основания",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите документ" },
      { value: "sale", label: "Договор купли-продажи" },
      { value: "ddu", label: "Договор долевого участия" },
      { value: "assignment", label: "Переуступка прав требования" },
      { value: "gift", label: "Договор дарения" },
      { value: "construction", label: "Договор подряда" },
    ],
  },
  titleDocName: {
    kind: "text",
    label: "Наименование документа",
    sourceKind: "apics",
    callType: 2,
    required: true,
  },
  titleDocNumber: {
    kind: "text",
    label: "Номер документа",
    sourceKind: "apics",
    callType: 2,
    required: true,
  },
  titleDocDate: {
    kind: "date",
    label: "Дата заключения документа",
    sourceKind: "apics",
    callType: 2,
    required: true,
  },
  maritalRegimeClear: {
    kind: "boolean",
    label: "Брачный режим и согласие супруга проверены",
    sourceKind: "method",
    required: true,
  },
  sellerOwnershipYears: {
    kind: "number",
    label: "Срок владения продавца, лет",
    sourceKind: "method",
    visibleWhen: (route) => route.purpose === "ready" || route.purpose === "pledge",
  },
  izhsProjectReady: {
    kind: "boolean",
    label: "Архитектурный проект и паспорт строящегося дома готовы",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "izhs" || route.purpose === "izhs_land",
  },
  izhsLandInspectionActReady: {
    kind: "boolean",
    label: "Акт осмотра земельного участка готов для аккредитива",
    sourceKind: "method",
    required: true,
    visibleWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") &&
      state.paymentMethod === "accreditive",
    note: "По check_metodic_v2.md при аккредитивной форме расчетов до выдачи по ИЖС нужен акт осмотра земельного участка.",
  },
  refiOriginalContractNumber: {
    kind: "text",
    label: "Номер первоначального договора",
    sourceKind: "apics",
    callType: 2,
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiOriginalContractDate: {
    kind: "date",
    label: "Дата первоначального договора",
    sourceKind: "apics",
    callType: 2,
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiOrgType: {
    kind: "select",
    label: "Тип организации-кредитора",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите тип" },
      { value: "bank", label: "Банк" },
      { value: "lender", label: "Иная кредитная организация" },
      { value: "other", label: "Иная организация" },
    ],
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiOrgName: {
    kind: "text",
    label: "Наименование кредитора",
    sourceKind: "apics",
    callType: 2,
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiPrevDomrf: {
    kind: "boolean",
    label: "Предыдущий кредитор — ДОМ.РФ",
    sourceKind: "apics",
    callType: 2,
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiPrevContractNumber: {
    kind: "text",
    label: "Номер предшествующего договора",
    sourceKind: "apics",
    callType: 2,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiPrevContractDate: {
    kind: "date",
    label: "Дата предшествующего договора",
    sourceKind: "apics",
    callType: 2,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiPrevContractType: {
    kind: "select",
    label: "Тип предшествующего договора",
    sourceKind: "apics",
    callType: 2,
    options: [
      { value: "", label: "Выберите тип" },
      { value: "credit", label: "Кредитный договор" },
      { value: "loan", label: "Договор займа" },
      { value: "other", label: "Иной договор" },
    ],
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiChainCount: {
    kind: "number",
    label: "Количество договоров в цепочке рефинанса",
    sourceKind: "method",
    required: true,
    placeholder: "1",
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiBorrowerLinkedToOld: {
    kind: "boolean",
    label: "Новый заемщик связан со старым кредитом",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiPskAvailable: {
    kind: "boolean",
    label: "Уведомление о ПСК есть в пакете",
    sourceKind: "method",
    required: true,
    ruleId: "REFI-006",
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiBorrowerRemains: {
    kind: "boolean",
    label: "В новой сделке остается хотя бы один участник старого кредита",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiAllPledgorsRemain: {
    kind: "boolean",
    label: "Все старые залогодатели переходят в новую сделку",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
  },
  refiObjectSameAsOld: {
    kind: "boolean",
    label: "Объект в новом кредите идентичен объекту старого кредита",
    sourceKind: "method",
    required: true,
    visibleWhen: (route) => route.purpose === "refi",
    note: "Методология рефинанса блокирует сценарий, если новый кредит оформляется на другой объект.",
  },
  paymentMethod: {
    kind: "select",
    label: "Способ расчетов",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "accreditive", label: "До регистрации через аккредитив" },
      { value: "cell", label: "До регистрации через банковскую ячейку" },
      { value: "debt_close", label: "До регистрации на погашение задолженности" },
      { value: "post_registration", label: "После государственной регистрации" },
    ],
  },
  specialAccountFlag: {
    kind: "select",
    label: "Специальный счет",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "none", label: "Не используется" },
      { value: "escrow", label: "Счет эскроу" },
      { value: "pledge", label: "Залоговый счет" },
    ],
  },
  escrowOpened: {
    kind: "select",
    label: "Где открыт эскроу-счет",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "domrf", label: "В Банке ДОМ.РФ" },
      { value: "other_bank", label: "В ином банке" },
    ],
    visibleWhen: (route, state) => state.specialAccountFlag === "escrow",
  },
  externalEscrow: {
    kind: "boolean",
    label: "Эскроу или перечисление идут вне Банка ДОМ.РФ",
    sourceKind: "method",
    required: true,
    visibleWhen: (route, state) => state.specialAccountFlag === "escrow" || state.paymentMethod === "post_registration",
  },
  pvControl: {
    kind: "select",
    label: "Контур контроля первоначального взноса",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "full_domrf", label: "ПВ полностью через Банк ДОМ.РФ" },
      { value: "partial_domrf", label: "ПВ частично через Банк ДОМ.РФ" },
    ],
  },
  pvDomrfAmount: {
    kind: "money",
    label: "Сумма ПВ, размещенная в Банке ДОМ.РФ",
    sourceKind: "apics",
    callType: 2,
    visibleWhen: (route, state) => state.pvControl === "partial_domrf",
  },
  pvDocAmount: {
    kind: "money",
    label: "Сумма, по которой нужен подтверждающий документ по ПВ",
    sourceKind: "csv_no_id",
    callType: 2,
  },
  subsidyInPvAmount: {
    kind: "money",
    label: "Сумма субсидии в ПВ",
    sourceKind: "csv_no_id",
    callType: 2,
  },
  subsidyName: {
    kind: "select",
    label: "Наименование субсидии",
    sourceKind: "apics",
    callType: 2,
    options: [
      { value: "", label: "Нет субсидии" },
      { value: "msk", label: "Материнский капитал" },
      { value: "czz", label: "ЦЖЗ" },
      { value: "certificate", label: "Государственный жилищный сертификат" },
      { value: "housing", label: "Программа Жилище" },
      { value: "other", label: "Иная субсидия" },
    ],
  },
  subsidyAmount: {
    kind: "money",
    label: "Сумма субсидии",
    sourceKind: "apics",
    callType: 2,
    visibleWhen: (route, state) => !!state.subsidyName,
  },
  downPayment: {
    kind: "money",
    label: "Первоначальный взнос",
    sourceKind: "apics",
    callType: 2,
    required: true,
  },
  finalRateReductionPeriod: {
    kind: "select",
    label: "Подтвержденный срок снижения ставки",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите срок" },
      { value: "1y", label: "На 1 год" },
      { value: "5y", label: "На 5 лет" },
    ],
    visibleWhen: (route, state) => state.useRateDiscount === "yes",
  },
  finalRateDiscountSize: {
    kind: "number",
    label: "Подтвержденный размер скидки по ставке",
    sourceKind: "apics",
    callType: 2,
    required: true,
    placeholder: "Например 2",
    visibleWhen: (route, state) => state.useRateDiscount === "yes",
  },
  personalInsurance: {
    kind: "boolean",
    label: "Оформляется личное страхование",
    sourceKind: "apics",
    callType: 2,
    required: true,
  },
  insurancePolicyholder: {
    kind: "select",
    label: "Страхователь",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "borrower", label: "Заемщик" },
      { value: "coborrower", label: "Созаемщик" },
      { value: "both", label: "Несколько участников" },
    ],
    visibleWhen: (route, state) => state.personalInsurance === "yes",
  },
  insuranceType: {
    kind: "multi",
    label: "Вид страхования",
    sourceKind: "apics",
    callType: 2,
    options: [
      { value: "life", label: "Жизнь" },
      { value: "property", label: "Имущество" },
      { value: "title", label: "Титул" },
    ],
    visibleWhen: (route, state) => state.personalInsurance === "yes",
  },
  useForDbo: {
    kind: "boolean",
    label: "Использовать контакт для ДБО",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
  },
  dealDateTime: {
    kind: "datetime-local",
    label: "Дата и время сделки",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
  },
  paymentDay: {
    kind: "number",
    label: "День платежа",
    sourceKind: "csv_no_id",
    callType: 2,
    placeholder: "1-31",
    required: true,
    mask: "day",
  },
  transactionLocation: {
    kind: "select",
    label: "Место проведения сделки",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "office", label: "Офис кредитора" },
      { value: "courier", label: "Внеофисно внешним курьером" },
      { value: "mobile", label: "Внеофисно мобильным банкиром" },
      { value: "builder_bank", label: "На территории застройщика сотрудником банка" },
      { value: "builder_rep", label: "На территории застройщика сотрудником застройщика" },
      { value: "remote", label: "Внеофисно дистанционным сотрудником банка" },
    ],
  },
  clientIdentificationMethod: {
    kind: "select",
    label: "Способ идентификации клиента",
    sourceKind: "apics",
    callType: 2,
    required: true,
    options: [
      { value: "", label: "Выберите вариант" },
      { value: "office", label: "Сотрудник в офисе банка / агента" },
      { value: "mobile", label: "Мобильный банкир" },
      { value: "courier", label: "Курьер" },
      { value: "builder", label: "Сотрудник застройщика" },
    ],
  },
  contractConclusionLocation: {
    kind: "textarea",
    label: "Место заключения договора",
    sourceKind: "apics",
    callType: 2,
    required: true,
    apicsId: "contract_conclusion_location",
    ruleId: "KD-005",
    readonlyMode: "soft",
    prefillPolicy: "manual_soft_warning",
    manualFallback: true,
    importedSource: "регион объекта",
    placeholder: "Обычно подтягивается из региона объекта",
  },
  recipientAccountOwnerRole: {
    kind: "text",
    label: "Роль владельца счета",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
    visibleWhen: (route, state) => state.externalEscrow === "yes",
  },
  recipientAccountOwnerName: {
    kind: "text",
    label: "ФИО владельца счета",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
    visibleWhen: (route, state) => state.externalEscrow === "yes",
  },
  recipientBank: {
    kind: "text",
    label: "Банк получателя",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
    visibleWhen: (route, state) => state.externalEscrow === "yes",
  },
  recipientSettlementAccount: {
    kind: "text",
    label: "Расчетный счет получателя",
    sourceKind: "csv_no_id",
    callType: 2,
    required: true,
    placeholder: "20 цифр",
    mask: "account20",
    visibleWhen: (route, state) => state.externalEscrow === "yes",
  },
};

const nodes = [
  {
    id: "application",
    title: "Каркас заявки",
    callType: 1,
    badge: "call1",
    description:
      "Сначала зафиксируйте цель, программу, сумму, срок и регион. Не переходите к объекту, пока рамка заявки не ясна.",
    why:
      "Этот блок нужен, чтобы не спутать продуктовую ветку, цель кредита и базовые параметры заявки до начала детального разговора.",
    questions: [
      "Какой сценарий вы сейчас рассматриваете: покупка, стройка, ИЖС или перекредитование?",
      "На какую сумму и срок кредита вы ориентируетесь?",
      "В каком регионе планируется объект?",
    ],
    regulatory: [
      "Цель кредита и программа должны быть определены до перехода к объектной ветке.",
      "Льготную программу нельзя назначать без явного основания.",
    ],
    completion: [
      "Выбраны цель кредита и программа.",
      "Зафиксированы сумма, срок и регион.",
    ],
    fields: [
      "routePurpose",
      "routeProgram",
      "loanAmount",
      "loanTerm",
      "purchaseRegion",
      "dataProcessingConsentDate",
    ],
  },
  {
    id: "client",
    title: "Профиль клиента и состав сделки",
    callType: 1,
    badge: "call1",
    description:
      "Определите всех участников сделки и ключевые признаки клиента. Сразу отметьте супругов, представителей, залогодателей и несовершеннолетних.",
    why:
      "Состав участников влияет на документы, брачный режим, опеку, доверенности и допустимость программы.",
    questions: [
      "Кто будет заемщиком, созаемщиком или залогодателем?",
      "Есть ли супруг, представитель или несовершеннолетний участник?",
      "Как подтверждается доход клиента?",
    ],
    regulatory: [
      "Проверка состава участников не должна переноситься на второй звонок.",
      "Для государственных программ важно рано отметить прошлую льготную ипотеку.",
    ],
    completion: [
      "Понятен состав участников сделки.",
      "Нет неразобранных стоп-факторов по клиенту.",
    ],
    fields: [
      "borrowerSurname",
      "borrowerName",
      "borrowerPatronymic",
      "contactValue",
      "dealParticipants",
      "nonBorrowerPledgorPresent",
      "pledgorKinshipDocsReady",
      "familyStatus",
      "incomeConfirmationType",
      "hasPriorGovMortgage",
      "minorParticipants",
      "useRateDiscount",
      "rateReductionPeriod",
      "rateDiscountSize",
    ],
  },
  {
    id: "program_family",
    title: "Проверка семейной программы",
    callType: 1,
    badge: "call1",
    routePrograms: ["family"],
    description:
      "Проверьте, за счет какого семейного основания клиент проходит программу. Если основание не подтверждается, смените маршрут до продолжения.",
    why:
      "Если семейное основание не подтверждено, менеджер не должен продолжать сценарий как льготный.",
    questions: [
      "На каком основании клиент идет в семейную программу?",
      "Сколько детей и кто дает право на льготу?",
      "Если была льготная ипотека раньше, появилось ли новое основание?",
    ],
    regulatory: [
      "Для семейной программы важны дети, семейный статус и история предыдущей льготной ипотеки.",
      "При сценарии с ребенком-инвалидом нужен отдельный подтверждающий документ.",
    ],
    completion: [
      "Подтверждено основание семейной льготы.",
      "Проверено участие супруга(и), если это требуется.",
    ],
    fields: [
      "childrenCount",
      "familyBasis",
      "childDob",
      "childSnils",
      "childRegistrationAddress",
      "spouseRussianCitizen",
      "spouseIncludedInDeal",
      "newChildAfterPriorLoan",
      "oldLoanClosed",
      "childDisabilityDoc",
    ],
  },
  {
    id: "program_it",
    title: "Проверка ИТ-программы",
    callType: 1,
    badge: "call1",
    routePrograms: ["it"],
    description:
      "Подтвердите основную работу в ИТ, работодателя, возраст и доход. Не обсуждайте объект как ИТ-сценарий, пока допуск не понятен.",
    why:
      "Эта программа опирается не на объект, а на статус занятости и работодателя.",
    questions: [
      "Работа в ИТ-компании является основным местом работы?",
      "Работодатель подтвержден как аккредитованный?",
      "Есть трудовой договор и подходит ли возраст клиента под программу?",
    ],
    regulatory: [
      "ИТ-ветка требует проверки работодателя и соответствия условиям программы до перехода к объекту.",
      "Локация работодателя или подразделения может влиять на допустимость сценария.",
    ],
    completion: [
      "Проверен работодатель и подтверждена занятость.",
      "Нет сомнений по возрастному и региональному критерию.",
    ],
    fields: [
      "itMainJob",
      "itAgeCompliance",
      "itEmployerAccredited",
      "itEmployerLocation",
      "itLaborContractAvailable",
      "itIncomeCompliance",
    ],
  },
  {
    id: "program_dv",
    title: "Проверка ДВиАИ",
    callType: 1,
    badge: "call1",
    routePrograms: ["dv"],
    description:
      "Выберите категорию клиента и проверьте регион объекта. Отдельно проговорите пост-сделочную регистрацию и прошлые льготные кредиты.",
    why:
      "Категория клиента и готовность к пост-сделочной регистрации должны быть зафиксированы как отдельные бизнес-сущности.",
    questions: [
      "По какой категории клиент идет в программу?",
      "Объект находится в ДФО или Арктической зоне?",
      "Была ли льготная ипотека после 23.12.2023 у супруга заемщика?",
      "Готов ли клиент к пост-сделочной регистрации, если она обязательна?",
    ],
    regulatory: [
      "Категория заемщика по ДВиАИ не должна оставаться только текстовой заметкой.",
      "Для ДВиАИ объект должен находиться в ДФО / Арктической зоне.",
      "Правило отсутствия другой льготной ипотеки распространяется также на супруга заемщика.",
      "Пост-сделочная регистрация — это отдельный контроль, а не комментарий.",
    ],
    completion: [
      "Выбрана категория заемщика.",
      "Пост-сделочное обязательство отмечено.",
    ],
    fields: [
      "purchaseRegion",
      "dvCategory",
      "dvAgeCompliance",
      "dvOwnershipStructureAllowed",
      "dvSpousePriorGovMortgage",
      "dvPostRegistrationRequired",
      "dvPostRegistrationAcknowledged",
    ],
  },
  {
    id: "program_military",
    title: "Проверка военной программы",
    callType: 1,
    badge: "call1",
    routePrograms: ["military"],
    description:
      "Сначала подтвердите НИС, возраст и отсутствие запретной структуры участников. Созаемщики и иные залогодатели требуют остановки сценария.",
    why:
      "Статус НИС и наличие созаемщиков являются ранними ограничителями ветки.",
    questions: [
      "Есть ли подтверждение участия в НИС?",
      "Планируются ли созаемщики или иная нестандартная структура сделки?",
    ],
    regulatory: [
      "Военная схема чувствительна к составу участников.",
      "Номер или подтверждение Росвоенипотеки лучше фиксировать в начале маршрута.",
    ],
    completion: [
      "Подтвержден статус НИС.",
      "Структура участников сделки не конфликтует с программой.",
    ],
    fields: [
      "militaryAgeCompliance",
      "militaryNisConfirmed",
      "militaryNisNumber",
      "militaryCoborrowersCount",
      "otherPledgorPresent",
    ],
  },
  {
    id: "program_family_military",
    title: "Проверка семейной программы для военнослужащих",
    callType: 1,
    badge: "call1",
    routePrograms: ["family_military"],
    description:
      "Проверьте семейное основание и военный контур одновременно. Если не сходится хотя бы одна часть, не ведите клиента по этой ветке.",
    why:
      "Если потерять хотя бы одну из двух веток, сценарий станет методологически некорректным.",
    questions: [
      "Какое семейное основание подтверждает льготу?",
      "Есть ли действующий статус НИС и допустимый состав участников?",
      "Заемщик не состоит в браке или супруг(а) не имеет гражданства РФ?",
    ],
    regulatory: [
      "Нужно удержать и семейный, и военный контур без переноса одного из них на следующий звонок.",
      "Стандартный сценарий семейной программы для военнослужащих блокируется при браке с супругом(ой) с гражданством РФ.",
    ],
    completion: [
      "Подтверждено семейное основание.",
      "Подтвержден статус НИС и отсутствие запретной структуры сделки.",
    ],
    fields: [
      "childrenCount",
      "familyBasis",
      "childDob",
      "childSnils",
      "childRegistrationAddress",
      "spouseRussianCitizen",
      "newChildAfterPriorLoan",
      "oldLoanClosed",
      "militaryAgeCompliance",
      "militaryNisConfirmed",
      "militaryNisNumber",
      "militaryCoborrowersCount",
      "otherPledgorPresent",
    ],
  },
  {
    id: "purpose_ready",
    title: "Ветка объекта: готовое жилье",
    callType: 1,
    badge: "call1",
    routePurposes: ["ready", "pledge"],
    description:
      "Соберите объект, продавца и основание права. Сразу отметьте доверенность, оценку, опеку и документы, которые нужно запросить.",
    why:
      "Во вторичке важно рано понять объект, продавца, опеку и документ-основание права собственности.",
    questions: [
      "Какой объект выбран и кто продавец?",
      "Есть ли оценка, доверенность или несовершеннолетний участник?",
      "Какой документ лежит в основе права продавца?",
    ],
    regulatory: [
      "ЕГРН, оценка и опека — отдельные обязательные сущности этой ветки.",
      "Для залога действуют те же юридические принципы, что и для готового жилья.",
    ],
    completion: [
      "Понятен объект и продавец.",
      "Не пропущены право собственности и ранние документные триггеры.",
    ],
    fields: [
      "propertyType",
      "objectAddress",
      "objectHouse",
      "objectBuilding",
      "objectStructure",
      "apartmentNumber",
      "cadastralNumber",
      "buildingFloors",
      "unitFloor",
      "roomsCount",
      "objectArea",
      "kitchenArea",
      "contractPrice",
      "sellerType",
      "sellerFullName",
      "sellerPhone",
      "sellerRelationToBorrower",
      "sellerIsEntrepreneur",
      "sellerOwnershipDoc",
      "representativeNeeded",
      "representativeName",
      "sellerCompanyEmail",
      "sellerCompanyInn",
      "sellerCompanyName",
      "sellerCompanyPhone",
    ],
  },
  {
    id: "purpose_build",
    title: "Ветка объекта: строящееся жилье",
    callType: 1,
    badge: "call1",
    routePurposes: ["build"],
    description:
      "Уточните тип договора, статус объекта и кто продает право. Если есть уступка или проблемный объект, сразу раскройте цепочку прав.",
    why:
      "Если потерять тип договора и статус объекта, второй звонок превратится в набор неподтвержденных документов.",
    questions: [
      "Это прямой ДДУ, уступка или иной договор по строящемуся объекту?",
      "Есть ли проблемный объект или незавершенная регистрация права?",
      "Кто фактически выступает продавцом?",
    ],
    regulatory: [
      "По уступке и проблемным объектам нужен расширенный пакет прав и платежных документов.",
      "Разрешение на ввод требуется, если объект введен, а право еще не зарегистрировано.",
    ],
    completion: [
      "Понятен тип договора и статус объекта.",
      "Не потеряна цепочка прав по строящемуся жилью.",
    ],
    fields: [
      "propertyType",
      "objectAddress",
      "objectHouse",
      "objectBuilding",
      "objectStructure",
      "apartmentNumber",
      "cadastralNumber",
      "constructionCompletionDate",
      "problemObject",
      "buildRightsChainClear",
      "buildAssignmentDocsReady",
      "buildProblemDocsReady",
      "buildCommissionedWithoutRights",
      "buildCommissionPermitReady",
      "buildBaseContractReady",
      "buildingFloors",
      "unitFloor",
      "roomsCount",
      "objectArea",
      "contractPrice",
      "sellerType",
      "sellerOwnershipDoc",
      "fillSellerFromDeveloper",
      "sellerFullName",
      "sellerPhone",
      "sellerRelationToBorrower",
      "sellerIsEntrepreneur",
      "sellerCompanyEmail",
      "sellerCompanyInn",
      "sellerCompanyName",
      "sellerCompanyPhone",
    ],
  },
  {
    id: "purpose_izhs",
    title: "Ветка объекта: ИЖС",
    callType: 1,
    badge: "call1",
    routePurposes: ["izhs", "izhs_land"],
    description:
      "Разведите землю, дом и подрядчика как три отдельные части разговора. Проверьте границы, ВРИ, конструктив и источник строительства.",
    why:
      "ИЖС нельзя описывать одной сущностью: методология требует отдельно держать землю, дом и контур строительства.",
    questions: [
      "Есть ли участок и установлены ли его границы?",
      "Кто строит объект и на каком основании?",
      "Какие коммуникации, конструктив и цены уже известны?",
    ],
    regulatory: [
      "Категория земли, ВРИ, границы участка и допустимость фундамента должны быть проверены до второго звонка.",
      "Сценарий с собственными силами требует отдельного внимания и не должен выглядеть как обычный подрядчик.",
    ],
    completion: [
      "Описаны участок, дом и строительный контур.",
      "Понятен подрядчик и базовый пакет ИЖС-документов.",
    ],
    fields: [
      "constructionExecutor",
      "eiszhcsId",
      "landCadastralNumber",
      "landBoundariesKnown",
      "foundationAllowed",
      "constructionCompletionDate",
      "objectArea",
      "houseAddress",
      "eiszhcsId",
      "houseAddressHouse",
      "houseAddressBuilding",
      "houseAddressStructure",
      "livingArea",
      "houseType",
      "finishingType",
      "heatingType",
      "electricitySupply",
      "gasSupply",
      "waterSupply",
      "sewerageHouse",
      "houseFloorsAboveGround",
      "bathroomsCount",
      "ceilingHeight",
      "hasBasement",
      "landArea",
      "landCategory",
      "landUseType",
      "landRestrictions",
      "utilityElectricity",
      "utilityGas",
      "utilityWater",
      "utilitySewerage",
      "landAddress",
      "landContractPrice",
      "houseContractPrice",
      "contractorType",
      "contractorIpInn",
      "contractorIpName",
      "contractorCompanyInn",
      "contractorCompanyName",
      "contractorConstructionDoc",
    ],
  },
  {
    id: "call1_docs",
    title: "Ранние документы и автоподтягивание",
    callType: 1,
    badge: "call1",
    description:
      "Перед завершением первого звонка зафиксируйте, что уже есть, что подтянется автоматически и что клиент должен дослать.",
    why:
      "Если документы и автоматические источники не отмечены, второй звонок начнется без ясной картины по пакету.",
    questions: [
      "Что уже подтягивается автоматически, а что нужно запросить у клиента?",
      "Есть ли опека, дети или оценка как отдельные документные триггеры?",
    ],
    regulatory: [
      "Статус документов должен быть отдельным слоем, а не заметкой в конце разговора.",
    ],
    completion: [
      "Есть список недостающих документов на второй звонок.",
      "Понятно, что подтягивается автоматически.",
    ],
    fields: ["egrnStatus", "appraisalReportNumber", "birthCertificatesStatus", "guardianshipStatus"],
  },
  {
    id: "call2_legal",
    title: "Юридическая рамка сделки",
    callType: 2,
    badge: "call2",
    description:
      "Начните второй звонок с юридической рамки: срок, форма собственности, документ-основание и брачный режим должны быть понятны до расчетов.",
    why:
      "Юридическая рамка сделки должна быть зафиксирована до расчетов и страхования.",
    questions: [
      "На каком документе строится сделка?",
      "Как оформляется собственность и есть ли брачный контур?",
    ],
    regulatory: [
      "Брачный режим нельзя оставлять на конец разговора.",
      "Долевая собственность требует отдельного внимания и ограничений.",
    ],
    completion: [
      "Подтверждены форма собственности и документ-основание.",
      "Юридические ограничения не остаются в подвешенном состоянии.",
    ],
    fields: [
      "finalLoanTerm",
      "ownershipForm",
      "titleDocType",
      "titleDocName",
      "titleDocNumber",
      "titleDocDate",
      "maritalRegimeClear",
      "sellerOwnershipYears",
      "izhsProjectReady",
    ],
  },
  {
    id: "call2_refi",
    title: "Старый кредит и контур рефинансирования",
    callType: 2,
    badge: "call2",
    routePurposes: ["refi"],
    description:
      "По рефинансу восстановите старый кредитный контур: договор, кредитор, цепочка рефинансов, ПСК и совпадение объекта.",
    why:
      "Рефинанс требует отдельного юридического контура, который нельзя подменять общим разговором о сделке.",
    questions: [
      "Какой договор перекредитуется и кто текущий кредитор?",
      "Были ли предыдущие рефинансы по этому же объекту?",
      "Есть ли документы по ПСК и хотя бы один прежний участник в новой сделке?",
      "Объект нового кредита полностью совпадает с объектом старого кредита?",
    ],
    regulatory: [
      "Документы по каждому звену цепочки рефинанса должны быть учтены.",
      "Все старые залогодатели должны перейти в новую сделку.",
      "Идентичность объекта старого и нового кредита — обязательная красная граница.",
      "Если объект строящийся, права требования проверяются как отдельная сущность.",
    ],
    completion: [
      "Полностью описан старый кредитный контур.",
      "Цепочка и документы по ПСК не потеряны.",
    ],
    fields: [
      "refiOriginalContractNumber",
      "refiOriginalContractDate",
      "refiOrgType",
      "refiOrgName",
      "refiPrevDomrf",
      "refiPrevContractNumber",
      "refiPrevContractDate",
      "refiPrevContractType",
      "refiChainCount",
      "refiPskAvailable",
      "refiBorrowerRemains",
      "refiAllPledgorsRemain",
      "refiObjectSameAsOld",
    ],
  },
  {
    id: "call2_payments",
    title: "Расчеты, ПВ и субсидии",
    callType: 2,
    badge: "call2",
    description:
      "Соберите схему расчетов, первоначальный взнос, субсидии и спецсчета. Если расчеты внешние, сразу заполните реквизиты получателя.",
    why:
      "Расчеты нельзя смешивать с правоустанавливающими документами: это отдельный блок риска и контроля.",
    questions: [
      "Как проходит расчет: до регистрации, после регистрации, через аккредитив или другой механизм?",
      "Есть ли спецсчет, субсидия или маткапитал в ПВ?",
      "Нужно ли подтверждать ПВ отдельным документом?",
    ],
    regulatory: [
      "Для части веток логика ПВ должна учитывать наличие субсидии и отдельного источника средств.",
      "Если расчеты идут вне Банка ДОМ.РФ, нужно раскрывать реквизиты получателя.",
    ],
    completion: [
      "Понятен способ расчетов и ПВ.",
      "Отмечены субсидии и специальные счета, если они участвуют в сделке.",
    ],
    fields: [
      "paymentMethod",
      "izhsLandInspectionActReady",
      "specialAccountFlag",
      "escrowOpened",
      "externalEscrow",
      "pvControl",
      "pvDomrfAmount",
      "pvDocAmount",
      "subsidyInPvAmount",
      "subsidyName",
      "subsidyAmount",
      "downPayment",
      "finalRateReductionPeriod",
      "finalRateDiscountSize",
    ],
  },
  {
    id: "call2_finish",
    title: "Страхование, логистика и выпуск",
    callType: 2,
    badge: "final",
    description:
      "На финише проверьте страхование, дату и место сделки, идентификацию клиента, реквизиты и пост-сделочные обязательства.",
    why:
      "На финише особенно легко потерять страхование, идентификацию, реквизиты и пост-сделочные обязательства программы.",
    questions: [
      "Кто страхователь и какие виды страхования нужны?",
      "Где и когда проходит сделка, как идентифицируется клиент?",
      "Есть ли реквизиты получателя, если счет внешний?",
    ],
    regulatory: [
      "Внешний счет получателя должен жить отдельным реквизитным блоком.",
      "Пост-сделочные требования по программам должны быть зафиксированы до завершения звонка.",
    ],
    completion: [
      "Собраны страхование, дата и место сделки.",
      "Есть идентификация клиента и при необходимости реквизиты получателя.",
    ],
    fields: [
      "personalInsurance",
      "insurancePolicyholder",
      "insuranceType",
      "useForDbo",
      "dealDateTime",
      "paymentDay",
      "transactionLocation",
      "clientIdentificationMethod",
      "contractConclusionLocation",
      "recipientAccountOwnerRole",
      "recipientAccountOwnerName",
      "recipientBank",
      "recipientSettlementAccount",
      "dvPostRegistration",
    ],
  },
];

const precheckSections = [
  {
    id: "apics_identity_gate",
    title: "APICS / согласия до запуска графа",
    description:
      "Проверяем базовые импортируемые данные и дату СОПД до открытия основного графа.",
    applies: (route) => Boolean(route.purpose && route.program),
    fields: ["dataProcessingConsentDate"],
    redlines: [
      "Без даты СОПД граф не открывается.",
      "ФИО и контакты помечаются как импортируемые данные ЦП/ДБО или soft-readonly для прототипа.",
    ],
  },
  {
    id: "compatibility",
    title: "Совместимость цели и программы",
    description:
      "До старта звонка проверяем, разрешена ли выбранная программа для этой цели кредита и не требуется ли ручное подтверждение.",
    applies: (route) => Boolean(route.purpose && route.program),
    fields: ["routeConditionalApproved"],
    redlines: [
      "Жестко блокируем программы, которые не подтверждены методологией для выбранной цели.",
      "Для условных сочетаний граф не должен открываться без ручного подтверждения паспортом продукта.",
    ],
  },
  {
    id: "gov_common",
    title: "Общая отсечка для госпрограмм",
    description:
      "Этот блок нужен для любой льготной программы до начала разговора по объекту.",
    applies: (route) => route.program && route.program !== "base",
    fields: [
      "programTargetGroupConfirmed",
      "hasPriorGovMortgage",
      "newChildAfterPriorLoan",
      "oldLoanClosed",
    ],
    redlines: [
      "Клиент должен попадать в целевую группу программы.",
      "Повторная льготная ипотека после 23.12.2023 у заемщика или созаемщика блокирует сценарий, если нет семейного исключения.",
    ],
  },
  {
    id: "family_gate",
    title: "Полный pre-check семейной программы",
    description:
      "Семейная ветка не должна открываться, пока не подтверждены дети, семейное основание и структура сделки.",
    applies: (route) => route.program === "family" || route.program === "family_military",
    fields: [
      "childrenCount",
      "familyBasis",
      "childDob",
      "spouseRussianCitizen",
      "spouseIncludedInDeal",
    ],
    redlines: [
      "Без семейного основания клиент не должен идти в семейную программу.",
      "Для обычной семейной ипотеки супруг(а) с гражданством РФ включается в состав созаемщиков; для семейной военной ветки такой брак блокирует стандартный сценарий.",
    ],
  },
  {
    id: "it_gate",
    title: "Полный pre-check ИТ-программы",
    description:
      "ИТ-программа отсеивается по занятости, аккредитации, локации работодателя и доходу до начала предметного разговора.",
    applies: (route) => route.program === "it",
    fields: [
      "itAgeCompliance",
      "itMainJob",
      "itEmployerAccredited",
      "itEmployerLocation",
      "itIncomeCompliance",
      "itLaborContractAvailable",
    ],
    redlines: [
      "Возраст должен быть 21-50 лет включительно, а работа должна быть основной в аккредитованной ИТ-организации.",
      "Локация работодателя Москва / Санкт-Петербург блокирует стандартную ветку.",
    ],
  },
  {
    id: "dv_gate",
    title: "Полный pre-check ДВиАИ",
    description:
      "Для ДВиАИ нужно до старта графа зафиксировать категорию клиента, возрастную логику и структуру собственности.",
    applies: (route) => route.program === "dv",
    fields: [
      "purchaseRegion",
      "dvCategory",
      "dvAgeCompliance",
      "dvOwnershipStructureAllowed",
      "dvSpousePriorGovMortgage",
      "dvPostRegistrationRequired",
      "dvPostRegistrationAcknowledged",
    ],
    redlines: [
      "Без категории заемщика программа не должна открываться.",
      "По молодой семье важен возраст, а по всем категориям важна допустимая структура собственности.",
      "Объект должен находиться в ДФО / Арктической зоне, а прошлый льготный кредит супруга также блокирует ДВиАИ.",
    ],
  },
  {
    id: "military_gate",
    title: "Полный pre-check военной программы",
    description:
      "Военная ветка чувствительна к НИС, возрасту и составу участников; это нужно проверять до графа звонка.",
    applies: (route) => route.program === "military" || route.program === "family_military",
    fields: [
      "militaryAgeCompliance",
      "militaryNisConfirmed",
      "militaryCoborrowersCount",
      "otherPledgorPresent",
    ],
    redlines: [
      "Без НИС, возраста от 25 лет и допустимого возраста на дату погашения программа не продолжается.",
      "Созаемщики и иные залогодатели блокируют стандартную военную схему.",
    ],
  },
  {
    id: "family_military_gate",
    title: "Специальная красная граница семейной программы для военнослужащих",
    description:
      "Эта ветка объединяет семейные и военные ограничения и дополнительно требует проверки брачного режима.",
    applies: (route) => route.program === "family_military",
    fields: ["familyStatus", "spouseRussianCitizen"],
    redlines: [
      "Стандартная схема блокируется, если заемщик состоит в браке с супругом(ой) с гражданством РФ.",
    ],
  },
  {
    id: "property_gate",
    title: "Форма объекта и сценарий продавца",
    description:
      "До графа нужно понять, есть ли объект дома / участка. Для стройки отдельно проверяем, не скрывается ли за продавцом-физлицом сценарий уступки.",
    applies: (route) => route.purpose === "ready" || route.purpose === "build",
    fields: ["propertyType", "sellerType"],
    redlines: [
      "Тип объекта определяет, нужно ли применять фильтр по дому и земле.",
      "Для стройки продавец-физлицо без цепочки прав — отдельный риск; к готовому жилью этот стоп-фактор не применяется.",
    ],
  },
  {
    id: "pledge_property_gate",
    title: "Тип залогового объекта",
    description:
      "Для залога имеющейся квартиры нужно рано понять тип объекта, чтобы включить домовые и земельные фильтры при необходимости.",
    applies: (route) => route.purpose === "pledge",
    fields: ["propertyType"],
    redlines: [
      "Если предмет залога — дом, блокнот должен применить все стоп-факторы по дому и участку.",
    ],
  },
  {
    id: "build_gate",
    title: "Полный pre-check по строящемуся жилью",
    description:
      "Этот блок не дает идти в ветку стройки, если права, документы по проблемному объекту или статус ввода не ясны заранее.",
    applies: (route) => route.purpose === "build",
    fields: [
      "problemObject",
      "buildRightsChainClear",
      "buildAssignmentDocsReady",
      "buildProblemDocsReady",
      "buildCommissionedWithoutRights",
      "buildCommissionPermitReady",
      "buildBaseContractReady",
    ],
    redlines: [
      "Уступка или продавец-физлицо без понятной цепочки прав должны блокировать старт.",
      "Проблемный объект и ввод без зарегистрированного права требуют понятного комплекта документов уже на маршрутизации.",
    ],
  },
  {
    id: "refi_gate",
    title: "Полный pre-check перекредитования",
    description:
      "Рефинанс не должен открываться, если нет правопреемства по заемщикам и залогодателям.",
    applies: (route) => route.purpose === "refi",
    fields: [
      "refiBorrowerLinkedToOld",
      "refiBorrowerRemains",
      "refiAllPledgorsRemain",
      "refiObjectSameAsOld",
      "refiPskAvailable",
    ],
    redlines: [
      "Новый заемщик должен быть связан со старым кредитом.",
      "Хотя бы один старый заемщик и все старые залогодатели должны переходить в новую сделку.",
      "Объект в новом кредите должен быть идентичен объекту старого кредита.",
    ],
  },
  {
    id: "land_gate",
    title: "Полный земельный фильтр",
    description:
      "Любая ветка с домом, участком или ИЖС должна пройти земельный фильтр до открытия графа.",
    applies: (route, state) => hasLandPrecheck(route, state),
    fields: [
      "landOwnershipAllowed",
      "landRegionAllowed",
      "landArea",
      "landZoneAllowed",
      "landUseAllowed",
      "landBoundariesKnown",
      "izhsNoExtraBuildings",
    ],
    redlines: [
      "Право аренды, площадь выше 4 000 кв. м, запрещенные зоны и неустановленные границы блокируют сценарий.",
      "Категория земли и ВРИ должны позволять законное строительство и эксплуатацию жилья.",
    ],
  },
  {
    id: "house_gate",
    title: "Полный фильтр по жилому дому",
    description:
      "Если предмет ипотеки — дом, блокнот должен остановить менеджера на технических и юридических стоп-факторах еще до графа.",
    applies: (route, state) => isHousePrecheck(route, state),
    fields: [
      "houseTerritoryAllowed",
      "houseBuiltYear",
      "houseRightsRegistered",
      "objectArea",
      "houseYearRoundReady",
      "houseAllSeasonAccess",
      "houseStructureReady",
      "foundationAllowed",
      "houseCommunicationsReady",
      "houseHeatingAllowed",
      "houseSanitaryReady",
    ],
    redlines: [
      "Дом старше 1990 года, без пригодности к круглогодичному проживанию или без допустимого конструктива блокирует сценарий.",
      "Площадь вне диапазона 60-345 кв. м, отсутствие обязательных коммуникаций или отопление только печного типа тоже блокирует ветку.",
    ],
  },
];

const JOURNAL_STORAGE_KEY = "mortgage_call_notebook_v3";
const UI_STORAGE_KEY = "mortgage_call_notebook_ui_v1";
const MANAGER_PROFILE_STORAGE_KEY = "mortgage_call_notebook_manager_v1";
const APP_SCHEMA_VERSION = "0.0.1-p0-completion";
const CURRENT_JOURNAL_SCHEMA_VERSION = 2;
const SESSION_BACKUP_VERSION = 1;
const SESSION_BACKUP_FORMAT = "session-backup";
const SESSION_BACKUP_APP_NAME = "Интерактивный блокнот менеджера";
const migrations = [
  {
    from: 0,
    to: 1,
    description: "Нормализация legacy-карточек звонков из раннего localStorage.",
    migrate: (raw) => ({
      ...(raw && typeof raw === "object" ? raw : {}),
      calls: Array.isArray(raw?.calls) ? raw.calls.map(normalizeLegacyCallRecord) : [],
    }),
  },
  {
    from: 1,
    to: 2,
    description: "Нормализация legacy-документов и участников сделки.",
    migrate: (raw) => ({
      ...(raw && typeof raw === "object" ? raw : {}),
      calls: Array.isArray(raw?.calls)
        ? raw.calls.map((call) => ({
            ...(call && typeof call === "object" ? call : {}),
            documents: normalizeLegacyDocuments(call?.documents),
            participants: normalizeLegacyParticipants(call?.participants || call?.form?.dealParticipants),
          }))
        : [],
    }),
  },
];

function createRouteState() {
  return {
    purpose: "",
    program: "",
  };
}

function createUiState() {
  return {
    detailMode: false,
    questionMode: false,
    outputOpen: false,
    outputStage: "call1",
    outputMode: "system",
    outputFilledMode: "filled",
    outputShowMethodology: false,
    outputCopyMessage: "",
    contradictionsExpanded: false,
    calendarOpen: false,
    calendarView: "list",
    calendarSelectedDate: "",
    calendarFilter: "all",
  };
}

function createManagerProfile() {
  return {
    fullName: "",
    lastExportAt: "",
    lastImportedAt: "",
    lastImportedFileName: "",
  };
}

function generateCallId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createDocumentsState() {
  return {
    drawerOpen: false,
    pinned: false,
    activeView: "all",
    filter: "all",
    search: "",
    flags: {},
    items: {},
    expandedSections: {},
    copyMessage: "",
  };
}

const documentItemLegacyAliases = {
  sopd_borrower: ["base.sopd_borrower"],
  sopd_pledgor: ["base.sopd_pledgor"],
  siz_borrower: ["base.siz"],
  snils: ["base.snils_adireg"],
  guardianship_permission: ["base.guardianship"],
  refi_psk_notification: ["refi.old_credit.psk"],
  it_income_certificate: ["program.it.income_3m"],
  it_labor_contract: ["program.it.labor_contract"],
  it_std: ["program.it.std"],
  dva_category_doc: ["program.dv.category_basis"],
  military_nis_doc: ["program.military.nis_certificate"],
  izhs_construction_contract: ["izhs.contractor.contract"],
  izhs_house_passport: ["izhs.object.project"],
  izhs_arch_project: ["izhs.object.project"],
};

function normalizeDocumentItems(rawItems) {
  const items = rawItems && typeof rawItems === "object" ? { ...rawItems } : {};
  Object.entries(documentItemLegacyAliases).forEach(([nextId, legacyIds]) => {
    if (items[nextId]) {
      return;
    }
    const legacyId = legacyIds.find((id) => items[id]);
    if (legacyId) {
      items[nextId] = { ...items[legacyId] };
    }
  });
  return items;
}

function normalizeDocumentsState(raw, options = {}) {
  const resetTransient = Boolean(options.resetTransient);
  return {
    ...createDocumentsState(),
    ...(raw && typeof raw === "object" ? raw : {}),
    drawerOpen: resetTransient ? false : Boolean(raw?.drawerOpen),
    flags: raw?.flags && typeof raw.flags === "object" ? raw.flags : {},
    items: normalizeDocumentItems(raw?.items),
    expandedSections:
      raw?.expandedSections && typeof raw.expandedSections === "object"
        ? raw.expandedSections
        : {},
    copyMessage: resetTransient ? "" : raw?.copyMessage || "",
  };
}

const outcomeStatusOptions = [
  {
    value: "completed_next_step",
    label: "Можно двигаться дальше",
    tone: "success",
    hint: "Разговор завершен, критичных подвисаний по контакту нет.",
  },
  {
    value: "waiting_documents",
    label: "Ждем документы",
    tone: "warning",
    hint: "Клиент обещал дослать документы после разговора.",
  },
  {
    value: "need_recheck",
    label: "Нужна перепроверка",
    tone: "warning",
    hint: "Есть вопрос, который нужно перепроверить до следующего шага.",
  },
  {
    value: "need_followup",
    label: "Нужен повторный звонок",
    tone: "info",
    hint: "Нужно вернуться к клиенту отдельным контактом.",
  },
  {
    value: "blocked",
    label: "Маршрут заблокирован",
    tone: "danger",
    hint: "По текущим данным сделка не должна продолжаться без смены маршрута.",
  },
  {
    value: "client_declined",
    label: "Клиент отказался",
    tone: "neutral",
    hint: "Контакт завершен отказом клиента.",
  },
  {
    value: "no_answer",
    label: "Не дозвонились",
    tone: "neutral",
    hint: "Контакт не состоялся, follow-up нужен только если менеджер его поставит.",
  },
  {
    value: "rescheduled",
    label: "Перенесено",
    tone: "info",
    hint: "Разговор перенесен на новую дату или время.",
  },
];

const followUpChannelOptions = [
  { value: "call", label: "Звонок" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "documents", label: "Ожидание документов" },
  { value: "recheck", label: "Повторная проверка" },
  { value: "internal", label: "Внутреннее уточнение" },
];

const outcomeStatusesRequiringFollowUp = new Set([
  "waiting_documents",
  "need_recheck",
  "need_followup",
  "rescheduled",
]);

function createPromisedDoc(name = "", dueDate = "", comment = "", received = false, id = "") {
  return {
    id: id || generateCallId(),
    name,
    dueDate,
    comment,
    received: Boolean(received),
  };
}

function createOutcomeState() {
  return {
    status: "",
    confirmedSummary: "",
    unresolvedSummary: "",
    riskSummary: "",
    promisedDocs: [],
    nextStep: "",
    followUp: {
      required: false,
      date: "",
      time: "",
      channel: "call",
      reason: "",
      done: false,
      doneAt: "",
    },
    updatedAt: "",
  };
}

function normalizePromisedDoc(raw) {
  return createPromisedDoc(
    raw?.name || "",
    raw?.dueDate || "",
    raw?.comment || "",
    Boolean(raw?.received),
    raw?.id || ""
  );
}

function normalizeOutcomeState(raw) {
  const fallback = createOutcomeState();
  const normalized = {
    ...fallback,
    ...(raw && typeof raw === "object" ? raw : {}),
    promisedDocs: Array.isArray(raw?.promisedDocs)
      ? raw.promisedDocs.map(normalizePromisedDoc)
      : [],
    followUp: {
      ...fallback.followUp,
      ...(raw?.followUp && typeof raw.followUp === "object" ? raw.followUp : {}),
      required: Boolean(raw?.followUp?.required),
      done: Boolean(raw?.followUp?.done),
    },
  };

  if (!followUpChannelOptions.some((option) => option.value === normalized.followUp.channel)) {
    normalized.followUp.channel = "call";
  }

  return normalized;
}

function getDefaultFormFieldValue(field) {
  if (field.kind === "multi" || field.kind === "participants") {
    return [];
  }
  return "";
}

function createFormState(raw = {}) {
  const normalized = {};
  Object.entries(fieldCatalog).forEach(([fieldKey, field]) => {
    if (field.kind === "route") {
      return;
    }
    normalized[fieldKey] = getDefaultFormFieldValue(field);
  });
  return {
    ...normalized,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
}

function createCallRecord() {
  const now = new Date().toISOString();
  return {
    id: generateCallId(),
    title: "",
    callName: "Первичный звонок",
    clientName: "",
    createdAt: now,
    updatedAt: now,
    route: createRouteState(),
    form: createFormState(),
    touched: {},
    participants: [],
    documents: createDocumentsState(),
    outcome: createOutcomeState(),
    call2Enabled: false,
    activeStage: "call1",
  };
}

function isAutoGeneratedTitle(value) {
  return /^Звонок \d{2}\.\d{2}/.test(String(value || ""));
}

function normalizeLegacyDocuments(raw) {
  return normalizeDocumentsState(raw, { resetTransient: true });
}

function normalizeLegacyParticipants(raw) {
  return normalizeParticipants(raw);
}

function normalizeLegacyCallRecord(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...source,
    form: createFormState(source.form),
    participants: normalizeLegacyParticipants(source.participants || source.form?.dealParticipants),
    documents: normalizeLegacyDocuments(source.documents),
    outcome: normalizeOutcomeState(source.outcome),
  };
}

function normalizeCallRecord(raw) {
  const fallback = createCallRecord();
  const source = normalizeLegacyCallRecord(raw);
  const legacyTitle = source?.title || "";
  return {
    id: source?.id || fallback.id,
    title: isAutoGeneratedTitle(legacyTitle) ? "" : legacyTitle,
    callName: source?.callName || (isAutoGeneratedTitle(legacyTitle) ? legacyTitle : fallback.callName),
    clientName: source?.clientName || "",
    createdAt: source?.createdAt || fallback.createdAt,
    updatedAt: source?.updatedAt || source?.createdAt || fallback.updatedAt,
    route: {
      ...createRouteState(),
      ...(source?.route || {}),
    },
    form: createFormState(source?.form),
    touched: source?.touched && typeof source.touched === "object" ? source.touched : {},
    participants: normalizeLegacyParticipants(source?.participants),
    documents: normalizeLegacyDocuments(source?.documents),
    outcome: normalizeOutcomeState(source?.outcome),
    call2Enabled: Boolean(source?.call2Enabled),
    activeStage: source?.activeStage === "call2" && source?.call2Enabled ? "call2" : "call1",
  };
}

function migrateJournalState(raw) {
  let next = raw && typeof raw === "object" ? { ...raw } : {};
  let version = Number(next.schemaVersion || next.journalSchemaVersion || 0);
  migrations
    .filter((migration) => version < migration.to)
    .sort((left, right) => left.to - right.to)
    .forEach((migration) => {
      next = migration.migrate(next);
      version = migration.to;
    });
  return {
    ...next,
    schemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION,
  };
}

function readStoredJson(key, fallback) {
  try {
    if (typeof localStorage === "undefined") {
      return fallback;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write errors in prototype mode.
  }
}

function loadJournalState() {
  const raw = migrateJournalState(readStoredJson(JOURNAL_STORAGE_KEY, {}));
  const calls = Array.isArray(raw?.calls) ? raw.calls.map(normalizeCallRecord) : [];
  const activeCallId = calls.some((item) => item.id === raw?.activeCallId) ? raw.activeCallId : "";
  return {
    calls,
    activeCallId,
    schemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION,
  };
}

function persistJournalState() {
  writeStoredJson(JOURNAL_STORAGE_KEY, journalState);
}

function loadUiState() {
  const loaded = {
    ...createUiState(),
    ...(readStoredJson(UI_STORAGE_KEY, {}) || {}),
  };
  return {
    ...loaded,
    outputOpen: false,
    outputCopyMessage: "",
    calendarOpen: false,
  };
}

function persistUiState() {
  writeStoredJson(UI_STORAGE_KEY, uiState);
}

function loadManagerProfile() {
  const raw = readStoredJson(MANAGER_PROFILE_STORAGE_KEY, {});
  return {
    ...createManagerProfile(),
    ...(raw && typeof raw === "object" ? raw : {}),
    fullName: String(raw?.fullName || "").trimStart(),
    lastExportAt: raw?.lastExportAt || "",
    lastImportedAt: raw?.lastImportedAt || "",
    lastImportedFileName: raw?.lastImportedFileName || "",
  };
}

function persistManagerProfile() {
  writeStoredJson(MANAGER_PROFILE_STORAGE_KEY, managerProfile);
}

const journalState = loadJournalState();
let uiState = loadUiState();
const managerProfile = loadManagerProfile();
let sessionFeedback = "";
let sessionFeedbackTone = "info";
let pendingSessionImport = null;
let routeState = createRouteState();
let formState = {};
let touched = {};

const createCallButton = document.getElementById("create-call-button");
const exportSessionButton = document.getElementById("export-session-button");
const importSessionButton = document.getElementById("import-session-button");
const sessionImportInput = document.getElementById("session-import-input");
const openCalendarButton = document.getElementById("open-calendar-button");
const brandKicker = document.getElementById("brand-kicker");
const brandTitle = document.getElementById("brand-title");
const brandLead = document.getElementById("brand-lead");
const managerProfileRoot = document.getElementById("manager-profile-root");
const journalRoot = document.getElementById("journal-root");
const workspaceShell = document.getElementById("workspace-shell");
const workspaceTopbar = document.getElementById("workspace-topbar");
const purposePicker = document.getElementById("purpose-picker");
const programPicker = document.getElementById("program-picker");
const routeSummary = document.getElementById("route-summary");
const precheckRoot = document.getElementById("precheck-root");
const graphRoot = document.getElementById("graph-root");
const callOutcomeRoot = document.getElementById("call-outcome-root");
const insightsRoot = document.getElementById("insights-root");
const auditRoot = document.getElementById("audit-root");
const contradictionsRoot = document.getElementById("contradictions-root");
const outputPanelRoot = document.getElementById("output-panel-root");
const documentsDrawerRoot = document.getElementById("documents-drawer-root");
const calendarDrawerRoot = document.getElementById("calendar-drawer-root");
const sessionModalRoot = document.getElementById("session-modal-root");
const detailToggle = document.getElementById("detail-mode");
const questionToggle = document.getElementById("question-mode");

function getActiveCall() {
  return journalState.calls.find((item) => item.id === journalState.activeCallId) || null;
}

function syncActiveCallRefs() {
  const activeCall = getActiveCall();
  if (activeCall) {
    routeState = activeCall.route;
    formState = activeCall.form;
    touched = activeCall.touched;
    activeCall.participants = normalizeParticipants(activeCall.participants || activeCall.form.dealParticipants);
    activeCall.form.dealParticipants = activeCall.participants;
  } else {
    routeState = createRouteState();
    formState = {};
    touched = {};
  }
  detailToggle.checked = uiState.detailMode;
  questionToggle.checked = uiState.questionMode;
}

function touchCall(call) {
  if (!call) {
    return;
  }
  call.updatedAt = new Date().toISOString();
  persistJournalState();
}

function touchActiveCall() {
  touchCall(getActiveCall());
}

function selectCall(callId, options = {}) {
  journalState.activeCallId = callId;
  persistJournalState();
  syncActiveCallRefs();
  renderApp(options);
}

function closeActiveCall() {
  journalState.activeCallId = "";
  persistJournalState();
  syncActiveCallRefs();
  renderApp({ viewState: { scrollX: 0, scrollY: 0 } });
}

function createNewCall() {
  const callRecord = createCallRecord();
  journalState.calls.unshift(callRecord);
  journalState.activeCallId = callRecord.id;
  persistJournalState();
  syncActiveCallRefs();
  renderApp({ scrollToWorkspace: true });
}

detailToggle.addEventListener("change", () => {
  uiState.detailMode = detailToggle.checked;
  persistUiState();
  renderApp({ viewState: captureViewState() });
});

questionToggle.addEventListener("change", () => {
  uiState.questionMode = questionToggle.checked;
  persistUiState();
  renderApp({ viewState: captureViewState() });
});

createCallButton.addEventListener("click", () => {
  createNewCall();
});

exportSessionButton.addEventListener("click", () => {
  exportSessionBackup();
});

importSessionButton.addEventListener("click", () => {
  sessionImportInput.value = "";
  sessionImportInput.click();
});

sessionImportInput.addEventListener("change", () => {
  const file = sessionImportInput.files?.[0];
  if (file) {
    importSessionBackup(file);
  }
});

openCalendarButton.addEventListener("click", () => {
  uiState.calendarOpen = true;
  uiState.calendarView = uiState.calendarView || "list";
  uiState.calendarSelectedDate = uiState.calendarSelectedDate || getTodayIsoDate();
  persistUiState();
  renderApp();
});

managerProfileRoot.addEventListener("input", handleManagerProfileInput);
managerProfileRoot.addEventListener("click", handleManagerProfileAction);
journalRoot.addEventListener("click", handleJournalAction);
workspaceTopbar.addEventListener("click", handleWorkspaceAction);
workspaceTopbar.addEventListener("input", handleWorkspaceMetaChange);
workspaceTopbar.addEventListener("change", handleWorkspaceMetaChange);
workspaceTopbar.addEventListener("focusout", handleWorkspaceMetaCommit);

precheckRoot.addEventListener("input", handleFieldChange);
precheckRoot.addEventListener("change", handleFieldChange);
precheckRoot.addEventListener("click", handleFieldAction);
precheckRoot.addEventListener("focusout", (event) => {
  const key = event.target?.dataset?.fieldKey;
  if (key) {
    touched[key] = true;
    touchActiveCall();
    if (event.relatedTarget?.closest?.("[data-field-action], [data-workspace-action]")) {
      return;
    }
    const nextFocusTarget = event.relatedTarget || document.activeElement || event.target;
    renderApp({ viewState: captureViewState(nextFocusTarget) });
  }
});

graphRoot.addEventListener("input", handleFieldChange);
graphRoot.addEventListener("change", handleFieldChange);
graphRoot.addEventListener("click", handleFieldAction);
graphRoot.addEventListener("click", handleWorkspaceAction);
graphRoot.addEventListener("focusout", (event) => {
  const key = event.target?.dataset?.fieldKey;
  if (key) {
    touched[key] = true;
    touchActiveCall();
    if (event.relatedTarget?.closest?.("[data-field-action], [data-workspace-action]")) {
      return;
    }
    const nextFocusTarget = event.relatedTarget || document.activeElement || event.target;
    renderApp({ viewState: captureViewState(nextFocusTarget) });
  }
});

callOutcomeRoot.addEventListener("input", handleOutcomeChange);
callOutcomeRoot.addEventListener("change", handleOutcomeChange);
callOutcomeRoot.addEventListener("click", handleOutcomeAction);
callOutcomeRoot.addEventListener("focusout", handleOutcomeCommit);
insightsRoot.addEventListener("click", handleSignalAction);

document.addEventListener("click", handleContradictionAction);
outputPanelRoot.addEventListener("click", handleOutputAction);
outputPanelRoot.addEventListener("change", handleOutputChange);
documentsDrawerRoot.addEventListener("click", handleDocumentsAction);
documentsDrawerRoot.addEventListener("input", handleDocumentsInput);
documentsDrawerRoot.addEventListener("change", handleDocumentsChange);
calendarDrawerRoot.addEventListener("click", handleCalendarAction);
calendarDrawerRoot.addEventListener("input", handleCalendarChange);
calendarDrawerRoot.addEventListener("change", handleCalendarChange);
sessionModalRoot.addEventListener("click", handleSessionModalAction);

syncActiveCallRefs();

function createParticipant(role = "", fullName = "", id = generateCallId()) {
  return {
    id,
    fullName,
    role,
    isPledgor: role === "pledgor",
    participatesInCalculation: role === "borrower" || role === "coborrower",
    citizenship: "unknown",
    isMinor: false,
    kinshipToBorrower: "",
    docs: {
      passport: false,
      snils: false,
      sopd: false,
      siz: false,
      kinshipDocs: false,
      guardianshipPermission: false,
    },
  };
}

function normalizeParticipants(value) {
  const normalizeOne = (item) => {
    const role = String(item.role || "");
    const docs = item.docs && typeof item.docs === "object" ? item.docs : {};
    return {
      id: item.id || generateCallId(),
      fullName: String(item.fullName || "").trimStart(),
      role,
      isPledgor: Boolean(item.isPledgor || role === "pledgor"),
      participatesInCalculation: Boolean(
        item.participatesInCalculation || role === "borrower" || role === "coborrower"
      ),
      citizenship: ["rf", "foreign", "unknown"].includes(item.citizenship)
        ? item.citizenship
        : "unknown",
      isMinor: Boolean(item.isMinor),
      kinshipToBorrower: String(item.kinshipToBorrower || "").trimStart(),
      docs: {
        passport: Boolean(docs.passport),
        snils: Boolean(docs.snils),
        sopd: Boolean(docs.sopd),
        siz: Boolean(docs.siz),
        kinshipDocs: Boolean(docs.kinshipDocs),
        guardianshipPermission: Boolean(docs.guardianshipPermission),
      },
    };
  };

  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === "object")
      .map(normalizeOne);
  }

  const legacyValue = String(value || "").trim();
  if (!legacyValue) {
    return [];
  }

  return [createParticipant("other", legacyValue)];
}

function getCallParticipants(call = getActiveCall()) {
  if (!call) {
    return [];
  }
  const normalized = normalizeParticipants(call.participants?.length ? call.participants : call.form?.dealParticipants);
  call.participants = normalized;
  call.form = call.form || {};
  call.form.dealParticipants = normalized;
  return normalized;
}

function syncParticipantsToActiveCall(participants) {
  const activeCall = getActiveCall();
  if (!activeCall) {
    return;
  }
  const normalized = normalizeParticipants(participants);
  activeCall.participants = normalized;
  activeCall.form.dealParticipants = normalized;
  formState.dealParticipants = normalized;
}

function hasParticipantWithRole(call, role) {
  return getCallParticipants(call).some((participant) => participant.role === role);
}

function hasMinorParticipant(call) {
  return getCallParticipants(call).some((participant) => participant.isMinor);
}

function isParticipantsFilled(value) {
  return normalizeParticipants(value).some(
    (participant) => participant.fullName.trim() && participant.role
  );
}

function getParticipantRoleLabel(role, field = fieldCatalog.dealParticipants) {
  return (field.roles || []).find((item) => item.value === role)?.label || role || "роль не указана";
}

function serializeParticipants(value, field = fieldCatalog.dealParticipants) {
  return normalizeParticipants(value)
    .filter((participant) => participant.fullName.trim() || participant.role)
    .map((participant) => {
      const name = participant.fullName.trim() || "ФИО не указано";
      const role = getParticipantRoleLabel(participant.role, field);
      const flags = [
        participant.isPledgor ? "залогодатель" : "",
        participant.participatesInCalculation ? "расчет дохода" : "",
        participant.isMinor ? "несовершеннолетний" : "",
        participant.citizenship && participant.citizenship !== "unknown" ? `гражданство: ${participant.citizenship}` : "",
        participant.kinshipToBorrower ? `родство: ${participant.kinshipToBorrower}` : "",
      ].filter(Boolean);
      return `${name} (${role}${flags.length ? `; ${flags.join("; ")}` : ""})`;
    })
    .join(" | ");
}

function handleFieldChange(event) {
  if (!getActiveCall()) {
    return;
  }
  const target = event.target;
  const key = target?.dataset?.fieldKey;
  if (!key) {
    return;
  }

  const field = fieldCatalog[key];
  if (isFieldHardReadonly(field)) {
    return;
  }
  touched[key] = true;

  if (field.kind === "participants") {
    const participantId = target.dataset.participantId;
    const participantProp = target.dataset.participantProp;
    const participants = normalizeParticipants(formState[key]);
    const participantIndex = participants.findIndex((item) => item.id === participantId);
    const nextParticipants =
      participantIndex >= 0
        ? participants
        : participants.concat(createParticipant("", "", participantId || generateCallId()));
    const nextIndex =
      participantIndex >= 0 ? participantIndex : nextParticipants.length - 1;

    if (participantProp === "fullName" || participantProp === "role" || participantProp === "citizenship" || participantProp === "kinshipToBorrower") {
      nextParticipants[nextIndex] = {
        ...nextParticipants[nextIndex],
        [participantProp]:
          participantProp === "fullName" || participantProp === "kinshipToBorrower"
            ? target.value.trimStart()
            : target.value,
      };
      formState[key] = nextParticipants;
    }
    if (["isPledgor", "participatesInCalculation", "isMinor"].includes(participantProp)) {
      nextParticipants[nextIndex] = {
        ...nextParticipants[nextIndex],
        [participantProp]: Boolean(target.checked),
      };
      formState[key] = nextParticipants;
    }
    if (participantProp?.startsWith?.("docs.")) {
      const docKey = participantProp.replace("docs.", "");
      nextParticipants[nextIndex] = {
        ...nextParticipants[nextIndex],
        docs: {
          ...nextParticipants[nextIndex].docs,
          [docKey]: Boolean(target.checked),
        },
      };
      formState[key] = nextParticipants;
    }
    syncParticipantsToActiveCall(formState[key]);
  } else if (field.kind === "multi") {
    const optionValue = target.dataset.optionValue;
    const current = new Set(Array.isArray(formState[key]) ? formState[key] : []);
    if (target.checked) {
      current.add(optionValue);
    } else {
      current.delete(optionValue);
    }
    formState[key] = Array.from(current);
  } else if (field.kind === "boolean" || field.kind === "radio") {
    formState[key] = target.value;
  } else {
    formState[key] = applyMask(field, target.value);
  }

  touchActiveCall();

  if (
    event.type === "input" &&
    ["text", "textarea", "email", "date", "datetime-local", "money", "participants"].includes(field.kind)
  ) {
    if (
      field.kind !== "participants" &&
      typeof target.value === "string" &&
      target.value !== formState[key]
    ) {
      target.value = formState[key] || "";
    }
    return;
  }

  renderApp({ viewState: captureViewState(target) });
}

function handleFieldAction(event) {
  if (!getActiveCall()) {
    return;
  }

  const actionTarget = event.target?.closest?.("[data-field-action]");
  if (!actionTarget) {
    return;
  }

  const key = actionTarget.dataset.fieldKey;
  const field = fieldCatalog[key];
  if (!key || field?.kind !== "participants") {
    return;
  }

  event.preventDefault();
  touched[key] = true;

  const participants = normalizeParticipants(formState[key]);
  if (actionTarget.dataset.fieldAction === "add-participant") {
    formState[key] = participants.length
      ? participants.concat(createParticipant())
      : [createParticipant("", "", `${key}_draft`), createParticipant()];
    syncParticipantsToActiveCall(formState[key]);
  }

  if (actionTarget.dataset.fieldAction === "remove-participant") {
    const participantId = actionTarget.dataset.participantId;
    formState[key] = participants.filter((participant) => participant.id !== participantId);
    syncParticipantsToActiveCall(formState[key]);
  }

  touchActiveCall();
  renderApp({ viewState: captureViewState(actionTarget) });
}

function applyMask(field, value) {
  if (!field || value == null) {
    return value;
  }

  const raw = String(value);
  const digits = raw.replace(/\D/g, "");

  if (field.kind === "date") {
    return maskDateInput(raw);
  }

  if (field.kind === "datetime-local") {
    return maskDateTimeInput(raw);
  }

  if (field.kind === "number") {
    return normalizeNumericInput(raw);
  }

  switch (field.mask) {
    case "money":
      return digits ? Number(digits).toLocaleString("ru-RU") : "";
    case "phone": {
      let normalized = digits;
      if (normalized.startsWith("8")) {
        normalized = `7${normalized.slice(1)}`;
      }
      if (!normalized.startsWith("7")) {
        normalized = `7${normalized}`;
      }
      normalized = normalized.slice(0, 11);
      const parts = [
        normalized.slice(1, 4),
        normalized.slice(4, 7),
        normalized.slice(7, 9),
        normalized.slice(9, 11),
      ];
      let result = "+7";
      if (parts[0]) result += ` (${parts[0]}`;
      if (parts[0]?.length === 3) result += ")";
      if (parts[1]) result += ` ${parts[1]}`;
      if (parts[2]) result += `-${parts[2]}`;
      if (parts[3]) result += `-${parts[3]}`;
      return result;
    }
    case "snils": {
      const valueDigits = digits.slice(0, 11);
      const p1 = valueDigits.slice(0, 3);
      const p2 = valueDigits.slice(3, 6);
      const p3 = valueDigits.slice(6, 9);
      const p4 = valueDigits.slice(9, 11);
      return [p1, p2, p3].filter(Boolean).join("-") + (p4 ? ` ${p4}` : "");
    }
    case "inn10":
      return digits.slice(0, 10);
    case "inn12":
      return digits.slice(0, 12);
    case "inn10or12":
      return digits.slice(0, 12);
    case "account20":
      return digits
        .slice(0, 20)
        .replace(/(.{4})/g, "$1 ")
        .trim();
    case "nis20":
      return digits.slice(0, 20);
    case "day":
      return digits.slice(0, 2);
    case "cadastral": {
      const cleaned = raw.replace(/[^\d:]/g, "");
      const onlyDigits = cleaned.replace(/\D/g, "").slice(0, 20);
      const parts = [];
      if (onlyDigits.length > 0) parts.push(onlyDigits.slice(0, 2));
      if (onlyDigits.length > 2) parts.push(onlyDigits.slice(2, 4));
      if (onlyDigits.length > 4) parts.push(onlyDigits.slice(4, 11));
      if (onlyDigits.length > 11) parts.push(onlyDigits.slice(11));
      return parts.filter(Boolean).join(":");
    }
    default:
      if (field.kind === "money") {
        return digits ? Number(digits).toLocaleString("ru-RU") : "";
      }
      return raw;
  }
}

function normalizeNumericInput(raw) {
  const normalized = String(raw).replace(",", ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...rest] = normalized.split(".");
  const decimalPart = rest.join("");
  return decimalPart ? `${integerPart}.${decimalPart.slice(0, 2)}` : integerPart;
}

function maskDateInput(raw) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw).trim());
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }

  const digits = String(raw).replace(/\D/g, "").slice(0, 8);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join(".");
}

function maskDateTimeInput(raw) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(raw).trim());
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]} ${isoMatch[4]}:${isoMatch[5]}`;
  }

  const digits = String(raw).replace(/\D/g, "").slice(0, 12);
  const dateDigits = digits.slice(0, 8);
  const timeDigits = digits.slice(8, 12);
  const datePart = maskDateInput(dateDigits);
  if (!timeDigits) {
    return datePart;
  }
  const timeParts = [];
  if (timeDigits.length > 0) timeParts.push(timeDigits.slice(0, 2));
  if (timeDigits.length > 2) timeParts.push(timeDigits.slice(2, 4));
  return `${datePart} ${timeParts.join(":")}`.trim();
}

function parseDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const ruMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (ruMatch) {
    const day = Number(ruMatch[1]);
    const month = Number(ruMatch[2]);
    const year = Number(ruMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  return null;
}

function parseDateTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const ruMatch = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(raw);
  if (ruMatch) {
    const day = Number(ruMatch[1]);
    const month = Number(ruMatch[2]);
    const year = Number(ruMatch[3]);
    const hours = Number(ruMatch[4]);
    const minutes = Number(ruMatch[5]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    const date = new Date(year, month - 1, day, hours, minutes);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hours &&
      date.getMinutes() === minutes
    ) {
      return date;
    }
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const hours = Number(isoMatch[4]);
    const minutes = Number(isoMatch[5]);
    const date = new Date(year, month - 1, day, hours, minutes);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hours &&
      date.getMinutes() === minutes
    ) {
      return date;
    }
  }

  return null;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function toIsoDateFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function normalizeDateValueToIso(value) {
  if (!value) {
    return "";
  }
  const parsed = parseDateInput(value) || parseIsoDate(value);
  return parsed ? toIsoDateFromDate(parsed) : String(value || "");
}

function formatIsoDateForInput(value) {
  const parsed = parseIsoDate(value) || parseDateInput(value);
  return parsed
    ? `${pad2(parsed.getDate())}.${pad2(parsed.getMonth() + 1)}.${parsed.getFullYear()}`
    : String(value || "");
}

function formatIsoDateDisplay(value) {
  const parsed = parseIsoDate(value) || parseDateInput(value);
  return parsed
    ? `${pad2(parsed.getDate())}.${pad2(parsed.getMonth() + 1)}.${parsed.getFullYear()}`
    : "дата не указана";
}

function maskTimeInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function isValidTimeInput(value) {
  if (!value) {
    return true;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!match) {
    return false;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function buildDateTimeFromIsoDate(dateValue, timeValue = "") {
  const date = parseIsoDate(dateValue) || parseDateInput(dateValue);
  if (!date) {
    return null;
  }
  if (isValidTimeInput(timeValue) && timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(23, 59, 0, 0);
  }
  return date;
}

function validateField(field, value, route, state) {
  if (!field || !isFieldVisible(field, route, state)) {
    return null;
  }

  if (field.kind === "participants") {
    const participants = normalizeParticipants(value);
    const hasParticipant = participants.some(
      (participant) => participant.fullName.trim() && participant.role
    );
    const hasIncompleteParticipant = participants.some(
      (participant) =>
        (participant.fullName.trim() || participant.role) &&
        !(participant.fullName.trim() && participant.role)
    );

    if (hasIncompleteParticipant) {
      return "В каждой заполненной строке укажите и ФИО, и роль участника.";
    }
    if (isFieldRequired(field, route, state) && !hasParticipant) {
      return "Добавьте хотя бы одного участника с ФИО и ролью.";
    }
    return null;
  }

  const isEmpty =
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isFieldRequired(field, route, state) && isEmpty) {
    return "Поле обязательно для текущей ветки.";
  }

  if (isEmpty) {
    return null;
  }

  if (field.kind === "date") {
    return parseDateInput(value) ? null : "Введите дату в формате ДД.ММ.ГГГГ.";
  }

  if (field.kind === "datetime-local") {
    return parseDateTimeInput(value) ? null : "Введите дату и время в формате ДД.ММ.ГГГГ ЧЧ:ММ.";
  }

  if (field.kind === "number") {
    return Number.isFinite(Number(value))
      ? null
      : "Введите числовое значение без лишних символов.";
  }

  switch (field.mask) {
    case "phone":
      return value.replace(/\D/g, "").length === 11 ? null : "Телефон должен содержать 11 цифр.";
    case "snils":
      return value.replace(/\D/g, "").length === 11 ? null : "СНИЛС должен содержать 11 цифр.";
    case "inn10":
      return value.replace(/\D/g, "").length === 10 ? null : "ИНН должен содержать 10 цифр.";
    case "inn12":
      return value.replace(/\D/g, "").length === 12 ? null : "ИНН должен содержать 12 цифр.";
    case "inn10or12": {
      const count = value.replace(/\D/g, "").length;
      return count === 10 || count === 12 ? null : "ИНН должен содержать 10 или 12 цифр.";
    }
    case "account20":
      return value.replace(/\D/g, "").length === 20 ? null : "Счет должен содержать 20 цифр.";
    case "nis20":
      return value.replace(/\D/g, "").length === 20 ? null : "Номер НИС должен содержать 20 цифр.";
    case "day": {
      const day = Number(value);
      return day >= 1 && day <= 31 ? null : "День платежа должен быть в диапазоне 1-31.";
    }
    case "cadastral":
      return /^\d{2}:\d{2}:\d{6,7}:\d+$/.test(value)
        ? null
        : "Введите кадастровый номер в формате 00:00:0000000:000.";
    default:
      break;
  }

  if (field.kind === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? null
      : "Введите корректный email.";
  }

  return null;
}

function isFieldVisible(field, route, state) {
  if (!field.visibleWhen) {
    return true;
  }
  return field.visibleWhen(route, state);
}

function isFieldRequired(field, route, state) {
  if (typeof field.required === "function") {
    return field.required(route, state);
  }
  return Boolean(field.required);
}

function sourceText(field) {
  if (field.sourceText) {
    return field.sourceText;
  }
  const apicsSuffix = field.apicsId ? ` · ${field.apicsId}` : "";
  if (field.sourceKind === "apics") {
    return `${field.callType}-й звонок · обязательная сущность реестра${apicsSuffix}`;
  }
  if (field.sourceKind === "csv_no_id") {
    return `${field.callType}-й звонок · поле реестра без системного id`;
  }
  return "Методология · контроль и регуляторная проверка";
}

function isFieldHardReadonly(field) {
  return Boolean(field?.readonly || field?.readonlyMode === "imported");
}

function renderFieldMetaBadges(field) {
  const badges = [];
  if (field.readonlyMode === "soft") {
    badges.push(`soft · ${field.importedSource || "источник"}`);
  }
  if (field.readonlyMode === "imported" || field.readonly) {
    badges.push(`readonly · ${field.importedSource || "источник"}`);
  }
  if (field.ruleId) {
    badges.push(field.ruleId);
  }
  return badges.map((badge) => `<span class="field-meta-badge">${escapeHtml(badge)}</span>`).join("");
}

function renderImportedWarning(field, value) {
  if (!field.readonlyMode || isFieldValueFilled(field, value)) {
    return "";
  }
  const source = field.importedSource || "источника";
  return `<p class="validation-message soft-warning">Значение не получено из ${escapeHtml(source)}; для прототипа допустим ручной ввод.</p>`;
}

function captureViewState(target) {
  const activeTarget = target || document.activeElement;
  const viewState = {
    scrollX:
      typeof window !== "undefined" && typeof window.scrollX === "number" ? window.scrollX : 0,
    scrollY:
      typeof window !== "undefined" && typeof window.scrollY === "number" ? window.scrollY : 0,
  };

  if (!activeTarget?.dataset?.fieldKey) {
    return viewState;
  }

  viewState.fieldKey = activeTarget.dataset.fieldKey;
  if (activeTarget.dataset.optionValue) {
    viewState.optionValue = activeTarget.dataset.optionValue;
  }
  if (activeTarget.dataset.participantId) {
    viewState.participantId = activeTarget.dataset.participantId;
  }
  if (activeTarget.dataset.participantProp) {
    viewState.participantProp = activeTarget.dataset.participantProp;
  }
  if (typeof activeTarget.value === "string") {
    viewState.value = activeTarget.value;
  }
  if (typeof activeTarget.selectionStart === "number") {
    viewState.selectionStart = activeTarget.selectionStart;
  }
  if (typeof activeTarget.selectionEnd === "number") {
    viewState.selectionEnd = activeTarget.selectionEnd;
  }

  return viewState;
}

function restoreViewState(viewState) {
  if (!viewState) {
    return;
  }

  const restore = () => {
    let target = null;
    if (viewState.fieldKey && typeof document?.querySelector === "function") {
      if (viewState.optionValue) {
        target = document.querySelector(
          `[data-field-key="${viewState.fieldKey}"][data-option-value="${viewState.optionValue}"]`
        );
      }
      if (!target && viewState.participantId && viewState.participantProp) {
        target = document.querySelector(
          `[data-field-key="${viewState.fieldKey}"][data-participant-id="${viewState.participantId}"][data-participant-prop="${viewState.participantProp}"]`
        );
      }
      if (!target && viewState.value) {
        target = document.querySelector(
          `[data-field-key="${viewState.fieldKey}"][value="${viewState.value}"]`
        );
      }
      if (!target) {
        target = document.querySelector(`[data-field-key="${viewState.fieldKey}"]`);
      }
    }

    if (target && typeof target.focus === "function") {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      if (
        typeof viewState.selectionStart === "number" &&
        typeof target.setSelectionRange === "function"
      ) {
        try {
          target.setSelectionRange(
            viewState.selectionStart,
            typeof viewState.selectionEnd === "number"
              ? viewState.selectionEnd
              : viewState.selectionStart
          );
        } catch {
          // Some inputs, like type=number, don't support selection ranges.
        }
      }
    }

    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo(viewState.scrollX || 0, viewState.scrollY || 0);
    }
  };

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restore);
  } else {
    restore();
  }
}

function camelToSnake(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function getCoverageToken(fieldKey, field) {
  if (!field) {
    return null;
  }
  if (field.sourceKind === "apics") {
    return sourceCanonicalByFieldKey[fieldKey] || camelToSnake(fieldKey);
  }
  if (field.sourceKind === "csv_no_id") {
    return sourceNoIdTokenByFieldKey[fieldKey] || field.label;
  }
  return null;
}

function buildCoverageAudit() {
  const seen = {
    call1Apics: new Set(),
    call1NoId: new Set(),
    call2Apics: new Set(),
    call2NoId: new Set(),
  };

  Object.entries(fieldCatalog).forEach(([fieldKey, field]) => {
    const token = getCoverageToken(fieldKey, field);
    if (!token) {
      return;
    }

    if (field.sourceKind === "apics" && field.callType === 1) {
      seen.call1Apics.add(token);
    }
    if (field.sourceKind === "csv_no_id" && field.callType === 1) {
      seen.call1NoId.add(token);
    }
    if (field.sourceKind === "apics" && field.callType === 2) {
      seen.call2Apics.add(token);
    }
    if (field.sourceKind === "csv_no_id" && field.callType === 2) {
      seen.call2NoId.add(token);
    }
  });

  return Object.fromEntries(
    Object.entries(expectedCoverage).map(([groupKey, expected]) => {
      const actual = Array.from(seen[groupKey]).sort();
      const missing = expected.filter((item) => !seen[groupKey].has(item));
      const extra = actual.filter((item) => !expected.includes(item));
      return [
        groupKey,
        {
          expectedCount: expected.length,
          actualCount: actual.length,
          missing,
          extra,
        },
      ];
    })
  );
}

function getRouteLabel(kind, value) {
  return routeOptions[kind].find((item) => item.value === value)?.label || "";
}

function getProgramCompatibility(purpose, program) {
  if (!purpose || !program) {
    return {
      status: "idle",
      reason: "Сначала выберите цель кредита, затем подходящую программу.",
    };
  }
  return (
    compatibilityMatrix[purpose]?.[program] || {
      status: "blocked",
      reason: "Сочетание не подтверждено текущей методологией.",
    }
  );
}

function getRouteCompatibilityRuleId(purpose, program) {
  if (purpose === "refi" && program === "it") {
    return "IT-006";
  }
  if (purpose === "refi" && program === "dv") {
    return "DVA-007";
  }
  if (purpose === "pledge" && program && program !== "base") {
    return "PLEDGE-001";
  }
  if (purpose === "izhs_land" && program === "it") {
    return "IT-007";
  }
  if (purpose === "izhs_land" && program === "dv") {
    return "DVA-008";
  }
  if (purpose === "izhs_land" && program === "military") {
    return "MIL-007";
  }
  if (purpose === "izhs_land" && program === "family_military") {
    return "FMIL-007";
  }
  return "GOV-002";
}

function getPriorGovMortgageRuleId(program) {
  return program === "dv" ? "DVA-005" : "GOV-001";
}

function getCompatibilityLabel(status) {
  if (status === "allowed") {
    return "Доступно";
  }
  if (status === "conditional") {
    return "Условно";
  }
  if (status === "blocked") {
    return "Заблокировано";
  }
  return "Недоступно";
}

function formatDateTimeShort(value) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTimeFull(value) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isTodayValue(value) {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getSortedCalls() {
  return journalState.calls
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function isFilledValue(value) {
  return !(
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isFieldValueFilled(field, value) {
  if (field?.kind === "participants") {
    return isParticipantsFilled(value);
  }
  return isFilledValue(value);
}

function getCallProgress(call, callType) {
  if (!call?.route?.purpose || !call?.route?.program) {
    return { filled: 0, total: 0 };
  }

  const keys = new Set();
  getActiveNodes(call.route)
    .filter((node) => node.callType === callType)
    .forEach((node) => {
      node.fields.forEach((fieldKey) => {
        const field = fieldCatalog[fieldKey];
        const fieldCallType = field?.callType || node.callType;
        if (!field || field.kind === "route" || fieldCallType !== callType) {
          return;
        }
        if (!isFieldVisible(field, call.route, call.form)) {
          return;
        }
        if (isFieldRequired(field, call.route, call.form)) {
          keys.add(fieldKey);
        }
      });
    });

  const requiredKeys = Array.from(keys);
  return {
    filled: requiredKeys.filter((fieldKey) =>
      isFieldValueFilled(fieldCatalog[fieldKey], call.form[fieldKey])
    ).length,
    total: requiredKeys.length,
  };
}

function getProgressPercent(progress) {
  if (!progress.total) {
    return 0;
  }
  return Math.round((progress.filled / progress.total) * 100);
}

function getOverallProgress(call) {
  const call1Progress = getCallProgress(call, 1);
  const call2Progress = getCallProgress(call, 2);
  const total = call1Progress.total + (call.call2Enabled ? call2Progress.total : 0);
  const filled = call1Progress.filled + (call.call2Enabled ? call2Progress.filled : 0);
  return {
    filled,
    total,
    percent: getProgressPercent({ filled, total }),
    call1: {
      ...call1Progress,
      percent: getProgressPercent(call1Progress),
    },
    call2: {
      ...call2Progress,
      percent: getProgressPercent(call2Progress),
    },
  };
}

function renderProgressMeter(label, progress, muted = false) {
  const percent = getProgressPercent(progress);
  return `
    <div class="progress-meter ${muted ? "is-muted" : ""}">
      <div class="progress-meter-head">
        <span>${label}</span>
        <strong>${progress.filled}/${progress.total || 0}</strong>
      </div>
      <div class="progress-track" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
    </div>
  `;
}

function getOutcomeStatusMeta(status) {
  return (
    outcomeStatusOptions.find((option) => option.value === status) || {
      value: "",
      label: "Итог не заполнен",
      tone: "neutral",
      hint: "Менеджер еще не зафиксировал операционный итог контакта.",
    }
  );
}

function getFollowUpChannelLabel(channel) {
  return followUpChannelOptions.find((option) => option.value === channel)?.label || "канал не указан";
}

function validateOutcome(outcome) {
  const normalized = normalizeOutcomeState(outcome);
  const issues = [];
  const followUpRequiredByStatus = outcomeStatusesRequiringFollowUp.has(normalized.status);
  const followUpRequired = followUpRequiredByStatus || normalized.followUp.required;
  const hasValidFollowUpDate = Boolean(
    parseIsoDate(normalized.followUp.date) || parseDateInput(normalized.followUp.date)
  );

  if (!normalized.status) {
    issues.push({
      field: "status",
      message: "Выберите итог звонка.",
    });
  }

  if (followUpRequired && !normalized.nextStep.trim()) {
    issues.push({
      field: "nextStep",
      message: "Для этого статуса нужен следующий шаг.",
    });
  }

  if (followUpRequired && !normalized.followUp.date) {
    issues.push({
      field: "followUp.date",
      message: "Укажите дату следующего контакта.",
    });
  }

  if (normalized.followUp.date && !hasValidFollowUpDate) {
    issues.push({
      field: "followUp.date",
      message: "Дата следующего контакта должна быть в формате ДД.ММ.ГГГГ.",
    });
  }

  if (followUpRequired && !normalized.followUp.reason.trim()) {
    issues.push({
      field: "followUp.reason",
      message: "Укажите причину следующего контакта.",
    });
  }

  if (
    normalized.followUp.channel &&
    !followUpChannelOptions.some((option) => option.value === normalized.followUp.channel)
  ) {
    issues.push({
      field: "followUp.channel",
      message: "Выберите корректный канал следующего контакта.",
    });
  }

  if (normalized.followUp.time && !isValidTimeInput(normalized.followUp.time)) {
    issues.push({
      field: "followUp.time",
      message: "Время должно быть в формате ЧЧ:ММ.",
    });
  }

  return {
    issues,
    isReady: issues.length === 0,
    followUpRequired,
  };
}

function getOutcomeReadiness(outcome) {
  const validation = validateOutcome(outcome);
  const normalized = normalizeOutcomeState(outcome);
  if (!normalized.status) {
    return {
      label: "Итог не заполнен",
      tone: "neutral",
    };
  }
  if (!validation.isReady) {
    return {
      label: "Итог требует дозаполнения",
      tone: "warning",
    };
  }
  if (validation.followUpRequired && normalized.followUp.date) {
    return {
      label: "Следующий контакт запланирован",
      tone: "info",
    };
  }
  return {
    label: "Итог сохранен",
    tone: "success",
  };
}

function buildFollowUpTaskFromCall(call) {
  const outcome = normalizeOutcomeState(call?.outcome);
  const requiredByStatus = outcomeStatusesRequiringFollowUp.has(outcome.status);
  const required = outcome.followUp.required || requiredByStatus;
  const hasPlanningSignal = Boolean(
    outcome.followUp.date || outcome.nextStep.trim() || outcome.followUp.reason.trim()
  );

  if (!call || !required || outcome.followUp.done || !hasPlanningSignal) {
    return null;
  }

  const dueAt = buildDateTimeFromIsoDate(outcome.followUp.date, outcome.followUp.time);
  return {
    callId: call.id,
    title: call.title || "Новая карточка",
    clientName: call.clientName || "ФИО клиента не указано",
    callName: call.callName || "Звонок",
    status: outcome.status,
    statusLabel: getOutcomeStatusMeta(outcome.status).label,
    nextStep: outcome.nextStep,
    date: outcome.followUp.date,
    time: outcome.followUp.time,
    channel: outcome.followUp.channel,
    reason: outcome.followUp.reason,
    promisedDocsCount: outcome.promisedDocs.filter((doc) => doc.name && !doc.received).length,
    dueAt,
    urgency: getFollowUpUrgency(outcome.followUp.date, outcome.followUp.time),
  };
}

function buildCalendarTasks(options = {}) {
  const includeDone = Boolean(options.includeDone);
  return getSortedCalls()
    .map(buildFollowUpTaskFromCall)
    .filter(Boolean)
    .filter((task) => includeDone || task.urgency !== "done")
    .sort((left, right) => {
      if (!left.dueAt && !right.dueAt) return left.title.localeCompare(right.title, "ru");
      if (!left.dueAt) return 1;
      if (!right.dueAt) return -1;
      return left.dueAt.getTime() - right.dueAt.getTime();
    });
}

function getFollowUpUrgency(dateValue, timeValue = "") {
  if (!dateValue) {
    return "no_date";
  }
  const dueAt = buildDateTimeFromIsoDate(dateValue, timeValue);
  if (!dueAt) {
    return "no_date";
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const afterTomorrow = new Date(today);
  afterTomorrow.setDate(today.getDate() + 2);
  const dueDay = new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate());

  if (dueAt.getTime() < now.getTime()) {
    return "overdue";
  }
  if (dueDay.getTime() === today.getTime()) {
    return "today";
  }
  if (dueDay.getTime() === tomorrow.getTime()) {
    return "tomorrow";
  }
  if (dueDay.getTime() >= afterTomorrow.getTime()) {
    return "later";
  }
  return "later";
}

function groupCalendarTasks(tasks) {
  const grouped = {
    overdue: [],
    today: [],
    tomorrow: [],
    later: [],
    no_date: [],
  };
  tasks.forEach((task) => {
    const key = grouped[task.urgency] ? task.urgency : "later";
    grouped[key].push(task);
  });
  return grouped;
}

function getFollowUpUrgencyLabel(urgency) {
  if (urgency === "overdue") return "Просрочено";
  if (urgency === "today") return "Сегодня";
  if (urgency === "tomorrow") return "Завтра";
  if (urgency === "later") return "Позже";
  return "Без даты";
}

function formatFollowUpMoment(dateValue, timeValue = "") {
  if (!dateValue) {
    return "Дата не указана";
  }
  return `${formatIsoDateDisplay(dateValue)}${timeValue ? `, ${timeValue}` : ""}`;
}

function getActiveStageNumber(call) {
  return call?.call2Enabled && call?.activeStage === "call2" ? 2 : 1;
}

function getActiveStageLabel(call) {
  return getActiveStageNumber(call) === 2 ? "2-й звонок" : "1-й звонок";
}

function isParticipantArray(value) {
  return (
    Array.isArray(value) &&
    value.some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("fullName" in item || "role" in item)
    )
  );
}

function serializeExportValue(value, field = null) {
  if (field?.kind === "participants" || isParticipantArray(value)) {
    return serializeParticipants(value, field || fieldCatalog.dealParticipants);
  }
  if (Array.isArray(value)) {
    return value.join(" | ");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function escapeCsv(value) {
  const normalized = serializeExportValue(value);
  if (/[",;\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}

function getExportFieldEntries() {
  return Object.entries(fieldCatalog)
    .filter(([, field]) => field.kind !== "route")
    .sort(([left], [right]) => left.localeCompare(right, "ru"));
}

function getExportFieldPrefix(field) {
  if (field.callType === 1) {
    return "call1";
  }
  if (field.callType === 2) {
    return "call2";
  }
  return "precheck";
}

function serializePromisedDocs(docs) {
  return (Array.isArray(docs) ? docs : [])
    .filter((doc) => doc?.name || doc?.dueDate || doc?.comment)
    .map((doc) => {
      const status = doc.received ? "получен" : "ждем";
      return [
        doc.name || "документ не указан",
        doc.dueDate ? `срок ${formatIsoDateDisplay(doc.dueDate)}` : "срок не указан",
        status,
        doc.comment || "",
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .join(" | ");
}

function buildCallExportRow(call) {
  const compatibility = getProgramCompatibility(call.route.purpose, call.route.program);
  const precheckIssues = computePrecheckIssues(call.route, call.form);
  const contradictions = getContradictions(call.route, call.form, call);
  const flowInsights = computeInsights(call.route, call.form);
  const allSignals = computeAllSignals(call, {
    precheckIssues,
    contradictions,
    insights: flowInsights,
  });
  const signalSummary = summarizeSignals(allSignals);
  const dealReadiness = computeDealReleaseReadiness(call, allSignals);
  const activeNodes = call.route.purpose && call.route.program ? getActiveNodes(call.route) : [];
  const call1Progress = getCallProgress(call, 1);
  const call2Progress = getCallProgress(call, 2);
  const outcome = normalizeOutcomeState(call.outcome);
  const outcomeValidation = validateOutcome(outcome);
  const followUpTask = buildFollowUpTaskFromCall(call);

  const row = {
    call_id: call.id,
    card_title: call.title,
    call_name: call.callName,
    client_name: call.clientName,
    created_at: call.createdAt,
    updated_at: call.updatedAt,
    active_stage: call.activeStage,
    call2_enabled: call.call2Enabled ? "yes" : "no",
    purpose_code: call.route.purpose,
    purpose_label: getRouteLabel("purpose", call.route.purpose),
    program_code: call.route.program,
    program_label: getRouteLabel("program", call.route.program),
    compatibility_status: compatibility.status,
    compatibility_label: getCompatibilityLabel(compatibility.status),
    compatibility_reason: compatibility.reason,
    precheck_blockers: precheckIssues.filter((item) => item.level === "blocker").length,
    precheck_warnings: precheckIssues.filter((item) => item.level === "warning").length,
    signal_missing_count: signalSummary.missing,
    signal_validation_count: signalSummary.validation,
    signal_contradiction_count: signalSummary.contradiction,
    signal_info_count: signalSummary.info,
    signal_stop_count: signalSummary.stop,
    triggered_rule_ids: Array.from(new Set(allSignals.map((signal) => signal.ruleId))).join(" | "),
    triggered_rules_json: JSON.stringify(
      allSignals.map((signal) => ({
        ruleId: signal.ruleId,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        fields: signal.fields,
      }))
    ),
    deal_release_status: dealReadiness.label,
    apics_field_map_json: JSON.stringify(
      Object.fromEntries(
        Object.entries(fieldCatalog)
          .filter(([, field]) => field.apicsId)
          .map(([fieldKey, field]) => [fieldKey, field.apicsId])
      )
    ),
    participants_json: JSON.stringify(getCallParticipants(call)),
    call1_nodes: activeNodes.filter((node) => node.callType === 1).length,
    call2_nodes: activeNodes.filter((node) => node.callType === 2).length,
    call1_required_filled: call1Progress.filled,
    call1_required_total: call1Progress.total,
    call2_required_filled: call2Progress.filled,
    call2_required_total: call2Progress.total,
    outcome_status: outcome.status,
    outcome_status_label: getOutcomeStatusMeta(outcome.status).label,
    outcome_ready: outcomeValidation.isReady ? "yes" : "no",
    outcome_confirmed_summary: outcome.confirmedSummary,
    outcome_unresolved_summary: outcome.unresolvedSummary,
    outcome_risk_summary: outcome.riskSummary,
    outcome_promised_docs: serializePromisedDocs(outcome.promisedDocs),
    outcome_next_step: outcome.nextStep,
    outcome_updated_at: outcome.updatedAt,
    followup_required: outcome.followUp.required ? "yes" : "no",
    followup_date: outcome.followUp.date,
    followup_time: outcome.followUp.time,
    followup_channel: outcome.followUp.channel,
    followup_channel_label: getFollowUpChannelLabel(outcome.followUp.channel),
    followup_reason: outcome.followUp.reason,
    followup_done: outcome.followUp.done ? "yes" : "no",
    followup_done_at: outcome.followUp.doneAt,
    followup_urgency: followUpTask ? getFollowUpUrgencyLabel(followUpTask.urgency) : "",
  };

  getExportFieldEntries().forEach(([fieldKey, field]) => {
    row[`${getExportFieldPrefix(field)}_${camelToSnake(fieldKey)}`] = serializeExportValue(
      call.form[fieldKey],
      field
    );
  });

  return row;
}

function buildCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(";")),
  ];
  return lines.join("\n");
}

function downloadCsv(filename, content) {
  if (!content) {
    return;
  }
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, payload) {
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportAllCalls() {
  const calls = getSortedCalls();
  if (!calls.length) {
    window.alert("В журнале пока нет сохраненных звонков для выгрузки.");
    return;
  }
  const csv = buildCsv(calls.map((call) => buildCallExportRow(call)));
  downloadCsv(`mortgage_calls_${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

function exportCallById(callId) {
  const call = journalState.calls.find((item) => item.id === callId);
  if (!call) {
    return;
  }
  const csv = buildCsv([buildCallExportRow(call)]);
  downloadCsv(`mortgage_call_${call.id.slice(0, 8)}.csv`, csv);
}

function getRecoverableUiState(source) {
  return {
    detailMode: Boolean(source.detailMode),
    questionMode: Boolean(source.questionMode),
    outputStage: source.outputStage || "call1",
    outputMode: source.outputMode || "system",
    outputFilledMode: source.outputFilledMode || "filled",
    outputShowMethodology: Boolean(source.outputShowMethodology),
    contradictionsExpanded: Boolean(source.contradictionsExpanded),
    calendarView: source.calendarView || "list",
    calendarSelectedDate: source.calendarSelectedDate || "",
    calendarFilter: source.calendarFilter || "all",
  };
}

function normalizeImportedUiState(raw) {
  return {
    ...createUiState(),
    ...getRecoverableUiState(raw && typeof raw === "object" ? raw : {}),
    outputOpen: false,
    outputCopyMessage: "",
    calendarOpen: false,
  };
}

function slugifyManagerName(fullName) {
  const translitMap = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const normalized = String(fullName || "manager")
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "manager";
}

function buildSessionBackup() {
  const exportedAt = new Date().toISOString();
  return {
    version: SESSION_BACKUP_VERSION,
    appSchemaVersion: APP_SCHEMA_VERSION,
    journalSchemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION,
    exportedAt,
    managerProfile: {
      ...createManagerProfile(),
      ...managerProfile,
      lastExportAt: exportedAt,
    },
    journalState: {
      calls: journalState.calls,
      activeCallId: journalState.activeCallId,
      schemaVersion: journalState.schemaVersion || CURRENT_JOURNAL_SCHEMA_VERSION,
    },
    uiState: getRecoverableUiState(uiState),
    meta: {
      appName: SESSION_BACKUP_APP_NAME,
      format: SESSION_BACKUP_FORMAT,
      appSchemaVersion: APP_SCHEMA_VERSION,
      journalSchemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION,
    },
  };
}

function getSessionBackupFilename(backup) {
  const exportedAt = new Date(backup.exportedAt);
  const datePart = Number.isNaN(exportedAt.getTime())
    ? getTodayIsoDate()
    : `${exportedAt.getFullYear()}-${pad2(exportedAt.getMonth() + 1)}-${pad2(exportedAt.getDate())}`;
  const timePart = Number.isNaN(exportedAt.getTime())
    ? "00-00"
    : `${pad2(exportedAt.getHours())}-${pad2(exportedAt.getMinutes())}`;
  return `session_${slugifyManagerName(backup.managerProfile.fullName)}_${datePart}_${timePart}.json`;
}

function setSessionFeedback(message, tone = "info") {
  sessionFeedback = message;
  sessionFeedbackTone = tone;
}

function exportSessionBackup() {
  if (!managerProfile.fullName.trim()) {
    setSessionFeedback("Укажите ФИО менеджера перед экспортом сессии.", "warning");
    renderApp({ viewState: captureViewState() });
    return;
  }

  const backup = buildSessionBackup();
  managerProfile.lastExportAt = backup.exportedAt;
  persistManagerProfile();
  downloadJson(getSessionBackupFilename(backup), backup);
  setSessionFeedback("Сессия успешно экспортирована.", "success");
  renderApp({ viewState: captureViewState() });
}

function normalizeImportedJournalState(raw) {
  const migrated = migrateJournalState(raw);
  if (!migrated || typeof migrated !== "object" || !Array.isArray(migrated.calls)) {
    return null;
  }
  const calls = migrated.calls.map(normalizeCallRecord);
  const activeCallId = calls.some((call) => call.id === migrated.activeCallId) ? migrated.activeCallId : "";
  return { calls, activeCallId, schemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION };
}

function validateSessionBackup(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Файл поврежден или неполон." };
  }
  if (payload.meta?.format !== SESSION_BACKUP_FORMAT) {
    return { ok: false, reason: "Файл не является резервной копией блокнота." };
  }
  if (!payload.version) {
    return { ok: false, reason: "Файл поврежден или неполон: нет версии backup." };
  }
  if (Number(payload.version) !== SESSION_BACKUP_VERSION) {
    return { ok: false, reason: "Версия файла не поддерживается." };
  }
  if (!payload.managerProfile || typeof payload.managerProfile !== "object") {
    return { ok: false, reason: "Файл поврежден или неполон: нет профиля менеджера." };
  }
  if (!String(payload.managerProfile.fullName || "").trim()) {
    return { ok: false, reason: "Файл поврежден или неполон: не указано ФИО менеджера." };
  }

  const normalizedJournal = normalizeImportedJournalState(payload.journalState);
  if (!normalizedJournal) {
    return { ok: false, reason: "Файл поврежден или неполон: нет журнала звонков." };
  }

  const normalizedManager = {
    ...createManagerProfile(),
    ...payload.managerProfile,
    fullName: String(payload.managerProfile.fullName || "").trimStart(),
    lastExportAt: payload.managerProfile.lastExportAt || payload.exportedAt || "",
  };
  const normalizedUiState = normalizeImportedUiState(payload.uiState);

  return {
    ok: true,
    normalized: {
      version: Number(payload.version),
      exportedAt: payload.exportedAt || "",
      managerProfile: normalizedManager,
      journalState: normalizedJournal,
      uiState: normalizedUiState,
      meta: {
        appName: payload.meta?.appName || SESSION_BACKUP_APP_NAME,
        format: SESSION_BACKUP_FORMAT,
      },
    },
  };
}

function importSessionBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload = null;
    try {
      payload = JSON.parse(String(reader.result || ""));
    } catch {
      setSessionFeedback("Не удалось импортировать файл: неверный JSON.", "danger");
      renderApp({ viewState: captureViewState() });
      return;
    }

    const validation = validateSessionBackup(payload);
    if (!validation.ok) {
      setSessionFeedback(`Не удалось импортировать файл: ${validation.reason}`, "danger");
      renderApp({ viewState: captureViewState() });
      return;
    }

    pendingSessionImport = {
      fileName: file.name,
      backup: validation.normalized,
    };
    setSessionFeedback("", "info");
    renderSessionModal();
  };
  reader.onerror = () => {
    setSessionFeedback("Не удалось прочитать файл сессии.", "danger");
    renderApp({ viewState: captureViewState() });
  };
  reader.readAsText(file);
}

function mergeImportedJournalState(current, imported) {
  const existingIds = new Set(current.calls.map((call) => call.id));
  const idMap = new Map();
  const importedCalls = imported.calls.map((call) => {
    let nextId = call.id || generateCallId();
    while (existingIds.has(nextId)) {
      nextId = generateCallId();
    }
    existingIds.add(nextId);
    if (call.id) {
      idMap.set(call.id, nextId);
    }
    return {
      ...call,
      id: nextId,
    };
  });

  return {
    calls: [...current.calls, ...importedCalls],
    activeCallId:
      idMap.get(imported.activeCallId) ||
      current.activeCallId ||
      importedCalls[0]?.id ||
      "",
    schemaVersion: CURRENT_JOURNAL_SCHEMA_VERSION,
  };
}

function applyImportedSession(backup, fileName = "", mode = "replace") {
  if (mode === "merge") {
    const mergedJournal = mergeImportedJournalState(journalState, backup.journalState);
    journalState.calls = mergedJournal.calls;
    journalState.activeCallId = mergedJournal.activeCallId;
    journalState.schemaVersion = mergedJournal.schemaVersion;
    Object.assign(managerProfile, {
      fullName: managerProfile.fullName || backup.managerProfile.fullName || "",
      lastImportedAt: new Date().toISOString(),
      lastImportedFileName: fileName,
    });
  } else {
    journalState.calls = backup.journalState.calls;
    journalState.activeCallId = backup.journalState.activeCallId;
    journalState.schemaVersion = backup.journalState.schemaVersion || CURRENT_JOURNAL_SCHEMA_VERSION;
    uiState = normalizeImportedUiState(backup.uiState);
    Object.assign(managerProfile, createManagerProfile(), backup.managerProfile, {
      lastImportedAt: new Date().toISOString(),
      lastImportedFileName: fileName,
    });
  }
  persistJournalState();
  persistUiState();
  persistManagerProfile();
  pendingSessionImport = null;
  setSessionFeedback(
    mode === "merge" ? "Звонки из файла добавлены к текущей сессии." : "Сессия успешно импортирована.",
    "success"
  );
  syncActiveCallRefs();
  renderApp({ scrollToWorkspace: Boolean(journalState.activeCallId) });
}

const documentGroupByPurpose = {
  ready: "secondary",
  pledge: "secondary-lite",
  build: "primary",
  izhs: "izhs",
  izhs_land: "izhs",
  refi: "refi",
};

const documentGroupMeta = {
  secondary: {
    title: "Документы: вторичка",
    baseChip: "База: вторичка",
    description: "Готовое жилье / вторичный рынок.",
  },
  "secondary-lite": {
    title: "Документы: залог",
    baseChip: "База: вторичка-lite",
    description: "Урезанная вторичная ветка для залога имеющейся квартиры.",
  },
  primary: {
    title: "Документы: новостройка",
    baseChip: "База: новостройка",
    description: "Строящееся жилье, ДДУ, уступка, ввод и цепочка прав.",
  },
  izhs: {
    title: "Документы: ИЖС",
    baseChip: "База: ИЖС",
    description: "ИЖС, земельный участок, подрядчик, транши и акт осмотра.",
  },
  refi: {
    title: "Документы: перекредитование",
    baseChip: "База: refi",
    description:
      "Перекредитование с кредитными документами старого кредита, ПСК, остатком задолженности и реквизитами погашения.",
  },
  unsupported_yet: {
    title: "Документы: сценарий не собран",
    baseChip: "База: нет сценария",
    description: "Для этой цели отдельный документный сценарий пока не собран.",
  },
};

const documentScenarioFlags = [
  {
    id: "sellerIndividual",
    title: "Продавец ФЛ",
    group: "Продавец и право",
    groups: ["secondary", "secondary-lite", "primary", "refi"],
    autoWhen: (call) => call.form.sellerType === "individual",
  },
  {
    id: "sellerCompany",
    title: "Продавец ЮЛ",
    group: "Продавец и право",
    groups: ["secondary", "secondary-lite", "primary", "refi"],
    autoWhen: (call) => call.form.sellerType === "company",
  },
  {
    id: "sellerRelated",
    title: "Есть родство",
    group: "Продавец и право",
    groups: ["secondary", "secondary-lite", "primary", "refi"],
    autoWhen: (call) => call.form.sellerRelationToBorrower === "yes",
  },
  {
    id: "byPoa",
    title: "Сделка по доверенности",
    group: "Продавец и право",
    groups: ["secondary", "secondary-lite", "primary", "refi"],
    autoWhen: (call) => call.form.representativeNeeded === "yes",
  },
  {
    id: "minorPresent",
    title: "Есть несовершеннолетний",
    group: "Участники",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => call.form.minorParticipants === "yes",
  },
  {
    id: "married",
    title: "Брачный блок",
    group: "Участники",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => call.form.familyStatus === "married",
  },
  {
    id: "hasMsk",
    title: "Есть МСК",
    group: "ПВ и субсидии",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => call.form.subsidyName === "msk",
  },
  {
    id: "hasSubsidy",
    title: "Есть субсидия",
    group: "ПВ и субсидии",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => Boolean(call.form.subsidyName && call.form.subsidyName !== "msk"),
  },
  {
    id: "nis",
    title: "Военная / НИС",
    group: "ПВ и субсидии",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) =>
      call.route.program === "military" ||
      call.route.program === "family_military" ||
      call.form.militaryNisConfirmed === "yes",
  },
  {
    id: "pvDoc",
    title: "Нужен документ по ПВ",
    group: "ПВ и субсидии",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => Boolean(call.form.pvDocAmount),
  },
  {
    id: "escrow",
    title: "Эскроу / спецсчет",
    group: "Расчеты",
    groups: ["primary", "izhs"],
    autoWhen: (call) => call.form.specialAccountFlag === "escrow",
  },
  {
    id: "accreditive",
    title: "Аккредитив",
    group: "Расчеты",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => call.form.paymentMethod === "accreditive",
  },
  {
    id: "externalSettlement",
    title: "Внешние расчеты",
    group: "Расчеты",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    autoWhen: (call) => call.form.externalEscrow === "yes",
  },
  {
    id: "duptIndividual",
    title: "ДУПТ от ФЛ",
    group: "Новостройка",
    groups: ["primary"],
    autoWhen: (call) => call.route.purpose === "build" && call.form.sellerType === "individual",
  },
  {
    id: "problemObject",
    title: "Проблемный объект",
    group: "Новостройка",
    groups: ["primary"],
    autoWhen: (call) => call.form.problemObject === "yes",
  },
  {
    id: "commissionedNoRights",
    title: "Ввод без права",
    group: "Новостройка",
    groups: ["primary"],
    autoWhen: (call) => call.form.buildCommissionedWithoutRights === "yes",
  },
  {
    id: "izhsLandPurchase",
    title: "Покупается ЗУ",
    group: "ИЖС",
    groups: ["izhs"],
    autoWhen: (call) => call.route.purpose === "izhs_land",
  },
  {
    id: "selfBuild",
    title: "Своими силами",
    group: "ИЖС",
    groups: ["izhs"],
    autoWhen: (call) => call.form.contractorType === "self",
  },
  {
    id: "contractorBuild",
    title: "Есть подрядчик",
    group: "ИЖС",
    groups: ["izhs"],
    autoWhen: (call) => call.form.contractorType === "ip" || call.form.contractorType === "company",
  },
  {
    id: "inspectionAct",
    title: "Нужен акт осмотра",
    group: "ИЖС",
    groups: ["izhs"],
    autoWhen: (call) =>
      (call.route.purpose === "izhs" || call.route.purpose === "izhs_land") &&
      call.form.paymentMethod === "accreditive",
  },
  {
    id: "tranches",
    title: "Транши / этапность",
    group: "ИЖС",
    groups: ["izhs"],
  },
];

const documentSections = [
  {
    id: "base_required",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "Базовый пакет",
    description: "Документы, которые накладываются поверх любой цели и программы.",
    stage: "call1",
    always: true,
    items: [
      {
        id: "sopd_borrower",
        ruleId: "DOC-BASE-001",
        title: "СОПД заемщика",
        note: "Согласие на обработку персональных данных заемщика.",
        badges: ["обязательный", "СОПД"],
        required: true,
        critical: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "sopd_pledgor",
        ruleId: "DOC-BASE-001",
        title: "СОПД залогодателя-физлица",
        note: "Нужно, если залогодатель не является заемщиком.",
        badges: ["условный", "СОПД", "залогодатель"],
        visibleWhen: (call) => call.form.nonBorrowerPledgorPresent === "yes" || hasParticipantWithRole(call, "pledgor"),
        critical: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "siz_borrower",
        ruleId: "DOC-BASE-002",
        title: "СиЗ заемщика / заявителя",
        note: "Согласия и заверения по базовому пакету клиента.",
        badges: ["обязательный", "СиЗ"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.passport",
        ruleId: "DOC-BASE-003",
        title: "Паспорт РФ совершеннолетнего участника",
        note: "Идентификация заемщика и других совершеннолетних участников сделки.",
        badges: ["обязательный", "паспорт"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.birth_certificate_minor",
        ruleId: "DOC-BASE-004",
        title: "Свидетельство о рождении несовершеннолетнего",
        note: "Нужно для несовершеннолетнего участника без паспорта.",
        badges: ["условный", "дети"],
        visibleWhen: (call) => call.form.minorParticipants === "yes" || hasMinorParticipant(call),
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.registration_doc",
        ruleId: "DOC-BASE-005",
        title: "Документ о регистрации",
        note: "Запрашивается, если в паспорте нет нужных сведений о регистрации.",
        badges: ["условный", "регистрация"],
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "snils",
        ruleId: "DOC-BASE-006",
        title: "СНИЛС / АДИ-РЕГ",
        note: "Для госпрограмм, детей и участников, если это требуется сценарием.",
        badges: ["условный", "СНИЛС", "АДИ-РЕГ"],
        required: (call) => call.route.program && call.route.program !== "base",
        visibleWhen: (call) =>
          call.route.program !== "base" ||
          call.form.minorParticipants === "yes" ||
          hasMinorParticipant(call),
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.kinship_docs",
        ruleId: "DOC-BASE-007",
        title: "Документы о родстве",
        note: "Нужны, если залогодатель не является заемщиком.",
        badges: ["условный", "родство"],
        visibleWhen: (call) => call.form.nonBorrowerPledgorPresent === "yes" || hasParticipantWithRole(call, "pledgor"),
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "guardianship_permission",
        ruleId: "DOC-BASE-008",
        title: "Разрешение органов опеки",
        note: "Критично при несовершеннолетних участниках или залогодателях.",
        badges: ["условный", "опека", "критично"],
        visibleWhen: (call) => call.form.minorParticipants === "yes" || hasMinorParticipant(call),
        critical: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.income_employment",
        ruleId: "DOC-BASE-009",
        title: "Документы о доходе и занятости",
        note: "Справка, выписка или иной источник по выбранному типу подтверждения дохода.",
        badges: ["условный", "доход"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "base.spouse_docs",
        ruleId: "DOC-BASE-010",
        title: "Документы по супругу / брачному режиму",
        note: "Согласие супруга, брачный договор или подтверждение статуса.",
        badges: ["условный", "брачный блок"],
        visibleWhen: (call) => getDocumentFlagValue(call, "married"),
        source: METHODOLOGY_SOURCE,
      },
    ],
  },
  {
    id: "secondary_scenario",
    groups: ["secondary", "secondary-lite"],
    title: "Сценарий сделки",
    description: "Короткая сверка развилок вторички перед сбором документов.",
    stage: "call1",
    items: [
      {
        id: "secondary.scenario.route",
        ruleId: "DOC-SEC-001",
        title: "Зафиксирована цель, программа и тип объекта",
        note: "Сценарий вторички должен быть определен до запроса полного пакета.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.scenario.seller",
        ruleId: "DOC-SEC-002",
        title: "Определен тип продавца",
        note: "ФЛ / ЮЛ влияет на юридический пакет и проверку полномочий.",
        badges: ["обязательный"],
        required: true,
      },
    ],
  },
  {
    id: "secondary_object",
    groups: ["secondary", "secondary-lite"],
    title: "Объектный пакет по вторичке",
    description: "Право, объект и ранние документы по готовому жилью.",
    stage: "call1",
    items: [
      {
        id: "secondary.object.egrn",
        ruleId: "DOC-SEC-003",
        title: "Выписка из ЕГРН",
        note: "Подтверждает правообладателя, объект и обременения.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.object.appraisal",
        ruleId: "DOC-SEC-004",
        title: "Отчет об оценке",
        note: "Нужен для проверки стоимости и предмета залога.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.object.dkp_project",
        ruleId: "DOC-SEC-005",
        title: "Проект договора купли-продажи",
        note: "Нужен для юридической сверки условий сделки.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.object.cadastral",
        ruleId: "DOC-SEC-006",
        title: "Кадастровые / технические сведения по объекту",
        note: "Сверка адреса, площади, этажа и кадастрового номера.",
        badges: ["обязательный"],
        required: true,
      },
    ],
  },
  {
    id: "secondary_title_basis",
    groups: ["secondary", "secondary-lite"],
    title: "Основание права продавца",
    description: "Документы, подтверждающие как продавец получил право.",
    stage: "call1",
    items: [
      {
        id: "secondary.seller.title_doc",
        ruleId: "DOC-SEC-007",
        title: "Документ-основание права продавца",
        note: "ДКП, ДДУ, наследство, дарение, решение суда или иной документ.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.seller.payment_proof",
        ruleId: "DOC-SEC-008",
        title: "Подтверждение расчетов по прошлой сделке",
        note: "Запрашивается, если есть риск по цепочке или недавнему переходу права.",
        badges: ["условный"],
        visibleWhen: (call) => getDocumentFlagValue(call, "sellerIndividual"),
      },
      {
        id: "secondary.seller.kinship",
        ruleId: "DOC-SEC-009",
        title: "Документы о родстве с продавцом",
        note: "Нужны при родственных связях продавца и заемщика.",
        badges: ["условный", "родство"],
        visibleWhen: (call) => getDocumentFlagValue(call, "sellerRelated"),
      },
    ],
  },
  {
    id: "secondary_registered",
    groups: ["secondary", "secondary-lite"],
    title: "Зарегистрированные лица",
    description: "Кто зарегистрирован в объекте и есть ли ограничения по снятию с учета.",
    stage: "call1",
    items: [
      {
        id: "secondary.registered.persons",
        ruleId: "DOC-SEC-010",
        title: "Документ о зарегистрированных лицах",
        note: "Выписка из домовой книги, ЕЖД или аналогичный документ.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "secondary.registered.obligation",
        ruleId: "DOC-SEC-011",
        title: "Обязательство о снятии с регистрационного учета",
        note: "Нужно, если зарегистрированные лица сохраняются до сделки.",
        badges: ["условный"],
      },
    ],
  },
  {
    id: "secondary_legal_branches",
    groups: ["secondary", "secondary-lite"],
    title: "Продавец / супруг / опека / доверенность",
    description: "Условные юридические ветки вторички.",
    stage: "call2",
    items: [
      {
        id: "secondary.legal.seller_spouse",
        ruleId: "DOC-SEC-012",
        title: "Нотариальное согласие супруга продавца",
        note: "Запрашивается, если объект приобретался в браке и нет исключения.",
        badges: ["условный", "брачный блок"],
        visibleWhen: (call) => getDocumentFlagValue(call, "married"),
      },
      {
        id: "secondary.legal.poa",
        ruleId: "DOC-SEC-013",
        title: "Доверенность и паспорт представителя",
        note: "Проверка полномочий представителя по сделке.",
        badges: ["условный", "доверенность"],
        visibleWhen: (call) => getDocumentFlagValue(call, "byPoa"),
        critical: true,
      },
      {
        id: "secondary.legal.guardianship",
        ruleId: "DOC-SEC-014",
        title: "Разрешение органов опеки",
        note: "Нужно при несовершеннолетних собственниках или участниках.",
        badges: ["условный", "опека"],
        visibleWhen: (call) => getDocumentFlagValue(call, "minorPresent"),
        critical: true,
      },
    ],
  },
  {
    id: "primary_contract",
    groups: ["primary"],
    title: "Тип договора",
    description: "ДДУ, уступка, предварительный договор или будущая недвижимость.",
    stage: "call1",
    items: [
      {
        id: "primary.contract.project",
        ruleId: "DOC-BUILD-001",
        title: "Проект договора по строящемуся объекту",
        note: "ДДУ, ДУПТ, предварительный договор или ДКП будущей недвижимости.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "primary.contract.developer_accreditation",
        ruleId: "DOC-BUILD-002",
        title: "Подтверждение застройщика / объекта",
        note: "Сверка объекта, застройщика и маршрута аккредитации.",
        badges: ["обязательный"],
        required: true,
      },
    ],
  },
  {
    id: "primary_object",
    groups: ["primary"],
    title: "Объектный пакет по новостройке",
    description: "Документы по объекту, застройщику и строящемуся жилью.",
    stage: "call1",
    items: [
      {
        id: "primary.object.project_declaration",
        ruleId: "DOC-BUILD-003",
        title: "Проектная декларация / сведения об объекте",
        note: "Подтверждает параметры объекта и застройщика.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "primary.object.address",
        ruleId: "DOC-BUILD-004",
        title: "Сведения об адресе и характеристиках объекта",
        note: "Адрес, корпус, квартира, площадь, срок завершения строительства.",
        badges: ["обязательный"],
        required: true,
      },
    ],
  },
  {
    id: "primary_right_chain",
    groups: ["primary"],
    title: "Цепочка прав / ДУПТ",
    description: "Ветка уступки и перехода прав требования.",
    stage: "call1",
    items: [
      {
        id: "primary.chain.assignment",
        ruleId: "DOC-BUILD-005",
        title: "Договор уступки прав требования",
        note: "Нужен при ДУПТ и продавце-правообладателе.",
        badges: ["условный", "только если ДУПТ"],
        visibleWhen: (call) => getDocumentFlagValue(call, "duptIndividual"),
        critical: true,
      },
      {
        id: "primary.chain.previous_contract",
        ruleId: "DOC-BUILD-006",
        title: "Первоначальный договор и цепочка перехода прав",
        note: "Подтверждает происхождение права требования.",
        badges: ["условный", "цепочка прав"],
        visibleWhen: (call) => getDocumentFlagValue(call, "duptIndividual"),
      },
      {
        id: "primary.chain.payment_docs",
        ruleId: "DOC-BUILD-007",
        title: "Платежные документы по цепочке",
        note: "Нужны для проверки оплаты прав требования.",
        badges: ["условный", "цепочка прав"],
        visibleWhen: (call) => getDocumentFlagValue(call, "duptIndividual"),
      },
    ],
  },
  {
    id: "primary_problem",
    groups: ["primary"],
    title: "Проблемный объект / ввод в эксплуатацию",
    description: "Расширенный пакет для проблемного объекта и ввода без права.",
    stage: "call1",
    items: [
      {
        id: "primary.problem.docs",
        ruleId: "DOC-BUILD-008",
        title: "Документы по проблемному объекту",
        note: "Пакет по банкротству, передаче обязательств или иному проблемному сценарию.",
        badges: ["условный", "проблемный объект"],
        visibleWhen: (call) => getDocumentFlagValue(call, "problemObject"),
        critical: true,
      },
      {
        id: "primary.commissioning.permit",
        ruleId: "DOC-BUILD-009",
        title: "Документ о вводе объекта в эксплуатацию",
        note: "Нужен, если дом введен, но право еще не зарегистрировано.",
        badges: ["условный", "ввод"],
        visibleWhen: (call) => getDocumentFlagValue(call, "commissionedNoRights"),
        critical: true,
      },
    ],
  },
  {
    id: "izhs_scenario",
    groups: ["izhs"],
    title: "Сценарий ИЖС",
    description: "Свой участок, покупка ЗУ, подрядчик или строительство своими силами.",
    stage: "call1",
    items: [
      {
        id: "izhs.scenario.route",
        ruleId: "DOC-IZHS-001",
        title: "Подтвержден сценарий ИЖС",
        note: "ИЖС на своем участке или ИЖС с одновременной покупкой земли.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "izhs.scenario.executor",
        ruleId: "DOC-IZHS-002",
        title: "Определен исполнитель строительства",
        note: "Подрядчик, ИП, юрлицо или строительство своими силами.",
        badges: ["обязательный"],
        required: true,
      },
    ],
  },
  {
    id: "izhs_object",
    groups: ["izhs"],
    title: "Объектный пакет по ИЖС",
    description: "Дом, параметры, коммуникации и пригодность к проживанию.",
    stage: "call1",
    items: [
      {
        id: "izhs.object.house_specs",
        ruleId: "DOC-IZHS-003",
        title: "Описание дома и технические характеристики",
        note: "Площадь, этажность, коммуникации, санузлы, конструктив.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "izhs_house_passport",
        ruleId: "DOC-IZHS-004",
        title: "Паспорт строящегося дома",
        note: "Нужен для проверки параметров строящегося дома.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "izhs_arch_project",
        ruleId: "DOC-IZHS-005",
        title: "Архитектурно-строительный проект",
        note: "Нужен для проверки проекта строительства по ИЖС.",
        badges: ["обязательный", "проект"],
        required: true,
      },
    ],
  },
  {
    id: "izhs_land",
    groups: ["izhs"],
    title: "Земельный участок",
    description: "Категория, ВРИ, границы, ограничения и право на участок.",
    stage: "call1",
    items: [
      {
        id: "izhs.land.egrn",
        ruleId: "DOC-IZHS-006",
        title: "Выписка из ЕГРН на земельный участок",
        note: "Подтверждает право, кадастровый номер и ограничения.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "izhs.land.boundaries",
        ruleId: "DOC-IZHS-007",
        title: "Подтверждение установленных границ участка",
        note: "Границы должны быть установлены до сделки.",
        badges: ["обязательный", "критично"],
        required: true,
        critical: true,
      },
      {
        id: "izhs.land.purchase_contract",
        ruleId: "DOC-IZHS-008",
        title: "Договор приобретения земельного участка",
        note: "Нужен при ИЖС + одновременная покупка ЗУ.",
        badges: ["условный", "ИЖС + ЗУ"],
        visibleWhen: (call) => getDocumentFlagValue(call, "izhsLandPurchase"),
      },
    ],
  },
  {
    id: "izhs_contractor",
    groups: ["izhs"],
    title: "Подрядчик / своими силами / 186-ФЗ",
    description: "Документы по строительному исполнителю и договору.",
    stage: "call1",
    items: [
      {
        id: "izhs_construction_contract",
        ruleId: "DOC-IZHS-009",
        title: "Договор подряда / строительный договор",
        note: "Нужен при строительстве с подрядчиком.",
        badges: ["обязательный", "подрядчик"],
        required: true,
        visibleWhen: (call) => call.route.purpose === "izhs" || call.route.purpose === "izhs_land",
      },
      {
        id: "izhs.contractor.inn_docs",
        ruleId: "DOC-IZHS-010",
        title: "Документы и реквизиты подрядчика",
        note: "ИНН, наименование, статус ИП / юрлица.",
        badges: ["условный", "подрядчик"],
        visibleWhen: (call) => getDocumentFlagValue(call, "contractorBuild"),
      },
      {
        id: "izhs.self_build.package",
        ruleId: "DOC-IZHS-011",
        title: "Пакет по строительству своими силами",
        note: "Отдельная ветка без договора подряда, требует ручного контроля процесса.",
        badges: ["условный", "своими силами"],
        visibleWhen: (call) => getDocumentFlagValue(call, "selfBuild"),
        critical: true,
      },
    ],
  },
  {
    id: "izhs_permits",
    groups: ["izhs"],
    title: "Разрешительные документы",
    description: "Разрешения, уведомления и правовая готовность строительства.",
    stage: "call2",
    items: [
      {
        id: "izhs.permit.notice",
        ruleId: "DOC-IZHS-012",
        title: "Уведомление / разрешительная документация на строительство",
        note: "Подтверждает допустимость строительства на участке.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "izhs.permit.no_extra_buildings",
        ruleId: "DOC-IZHS-013",
        title: "Подтверждение отсутствия запрещенных строений",
        note: "Нужно для контроля некапитальных или лишних объектов на участке.",
        badges: ["условный"],
      },
    ],
  },
  {
    id: "refi_documents",
    groups: ["refi"],
    title: "Документы по перекредитованию",
    description: "Кредитные документы старого кредита, ПСК, остаток задолженности и реквизиты погашения.",
    stage: "call2",
    items: [
      {
        id: "refi.old_credit.contract",
        ruleId: "DOC-REFI-001",
        title: "Кредитный договор / индивидуальные условия старого кредита",
        note: "Базовый документ для проверки параметров старого кредита.",
        badges: ["обязательный", "refi"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.old_credit.schedule",
        ruleId: "DOC-REFI-002",
        title: "График платежей",
        note: "Нужен для сверки текущих обязательств и остатка.",
        badges: ["обязательный", "refi"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi_psk_notification",
        ruleId: "DOC-REFI-003",
        title: "Уведомление о полной стоимости кредита",
        note: "Критичный документ для перекредитования.",
        badges: ["обязательный", "ПСК", "критично"],
        required: true,
        critical: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.old_credit.statement",
        ruleId: "DOC-REFI-004",
        title: "Справка / выписка с параметрами кредита",
        note: "Фиксирует кредитора, номер договора, сумму и текущий статус.",
        badges: ["обязательный", "refi"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.payoff.balance",
        ruleId: "DOC-REFI-005",
        title: "Документ об остатке задолженности",
        note: "Нужен при подготовке к сделке и расчетах погашения.",
        badges: ["обязательный", "сделка"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.payoff.requisites",
        ruleId: "DOC-REFI-006",
        title: "Реквизиты счета для погашения старого кредита",
        note: "Счет, банк и получатель для закрытия старого обязательства.",
        badges: ["обязательный", "расчеты"],
        required: true,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.object.old_docs",
        ruleId: "DOC-REFI-007",
        title: "Документы по объекту старого кредита",
        note: "Нужны, если объект не виден из кредитных документов.",
        badges: ["условный", "объект"],
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.chain.docs",
        ruleId: "DOC-REFI-008",
        title: "Документы по цепочке перекредитований",
        note: "Запрашиваются, если у сделки уже была цепочка refi.",
        badges: ["условный", "цепочка"],
        visibleWhen: (call) => Number(call.form.refiChainCount || 0) > 0,
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.main_dkp",
        ruleId: "DOC-REFI-009",
        title: "Основной ДКП по старой сделке",
        note: "Нужен, если старый кредит оформлялся через предварительный договор.",
        badges: ["условный", "ДКП"],
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.family_addendum",
        ruleId: "DOC-REFI-010",
        title: "Допсоглашение к старому кредитному договору",
        note: "Для отдельных семейных refi-кейсов.",
        badges: ["условный", "семейная"],
        visibleWhen: (call) => call.route.program === "family" || call.route.program === "family_military",
        source: METHODOLOGY_SOURCE,
      },
      {
        id: "refi.pledge_account_agreement",
        ruleId: "DOC-REFI-011",
        title: "Договор залога прав по договору залогового счета",
        note: "Для отдельных строительных кейсов перекредитования.",
        badges: ["условный", "залоговый счет"],
        visibleWhen: (call) => call.form.specialAccountFlag === "pledge_account",
        source: METHODOLOGY_SOURCE,
      },
    ],
  },
  {
    id: "payments_common",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "ПВ и расчеты",
    description: "Первоначальный взнос, способ расчетов и специальные счета.",
    stage: "call2",
    items: [
      {
        id: "payments.down_payment",
        ruleId: "DOC-PAY-001",
        title: "Подтверждение первоначального взноса",
        note: "Документ / выписка / подтверждение размещения средств.",
        badges: ["обязательный"],
        required: true,
      },
      {
        id: "payments.pv_doc",
        ruleId: "DOC-PAY-002",
        title: "Документ по сумме ПВ",
        note: "Нужен, если по ПВ требуется отдельный подтверждающий документ.",
        badges: ["условный", "ПВ"],
        visibleWhen: (call) => getDocumentFlagValue(call, "pvDoc"),
      },
      {
        id: "payments.accreditive",
        ruleId: "DOC-PAY-003",
        title: "Документы по аккредитиву",
        note: "Заявление / условия раскрытия / маршрут расчетов.",
        badges: ["условный", "аккредитив"],
        visibleWhen: (call) => getDocumentFlagValue(call, "accreditive"),
      },
      {
        id: "payments.external_requisites",
        ruleId: "DOC-PAY-004",
        title: "Реквизиты получателя при внешних расчетах",
        note: "Владелец счета, банк, расчетный счет и основание перечисления.",
        badges: ["условный", "внешние расчеты"],
        visibleWhen: (call) => getDocumentFlagValue(call, "externalSettlement"),
      },
    ],
  },
  {
    id: "program_overlays",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "МСК / субсидии / НИС / госпрограммы",
    description: "Продуктовые надстройки поверх цели кредита.",
    stage: "call2",
    items: [
      {
        id: "program.family.birth_certificates",
        ruleId: "DOC-FAM-001",
        title: "Свидетельства о рождении детей",
        note: "Нужно для семейной программы и семейного основания.",
        badges: ["только для госпрограмм", "семейная"],
        visibleWhen: (call) => call.route.program === "family" || call.route.program === "family_military",
      },
      {
        id: "program.family.disability",
        ruleId: "DOC-FAM-002",
        title: "Документ по ребенку-инвалиду",
        note: "Запрашивается при соответствующем основании семейной программы.",
        badges: ["условный", "семейная"],
        visibleWhen: (call) => call.form.familyBasis === "disabled_child",
      },
      {
        id: "it_income_certificate",
        ruleId: "DOC-IT-001",
        title: "ИТ: справка о доходах за 3 месяца",
        note: "Атомарная часть ИТ-пакета.",
        badges: ["ИТ", "доход"],
        required: true,
        visibleWhen: (call) => call.route.program === "it",
      },
      {
        id: "it_labor_contract",
        ruleId: "DOC-IT-002",
        title: "ИТ: трудовой договор",
        note: "Подтверждает основное место работы в ИТ-компании.",
        badges: ["ИТ", "занятость"],
        required: true,
        visibleWhen: (call) => call.route.program === "it",
      },
      {
        id: "program.it.addendum",
        ruleId: "DOC-IT-003",
        title: "ИТ: допсоглашение к трудовому договору",
        note: "Запрашивается, если условия работы подтверждаются допсоглашением.",
        badges: ["ИТ", "условный"],
        visibleWhen: (call) => call.route.program === "it",
      },
      {
        id: "it_std",
        ruleId: "DOC-IT-002",
        title: "ИТ: СТД-Р / СТД-СФР / трудовая книжка",
        note: "Подтверждает трудовой статус и занятость.",
        badges: ["ИТ", "СТД"],
        required: true,
        visibleWhen: (call) => call.route.program === "it",
      },
      {
        id: "program.it.egrul",
        ruleId: "DOC-IT-004",
        title: "ИТ: выписка ЕГРЮЛ по работодателю",
        note: "Нужна при проверке региона и статуса работодателя.",
        badges: ["ИТ", "работодатель"],
        visibleWhen: (call) => call.route.program === "it",
      },
      {
        id: "dva_category_doc",
        ruleId: "DOC-DVA-001",
        title: "ДВиАИ: документ по категории заемщика",
        note: "Подтверждает выбранную категорию клиента.",
        badges: ["ДВиАИ", "категория"],
        required: true,
        visibleWhen: (call) => call.route.program === "dv",
      },
      {
        id: "program.dv.region_commitment",
        ruleId: "DOC-DVA-002",
        title: "ДВиАИ: обязательство пост-сделочной регистрации",
        note: "Фиксирует обязательство регистрации после сделки, если оно требуется.",
        badges: ["ДВиАИ", "постсделка"],
        visibleWhen: (call) =>
          call.route.program === "dv" &&
          (call.form.dvPostRegistrationRequired === "yes" || call.form.dvPostRegistration === "no"),
      },
      {
        id: "military_nis_doc",
        ruleId: "DOC-MIL-001",
        title: "Военная: подтверждение участия в НИС",
        note: "Документ Росвоенипотеки / НИС.",
        badges: ["НИС", "военная"],
        required: true,
        critical: true,
        visibleWhen: (call) => getDocumentFlagValue(call, "nis"),
      },
      {
        id: "program.military.czhz",
        ruleId: "DOC-MIL-002",
        title: "Военная: свидетельство о праве на ЦЖЗ",
        note: "ЦЖЗ для военной ипотеки и семейной программы военнослужащих.",
        badges: ["ЦЖЗ", "военная"],
        visibleWhen: (call) => getDocumentFlagValue(call, "nis"),
      },
      {
        id: "program.msk.certificate",
        ruleId: "DOC-PROG-001",
        title: "Материнский капитал: сертификат и справка об остатке",
        note: "Документы по МСК в первоначальном взносе.",
        badges: ["только если МСК"],
        visibleWhen: (call) => getDocumentFlagValue(call, "hasMsk"),
      },
      {
        id: "program.subsidy.docs",
        ruleId: "DOC-PROG-002",
        title: "Документы по субсидии / сертификату",
        note: "Подтверждение права на субсидию и суммы.",
        badges: ["условный", "субсидия"],
        visibleWhen: (call) => getDocumentFlagValue(call, "hasSubsidy"),
      },
    ],
  },
  {
    id: "izhs_tranches",
    groups: ["izhs"],
    title: "Транши / акт осмотра / этапность",
    description: "ИЖС-контроль выдачи, осмотров и этапности строительства.",
    stage: "call2",
    items: [
      {
        id: "izhs.tranches.schedule",
        ruleId: "DOC-IZHS-014",
        title: "График траншей / этапность строительства",
        note: "Нужен, если выдача идет этапами.",
        badges: ["условный", "транши"],
        visibleWhen: (call) => getDocumentFlagValue(call, "tranches"),
      },
      {
        id: "izhs.inspection.act",
        ruleId: "DOC-IZHS-015",
        title: "Акт осмотра земельного участка",
        note: "Критично при аккредитивной форме расчетов по ИЖС.",
        badges: ["условный", "акт осмотра"],
        visibleWhen: (call) => getDocumentFlagValue(call, "inspectionAct"),
        critical: true,
      },
    ],
  },
  {
    id: "deal_day",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "День сделки",
    description: "Документы и операционные подтверждения на день подписания.",
    stage: "call2",
    items: [
      {
        id: "deal.day.contracts",
        ruleId: "DOC-DEAL-001",
        title: "Финальные договоры к подписанию",
        note: "Кредитный договор, договор приобретения / подряда и связанные заявления.",
        badges: ["день сделки", "обязательный"],
        required: true,
      },
      {
        id: "deal.day.insurance",
        ruleId: "DOC-DEAL-002",
        title: "Страховые документы",
        note: "Полисы и подтверждения, если страхование оформляется.",
        badges: ["день сделки"],
      },
      {
        id: "deal.day.identity",
        ruleId: "DOC-DEAL-003",
        title: "Документы идентификации и полномочий",
        note: "Паспорта, доверенности, полномочия подписантов.",
        badges: ["день сделки"],
      },
    ],
  },
  {
    id: "post_registration",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "После регистрации / постконтроль",
    description: "Постсделочные документы и контроль обязательств.",
    stage: "post",
    items: [
      {
        id: "post.egrn.transition",
        ruleId: "DOC-POST-001",
        title: "ЕГРН после регистрации перехода права / залога",
        note: "Подтверждает регистрацию права и ипотеки.",
        badges: ["постсделка", "обязательный"],
        required: true,
      },
      {
        id: "post.dv.registration",
        ruleId: "DOC-POST-002",
        title: "Пост-сделочная регистрация по ДВиАИ",
        note: "Контроль регистрации после сделки, если применимо к категории.",
        badges: ["постсделка", "ДВиАИ"],
        visibleWhen: (call) => call.route.program === "dv",
        critical: true,
      },
      {
        id: "post.izhs.completion",
        ruleId: "DOC-POST-003",
        title: "Контроль сроков завершения строительства",
        note: "Нужен для ИЖС и строительных сценариев.",
        badges: ["постсделка", "ИЖС"],
        visibleWhen: (call) => call.route.purpose === "izhs" || call.route.purpose === "izhs_land",
      },
    ],
  },
  {
    id: "final_check",
    groups: ["secondary", "secondary-lite", "primary", "izhs", "refi"],
    title: "Финальный чек",
    description: "Контроль, что нет незакрытых обязательных и критичных документов.",
    stage: "call2",
    always: true,
    items: [
      {
        id: "final.required_closed",
        ruleId: "DOC-FINAL-001",
        title: "Все обязательные документы отмечены",
        note: "Перед завершением сделки не должно оставаться незакрытого обязательного пакета.",
        badges: ["обязательный", "финальный чек"],
        required: true,
        critical: true,
      },
      {
        id: "final.missing_copied",
        ruleId: "DOC-FINAL-002",
        title: "Недостающий список отправлен клиенту / коллеге",
        note: "Используйте кнопку копирования недостающих документов.",
        badges: ["финальный чек"],
      },
    ],
  },
];

let documentsCopyMessageTimer = null;

function getDocumentGroup(call) {
  return documentGroupByPurpose[call?.route?.purpose] || "unsupported_yet";
}

function getDocumentState(call) {
  call.documents = normalizeDocumentsState(call.documents);
  return call.documents;
}

function getDocumentFlagDefinition(flagId) {
  return documentScenarioFlags.find((flag) => flag.id === flagId);
}

function getDocumentFlagAutoValue(call, flagId) {
  const definition = getDocumentFlagDefinition(flagId);
  return Boolean(definition?.autoWhen?.(call));
}

function getDocumentFlagValue(call, flagId) {
  const docs = getDocumentState(call);
  return Boolean(docs.flags?.[flagId] || getDocumentFlagAutoValue(call, flagId));
}

function getDocumentFlagContext(call) {
  return Object.fromEntries(
    documentScenarioFlags.map((flag) => [flag.id, getDocumentFlagValue(call, flag.id)])
  );
}

function isDocumentSectionVisible(section, call, group) {
  if (!section.groups.includes(group)) {
    return false;
  }
  if (section.visibleWhen) {
    return section.visibleWhen(call, getDocumentFlagContext(call));
  }
  return true;
}

function isDocumentItemVisible(item, call) {
  if (item.visibleWhen) {
    return item.visibleWhen(call, getDocumentFlagContext(call));
  }
  return true;
}

function isDocumentItemRequired(call, item) {
  const required =
    typeof item.required === "function" ? item.required(call, getDocumentFlagContext(call)) : item.required;
  return Boolean(required || item.critical);
}

function getDocumentItemState(call, itemId) {
  const docs = getDocumentState(call);
  return docs.items[itemId] || {};
}

function isDocumentChecked(call, itemId) {
  return Boolean(getDocumentItemState(call, itemId).checked);
}

function getVisibleDocumentSections(call, options = {}) {
  const group = getDocumentGroup(call);
  if (group === "unsupported_yet") {
    return [];
  }

  const docs = getDocumentState(call);
  const search = String(docs.search || "").trim().toLowerCase();
  const filter = docs.filter || "all";

  return documentSections
    .filter((section) => isDocumentSectionVisible(section, call, group))
    .map((section) => {
      const visibleItems = section.items
        .filter((item) => isDocumentItemVisible(item, call))
        .filter((item) => {
          const checked = isDocumentChecked(call, item.id);
          const required = isDocumentItemRequired(call, item);
          const haystack = `${item.title} ${item.note || ""} ${(item.badges || []).join(" ")}`.toLowerCase();

          if (!options.ignoreFilters && search && !haystack.includes(search)) {
            return false;
          }
          if (!options.ignoreFilters && filter === "open" && checked) {
            return false;
          }
          if (!options.ignoreFilters && filter === "required" && !required) {
            return false;
          }
          if (!options.ignoreFilters && filter === "critical" && !item.critical) {
            return false;
          }
          if (!options.ignoreFilters && filter === "post" && section.stage !== "post") {
            return false;
          }
          return true;
        });

      return {
        ...section,
        items: visibleItems,
        progress: getDocumentSectionProgress(call, visibleItems),
        focused: docs.activeView === "all" || section.stage === docs.activeView,
      };
    })
    .filter((section) => section.items.length)
    .sort((left, right) => {
      const activeView = docs.activeView || "all";
      if (activeView !== "all") {
        const leftFocus = left.stage === activeView ? 0 : 1;
        const rightFocus = right.stage === activeView ? 0 : 1;
        if (leftFocus !== rightFocus) {
          return leftFocus - rightFocus;
        }
      }
      return documentSections.findIndex((section) => section.id === left.id) -
        documentSections.findIndex((section) => section.id === right.id);
    });
}

function getDocumentSectionProgress(call, items) {
  const total = items.length;
  const done = items.filter((item) => isDocumentChecked(call, item.id)).length;
  const requiredOpen = items.filter(
    (item) => isDocumentItemRequired(call, item) && !isDocumentChecked(call, item.id)
  ).length;
  return {
    done,
    total,
    requiredOpen,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function getDocumentOverallProgress(call) {
  const sections = getVisibleDocumentSections(call, { ignoreFilters: true });
  const items = sections.flatMap((section) => section.items);
  return getDocumentSectionProgress(call, items);
}

function getDocumentMissingItems(call, options = {}) {
  const stage = options.stage || "all";
  return getVisibleDocumentSections(call)
    .filter((section) => stage === "all" || section.stage === stage)
    .flatMap((section) =>
      section.items
        .filter((item) => !isDocumentChecked(call, item.id))
        .map((item) => ({
          ...item,
          sectionTitle: section.title,
        }))
    );
}

function buildMissingDocumentsText(call, options = {}) {
  const missing = getDocumentMissingItems(call, options);
  if (!missing.length) {
    return "Все документы в текущем фильтре отмечены как закрытые.";
  }

  return [
    "Нужно запросить у клиента:",
    ...missing.map((item, index) => `${index + 1}. ${item.title} (${item.sectionTitle})`),
  ].join("\n");
}

function setDocumentsCopyMessage(call, message) {
  const docs = getDocumentState(call);
  docs.copyMessage = message;
  updateDocumentsCopyMessage();
  if (documentsCopyMessageTimer) {
    window.clearTimeout(documentsCopyMessageTimer);
  }
  documentsCopyMessageTimer = window.setTimeout(() => {
    docs.copyMessage = "";
    updateDocumentsCopyMessage();
  }, 1800);
}

function updateDocumentsCopyMessage() {
  const activeCall = getActiveCall();
  const statusNode = documentsDrawerRoot?.querySelector?.(".documents-copy-status");
  if (activeCall && statusNode) {
    statusNode.textContent =
      getDocumentState(activeCall).copyMessage || "Можно скопировать список недостающих документов.";
  }
}

function getDocumentScenarioChips(call, group) {
  const chips = [documentGroupMeta[group]?.baseChip || "База: не определена"];
  documentScenarioFlags.forEach((flag) => {
    if (!flag.groups.includes(group)) {
      return;
    }
    if (getDocumentFlagValue(call, flag.id)) {
      chips.push(flag.title);
    }
  });
  return chips;
}

function getVisibleDocumentFlags(group) {
  const grouped = new Map();
  documentScenarioFlags
    .filter((flag) => flag.groups.includes(group))
    .forEach((flag) => {
      if (!grouped.has(flag.group)) {
        grouped.set(flag.group, []);
      }
      grouped.get(flag.group).push(flag);
    });
  return Array.from(grouped.entries()).map(([title, flags]) => ({ title, flags }));
}

function hasFilledValue(value) {
  return !(value == null || value === "" || (Array.isArray(value) && value.length === 0));
}

function fieldDisplayValue(fieldKey, route, state) {
  const field = fieldCatalog[fieldKey];
  if (!field) {
    return "";
  }
  if (field.kind === "route") {
    return fieldKey === "routePurpose"
      ? getRouteLabel("purpose", route.purpose)
      : getRouteLabel("program", route.program);
  }
  return formatOutputValue(fieldKey, field, state[fieldKey]);
}

const contradictionRules = [
  {
    id: "route_program_blocked",
    severity: "blocker",
    stage: "precheck",
    scope: "route",
    enabledWhen: (route) => Boolean(route.purpose && route.program),
    when: (route) => getProgramCompatibility(route.purpose, route.program).status === "blocked",
    build: (route) => {
      const compatibility = getProgramCompatibility(route.purpose, route.program);
      return {
        title: "Цель и программа не совместимы",
        reason: compatibility.reason,
        action: "Выберите другую программу или измените цель кредита до старта звонка.",
        facts: [
          `Цель: ${getRouteLabel("purpose", route.purpose)}`,
          `Программа: ${getRouteLabel("program", route.program)}`,
        ],
        ruleId: getRouteCompatibilityRuleId(route.purpose, route.program),
        fields: ["routePurpose", "routeProgram"],
        sectionId: "compatibility",
        nodeId: "application",
        anchorTarget: { type: "route", routeKind: "program" },
        blocksFlow: true,
      };
    },
  },
  {
    id: "route_conditional_not_approved",
    severity: "blocker",
    stage: "precheck",
    scope: "route",
    enabledWhen: (route) =>
      Boolean(route.purpose && route.program) &&
      getProgramCompatibility(route.purpose, route.program).status === "conditional",
    when: (route, state) => state.routeConditionalApproved === "no",
    build: (route) => ({
      title: "Условная связка не подтверждена",
      reason: "Для этой цели и программы нужен прямой допуск из паспорта продукта.",
      action: "Подтвердите связку паспортом продукта или выберите другой маршрут.",
      facts: [
        `Цель: ${getRouteLabel("purpose", route.purpose)}`,
        `Программа: ${getRouteLabel("program", route.program)}`,
        "Подтверждение паспорта продукта: Нет",
      ],
      ruleId: getRouteCompatibilityRuleId(route.purpose, route.program),
      fields: ["routeConditionalApproved"],
      sectionId: "compatibility",
      nodeId: "application",
      anchorTarget: { type: "field", fieldKey: "routeConditionalApproved" },
      blocksFlow: true,
    }),
  },
  {
    id: "program_target_group_rejected",
    severity: "blocker",
    stage: "precheck",
    scope: "program",
    enabledWhen: (route) => route.program && route.program !== "base",
    when: (route, state) => state.programTargetGroupConfirmed === "no",
    build: (route) => ({
      title: "Клиент не входит в целевую группу программы",
      reason: "Льготная программа не должна продолжаться, если целевая группа не подтверждена.",
      action: "Уточните основание участия в программе или смените программу.",
      facts: [
        `Программа: ${getRouteLabel("program", route.program)}`,
        "Целевая группа подтверждена: Нет",
      ],
      ruleId: "GOV-004",
      fields: ["programTargetGroupConfirmed", "routeProgram"],
      sectionId: "gov_common",
      nodeId: "application",
      anchorTarget: { type: "field", fieldKey: "programTargetGroupConfirmed" },
      blocksFlow: true,
    }),
  },
  {
    id: "family_children_zero",
    severity: "blocker",
    stage: "precheck",
    scope: "program",
    enabledWhen: (route) => route.program === "family" || route.program === "family_military",
    when: (route, state) => hasFilledValue(state.childrenCount) && Number(state.childrenCount || 0) === 0,
    build: (route, state) => ({
      title: "Семейная программа не подтверждена",
      reason: "Для семейной программы указано 0 детей.",
      action: "Уточните семейное основание льготы или смените программу.",
      facts: [
        `Программа: ${getRouteLabel("program", route.program)}`,
        `Количество детей: ${state.childrenCount}`,
      ],
      ruleId: "FAM-001",
      fields: ["routeProgram", "childrenCount", "familyBasis"],
      sectionId: "family_gate",
      nodeId: route.program === "family_military" ? "program_family_military" : "program_family",
      anchorTarget: { type: "field", fieldKey: "childrenCount" },
      blocksFlow: true,
    }),
  },
  {
    id: "family_child_date_before_2018",
    severity: "blocker",
    stage: "precheck",
    scope: "program",
    enabledWhen: (route, state) =>
      (route.program === "family" || route.program === "family_military") &&
      state.familyBasis === "post2018" &&
      hasFilledValue(state.childDob),
    when: (route, state) => {
      const childDate = parseDateInput(state.childDob);
      return childDate && childDate < new Date(2018, 0, 1);
    },
    build: (route, state) => ({
      title: "Дата рождения не подходит под семейное основание",
      reason: "Для основания `ребенок после 01.01.2018` дата рождения должна быть не раньше 01.01.2018.",
      action: "Проверьте дату рождения ребенка или выберите другое семейное основание.",
      facts: [
        "Основание: ребенок после 01.01.2018",
        `Дата рождения: ${state.childDob}`,
      ],
      ruleId: "FAM-003",
      fields: ["familyBasis", "childDob"],
      sectionId: "family_gate",
      nodeId: route.program === "family_military" ? "program_family_military" : "program_family",
      anchorTarget: { type: "field", fieldKey: "childDob" },
      blocksFlow: true,
    }),
  },
  {
    id: "family_spouse_not_included",
    severity: "blocker",
    stage: "precheck",
    scope: "participant",
    enabledWhen: (route) => route.program === "family",
    when: (route, state) =>
      state.spouseRussianCitizen === "yes" && state.spouseIncludedInDeal === "no",
    build: () => ({
      title: "Супруг с гражданством РФ не включен в сделку",
      reason: "Для семейной программы участие супруга с гражданством РФ требует отдельной проверки.",
      action: "Уточните исключение или включите супруга в состав участников сделки.",
      facts: [
        "Супруг(а) гражданин РФ: Да",
        "Супруг(а) включен(а) в сделку: Нет",
      ],
      ruleId: "FAM-002",
      fields: ["spouseRussianCitizen", "spouseIncludedInDeal"],
      sectionId: "family_gate",
      nodeId: "program_family",
      anchorTarget: { type: "field", fieldKey: "spouseIncludedInDeal" },
    }),
  },
  {
    id: "representative_without_name",
    severity: "clarification",
    stage: "call1",
    scope: "participant",
    enabledWhen: (route, state) =>
      state.representativeNeeded === "yes" &&
      isFieldVisible(fieldCatalog.representativeName, route, state),
    when: (route, state) => !hasFilledValue(state.representativeName),
    build: () => ({
      title: "Представитель включен, но не указан",
      reason: "Если сделка идет по доверенности, данные доверенного лица должны быть зафиксированы.",
      action: "Укажите доверенное лицо или снимите признак представителя.",
      facts: ["Есть представитель по доверенности: Да", "Доверенное лицо: не указано"],
      fields: ["representativeNeeded", "representativeName"],
      nodeId: "purpose_ready",
      anchorTarget: { type: "field", fieldKey: "representativeName" },
    }),
  },
  {
    id: "non_borrower_pledgor_without_kinship_docs",
    severity: "clarification",
    stage: "call1",
    scope: "participant",
    enabledWhen: (route, state) => state.nonBorrowerPledgorPresent === "yes",
    when: (route, state) => state.pledgorKinshipDocsReady === "no",
    build: () => ({
      title: "Нужны документы о родстве залогодателя",
      reason: "Залогодатель, который не является заемщиком, требует отдельного подтверждения связи с заемщиком.",
      action: "Запросите документы о родстве или уточните состав участников.",
      facts: [
        "Есть залогодатель не заемщик: Да",
        "Документы о родстве готовы: Нет",
      ],
      fields: ["nonBorrowerPledgorPresent", "pledgorKinshipDocsReady"],
      nodeId: "client",
      anchorTarget: { type: "field", fieldKey: "pledgorKinshipDocsReady" },
    }),
  },
  {
    id: "minor_without_guardianship_status",
    severity: "clarification",
    stage: "call1",
    scope: "docs",
    enabledWhen: (route, state) =>
      state.minorParticipants === "yes" &&
      isFieldVisible(fieldCatalog.guardianshipStatus, route, state),
    when: (route, state) => !hasFilledValue(state.guardianshipStatus),
    build: () => ({
      title: "Несовершеннолетний участник без статуса опеки",
      reason: "Если в сделке есть несовершеннолетние, нужно явно понять статус решения органов опеки.",
      action: "Уточните, нужно ли решение опеки, и отметьте статус документа.",
      facts: ["Есть несовершеннолетние участники: Да", "Статус решения опеки: не указан"],
      fields: ["minorParticipants", "guardianshipStatus"],
      nodeId: "call1_docs",
      anchorTarget: { type: "field", fieldKey: "guardianshipStatus" },
    }),
  },
  {
    id: "children_docs_not_marked",
    severity: "clarification",
    stage: "call1",
    scope: "docs",
    enabledWhen: (route, state) =>
      isFieldVisible(fieldCatalog.birthCertificatesStatus, route, state) &&
      (state.minorParticipants === "yes" ||
        ((route.program === "family" || route.program === "family_military") &&
          Number(state.childrenCount || 0) > 0)),
    when: (route, state) => !hasFilledValue(state.birthCertificatesStatus),
    build: (route) => ({
      title: "Не отмечены детские документы",
      reason: "Семейная ветка или несовершеннолетний участник требуют явного статуса свидетельств о рождении.",
      action: "Отметьте, получены ли свидетельства или что нужно запросить.",
      facts: [
        `Программа: ${getRouteLabel("program", route.program) || "не выбрана"}`,
        "Статус свидетельств о рождении: не указан",
      ],
      fields: ["birthCertificatesStatus"],
      nodeId: "call1_docs",
      anchorTarget: { type: "field", fieldKey: "birthCertificatesStatus" },
    }),
  },
  {
    id: "external_payments_without_requisites",
    severity: "blocker",
    stage: "call2",
    scope: "payments",
    enabledWhen: (route, state) => state.externalEscrow === "yes",
    when: (route, state) =>
      [
        "recipientAccountOwnerRole",
        "recipientAccountOwnerName",
        "recipientBank",
        "recipientSettlementAccount",
      ].some((fieldKey) => !hasFilledValue(state[fieldKey])),
    build: (route, state) => {
      const missingFields = [
        "recipientAccountOwnerRole",
        "recipientAccountOwnerName",
        "recipientBank",
        "recipientSettlementAccount",
      ].filter((fieldKey) => !hasFilledValue(state[fieldKey]));
      return {
        title: "Внешние расчеты без реквизитов",
        reason: "Если расчеты идут вне Банка ДОМ.РФ, реквизиты получателя должны быть заполнены до сделки.",
        action: "Заполните владельца счета, банк и расчетный счет получателя.",
        facts: [
          "Эскроу или перечисление вне Банка ДОМ.РФ: Да",
          `Не заполнено: ${missingFields.map((fieldKey) => fieldCatalog[fieldKey]?.label).join(", ")}`,
        ],
        fields: ["externalEscrow", ...missingFields],
        nodeId: "call2_finish",
        anchorTarget: { type: "field", fieldKey: missingFields[0] || "recipientAccountOwnerRole" },
        blocksFlow: true,
      };
    },
  },
  {
    id: "izhs_accreditive_without_inspection_act",
    severity: "blocker",
    stage: "call2",
    scope: "payments",
    enabledWhen: (route, state) =>
      (route.purpose === "izhs" || route.purpose === "izhs_land") &&
      state.paymentMethod === "accreditive",
    when: (route, state) => state.izhsLandInspectionActReady === "no",
    build: () => ({
      title: "ИЖС + аккредитив без акта осмотра участка",
      reason: "Для ИЖС при аккредитивной форме расчетов нужен акт осмотра земельного участка.",
      action: "Запросите акт осмотра или уточните способ расчетов.",
      facts: ["Цель: ИЖС", "Способ расчетов: аккредитив", "Акт осмотра: Нет"],
      fields: ["paymentMethod", "izhsLandInspectionActReady"],
      nodeId: "call2_payments",
      anchorTarget: { type: "field", fieldKey: "izhsLandInspectionActReady" },
      blocksFlow: true,
    }),
  },
];

const contradictionSeverityOrder = {
  blocker: 0,
  clarification: 1,
  risk: 2,
};

const contradictionStageOrder = {
  precheck: 0,
  call1: 1,
  call2: 2,
  global: 3,
};

const contradictionScopeOrder = {
  route: 0,
  program: 1,
  participant: 2,
  object: 3,
  docs: 4,
  payments: 5,
  misc: 6,
};

function evaluateContradictionRule(rule, route, state, call) {
  if (rule.enabledWhen && !rule.enabledWhen(route, state, call)) {
    return null;
  }
  if (!rule.when(route, state, call)) {
    return null;
  }

  const built = rule.build(route, state, call);
  return {
    id: rule.id,
    severity: rule.severity,
    stage: rule.stage,
    scope: rule.scope,
    fields: built.fields || [],
    sectionId: built.sectionId || "",
    nodeId: built.nodeId || "",
    anchorTarget: built.anchorTarget || null,
    facts: built.facts || [],
    blocksFlow: Boolean(built.blocksFlow || rule.severity === "blocker"),
    source: "contradiction_rules",
    ...built,
  };
}

function dedupeContradictions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.dedupeKey || `${item.id}:${item.severity}:${item.anchorTarget?.fieldKey || item.nodeId || item.sectionId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortContradictions(items) {
  return items.slice().sort((left, right) => {
    const severityDiff =
      (contradictionSeverityOrder[left.severity] ?? 99) -
      (contradictionSeverityOrder[right.severity] ?? 99);
    if (severityDiff) return severityDiff;

    const stageDiff =
      (contradictionStageOrder[left.stage] ?? 99) -
      (contradictionStageOrder[right.stage] ?? 99);
    if (stageDiff) return stageDiff;

    return (
      (contradictionScopeOrder[left.scope] ?? 99) -
      (contradictionScopeOrder[right.scope] ?? 99)
    );
  });
}

function groupContradictions(items) {
  const grouped = {
    all: items,
    blockers: items.filter((item) => item.severity === "blocker"),
    clarifications: items.filter((item) => item.severity === "clarification"),
    risks: items.filter((item) => item.severity === "risk"),
    precheck: items.filter((item) => item.stage === "precheck"),
    call1: items.filter((item) => item.stage === "call1"),
    call2: items.filter((item) => item.stage === "call2"),
    byNodeId: {},
    bySectionId: {},
    summary: {
      total: items.length,
      blockers: items.filter((item) => item.severity === "blocker").length,
      clarifications: items.filter((item) => item.severity === "clarification").length,
      risks: items.filter((item) => item.severity === "risk").length,
    },
  };

  items.forEach((item) => {
    if (item.nodeId) {
      grouped.byNodeId[item.nodeId] = grouped.byNodeId[item.nodeId] || [];
      grouped.byNodeId[item.nodeId].push(item);
    }
    if (item.sectionId) {
      grouped.bySectionId[item.sectionId] = grouped.bySectionId[item.sectionId] || [];
      grouped.bySectionId[item.sectionId].push(item);
    }
  });

  return grouped;
}

function getContradictions(route, state, call) {
  if (!route.purpose || !route.program) {
    return groupContradictions([]);
  }
  const raw = contradictionRules
    .map((rule) => evaluateContradictionRule(rule, route, state, call))
    .filter(Boolean);
  return groupContradictions(sortContradictions(dedupeContradictions(raw)));
}

function contradictionSeverityToLevel(severity) {
  if (severity === "blocker") return "blocker";
  if (severity === "clarification") return "warning";
  return "info";
}

function contradictionSeverityLabel(severity) {
  if (severity === "blocker") return "критично";
  if (severity === "clarification") return "требует уточнения";
  return "методологический риск";
}

const contradictionSignalMatchers = {
  route_program_blocked: (item) =>
    item.sectionId === "compatibility" &&
    item.title === "Программа не поддерживает выбранную цель",
  route_conditional_not_approved: (item) =>
    item.sectionId === "compatibility" &&
    item.title === "Условное сочетание не подтверждено",
  program_target_group_rejected: (item) =>
    item.sectionId === "gov_common" &&
    item.title === "Клиент не входит в целевую группу программы",
  family_children_zero: (item) =>
    (item.sectionId === "family_gate" && item.title === "Нет подтвержденного семейного основания") ||
    (item.nodeId &&
      (item.nodeId === "program_family" || item.nodeId === "program_family_military") &&
      item.title === "Семейная программа не подтверждена"),
  family_child_date_before_2018: (item) =>
    (item.sectionId === "family_gate" &&
      item.title === "Дата рождения ребенка не подходит под семейное основание") ||
    (item.nodeId &&
      (item.nodeId === "program_family" || item.nodeId === "program_family_military") &&
      item.title === "Дата рождения не подходит под заявленное основание"),
  family_spouse_not_included: (item) =>
    (item.sectionId === "family_gate" &&
      item.title === "Супруг(а) с гражданством РФ не включен(а) в сделку") ||
    (item.nodeId === "program_family" && item.title === "Проверьте участие супруга(и)"),
  non_borrower_pledgor_without_kinship_docs: (item) =>
    item.nodeId === "client" && item.title === "Нужны документы о родстве залогодателя",
  external_payments_without_requisites: (item) =>
    item.nodeId === "call2_finish" && item.title === "Не заполнены реквизиты получателя",
  izhs_accreditive_without_inspection_act: (item) =>
    item.nodeId === "call2_payments" && item.title === "Нет акта осмотра участка при аккредитиве",
};

function filterSignalsCoveredByContradictions(items, contradictions) {
  if (!contradictions.all.length) {
    return items;
  }
  const activeContradictionIds = new Set(contradictions.all.map((item) => item.id));
  return items.filter((item) => {
    return !Object.entries(contradictionSignalMatchers).some(([id, matcher]) => {
      return activeContradictionIds.has(id) && matcher(item);
    });
  });
}

function rerenderDocumentsDrawerPreservingScroll(options = {}) {
  const scrollHost = documentsDrawerRoot?.querySelector?.(".documents-body");
  const scrollTop = scrollHost?.scrollTop || 0;
  renderDocumentsDrawer();
  const nextHost = documentsDrawerRoot?.querySelector?.(".documents-body");
  if (nextHost) {
    nextHost.scrollTop = scrollTop;
  }
  if (options.focusInput) {
    const nextInput = documentsDrawerRoot?.querySelector?.(`[data-doc-input="${options.focusInput}"]`);
    if (nextInput && typeof nextInput.focus === "function") {
      nextInput.focus({ preventScroll: true });
      if (
        typeof options.selectionStart === "number" &&
        typeof nextInput.setSelectionRange === "function"
      ) {
        nextInput.setSelectionRange(
          options.selectionStart,
          typeof options.selectionEnd === "number" ? options.selectionEnd : options.selectionStart
        );
      }
    }
  }
}

function handleDocumentsAction(event) {
  const target = event.target.closest("[data-doc-action]");
  if (!target) {
    return;
  }

  const activeCall = getActiveCall();
  const action = target.dataset.docAction;

  if (action === "toggle_flag" || action === "toggle_item") {
    return;
  }

  event.preventDefault();

  if (!activeCall) {
    return;
  }

  const docs = getDocumentState(activeCall);

  if (action === "close") {
    docs.drawerOpen = false;
    touchActiveCall();
    renderApp();
    return;
  }

  if (action === "toggle_pin") {
    docs.pinned = !docs.pinned;
    touchActiveCall();
    renderApp();
    return;
  }

  if (action === "set_view") {
    docs.activeView = target.dataset.docValue || "all";
    touchActiveCall();
    rerenderDocumentsDrawerPreservingScroll();
    return;
  }

  if (action === "set_filter") {
    docs.filter = target.dataset.docValue || "all";
    touchActiveCall();
    rerenderDocumentsDrawerPreservingScroll();
    return;
  }

  if (action === "reset_filters") {
    docs.filter = "all";
    docs.activeView = "all";
    docs.search = "";
    touchActiveCall();
    renderDocumentsDrawer();
    return;
  }

  if (action === "mark_section_done") {
    const sectionId = target.dataset.sectionId;
    const section = getVisibleDocumentSections(activeCall).find((item) => item.id === sectionId);
    if (!section) {
      return;
    }
    section.items.forEach((item) => {
      docs.items[item.id] = {
        ...(docs.items[item.id] || {}),
        checked: true,
      };
    });
    touchActiveCall();
    rerenderDocumentsDrawerPreservingScroll();
    return;
  }

  if (action === "copy_missing") {
    const stage = target.dataset.stage || docs.activeView || "all";
    copyToClipboard(buildMissingDocumentsText(activeCall, { stage })).then((copied) => {
      setDocumentsCopyMessage(
        activeCall,
        copied ? "Недостающие документы скопированы" : "Не удалось скопировать"
      );
    });
  }
}

function handleDocumentsChange(event) {
  const target = event.target.closest("[data-doc-action]");
  if (!target) {
    return;
  }

  const activeCall = getActiveCall();
  if (!activeCall) {
    return;
  }

  const docs = getDocumentState(activeCall);
  const action = target.dataset.docAction;

  if (action === "toggle_flag") {
    const flagId = target.dataset.flagId;
    if (!flagId || getDocumentFlagAutoValue(activeCall, flagId)) {
      return;
    }
    docs.flags[flagId] = Boolean(target.checked);
    touchActiveCall();
    rerenderDocumentsDrawerPreservingScroll();
    return;
  }

  if (action === "toggle_item") {
    const itemId = target.dataset.itemId;
    if (!itemId) {
      return;
    }
    docs.items[itemId] = {
      ...(docs.items[itemId] || {}),
      checked: Boolean(target.checked),
    };
    touchActiveCall();
    rerenderDocumentsDrawerPreservingScroll();
  }
}

function handleDocumentsInput(event) {
  const activeCall = getActiveCall();
  const key = event.target?.dataset?.docInput;
  if (!activeCall || key !== "search") {
    return;
  }
  const docs = getDocumentState(activeCall);
  docs.search = event.target.value;
  touchActiveCall();
  rerenderDocumentsDrawerPreservingScroll({
    focusInput: "search",
    selectionStart: event.target.selectionStart,
    selectionEnd: event.target.selectionEnd,
  });
}

function handleContradictionAction(event) {
  const target = event.target.closest("[data-contradiction-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.contradictionAction;
  event.preventDefault();

  if (action === "focus_panel") {
    focusContradictionsPanel();
    return;
  }

  if (action === "toggle_more") {
    uiState.contradictionsExpanded = !uiState.contradictionsExpanded;
    persistUiState();
    renderApp({ viewState: captureViewState(target) });
    return;
  }

  const activeCall = getActiveCall();
  if (!activeCall) {
    return;
  }

  const contradictions = getContradictions(routeState, formState, activeCall);
  const item = contradictions.all.find(
    (candidate) => candidate.id === target.dataset.contradictionId
  );
  if (!item) {
    return;
  }

  if (item.stage === "call2" && activeCall.call2Enabled && activeCall.activeStage !== "call2") {
    activeCall.activeStage = "call2";
    touchActiveCall();
    renderApp();
  } else if (item.stage === "call1" && activeCall.activeStage !== "call1") {
    activeCall.activeStage = "call1";
    touchActiveCall();
    renderApp();
  }

  window.requestAnimationFrame(() => {
    focusContradictionTarget(item);
  });
}

function focusContradictionsPanel() {
  if (!contradictionsRoot) {
    return;
  }
  contradictionsRoot.scrollIntoView({ behavior: "smooth", block: "start" });
  contradictionsRoot.classList.add("is-contradiction-highlight");
  window.setTimeout(() => {
    contradictionsRoot.classList.remove("is-contradiction-highlight");
  }, 1500);
}

function focusContradictionTarget(item) {
  const target = getContradictionTargetElement(item);
  if (!target) {
    focusContradictionsPanel();
    return;
  }

  focusTargetElement(target);
}

function focusTargetElement(target) {
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("is-contradiction-highlight");

  const focusable = target.matches("input, select, textarea, button")
    ? target
    : target.querySelector("input, select, textarea, button");
  if (focusable && typeof focusable.focus === "function") {
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
  }

  window.setTimeout(() => {
    target.classList.remove("is-contradiction-highlight");
  }, 1500);
}

function getContradictionTargetElement(item) {
  const activeCall = getActiveCall();
  if (item.stage === "call2" && activeCall && !activeCall.call2Enabled) {
    const activateButton = document.querySelector('[data-workspace-action="activate_call2"]');
    if (activateButton) {
      return activateButton;
    }
  }

  const anchor = item.anchorTarget || {};
  if (anchor.type === "field" && anchor.fieldKey) {
    return (
      document.querySelector(`[data-field-card="${anchor.fieldKey}"]`) ||
      document.querySelector(`[data-field-key="${anchor.fieldKey}"]`)
    );
  }

  if (anchor.type === "route" && anchor.routeKind) {
    return (
      document.querySelector(`[data-route-kind="${anchor.routeKind}"].is-active`) ||
      document.querySelector(`[data-route-kind="${anchor.routeKind}"]`)
    );
  }

  if (item.nodeId) {
    const nodeTarget = document.querySelector(`[data-node-id="${item.nodeId}"]`);
    if (nodeTarget) {
      return nodeTarget;
    }
  }

  if (item.sectionId) {
    return document.querySelector(`[data-precheck-section-id="${item.sectionId}"]`);
  }

  return null;
}

function escapeSelectorValue(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function getCurrentRenderedSignals() {
  const activeCall = getActiveCall();
  if (!activeCall) {
    return [];
  }
  const precheckIssues = computePrecheckIssues(routeState, formState);
  const contradictions = getContradictions(routeState, formState, activeCall);
  const precheckReady = isPrecheckReady(routeState, formState, precheckIssues, contradictions);
  const flowInsights = precheckReady ? computeInsights(routeState, formState) : [];
  const precheckDisplayIssues = filterSignalsCoveredByContradictions(
    precheckIssues,
    contradictions
  );
  const flowDisplayInsights = filterSignalsCoveredByContradictions(flowInsights, contradictions);
  return computeAllSignals(activeCall, {
    precheckIssues: precheckDisplayIssues,
    contradictions,
    insights: flowDisplayInsights,
  });
}

function getSignalDocumentItemId(signal) {
  const prefix = "missing-doc-";
  return signal?.id?.startsWith(prefix) ? signal.id.slice(prefix.length) : "";
}

function getSignalPrimaryField(signal) {
  return Array.isArray(signal?.fields) && signal.fields.length ? signal.fields[0] : "";
}

function handleSignalAction(event) {
  const target = event.target.closest("[data-signal-action='focus']");
  if (!target) {
    return;
  }

  event.preventDefault();
  const signal = getCurrentRenderedSignals().find((item) => item.id === target.dataset.signalId);
  if (!signal) {
    focusTargetElement(target);
    return;
  }

  focusSignalTarget(signal);
}

function focusSignalTarget(signal) {
  const activeCall = getActiveCall();
  if (!activeCall) {
    return;
  }

  const docItemId = getSignalDocumentItemId(signal);
  let needsRender = false;

  if (signal.stage === "2_call" && activeCall.call2Enabled && activeCall.activeStage !== "call2") {
    activeCall.activeStage = "call2";
    needsRender = true;
  } else if (signal.stage === "1_call" && activeCall.activeStage !== "call1") {
    activeCall.activeStage = "call1";
    needsRender = true;
  }

  if (docItemId) {
    const docs = getDocumentState(activeCall);
    docs.drawerOpen = true;
    docs.activeView = signal.stage === "2_call" ? "call2" : "all";
    if (signal.stage === "post") {
      docs.filter = "post";
    }
    needsRender = true;
  }

  if (needsRender) {
    touchActiveCall();
    renderApp();
  }

  window.requestAnimationFrame(() => {
    const target = getSignalTargetElement(signal);
    if (target) {
      focusTargetElement(target);
      return;
    }
    focusContradictionsPanel();
  });
}

function getParticipantSignalTargetElement() {
  const participants = normalizeParticipants(formState.dealParticipants);
  const incomplete = participants.find(
    (participant) =>
      (participant.fullName.trim() || participant.role) &&
      !(participant.fullName.trim() && participant.role)
  );

  if (incomplete) {
    const prop = incomplete.fullName.trim() ? "role" : "fullName";
    return document.querySelector(
      `[data-field-key="dealParticipants"][data-participant-id="${escapeSelectorValue(incomplete.id)}"][data-participant-prop="${prop}"]`
    );
  }

  return (
    document.querySelector(
      '[data-field-key="dealParticipants"][data-participant-prop="fullName"]'
    ) ||
    document.querySelector('[data-field-action="add-participant"][data-field-key="dealParticipants"]') ||
    document.querySelector('[data-field-card="dealParticipants"]')
  );
}

function getSignalTargetElement(signal) {
  const docItemId = getSignalDocumentItemId(signal);
  if (docItemId) {
    return (
      document.querySelector(`[data-doc-item-id="${escapeSelectorValue(docItemId)}"]`) ||
      documentsDrawerRoot
    );
  }

  const fieldKey = getSignalPrimaryField(signal);
  if (fieldKey === "dealParticipants") {
    return getParticipantSignalTargetElement();
  }

  if (fieldKey === "routePurpose") {
    return (
      document.querySelector('[data-route-kind="purpose"].is-active') ||
      document.querySelector('[data-route-kind="purpose"]')
    );
  }

  if (fieldKey === "routeProgram") {
    return (
      document.querySelector('[data-route-kind="program"].is-active') ||
      document.querySelector('[data-route-kind="program"]')
    );
  }

  if (fieldKey?.startsWith?.("followUp.") || signal.id?.startsWith?.("missing-outcome-")) {
    return (
      document.querySelector(`[data-outcome-key="${escapeSelectorValue(fieldKey)}"]`) ||
      callOutcomeRoot
    );
  }

  if (fieldKey) {
    return (
      document.querySelector(`[data-field-card="${escapeSelectorValue(fieldKey)}"]`) ||
      document.querySelector(`[data-field-key="${escapeSelectorValue(fieldKey)}"]`)
    );
  }

  if (signal.nodeId) {
    const nodeTarget = document.querySelector(`[data-node-id="${escapeSelectorValue(signal.nodeId)}"]`);
    if (nodeTarget) {
      return nodeTarget;
    }
  }

  if (signal.sectionId) {
    return document.querySelector(
      `[data-precheck-section-id="${escapeSelectorValue(signal.sectionId)}"]`
    );
  }

  return null;
}

const outputStageOptions = [
  { value: "call1", label: "1-й звонок" },
  { value: "call2", label: "2-й звонок" },
  { value: "all", label: "Все" },
];

const outputModeOptions = [
  { value: "system", label: "Как в системе" },
  { value: "call", label: "По звонку" },
  { value: "entities", label: "По сущностям" },
];

const outputSectionsByCall = [
  {
    id: "out_call1_route",
    stage: "call1",
    shortTitle: "Маршрут",
    title: "Маршрут заявки",
    hint: "Переносится в стартовые параметры заявки и продуктовую рамку.",
    issueNodeIds: ["application", "compatibility"],
    fields: [
      "routePurpose",
      "routeProgram",
      "loanAmount",
      "loanTerm",
      "purchaseRegion",
      "dataProcessingConsentDate",
    ],
  },
  {
    id: "out_call1_client",
    stage: "call1",
    shortTitle: "Клиент",
    title: "Клиент и состав сделки",
    hint: "Блок клиента, заемщиков, созаемщиков, залогодателей и ранних участнических ограничений.",
    issueNodeIds: ["client"],
    fields: [
      "borrowerSurname",
      "borrowerName",
      "borrowerPatronymic",
      "contactValue",
      "dataProcessingConsentDate",
      "dealParticipants",
      "familyStatus",
      "incomeConfirmationType",
      "minorParticipants",
      "nonBorrowerPledgorPresent",
      "pledgorKinshipDocsReady",
    ],
  },
  {
    id: "out_call1_product",
    stage: "call1",
    shortTitle: "Проверки",
    title: "Продуктовые проверки",
    hint: "Методологический аккордеон: это не основная система, а контроль допуска к программе.",
    issueNodeIds: [
      "compatibility",
      "gov_common",
      "family_gate",
      "program_family",
      "program_it",
      "program_dv",
      "program_military",
      "program_family_military",
    ],
    fields: [
      "routeConditionalApproved",
      "programTargetGroupConfirmed",
      "hasPriorGovMortgage",
      "childrenCount",
      "familyBasis",
      "childDob",
      "childSnils",
      "childRegistrationAddress",
      "spouseRussianCitizen",
      "spouseIncludedInDeal",
      "newChildAfterPriorLoan",
      "oldLoanClosed",
      "childDisabilityDoc",
      "itMainJob",
      "itAgeCompliance",
      "itEmployerAccredited",
      "itEmployerLocation",
      "itLaborContractAvailable",
      "itIncomeCompliance",
      "dvCategory",
      "dvAgeCompliance",
      "dvOwnershipStructureAllowed",
      "dvSpousePriorGovMortgage",
      "dvPostRegistrationRequired",
      "dvPostRegistrationAcknowledged",
      "dvPostRegistration",
      "militaryAgeCompliance",
      "militaryNisConfirmed",
      "militaryNisNumber",
      "militaryCoborrowersCount",
      "otherPledgorPresent",
    ],
  },
  {
    id: "out_call1_object",
    stage: "call1",
    shortTitle: "Объект",
    title: "Объект",
    hint: "Объектная часть: адрес, характеристики квартиры / дома и стоимость по договору.",
    issueNodeIds: ["purpose_ready", "purpose_build", "purpose_izhs", "house_gate"],
    fields: [
      "propertyType",
      "objectAddress",
      "objectHouse",
      "objectBuilding",
      "objectStructure",
      "apartmentNumber",
      "cadastralNumber",
      "constructionCompletionDate",
      "buildingFloors",
      "unitFloor",
      "roomsCount",
      "objectArea",
      "kitchenArea",
      "contractPrice",
      "houseAddress",
      "houseAddressHouse",
      "houseAddressBuilding",
      "houseAddressStructure",
      "livingArea",
      "houseType",
      "finishingType",
      "heatingType",
      "electricitySupply",
      "gasSupply",
      "waterSupply",
      "sewerageHouse",
      "houseFloorsAboveGround",
      "bathroomsCount",
      "ceilingHeight",
      "hasBasement",
    ],
  },
  {
    id: "out_call1_land",
    stage: "call1",
    shortTitle: "Земля",
    title: "Земельный участок",
    hint: "Показывается для ИЖС, участка или дома, где нужен отдельный земельный контур.",
    issueNodeIds: ["purpose_izhs", "land_gate"],
    fields: [
      "landCadastralNumber",
      "landArea",
      "landCategory",
      "landUseType",
      "landRestrictions",
      "landAddress",
      "landContractPrice",
      "landBoundariesKnown",
      "landOwnershipAllowed",
      "landRegionAllowed",
      "landZoneAllowed",
      "landUseAllowed",
    ],
  },
  {
    id: "out_call1_seller",
    stage: "call1",
    shortTitle: "Продавец",
    title: "Продавец / подрядчик",
    hint: "Контрагент, представитель и строительный контур для переноса в карточку сделки.",
    issueNodeIds: ["purpose_ready", "purpose_build", "purpose_izhs"],
    fields: [
      "sellerType",
      "sellerFullName",
      "sellerPhone",
      "sellerRelationToBorrower",
      "sellerIsEntrepreneur",
      "sellerOwnershipDoc",
      "representativeNeeded",
      "representativeName",
      "sellerCompanyEmail",
      "sellerCompanyInn",
      "sellerCompanyName",
      "sellerCompanyPhone",
      "constructionExecutor",
      "contractorType",
      "contractorIpInn",
      "contractorIpName",
      "contractorCompanyInn",
      "contractorCompanyName",
      "contractorConstructionDoc",
      "houseContractPrice",
    ],
  },
  {
    id: "out_call1_docs",
    stage: "call1",
    shortTitle: "Документы",
    title: "Ранние документы",
    hint: "Финальный блок первого звонка: что подтягивается автоматически и что нужно запросить.",
    issueNodeIds: ["call1_docs"],
    fields: ["egrnStatus", "appraisalReportNumber", "birthCertificatesStatus", "guardianshipStatus"],
  },
  {
    id: "out_call2_legal",
    stage: "call2",
    shortTitle: "Юр. рамка",
    title: "Юридическая рамка сделки",
    hint: "Документ-основание, собственность, брачный режим и юридическая готовность сделки.",
    issueNodeIds: ["call2_legal"],
    fields: [
      "finalLoanTerm",
      "ownershipForm",
      "titleDocType",
      "titleDocName",
      "titleDocNumber",
      "titleDocDate",
      "maritalRegimeClear",
      "sellerOwnershipYears",
      "izhsProjectReady",
    ],
  },
  {
    id: "out_call2_refi",
    stage: "call2",
    shortTitle: "Рефинанс",
    title: "Рефинансирование",
    hint: "Показывается только для перекредитования: старый договор, кредитор, цепочка и ПСК.",
    issueNodeIds: ["call2_refi"],
    fields: [
      "refiOriginalContractNumber",
      "refiOriginalContractDate",
      "refiOrgType",
      "refiOrgName",
      "refiPrevDomrf",
      "refiPrevContractNumber",
      "refiPrevContractDate",
      "refiPrevContractType",
      "refiChainCount",
      "refiBorrowerLinkedToOld",
      "refiPskAvailable",
      "refiBorrowerRemains",
      "refiAllPledgorsRemain",
      "refiObjectSameAsOld",
    ],
  },
  {
    id: "out_call2_payments",
    stage: "call2",
    shortTitle: "Расчеты",
    title: "Расчеты и ПВ",
    hint: "Способ расчетов, первоначальный взнос, субсидии, спецсчета и скидки по ставке.",
    issueNodeIds: ["call2_payments"],
    fields: [
      "paymentMethod",
      "specialAccountFlag",
      "escrowOpened",
      "externalEscrow",
      "pvControl",
      "pvDomrfAmount",
      "pvDocAmount",
      "subsidyInPvAmount",
      "subsidyName",
      "subsidyAmount",
      "downPayment",
      "finalRateReductionPeriod",
      "finalRateDiscountSize",
      "izhsLandInspectionActReady",
    ],
  },
  {
    id: "out_call2_insurance",
    stage: "call2",
    shortTitle: "Страхование",
    title: "Страхование",
    hint: "Страхователь и виды страхования для финального выпуска сделки.",
    issueNodeIds: ["call2_finish"],
    fields: ["personalInsurance", "insurancePolicyholder", "insuranceType"],
  },
  {
    id: "out_call2_logistics",
    stage: "call2",
    shortTitle: "Логистика",
    title: "Логистика сделки",
    hint: "Дата, место сделки, идентификация клиента и параметры ДБО.",
    issueNodeIds: ["call2_finish"],
    fields: [
      "useForDbo",
      "dealDateTime",
      "paymentDay",
      "transactionLocation",
      "clientIdentificationMethod",
      "contractConclusionLocation",
    ],
  },
  {
    id: "out_call2_requisites",
    stage: "call2",
    shortTitle: "Реквизиты",
    title: "Реквизиты получателя",
    hint: "Показываются для внешних расчетов или счетов вне Банка ДОМ.РФ.",
    issueNodeIds: ["call2_finish"],
    fields: [
      "recipientAccountOwnerRole",
      "recipientAccountOwnerName",
      "recipientBank",
      "recipientSettlementAccount",
    ],
  },
];

const outputEntitySections = [
  {
    id: "out_entity_application",
    stage: "call1",
    shortTitle: "Заявка",
    title: "Заявка и маршрут",
    hint: "Ключевые параметры заявки до детализации клиента и объекта.",
    issueNodeIds: ["application", "compatibility"],
    fields: ["routePurpose", "routeProgram", "loanAmount", "loanTerm", "purchaseRegion"],
  },
  {
    id: "out_entity_people",
    stage: "call1",
    shortTitle: "Участники",
    title: "Заемщик, созаемщики и залогодатели",
    hint: "Состав участников, семейный контур и ранние ограничения.",
    issueNodeIds: ["client", "program_family", "program_military", "program_family_military"],
    fields: [
      "borrowerSurname",
      "borrowerName",
      "borrowerPatronymic",
      "contactValue",
      "dealParticipants",
      "familyStatus",
      "incomeConfirmationType",
      "minorParticipants",
      "nonBorrowerPledgorPresent",
      "pledgorKinshipDocsReady",
      "childrenCount",
      "familyBasis",
      "childDob",
      "childSnils",
      "childRegistrationAddress",
      "militaryNisNumber",
    ],
  },
  {
    id: "out_entity_object",
    stage: "call1",
    shortTitle: "Объект",
    title: "Объект недвижимости",
    hint: "Адреса, характеристики, кадастровые номера и цены по объекту.",
    issueNodeIds: ["purpose_ready", "purpose_build", "purpose_izhs", "house_gate"],
    fields: [
      "propertyType",
      "objectAddress",
      "objectHouse",
      "objectBuilding",
      "objectStructure",
      "apartmentNumber",
      "cadastralNumber",
      "houseAddress",
      "houseAddressHouse",
      "houseAddressBuilding",
      "houseAddressStructure",
      "objectArea",
      "livingArea",
      "roomsCount",
      "contractPrice",
      "houseContractPrice",
    ],
  },
  outputSectionsByCall.find((section) => section.id === "out_call1_land"),
  outputSectionsByCall.find((section) => section.id === "out_call1_seller"),
  outputSectionsByCall.find((section) => section.id === "out_call2_refi"),
  outputSectionsByCall.find((section) => section.id === "out_call2_payments"),
  {
    id: "out_entity_finish",
    stage: "call2",
    shortTitle: "Финиш",
    title: "Страхование, логистика и реквизиты",
    hint: "Финальная операционная часть второго звонка.",
    issueNodeIds: ["call2_finish"],
    fields: [
      "personalInsurance",
      "insurancePolicyholder",
      "insuranceType",
      "useForDbo",
      "dealDateTime",
      "paymentDay",
      "transactionLocation",
      "clientIdentificationMethod",
      "contractConclusionLocation",
      "recipientAccountOwnerRole",
      "recipientAccountOwnerName",
      "recipientBank",
      "recipientSettlementAccount",
    ],
  },
].filter(Boolean);

let outputCopyMessageTimer = null;

function getOutputSectionCatalog() {
  if (uiState.outputMode === "entities") {
    return outputEntitySections;
  }
  return outputSectionsByCall;
}

function getOutputAllowedStages(call) {
  if (uiState.outputStage === "all") {
    return call.call2Enabled ? ["call1", "call2"] : ["call1"];
  }
  if (uiState.outputStage === "call2" && !call.call2Enabled) {
    return ["call1"];
  }
  return [uiState.outputStage || "call1"];
}

function getOutputFieldRawValue(fieldKey, field, call) {
  if (field.kind === "route") {
    return fieldKey === "routePurpose" ? call.route.purpose : call.route.program;
  }
  return call.form[fieldKey];
}

function getOptionLabel(field, value) {
  const options = field.options || (field.kind === "boolean" ? boolOptions : []);
  return options.find((option) => option.value === value)?.label || value;
}

function formatOutputValue(fieldKey, field, value) {
  if (field.kind === "route") {
    return fieldKey === "routePurpose"
      ? getRouteLabel("purpose", value)
      : getRouteLabel("program", value);
  }

  if (!isFieldValueFilled(field, value)) {
    return "— не заполнено";
  }

  if (field.kind === "participants") {
    return serializeParticipants(value, field);
  }

  if (field.kind === "boolean") {
    return value === "yes" ? "✓ Да" : "— Нет";
  }

  if (field.kind === "select" || field.kind === "radio") {
    return getOptionLabel(field, value);
  }

  if (field.kind === "multi" && Array.isArray(value)) {
    return value.map((item) => getOptionLabel(field, item)).join(" | ");
  }

  if (field.kind === "date") {
    return maskDateInput(value);
  }

  if (field.kind === "datetime-local") {
    return maskDateTimeInput(value);
  }

  return String(value ?? "");
}

function getOutputSourceLabel(field) {
  const token = field.apicsId || "";
  if (field.sourceKind === "apics") {
    return token ? `APICS · ${token}` : "APICS";
  }
  if (field.sourceKind === "csv_no_id") {
    return "без id";
  }
  return token ? `методология · ${token}` : "методология";
}

function getOutputRows(section, call, options = {}) {
  const rows = [];
  section.fields.forEach((fieldKey) => {
    const field = fieldCatalog[fieldKey];
    if (!field || !isFieldVisible(field, call.route, call.form)) {
      return;
    }
    if (!uiState.outputShowMethodology && field.sourceKind === "method") {
      return;
    }
    if (!["apics", "csv_no_id", "method"].includes(field.sourceKind)) {
      return;
    }

    const value = getOutputFieldRawValue(fieldKey, field, call);
    const filled = isFieldValueFilled(field, value);
    if (!options.ignoreFilledFilter && uiState.outputFilledMode === "filled" && !filled) {
      return;
    }

    rows.push({
      fieldKey,
      field,
      filled,
      label: field.label,
      value,
      formattedValue: formatOutputValue(fieldKey, field, value),
      sourceLabel: getOutputSourceLabel(field),
      isMethod: field.sourceKind === "method",
    });
  });
  return rows;
}

function getOutputIssuesForSection(section, issues) {
  const ids = new Set(section.issueNodeIds || []);
  return issues.filter((item) => ids.has(item.nodeId) || ids.has(item.sectionId));
}

function getOutputSectionStatus(section, call, issues) {
  const sectionIssues = getOutputIssuesForSection(section, issues);
  if (sectionIssues.some((item) => item.level === "blocker")) {
    return { label: "есть красные границы", className: "is-danger" };
  }
  const rows = getOutputRows(section, call, { ignoreFilledFilter: true });
  if (!rows.length) {
    return { label: "пусто", className: "is-empty" };
  }
  const filledCount = rows.filter((row) => row.filled).length;
  if (filledCount === 0) {
    return { label: "пусто", className: "is-empty" };
  }
  if (filledCount < rows.length) {
    return { label: "частично", className: "is-partial" };
  }
  return { label: "заполнено", className: "is-complete" };
}

function getOutputIssues(call) {
  if (!call.route.purpose || !call.route.program) {
    return [];
  }
  const precheckIssues = computePrecheckIssues(call.route, call.form);
  const flowInsights = computeInsights(call.route, call.form);
  return [...precheckIssues, ...flowInsights];
}

function buildVisibleOutputSections(call) {
  const allowedStages = new Set(getOutputAllowedStages(call));
  const issues = getOutputIssues(call);
  return getOutputSectionCatalog()
    .filter((section) => allowedStages.has(section.stage))
    .map((section) => {
      const rows = getOutputRows(section, call);
      const status = getOutputSectionStatus(section, call, issues);
      const sectionIssues = getOutputIssuesForSection(section, issues);
      return {
        ...section,
        rows,
        status,
        issues: sectionIssues,
      };
    })
    .filter((section) => section.rows.length || (uiState.outputShowMethodology && section.issues.length));
}

function buildOutputSectionText(section) {
  const lines = [section.title];
  const systemRows = section.rows.filter((row) => !row.isMethod);
  const methodRows = section.rows.filter((row) => row.isMethod);

  systemRows.forEach((row) => {
    lines.push(`${row.label}: ${row.formattedValue}`);
  });

  if (methodRows.length) {
    lines.push("");
    lines.push("Методологические проверки:");
    methodRows.forEach((row) => {
      lines.push(`${row.label}: ${row.formattedValue}`);
    });
  }

  if (uiState.outputShowMethodology && section.issues.length) {
    lines.push("");
    lines.push("Сигналы:");
    section.issues.forEach((issue) => {
      lines.push(`${issue.title}: ${issue.text}`);
    });
  }

  return lines.join("\n");
}

function buildOutputAllText(sections) {
  return sections.map((section) => buildOutputSectionText(section)).join("\n\n");
}

function copyToClipboard(text) {
  if (!text) {
    return Promise.resolve(false);
  }
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return Promise.resolve(copied);
}

function setOutputCopyMessage(message) {
  uiState.outputCopyMessage = message;
  updateOutputCopyMessage();
  if (outputCopyMessageTimer) {
    window.clearTimeout(outputCopyMessageTimer);
  }
  outputCopyMessageTimer = window.setTimeout(() => {
    uiState.outputCopyMessage = "";
    updateOutputCopyMessage();
  }, 1800);
}

function updateOutputCopyMessage() {
  const statusNode = outputPanelRoot?.querySelector?.(".output-copy-status");
  if (statusNode) {
    statusNode.textContent =
      uiState.outputCopyMessage || "Копируйте поле, блок или весь видимый вывод.";
  }
}

function findOutputSection(sectionId, call) {
  return buildVisibleOutputSections(call).find((section) => section.id === sectionId);
}

function findOutputField(fieldKey, call) {
  const field = fieldCatalog[fieldKey];
  if (!field) {
    return null;
  }
  const value = getOutputFieldRawValue(fieldKey, field, call);
  return {
    field,
    value,
    formattedValue: formatOutputValue(fieldKey, field, value),
  };
}

function handleOutputAction(event) {
  const button = event.target.closest("[data-output-action]");
  if (!button) {
    return;
  }

  const activeCall = getActiveCall();
  const action = button.dataset.outputAction;
  event.preventDefault();

  if (action === "close") {
    uiState.outputOpen = false;
    uiState.outputCopyMessage = "";
    persistUiState();
    renderApp();
    return;
  }

  if (!activeCall) {
    return;
  }

  if (action === "set_stage") {
    uiState.outputStage = button.dataset.outputValue || "call1";
    persistUiState();
    renderApp();
    return;
  }

  if (action === "set_mode") {
    uiState.outputMode = button.dataset.outputValue || "system";
    persistUiState();
    renderApp();
    return;
  }

  if (action === "set_filled") {
    uiState.outputFilledMode = button.dataset.outputValue || "filled";
    persistUiState();
    renderApp();
    return;
  }

  if (action === "toggle_methodology") {
    uiState.outputShowMethodology = !uiState.outputShowMethodology;
    persistUiState();
    renderApp();
    return;
  }

  if (action === "copy_field") {
    const outputField = findOutputField(button.dataset.fieldKey, activeCall);
    if (outputField) {
      copyToClipboard(outputField.formattedValue).then((copied) => {
        setOutputCopyMessage(copied ? "Поле скопировано" : "Не удалось скопировать");
      });
    }
    return;
  }

  if (action === "copy_text") {
    copyToClipboard(button.dataset.copyText || "").then((copied) => {
      setOutputCopyMessage(copied ? "Фрагмент скопирован" : "Не удалось скопировать");
    });
    return;
  }

  if (action === "copy_block") {
    const section = findOutputSection(button.dataset.sectionId, activeCall);
    if (section) {
      copyToClipboard(buildOutputSectionText(section)).then((copied) => {
        setOutputCopyMessage(copied ? "Блок скопирован" : "Не удалось скопировать");
      });
    }
    return;
  }

  if (action === "copy_all") {
    const sections = buildVisibleOutputSections(activeCall);
    copyToClipboard(buildOutputAllText(sections)).then((copied) => {
      setOutputCopyMessage(copied ? "Видимый вывод скопирован" : "Не удалось скопировать");
    });
  }
}

function handleOutputChange() {
  // Output panel is controlled by buttons; the listener is kept for future selects.
}

function handleJournalAction(event) {
  const button = event.target.closest("[data-journal-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.journalAction;
  const callId = button.dataset.callId;

  if (action === "create") {
    createNewCall();
    return;
  }

  if (action === "export_all") {
    exportAllCalls();
    return;
  }

  if (action === "open_calendar") {
    uiState.calendarOpen = true;
    uiState.calendarView = "list";
    uiState.calendarSelectedDate = uiState.calendarSelectedDate || getTodayIsoDate();
    persistUiState();
    renderApp();
    return;
  }

  if (action === "open" && callId) {
    selectCall(callId, { scrollToWorkspace: true });
    return;
  }

  if (action === "export" && callId) {
    exportCallById(callId);
  }
}

function handleWorkspaceMetaChange(event) {
  const activeCall = getActiveCall();
  const key = event.target?.dataset?.callMetaKey;
  if (!activeCall || !key) {
    return;
  }

  if (key === "createdAt") {
    const maskedValue = maskDateTimeInput(event.target.value);
    event.target.value = maskedValue;
    const parsedDate = parseDateTimeInput(maskedValue);
    if (parsedDate) {
      activeCall.createdAt = parsedDate.toISOString();
    }
    touchActiveCall();
    return;
  }

  activeCall[key] = event.target.value;
  touchActiveCall();

  if (event.type === "input") {
    return;
  }

  renderApp();
}

function handleWorkspaceMetaCommit(event) {
  const activeCall = getActiveCall();
  const key = event.target?.dataset?.callMetaKey;
  if (!activeCall || !key) {
    return;
  }

  if (key === "createdAt") {
    const parsedDate = parseDateTimeInput(event.target.value);
    if (parsedDate) {
      activeCall.createdAt = parsedDate.toISOString();
      touchActiveCall();
    } else {
      event.target.value = formatDateTimeForInput(activeCall.createdAt);
    }
  }

  renderApp();
}

function handleWorkspaceAction(event) {
  const button = event.target.closest("[data-workspace-action]");
  const activeCall = getActiveCall();
  if (!button || !activeCall) {
    return;
  }

  const action = button.dataset.workspaceAction;

  if (action === "close") {
    closeActiveCall();
    return;
  }

  if (action === "export") {
    exportCallById(activeCall.id);
    return;
  }

  if (action === "open_documents") {
    activeCall.documents = normalizeDocumentsState(activeCall.documents);
    activeCall.documents.drawerOpen = true;
    activeCall.documents.activeView =
      activeCall.activeStage === "call2" && activeCall.call2Enabled ? "call2" : "call1";
    touchActiveCall();
    renderApp();
    return;
  }

  if (action === "open_calendar") {
    uiState.calendarOpen = true;
    uiState.calendarView = "list";
    uiState.calendarSelectedDate = uiState.calendarSelectedDate || getTodayIsoDate();
    persistUiState();
    renderApp();
    return;
  }

  if (action === "open_output") {
    uiState.outputOpen = true;
    uiState.outputStage = activeCall.activeStage === "call2" ? "call2" : "call1";
    persistUiState();
    renderApp();
    return;
  }

  if (action === "show_call1") {
    activeCall.activeStage = "call1";
    touchActiveCall();
    renderApp();
    return;
  }

  if (action === "show_call2" && activeCall.call2Enabled) {
    activeCall.activeStage = "call2";
    touchActiveCall();
    renderApp();
    return;
  }

  if (action === "activate_call2") {
    const precheckIssues = computePrecheckIssues(routeState, formState);
    const contradictions = getContradictions(routeState, formState, activeCall);
    if (!isPrecheckReady(routeState, formState, precheckIssues, contradictions)) {
      window.alert("Сначала нужно выбрать ветку и пройти pre-check. После этого можно открывать второй звонок.");
      return;
    }
    activeCall.call2Enabled = true;
    activeCall.activeStage = "call2";
    touchActiveCall();
    renderApp({ scrollToWorkspace: true });
  }
}

function getOutcomeForActiveCall() {
  const activeCall = getActiveCall();
  if (!activeCall) {
    return null;
  }
  activeCall.outcome = normalizeOutcomeState(activeCall.outcome);
  return activeCall.outcome;
}

function touchOutcome(activeCall) {
  if (!activeCall) {
    return;
  }
  activeCall.outcome = normalizeOutcomeState(activeCall.outcome);
  activeCall.outcome.updatedAt = new Date().toISOString();
  touchCall(activeCall);
}

function updateOutcomeDateValue(target, currentValue = "") {
  const maskedValue = maskDateInput(target.value);
  target.value = maskedValue;
  if (!maskedValue) {
    return "";
  }
  return maskedValue.length === 10 ? normalizeDateValueToIso(maskedValue) : maskedValue || currentValue;
}

function handleOutcomeChange(event) {
  const activeCall = getActiveCall();
  const outcome = getOutcomeForActiveCall();
  const target = event.target;
  if (!activeCall || !outcome || !target) {
    return;
  }

  const outcomeKey = target.dataset.outcomeKey;
  const docId = target.dataset.promisedDocId;
  const docKey = target.dataset.promisedDocKey;

  if (docId && docKey) {
    const docs = outcome.promisedDocs.length ? outcome.promisedDocs : [createPromisedDoc()];
    const docIndex = docs.findIndex((doc) => doc.id === docId);
    const nextIndex = docIndex >= 0 ? docIndex : docs.length - 1;
    const doc = docs[nextIndex] || createPromisedDoc("", "", "", false, docId);

    if (docKey === "received") {
      docs[nextIndex] = { ...doc, received: Boolean(target.checked) };
    } else if (docKey === "dueDate") {
      docs[nextIndex] = { ...doc, dueDate: updateOutcomeDateValue(target, doc.dueDate) };
    } else {
      docs[nextIndex] = { ...doc, [docKey]: target.value.trimStart() };
    }
    outcome.promisedDocs = docs;
    touchOutcome(activeCall);

    if (event.type === "input" && docKey !== "received") {
      return;
    }
    renderApp({ viewState: captureViewState(target) });
    return;
  }

  if (!outcomeKey) {
    return;
  }

  if (outcomeKey === "followUp.required") {
    outcome.followUp.required = Boolean(target.checked);
  } else if (outcomeKey === "followUp.date") {
    outcome.followUp.date = updateOutcomeDateValue(target, outcome.followUp.date);
  } else if (outcomeKey === "followUp.time") {
    const maskedValue = maskTimeInput(target.value);
    target.value = maskedValue;
    outcome.followUp.time = maskedValue;
  } else if (outcomeKey === "followUp.channel") {
    outcome.followUp.channel = target.value;
  } else if (outcomeKey === "followUp.reason") {
    outcome.followUp.reason = target.value.trimStart();
  } else if (outcomeKey === "followUp.done") {
    outcome.followUp.done = Boolean(target.checked);
    outcome.followUp.doneAt = target.checked ? new Date().toISOString() : "";
  } else {
    outcome[outcomeKey] = target.value.trimStart();
  }

  touchOutcome(activeCall);

  if (
    event.type === "input" &&
    !["followUp.required", "followUp.channel", "followUp.done"].includes(outcomeKey)
  ) {
    return;
  }

  renderApp({ viewState: captureViewState(target) });
}

function handleOutcomeAction(event) {
  const button = event.target.closest("[data-outcome-action]");
  const activeCall = getActiveCall();
  const outcome = getOutcomeForActiveCall();
  if (!button || !activeCall || !outcome) {
    return;
  }

  event.preventDefault();
  const action = button.dataset.outcomeAction;

  if (action === "set_status") {
    const nextStatus = button.dataset.outcomeValue || "";
    outcome.status = nextStatus;
    if (outcomeStatusesRequiringFollowUp.has(nextStatus)) {
      outcome.followUp.required = true;
      outcome.followUp.channel = outcome.followUp.channel || "call";
    }
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "add_doc") {
    outcome.promisedDocs = outcome.promisedDocs.concat(createPromisedDoc());
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "remove_doc") {
    const docId = button.dataset.promisedDocId;
    outcome.promisedDocs = outcome.promisedDocs.filter((doc) => doc.id !== docId);
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "clear_date") {
    outcome.followUp.date = "";
    outcome.followUp.time = "";
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "mark_no_followup") {
    outcome.followUp.required = false;
    outcome.followUp.date = "";
    outcome.followUp.time = "";
    outcome.followUp.reason = "";
    outcome.followUp.done = false;
    outcome.followUp.doneAt = "";
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "save_plan") {
    outcome.followUp.required = true;
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "save") {
    touchOutcome(activeCall);
    renderApp({ viewState: captureViewState(button) });
  }
}

function handleOutcomeCommit(event) {
  if (!event.target?.closest?.("[data-outcome-key], [data-promised-doc-key]")) {
    return;
  }
  const activeCall = getActiveCall();
  if (!activeCall) {
    return;
  }
  touchOutcome(activeCall);
  const nextFocusTarget = event.relatedTarget || document.activeElement || event.target;
  renderApp({ viewState: captureViewState(nextFocusTarget) });
}

function handleCalendarAction(event) {
  const button = event.target.closest("[data-calendar-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  const action = button.dataset.calendarAction;
  const callId = button.dataset.callId;
  const call = journalState.calls.find((item) => item.id === callId);

  if (action === "close") {
    uiState.calendarOpen = false;
    persistUiState();
    renderApp();
    return;
  }

  if (action === "set_view") {
    uiState.calendarView = button.dataset.calendarValue || "list";
    uiState.calendarSelectedDate = uiState.calendarSelectedDate || getTodayIsoDate();
    persistUiState();
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "select_date") {
    uiState.calendarSelectedDate = button.dataset.calendarDate || getTodayIsoDate();
    uiState.calendarView = "month";
    persistUiState();
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "today") {
    uiState.calendarSelectedDate = getTodayIsoDate();
    uiState.calendarView = "month";
    persistUiState();
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "open_call" && callId) {
    uiState.calendarOpen = false;
    persistUiState();
    selectCall(callId, { scrollToWorkspace: true });
    return;
  }

  if (!call) {
    return;
  }

  call.outcome = normalizeOutcomeState(call.outcome);

  if (action === "done") {
    call.outcome.followUp.done = true;
    call.outcome.followUp.doneAt = new Date().toISOString();
    call.outcome.updatedAt = new Date().toISOString();
    touchCall(call);
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "unschedule") {
    call.outcome.followUp.required = false;
    call.outcome.followUp.done = false;
    call.outcome.followUp.doneAt = "";
    call.outcome.updatedAt = new Date().toISOString();
    touchCall(call);
    renderApp({ viewState: captureViewState(button) });
  }
}

function handleCalendarChange(event) {
  const target = event.target;
  const callId = target?.dataset?.callId;
  const input = target?.dataset?.calendarInput;
  if (!callId || !input) {
    return;
  }

  const call = journalState.calls.find((item) => item.id === callId);
  if (!call) {
    return;
  }

  call.outcome = normalizeOutcomeState(call.outcome);
  call.outcome.followUp.required = true;

  if (input === "date") {
    call.outcome.followUp.date = updateOutcomeDateValue(target, call.outcome.followUp.date);
  }

  if (input === "time") {
    const maskedValue = maskTimeInput(target.value);
    target.value = maskedValue;
    call.outcome.followUp.time = maskedValue;
  }

  call.outcome.updatedAt = new Date().toISOString();
  touchCall(call);

  if (event.type === "input") {
    return;
  }

  renderApp({ viewState: captureViewState(target) });
}

function handleManagerProfileInput(event) {
  const key = event.target?.dataset?.managerKey;
  if (key !== "fullName") {
    return;
  }
  managerProfile.fullName = event.target.value.trimStart();
  persistManagerProfile();
  renderBrandHeader();
}

function handleManagerProfileAction(event) {
  const button = event.target.closest("[data-manager-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  const action = button.dataset.managerAction;

  if (action === "begin") {
    if (!managerProfile.fullName.trim()) {
      setSessionFeedback("Укажите ФИО менеджера, чтобы начать работу.", "warning");
    } else {
      setSessionFeedback("Профиль менеджера сохранен.", "success");
    }
    persistManagerProfile();
    renderApp({ viewState: captureViewState(button) });
    return;
  }

  if (action === "import") {
    sessionImportInput.value = "";
    sessionImportInput.click();
    return;
  }

  if (action === "change") {
    const input = managerProfileRoot.querySelector("[data-manager-key='fullName']");
    if (input) {
      input.focus();
      input.select?.();
    }
  }
}

function handleSessionModalAction(event) {
  const button = event.target.closest("[data-session-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  const action = button.dataset.sessionAction;

  if (action === "cancel" || action === "close") {
    pendingSessionImport = null;
    renderSessionModal();
    return;
  }

  if (action === "apply_import" && pendingSessionImport?.backup) {
    applyImportedSession(pendingSessionImport.backup, pendingSessionImport.fileName, "replace");
    return;
  }

  if (action === "apply_merge" && pendingSessionImport?.backup) {
    applyImportedSession(pendingSessionImport.backup, pendingSessionImport.fileName, "merge");
  }
}

function formatSessionTimestamp(value) {
  return value ? formatDateTimeFull(value) : "не было";
}

function renderBrandHeader() {
  const managerName = managerProfile.fullName.trim();
  if (brandKicker) {
    brandKicker.textContent = "Интерактивный блокнот менеджера";
  }
  if (brandTitle) {
    brandTitle.textContent = managerName || "Интерактивный блокнот менеджера";
  }
  if (brandLead) {
    brandLead.innerHTML = managerName
      ? `
        Рабочая сессия менеджера <strong>${escapeHtml(managerName)}</strong>.
        Блокнот ведет по маршруту: сначала цель и программа, затем pre-check,
        1-й звонок, 2-й звонок, документы, итог контакта и follow-up.
      `
      : `
        Укажите ФИО менеджера и работайте в одном локальном блокноте:
        цель, программа, pre-check, 1-й звонок, 2-й звонок, документы,
        итог контакта и follow-up.
      `;
  }
}

function getBackupActiveCallTitle(backup) {
  const activeCall = backup.journalState.calls.find(
    (call) => call.id === backup.journalState.activeCallId
  );
  if (!activeCall) {
    return "активная карточка не выбрана";
  }
  return activeCall.title || activeCall.clientName || activeCall.callName || "Новая карточка";
}

function renderManagerProfile() {
  const hasName = Boolean(managerProfile.fullName.trim());
  const feedback = sessionFeedback
    ? `<div class="session-status ${escapeHtml(sessionFeedbackTone)}">${escapeHtml(sessionFeedback)}</div>`
    : "";

  managerProfileRoot.innerHTML = `
    <div class="manager-profile-card ${hasName ? "is-ready" : "is-empty"}">
      <div class="manager-profile-head">
        <div>
          <p class="utility-label">Интерактивный блокнот менеджера</p>
          ${hasName ? `<p class="manager-profile-name">${escapeHtml(managerProfile.fullName)}</p>` : ""}
          <p class="utility-copy">
            Укажите ФИО, чтобы привязать рабочую сессию и резервную копию к сотруднику.
          </p>
        </div>
        ${
          hasName
            ? `<span class="outcome-pill success">профиль задан</span>`
            : `<span class="outcome-pill warning">нужно ФИО</span>`
        }
      </div>

      <label class="manager-profile-field">
        <span>ФИО менеджера</span>
        <input
          class="field-input"
          type="text"
          data-manager-key="fullName"
          value="${escapeHtml(managerProfile.fullName)}"
          placeholder="Иванов Иван Иванович"
        />
      </label>

      <div class="session-meta-grid">
        <span>Последний экспорт: ${escapeHtml(formatSessionTimestamp(managerProfile.lastExportAt))}</span>
        <span>
          ${
            managerProfile.lastImportedAt
              ? `Импорт: ${escapeHtml(formatSessionTimestamp(managerProfile.lastImportedAt))}`
              : "Импортов еще не было"
          }
        </span>
        ${
          managerProfile.lastImportedFileName
            ? `<span>Файл: ${escapeHtml(managerProfile.lastImportedFileName)}</span>`
            : ""
        }
      </div>

      ${feedback}

      <div class="manager-profile-actions">
        <button class="action-button action-button-primary" data-manager-action="begin" type="button">
          ${hasName ? "Сохранить ФИО" : "Начать работу"}
        </button>
        <button class="action-button" data-manager-action="import" type="button">
          Импортировать сессию
        </button>
        ${
          hasName
            ? `<button class="action-button" data-manager-action="change" type="button">Сменить менеджера</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderSessionModal() {
  if (!pendingSessionImport) {
    sessionModalRoot.classList.add("hidden");
    sessionModalRoot.innerHTML = "";
    return;
  }

  const backup = pendingSessionImport.backup;
  const callsCount = backup.journalState.calls.length;
  const currentCallsCount = journalState.calls.length;
  sessionModalRoot.classList.remove("hidden");
  sessionModalRoot.innerHTML = `
    <div class="session-modal-scrim" data-session-action="close"></div>
    <aside class="session-modal" role="dialog" aria-modal="true" aria-label="Предпросмотр импорта сессии">
      <div class="session-modal-head">
        <span class="documents-kicker">restore</span>
        <h2>Импорт сессии</h2>
        <p>
          Сейчас открыт preview файла. Можно заменить текущую сессию или добавить звонки из файла к текущему журналу.
        </p>
      </div>

      <div class="session-preview-grid">
        <div class="session-preview-row">
          <span>ФИО менеджера</span>
          <strong>${escapeHtml(backup.managerProfile.fullName || "не указано")}</strong>
        </div>
        <div class="session-preview-row">
          <span>Дата экспорта</span>
          <strong>${escapeHtml(formatSessionTimestamp(backup.exportedAt))}</strong>
        </div>
        <div class="session-preview-row">
          <span>Количество звонков</span>
          <strong>${callsCount}</strong>
        </div>
        <div class="session-preview-row">
          <span>Сейчас в журнале</span>
          <strong>${currentCallsCount}</strong>
        </div>
        <div class="session-preview-row">
          <span>Активная карточка</span>
          <strong>${escapeHtml(getBackupActiveCallTitle(backup))}</strong>
        </div>
        <div class="session-preview-row">
          <span>Schema version</span>
          <strong>${backup.journalState.schemaVersion || CURRENT_JOURNAL_SCHEMA_VERSION}</strong>
        </div>
        <div class="session-preview-row">
          <span>Версия backup</span>
          <strong>${backup.version}</strong>
        </div>
        <div class="session-preview-row">
          <span>Файл</span>
          <strong>${escapeHtml(pendingSessionImport.fileName)}</strong>
        </div>
      </div>

      <div class="session-warning">
        <strong>Внимание</strong>
        Режим замены перезапишет звонки, активную карточку, профиль менеджера и восстановимое UI-состояние.
        Режим добавления сохранит текущую сессию и допишет звонки из файла; UI-состояние при этом не заменяется.
      </div>

      <div class="session-modal-actions">
        <button class="action-button" data-session-action="cancel" type="button">
          Отменить
        </button>
        <button class="action-button" data-session-action="apply_merge" type="button">
          Добавить звонки
        </button>
        <button class="action-button action-button-primary" data-session-action="apply_import" type="button">
          Импортировать и заменить
        </button>
      </div>
    </aside>
  `;
}

function renderJournalOutcomeSignals(call) {
  const outcome = normalizeOutcomeState(call.outcome);
  const statusMeta = getOutcomeStatusMeta(outcome.status);
  const task = buildFollowUpTaskFromCall(call);
  const readiness = getOutcomeReadiness(outcome);
  const promisedDocsWaiting = outcome.promisedDocs.filter((doc) => doc.name && !doc.received).length;
  const followUpText = task
    ? `${getFollowUpUrgencyLabel(task.urgency)} · ${formatFollowUpMoment(task.date, task.time)} · ${getFollowUpChannelLabel(task.channel)}`
    : outcome.followUp.done
      ? `Follow-up выполнен ${formatDateTimeShort(outcome.followUp.doneAt)}`
      : "Следующий контакт не запланирован";

  return `
    <div class="call-outcome-strip">
      <span class="outcome-pill ${escapeHtml(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>
      <span class="outcome-pill ${escapeHtml(readiness.tone)}">${escapeHtml(readiness.label)}</span>
      <span class="outcome-pill ${task ? escapeHtml(task.urgency) : "neutral"}">${escapeHtml(followUpText)}</span>
      ${
        promisedDocsWaiting
          ? `<span class="outcome-pill warning">${promisedDocsWaiting} док. ждем</span>`
          : ""
      }
    </div>
  `;
}

function renderJournal() {
  const calls = getSortedCalls();
  const todayCalls = calls.filter((call) => isTodayValue(call.createdAt));
  const olderCalls = calls.filter((call) => !isTodayValue(call.createdAt));
  const calendarTasks = buildCalendarTasks();
  const groupedTasks = groupCalendarTasks(calendarTasks);

  const renderCallCard = (call) => {
    const activeClass = journalState.activeCallId === call.id ? "is-active" : "";
    const compatibility = getProgramCompatibility(call.route.purpose, call.route.program);
    const call1Progress = getCallProgress(call, 1);
    const call2Progress = getCallProgress(call, 2);
    const overallProgress = getOverallProgress(call);
    return `
      <article class="call-card ${activeClass}">
        <div class="call-card-head">
          <div>
            <h3>${escapeHtml(call.title || "Новая карточка")}</h3>
            <p class="call-card-copy">${escapeHtml(call.clientName || "ФИО клиента пока не указано")}</p>
            <p class="call-card-copy">${escapeHtml(call.callName || "Название звонка пока не указано")}</p>
          </div>
          <span class="call-stage-pill">${escapeHtml(getActiveStageLabel(call))}</span>
        </div>
        <div class="call-card-line">
          <span class="summary-chip">${escapeHtml(
            getRouteLabel("purpose", call.route.purpose) || "Цель не выбрана"
          )}</span>
          <span class="summary-chip">${escapeHtml(
            getRouteLabel("program", call.route.program) || "Программа не выбрана"
          )}</span>
          <span class="summary-chip">${escapeHtml(getCompatibilityLabel(compatibility.status))}</span>
          <span class="summary-chip">1-й: ${call1Progress.filled}/${call1Progress.total || 0}</span>
          <span class="summary-chip">2-й: ${call2Progress.filled}/${call2Progress.total || 0}</span>
        </div>
        ${renderJournalOutcomeSignals(call)}
        <div class="call-progress-inline">
          <div class="progress-meter-head">
            <span>Заполнено по карточке</span>
            <strong>${overallProgress.percent}%</strong>
          </div>
          <div class="progress-track" aria-hidden="true">
            <span style="width: ${overallProgress.percent}%"></span>
          </div>
        </div>
        <p class="call-card-copy">
          Создан: ${escapeHtml(formatDateTimeFull(call.createdAt))}. Последнее изменение:
          ${escapeHtml(formatDateTimeFull(call.updatedAt))}.
        </p>
        <div class="call-card-actions">
          <button class="action-button action-button-primary" data-journal-action="open" data-call-id="${call.id}" type="button">
            Открыть звонок
          </button>
          <button class="action-button" data-journal-action="export" data-call-id="${call.id}" type="button">
            CSV по звонку
          </button>
        </div>
      </article>
    `;
  };

  journalRoot.innerHTML = `
    <section class="journal-card">
      <div class="journal-head">
        <div>
          <p class="utility-label">Журнал звонков</p>
          <h2>Блокнот менеджера на день</h2>
          <p class="journal-copy">
            Здесь хранятся все звонки в браузере. Можно начать новую карточку,
            вернуться к незавершенной сделке и выгрузить данные в CSV.
          </p>
        </div>
        <div class="call-card-actions">
          <button class="action-button action-button-primary" data-journal-action="create" type="button">
            Создать звонок
          </button>
          <button class="action-button" data-journal-action="export_all" type="button">
            CSV по всем звонкам
          </button>
          <button class="action-button" data-journal-action="open_calendar" type="button">
            Календарь follow-up
          </button>
        </div>
      </div>

      <div class="journal-stat-row">
        <span class="summary-chip">${todayCalls.length} звонков за сегодня</span>
        <span class="summary-chip">${olderCalls.length} сохранено ранее</span>
        <span class="summary-chip">${calls.length} всего в журнале</span>
        <button class="summary-chip contradiction-summary-chip" data-journal-action="open_calendar" type="button">
          ${calendarTasks.length} follow-up
        </button>
        <span class="summary-chip">${groupedTasks.overdue.length} просрочено</span>
        <span class="summary-chip">${groupedTasks.today.length} сегодня</span>
      </div>

      <div class="journal-section">
        <div class="journal-section-head">
          <h3>Сегодня</h3>
          <p>Рабочие карточки, к которым менеджер возвращается в течение дня.</p>
        </div>
        ${
          todayCalls.length
            ? `<div class="call-list">${todayCalls.map((call) => renderCallCard(call)).join("")}</div>`
            : `
              <div class="journal-empty">
                На сегодня звонков пока нет. Создай первую карточку, и она сразу появится в журнале.
              </div>
            `
        }
      </div>

      ${
        olderCalls.length
          ? `
            <div class="journal-section">
              <div class="journal-section-head">
                <h3>Ранее сохраненные</h3>
                <p>История, которая уже не относится к текущему дню, но остается в браузере.</p>
              </div>
              <div class="call-list">${olderCalls.map((call) => renderCallCard(call)).join("")}</div>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderWorkspaceTopbar(
  precheckReady,
  precheckIssues,
  contradictions = groupContradictions([])
) {
  const activeCall = getActiveCall();
  if (!activeCall) {
    workspaceTopbar.innerHTML = "";
    workspaceShell.classList.add("hidden");
    return;
  }

  const blockerCount = precheckIssues.filter((item) => item.level === "blocker").length;
  const call1Progress = getCallProgress(activeCall, 1);
  const call2Progress = getCallProgress(activeCall, 2);
  const overallProgress = getOverallProgress(activeCall);
  const call2Disabled = activeCall.call2Enabled ? "" : "disabled";
  const outcome = normalizeOutcomeState(activeCall.outcome);
  const outcomeReadiness = getOutcomeReadiness(outcome);
  const followUpTask = buildFollowUpTaskFromCall(activeCall);

  workspaceShell.classList.remove("hidden");
  workspaceTopbar.innerHTML = `
    <section class="workspace-card">
      <div class="workspace-card-head">
        <div>
          <p class="utility-label">Карточка звонка</p>
          <h2>${escapeHtml(activeCall.title || "Новая карточка")}</h2>
        </div>
        <span class="call-stage-pill">${escapeHtml(getActiveStageLabel(activeCall))}</span>
      </div>

      <div class="workspace-meta-grid">
        <label class="meta-field">
          <span class="utility-label">Собственное название карточки</span>
          <input
            class="field-input"
            type="text"
            data-call-meta-key="title"
            value="${escapeHtml(activeCall.title || "")}"
            placeholder="Например: Ивановы · семейная · готовое жилье"
          />
        </label>
        <label class="meta-field">
          <span class="utility-label">ФИО клиента</span>
          <input
            class="field-input"
            type="text"
            data-call-meta-key="clientName"
            value="${escapeHtml(activeCall.clientName || "")}"
            placeholder="Иванов Иван Иванович"
          />
        </label>
        <label class="meta-field">
          <span class="utility-label">Название звонка</span>
          <input
            class="field-input"
            type="text"
            data-call-meta-key="callName"
            value="${escapeHtml(activeCall.callName || "")}"
            placeholder="Например: Первичный звонок / второй звонок по расчетам"
          />
        </label>
        <label class="meta-field">
          <span class="utility-label">Время создания</span>
          <input
            class="field-input field-input-date"
            type="text"
            inputmode="numeric"
            data-call-meta-key="createdAt"
            value="${escapeHtml(formatDateTimeForInput(activeCall.createdAt))}"
            placeholder="ДД.ММ.ГГГГ ЧЧ:ММ"
          />
        </label>
      </div>

      <div class="workspace-meta-row">
        <div class="workspace-stage-block">
          <p class="utility-label">Рабочий этап</p>
          <div class="stage-switcher">
            <button
              class="stage-button ${activeCall.activeStage === "call1" ? "is-active" : ""}"
              data-workspace-action="show_call1"
              type="button"
            >
              1-й звонок
            </button>
            <button
              class="stage-button ${activeCall.activeStage === "call2" ? "is-active" : ""}"
              data-workspace-action="show_call2"
              type="button"
              ${call2Disabled}
            >
              2-й звонок
            </button>
          </div>
        </div>

        <div class="workspace-stage-actions">
          ${
            !activeCall.call2Enabled
              ? `
                <button class="action-button action-button-primary" data-workspace-action="activate_call2" type="button">
                  Перейти ко второму звонку
                </button>
              `
              : ""
          }
          <button class="action-button" data-workspace-action="export" type="button">
            CSV по звонку
          </button>
          <button class="action-button" data-workspace-action="open_documents" type="button">
            Документы
          </button>
          <button class="action-button" data-workspace-action="open_calendar" type="button">
            Календарь
          </button>
          <button class="action-button action-button-primary" data-workspace-action="open_output" type="button">
            Показать вывод
          </button>
          <button class="action-button" data-workspace-action="close" type="button">
            К журналу
          </button>
        </div>
      </div>

      <div class="workspace-status-grid">
        <div class="journal-stat-row">
          <span class="summary-chip">${escapeHtml(formatDateTimeFull(activeCall.createdAt))} создан</span>
          <span class="summary-chip">${escapeHtml(formatDateTimeFull(activeCall.updatedAt))} обновлен</span>
          <span class="summary-chip">${blockerCount} блокеров pre-check</span>
          <button class="summary-chip contradiction-summary-chip" data-contradiction-action="focus_panel" type="button">
            ${contradictions.summary.total} противоречий
          </button>
          <span class="summary-chip">${precheckReady ? "Маршрут открыт" : "Маршрут закрыт"}</span>
          <span class="summary-chip">${escapeHtml(outcomeReadiness.label)}</span>
          <span class="summary-chip">${escapeHtml(
            followUpTask
              ? `${getFollowUpUrgencyLabel(followUpTask.urgency)} · ${formatFollowUpMoment(followUpTask.date, followUpTask.time)}`
              : "Follow-up не запланирован"
          )}</span>
          <span class="summary-chip">1-й: ${call1Progress.filled}/${call1Progress.total || 0}</span>
          <span class="summary-chip">2-й: ${call2Progress.filled}/${call2Progress.total || 0}</span>
        </div>

        <aside class="progress-card" aria-label="Прогресс заполнения карточки">
          <div class="progress-card-head">
            <span class="utility-label">Прогресс карточки</span>
            <strong>${overallProgress.percent}%</strong>
          </div>
          <div class="progress-track progress-track-main" aria-hidden="true">
            <span style="width: ${overallProgress.percent}%"></span>
          </div>
          <div class="progress-meter-list">
            ${renderProgressMeter("1-й звонок", overallProgress.call1)}
            ${renderProgressMeter("2-й звонок", overallProgress.call2, !activeCall.call2Enabled)}
          </div>
          <p class="progress-copy">
            ${
              activeCall.call2Enabled
                ? `Заполнено ${overallProgress.filled}/${overallProgress.total || 0} обязательных полей по открытым этапам.`
                : `Второй звонок пока не открыт, общий прогресс считается по 1-му звонку.`
            }
          </p>
        </aside>
      </div>
    </section>
  `;
}

function isGovernmentProgram(program) {
  return Boolean(program) && program !== "base";
}

function isHousePropertyType(state) {
  return ["house", "townhouse", "blocked_house"].includes(state.propertyType);
}

function isHousePrecheck(route, state) {
  if (route.purpose === "izhs" || route.purpose === "izhs_land") {
    return true;
  }
  return (
    (route.purpose === "ready" || route.purpose === "pledge" || route.purpose === "build") &&
    isHousePropertyType(state)
  );
}

function isPurchasedHousePrecheck(route, state) {
  return (route.purpose === "ready" || route.purpose === "pledge") && isHousePropertyType(state);
}

function hasLandPrecheck(route, state) {
  return route.purpose === "izhs" || route.purpose === "izhs_land" || isHousePrecheck(route, state);
}

function getActivePrecheckSections(route, state) {
  return precheckSections.filter((section) => section.applies(route, state));
}

function getPrecheckRequiredFieldKeys(route, state) {
  const keys = new Set();
  getActivePrecheckSections(route, state).forEach((section) => {
    section.fields.forEach((fieldKey) => {
      const field = fieldCatalog[fieldKey];
      if (!field) {
        return;
      }
      if (!isFieldVisible(field, route, state)) {
        return;
      }
      if (isFieldRequired(field, route, state)) {
        keys.add(fieldKey);
      }
    });
  });
  return Array.from(keys);
}

function computePrecheckIssues(route, state) {
  const issues = [];
  if (!route.purpose || !route.program) {
    return issues;
  }

  const compatibility = getProgramCompatibility(route.purpose, route.program);
  const familyProgram = route.program === "family" || route.program === "family_military";
  const militaryProgram = route.program === "military" || route.program === "family_military";

  if (compatibility.status === "blocked") {
    issues.push({
      level: "blocker",
      ruleId: getRouteCompatibilityRuleId(route.purpose, route.program),
      sectionId: "compatibility",
      title: "Программа не поддерживает выбранную цель",
      text: compatibility.reason,
      fields: ["routePurpose", "routeProgram"],
    });
  }

  if (compatibility.status === "conditional" && state.routeConditionalApproved === "no") {
    issues.push({
      level: "blocker",
      ruleId: getRouteCompatibilityRuleId(route.purpose, route.program),
      sectionId: "compatibility",
      title: "Условное сочетание не подтверждено",
      text: "Для этой связки нужен прямой допуск из паспорта продукта, иначе менеджер не должен начинать маршрут.",
      fields: ["routePurpose", "routeProgram", "routeConditionalApproved"],
    });
  }

  if (isGovernmentProgram(route.program) && state.programTargetGroupConfirmed === "no") {
    issues.push({
      level: "blocker",
      ruleId: "GOV-004",
      sectionId: "gov_common",
      title: "Клиент не входит в целевую группу программы",
      text: "Льготная программа должна отсекаться до графа, если заемщик не соответствует целевой группе продукта.",
      fields: ["programTargetGroupConfirmed"],
    });
  }

  if (isGovernmentProgram(route.program) && state.hasPriorGovMortgage === "yes") {
    const familyException =
      familyProgram &&
      state.newChildAfterPriorLoan === "yes" &&
      state.oldLoanClosed === "yes";
    if (!familyException) {
      issues.push({
        level: "blocker",
        ruleId: getPriorGovMortgageRuleId(route.program),
        sectionId: "gov_common",
        title: "Есть конфликт по прошлой льготной ипотеке",
        text: "После 23.12.2023 повторная льготная ипотека блокирует текущий сценарий, если не выполняется семейное исключение.",
        fields: ["hasPriorGovMortgage", "newChildAfterPriorLoan", "oldLoanClosed"],
      });
    }
  }

  if (familyProgram) {
    if (hasFilledValue(state.childrenCount) && Number(state.childrenCount || 0) === 0) {
      issues.push({
        level: "blocker",
        ruleId: "FAM-001",
        sectionId: "family_gate",
        title: "Нет подтвержденного семейного основания",
        text: "Семейную программу нельзя вести без детей или иного подтвержденного основания льготы.",
        fields: ["childrenCount"],
      });
    }
    if (state.familyBasis === "post2018" && state.childDob) {
      const childDate = parseDateInput(state.childDob);
      if (childDate && childDate < new Date(2018, 0, 1)) {
        issues.push({
          level: "blocker",
          ruleId: "FAM-003",
          sectionId: "family_gate",
          title: "Дата рождения ребенка не подходит под семейное основание",
          text: "Для выбранного основания нужен ребенок, рожденный после 01.01.2018.",
          fields: ["familyBasis", "childDob"],
        });
      }
    }
    if (
      route.program === "family" &&
      state.spouseRussianCitizen === "yes" &&
      state.spouseIncludedInDeal === "no"
    ) {
      issues.push({
        level: "blocker",
        ruleId: "FAM-002",
        sectionId: "family_gate",
        title: "Супруг(а) с гражданством РФ не включен(а) в сделку",
        text: "Это одна из самых жестких красных границ для семейной программы.",
        fields: ["spouseRussianCitizen", "spouseIncludedInDeal"],
      });
    }
  }

  if (route.program === "it") {
    if (state.itAgeCompliance === "no") {
      issues.push({
        level: "blocker",
        ruleId: "IT-001",
        sectionId: "it_gate",
        title: "Возраст не проходит по ИТ-программе",
        text: "Возраст заемщика должен соответствовать диапазону 21-50 лет.",
        fields: ["itAgeCompliance"],
      });
    }
    if (state.itMainJob === "no") {
      issues.push({
        level: "blocker",
        ruleId: "IT-002",
        sectionId: "it_gate",
        title: "Работа в ИТ не является основным местом",
        text: "ИТ-программа не должна идти дальше без основного места работы в ИТ-компании.",
        fields: ["itMainJob"],
      });
    }
    if (state.itEmployerAccredited === "no") {
      issues.push({
        level: "blocker",
        ruleId: "IT-003",
        sectionId: "it_gate",
        title: "Работодатель не аккредитован",
        text: "Без аккредитации работодателя ИТ-ветка должна останавливаться сразу.",
        fields: ["itEmployerAccredited"],
      });
    }
    if (state.itEmployerLocation === "moscow" || state.itEmployerLocation === "spb") {
      issues.push({
        level: "blocker",
        ruleId: "IT-004",
        sectionId: "it_gate",
        title: "Локация работодателя блокирует ИТ-программу",
        text: "Основное место работы в Москве или Санкт-Петербурге не проходит по текущей методологии.",
        fields: ["itEmployerLocation"],
      });
    }
    if (state.itIncomeCompliance === "no") {
      issues.push({
        level: "blocker",
        ruleId: "IT-005",
        sectionId: "it_gate",
        title: "Доход не соответствует требованиям продукта",
        text: "Если доход не проходит по паспорту продукта, менеджеру не нужно открывать основной граф.",
        fields: ["itIncomeCompliance"],
      });
    }
  }

  if (route.program === "dv") {
    if (state.purchaseRegion && state.purchaseRegion !== "dfo") {
      issues.push({
        level: "blocker",
        ruleId: "DVA-004",
        sectionId: "dv_gate",
        title: "Объект не находится в ДФО / Арктической зоне",
        text: "По check_metodic_v2.md объект ДВиАИ должен находиться в ДФО или Арктической зоне.",
        fields: ["purchaseRegion"],
      });
    }
    if (state.dvSpousePriorGovMortgage === "yes") {
      issues.push({
        level: "blocker",
        ruleId: "DVA-005",
        sectionId: "dv_gate",
        title: "У супруга есть конфликт по прошлой льготной ипотеке",
        text: "Для ДВиАИ правило отсутствия другой льготной ипотеки после 23.12.2023 распространяется также на супруга заемщика.",
        fields: ["dvSpousePriorGovMortgage"],
      });
    }
    if (state.dvCategory === "young_family" && state.dvAgeCompliance === "no") {
      issues.push({
        level: "blocker",
        ruleId: "DVA-002",
        sectionId: "dv_gate",
        title: "Возраст не проходит по категории молодой семьи",
        text: "Возрастной диапазон 21-36 нужно подтвердить до открытия маршрута.",
        fields: ["dvCategory", "dvAgeCompliance"],
      });
    }
    if (state.dvOwnershipStructureAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "DVA-003",
        sectionId: "dv_gate",
        title: "Структура собственников не соответствует категории",
        text: "По ДВиАИ неверная структура собственников является ранним стоп-фактором.",
        fields: ["dvOwnershipStructureAllowed"],
      });
    }
  }

  if (militaryProgram) {
    if (state.militaryAgeCompliance === "no") {
      issues.push({
        level: "blocker",
        ruleId: "MIL-001",
        sectionId: "military_gate",
        title: "Возраст не проходит по военной программе",
        text: "Военная программа требует допустимого возраста на момент полного погашения кредита.",
        fields: ["militaryAgeCompliance"],
      });
    }
    if (state.militaryNisConfirmed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "MIL-003",
        sectionId: "military_gate",
        title: "Не подтвержден статус участника НИС",
        text: "Без НИС менеджер не должен продолжать военную ветку.",
        fields: ["militaryNisConfirmed"],
      });
    }
    if (Number(state.militaryCoborrowersCount || 0) > 0) {
      issues.push({
        level: "blocker",
        ruleId: "MIL-004",
        sectionId: "military_gate",
        title: "Есть созаемщик в военной ветке",
        text: "Созаемщик блокирует стандартную военную схему.",
        fields: ["militaryCoborrowersCount"],
      });
    }
    if (state.otherPledgorPresent === "yes") {
      issues.push({
        level: "blocker",
        ruleId: "MIL-005",
        sectionId: "military_gate",
        title: "Есть иной залогодатель, кроме заемщика",
        text: "Военная схема допускает только заемщика как залогодателя.",
        fields: ["otherPledgorPresent"],
      });
    }
  }

  if (
    route.program === "family_military" &&
    state.familyStatus === "married" &&
    state.spouseRussianCitizen === "yes"
  ) {
    issues.push({
      level: "blocker",
      ruleId: "FMIL-001",
      sectionId: "family_military_gate",
      title: "Брачный режим блокирует семейную военную ветку",
      text: "Для этой программы брак с супругом(ой) с гражданством РФ не проходит по стандартной схеме.",
      fields: ["familyStatus", "spouseRussianCitizen"],
    });
  }

  if (route.purpose === "refi") {
    if (state.refiBorrowerLinkedToOld === "no") {
      issues.push({
        level: "blocker",
        ruleId: "REFI-001",
        sectionId: "refi_gate",
        title: "Новый заемщик не связан со старым кредитом",
        text: "Рефинанс без связи нового заемщика со старым кредитом не должен запускаться.",
        fields: ["refiBorrowerLinkedToOld"],
      });
    }
    if (state.refiBorrowerRemains === "no") {
      issues.push({
        level: "blocker",
        ruleId: "REFI-002",
        sectionId: "refi_gate",
        title: "В новой сделке не остается старый заемщик",
        text: "Хотя бы один участник старого кредита должен остаться в новой сделке.",
        fields: ["refiBorrowerRemains"],
      });
    }
    if (state.refiAllPledgorsRemain === "no") {
      issues.push({
        level: "blocker",
        ruleId: "REFI-003",
        sectionId: "refi_gate",
        title: "Старые залогодатели выпадают из новой сделки",
        text: "Это нарушает базовую логику правопреемства перекредитования.",
        fields: ["refiAllPledgorsRemain"],
      });
    }
    if (state.refiObjectSameAsOld === "no") {
      issues.push({
        level: "blocker",
        ruleId: "REFI-004",
        sectionId: "refi_gate",
        title: "Объект нового кредита не совпадает со старым",
        text: "Методология перекредитования требует идентичности объекта в старом и новом кредите.",
        fields: ["refiObjectSameAsOld"],
      });
    }
    if (state.refiPskAvailable === "no") {
      issues.push({
        level: "blocker",
        ruleId: "REFI-006",
        sectionId: "refi_gate",
        title: "Нет понимания по уведомлению о ПСК",
        text: "Без подтверждения ПСК менеджеру лучше не открывать рефинансную ветку.",
        fields: ["refiPskAvailable"],
      });
    }
  }

  if (route.purpose === "build" && state.sellerType === "individual" && state.buildRightsChainClear === "no") {
    issues.push({
      level: "blocker",
      ruleId: "BUILD-001",
      sectionId: "build_gate",
      title: "По стройке не подтверждена цепочка прав",
      text: "Продавец-физлицо без понятной цепочки прав должен блокировать старт ветки.",
      fields: ["sellerType", "buildRightsChainClear"],
    });
  }

  if (route.purpose === "build" && state.sellerType === "individual" && state.buildAssignmentDocsReady === "no") {
    issues.push({
      level: "blocker",
      ruleId: "BUILD-002",
      sectionId: "build_gate",
      title: "Не подтверждены документы по цепочке уступок",
      text: "Цепочка уступок должна быть подтверждена документами до старта ветки строящегося жилья.",
      fields: ["sellerType", "buildAssignmentDocsReady"],
    });
  }

  if (route.purpose === "build" && state.problemObject === "yes" && state.buildProblemDocsReady === "no") {
    issues.push({
      level: "blocker",
      ruleId: "BUILD-003",
      sectionId: "build_gate",
      title: "По проблемному объекту нет понятной документной логики",
      text: "Без понимания документов и обязанного лица менеджер не должен тратить время на полный граф.",
      fields: ["problemObject", "buildProblemDocsReady"],
    });
  }

  if (
    route.purpose === "build" &&
    state.buildCommissionedWithoutRights === "yes" &&
    state.buildCommissionPermitReady === "no"
  ) {
    issues.push({
      level: "blocker",
      ruleId: "BUILD-004",
      sectionId: "build_gate",
      title: "Нет документа по вводу объекта в эксплуатацию",
      text: "Если дом введен, но права еще не зарегистрированы, этот документ должен быть понятен заранее.",
      fields: ["buildCommissionedWithoutRights", "buildCommissionPermitReady"],
    });
  }

  if (route.purpose === "build" && state.buildBaseContractReady === "no") {
    issues.push({
      level: "blocker",
      ruleId: "BUILD-005",
      sectionId: "build_gate",
      title: "Не подтвержден базовый договор по строящемуся объекту",
      text: "Без базового договора или документа-основания строящийся объект не должен переходить в основной граф.",
      fields: ["buildBaseContractReady", "sellerOwnershipDoc"],
    });
  }

  if (hasLandPrecheck(route, state)) {
    if (state.landOwnershipAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-001",
        sectionId: "land_gate",
        title: "На участок не оформлено допустимое право",
        text: "Аренда или иной недопустимый титул по участку блокирует ветку.",
        fields: ["landOwnershipAllowed"],
      });
    }
    if (state.landRegionAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-007",
        sectionId: "land_gate",
        title: "Участок находится вне допустимой территории",
        text: "Объект по участку не проходит региональный или территориальный фильтр.",
        fields: ["landRegionAllowed"],
      });
    }
    if (Number(state.landArea || 0) > 4000) {
      issues.push({
        level: "blocker",
        ruleId: "LAND-002",
        sectionId: "land_gate",
        title: "Площадь участка больше допустимого порога",
        text: "По методологии площадь участка больше 4 000 кв. м должна останавливать сценарий.",
        fields: ["landArea"],
      });
    }
    if (state.landZoneAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-005",
        sectionId: "land_gate",
        title: "По участку есть запрещенные зоны или категории",
        text: "Запрещенные зоны и специальные категории земель блокируют кредитный сценарий.",
        fields: ["landZoneAllowed"],
      });
    }
    if (state.landUseAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-004",
        sectionId: "land_gate",
        title: "ВРИ или категория земли не позволяют законное жилье",
        text: "Если земля не допускает жилье по ВРИ или категории, граф не должен открываться.",
        fields: ["landUseAllowed"],
      });
    }
    if (state.landBoundariesKnown === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-003",
        sectionId: "land_gate",
        title: "Границы участка не установлены",
        text: "Это одна из самых жестких земельных красных границ.",
        fields: ["landBoundariesKnown"],
      });
    }
    if ((route.purpose === "izhs" || route.purpose === "izhs_land") && state.izhsNoExtraBuildings === "no") {
      issues.push({
        level: "blocker",
        ruleId: "LAND-006",
        sectionId: "land_gate",
        title: "На участке есть недопустимые капитальные строения",
        text: "Для ИЖС участок должен быть чистым с точки зрения допустимых объектов.",
        fields: ["izhsNoExtraBuildings"],
      });
    }
  }

  if (isHousePrecheck(route, state)) {
    if (state.houseTerritoryAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-009",
        sectionId: "house_gate",
        title: "Дом находится на недопустимой территории",
        text: "Дом должен находиться на допустимой территории по продуктовой методологии.",
        fields: ["houseTerritoryAllowed"],
      });
    }
    if (Number(state.houseBuiltYear || 0) > 0 && Number(state.houseBuiltYear) < 1990) {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-001",
        sectionId: "house_gate",
        title: "Дом слишком старый для сценария",
        text: "Год постройки ранее 1990 должен останавливать ветку по дому.",
        fields: ["houseBuiltYear"],
      });
    }
    if (isPurchasedHousePrecheck(route, state) && state.houseRightsRegistered === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-002",
        sectionId: "house_gate",
        title: "Нет зарегистрированного права собственности на дом",
        text: "При покупке дома отсутствие зарегистрированного права — ранний стоп-фактор.",
        fields: ["houseRightsRegistered"],
      });
    }
    if (state.houseYearRoundReady === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-003",
        sectionId: "house_gate",
        title: "Дом не пригоден для круглогодичного проживания",
        text: "Такой объект не должен проходить дальше в ипотечную ветку.",
        fields: ["houseYearRoundReady"],
      });
    }
    if (state.houseAllSeasonAccess === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-004",
        sectionId: "house_gate",
        title: "Нет круглогодичного доступа к дому",
        text: "Отсутствие круглогодичного доступа блокирует сценарий по дому.",
        fields: ["houseAllSeasonAccess"],
      });
    }
    if (Number(state.objectArea || 0) > 0 && (Number(state.objectArea) < 60 || Number(state.objectArea) > 345)) {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-005",
        sectionId: "house_gate",
        title: "Площадь дома вне допустимого диапазона",
        text: "Дом должен укладываться в диапазон 60-345 кв. м.",
        fields: ["objectArea"],
      });
    }
    if (state.houseStructureReady === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-008",
        sectionId: "house_gate",
        title: "Не подтверждены обязательные конструктивные элементы",
        text: "Без базового конструктива дом не должен проходить дальше по процессу.",
        fields: ["houseStructureReady"],
      });
    }
    if (state.foundationAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-007",
        sectionId: "house_gate",
        title: "Фундамент или конструктив не соответствуют правилам",
        text: "Недопустимый фундамент — это отдельная красная граница по дому.",
        fields: ["foundationAllowed"],
      });
    }
    if (state.houseCommunicationsReady === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-011",
        sectionId: "house_gate",
        title: "Коммуникации дома не соответствуют методологии",
        text: "Без допустимых коммуникаций дом не должен идти в кредитный маршрут.",
        fields: ["houseCommunicationsReady"],
      });
    }
    if (state.houseHeatingAllowed === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-012",
        sectionId: "house_gate",
        title: "Отопление дома только печное",
        text: "По check_metodic_v2.md отопление только печное является стоп-фактором по жилому дому.",
        fields: ["houseHeatingAllowed"],
      });
    }
    if (state.houseSanitaryReady === "no") {
      issues.push({
        level: "blocker",
        ruleId: "HOUSE-013",
        sectionId: "house_gate",
        title: "Не подтвержден санузел или условия для его устройства",
        text: "Это обязательный технический фильтр по дому.",
        fields: ["houseSanitaryReady"],
      });
    }
  }

  return issues;
}

function isPrecheckReady(route, state, precheckIssues, contradictions = groupContradictions([])) {
  if (!route.purpose || !route.program) {
    return false;
  }
  const requiredKeys = getPrecheckRequiredFieldKeys(route, state);
  const missingRequired = requiredKeys.some((fieldKey) => {
    const field = fieldCatalog[fieldKey];
    const value = state[fieldKey];
    const isEmpty =
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    return !field || isEmpty;
  });
  const hasBlockers = precheckIssues.some((item) => item.level === "blocker");
  const hasPrecheckContradictionBlockers = contradictions.precheck.some(
    (item) => item.severity === "blocker"
  );
  return !missingRequired && !hasBlockers && !hasPrecheckContradictionBlockers;
}

function getActiveNodes(route) {
  return nodes.filter((node) => {
    if (node.routePrograms && !node.routePrograms.includes(route.program)) {
      return false;
    }
    if (node.routePurposes && !node.routePurposes.includes(route.purpose)) {
      return false;
    }
    return true;
  });
}

function computeInsights(route, state) {
  const insights = [];
  const familyProgram = route.program === "family" || route.program === "family_military";
  const militaryProgram = route.program === "military" || route.program === "family_military";

  if (familyProgram) {
    const childrenCount = Number(state.childrenCount || 0);
    if (childrenCount === 0) {
      insights.push({
        level: "blocker",
        ruleId: "FAM-001",
        nodeId: route.program === "family" ? "program_family" : "program_family_military",
        title: "Семейная программа не подтверждена",
        text: "Для семейной программы не может быть `0` детей. Нужно проверить основание льготы или сменить программу.",
      });
    }
    if (state.familyBasis === "post2018" && state.childDob) {
      const childDate = parseDateInput(state.childDob);
      if (childDate && childDate < new Date(2018, 0, 1)) {
        insights.push({
          level: "blocker",
          ruleId: "FAM-003",
          nodeId: route.program === "family" ? "program_family" : "program_family_military",
          title: "Дата рождения не подходит под заявленное основание",
          text: "Для выбранного основания нужен ребенок с датой рождения после 01.01.2018.",
        });
      }
    }
    if (
      route.program === "family" &&
      state.spouseRussianCitizen === "yes" &&
      state.spouseIncludedInDeal === "no"
    ) {
      insights.push({
        level: "warning",
        ruleId: "FAM-002",
        nodeId: "program_family",
        title: "Проверьте участие супруга(и)",
        text: "По семейной методологии супруг(а) с гражданством РФ должен быть включен(а) в состав созаемщиков, если не действует исключение.",
      });
    }
  }

  if (route.program !== "base" && state.hasPriorGovMortgage === "yes") {
    const familyException =
      familyProgram &&
      state.newChildAfterPriorLoan === "yes" &&
      state.oldLoanClosed === "yes";
    insights.push({
      level: familyException ? "info" : "blocker",
      ruleId: familyException ? "GOV-003" : getPriorGovMortgageRuleId(route.program),
      nodeId:
        route.program === "family"
          ? "program_family"
          : route.program === "family_military"
            ? "program_family_military"
            : route.program === "it"
              ? "program_it"
              : route.program === "dv"
                ? "program_dv"
                : "program_military",
      title: familyException
        ? "Сработало исключение по прошлой льготной ипотеке"
        : "Прошлая льготная ипотека требует отдельной проверки",
      text: familyException
        ? "Отмечено, что после прошлого кредита появился новый ребенок и старый кредит погашен. Ветку можно продолжать, но документы нужно запросить."
        : "По госпрограммам прошлый льготный кредит после 23.12.2023 может блокировать текущий сценарий.",
    });
  }

  if (route.program === "it") {
    if (state.itMainJob === "no") {
      insights.push({
        level: "blocker",
        ruleId: "IT-002",
        nodeId: "program_it",
        title: "ИТ-программа не проходит по занятости",
        text: "Работа в ИТ-компании должна быть основным местом работы.",
      });
    }
    if (state.itEmployerAccredited === "no") {
      insights.push({
        level: "blocker",
        ruleId: "IT-003",
        nodeId: "program_it",
        title: "Нет подтверждения аккредитации работодателя",
        text: "До объекта нужно подтвердить, что работодатель проходит по условиям программы.",
      });
    }
    if (state.itAgeCompliance === "no") {
      insights.push({
        level: "blocker",
        ruleId: "IT-001",
        nodeId: "program_it",
        title: "Возраст не подтвержден",
        text: "Менеджер отметил, что возраст клиента не соответствует условиям программы.",
      });
    }
    if (state.itEmployerLocation === "moscow" || state.itEmployerLocation === "spb") {
      insights.push({
        level: "blocker",
        ruleId: "IT-004",
        nodeId: "program_it",
        title: "Локация работодателя конфликтует с ИТ-программой",
        text: "По методологии основное место работы по этой ветке не должно находиться в Москве или Санкт-Петербурге.",
      });
    }
    if (state.itIncomeCompliance === "no") {
      insights.push({
        level: "blocker",
        ruleId: "IT-005",
        nodeId: "program_it",
        title: "Доход не проходит по продукту",
        text: "ИТ-ветка требует проверить не только работодателя, но и порог дохода по паспорту продукта.",
      });
    }
  }

  if (route.program === "dv") {
    if (state.purchaseRegion && state.purchaseRegion !== "dfo") {
      insights.push({
        level: "blocker",
        ruleId: "DVA-004",
        nodeId: "program_dv",
        title: "Регион объекта не проходит ДВиАИ",
        text: "Для ДВиАИ объект должен находиться в ДФО или Арктической зоне.",
      });
    }
    if (state.dvSpousePriorGovMortgage === "yes") {
      insights.push({
        level: "blocker",
        ruleId: "DVA-005",
        nodeId: "program_dv",
        title: "У супруга есть прошлый льготный кредит",
        text: "В ДВиАИ правило одной льготной ипотеки распространяется также на супруга заемщика.",
      });
    }
    if (state.dvCategory === "young_family" && state.dvAgeCompliance === "no") {
      insights.push({
        level: "blocker",
        ruleId: "DVA-002",
        nodeId: "program_dv",
        title: "Возраст не проходит по категории молодой семьи",
        text: "Для категории молодой семьи нужно проверить возрастной диапазон всех обязательных участников.",
      });
    }
    if (state.dvOwnershipStructureAllowed === "no") {
      insights.push({
        level: "blocker",
        ruleId: "DVA-003",
        nodeId: "program_dv",
        title: "Структура собственников не соответствует категории",
        text: "Для ДВиАИ состав собственников зависит от категории клиента и должен быть подтвержден отдельно.",
      });
    }
  }

  if (militaryProgram) {
    if (state.militaryAgeCompliance === "no") {
      insights.push({
        level: "blocker",
        ruleId: "MIL-001",
        nodeId: route.program === "family_military" ? "program_family_military" : "program_military",
        title: "Возраст не соответствует военной программе",
        text: "Военная ветка требует отдельной проверки возраста на момент полного погашения кредита.",
      });
    }
    if (state.militaryNisConfirmed === "no") {
      insights.push({
        level: "blocker",
        ruleId: "MIL-003",
        nodeId: route.program === "family_military" ? "program_family_military" : "program_military",
        title: "Не подтвержден статус НИС",
        text: "Военная ветка не должна продолжаться без подтверждения участия в НИС.",
      });
    }
    if (Number(state.militaryCoborrowersCount || 0) > 0) {
      insights.push({
        level: "blocker",
        ruleId: "MIL-004",
        nodeId: route.program === "family_military" ? "program_family_military" : "program_military",
        title: "Созаемщики конфликтуют с военной веткой",
        text: "По методологии стандартная военная схема не допускает созаемщиков без отдельного согласования.",
      });
    }
    if (state.otherPledgorPresent === "yes") {
      insights.push({
        level: "blocker",
        ruleId: "MIL-005",
        nodeId: route.program === "family_military" ? "program_family_military" : "program_military",
        title: "Иной залогодатель конфликтует с военной веткой",
        text: "По военной методологии залогодателем может быть только сам заемщик.",
      });
    }
    if (
      route.program === "family_military" &&
      state.familyStatus === "married" &&
      state.spouseRussianCitizen !== "no"
    ) {
      insights.push({
        level: "blocker",
        ruleId: "FMIL-001",
        nodeId: "program_family_military",
        title: "Брачный режим конфликтует с семейной военной веткой",
        text: "Для семейной программы военнослужащих нужно отдельно проверить исключение по супругу без гражданства РФ; обычный брак с супругом-гражданином РФ блокирует стандартную схему.",
      });
    }
  }

  if (route.purpose === "build" && state.problemObject === "yes") {
    insights.push({
      level: "warning",
      nodeId: "purpose_build",
      title: "Нужен расширенный пакет по проблемному объекту",
      text: "В этой ветке понадобятся документы по банкротству застройщика или передаче обязательств.",
    });
  }

  if (route.purpose === "build" && state.sellerType === "individual") {
    insights.push({
      level: "warning",
      nodeId: "purpose_build",
      title: "Проверьте сценарий продавца-физлица",
      text: "Для стройки продавец-физлицо обычно означает уступку прав или нестандартный сценарий. Не потеряйте цепочку документов.",
    });
  }

  if (state.minorParticipants === "yes") {
    insights.push({
      level: "warning",
      nodeId: "call1_docs",
      title: "Нужен контроль по несовершеннолетним участникам",
      text: "Если в сделке есть несовершеннолетние, нужно проверить опеку и связанный документный пакет.",
    });
  }

  if (state.nonBorrowerPledgorPresent === "yes" && state.pledgorKinshipDocsReady === "no") {
    insights.push({
      level: "warning",
      nodeId: "client",
      title: "Нужны документы о родстве залогодателя",
      text: "Если залогодатель не является заемщиком, check_metodic_v2.md требует документы о родстве с заемщиком.",
    });
  }

  if ((route.purpose === "izhs" || route.purpose === "izhs_land") && state.landBoundariesKnown === "no") {
    insights.push({
      level: "blocker",
      ruleId: "LAND-003",
      nodeId: "purpose_izhs",
      title: "Не подтверждены границы участка",
      text: "Для ИЖС границы земельного участка должны быть установлены до перехода к сделке.",
    });
  }

  if ((route.purpose === "izhs" || route.purpose === "izhs_land") && state.foundationAllowed === "no") {
    insights.push({
      level: "blocker",
      ruleId: "HOUSE-007",
      nodeId: "purpose_izhs",
      title: "Есть риск по конструктиву дома",
      text: "Менеджер отметил, что фундамент или конструктив не проходят методологическую проверку.",
    });
  }

  if ((route.purpose === "izhs" || route.purpose === "izhs_land") && state.houseHeatingAllowed === "no") {
    insights.push({
      level: "blocker",
      ruleId: "HOUSE-012",
      nodeId: "purpose_izhs",
      title: "Отопление дома не проходит методологию",
      text: "Отопление только печного типа является стоп-фактором по жилому дому.",
    });
  }

  if ((route.purpose === "izhs" || route.purpose === "izhs_land") && state.contractorType === "self") {
    insights.push({
      level: "warning",
      nodeId: "purpose_izhs",
      title: "Сценарий со строительством своими силами требует отдельной проверки",
      text: "В реестре этот вариант не выглядит базовым и требует дополнительного решения по процессу.",
    });
  }

  if ((route.purpose === "izhs" || route.purpose === "izhs_land") && Number(state.landArea || 0) > 4000) {
    insights.push({
      level: "blocker",
      ruleId: "LAND-002",
      nodeId: "purpose_izhs",
      title: "Площадь участка выше допустимого порога",
      text: "По методологическим заметкам участок для этой ветки не должен превышать 4 000 кв. м.",
    });
  }

  if (
    (route.purpose === "izhs" || route.purpose === "izhs_land") &&
    Number(state.objectArea || 0) > 0 &&
    (Number(state.objectArea || 0) < 60 || Number(state.objectArea || 0) > 345)
  ) {
    insights.push({
      level: "warning",
      ruleId: "HOUSE-005",
      nodeId: "purpose_izhs",
      title: "Проверьте площадь жилого дома",
      text: "Для ИЖС методологические материалы фиксируют контрольный диапазон площади дома 60-345 кв. м.",
    });
  }

  if (route.purpose === "refi") {
    if (state.refiBorrowerLinkedToOld === "no") {
      insights.push({
        level: "blocker",
        ruleId: "REFI-001",
        nodeId: "call2_refi",
        title: "Новый заемщик не связан со старым кредитом",
        text: "Рефинанс должен сохранять правопреемство участников старого кредита.",
      });
    }
    if (state.refiPskAvailable === "no") {
      insights.push({
        level: "blocker",
        ruleId: "REFI-006",
        nodeId: "call2_refi",
        title: "Нет уведомления о ПСК",
        text: "Для рефинанса уведомление о полной стоимости кредита должно быть в пакете.",
      });
    }
    if (state.refiBorrowerRemains === "no") {
      insights.push({
        level: "blocker",
        ruleId: "REFI-002",
        nodeId: "call2_refi",
        title: "Не остается участника старого кредита",
        text: "В новой сделке должен сохраняться хотя бы один участник старого кредита.",
      });
    }
    if (state.refiAllPledgorsRemain === "no") {
      insights.push({
        level: "blocker",
        ruleId: "REFI-003",
        nodeId: "call2_refi",
        title: "Не все старые залогодатели переходят в новую сделку",
        text: "По check_metodic_v2.md все залогодатели по старому кредиту должны перейти в новую сделку.",
      });
    }
    if (state.refiObjectSameAsOld === "no") {
      insights.push({
        level: "blocker",
        ruleId: "REFI-004",
        nodeId: "call2_refi",
        title: "Объект нового кредита отличается от старого",
        text: "Для перекредитования объект в новом кредите должен быть идентичен объекту в старом.",
      });
    }
    if (Number(state.refiChainCount || 0) > 1) {
      insights.push({
        level: "info",
        nodeId: "call2_refi",
        title: "Есть цепочка перекредитований",
        text: "Нужно собрать документы по каждому звену цепочки и не потерять предшествующие договоры.",
      });
    }
  }

  if (state.sellerType === "company" && !state.sellerCompanyEmail) {
    insights.push({
      level: "warning",
      nodeId: route.purpose === "build" ? "purpose_build" : "purpose_ready",
      title: "Не заполнен email контактного лица продавца",
      text: "По реестру этот контакт важен для последующих юридических и платежных действий.",
    });
  }

  if (state.ownershipForm === "shared") {
    insights.push({
      level: "blocker",
      nodeId: "call2_legal",
      title: "Долевая собственность требует отдельного решения",
      text: "По заметкам реестра базовый продукт стандартизируется без работы с долевой собственностью.",
    });
  }

  if (state.subsidyName === "msk") {
    insights.push({
      level: "info",
      nodeId: "call2_payments",
      title: "Субсидия — материнский капитал",
      text: "Не забудьте про выписку из федерального регистра и логику ПВ с участием МСК.",
    });
  }

  if (
    (route.purpose === "izhs" || route.purpose === "izhs_land") &&
    state.paymentMethod === "accreditive" &&
    state.izhsLandInspectionActReady === "no"
  ) {
    insights.push({
      level: "blocker",
      nodeId: "call2_payments",
      title: "Нет акта осмотра участка при аккредитиве",
      text: "По check_metodic_v2.md для ИЖС при аккредитивной форме расчетов до выдачи нужен акт осмотра земельного участка.",
    });
  }

  if (state.specialAccountFlag === "escrow" && state.escrowOpened === "other_bank") {
    insights.push({
      level: "warning",
      nodeId: "call2_payments",
      title: "Эскроу открыт во внешнем банке",
      text: "Нужно заранее проверить маршрут расчетов и реквизиты, потому что счет открыт не в Банке ДОМ.РФ.",
    });
  }

  if (state.externalEscrow === "yes") {
    const requisitesReady =
      state.recipientAccountOwnerRole &&
      state.recipientAccountOwnerName &&
      state.recipientBank &&
      state.recipientSettlementAccount;
    if (!requisitesReady) {
      insights.push({
        level: "warning",
        nodeId: "call2_finish",
        title: "Не заполнены реквизиты получателя",
        text: "Если расчеты идут вне Банка ДОМ.РФ, нужны владелец счета, банк и расчетный счет получателя.",
      });
    }
  }

  const activeNodes = getActiveNodes(route);
  activeNodes.forEach((node) => {
    node.fields.forEach((fieldKey) => {
      const field = fieldCatalog[fieldKey];
      if (!field || field.kind === "route") {
        return;
      }
      if (!isFieldVisible(field, route, formState)) {
        return;
      }
      const validationMessage = validateField(field, formState[fieldKey], route, formState);
      if (validationMessage && touched[fieldKey]) {
        insights.push({
          level: "warning",
          nodeId: node.id,
          title: `Проверьте поле «${field.label}»`,
          text: validationMessage,
        });
      }
    });
  });

  return insights;
}

function getRule(ruleId) {
  return rulesRegistryById[ruleId] || null;
}

function signalLevelToSeverity(level) {
  if (level === "blocker") return "STOP";
  if (level === "warning" || level === "clarification") return "WARNING";
  return "INFO";
}

function signalSeverityToLevel(severity) {
  if (severity === "STOP" || severity === "BLOCK" || severity === "REQUIRED") {
    return "blocker";
  }
  if (severity === "WARNING" || severity === "POST_DEAL_REQUIRED" || severity === "REVIEW") {
    return "warning";
  }
  return "info";
}

function getDefaultRuleIdForField(fieldKey, fallbackPrefix = "UI") {
  const field = fieldCatalog[fieldKey];
  return field?.ruleId || `${fallbackPrefix}-${camelToSnake(fieldKey).toUpperCase()}`;
}

function buildSignal({
  id,
  type,
  severity,
  ruleId,
  title,
  message,
  fields = [],
  stage = "1_call",
  blocksFlow = false,
  source = METHODOLOGY_SOURCE,
  nodeId = "",
  sectionId = "",
}) {
  const rule = getRule(ruleId);
  return {
    id,
    type,
    severity,
    ruleId,
    title,
    message,
    text: message,
    fields,
    stage,
    blocksFlow: Boolean(blocksFlow || severity === "STOP" || severity === "BLOCK"),
    source: rule?.source || source,
    level: signalSeverityToLevel(severity),
    nodeId,
    sectionId,
  };
}

function getSignalStageFromCallType(callType) {
  return callType === 2 ? "2_call" : "1_call";
}

function getPrecheckSectionIdForField(route, state, fieldKey) {
  const section = getActivePrecheckSections(route, state).find((item) => item.fields.includes(fieldKey));
  return section?.id || "apics_identity_gate";
}

function computeMissingSignals(call) {
  if (!call?.route?.purpose || !call?.route?.program) {
    return [];
  }

  const signals = [];
  const seen = new Set();
  const addMissingField = (
    fieldKey,
    stage = "1_call",
    context = "Обязательное поле не заполнено",
    options = {}
  ) => {
    if (seen.has(`field:${fieldKey}:${stage}`)) {
      return;
    }
    const field = fieldCatalog[fieldKey];
    if (!field || !isFieldVisible(field, call.route, call.form)) {
      return;
    }
    const value =
      field.kind === "route"
        ? fieldKey === "routePurpose"
          ? call.route.purpose
          : call.route.program
        : call.form[fieldKey];
    if (isFieldValueFilled(field, value)) {
      return;
    }
    const softRequired = field.requiredMode === "soft_required";
    const hardRequired = field.requiredMode === "hard_required" || field.blocksGraph;
    const blocksFlow = Boolean(hardRequired || (!softRequired && (options.blocksFlow || stage === "2_call")));
    seen.add(`field:${fieldKey}:${stage}`);
    signals.push(
      buildSignal({
        id: `missing-${fieldKey}`,
        type: "missing",
        severity: blocksFlow ? "STOP" : "WARNING",
        ruleId: getDefaultRuleIdForField(fieldKey, "MISS"),
        title: `Пропуск: ${field.label}`,
        message: context,
        fields: [fieldKey],
        stage,
        blocksFlow,
        sectionId: options.sectionId || (stage === "1_call" ? "apics_identity_gate" : ""),
      })
    );
  };

  getPrecheckRequiredFieldKeys(call.route, call.form).forEach((fieldKey) => {
    addMissingField(fieldKey, "1_call", "Поле обязательно для pre-check и блокирует открытие графа.", {
      blocksFlow: true,
      sectionId: getPrecheckSectionIdForField(call.route, call.form, fieldKey),
    });
  });

  const nodesForStage = getVisibleNodesForStage(getActiveNodes(call.route), call);
  nodesForStage.forEach((node) => {
    node.fields.forEach((fieldKey) => {
      const field = fieldCatalog[fieldKey];
      if (!field || field.kind === "route" || !isFieldRequired(field, call.route, call.form)) {
        return;
      }
      addMissingField(
        fieldKey,
        getSignalStageFromCallType(field.callType || node.callType),
        "Поле обязательно для текущего этапа звонка."
      );
    });
  });

  getVisibleDocumentSections(call, { ignoreFilters: true }).forEach((section) => {
    section.items.forEach((item) => {
      if (!isDocumentItemRequired(call, item) || isDocumentChecked(call, item.id)) {
        return;
      }
      signals.push(
        buildSignal({
          id: `missing-doc-${item.id}`,
          type: "missing",
          severity: item.critical ? "STOP" : "WARNING",
          ruleId: item.ruleId || "DOC-BASE-001",
          title: `Документ не закрыт: ${item.title}`,
          message: `Секция: ${section.title}.`,
          fields: [],
          stage: section.stage === "call2" ? "2_call" : section.stage === "post" ? "post" : "1_call",
          blocksFlow: Boolean(item.critical),
        })
      );
    });
  });

  if (
    call.route.program === "dv" &&
    call.form.dvPostRegistrationRequired === "yes" &&
    call.form.dvPostRegistrationAcknowledged !== "yes"
  ) {
    signals.push(
      buildSignal({
        id: "kd-dv-post-registration",
        type: "missing",
        severity: "POST_DEAL_REQUIRED",
        ruleId: "DVA-006",
        title: "ДВиАИ: пост-сделочная регистрация",
        message: "Обязательство регистрации после сделки нужно подтвердить и держать в follow-up.",
        fields: ["dvPostRegistrationRequired", "dvPostRegistrationAcknowledged"],
        stage: "2_call",
        blocksFlow: false,
      })
    );
  }

  validateOutcome(call.outcome).issues.forEach((issue) => {
    signals.push(
      buildSignal({
        id: `missing-outcome-${issue.field}`,
        type: issue.field.includes("date") || issue.field.includes("time") ? "validation" : "missing",
        severity: "WARNING",
        ruleId: "KD-002",
        title: "Итог звонка требует дозаполнения",
        message: issue.message,
        fields: [issue.field],
        stage: "call_flow",
      })
    );
  });

  return signals;
}

function computeValidationSignals(call) {
  if (!call?.route?.purpose || !call?.route?.program) {
    return [];
  }
  const signals = [];
  const fieldKeys = new Set();
  getActivePrecheckSections(call.route, call.form).forEach((section) => {
    section.fields.forEach((fieldKey) => fieldKeys.add(fieldKey));
  });
  getActiveNodes(call.route).forEach((node) => {
    node.fields.forEach((fieldKey) => fieldKeys.add(fieldKey));
  });

  fieldKeys.forEach((fieldKey) => {
    const field = fieldCatalog[fieldKey];
    if (!field || field.kind === "route" || !call.touched?.[fieldKey]) {
      return;
    }
    const message = validateField(field, call.form[fieldKey], call.route, call.form);
    if (!message) {
      return;
    }
    signals.push(
      buildSignal({
        id: `validation-${fieldKey}`,
        type: "validation",
        severity: "WARNING",
        ruleId: getDefaultRuleIdForField(fieldKey, "VAL"),
        title: `Валидация: ${field.label}`,
        message,
        fields: [fieldKey],
        stage: getSignalStageFromCallType(field.callType || 1),
      })
    );
  });

  return signals;
}

function getContradictionRuleId(item) {
  const byId = {
    route_program_blocked: "GOV-002",
    route_conditional_not_approved: "GOV-002",
    program_target_group_rejected: "GOV-004",
    family_children_zero: "FAM-001",
    family_child_date_before_2018: "FAM-003",
    family_spouse_not_included: "FAM-002",
    representative_without_name: "PART-001",
    non_borrower_pledgor_without_kinship_docs: "PART-003",
    minor_without_guardianship_status: "PART-004",
    children_docs_not_marked: "DOC-BASE-004",
    external_payments_without_requisites: "KD-010",
    izhs_accreditive_without_inspection_act: "IZHS-007",
  };
  return item.ruleId || byId[item.id] || "GOV-001";
}

function computeParticipantSignals(call) {
  const participants = getCallParticipants(call);
  const signals = [];
  participants.forEach((participant, index) => {
    const label = participant.fullName || `Участник ${index + 1}`;
    if (participant.role === "coborrower" && !participant.participatesInCalculation) {
      signals.push(
        buildSignal({
          id: `participant-calc-${participant.id}`,
          type: "missing",
          severity: "WARNING",
          ruleId: "PART-001",
          title: "Созаемщик без признака расчета дохода",
          message: `${label}: укажите, участвует ли созаемщик в расчете дохода.`,
          fields: ["dealParticipants"],
        })
      );
    }
    if (participant.role === "pledgor" && !participant.isPledgor) {
      signals.push(
        buildSignal({
          id: `participant-pledge-${participant.id}`,
          type: "missing",
          severity: "WARNING",
          ruleId: "PART-002",
          title: "Залогодатель без признака залогодателя",
          message: `${label}: отметьте роль залогодателя в карточке участника.`,
          fields: ["dealParticipants"],
        })
      );
    }
    if (participant.isPledgor && participant.role !== "borrower" && !participant.docs.kinshipDocs) {
      signals.push(
        buildSignal({
          id: `participant-kinship-${participant.id}`,
          type: "missing",
          severity: "WARNING",
          ruleId: "PART-003",
          title: "Нет документов о родстве залогодателя",
          message: `${label}: отметьте документы о родстве или уточните состав сделки.`,
          fields: ["dealParticipants"],
        })
      );
    }
    if (participant.isMinor && !participant.docs.guardianshipPermission) {
      signals.push(
        buildSignal({
          id: `participant-guardianship-${participant.id}`,
          type: "missing",
          severity: "STOP",
          ruleId: "PART-004",
          title: "Несовершеннолетний без опеки",
          message: `${label}: для несовершеннолетнего участника нужна отметка по разрешению опеки.`,
          fields: ["dealParticipants"],
          blocksFlow: true,
        })
      );
    }
  });
  return signals;
}

function computeDealReleaseSignals(call) {
  if (!call?.call2Enabled && call?.activeStage !== "call2") {
    return [];
  }
  const state = call.form || {};
  const signals = [];
  const add = (config) => signals.push(buildSignal({ stage: "2_call", ...config }));

  if (state.ownershipForm === "shared") {
    add({
      id: "kd-ownership-shared",
      type: "validation",
      severity: "WARNING",
      ruleId: "KD-001",
      title: "КД: нестандартная форма собственности",
      message: "Долевая собственность требует отдельной проверки перед выпуском документов.",
      fields: ["ownershipForm"],
    });
  }
  if (!state.paymentMethod) {
    add({
      id: "kd-payment-method-missing",
      type: "missing",
      severity: "STOP",
      ruleId: "KD-002",
      title: "КД: не выбран способ расчетов",
      message: "Для второго звонка способ расчетов обязателен.",
      fields: ["paymentMethod"],
      blocksFlow: true,
    });
  }
  if (call.route.purpose === "refi" && state.refiPskAvailable === "no") {
    add({
      id: "kd-refi-psk",
      type: "contradiction",
      severity: "STOP",
      ruleId: "REFI-006",
      title: "КД: нет ПСК по рефинансированию",
      message: "Уведомление о ПСК является STOP для refi.",
      fields: ["refiPskAvailable"],
      blocksFlow: true,
    });
  }
  if (!state.clientIdentificationMethod) {
    add({
      id: "kd-client-id-missing",
      type: "missing",
      severity: "STOP",
      ruleId: "KD-004",
      title: "КД: не выбран способ идентификации",
      message: "Способ идентификации обязателен перед выпуском документов.",
      fields: ["clientIdentificationMethod"],
      blocksFlow: true,
    });
  }
  if (!state.contractConclusionLocation) {
    add({
      id: "kd-contract-location-missing",
      type: "missing",
      severity: "STOP",
      ruleId: "KD-005",
      title: "КД: не заполнено место заключения договора",
      message: "Место заключения договора обязательно перед выпуском документов.",
      fields: ["contractConclusionLocation"],
      blocksFlow: true,
    });
  }
  if (state.sellerType === "company" && !state.sellerCompanyEmail) {
    add({
      id: "kd-seller-email-missing",
      type: "missing",
      severity: "STOP",
      ruleId: "KD-006",
      title: "КД: нет email продавца ЮЛ",
      message: "Email контактного лица продавца ЮЛ обязателен перед выпуском документов.",
      fields: ["sellerCompanyEmail"],
      blocksFlow: true,
    });
  }
  if (state.useRateDiscount === "yes" && !state.rateReductionPeriod && !state.finalRateReductionPeriod) {
    add({
      id: "kd-rate-period-missing",
      type: "missing",
      severity: "STOP",
      ruleId: "KD-008",
      title: "КД: нет срока снижения ставки",
      message: "При снижении ставки нужно указать период снижения.",
      fields: ["rateReductionPeriod", "finalRateReductionPeriod"],
      blocksFlow: true,
    });
  }
  if (
    call.route.program === "dv" &&
    state.dvPostRegistrationRequired === "yes" &&
    state.dvPostRegistrationAcknowledged !== "yes"
  ) {
    add({
      id: "kd-dv-post-registration",
      type: "missing",
      severity: "POST_DEAL_REQUIRED",
      ruleId: "DVA-006",
      title: "ДВиАИ: пост-сделочная регистрация",
      message: "Обязательство регистрации после сделки нужно подтвердить и держать в follow-up.",
      fields: ["dvPostRegistrationRequired", "dvPostRegistrationAcknowledged"],
    });
  }
  if (state.externalEscrow === "yes") {
    const missingRequisites = [
      "recipientAccountOwnerRole",
      "recipientAccountOwnerName",
      "recipientBank",
      "recipientSettlementAccount",
    ].filter((fieldKey) => !state[fieldKey]);
    if (missingRequisites.length) {
      add({
        id: "kd-external-requisites",
        type: "missing",
        severity: "STOP",
        ruleId: "KD-010",
        title: "КД: внешние расчеты без реквизитов",
        message: "Заполните владельца счета, банк и расчетный счет получателя.",
        fields: missingRequisites,
        blocksFlow: true,
      });
    }
  }

  return signals;
}

function computeContradictionSignals(call, precheckIssues, contradictions, insights) {
  const signals = [];
  precheckIssues.forEach((item) => {
    signals.push(
      buildSignal({
        id: `precheck-${item.ruleId || item.title}`,
        type: "contradiction",
        severity: signalLevelToSeverity(item.level),
        ruleId: item.ruleId || "GOV-001",
        title: item.title,
        message: item.text,
        fields: item.fields || [],
        stage: "1_call",
        blocksFlow: item.level === "blocker",
        sectionId: item.sectionId || "",
      })
    );
  });
  contradictions.all.forEach((item) => {
    signals.push(
      buildSignal({
        id: `contradiction-${item.id}`,
        type: "contradiction",
        severity: signalLevelToSeverity(item.severity),
        ruleId: getContradictionRuleId(item),
        title: item.title,
        message: item.reason,
        fields: item.fields || [],
        stage: item.stage === "call2" ? "2_call" : "1_call",
        blocksFlow: item.blocksFlow,
        nodeId: item.nodeId || "",
        sectionId: item.sectionId || "",
      })
    );
  });
  insights.forEach((item, index) => {
    const isInfo = item.level === "info";
    signals.push(
      buildSignal({
        id: `insight-${item.nodeId || "global"}-${index}`,
        type: isInfo ? "info" : "contradiction",
        severity: signalLevelToSeverity(item.level),
        ruleId: item.ruleId || "GOV-001",
        title: item.title,
        message: item.text,
        fields: item.fields || [],
        stage: "1_call",
        blocksFlow: !isInfo && item.level === "blocker",
        nodeId: item.nodeId || "",
      })
    );
  });
  return signals;
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = `${signal.type}:${signal.ruleId}:${signal.id}:${signal.fields.join(",")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function computeAllSignals(call, context = {}) {
  if (!call) {
    return [];
  }
  const precheckIssues = context.precheckIssues || computePrecheckIssues(call.route, call.form);
  const contradictions = context.contradictions || getContradictions(call.route, call.form, call);
  const insights = context.insights || computeInsights(call.route, call.form);
  return dedupeSignals([
    ...computeMissingSignals(call),
    ...computeValidationSignals(call),
    ...computeContradictionSignals(call, precheckIssues, contradictions, insights),
    ...computeParticipantSignals(call),
    ...computeDealReleaseSignals(call),
  ]);
}

function summarizeSignals(signals) {
  return {
    missing: signals.filter((signal) => signal.type === "missing").length,
    validation: signals.filter((signal) => signal.type === "validation").length,
    contradiction: signals.filter((signal) => signal.type === "contradiction").length,
    info: signals.filter((signal) => signal.type === "info").length,
    stop: signals.filter((signal) => signal.severity === "STOP" || signal.blocksFlow).length,
    postDeal: signals.filter((signal) => signal.severity === "POST_DEAL_REQUIRED").length,
  };
}

function computeDealReleaseReadiness(call, signals = computeAllSignals(call)) {
  const call2Signals = signals.filter((signal) => signal.stage === "2_call");
  const stopCount = call2Signals.filter((signal) => signal.blocksFlow || signal.severity === "STOP").length;
  const missingCount = call2Signals.filter((signal) => signal.type === "missing").length;
  const postDealCount = call2Signals.filter((signal) => signal.severity === "POST_DEAL_REQUIRED").length;
  if (!call?.call2Enabled) {
    return { label: "КД: 2-й звонок не открыт", tone: "neutral", stopCount, missingCount, postDealCount };
  }
  if (stopCount) {
    return { label: `КД: ${stopCount} блокеров`, tone: "danger", stopCount, missingCount, postDealCount };
  }
  if (missingCount) {
    return { label: `КД: ${missingCount} пропусков`, tone: "warning", stopCount, missingCount, postDealCount };
  }
  if (postDealCount) {
    return { label: `КД: ${postDealCount} post-deal`, tone: "warning", stopCount, missingCount, postDealCount };
  }
  return { label: "КД: готово к выпуску", tone: "success", stopCount, missingCount, postDealCount };
}

function renderPickers() {
  if (!getActiveCall()) {
    purposePicker.innerHTML = "";
    programPicker.innerHTML = "";
    return;
  }

  purposePicker.innerHTML = routeOptions.purpose
    .map((item) => {
      const active = routeState.purpose === item.value ? "is-active" : "";
      return `<button class="choice-chip ${active}" data-route-kind="purpose" data-route-value="${item.value}" type="button">${item.label}</button>`;
    })
    .join("");

  if (!routeState.purpose) {
    programPicker.innerHTML = `
      <div class="program-empty">
        Сначала выберите цель кредита. После этого система покажет доступные, условные и заблокированные программы с причинами.
      </div>
    `;
  } else {
    programPicker.innerHTML = routeOptions.program
      .map((item) => {
        const compatibility = getProgramCompatibility(routeState.purpose, item.value);
        const active = routeState.program === item.value ? "is-active" : "";
        const disabled = compatibility.status === "blocked" ? "disabled" : "";
        return `
          <button
            class="program-card ${compatibility.status} ${active}"
            data-route-kind="program"
            data-route-value="${item.value}"
            type="button"
            ${disabled}
          >
            <span class="program-title">${item.label}</span>
            <span class="program-status">${getCompatibilityLabel(compatibility.status)}</span>
            <span class="program-reason">${compatibility.reason}</span>
          </button>
        `;
      })
      .join("");
  }

  document.querySelectorAll("[data-route-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const activeCall = getActiveCall();
      const previousPurpose = routeState.purpose;
      const previousProgram = routeState.program;
      if (button.dataset.routeKind === "purpose") {
        routeState.purpose = button.dataset.routeValue;
        const currentCompatibility = getProgramCompatibility(routeState.purpose, routeState.program);
        if (currentCompatibility.status === "blocked") {
          routeState.program = "";
        }
      } else {
        const compatibility = getProgramCompatibility(routeState.purpose, button.dataset.routeValue);
        if (compatibility.status === "blocked") {
          return;
        }
        routeState.program = button.dataset.routeValue;
      }
      if (activeCall && (previousPurpose !== routeState.purpose || previousProgram !== routeState.program)) {
        activeCall.call2Enabled = false;
        activeCall.activeStage = "call1";
      }
      touchActiveCall();
      renderApp({ viewState: captureViewState(button) });
    });
  });
}

function renderPrecheck(precheckSectionsToRender, precheckIssues, precheckReady, contradictions) {
  if (!routeState.purpose) {
    precheckRoot.innerHTML = `
      <section class="precheck-card">
        <div class="precheck-head">
          <span class="section-kicker bridge">pre-check</span>
          <h3>Красные границы появятся после выбора цели кредита</h3>
          <p>Сначала выбери цель. Затем блокнот сам отфильтрует программы и откроет обязательную отсечку до звонка.</p>
        </div>
      </section>
    `;
    return;
  }

  if (!routeState.program) {
    precheckRoot.innerHTML = `
      <section class="precheck-card">
        <div class="precheck-head">
          <span class="section-kicker bridge">pre-check</span>
          <h3>Выберите программу после цели кредита</h3>
          <p>Пока программа не выбрана, основной граф не откроется. Уже сейчас можно смотреть причины блокировки на карточках программ выше.</p>
        </div>
      </section>
    `;
    return;
  }

  const blockers = precheckIssues.filter((item) => item.level === "blocker");
  const warnings = precheckIssues.filter((item) => item.level === "warning");
  const contradictionBlockers = contradictions.precheck.filter(
    (item) => item.severity === "blocker"
  );
  precheckRoot.innerHTML = `
    <section class="precheck-card">
      <div class="precheck-head">
        <span class="section-kicker bridge">pre-check</span>
        <h3>Полная методологическая отсечка до запуска звонка</h3>
        <p>
          Этот слой собирает все красные границы до старта рабочего графа:
          совместимость цели и программы, продуктовые ограничения, рефинанс,
          землю, дом и объектные риски.
        </p>
      </div>
      <div class="precheck-status-row">
        <span class="summary-chip">${blockers.length} блокеров pre-check</span>
        <button class="summary-chip contradiction-summary-chip" data-contradiction-action="focus_panel" type="button">
          ${contradictionBlockers.length} конфликтов pre-check
        </button>
        <span class="summary-chip">${warnings.length} предупреждений pre-check</span>
        <span class="summary-chip">${precheckReady ? "Граф разблокирован" : "Граф заблокирован"}</span>
      </div>
      <div class="precheck-grid">
        ${precheckSectionsToRender
          .map((section) => renderPrecheckSection(section, precheckIssues, contradictions))
          .join("")}
      </div>
    </section>
  `;
}

function renderPrecheckSection(section, precheckIssues, contradictions) {
  const sectionIssues = precheckIssues.filter((item) => item.sectionId === section.id);
  const sectionContradictions = contradictions.bySectionId[section.id] || [];
  const sectionFields = section.fields.map((fieldKey) => renderField(fieldKey)).filter(Boolean).join("");
  return `
    <article class="precheck-section" data-precheck-section-id="${escapeHtml(section.id)}">
      <div class="precheck-section-head">
        <h4>${section.title}</h4>
        <p>${section.description}</p>
      </div>
      ${renderNodeBanners(sectionIssues)}
      ${renderContradictionBanners(sectionContradictions)}
      ${sectionFields ? `<div class="field-grid">${sectionFields}</div>` : ""}
      <div class="precheck-redlines">
        <h5>Что блокирует ветку</h5>
        <ul class="regulatory-list">
          ${section.redlines.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </article>
  `;
}

function renderLockedGraph(
  precheckIssues,
  missingFields,
  contradictions = groupContradictions([])
) {
  if (!routeState.purpose || !routeState.program) {
    return `
      <article class="node-card locked-card">
        <div class="node-shell">
          <div class="node-index">!</div>
          <div class="node-body">
            <div class="node-head">
              <span class="section-kicker bridge">маршрут</span>
              <h3>Сначала выберите цель кредита и программу</h3>
              <p>
                Блокнот откроет граф звонка только после выбора маршрута и
                прохождения методологической отсечки. Это защищает менеджера от
                старта по заведомо неверной ветке.
              </p>
            </div>
          </div>
        </div>
      </article>
    `;
  }
  const blockerCount =
    precheckIssues.filter((item) => item.level === "blocker").length +
    contradictions.precheck.filter((item) => item.severity === "blocker").length;
  const missingList = missingFields
    .map((fieldKey) => fieldCatalog[fieldKey]?.label)
    .filter(Boolean)
    .map((label) => `<li>${escapeHtml(label)}</li>`)
    .join("");
  return `
    <article class="node-card locked-card">
      <div class="node-shell">
        <div class="node-index">!</div>
        <div class="node-body">
          <div class="node-head">
            <span class="section-kicker bridge">стоп</span>
            <h3>Основной граф пока закрыт</h3>
            <p>
              Блокнот не открывает 1-й и 2-й звонок, пока не сняты красные
              границы по маршруту. Это защищает менеджера от пустых действий на
              заведомо неверной ветке.
            </p>
          </div>
          <div class="node-banner-list">
            <div class="node-banner blocker">
              <strong>Текущий статус</strong>
              Найдено ${blockerCount} блокирующих сигнала и ${missingFields.length} незаполненных обязательных вопроса pre-check.
            </div>
          </div>
          ${
            missingFields.length
              ? `
                <section class="completion-block">
                  <h4>Что еще нужно заполнить до старта графа</h4>
                  <ul class="completion-list">${missingList}</ul>
                </section>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderRouteSummary(
  activeNodes,
  visibleNodes,
  insights,
  precheckIssues,
  precheckReady,
  contradictions,
  signals = []
) {
  const activeCall = getActiveCall();
  const blockers = insights.filter((item) => item.level === "blocker").length;
  const warnings = insights.filter((item) => item.level === "warning").length;
  const signalSummary = summarizeSignals(signals);
  const dealReadiness = activeCall ? computeDealReleaseReadiness(activeCall, signals) : null;
  const compatibility = getProgramCompatibility(routeState.purpose, routeState.program);
  const contradictionLabel = contradictions.summary.blockers
    ? `${contradictions.summary.blockers} критичных конфликтов`
    : `${contradictions.summary.total} противоречий`;
  routeSummary.innerHTML = `
    <span class="summary-label">Текущая ветка</span>
    <div class="summary-line">
      <span class="summary-chip">${getRouteLabel("purpose", routeState.purpose) || "Цель не выбрана"}</span>
      <span class="summary-chip">${getRouteLabel("program", routeState.program) || "Программа не выбрана"}</span>
      <span class="summary-chip">${getCompatibilityLabel(compatibility.status)}</span>
      <span class="summary-chip">${activeCall ? getActiveStageLabel(activeCall) : "Звонок не выбран"}</span>
      <span class="summary-chip">${precheckIssues.filter((item) => item.level === "blocker").length} блокеров pre-check</span>
      <span class="summary-chip">${precheckReady ? "Маршрут открыт" : "Маршрут закрыт"}</span>
      <span class="summary-chip">${activeNodes.filter((node) => node.callType === 1).length} узл. 1-го звонка</span>
      <span class="summary-chip">${activeNodes.filter((node) => node.callType === 2).length} узл. 2-го звонка</span>
      <span class="summary-chip">${visibleNodes.length} узл. в текущем экране</span>
      <span class="summary-chip">${blockers} блокирующих сигнала</span>
      <span class="summary-chip">${warnings} предупреждений</span>
      <span class="summary-chip">${signalSummary.missing} пропусков</span>
      <span class="summary-chip">${signalSummary.validation} валидаций</span>
      <span class="summary-chip">${signalSummary.contradiction} противоречий</span>
      ${dealReadiness ? `<span class="summary-chip">${escapeHtml(dealReadiness.label)}</span>` : ""}
      <button class="summary-chip contradiction-summary-chip" data-contradiction-action="focus_panel" type="button">
        ${contradictionLabel}
      </button>
    </div>
    <p class="summary-copy">
      Сначала блокнот отрабатывает полную отсечку по красным границам. После
      этого менеджер ведет отдельно 1-й и 2-й звонок и может хранить сделку в
      состоянии только первого звонка до нужного момента.
    </p>
  `;
}

function renderNode(node, index, insights, contradictions) {
  const nodeInsights = insights.filter((item) => item.nodeId === node.id);
  const nodeContradictions = contradictions.byNodeId[node.id] || [];
  return `
    <article class="node-card" data-node-id="${escapeHtml(node.id)}">
      <div class="node-shell">
        <div class="node-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="node-body">
          <div class="node-head">
            <span class="section-kicker ${node.badge}">${node.callType === 1 ? "1-й звонок" : node.callType === 2 ? "2-й звонок" : "Переход"}</span>
            <h3>${node.title}</h3>
            <p>${node.description}</p>
          </div>

          ${renderNodeBanners(nodeInsights)}
          ${renderContradictionBanners(nodeContradictions)}

          <div class="field-grid">
            ${node.fields
              .map((fieldKey) => renderField(fieldKey))
              .filter(Boolean)
              .join("")}
          </div>

          ${uiState.detailMode ? renderDetailBlock(node.why) : ""}
          ${uiState.questionMode ? renderQuestionBlock(node.questions) : ""}
          ${renderRegulatoryBlock(node.regulatory)}
          ${renderCompletionBlock(node.completion)}
        </div>
      </div>
    </article>
  `;
}

function renderNodeBanners(items) {
  if (!items.length) {
    return "";
  }
  return `
    <div class="node-banner-list">
      ${items
        .map(
          (item) => `
            <div class="node-banner ${item.level}">
              <strong>${item.title}</strong>
              ${item.text}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDetailBlock(text) {
  return `
    <section class="toggle-block">
      <h4>Зачем собираем этот блок</h4>
      <p class="field-detail">${text}</p>
    </section>
  `;
}

function renderQuestionBlock(items) {
  return `
    <section class="question-block">
      <h4>Примеры вопросов клиенту</h4>
      <ul class="question-list">
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderRegulatoryBlock(items) {
  return `
    <section class="regulatory-block">
      <h4>Регуляторные и методологические акценты</h4>
      <ul class="regulatory-list">
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderCompletionBlock(items) {
  return `
    <section class="completion-block">
      <h4>Чтобы идти дальше</h4>
      <ul class="completion-list">
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </section>
  `;
}

function getVisibleNodesForStage(activeNodes, activeCall) {
  return activeNodes.filter((node) => node.callType === getActiveStageNumber(activeCall));
}

function renderStageBridge(activeCall, activeNodes) {
  if (!activeCall) {
    return "";
  }

  const call1Count = activeNodes.filter((node) => node.callType === 1).length;
  const call2Count = activeNodes.filter((node) => node.callType === 2).length;

  if (activeCall.activeStage === "call2" && activeCall.call2Enabled) {
    return `
      <article class="node-card stage-card">
        <div class="node-shell">
          <div class="node-index">02</div>
          <div class="node-body">
            <div class="node-head">
              <span class="section-kicker bridge">стадия</span>
              <h3>Открыт контур второго звонка</h3>
              <p>
                Сейчас менеджер работает только со вторым звонком. При
                необходимости можно вернуться к первому звонку через верхний
                переключатель стадий.
              </p>
            </div>
            <div class="node-banner-list">
              <div class="node-banner info">
                <strong>Контекст маршрута</strong>
                В ветке найдено ${call1Count} узл. 1-го звонка и ${call2Count} узл. 2-го звонка.
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  return `
    <article class="node-card stage-card">
      <div class="node-shell">
        <div class="node-index">02</div>
        <div class="node-body">
          <div class="node-head">
            <span class="section-kicker bridge">переход</span>
            <h3>Первый звонок можно сохранить без второго</h3>
            <p>
              Карточка остается в журнале в состоянии 1-го звонка. Когда дойдет
              время, менеджер вручную открывает второй контур и продолжает
              сделку с того места, где остановился.
            </p>
          </div>
          <div class="node-banner-list">
            <div class="node-banner info">
              <strong>Что уже доступно</strong>
              В маршруте найдено ${call2Count} узл. 2-го звонка. Они откроются после отдельного действия менеджера.
            </div>
          </div>
          <section class="completion-block">
            <h4>Следующий шаг</h4>
            <div class="call-card-actions">
              <button class="action-button action-button-primary" data-workspace-action="activate_call2" type="button">
                Перейти ко второму звонку
              </button>
            </div>
          </section>
        </div>
      </div>
    </article>
  `;
}

function renderField(fieldKey) {
  const field = fieldCatalog[fieldKey];
  if (!field) {
    return "";
  }

  if (!isFieldVisible(field, routeState, formState)) {
    return "";
  }

  const value = formState[fieldKey];
  const validationMessage = touched[fieldKey]
    ? validateField(field, value, routeState, formState)
    : null;
  const invalidClass = validationMessage ? "is-invalid" : "";
  const requiredPill = isFieldRequired(field, routeState, formState)
    ? `<span class="field-required">обязательно</span>`
    : "";

  if (field.kind === "route") {
    const routeValue =
      fieldKey === "routePurpose"
        ? getRouteLabel("purpose", routeState.purpose)
        : getRouteLabel("program", routeState.program);
    return `
      <div class="field-card" data-field-card="${escapeHtml(fieldKey)}">
        <div class="field-label-row">
          <span class="field-label">${field.label}</span>
          ${requiredPill}
          ${renderFieldMetaBadges(field)}
        </div>
        <span class="field-source ${field.sourceKind}">${sourceText(field)}</span>
        <input class="field-input" type="text" value="${routeValue}" readonly />
        ${
          uiState.detailMode
            ? `<div><span class="field-note-label">Комментарий</span><p class="field-note">Значение приходит из верхнего роутера и задает всю ветку графа.</p></div>`
            : ""
        }
      </div>
    `;
  }

  const controlMarkup = renderControl(fieldKey, field, value);

  return `
    <div class="field-card ${invalidClass}" data-field-card="${escapeHtml(fieldKey)}">
      <div class="field-label-row">
        <span class="field-label">${field.label}</span>
        ${requiredPill}
        ${renderFieldMetaBadges(field)}
      </div>
      <span class="field-source ${field.sourceKind}">${sourceText(field)}</span>
      ${controlMarkup}
      ${renderImportedWarning(field, value)}
      ${
        validationMessage
          ? `<p class="validation-message">${validationMessage}</p>`
          : ""
      }
      ${
        uiState.detailMode && field.note
          ? `<div><span class="field-note-label">Почему это важно</span><p class="field-note">${field.note}</p></div>`
          : ""
      }
    </div>
  `;
}

function buildSelectOptions(options, placeholder = "Выберите вариант") {
  const normalized = Array.isArray(options) ? options.slice() : [];
  if (!normalized.some((option) => option.value === "")) {
    normalized.unshift({ value: "", label: placeholder });
  }
  return normalized;
}

function formatFieldValueForControl(field, value) {
  if (field.kind === "date") {
    return maskDateInput(value ?? "");
  }
  if (field.kind === "datetime-local") {
    return maskDateTimeInput(value ?? "");
  }
  return value ?? "";
}

function renderSelectControl(fieldKey, options, value, placeholder, disabled = false) {
  return `
    <select class="field-select" data-field-key="${fieldKey}" ${disabled ? "disabled" : ""}>
      ${buildSelectOptions(options, placeholder)
        .map(
          (option) =>
            `<option value="${escapeHtml(option.value)}" ${value === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
        )
        .join("")}
    </select>
  `;
}

function renderParticipantsControl(fieldKey, field, value) {
  const storedParticipants = normalizeParticipants(value);
  const participants = storedParticipants.length
    ? storedParticipants
    : [createParticipant("", "", `${fieldKey}_draft`)];
  const hasStoredRows = storedParticipants.length > 0;
  const citizenshipOptions = [
    { value: "unknown", label: "Не указано" },
    { value: "rf", label: "РФ" },
    { value: "foreign", label: "Иное" },
  ];
  const docOptions = [
    ["passport", "Паспорт"],
    ["snils", "СНИЛС"],
    ["sopd", "СОПД"],
    ["siz", "СиЗ"],
    ["kinshipDocs", "Родство"],
    ["guardianshipPermission", "Опека"],
  ];

  return `
    <div class="participants-control">
      <div class="participants-list">
        ${participants
          .map(
            (participant, index) => `
              <div class="participant-row">
                <div class="participant-row-head">
                  <span class="participant-index">Участник ${index + 1}</span>
                  ${
                    hasStoredRows
                      ? `<button
                          class="participant-remove"
                          type="button"
                          data-field-action="remove-participant"
                          data-field-key="${fieldKey}"
                          data-participant-id="${escapeHtml(participant.id)}"
                        >
                          Удалить
                        </button>`
                      : ""
                  }
                </div>
                <div class="participant-fields">
                  <label class="participant-field participant-name">
                    <span>ФИО</span>
                    <input
                      class="field-input"
                      type="text"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="fullName"
                      value="${escapeHtml(participant.fullName)}"
                      placeholder="Иванов Иван Иванович"
                    />
                  </label>
                  <label class="participant-field participant-role">
                    <span>Роль в сделке</span>
                    <select
                      class="field-select"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="role"
                    >
                      ${buildSelectOptions(field.roles || [], "Выберите роль")
                        .map(
                          (option) =>
                            `<option value="${escapeHtml(option.value)}" ${participant.role === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                        )
                        .join("")}
                    </select>
                  </label>
                  <label class="participant-field participant-citizenship">
                    <span>Гражданство</span>
                    <select
                      class="field-select"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="citizenship"
                    >
                      ${citizenshipOptions
                        .map(
                          (option) =>
                            `<option value="${escapeHtml(option.value)}" ${participant.citizenship === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                        )
                        .join("")}
                    </select>
                  </label>
                  <label class="participant-field participant-kinship">
                    <span>Родство</span>
                    <input
                      class="field-input"
                      type="text"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="kinshipToBorrower"
                      value="${escapeHtml(participant.kinshipToBorrower)}"
                      placeholder="например супруг, ребенок"
                    />
                  </label>
                </div>
                <div class="participant-checks">
                  <label>
                    <input
                      type="checkbox"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="isPledgor"
                      ${participant.isPledgor ? "checked" : ""}
                    />
                    <span>Залогодатель</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="participatesInCalculation"
                      ${participant.participatesInCalculation ? "checked" : ""}
                    />
                    <span>Участвует в расчете дохода</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      data-field-key="${fieldKey}"
                      data-participant-id="${escapeHtml(participant.id)}"
                      data-participant-prop="isMinor"
                      ${participant.isMinor ? "checked" : ""}
                    />
                    <span>Несовершеннолетний</span>
                  </label>
                </div>
                <div class="participant-docs">
                  ${docOptions
                    .map(
                      ([docKey, label]) => `
                        <label>
                          <input
                            type="checkbox"
                            data-field-key="${fieldKey}"
                            data-participant-id="${escapeHtml(participant.id)}"
                            data-participant-prop="docs.${escapeHtml(docKey)}"
                            ${participant.docs?.[docKey] ? "checked" : ""}
                          />
                          <span>${escapeHtml(label)}</span>
                        </label>
                      `
                    )
                    .join("")}
                </div>
                ${
                  index === 0
                    ? `<p class="participant-hint">Зафиксируйте всех участников сделки: заемщика, созаемщиков, супруга, залогодателя или представителя.</p>`
                    : ""
                }
              </div>
            `
          )
          .join("")}
      </div>
      <button
        class="participant-add"
        type="button"
        data-field-action="add-participant"
        data-field-key="${fieldKey}"
      >
        + Добавить участника сделки
      </button>
    </div>
  `;
}

function renderControl(fieldKey, field, value) {
  const formattedValue = formatFieldValueForControl(field, value);
  const readonly = isFieldHardReadonly(field);

  switch (field.kind) {
    case "select":
      return renderSelectControl(fieldKey, field.options || [], value || "", "Выберите вариант", readonly);
    case "boolean":
    case "radio":
      return renderSelectControl(
        fieldKey,
        field.options || boolOptions,
        value || "",
        field.kind === "boolean" ? "Выберите Да или Нет" : "Выберите вариант",
        readonly
      );
    case "multi":
      return `
        <div class="checkbox-list">
          ${(field.options || [])
            .map((option) => {
              const checked = Array.isArray(value) && value.includes(option.value);
              return `
                <label class="checkbox-option">
                  <input
                    type="checkbox"
                    data-field-key="${fieldKey}"
                    data-option-value="${escapeHtml(option.value)}"
                    ${checked ? "checked" : ""}
                    ${readonly ? "disabled" : ""}
                  />
                  <span>${escapeHtml(option.label)}</span>
                </label>
              `;
            })
            .join("")}
        </div>
      `;
    case "participants":
      return renderParticipantsControl(fieldKey, field, value);
    case "textarea":
      return `<textarea class="field-textarea" data-field-key="${fieldKey}" rows="5" placeholder="${escapeHtml(field.placeholder || "Свободный ввод")}" ${readonly ? "readonly" : ""}>${escapeHtml(formattedValue)}</textarea>`;
    case "date":
      return `<input class="field-input field-input-date" type="text" inputmode="numeric" data-field-key="${fieldKey}" value="${escapeHtml(formattedValue)}" placeholder="${escapeHtml(field.placeholder || "ДД.ММ.ГГГГ")}" ${readonly ? "readonly" : ""} />`;
    case "datetime-local":
      return `<input class="field-input field-input-date" type="text" inputmode="numeric" data-field-key="${fieldKey}" value="${escapeHtml(formattedValue)}" placeholder="${escapeHtml(field.placeholder || "ДД.ММ.ГГГГ ЧЧ:ММ")}" ${readonly ? "readonly" : ""} />`;
    case "number":
      return `<input class="field-input" type="text" inputmode="decimal" data-field-key="${fieldKey}" value="${escapeHtml(formattedValue)}" placeholder="${escapeHtml(field.placeholder || "Введите число")}" ${readonly ? "readonly" : ""} />`;
    case "email":
    case "text":
    case "money":
      return `<input class="field-input" type="text" ${field.kind === "email" ? 'inputmode="email"' : ""} data-field-key="${fieldKey}" value="${escapeHtml(formattedValue)}" placeholder="${escapeHtml(field.placeholder || "")}" ${readonly ? "readonly" : ""} />`;
    default:
      return `<input class="field-input" type="text" data-field-key="${fieldKey}" value="${escapeHtml(formattedValue)}" placeholder="${escapeHtml(field.placeholder || "")}" ${readonly ? "readonly" : ""} />`;
  }
}

function renderContradictionsPanel(contradictions) {
  if (!contradictionsRoot) {
    return;
  }

  if (!routeState.purpose || !routeState.program) {
    contradictionsRoot.innerHTML = `
      <div class="contradiction-head">
        <span class="section-kicker bridge">детектор</span>
        <h2>Противоречия</h2>
        <p class="contradiction-copy">
          После выбора цели и программы здесь появятся конфликты между уже
          введенными ответами, маршрутом и методологией.
        </p>
      </div>
      <div class="contradiction-empty">
        Это отдельный слой: он не показывает пустые поля и форматные ошибки,
        а ловит именно логические конфликты.
      </div>
    `;
    return;
  }

  if (!contradictions.all.length) {
    contradictionsRoot.innerHTML = `
      <div class="contradiction-head">
        <span class="section-kicker bridge">детектор</span>
        <h2>Противоречий нет</h2>
        <p class="contradiction-copy">
          Уже введенные ответы не конфликтуют между собой. Пропуски и
          форматные ошибки остаются в pre-check и локальных подсказках полей.
        </p>
      </div>
      <div class="contradiction-empty success">
        Логика маршрута сейчас согласована.
      </div>
    `;
    return;
  }

  const visibleLimit = 7;
  const visibleItems = uiState.contradictionsExpanded
    ? contradictions.all
    : contradictions.all.slice(0, visibleLimit);
  const hiddenCount = Math.max(contradictions.all.length - visibleItems.length, 0);
  contradictionsRoot.innerHTML = `
    <div class="contradiction-head">
      <span class="section-kicker bridge">детектор</span>
      <h2>Обнаружены противоречия</h2>
      <p class="contradiction-copy">
        Это не список незаполненных полей, а логические конфликты в уже
        собранных ответах. Сначала снимай критичные.
      </p>
    </div>
    <div class="contradiction-summary-row">
      <span class="contradiction-count danger">${contradictions.summary.blockers} критично</span>
      <span class="contradiction-count warn">${contradictions.summary.clarifications} уточнить</span>
      <span class="contradiction-count info">${contradictions.summary.risks} риск</span>
    </div>
    <div class="contradiction-list">
      ${visibleItems.map((item) => renderContradictionCard(item)).join("")}
      ${
        hiddenCount
          ? `
            <button class="contradiction-more" data-contradiction-action="toggle_more" type="button">
              Показать еще ${hiddenCount}
            </button>
          `
          : uiState.contradictionsExpanded && contradictions.all.length > visibleLimit
            ? `
              <button class="contradiction-more" data-contradiction-action="toggle_more" type="button">
                Свернуть список
              </button>
            `
          : ""
      }
    </div>
  `;
}

function renderContradictionCard(item) {
  return `
    <article class="contradiction-item ${escapeHtml(contradictionSeverityToLevel(item.severity))}">
      <div class="contradiction-item-head">
        <span class="contradiction-severity">${escapeHtml(contradictionSeverityLabel(item.severity))}</span>
        <span class="contradiction-stage">${escapeHtml(getContradictionStageLabel(item.stage))}</span>
        <span class="contradiction-stage">${escapeHtml(getContradictionRuleId(item))}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.reason)}</p>
      <div class="contradiction-action-text">
        <strong>Что сделать</strong>
        ${escapeHtml(item.action)}
      </div>
      ${renderContradictionFacts(item.facts)}
      <button
        class="contradiction-go"
        data-contradiction-action="go_to"
        data-contradiction-id="${escapeHtml(item.id)}"
        type="button"
      >
        Перейти к источнику
      </button>
    </article>
  `;
}

function renderContradictionFacts(facts = []) {
  const visibleFacts = facts.filter(Boolean);
  if (!visibleFacts.length) {
    return "";
  }
  return `
    <ul class="contradiction-facts">
      ${visibleFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
    </ul>
  `;
}

function renderContradictionBanners(items) {
  if (!items.length) {
    return "";
  }
  return `
    <div class="node-banner-list contradiction-banner-list">
      ${items
        .map((item) => {
          const level = contradictionSeverityToLevel(item.severity);
          return `
            <div class="node-banner ${level} contradiction-banner">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.reason)}</span>
              <span class="contradiction-banner-action">${escapeHtml(item.action)}</span>
              ${renderContradictionFacts(item.facts)}
              <button
                class="contradiction-inline-go"
                data-contradiction-action="go_to"
                data-contradiction-id="${escapeHtml(item.id)}"
                type="button"
              >
                Перейти
              </button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getContradictionStageLabel(stage) {
  if (stage === "precheck") return "pre-check";
  if (stage === "call1") return "1-й звонок";
  if (stage === "call2") return "2-й звонок";
  return "общий контур";
}

function getOutcomeIssueMessages(validation, field) {
  return validation.issues
    .filter((issue) => issue.field === field)
    .map((issue) => `<p class="validation-message">${escapeHtml(issue.message)}</p>`)
    .join("");
}

function renderOutcomeStatusButtons(outcome) {
  return outcomeStatusOptions
    .map((option) => {
      const active = outcome.status === option.value ? "is-active" : "";
      return `
        <button
          class="outcome-status-chip ${escapeHtml(option.tone)} ${active}"
          data-outcome-action="set_status"
          data-outcome-value="${escapeHtml(option.value)}"
          type="button"
        >
          <span>${escapeHtml(option.label)}</span>
          <em>${escapeHtml(option.hint)}</em>
        </button>
      `;
    })
    .join("");
}

function renderPromisedDocs(outcome) {
  if (!outcome.promisedDocs.length) {
    return `
      <div class="promised-docs-empty">
        После звонка можно отдельно зафиксировать только те документы, которые
        клиент обещал дослать по итогам контакта.
      </div>
    `;
  }

  return `
    <div class="promised-docs-list">
      ${outcome.promisedDocs
        .map(
          (doc, index) => `
            <article class="promised-doc-row">
              <div class="promised-doc-head">
                <span class="outcome-mini-label">Документ ${index + 1}</span>
                <span class="outcome-pill ${doc.received ? "success" : "warning"}">
                  ${doc.received ? "получен" : "ждем"}
                </span>
              </div>
              <div class="promised-doc-grid">
                <label class="outcome-field">
                  <span>Документ</span>
                  <input
                    class="field-input"
                    type="text"
                    data-promised-doc-id="${escapeHtml(doc.id)}"
                    data-promised-doc-key="name"
                    value="${escapeHtml(doc.name)}"
                    placeholder="Например: свидетельство о рождении"
                  />
                </label>
                <label class="outcome-field">
                  <span>Срок</span>
                  <input
                    class="field-input field-input-date"
                    type="text"
                    inputmode="numeric"
                    data-promised-doc-id="${escapeHtml(doc.id)}"
                    data-promised-doc-key="dueDate"
                    value="${escapeHtml(formatIsoDateForInput(doc.dueDate))}"
                    placeholder="ДД.ММ.ГГГГ"
                  />
                </label>
                <label class="outcome-field promised-doc-comment">
                  <span>Комментарий</span>
                  <input
                    class="field-input"
                    type="text"
                    data-promised-doc-id="${escapeHtml(doc.id)}"
                    data-promised-doc-key="comment"
                    value="${escapeHtml(doc.comment)}"
                    placeholder="Клиент отправит вечером"
                  />
                </label>
              </div>
              <div class="promised-doc-actions">
                <label class="outcome-check">
                  <input
                    type="checkbox"
                    data-promised-doc-id="${escapeHtml(doc.id)}"
                    data-promised-doc-key="received"
                    ${doc.received ? "checked" : ""}
                  />
                  <span>Документ получен</span>
                </label>
                <button
                  class="documents-mini-action"
                  data-outcome-action="remove_doc"
                  data-promised-doc-id="${escapeHtml(doc.id)}"
                  type="button"
                >
                  Удалить
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCallOutcome(activeCall) {
  if (!activeCall) {
    callOutcomeRoot.innerHTML = "";
    return;
  }

  const outcome = normalizeOutcomeState(activeCall.outcome);
  const validation = validateOutcome(outcome);
  const statusMeta = getOutcomeStatusMeta(outcome.status);
  const readiness = getOutcomeReadiness(outcome);
  const followUpTask = buildFollowUpTaskFromCall(activeCall);
  const followUpRequiredChecked = validation.followUpRequired || outcome.followUp.required;

  callOutcomeRoot.innerHTML = `
    <section class="call-outcome-card">
      <div class="call-outcome-head">
        <div>
          <span class="section-kicker bridge">операционный финал</span>
          <h2>Итог звонка</h2>
          <p>
            Это не методологическая проверка, а точка завершения контакта:
            что подтвердили, что осталось подвешенным и когда вернуться к клиенту.
          </p>
        </div>
        <div class="call-outcome-head-status">
          <span class="outcome-pill ${escapeHtml(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>
          <span class="outcome-pill ${escapeHtml(readiness.tone)}">${escapeHtml(readiness.label)}</span>
        </div>
      </div>

      ${
        validation.issues.length
          ? `
            <div class="outcome-validation-panel">
              <strong>Что нужно дозаполнить</strong>
              <ul>
                ${validation.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}
              </ul>
            </div>
          `
          : ""
      }

      <section class="outcome-section">
        <div class="outcome-section-head">
          <h3>Статус звонка</h3>
          <p>Выберите один операционный итог текущего контакта.</p>
        </div>
        <div class="call-outcome-status-row">
          ${renderOutcomeStatusButtons(outcome)}
        </div>
        ${getOutcomeIssueMessages(validation, "status")}
      </section>

      <div class="call-outcome-grid">
        <div class="outcome-column">
          <section class="outcome-section">
            <div class="outcome-section-head">
              <h3>Содержательный итог</h3>
              <p>Короткая запись, чтобы завтра быстро понять состояние карточки.</p>
            </div>
            <label class="outcome-field">
              <span>Что подтверждено</span>
              <textarea
                class="field-textarea call-outcome-textarea"
                data-outcome-key="confirmedSummary"
                maxlength="500"
                rows="4"
                placeholder="Подтвержден тип сделки, состав участников, продавец = ФЛ..."
              >${escapeHtml(outcome.confirmedSummary)}</textarea>
            </label>
            <label class="outcome-field">
              <span>Что осталось неясным</span>
              <textarea
                class="field-textarea call-outcome-textarea"
                data-outcome-key="unresolvedSummary"
                maxlength="500"
                rows="4"
                placeholder="Не подтверждено семейное основание, ждем свидетельство..."
              >${escapeHtml(outcome.unresolvedSummary)}</textarea>
            </label>
            <label class="outcome-field">
              <span>Риски и контроль</span>
              <textarea
                class="field-textarea call-outcome-textarea"
                data-outcome-key="riskSummary"
                maxlength="500"
                rows="4"
                placeholder="Риск по опеке / внешним расчетам / нестандартному продавцу..."
              >${escapeHtml(outcome.riskSummary)}</textarea>
            </label>
          </section>

          <section class="outcome-section">
            <div class="outcome-section-head outcome-section-head-row">
              <div>
                <h3>Документы после звонка</h3>
                <p>Только то, что клиент обещал дослать после этого контакта.</p>
              </div>
              <button class="documents-mini-action" data-outcome-action="add_doc" type="button">
                + Добавить документ
              </button>
            </div>
            ${renderPromisedDocs(outcome)}
          </section>
        </div>

        <aside class="followup-card">
          <div class="outcome-section-head">
            <h3>Следующий контакт</h3>
            <p>Календарь строится только из этих данных, без отдельного списка задач.</p>
          </div>

          <label class="outcome-field">
            <span>Следующий шаг</span>
            <input
              class="field-input"
              type="text"
              data-outcome-key="nextStep"
              value="${escapeHtml(outcome.nextStep)}"
              placeholder="Проверить семейное основание после получения документов"
            />
            ${getOutcomeIssueMessages(validation, "nextStep")}
          </label>

          <label class="outcome-check outcome-check-card">
            <input
              type="checkbox"
              data-outcome-key="followUp.required"
              ${followUpRequiredChecked ? "checked" : ""}
            />
            <span>Нужен следующий контакт</span>
          </label>

          <div class="followup-grid">
            <label class="outcome-field">
              <span>Дата</span>
              <input
                class="field-input field-input-date"
                type="text"
                inputmode="numeric"
                data-outcome-key="followUp.date"
                value="${escapeHtml(formatIsoDateForInput(outcome.followUp.date))}"
                placeholder="ДД.ММ.ГГГГ"
              />
              ${getOutcomeIssueMessages(validation, "followUp.date")}
            </label>
            <label class="outcome-field">
              <span>Время</span>
              <input
                class="field-input field-input-date"
                type="text"
                inputmode="numeric"
                data-outcome-key="followUp.time"
                value="${escapeHtml(outcome.followUp.time)}"
                placeholder="ЧЧ:ММ"
              />
              ${getOutcomeIssueMessages(validation, "followUp.time")}
            </label>
          </div>

          <label class="outcome-field">
            <span>Канал</span>
            <select class="field-select" data-outcome-key="followUp.channel">
              ${followUpChannelOptions
                .map(
                  (option) =>
                    `<option value="${escapeHtml(option.value)}" ${outcome.followUp.channel === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                )
                .join("")}
            </select>
            ${getOutcomeIssueMessages(validation, "followUp.channel")}
          </label>

          <label class="outcome-field">
            <span>Причина следующего контакта</span>
            <textarea
              class="field-textarea call-outcome-textarea"
              data-outcome-key="followUp.reason"
              maxlength="500"
              rows="4"
              placeholder="Клиент должен дослать документы / нужно перепроверить реквизиты"
            >${escapeHtml(outcome.followUp.reason)}</textarea>
            ${getOutcomeIssueMessages(validation, "followUp.reason")}
          </label>

          <div class="followup-preview">
            <span class="outcome-mini-label">Календарный статус</span>
            <strong>
              ${escapeHtml(
                followUpTask
                  ? `${getFollowUpUrgencyLabel(followUpTask.urgency)} · ${formatFollowUpMoment(followUpTask.date, followUpTask.time)}`
                  : "Задача не попадет в календарь"
              )}
            </strong>
          </div>

          <label class="outcome-check">
            <input
              type="checkbox"
              data-outcome-key="followUp.done"
              ${outcome.followUp.done ? "checked" : ""}
            />
            <span>Следующий контакт выполнен</span>
          </label>
        </aside>
      </div>

      <div class="call-outcome-actions">
        <button class="action-button action-button-primary" data-outcome-action="save" type="button">
          Сохранить итог
        </button>
        <button class="action-button" data-outcome-action="save_plan" type="button">
          Сохранить и запланировать
        </button>
        <button class="action-button" data-outcome-action="clear_date" type="button">
          Очистить дату
        </button>
        <button class="action-button" data-outcome-action="mark_no_followup" type="button">
          Отметить без следующего шага
        </button>
      </div>
    </section>
  `;
}

const calendarGroupMeta = {
  overdue: {
    title: "Просрочено",
    description: "Контакты, по которым срок уже прошел.",
  },
  today: {
    title: "Сегодня",
    description: "То, к чему нужно вернуться сегодня.",
  },
  tomorrow: {
    title: "Завтра",
    description: "Ближайшие задачи на следующий рабочий день.",
  },
  later: {
    title: "Позже",
    description: "Будущие контакты после завтрашнего дня.",
  },
  no_date: {
    title: "Без даты",
    description: "Есть следующий шаг, но менеджер не поставил срок.",
  },
};

function renderCalendarTaskCard(task) {
  return `
    <article class="calendar-task-card ${escapeHtml(task.urgency)}">
      <div class="calendar-task-head">
        <div>
          <span class="outcome-mini-label">${escapeHtml(getFollowUpChannelLabel(task.channel))}</span>
          <h4>${escapeHtml(task.clientName)}</h4>
          <p>${escapeHtml(task.title)} · ${escapeHtml(task.callName)}</p>
        </div>
        <span class="outcome-pill ${escapeHtml(task.urgency)}">
          ${escapeHtml(getFollowUpUrgencyLabel(task.urgency))}
        </span>
      </div>
      <div class="calendar-task-facts">
        <span>${escapeHtml(formatFollowUpMoment(task.date, task.time))}</span>
        <span>${escapeHtml(task.statusLabel)}</span>
        ${
          task.promisedDocsCount
            ? `<span>${task.promisedDocsCount} док. ждем</span>`
            : ""
        }
      </div>
      <p class="calendar-task-copy">
        <strong>Причина:</strong> ${escapeHtml(task.reason || "не указана")}
      </p>
      <p class="calendar-task-copy">
        <strong>Следующий шаг:</strong> ${escapeHtml(task.nextStep || "не указан")}
      </p>
      <div class="calendar-reschedule-row">
        <label>
          <span>Дата</span>
          <input
            class="field-input field-input-date"
            type="text"
            inputmode="numeric"
            data-calendar-input="date"
            data-call-id="${escapeHtml(task.callId)}"
            value="${escapeHtml(formatIsoDateForInput(task.date))}"
            placeholder="ДД.ММ.ГГГГ"
          />
        </label>
        <label>
          <span>Время</span>
          <input
            class="field-input field-input-date"
            type="text"
            inputmode="numeric"
            data-calendar-input="time"
            data-call-id="${escapeHtml(task.callId)}"
            value="${escapeHtml(task.time)}"
            placeholder="ЧЧ:ММ"
          />
        </label>
      </div>
      <div class="calendar-task-actions">
        <button class="action-button action-button-primary" data-calendar-action="open_call" data-call-id="${escapeHtml(task.callId)}" type="button">
          Открыть карточку
        </button>
        <button class="action-button" data-calendar-action="done" data-call-id="${escapeHtml(task.callId)}" type="button">
          Выполнено
        </button>
        <button class="action-button" data-calendar-action="unschedule" data-call-id="${escapeHtml(task.callId)}" type="button">
          Убрать из плана
        </button>
      </div>
    </article>
  `;
}

function renderCalendarList(tasks) {
  const grouped = groupCalendarTasks(tasks);
  return `
    <div class="calendar-groups">
      ${Object.entries(calendarGroupMeta)
        .map(([groupKey, meta]) => {
          const groupTasks = grouped[groupKey] || [];
          return `
            <section class="calendar-group ${escapeHtml(groupKey)}">
              <div class="calendar-group-head">
                <div>
                  <h3>${escapeHtml(meta.title)}</h3>
                  <p>${escapeHtml(meta.description)}</p>
                </div>
                <span class="summary-chip">${groupTasks.length}</span>
              </div>
              ${
                groupTasks.length
                  ? `<div class="calendar-task-list">${groupTasks.map(renderCalendarTaskCard).join("")}</div>`
                  : `<div class="calendar-empty">Задач в этой группе нет.</div>`
              }
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function getCalendarMonthDays(selectedDate) {
  const selected = parseIsoDate(selectedDate) || new Date();
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const start = new Date(firstDay);
  const startDay = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - startDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function renderCalendarMonth(tasks) {
  const selectedDate = uiState.calendarSelectedDate || getTodayIsoDate();
  const selected = parseIsoDate(selectedDate) || new Date();
  const days = getCalendarMonthDays(selectedDate);
  const tasksByDate = tasks.reduce((acc, task) => {
    if (!task.date) {
      return acc;
    }
    acc[task.date] = acc[task.date] || [];
    acc[task.date].push(task);
    return acc;
  }, {});
  const selectedTasks = tasksByDate[selectedDate] || [];
  const monthLabel = selected.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return `
    <div class="calendar-month-layout">
      <section class="calendar-month-card">
        <div class="calendar-month-head">
          <h3>${escapeHtml(monthLabel)}</h3>
          <button class="documents-mini-action" data-calendar-action="today" type="button">
            Сегодня
          </button>
        </div>
        <div class="calendar-week-row">
          ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => `<span>${day}</span>`).join("")}
        </div>
        <div class="calendar-month-grid">
          ${days
            .map((date) => {
              const iso = toIsoDateFromDate(date);
              const count = tasksByDate[iso]?.length || 0;
              const muted = date.getMonth() === selected.getMonth() ? "" : "is-muted";
              const active = iso === selectedDate ? "is-active" : "";
              return `
                <button
                  class="calendar-day-chip ${muted} ${active}"
                  data-calendar-action="select_date"
                  data-calendar-date="${escapeHtml(iso)}"
                  type="button"
                >
                  <span>${date.getDate()}</span>
                  ${count ? `<strong>${count}</strong>` : ""}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
      <section class="calendar-selected-card">
        <div class="calendar-group-head">
          <div>
            <h3>${escapeHtml(formatIsoDateDisplay(selectedDate))}</h3>
            <p>Задачи на выбранную дату.</p>
          </div>
          <span class="summary-chip">${selectedTasks.length}</span>
        </div>
        ${
          selectedTasks.length
            ? `<div class="calendar-task-list">${selectedTasks.map(renderCalendarTaskCard).join("")}</div>`
            : `<div class="calendar-empty">На выбранную дату задач нет.</div>`
        }
      </section>
    </div>
  `;
}

function renderCalendarDrawer() {
  if (!uiState.calendarOpen) {
    calendarDrawerRoot.classList.add("hidden");
    calendarDrawerRoot.innerHTML = "";
    return;
  }

  const tasks = buildCalendarTasks();
  const grouped = groupCalendarTasks(tasks);
  const view = uiState.calendarView || "list";
  calendarDrawerRoot.classList.remove("hidden");
  calendarDrawerRoot.innerHTML = `
    <div class="calendar-scrim" data-calendar-action="close"></div>
    <aside class="calendar-drawer" role="dialog" aria-modal="true" aria-label="Календарь повторных контактов">
      <header class="calendar-header">
        <div>
          <span class="documents-kicker">follow-up</span>
          <h2>Календарь повторных звонков</h2>
          <p>
            Это производная витрина: задачи строятся из блока “Итог звонка” в каждой карточке.
          </p>
        </div>
        <div class="documents-header-actions">
          <button class="documents-close" data-calendar-action="close" type="button">Закрыть</button>
        </div>
      </header>

      <div class="calendar-body">
        <section class="calendar-summary-card">
          <div class="calendar-summary-row">
            <span class="summary-chip">${tasks.length} активных задач</span>
            <span class="summary-chip">${grouped.overdue.length} просрочено</span>
            <span class="summary-chip">${grouped.today.length} сегодня</span>
            <span class="summary-chip">${grouped.tomorrow.length} завтра</span>
            <span class="summary-chip">${grouped.no_date.length} без даты</span>
          </div>
          <div class="documents-toggle-row">
            <button class="documents-toggle ${view === "list" ? "is-active" : ""}" data-calendar-action="set_view" data-calendar-value="list" type="button">
              Список
            </button>
            <button class="documents-toggle ${view === "month" ? "is-active" : ""}" data-calendar-action="set_view" data-calendar-value="month" type="button">
              Месяц
            </button>
          </div>
        </section>
        ${
          tasks.length
            ? view === "month"
              ? renderCalendarMonth(tasks)
              : renderCalendarList(tasks)
            : `
              <section class="calendar-empty calendar-empty-main">
                Активных повторных контактов пока нет. Добавьте дату и следующий шаг в блоке “Итог звонка” нужной карточки.
              </section>
            `
        }
      </div>
    </aside>
  `;
}

function getSignalTypeLabel(type) {
  if (type === "missing") return "Пропуски";
  if (type === "validation") return "Валидации";
  if (type === "contradiction") return "Противоречия";
  if (type === "info") return "Информационные допуски";
  return "Сигналы";
}

function renderSignalItem(signal) {
  const hasTarget = Boolean(
    getSignalPrimaryField(signal) ||
      getSignalDocumentItemId(signal) ||
      signal.nodeId ||
      signal.sectionId
  );
  return `
    <button
      class="insight-item signal-action ${escapeHtml(signal.level)}"
      type="button"
      data-signal-action="focus"
      data-signal-id="${escapeHtml(signal.id)}"
      ${hasTarget ? "" : 'aria-label="Показать контекст сигнала"'}
    >
      <span class="insight-title">${escapeHtml(signal.title)}</span>
      <span class="signal-meta">${escapeHtml(signal.ruleId)} · ${escapeHtml(signal.severity)}</span>
      ${escapeHtml(signal.message || signal.text || "")}
      <span class="signal-target-hint">${hasTarget ? "Перейти к полю" : "Показать контекст"}</span>
    </button>
  `;
}

function renderInsights(items, signals = []) {
  if (!routeState.purpose || !routeState.program) {
    insightsRoot.innerHTML = `<div class="insight-empty">После выбора цели кредита и программы здесь появятся все активные красные границы по маршруту.</div>`;
    return;
  }

  if (!items.length && !signals.length) {
    insightsRoot.innerHTML = `<div class="insight-empty">В текущей ветке активных блокирующих сигналов нет. Основной граф можно продолжать.</div>`;
    return;
  }

  const typeOrder = ["missing", "validation", "contradiction", "info"];
  const priority = { blocker: 0, warning: 1, info: 2 };
  const signalGroups = typeOrder
    .map((type) => ({
      type,
      items: signals
        .filter((signal) => signal.type === type)
        .sort((a, b) => priority[a.level] - priority[b.level]),
    }))
    .filter((group) => group.items.length);

  const legacyItems = items.filter(
    (item) =>
      !signals.some(
        (signal) => signal.title === item.title || signal.message === item.text || signal.text === item.text
      )
  );

  insightsRoot.innerHTML = `
    ${signalGroups
      .map(
        (group) => `
          <section class="signal-group">
            <div class="signal-group-head">
              <strong>${getSignalTypeLabel(group.type)}</strong>
              <span>${group.items.length}</span>
            </div>
            ${group.items.slice(0, 12).map(renderSignalItem).join("")}
          </section>
        `
      )
      .join("")}
    ${
      legacyItems.length
        ? `
          <section class="signal-group">
            <div class="signal-group-head">
              <strong>Методологические подсказки</strong>
              <span>${legacyItems.length}</span>
            </div>
            ${legacyItems
              .slice()
              .sort((a, b) => priority[a.level] - priority[b.level])
              .slice(0, 8)
              .map(
                (item) => `
                  <div class="insight-item ${item.level}">
                    <span class="insight-title">${escapeHtml(item.title)}</span>
                    ${escapeHtml(item.text)}
                  </div>
                `
              )
              .join("")}
          </section>
        `
        : ""
    }
  `;
}

function renderAudit() {
  // Internal coverage audit is intentionally hidden in the product UI.
}

function renderDocumentsButtonGroup(items, activeValue, action) {
  return items
    .map(
      (item) => `
        <button
          class="documents-toggle ${activeValue === item.value ? "is-active" : ""}"
          data-doc-action="${action}"
          data-doc-value="${escapeHtml(item.value)}"
          type="button"
        >
          ${escapeHtml(item.label)}
        </button>
      `
    )
    .join("");
}

function renderDocumentScenarioFlags(call, group) {
  const flagGroups = getVisibleDocumentFlags(group);
  if (!flagGroups.length) {
    return "";
  }

  return `
    <section class="documents-card documents-flags-card">
      <div class="documents-card-head">
        <div>
          <span class="documents-kicker">сценарные флаги</span>
          <h3>Что включает документные ветки</h3>
          <p>Часть флагов подтягивается автоматически из полей блокнота, остальное можно дотыкать вручную.</p>
        </div>
      </div>
      <div class="documents-flag-groups">
        ${flagGroups
          .map(
            (groupItem) => `
              <div class="documents-flag-group">
                <h4>${escapeHtml(groupItem.title)}</h4>
                <div class="documents-flag-list">
                  ${groupItem.flags
                    .map((flag) => {
                      const auto = getDocumentFlagAutoValue(call, flag.id);
                      const checked = getDocumentFlagValue(call, flag.id);
                      return `
                        <label class="documents-flag ${checked ? "is-active" : ""} ${auto ? "is-auto" : ""}">
                          <input
                            type="checkbox"
                            data-doc-action="toggle_flag"
                            data-flag-id="${escapeHtml(flag.id)}"
                            ${checked ? "checked" : ""}
                            ${auto ? "disabled" : ""}
                          />
                          <span>${escapeHtml(flag.title)}</span>
                          ${auto ? `<em>из полей</em>` : ""}
                        </label>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function getDocumentStageLabel(stage) {
  if (stage === "call1") {
    return "1-й звонок";
  }
  if (stage === "call2") {
    return "2-й звонок";
  }
  return "постконтроль";
}

function getDocumentSectionStatus(progress) {
  if (!progress.total) {
    return { label: "пусто", className: "is-empty" };
  }
  if (progress.requiredOpen > 0) {
    return { label: `${progress.requiredOpen} критично`, className: "is-danger" };
  }
  if (progress.done === progress.total) {
    return { label: "закрыта", className: "is-complete" };
  }
  if (progress.done > 0) {
    return { label: "в работе", className: "is-partial" };
  }
  return { label: "не начата", className: "is-empty" };
}

function renderDocumentItem(call, item) {
  const checked = isDocumentChecked(call, item.id);
  const required = isDocumentItemRequired(call, item);
  return `
    <label class="document-item ${checked ? "is-checked" : ""} ${item.critical && !checked ? "is-critical" : ""}" data-doc-item-id="${escapeHtml(item.id)}">
      <input
        type="checkbox"
        data-doc-action="toggle_item"
        data-item-id="${escapeHtml(item.id)}"
        ${checked ? "checked" : ""}
      />
      <span class="document-item-main">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.note || "")}</small>
        <span class="document-badge-row">
          ${(item.badges || [])
            .map((badge) => `<em>${escapeHtml(badge)}</em>`)
            .join("")}
          ${item.ruleId ? `<em class="rule-id">${escapeHtml(item.ruleId)}</em>` : ""}
          ${required ? `<em class="required">обязательный контроль</em>` : ""}
        </span>
      </span>
    </label>
  `;
}

function renderDocumentSection(call, section) {
  const status = getDocumentSectionStatus(section.progress);
  return `
    <details class="documents-section ${status.className} ${section.focused ? "is-focused" : ""}" open>
      <summary>
        <div>
          <span class="documents-kicker">${escapeHtml(getDocumentStageLabel(section.stage))}</span>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.description)}</p>
        </div>
        <div class="documents-section-side">
          <span class="documents-section-status ${status.className}">${escapeHtml(status.label)}</span>
          <strong>${section.progress.done}/${section.progress.total}</strong>
        </div>
      </summary>
      <div class="documents-section-body">
        <div class="documents-section-actions">
          <button
            type="button"
            class="documents-mini-action"
            data-doc-action="mark_section_done"
            data-section-id="${escapeHtml(section.id)}"
          >
            Отметить секцию выполненной
          </button>
        </div>
        <div class="document-item-list">
          ${section.items.map((item) => renderDocumentItem(call, item)).join("")}
        </div>
      </div>
    </details>
  `;
}

function renderDocumentsUnsupported(call, group, meta) {
  return `
    <div class="documents-scrim" data-doc-action="close"></div>
    <aside class="documents-drawer" role="dialog" aria-modal="true" aria-label="Документы">
      <header class="documents-header">
        <div>
          <p class="utility-label">Документный помощник</p>
          <h2>${escapeHtml(meta.title)}</h2>
          <div class="documents-context-row">
            <span>${escapeHtml(getRouteLabel("purpose", call.route.purpose) || "Цель не выбрана")}</span>
            <span>${escapeHtml(getRouteLabel("program", call.route.program) || "Программа не выбрана")}</span>
            <span>${escapeHtml(meta.baseChip)}</span>
          </div>
        </div>
        <button class="documents-close" type="button" data-doc-action="close">Закрыть</button>
      </header>
      <div class="documents-body">
        <section class="documents-card documents-stub">
          <span class="documents-kicker">stub-card</span>
          <h3>Для этой цели отдельный документный сценарий пока не собран</h3>
          <p>${escapeHtml(meta.description)}</p>
          <p>Можно продолжать работать с основным графом звонка и output-панелью. Документный сценарий для этой цели лучше вынести отдельным справочником.</p>
        </section>
      </div>
    </aside>
  `;
}

function renderDocumentsDrawer() {
  const activeCall = getActiveCall();
  if (!documentsDrawerRoot) {
    return;
  }

  if (!activeCall || !getDocumentState(activeCall).drawerOpen) {
    documentsDrawerRoot.classList.add("hidden");
    documentsDrawerRoot.innerHTML = "";
    return;
  }

  const docs = getDocumentState(activeCall);
  const group = getDocumentGroup(activeCall);
  const meta = documentGroupMeta[group] || documentGroupMeta.unsupported_yet;

  documentsDrawerRoot.classList.remove("hidden");

  if (group === "unsupported_yet") {
    documentsDrawerRoot.innerHTML = renderDocumentsUnsupported(activeCall, group, meta);
    return;
  }

  const progress = getDocumentOverallProgress(activeCall);
  const sections = getVisibleDocumentSections(activeCall);
  const scenarioChips = getDocumentScenarioChips(activeCall, group);
  const viewOptions = [
    { value: "all", label: "Все документы" },
    { value: "call1", label: "Фокус 1-го звонка" },
    { value: "call2", label: "Фокус 2-го звонка" },
  ];
  const filterOptions = [
    { value: "all", label: "Все" },
    { value: "open", label: "Только незакрытые" },
    { value: "required", label: "Только обязательные" },
    { value: "critical", label: "Только критичные" },
    { value: "post", label: "Постсделка" },
  ];

  documentsDrawerRoot.innerHTML = `
    <div class="documents-scrim" data-doc-action="${docs.pinned ? "" : "close"}"></div>
    <aside class="documents-drawer ${docs.pinned ? "is-pinned" : ""}" role="dialog" aria-modal="true" aria-label="Документы">
      <header class="documents-header">
        <div>
          <p class="utility-label">Документный помощник</p>
          <h2>${escapeHtml(meta.title)}</h2>
          <div class="documents-context-row">
            <span>${escapeHtml(getRouteLabel("purpose", activeCall.route.purpose) || "Цель не выбрана")}</span>
            <span>${escapeHtml(getRouteLabel("program", activeCall.route.program) || "Программа не выбрана")}</span>
            <span>${escapeHtml(progress.done)} / ${escapeHtml(progress.total)} отмечено</span>
          </div>
        </div>
        <div class="documents-header-actions">
          <button class="documents-close" type="button" data-doc-action="toggle_pin">
            ${docs.pinned ? "Открепить" : "Закрепить"}
          </button>
          <button class="documents-close" type="button" data-doc-action="close">Закрыть</button>
        </div>
      </header>

      <div class="documents-body">
        <section class="documents-card documents-summary-card">
          <div class="documents-progress-head">
            <div>
              <span class="documents-kicker">прогресс</span>
              <h3>${progress.done}/${progress.total} документов закрыто</h3>
            </div>
            <strong>${progress.percent}%</strong>
          </div>
          <div class="progress-track progress-track-main" aria-hidden="true">
            <span style="width: ${progress.percent}%"></span>
          </div>
          <div class="documents-chip-row">
            ${scenarioChips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
          </div>
        </section>

        <section class="documents-card documents-controls-card">
          <div class="documents-control-block">
            <span class="documents-kicker">фокус</span>
            <div class="documents-toggle-row">
              ${renderDocumentsButtonGroup(viewOptions, docs.activeView, "set_view")}
            </div>
          </div>
          <div class="documents-control-block">
            <span class="documents-kicker">фильтр</span>
            <div class="documents-toggle-row">
              ${renderDocumentsButtonGroup(filterOptions, docs.filter, "set_filter")}
            </div>
          </div>
          <label class="documents-search">
            <span class="documents-kicker">поиск</span>
            <input
              class="field-input"
              type="text"
              data-doc-input="search"
              value="${escapeHtml(docs.search || "")}"
              placeholder="ЕГРН, МСК, согласие, ДУПТ, НИС..."
            />
          </label>
        </section>

        ${renderDocumentScenarioFlags(activeCall, group)}

        <section class="documents-sections">
          ${
            sections.length
              ? sections.map((section) => renderDocumentSection(activeCall, section)).join("")
              : `
                <div class="documents-card documents-stub">
                  <span class="documents-kicker">нет документов</span>
                  <h3>По текущим фильтрам ничего не найдено</h3>
                  <p>Снимите фильтры или измените сценарные флаги.</p>
                </div>
              `
          }
        </section>
      </div>

      <footer class="documents-footer">
        <button class="action-button action-button-primary" type="button" data-doc-action="copy_missing" data-stage="${escapeHtml(docs.activeView)}">
          Скопировать недостающие
        </button>
        <button class="action-button" type="button" data-doc-action="reset_filters">
          Сбросить фильтры
        </button>
        <span class="documents-copy-status">${escapeHtml(docs.copyMessage || "Можно скопировать список недостающих документов.")}</span>
      </footer>
    </aside>
  `;
}

function renderOutputButtonGroup(items, activeValue, action, extra = {}) {
  return items
    .map((item) => {
      const disabled = extra.disabledValues?.includes(item.value) ? "disabled" : "";
      return `
        <button
          class="output-toggle ${activeValue === item.value ? "is-active" : ""}"
          data-output-action="${action}"
          data-output-value="${escapeHtml(item.value)}"
          type="button"
          ${disabled}
        >
          ${escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");
}

function renderOutputCompositeParts(row) {
  if (row.field.kind !== "participants") {
    return "";
  }

  const participants = normalizeParticipants(row.value).filter(
    (participant) => participant.fullName.trim() || participant.role
  );
  if (!participants.length) {
    return "";
  }

  return `
    <div class="output-composite">
      <span class="output-composite-label">Копирование по частям</span>
      ${participants
        .map((participant, index) => {
          const fullName = participant.fullName.trim();
          const role = getParticipantRoleLabel(participant.role, row.field);
          const fullLine = `${fullName || "ФИО не указано"} (${role})`;
          return `
            <div class="output-part-row">
              <strong>Участник ${index + 1}</strong>
              <button type="button" data-output-action="copy_text" data-copy-text="${escapeHtml(fullName)}" ${fullName ? "" : "disabled"}>ФИО</button>
              <button type="button" data-output-action="copy_text" data-copy-text="${escapeHtml(role)}" ${participant.role ? "" : "disabled"}>Роль</button>
              <button type="button" data-output-action="copy_text" data-copy-text="${escapeHtml(fullLine)}">Строка</button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderOutputField(row) {
  return `
    <div class="output-field ${row.filled ? "" : "is-empty"} ${row.isMethod ? "is-method" : ""}">
      <div class="output-field-body">
        <div class="output-field-head">
          <span>${escapeHtml(row.label)}</span>
          <em class="output-source source-${row.field.sourceKind}">${escapeHtml(row.sourceLabel)}</em>
        </div>
        <div class="output-value-box">${escapeHtml(row.formattedValue)}</div>
        ${renderOutputCompositeParts(row)}
      </div>
      <button
        class="output-copy-button"
        type="button"
        data-output-action="copy_field"
        data-field-key="${escapeHtml(row.fieldKey)}"
        ${row.filled ? "" : "disabled"}
      >
        Копировать
      </button>
    </div>
  `;
}

function renderOutputIssueList(issues) {
  if (!uiState.outputShowMethodology || !issues.length) {
    return "";
  }
  return `
    <details class="output-methodology" open>
      <summary class="output-methodology-title">
        Методологические сигналы · ${issues.length}
      </summary>
      <ul>
        ${issues
          .map(
            (issue) => `
              <li class="${issue.level}">
                <strong>${escapeHtml(issue.title)}</strong>
                ${issue.ruleId ? `<em>${escapeHtml(issue.ruleId)}</em>` : ""}
                <span>${escapeHtml(issue.text)}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    </details>
  `;
}

function renderOutputSection(section) {
  const systemRows = section.rows.filter((row) => !row.isMethod);
  const methodRows = section.rows.filter((row) => row.isMethod);

  return `
    <article class="output-section-card" id="${escapeHtml(section.id)}">
      <div class="output-section-head">
        <div>
          <span class="output-section-kicker">${escapeHtml(section.stage === "call1" ? "1-й звонок" : "2-й звонок")}</span>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.hint)}</p>
        </div>
        <button
          class="output-copy-block"
          type="button"
          data-output-action="copy_block"
          data-section-id="${escapeHtml(section.id)}"
          ${section.rows.length ? "" : "disabled"}
        >
          Скопировать блок
        </button>
      </div>

      ${
        systemRows.length
          ? `<div class="output-field-list">${systemRows.map(renderOutputField).join("")}</div>`
          : `<p class="output-empty-line">Нет системных полей для текущего фильтра.</p>`
      }

      ${
        methodRows.length
          ? `
            <div class="output-method-fields">
              <span class="output-method-fields-title">Методология отдельно</span>
              <div class="output-field-list">${methodRows.map(renderOutputField).join("")}</div>
            </div>
          `
          : ""
      }

      ${renderOutputIssueList(section.issues)}
    </article>
  `;
}

function renderOutputPanel() {
  const activeCall = getActiveCall();
  if (!outputPanelRoot) {
    return;
  }

  if (!activeCall || !uiState.outputOpen) {
    outputPanelRoot.classList.add("hidden");
    outputPanelRoot.innerHTML = "";
    return;
  }

  if (uiState.outputStage === "call2" && !activeCall.call2Enabled) {
    uiState.outputStage = "call1";
  }

  const sections = buildVisibleOutputSections(activeCall);
  const progress =
    uiState.outputStage === "all"
      ? getOverallProgress(activeCall)
      : getCallProgress(activeCall, uiState.outputStage === "call2" ? 2 : 1);
  const progressPercent =
    uiState.outputStage === "all" ? progress.percent : getProgressPercent(progress);
  const disabledStages = activeCall.call2Enabled ? [] : ["call2"];
  const filledOptions = [
    { value: "filled", label: "Только заполненные" },
    { value: "all", label: "Показывать пустые" },
  ];

  outputPanelRoot.classList.remove("hidden");
  outputPanelRoot.innerHTML = `
    <div class="output-scrim" data-output-action="close"></div>
    <aside class="output-panel" role="dialog" aria-modal="true" aria-label="Вывод для менеджера">
      <header class="output-header">
        <div>
          <p class="utility-label">Вывод для менеджера</p>
          <h2>${escapeHtml(activeCall.title || activeCall.clientName || "Карточка звонка")}</h2>
          <div class="output-header-tags">
            <span>${escapeHtml(activeCall.clientName || "Клиент не указан")}</span>
            <span>${escapeHtml(getRouteLabel("purpose", activeCall.route.purpose) || "Цель не выбрана")}</span>
            <span>${escapeHtml(getRouteLabel("program", activeCall.route.program) || "Программа не выбрана")}</span>
          </div>
        </div>
        <button class="output-close" type="button" data-output-action="close">Закрыть</button>
      </header>

      <section class="output-toolbar">
        <div class="output-toolbar-group">
          <span>Стадия</span>
          <div class="output-toggle-row">
            ${renderOutputButtonGroup(outputStageOptions, uiState.outputStage, "set_stage", { disabledValues: disabledStages })}
          </div>
        </div>
        <div class="output-toolbar-group">
          <span>Режим</span>
          <div class="output-toggle-row">
            ${renderOutputButtonGroup(outputModeOptions, uiState.outputMode, "set_mode")}
          </div>
        </div>
        <div class="output-toolbar-group">
          <span>Фильтр</span>
          <div class="output-toggle-row">
            ${renderOutputButtonGroup(filledOptions, uiState.outputFilledMode, "set_filled")}
            <button
              class="output-toggle ${uiState.outputShowMethodology ? "is-active" : ""}"
              data-output-action="toggle_methodology"
              type="button"
            >
              Методология
            </button>
          </div>
        </div>
      </section>

      <section class="output-progress-row">
        <div class="output-progress-card">
          <div class="progress-card-head">
            <span class="utility-label">Прогресс вывода</span>
            <strong>${progressPercent}%</strong>
          </div>
          <div class="progress-track progress-track-main" aria-hidden="true">
            <span style="width: ${progressPercent}%"></span>
          </div>
          <p>${progress.filled}/${progress.total || 0} обязательных полей заполнено в выбранном контуре.</p>
        </div>
        <div class="output-copy-summary">
          <button class="action-button action-button-primary" type="button" data-output-action="copy_all" ${sections.length ? "" : "disabled"}>
            Скопировать видимый вывод
          </button>
          <span class="output-copy-status">${escapeHtml(uiState.outputCopyMessage || "Копируйте поле, блок или весь видимый вывод.")}</span>
        </div>
      </section>

      <div class="output-layout">
        <nav class="output-nav" aria-label="Навигация по блокам вывода">
          ${sections
            .map(
              (section) => `
                <a href="#${escapeHtml(section.id)}" class="output-nav-link ${section.status.className}">
                  <span>${escapeHtml(section.shortTitle || section.title)}</span>
                  <em>${escapeHtml(section.status.label)}</em>
                </a>
              `
            )
            .join("")}
        </nav>

        <div class="output-content">
          ${
            sections.length
              ? sections.map(renderOutputSection).join("")
              : `
                <article class="output-section-card">
                  <div class="output-section-head">
                    <div>
                      <span class="output-section-kicker">пустой вывод</span>
                      <h3>Нет данных для текущего фильтра</h3>
                      <p>Попробуйте включить “Показывать пустые” или “Методология”, либо вернитесь в блокнот и заполните поля.</p>
                    </div>
                  </div>
                </article>
              `
          }
        </div>
      </div>
    </aside>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderApp(options = {}) {
  renderBrandHeader();
  renderManagerProfile();
  renderSessionModal();
  renderJournal();
  const activeCall = getActiveCall();

  if (!activeCall) {
    workspaceTopbar.innerHTML = "";
    callOutcomeRoot.innerHTML = "";
    workspaceShell.classList.add("hidden");
    if (contradictionsRoot) {
      contradictionsRoot.innerHTML = "";
    }
    renderOutputPanel();
    renderDocumentsDrawer();
    renderCalendarDrawer();
    restoreViewState(options.viewState);
    return;
  }

  renderPickers();
  const precheckSectionsToRender = getActivePrecheckSections(routeState, formState);
  const precheckIssues = computePrecheckIssues(routeState, formState);
  const contradictions = getContradictions(routeState, formState, activeCall);
  const precheckRequiredFields = getPrecheckRequiredFieldKeys(routeState, formState);
  const missingPrecheckFields = precheckRequiredFields.filter((fieldKey) => {
    const value = formState[fieldKey];
    return value == null || value === "" || (Array.isArray(value) && value.length === 0);
  });
  const precheckReady = isPrecheckReady(routeState, formState, precheckIssues, contradictions);
  const activeNodes = precheckReady ? getActiveNodes(routeState) : [];
  const visibleNodes = precheckReady ? getVisibleNodesForStage(activeNodes, activeCall) : [];
  const precheckDisplayIssues = filterSignalsCoveredByContradictions(
    precheckIssues,
    contradictions
  );
  const flowInsights = precheckReady ? computeInsights(routeState, formState) : [];
  const flowDisplayInsights = filterSignalsCoveredByContradictions(flowInsights, contradictions);
  const allInsights = [...precheckDisplayIssues, ...flowDisplayInsights];
  const allSignals = computeAllSignals(activeCall, {
    precheckIssues: precheckDisplayIssues,
    contradictions,
    insights: flowDisplayInsights,
  });
  renderWorkspaceTopbar(precheckReady, precheckDisplayIssues, contradictions);
  renderRouteSummary(
    activeNodes,
    visibleNodes,
    allInsights,
    precheckDisplayIssues,
    precheckReady,
    contradictions,
    allSignals
  );
  renderPrecheck(precheckSectionsToRender, precheckDisplayIssues, precheckReady, contradictions);
  graphRoot.innerHTML = precheckReady
    ? `
        ${
          visibleNodes.length
            ? visibleNodes
                .map((node, index) => renderNode(node, index, flowDisplayInsights, contradictions))
                .join("")
            : `
              <article class="node-card stage-card">
                <div class="node-shell">
                  <div class="node-index">${String(getActiveStageNumber(activeCall)).padStart(2, "0")}</div>
                  <div class="node-body">
                    <div class="node-head">
                      <span class="section-kicker bridge">стадия</span>
                      <h3>Для текущей стадии нет активных узлов</h3>
                      <p>Проверьте выбранную цель кредита, программу и шаг звонка.</p>
                    </div>
                  </div>
                </div>
              </article>
            `
        }
        ${getActiveStageNumber(activeCall) === 1 ? renderStageBridge(activeCall, activeNodes) : ""}
      `
    : renderLockedGraph(precheckDisplayIssues, missingPrecheckFields, contradictions);
  renderContradictionsPanel(contradictions);
  renderInsights(allInsights, allSignals);
  renderAudit();
  renderCallOutcome(activeCall);
  renderOutputPanel();
  renderDocumentsDrawer();
  renderCalendarDrawer();
  restoreViewState(options.viewState);

  if (options.scrollToWorkspace && typeof workspaceShell.scrollIntoView === "function") {
    window.requestAnimationFrame(() => {
      workspaceShell.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

renderApp();
