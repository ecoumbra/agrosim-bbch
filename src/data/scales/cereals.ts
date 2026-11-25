import type { L10n, Stage } from '../../types';

/**
 * Індивідуальна шкала BBCH для зернових (пшениця, ячмінь, жито, овес, тритикале).
 * Джерело структури: BBCH Monograph (Meier, JKI, 2018) — ref-bbch; коди й визначення звірено з ref-wiki-cereals, ref-purdue, ref-agvic.
 * Українські назви — авторський переклад (ref-ua-terms). Текст «howToCheck» — методичний, авторський.
 */
const SRC = ['ref-bbch', 'ref-wiki-cereals', 'ref-purdue', 'ref-agvic'];
const L = (uk: string, en: string): L10n => ({ uk, en });
const st = (code: number, name: L10n, description: L10n, extra: Partial<Stage> = {}): Stage => ({
  code, principal: Math.floor(code / 10), name, description, verification: 'cross-checked', refs: SRC, ...extra,
});
const NUM_UK = ['', 'Один', 'Два', 'Три', 'Чотири', 'П’ять', 'Шість', 'Сім', 'Вісім'];

const raw: Stage[] = [];
raw.push(
  st(0, L('Сухе насіння', 'Dry seed'), L('Сухе насіння (зернівка) до початку набухання.', 'Dry seed (caryopsis).')),
  st(1, L('Початок набухання насіння', 'Beginning of seed imbibition'), L('Зернівка починає поглинати воду.', 'Seed begins to take up water.')),
  st(3, L('Набухання насіння завершено', 'Seed imbibition complete'), L('Зернівка набухла повністю.', 'Imbibition of the seed is complete.')),
  st(5, L('Корінець вийшов із зернівки', 'Radicle emerged from caryopsis'), L('Зародковий корінець (радикула) пробив оболонку зернівки.', 'The radicle has emerged from the caryopsis.')),
  st(6, L('Корінець видовжився', 'Radicle elongated'), L('Видно кореневі волоски та/або бічні корені.', 'Root hairs and/or side roots visible.')),
  st(7, L('Колеоптиль вийшов із зернівки', 'Coleoptile emerged from caryopsis'), L('Захисний піхвовий листок (колеоптиль) вийшов із зернівки.', 'The coleoptile has emerged from the caryopsis.')),
  st(9, L('Сходи', 'Emergence'), L('Колеоптиль пробиває поверхню ґрунту.', 'Coleoptile penetrates the soil surface (cracking stage).'), { traditional: L('сходи', 'emergence') }),
  st(10, L('Перший листок вийшов із колеоптиля', 'First leaf through coleoptile'), L('Верхівка першого справжнього листка проходить крізь колеоптиль.', 'The first leaf emerges through the coleoptile.')),
);
for (let n = 1; n <= 9; n++) {
  raw.push(st(10 + n,
    n === 1 ? L('Перший листок розгорнувся', 'First leaf unfolded') : n === 9 ? L('Дев’ять і більше листків розгорнулось', '9 or more leaves unfolded') : L(`${NUM_UK[n]} листки розгорнулось`.replace('листки розгорнулось', n < 5 ? 'листки розгорнулись' : 'листків розгорнулось'), `${n} leaves unfolded`),
    L('Листок вважають розгорнутим, коли видно його язичок або верхівку наступного листка. Підраховують листки головного пагона.', 'A leaf is unfolded when its ligule is visible or the tip of the next leaf is visible. Leaves of the main shoot are counted.'),
    n >= 1 ? { howToCheck: L('Позначте перший листок і рахуйте розгорнуті листки головного пагона: листок зарахований, якщо видно язичок.', 'Mark the first leaf and count unfolded leaves of the main shoot; a leaf counts when its ligule is visible.') } : {}));
}
raw.push(st(21, L('Початок кущіння', 'Beginning of tillering'), L('Помітний перший пагін кущіння.', 'First tiller detectable.'), { traditional: L('кущіння', 'tillering') }));
for (let n = 2; n <= 8; n++) raw.push(st(20 + n, L(`${NUM_UK[n]} пагони кущіння`, `${n} tillers detectable`), L(`Помітно ${n} пагонів кущіння (крім головного).`, `${n} tillers detectable.`), { traditional: L('кущіння', 'tillering') }));
raw.push(st(29, L('Кінець кущіння', 'End of tillering'), L('Помітна максимальна кількість пагонів кущіння.', 'Maximum number of tillers detectable.'), { traditional: L('кущіння', 'tillering') }));
raw.push(
  st(30, L('Початок виходу в трубку', 'Beginning of stem elongation'), L('Псевдостебло й пагони кущіння прямостоячі, перше міжвузля починає видовжуватися; верхівка зачатка колоса щонайменше на 1 см вище вузла кущіння.', 'Pseudostem and tillers erect, first internode begins to elongate, top of inflorescence at least 1 cm above tillering node.'),
    { traditional: L('вихід у трубку', 'jointing'), howToCheck: L('Розріжте стебло вздовж: від вузла кущіння (біла основа) до верхівки зачатка колоса — не менше 1 см. Зачаток колоса видно на розрізі як світле утворення з майбутніми колосками.', 'Cut a stem lengthwise: at least 1 cm from the tillering node (pale base) to the tip of the inflorescence primordium.') }),
  st(31, L('Перший вузол ≥ 1 см над вузлом кущіння', '1st node ≥ 1 cm above tillering node'), L('Перший вузол розташований щонайменше на 1 см вище вузла кущіння.', 'First node at least 1 cm above tillering node.'),
    { traditional: L('вихід у трубку', 'jointing'), howToCheck: L('Промацайте стебло або розріжте його: перший щільний вузол виступає над вузлом кущіння щонайменше на 1 см.', 'Feel or cut the stem: the first firm node is at least 1 cm above the tillering node.') }),
  st(32, L('Другий вузол ≥ 2 см над першим', '2nd node ≥ 2 cm above 1st node'), L('Вузол 2 щонайменше на 2 см вище вузла 1.', 'Node 2 at least 2 cm above node 1.'), { traditional: L('вихід у трубку', 'jointing') }),
  st(33, L('Третій вузол ≥ 2 см над другим', '3rd node ≥ 2 cm above 2nd node'), L('Вузол 3 щонайменше на 2 см вище вузла 2. Далі стадії тривають за номером вузла аж до прапорцевого листка.', 'Node 3 at least 2 cm above node 2. Stages continue by node number until the flag leaf.'), { traditional: L('вихід у трубку', 'jointing') }),
  st(37, L('Прапорцевий лист ледь видно', 'Flag leaf just visible'), L('Прапорцевий (останній) лист ледь видно, він ще згорнутий.', 'Flag leaf just visible, still rolled.'),
    { howToCheck: L('Розсуньте піхви верхніх листків: верхівка останнього листка вже видна, але лист ще скручений у трубку.', 'Part the upper leaf sheaths: the tip of the last leaf is visible but still rolled.') }),
  st(39, L('Фаза прапорцевого листка', 'Flag leaf stage'), L('Прапорцевий лист повністю розгорнутий, язичок ледь видно.', 'Flag leaf fully unrolled, ligule just visible.'),
    { traditional: L('поява прапорцевого листка', 'flag leaf'), howToCheck: L('Знайдіть язичок на прапорцевому листку: він видимий, лист розгорнутий. Язичок — найнадійніший орієнтир.', 'Find the ligule on the flag leaf: it is visible and the leaf is unrolled.') }),
  st(41, L('Початок «черевця»', 'Early boot stage'), L('Піхва прапорцевого листка видовжується.', 'Flag leaf sheath extending.'), { traditional: L('«черевце» (роздування піхви)', 'booting') }),
  st(43, L('Середина «черевця»', 'Mid boot stage'), L('Піхва прапорцевого листка ледь помітно роздута.', 'Flag leaf sheath just visibly swollen.'), { traditional: L('«черевце» (роздування піхви)', 'booting') }),
  st(45, L('Пізня стадія «черевця»', 'Late boot stage'), L('Піхва прапорцевого листка роздута: колос усередині, але його ще не видно.', 'Flag leaf sheath swollen.'), { traditional: L('«черевце» (роздування піхви)', 'booting'), howToCheck: L('Піхва прапорцевого листка помітно здута, колос усередині ще не видно.', 'The flag leaf sheath is clearly swollen; the ear inside is not yet visible.') }),
  st(47, L('Піхва прапорцевого листка розкривається', 'Flag leaf sheath opening'), L('Піхва розкривається, готуючись випустити колос.', 'Flag leaf sheath opening.'), { traditional: L('«черевце» (роздування піхви)', 'booting') }),
  st(49, L('З’явилися перші ості', 'First awns visible'), L('Перші ості видно (лише в остистих форм).', 'First awns visible (in awned forms only).'), { traditional: L('«черевце» (роздування піхви)', 'booting') }),
  st(51, L('Початок колосіння', 'Beginning of heading'), L('Верхівка суцвіття (колоса) вийшла з піхви, перший колосок ледь видно.', 'Tip of inflorescence emerged from sheath, first spikelet just visible.'), { traditional: L('колосіння', 'heading'), howToCheck: L('Верхівка колоса вийшла з піхви; видно перший колосок.', 'The ear tip has emerged from the sheath; the first spikelet is visible.') }),
);
for (const p of [2, 3, 4, 5, 6, 7, 8]) raw.push(st(50 + p,
  p === 5 ? L('Середина колосіння', 'Middle of heading') : L(`Вийшло ${p * 10} % колоса`, `${p * 10} % of inflorescence emerged`),
  p === 5 ? L('Вийшла половина колоса.', 'Half of the inflorescence emerged.') : L(`З піхви вийшло приблизно ${p * 10} % суцвіття.`, `About ${p * 10} % of the inflorescence has emerged.`),
  { traditional: L('колосіння', 'heading'), ...(p === 5 ? { howToCheck: L('Оцініть частку колоса, що вийшла з піхви, на кількох рослинах і візьміть типове значення.', 'Estimate the share of the ear out of the sheath on several plants.') } : {}) }));
raw.push(
  st(59, L('Кінець колосіння', 'End of heading'), L('Суцвіття повністю вийшло з піхви.', 'Inflorescence fully emerged.'), { traditional: L('колосіння', 'heading') }),
  st(61, L('Початок цвітіння', 'Beginning of flowering'), L('Видно перші пиляки.', 'First anthers visible.'), { traditional: L('цвітіння', 'flowering'), howToCheck: L('Шукайте перші пиляки, насамперед у середній частині колоса: цвітіння зазвичай починається звідти.', 'Look for the first anthers, mainly in the middle of the ear, where flowering usually begins.') }),
  st(65, L('Повне цвітіння', 'Full flowering'), L('Приблизно 50 % пиляків дозріли.', '50 % of anthers mature.'), { traditional: L('цвітіння', 'flowering') }),
  st(69, L('Кінець цвітіння', 'End of flowering'), L('Усі колоски відцвіли; можуть лишатися висохлі пиляки.', 'All spikelets have completed flowering but some dehydrated anthers may remain.'), { traditional: L('цвітіння', 'flowering') }),
  st(71, L('Водяниста стиглість', 'Watery ripe'), L('Перші зернівки досягли половини кінцевого розміру.', 'First grains have reached half their final size.'), { traditional: L('молочна стиглість', 'milk') }),
  st(73, L('Рання молочна стиглість', 'Early milk'), L('Вміст зернівки молочний, зерно росте.', 'Early milk stage.'), { traditional: L('молочна стиглість', 'milk') }),
  st(75, L('Середня молочна стиглість', 'Medium milk'), L('Вміст зернівки молочний, зерно досягло кінцевого розміру, ще зелене.', 'Grain content milky, grains reached final size, still green.'), { traditional: L('молочна стиглість', 'milk'), howToCheck: L('Роздавіть зернівку: з неї виступає молочно-білий вміст, зерно має кінцевий розмір і зелене.', 'Squeeze a grain: milky content appears; the grain is full size and still green.') }),
  st(77, L('Пізня молочна стиглість', 'Late milk'), L('Кінець молочної стадії: вміст густішає.', 'Late milk stage.'), { traditional: L('молочна стиглість', 'milk') }),
  st(83, L('Рання тістоподібна стадія', 'Early dough'), L('Початок тістоподібної стадії: вміст зернівки втрачає молочність.', 'Early dough stage.'), { traditional: L('воскова (тістоподібна) стиглість — орієнтовно', 'dough') }),
  st(85, L('М’яка тістоподібна стадія', 'Soft dough'), L('Вміст зернівки м’який, але сухий; відбиток нігтя не зберігається.', 'Grain content soft but dry. Fingernail impression not held.'), { traditional: L('воскова (тістоподібна) стиглість — орієнтовно', 'dough'), howToCheck: L('Натисніть нігтем на зернівку: вміст м’який, сухий; відбиток зникає.', 'Press a grain with the fingernail: soft, dry content; the impression is not held.') }),
  st(87, L('Тверда тістоподібна стадія', 'Hard dough'), L('Вміст зернівки твердий; відбиток нігтя зберігається.', 'Grain content solid. Fingernail impression held.'), { traditional: L('воскова (тістоподібна) стиглість — орієнтовно', 'dough'), howToCheck: L('Натисніть нігтем: вміст твердий, відбиток нігтя лишається.', 'Press with the fingernail: solid content; the impression is held.') }),
  st(89, L('Повна стиглість', 'Fully ripe'), L('Зерно тверде, його важко розділити нігтем.', 'Grain hard, difficult to divide with thumbnail.'), { traditional: L('повна стиглість', 'ripe'), howToCheck: L('Зерно тверде; нігтем розділити важко.', 'The grain is hard; difficult to divide with the thumbnail.') }),
  st(92, L('Перестигання', 'Over-ripe'), L('Зерно дуже тверде, нігтем його не продавити.', 'Grain very hard, cannot be dented by thumbnail.'), { traditional: L('перестигання', 'over-ripe') }),
  st(93, L('Зерно обсипається в денний час', 'Grains loosening in day-time'), L('Зернівки починають осипатися протягом дня.', 'Grains loosening in day-time.'), { traditional: L('перестигання', 'over-ripe') }),
  st(97, L('Рослина відмерла й полягла', 'Plant dead and collapsing'), L('Рослина повністю відмерла й полягає.', 'Plant dead and collapsing.')),
  st(99, L('Зібраний урожай', 'Harvested product'), L('Фаза після збирання врожаю.', 'Harvested product.')),
);

/** Усі стадії від 30 мають сусідні фази, з якими їх найчастіше плутають (для тренажера). */
export const cerealStages: Stage[] = raw
  .sort((a, b) => a.code - b.code)
  .map((s, i, all) => (s.code >= 30 && s.howToCheck ? { ...s, confusableWith: [all[i - 1]?.code, all[i + 1]?.code].filter((c): c is number => c !== undefined) } : s));
