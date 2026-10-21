/** Editorial preview fixtures, not a published or kitchen-tested recipe collection.
 * Keep source identity and review status independent from Store product mappings.
 * Photos are illustrative stock photography; see public/assets/diy/SOURCES.md.
 */
export type RecipeCategory = 'bread' | 'buns' | 'cakes' | 'cookies' | 'pastries';
export interface DiyRecipe {
  id: string;
  title: string;
  description: string;
  category: RecipeCategory;
  image: string;
  reviewStatus: 'preview';
  source?: { creator: string; url: string; youtubeId: string };
  ingredients?: string[];
  sourceNote?: string;
}
export const diyRecipes: DiyRecipe[] = [
  { id: 'chocolate-chip-cookies', title: 'Chocolate chip cookies', description: 'A little chocolate. A good afternoon baking project.', category: 'cookies', image: '/assets/diy/cookies.webp', reviewStatus: 'preview', source: { creator: 'King Arthur Baking Company', url: 'https://www.youtube.com/watch?v=Ka3n5qB2JrE', youtubeId: 'Ka3n5qB2JrE' } },
  { id: 'soft-milk-buns', title: 'Rustic bread rolls', description: 'Golden rolls to share around the table.', category: 'buns', image: '/assets/diy/buns.webp', reviewStatus: 'preview' },
  { id: 'celebration-cake', title: 'Celebration cake', description: 'Something special for your next homemade celebration.', category: 'cakes', image: '/assets/diy/cake.webp', reviewStatus: 'preview' },
  { id: 'everyday-bread', title: 'Everyday bread', description: 'Simple pleasures, fresh from the oven.', category: 'bread', image: '/assets/diy/bread.webp', reviewStatus: 'preview' },
  { id: 'cinnamon-rolls', title: 'Cinnamon rolls', description: 'A weekend project with a warm cinnamon swirl.', category: 'pastries', image: '/assets/diy/cinnamon-rolls.webp', reviewStatus: 'preview' },
  { id: 'shortbread-cookies', title: 'Shortbread cookies', description: 'Three ingredients and a little baking curiosity.', category: 'cookies', image: '/assets/diy/cookies.webp', reviewStatus: 'preview', source: { creator: 'Yummy Kitchen Recipe', url: 'https://www.youtube.com/watch?v=te2hbuewsEM', youtubeId: 'te2hbuewsEM' }, ingredients: ['Butter — 1 cup / 16 tbsp / 230 g', 'Powdered sugar — ½ cup / 50 g', 'All-purpose flour — 2 cups / 250 g'], sourceNote: 'Ingredient wording and quantities checked against the creator’s written video description. The video, complete method, yield and translations still require editorial review.' },
  { id: 'strawberry-dessert', title: 'Strawberry dessert', description: 'A colorful finish for a homemade afternoon.', category: 'pastries', image: '/assets/diy/tart.webp', reviewStatus: 'preview' },
];
export function filterDiyRecipes(recipes: DiyRecipe[], query: string, category: string, savedOnly: boolean, saved: string[]) {
  const term = query.trim().toLocaleLowerCase();
  return recipes.filter(recipe => (category === 'all' || recipe.category === category)
    && (!savedOnly || saved.includes(recipe.id))
    && `${recipe.title} ${recipe.description} ${recipe.source?.creator ?? ''}`.toLocaleLowerCase().includes(term));
}
