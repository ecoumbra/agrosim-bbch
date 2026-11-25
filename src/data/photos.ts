import type { Photo } from '../types';
import { validPhotos } from '../engine/photos';
import { crops } from './crops';
import manifest from './photos.manifest.json';

/** Фото з маніфесту, що пройшли перевірку. Порожньо, поки фото не додано (тренажер тоді працює на SVG). */
export const PHOTOS: Photo[] = validPhotos(manifest as unknown, crops, new Date().toISOString().slice(0, 10));
