/**
 * Placeholder copy for subject-request pages.
 * needs_legal_review — do not treat these sentences as a finished legal text.
 */
export const legalContent = {
  needs_legal_review: true as const,
  unsubscribeTitle: "Отказ от рассылки",
  unsubscribeLead:
    "Черновик. Эта страница подтверждает отказ от рассылки по коду из письма. Сама по себе ссылка ничего не отправляет.",
  unsubscribeConfirm: "Подтвердить отказ",
  unsubscribeMissingToken:
    "Черновик. В ссылке нет кода. Откройте письмо ещё раз или оставьте запрос с адресом почты.",
  privacyRequestTitle: "Запрос субъекта персональных данных",
  privacyRequestLead:
    "Черновик. Здесь можно запросить сведения об обработке, удаление или отказ от рассылки.",
  privacyNotice:
    "Черновик. Отдельная отметка согласия для этого обращения не требуется: запрос нужен, чтобы реализовать права субъекта. Формулировку должен проверить юрист.",
  privacySubmit: "Отправить запрос",
  successMessage:
    "Запрос принят. Мы не сообщаем, есть ли такой адрес или код в базе.",
  requestIdLabel: "Номер обращения",
  directOnly:
    "Черновик. Отправка работает только в режиме прямой связи с публичным API и на этой странице не уходит через сервер сайта.",
  captchaRequired: "Подтвердите, что вы не робот",
  emailRequired: "Укажите адрес электронной почты",
  types: {
    unsubscribe: "Отказ от рассылки",
    access: "Запрос сведений об обработке",
    delete: "Запрос на удаление",
  },
} as const;
