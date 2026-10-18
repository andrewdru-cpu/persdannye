/**
 * Тексты оферты, возврата и удаления данных.
 * null, пока юрист их не отдал: страницы не выдумывают условия.
 */
export type LegalDocument = {
  title: string;
  edition: string;
  blocks: readonly string[];
};

export const offerDocument: LegalDocument | null = null;
export const refundDocument: LegalDocument | null = null;
export const dataDeletionDocument: LegalDocument | null = null;
