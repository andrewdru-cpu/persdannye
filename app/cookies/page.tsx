import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { company } from "@/lib/company";

export const metadata: Metadata = {
  title: "Политика cookie",
};

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Политика cookie</h1>
      <p className="mt-2 text-sm text-white/45">
        Редакция от 21.09.2026 · {company.legalName}
      </p>

      <Sec title="1. Что такое cookie">
        <p>
          Cookie — небольшие фрагменты данных, которые Сайт сохраняет в браузере
          пользователя. Они помогают обеспечивать работу сервиса, запоминать выбор
          согласия и (только после согласия) измерять аудиторию.
        </p>
      </Sec>

      <Sec title="2. Какие категории мы используем">
        <ul>
          <li>
            <strong className="text-white/90">Необходимые</strong> — базовые функции
            (безопасность, сохранение выбора согласия). Включаются всегда.
          </li>
          <li>
            <strong className="text-white/90">Аналитические</strong> — измерение
            аудитории. Не включаются до согласия.
          </li>
          <li>
            <strong className="text-white/90">Маркетинговые</strong> — оценка
            рекламы. Не включаются до согласия.
          </li>
        </ul>
      </Sec>

      <Sec title="3. Как мы получаем согласие">
        <p>
          При первом визите показывается баннер: «Принять все», «Только необходимые»
          или настройка категорий. Выбор сохраняется локально. Скрипты аналитики и
          маркетинга загружаются только после согласия на соответствующую категорию.
        </p>
      </Sec>

      <Sec title="4. Срок хранения">
        <p>
          Сессионные cookie удаляются при закрытии браузера; постоянные — в пределах
          срока поставщика либо до отзыва согласия / очистки браузера.
        </p>
      </Sec>

      <Sec title="5. Управление в браузере">
        <p>
          Вы можете ограничить или удалить cookie в настройках браузера. Отключение
          необходимых cookie может повлиять на работу форм.
        </p>
      </Sec>

      <Sec title="6. Связь с обработкой ПДн">
        <p>
          Подробнее — в{" "}
          <Link href="/privacy" className="text-amber-300 hover:underline">
            Политике обработки ПДн
          </Link>
          .
        </p>
      </Sec>

      <Sec title="7. Контакты">
        <p>
          {company.email}, ДПО: {company.dpoEmail}, тел. {company.phone}.
        </p>
      </Sec>
    </article>
  );
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
