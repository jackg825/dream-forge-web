/**
 * Showcase models configuration
 *
 * Admin workflow:
 * 1. Upload GLB model to R2: wrangler r2 object put dream-forge-storage/public/showcase/{id}.glb --file ./model.glb
 * 2. Upload thumbnail: wrangler r2 object put dream-forge-storage/public/showcase/{id}.webp --file ./thumb.webp
 * 3. Add entry to this file and deploy
 */

export type ShowcaseCategory = 'product' | 'character' | 'environment' | 'concept';

export interface ShowcaseModel {
  id: string;
  category: ShowcaseCategory;
  // R2 URLs - served via storage.dreamforge.app/public/showcase/
  modelUrl: string;
  thumbnailUrl: string;
  // Optional before/after images for comparison view
  beforeImage?: string;
  afterImage?: string;
}

const R2_PUBLIC_URL = 'https://storage.dreamforge.app/public/showcase';

/**
 * Curated showcase models
 * Order determines display order in the UI
 */
export const showcaseModels: ShowcaseModel[] = [
  {
    id: 'racecar',
    category: 'product',
    modelUrl: `${R2_PUBLIC_URL}/racecar.glb`,
    thumbnailUrl: `${R2_PUBLIC_URL}/racecar.webp`,
    // Keep existing before/after images for comparison view
    beforeImage: '/showcase/race_car_origin.jpg',
    afterImage: '/showcase/race_car_render.png',
  },
  // Add more showcase models here:
  // {
  //   id: 'robot',
  //   category: 'character',
  //   modelUrl: `${R2_PUBLIC_URL}/robot.glb`,
  //   thumbnailUrl: `${R2_PUBLIC_URL}/robot.webp`,
  // },
];

/**
 * Get showcase model by ID
 */
export function getShowcaseById(id: string): ShowcaseModel | undefined {
  return showcaseModels.find(model => model.id === id);
}

/**
 * Get showcase models by category
 */
export function getShowcasesByCategory(category: ShowcaseCategory): ShowcaseModel[] {
  return showcaseModels.filter(model => model.category === category);
}
