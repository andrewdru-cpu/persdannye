export const COLLECTION_CLOSED_NOTICE = "Приём заявок временно приостановлен";

export function CollectionClosed() {
  return (
    <p
      role="status"
      className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-4 text-sm leading-relaxed text-white/85"
    >
      {COLLECTION_CLOSED_NOTICE}
    </p>
  );
}
