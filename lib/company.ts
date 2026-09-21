/** Реквизиты оператора ПДн — замените перед продакшеном */
export const company = {
  brand: "ПерсДанные",
  legalName: 'ООО «ПерсДанные»',
  shortName: "ПерсДанные",
  inn: "7700000000",
  ogrn: "1207700000000",
  address: "123112, г. Москва, Пресненская наб., д. 12, этаж 1, офис 1",
  email: "info@persdannye.ru",
  dpoEmail: "dpo@persdannye.ru",
  phone: "+7 (495) 000-00-00",
  phoneHref: "tel:+74950000000",
  website: "https://persdannye.ru",
  /** Часы обработки обращений */
  supportHours: "пн–пт, 10:00–19:00 (МСК)",
} as const;

export type Company = typeof company;
