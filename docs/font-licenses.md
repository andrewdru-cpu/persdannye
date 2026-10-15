# Лицензии шрифтов

Шрифты лежат в `app/fonts/` и подключаются через `next/font/local` в `app/layout.tsx`. Сборка и браузер не ходят за файлами на fonts.googleapis.com и fonts.gstatic.com.

Полный текст SIL Open Font License 1.1 лежит рядом с файлом шрифта. Шрифты не продаются отдельно и не переименованы.

| Шрифт | Файл | Лицензия | Правообладатель |
| --- | --- | --- | --- |
| Manrope (variable, wght 200–800, латиница и кириллица) | `app/fonts/Manrope-wght.ttf` | SIL OFL 1.1, `app/fonts/OFL-manrope.txt` | Copyright 2018 The Manrope Project Authors (https://github.com/googlefonts/manrope) |
| Cormorant Garamond (variable, wght 300–700, латиница и кириллица) | `app/fonts/CormorantGaramond-wght.ttf` | SIL OFL 1.1, `app/fonts/OFL-cormorant-garamond.txt` | Copyright 2015 the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) |
| Geist Mono (variable, wght 100–900) | `app/fonts/GeistMono-wght.ttf` | SIL OFL 1.1, `app/fonts/OFL-geist-mono.txt` | Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git) |

Исходные файлы взяты из репозитория google/fonts (каталоги `ofl/manrope`, `ofl/cormorantgaramond`, `ofl/geistmono`) вместе с их `OFL.txt`.
