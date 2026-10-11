"use client";

import { useMemo, useState } from "react";
import { CheckLink } from "@/components/landing/CheckLink";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  calculatorCopy,
  emptyAnswers,
  resolveCalculator,
  type CalcAnswers,
  type Counters,
  type Owner,
  type Tri,
} from "@/content/calculator";
import { flags } from "@/content/flags";

function Choice({
  name,
  value,
  current,
  onChange,
  label,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="accent-amber-400"
      />
      {label}
    </label>
  );
}

export function RiskCalculator() {
  const [answers, setAnswers] = useState<CalcAnswers>(emptyAnswers);
  const view = useMemo(() => resolveCalculator(answers), [answers]);
  const patch = (next: Partial<CalcAnswers>) => setAnswers((prev) => ({ ...prev, ...next }));

  function setForeign(kind: "analytics" | "storage" | "none" | "unknown") {
    setAnswers((prev) => {
      if (kind === "none") {
        return { ...prev, foreignNone: true, foreignUnknown: false, foreignAnalytics: false, foreignStorage: false };
      }
      if (kind === "unknown") {
        return { ...prev, foreignUnknown: true, foreignNone: false, foreignAnalytics: false, foreignStorage: false };
      }
      return {
        ...prev,
        foreignNone: false,
        foreignUnknown: false,
        foreignAnalytics: kind === "analytics" ? !prev.foreignAnalytics : prev.foreignAnalytics,
        foreignStorage: kind === "storage" ? !prev.foreignStorage : prev.foreignStorage,
      };
    });
  }

  const showFollowups = answers.collects === "yes";

  return (
    <section id="calculator" className="scroll-mt-24 border-y border-amber-200/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">Справочно</p>
        <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold text-white md:text-5xl">
          {calculatorCopy.title}
        </h2>
        <p className="mt-3 max-w-2xl text-white/60">{calculatorCopy.lead}</p>
        {flags.calc_client_only ? (
          <p className="mt-3 max-w-2xl text-sm text-white/50">{calculatorCopy.clientOnly}</p>
        ) : null}

        <div className="mt-8 grid gap-4">
          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">Кто владелец сайта?</legend>
              <p className="mt-1 text-xs text-white/45">Суммы для ИП и юрлиц разные.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Choice name="owner" value="ip" current={answers.owner} label="ИП" onChange={(value) => patch({ owner: value as Owner })} />
                <Choice name="owner" value="legal" current={answers.owner} label="ООО или другое юрлицо" onChange={(value) => patch({ owner: value as Owner })} />
              </div>
            </fieldset>
          </GlassCard>

          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">Сайт собирает данные посетителей?</legend>
              <p className="mt-1 text-xs text-white/45">Форма заявки, обратный звонок, онлайн-запись, чат, регистрация, оформление заказа.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["yes", "no", "unknown"] as Tri[]).map((value) => (
                  <Choice
                    key={value}
                    name="collects"
                    value={value}
                    current={answers.collects}
                    label={value === "yes" ? "Да" : value === "no" ? "Нет" : "Не знаю"}
                    onChange={(next) => patch({ collects: next as Tri })}
                  />
                ))}
              </div>
            </fieldset>
            {showFollowups ? (
              <div className="mt-5 grid gap-5">
                <fieldset>
                  <legend className="text-sm font-medium text-white">
                    Рядом с формой есть отдельная галочка согласия на обработку данных, которая не стоит заранее?
                  </legend>
                  <p className="mt-1 text-xs text-white/45">Согласие оформляется отдельно от других документов (152-ФЗ ст. 9 ч. 1, с 01.09.2025).</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(["yes", "no", "unknown"] as Tri[]).map((value) => (
                      <Choice
                        key={value}
                        name="consent"
                        value={value}
                        current={answers.consentSeparate}
                        label={value === "yes" ? "Да" : value === "no" ? "Нет" : "Не знаю"}
                        onChange={(next) => patch({ consentSeparate: next as Tri })}
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-medium text-white">
                    В формах спрашиваете сведения о здоровье или биометрию (например, фото для идентификации)?
                  </legend>
                  <p className="mt-1 text-xs text-white/45">Например, анкета с противопоказаниями. Для таких сведений закон требует письменное согласие, если вы не медицинская организация.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(["yes", "no", "unknown"] as Tri[]).map((value) => (
                      <Choice
                        key={value}
                        name="special"
                        value={value}
                        current={answers.special}
                        label={value === "yes" ? "Да" : value === "no" ? "Нет" : "Не знаю"}
                        onChange={(next) => patch({ special: next as Tri })}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : null}
          </GlassCard>

          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">На сайте опубликована политика обработки персональных данных?</legend>
              <p className="mt-1 text-xs text-white/45">Обычно это ссылка в подвале сайта.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["yes", "no", "unknown"] as Tri[]).map((value) => (
                  <Choice
                    key={value}
                    name="policy"
                    value={value}
                    current={answers.policy}
                    label={value === "yes" ? "Да" : value === "no" ? "Нет" : "Не знаю"}
                    onChange={(next) => patch({ policy: next as Tri })}
                  />
                ))}
              </div>
            </fieldset>
          </GlassCard>

          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">На сайте стоят счётчики аналитики (Яндекс Метрика и т. п.)?</legend>
              <div className="mt-3 grid gap-2">
                {(
                  [
                    ["gated", "Да, и до согласия посетителя они не загружаются"],
                    ["ungated", "Да, но баннера нет или он только информирует"],
                    ["no", "Нет"],
                    ["unknown", "Не знаю"],
                  ] as const
                ).map(([value, label]) => (
                  <Choice
                    key={value}
                    name="counters"
                    value={value}
                    current={answers.counters}
                    label={label}
                    onChange={(next) => patch({ counters: next as Counters })}
                  />
                ))}
              </div>
            </fieldset>
          </GlassCard>

          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">Пользуетесь иностранными сервисами?</legend>
              <p className="mt-1 text-xs text-white/45">Это разные ситуации, и правила для них разные. Можно выбрать оба первых пункта.</p>
              <div className="mt-3 grid gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" className="accent-amber-400" checked={answers.foreignAnalytics} onChange={() => setForeign("analytics")} />
                  Иностранная аналитика или рекламные пиксели
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" className="accent-amber-400" checked={answers.foreignStorage} onChange={() => setForeign("storage")} />
                  Заявки из форм или чата сохраняются в иностранном сервисе (CRM, таблицы, формы)
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" className="accent-amber-400" checked={answers.foreignNone} onChange={() => setForeign("none")} />
                  Нет
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" className="accent-amber-400" checked={answers.foreignUnknown} onChange={() => setForeign("unknown")} />
                  Не знаю
                </label>
              </div>
            </fieldset>
          </GlassCard>

          <GlassCard className="p-5">
            <fieldset>
              <legend className="font-medium text-white">Вы подавали уведомление в Роскомнадзор об обработке персональных данных?</legend>
              <p className="mt-1 text-xs text-white/45">Его подают до начала обработки (152-ФЗ ст. 22).</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["yes", "no", "unknown"] as Tri[]).map((value) => (
                  <Choice
                    key={value}
                    name="notice"
                    value={value}
                    current={answers.notice}
                    label={value === "yes" ? "Да" : value === "no" ? "Нет" : "Не знаю"}
                    onChange={(next) => patch({ notice: next as Tri })}
                  />
                ))}
              </div>
            </fieldset>
          </GlassCard>
        </div>

        {view.cards.length > 0 || view.unknowns.length > 0 || view.clear ? (
          <div className="mt-8 grid gap-4">
            {view.cards.length > 0 ? (
              <h3 className="font-display text-3xl text-white">{calculatorCopy.resultTitle}</h3>
            ) : null}
            {view.cards.map((card) => (
              <GlassCard key={card.id} className={`p-5 ${card.neutral ? "" : "border-amber-200/20"}`}>
                <div className="text-xs uppercase tracking-[0.16em] text-amber-200/80">{card.norm}</div>
                <div className="mt-2 font-display text-2xl text-white">{card.title}</div>
                {card.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-relaxed text-white/70">{paragraph}</p>
                ))}
                {card.fixes.map((fix) => (
                  <p key={fix} className="mt-3 text-sm leading-relaxed text-white/80">{fix}</p>
                ))}
              </GlassCard>
            ))}
            {view.unknowns.map((label) => (
              <p key={label} className="text-sm text-white/70">
                {label}: {calculatorCopy.unknownLine}
              </p>
            ))}
            {view.manyUnknowns ? <p className="text-sm text-white/70">{calculatorCopy.manyUnknowns}</p> : null}
            {view.clear ? <p className="text-sm leading-relaxed text-white/70">{calculatorCopy.noHits}</p> : null}
            {view.cards.length > 0 ? <p className="text-sm text-white/60">{calculatorCopy.separate}</p> : null}
            <p className="text-xs leading-relaxed text-white/45">{calculatorCopy.footnote}</p>
            <p className="text-xs leading-relaxed text-white/55">{calculatorCopy.disclaimer}</p>
            <CheckLink className="btn-gold inline-flex min-h-11 w-fit items-center rounded-2xl px-6 py-3 text-sm">
              {calculatorCopy.cta}
            </CheckLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
