import type { Crop } from '../types';
import { cerealStages } from './scales/cereals';

export const crops: Crop[] = [
  {
    id: 'winter-wheat', name: { uk: 'Озима пшениця', en: 'Winter wheat' }, latin: 'Triticum aestivum L.', scale: 'cereals', available: true, stages: cerealStages,
    ukraineNote: {
      uk: 'Озима пшениця сіється восени: восени проходять фази 00–2x (сходи, кущіння), узимку вегетація припиняється, навесні кущіння відновлюється, далі йдуть вихід у трубку, колосіння, цвітіння, молочна й воскова стиглість. Календарні строки залежать від зони, сорту й погоди, тому в навчальній версії без джерела не наводяться.',
      en: 'Winter wheat is sown in autumn: emergence and tillering (00–2x) occur before winter, growth pauses in winter and resumes in spring with stem elongation, heading, flowering, milk and dough stages. Calendar dates depend on region, cultivar and weather and are not given without a source.',
    },
  },
  { id: 'maize', name: { uk: 'Кукурудза', en: 'Maize' }, latin: 'Zea mays L.', scale: 'maize', available: false, stages: [], ukraineNote: { uk: 'Буде на етапі 5.', en: 'Planned for stage 5.' } },
  { id: 'sunflower', name: { uk: 'Соняшник', en: 'Sunflower' }, latin: 'Helianthus annuus L.', scale: 'sunflower', available: false, stages: [], ukraineNote: { uk: 'Буде на етапі 5.', en: 'Planned for stage 5.' } },
  { id: 'rapeseed', name: { uk: 'Озимий ріпак', en: 'Winter oilseed rape' }, latin: 'Brassica napus L.', scale: 'rape', available: false, stages: [], ukraineNote: { uk: 'Буде на етапі 5.', en: 'Planned for stage 5.' } },
  { id: 'sugar-beet', name: { uk: 'Цукровий буряк', en: 'Sugar beet' }, latin: 'Beta vulgaris L.', scale: 'beet', available: false, stages: [], ukraineNote: { uk: 'Буде на етапі 5.', en: 'Planned for stage 5.' } },
];
