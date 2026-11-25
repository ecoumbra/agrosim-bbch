export type Lang = 'uk' | 'en';
export interface L10n { uk: string; en: string }

/** cross-checked — коди й визначення звірено з ≥2 вторинними джерелами, що походять від монографії BBCH;
 *  authored — педагогічний текст автора проєкту (перевірити викладачем); unverified — потребує перевірки. */
export type Verification = 'cross-checked' | 'authored' | 'unverified';

export interface Stage {
  code: number;
  principal: number;
  name: L10n;
  description: L10n;
  /** Як визначити в полі (авторський методичний текст) */
  howToCheck?: L10n;
  /** З якими фазами найчастіше плутають */
  confusableWith?: number[];
  /** Традиційна українська назва (орієнтовна відповідність) */
  traditional?: L10n;
  verification: Verification;
  refs: string[];
}
export interface PrincipalStage { id: number; name: L10n }
export interface Crop {
  id: string;
  name: L10n;
  latin: string;
  /** Індивідуальна шкала BBCH, на якій побудовано стадії */
  scale: string;
  stages: Stage[];
  ukraineNote: L10n;
  available: boolean;
}
export interface Reference { id: string; citation: string; url?: string; license?: string; status: 'primary' | 'secondary' | 'todo' }

/** Фото з відкритого джерела (запис у `src/data/photos.manifest.json`; правила — `docs/PHOTOS.md`). */
export interface Photo {
  id: string;
  /** id культури (`Crop.id`). */
  crop: string;
  /** Код BBCH, підтверджений експертом або описом у джерелі. */
  code: number;
  /** URL сторінки файлу (там перевірено автора й ліцензію). */
  source: string;
  author: string;
  /** Канонічна дозволена ліцензія: CC0, CC BY x.y, CC BY-SA x.y, Public domain. */
  license: string;
  /** Підпис автора для показу біля фото (без коду фази). */
  attribution: string;
  /** Нейтральне ім'я файлу в `public/photos/`. */
  file: string;
  /** Дата перевірки ліцензії на сторінці файлу, YYYY-MM-DD. */
  checked: string;
  /** Хто підтвердив код BBCH: ім'я експерта або `source` (код указано в описі джерела). */
  verifiedBy: string;
}
