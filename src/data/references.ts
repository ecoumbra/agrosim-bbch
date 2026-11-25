import type { Reference } from '../types';

// Лише реальні джерела. Перевірено під час розробки: сторінки відкривались і містили наведені дані.
export const references: Reference[] = [
  { id: 'ref-bbch', status: 'primary', license: 'CC BY 4.0',
    citation: 'Meier U. (ed.). Growth stages of mono- and dicotyledonous plants: BBCH Monograph. Julius Kühn-Institut (JKI), Quedlinburg, 2018. DOI: 10.5073/20180906-074619. ISBN 978-3-95547-071-5.',
    url: 'https://www.openagrar.de/servlets/MCRFileNodeServlet/openagrar_derivate_00016780/BBCH%20ENGLISCH_%20.pdf' },
  { id: 'ref-bbch-2001', status: 'secondary',
    citation: 'Meier U. (ed.). Growth stages of mono- and dicotyledonous plants: BBCH Monograph. 2nd edition. Federal Biological Research Centre for Agriculture and Forestry (BBA), 2001. Використано: загальна частина (для стадії посіву опис має виконуватись щонайменше для 50% рослин; береться головне стебло) і тексти шкали зернових про сантиметри над вузлом кущіння (30–33) та перевірку нігтем (85–92). Звірено за копією тексту на сайті DAERA NI 2026-11-22; формулювання у виданні 2018 не звірено.',
    url: 'https://www.daera-ni.gov.uk/sites/default/files/2026-07/BBCH-Skala_en.pdf' },
  { id: 'ref-wiki-cereals', status: 'secondary', license: 'CC BY-SA',
    citation: 'BBCH-scale (cereals), Wikipedia — таблиця BBCH-кодів зернових (похідна від монографії).',
    url: 'https://en.wikipedia.org/wiki/BBCH-scale_(cereals)' },
  { id: 'ref-purdue', status: 'secondary',
    citation: 'Purdue University Extension (Entomology): Table 1. Soft Red Winter Wheat Crop Growth Stages (десяткові коди Zadoks).',
    url: 'https://www.extension.entm.purdue.edu/pestcrop/2005/issue2/table2.html' },
  { id: 'ref-agvic', status: 'secondary',
    citation: 'Agriculture Victoria: Decimal growth scale of cereals.',
    url: 'https://agriculture.vic.gov.au/crops-and-horticulture/grains-pulses-and-cereals/crop-production/general-agronomy/decimal-growth-scale-of-cereals' },
  { id: 'ref-uw', status: 'secondary',
    citation: 'University of Wisconsin: Wheat Growth and Development (Zadoks, Feekes, Haun).',
    url: 'https://corn.aae.wisc.edu/Crops/Wheat/L007.aspx' },
  { id: 'ref-ua-terms', status: 'todo',
    citation: 'Українська термінологія фаз (традиційні назви, відповідність до BBCH) — узгодити з кафедрою за підручником з рослинництва; видання вказує викладач.' },
];
