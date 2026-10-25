/**
 * Typical nutrition per serving for the 101 dishes the photo model recognises
 * (Food-101 labels). Values are rounded estimates for a common restaurant/home
 * portion — real dishes vary a lot, so the user always reviews before saving.
 */
export interface DishNutrition {
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Row = [label: string, name: string, serving: string, kcal: number, protein: number, carbs: number, fat: number];

const ROWS: Row[] = [
  ["apple_pie", "Apple pie", "1 slice (125 g)", 300, 2.5, 43, 14],
  ["baby_back_ribs", "Baby back ribs", "½ rack (250 g)", 650, 45, 20, 43],
  ["baklava", "Baklava", "1 piece (60 g)", 260, 4, 29, 15],
  ["beef_carpaccio", "Beef carpaccio", "1 plate (100 g)", 220, 20, 2, 15],
  ["beef_tartare", "Beef tartare", "1 portion (150 g)", 330, 28, 4, 22],
  ["beet_salad", "Beet salad", "1 bowl (200 g)", 220, 6, 20, 13],
  ["beignets", "Beignets", "3 pieces (100 g)", 380, 6, 45, 19],
  ["bibimbap", "Bibimbap", "1 bowl (500 g)", 600, 25, 85, 18],
  ["bread_pudding", "Bread pudding", "1 serving (150 g)", 330, 8, 48, 12],
  ["breakfast_burrito", "Breakfast burrito", "1 burrito (250 g)", 550, 24, 50, 28],
  ["bruschetta", "Bruschetta", "2 pieces (120 g)", 220, 6, 30, 9],
  ["caesar_salad", "Caesar salad", "1 bowl (250 g)", 400, 12, 18, 32],
  ["cannoli", "Cannoli", "1 cannoli (75 g)", 260, 6, 26, 15],
  ["caprese_salad", "Caprese salad", "1 plate (200 g)", 320, 18, 7, 25],
  ["carrot_cake", "Carrot cake", "1 slice (130 g)", 480, 5, 60, 25],
  ["ceviche", "Ceviche", "1 bowl (200 g)", 200, 25, 12, 5],
  ["cheesecake", "Cheesecake", "1 slice (125 g)", 400, 7, 32, 28],
  ["cheese_plate", "Cheese plate", "1 plate (100 g cheese + crackers)", 450, 22, 18, 32],
  ["chicken_curry", "Chicken curry", "1 bowl (300 g, without rice)", 450, 30, 15, 30],
  ["chicken_quesadilla", "Chicken quesadilla", "1 quesadilla (250 g)", 600, 35, 45, 30],
  ["chicken_wings", "Chicken wings", "6 wings (200 g)", 560, 46, 4, 40],
  ["chocolate_cake", "Chocolate cake", "1 slice (110 g)", 420, 5, 55, 21],
  ["chocolate_mousse", "Chocolate mousse", "1 cup (120 g)", 330, 5, 28, 22],
  ["churros", "Churros", "3 churros (100 g)", 380, 5, 45, 20],
  ["clam_chowder", "Clam chowder", "1 bowl (300 g)", 330, 13, 28, 18],
  ["club_sandwich", "Club sandwich", "1 sandwich (300 g)", 650, 35, 50, 33],
  ["crab_cakes", "Crab cakes", "2 cakes (150 g)", 360, 20, 15, 24],
  ["creme_brulee", "Crème brûlée", "1 ramekin (130 g)", 360, 5, 30, 25],
  ["croque_madame", "Croque madame", "1 sandwich (300 g)", 700, 38, 40, 42],
  ["cup_cakes", "Cupcake", "1 frosted cupcake (80 g)", 300, 3, 42, 14],
  ["deviled_eggs", "Deviled eggs", "4 halves (100 g)", 250, 12, 1, 22],
  ["donuts", "Donut", "1 glazed donut (60 g)", 250, 3, 30, 13],
  ["dumplings", "Dumplings", "6 dumplings (180 g)", 380, 16, 45, 14],
  ["edamame", "Edamame", "1 cup in pods (155 g)", 190, 17, 14, 8],
  ["eggs_benedict", "Eggs Benedict", "2 eggs (300 g)", 700, 32, 32, 48],
  ["escargots", "Escargots", "6 snails with butter (90 g)", 280, 12, 2, 25],
  ["falafel", "Falafel", "4 pieces (100 g)", 330, 13, 32, 18],
  ["filet_mignon", "Filet mignon", "1 steak (200 g)", 460, 52, 0, 27],
  ["fish_and_chips", "Fish and chips", "1 plate (400 g)", 850, 35, 85, 42],
  ["foie_gras", "Foie gras", "1 slice (50 g)", 230, 6, 2, 22],
  ["french_fries", "French fries", "Medium portion (115 g)", 365, 4, 48, 17],
  ["french_onion_soup", "French onion soup", "1 bowl with cheese (350 g)", 380, 15, 35, 19],
  ["french_toast", "French toast", "2 slices (180 g)", 450, 14, 55, 19],
  ["fried_calamari", "Fried calamari", "1 plate (150 g)", 420, 22, 25, 25],
  ["fried_rice", "Fried rice", "1 plate (300 g)", 520, 14, 70, 20],
  ["frozen_yogurt", "Frozen yogurt", "1 cup (170 g)", 220, 6, 38, 5],
  ["garlic_bread", "Garlic bread", "2 slices (80 g)", 290, 7, 33, 14],
  ["gnocchi", "Gnocchi", "1 plate with sauce (300 g)", 450, 11, 70, 14],
  ["greek_salad", "Greek salad", "1 bowl (250 g)", 280, 8, 12, 22],
  ["grilled_cheese_sandwich", "Grilled cheese sandwich", "1 sandwich (150 g)", 440, 17, 33, 27],
  ["grilled_salmon", "Grilled salmon", "1 fillet (170 g)", 350, 37, 0, 22],
  ["guacamole", "Guacamole", "½ cup (120 g)", 190, 2.5, 10, 17],
  ["gyoza", "Gyoza", "6 pieces (150 g)", 320, 13, 35, 14],
  ["hamburger", "Hamburger", "1 burger (220 g)", 540, 30, 40, 29],
  ["hot_and_sour_soup", "Hot and sour soup", "1 bowl (300 g)", 140, 9, 14, 5],
  ["hot_dog", "Hot dog", "1 hot dog in a bun (100 g)", 300, 11, 24, 18],
  ["huevos_rancheros", "Huevos rancheros", "1 plate (350 g)", 550, 25, 45, 30],
  ["hummus", "Hummus", "½ cup (120 g)", 300, 9, 18, 21],
  ["ice_cream", "Ice cream", "1 cup (130 g)", 270, 5, 31, 14],
  ["lasagna", "Lasagna", "1 piece (300 g)", 500, 28, 40, 25],
  ["lobster_bisque", "Lobster bisque", "1 bowl (300 g)", 380, 13, 18, 28],
  ["lobster_roll_sandwich", "Lobster roll", "1 roll (200 g)", 450, 26, 35, 22],
  ["macaroni_and_cheese", "Macaroni and cheese", "1 cup (200 g)", 480, 18, 48, 24],
  ["macarons", "Macarons", "3 macarons (45 g)", 210, 3.5, 28, 10],
  ["miso_soup", "Miso soup", "1 bowl (250 g)", 80, 6, 8, 3],
  ["mussels", "Mussels", "1 bowl with broth (300 g meat)", 350, 35, 12, 15],
  ["nachos", "Nachos", "1 plate (300 g)", 800, 25, 70, 47],
  ["omelette", "Omelette", "3 eggs with cheese (200 g)", 400, 26, 3, 31],
  ["onion_rings", "Onion rings", "8 rings (120 g)", 410, 5, 45, 23],
  ["oysters", "Oysters", "6 raw oysters (85 g)", 70, 8, 4, 2],
  ["pad_thai", "Pad thai", "1 plate (350 g)", 650, 25, 80, 25],
  ["paella", "Paella", "1 plate (350 g)", 550, 30, 65, 18],
  ["pancakes", "Pancakes", "3 pancakes with syrup (230 g)", 520, 11, 90, 13],
  ["panna_cotta", "Panna cotta", "1 serving (130 g)", 300, 4, 25, 21],
  ["peking_duck", "Peking duck", "1 portion with pancakes (200 g)", 550, 28, 30, 35],
  ["pho", "Pho", "1 bowl (650 g)", 450, 30, 60, 10],
  ["pizza", "Pizza", "2 slices cheese pizza (210 g)", 570, 24, 70, 21],
  ["pork_chop", "Pork chop", "1 chop (200 g cooked)", 460, 50, 0, 28],
  ["poutine", "Poutine", "1 portion (350 g)", 740, 22, 70, 42],
  ["prime_rib", "Prime rib", "1 slice (280 g)", 950, 60, 0, 78],
  ["pulled_pork_sandwich", "Pulled pork sandwich", "1 sandwich (250 g)", 550, 32, 50, 24],
  ["ramen", "Ramen", "1 bowl (600 g)", 550, 25, 70, 20],
  ["ravioli", "Ravioli", "1 plate with sauce (300 g)", 500, 20, 60, 20],
  ["red_velvet_cake", "Red velvet cake", "1 slice (120 g)", 480, 5, 60, 25],
  ["risotto", "Risotto", "1 plate (300 g)", 480, 12, 65, 18],
  ["samosa", "Samosa", "2 samosas (150 g)", 460, 8, 48, 26],
  ["sashimi", "Sashimi", "8 pieces (150 g)", 200, 35, 0, 7],
  ["scallops", "Scallops", "6 seared scallops (150 g)", 230, 30, 8, 8],
  ["seaweed_salad", "Seaweed salad", "1 cup (100 g)", 120, 2, 15, 6],
  ["shrimp_and_grits", "Shrimp and grits", "1 bowl (350 g)", 600, 30, 45, 33],
  ["spaghetti_bolognese", "Spaghetti bolognese", "1 plate (400 g)", 650, 30, 80, 22],
  ["spaghetti_carbonara", "Spaghetti carbonara", "1 plate (350 g)", 750, 30, 75, 36],
  ["spring_rolls", "Spring rolls", "3 fried rolls (150 g)", 400, 10, 40, 22],
  ["steak", "Steak", "1 sirloin steak (225 g)", 520, 60, 0, 30],
  ["strawberry_shortcake", "Strawberry shortcake", "1 serving (150 g)", 380, 5, 50, 18],
  ["sushi", "Sushi", "8 pieces (240 g)", 400, 18, 70, 5],
  ["tacos", "Tacos", "2 tacos (200 g)", 420, 22, 36, 20],
  ["takoyaki", "Takoyaki", "6 balls (150 g)", 300, 11, 32, 14],
  ["tiramisu", "Tiramisu", "1 slice (130 g)", 420, 7, 38, 26],
  ["tuna_tartare", "Tuna tartare", "1 portion (150 g)", 260, 30, 4, 13],
  ["waffles", "Waffles", "2 waffles with syrup (200 g)", 540, 11, 75, 21],
];

export const DISHES: Record<string, DishNutrition> = Object.fromEntries(
  ROWS.map(([label, name, serving, calories, protein, carbs, fat]) => [label, { name, serving, calories, protein, carbs, fat }]),
);

/** Display name for a model label, even if it's missing from the table. */
export function dishName(label: string): string {
  return DISHES[label]?.name ?? label.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
