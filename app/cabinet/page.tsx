import type { Metadata } from "next";
import { listLeads } from "@/lib/leads-store";

export const metadata: Metadata = {
  title: "Кабинет (MVP)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CabinetPage() {
  const leads = await listLeads();

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white">Кабинет · лиды (MVP)</h1>
      <p className="mt-2 text-sm text-white/55">
        Простой список заявок из <code className="text-amber-200">data/leads.json</code>.
        Без авторизации — только для локальной разработки.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Сайт</th>
              <th className="px-4 py-3 font-medium">Источник</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/45">
                  Заявок пока нет
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="border-t border-white/5 text-white/80">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("ru-RU", {
                      timeZone: "Europe/Moscow",
                    })}
                  </td>
                  <td className="px-4 py-3">{l.name}</td>
                  <td className="px-4 py-3">{l.email}</td>
                  <td className="px-4 py-3">{l.phone || "—"}</td>
                  <td className="px-4 py-3">{l.url || "—"}</td>
                  <td className="px-4 py-3">{l.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
