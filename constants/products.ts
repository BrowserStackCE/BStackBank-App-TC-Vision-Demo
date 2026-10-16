// Shop catalogue — premium watches, wallets and eyewear.
//
// NOTE: the image URLs are remote stock photos. They load, but nobody has visually
// confirmed which product each one shows — review them and swap any that don't match.

export const SHOP_CATEGORIES = ['All', 'Watches', 'Wallets', 'Specs'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: Exclude<ShopCategory, 'All'>;
  rating: number;
  reviews: number;
}

const img = (photoId: string) => `https://images.unsplash.com/photo-${photoId}?w=600&q=80`;

export const PRODUCTS: Product[] = [
  // Watches
  { id: 'w1', name: 'Chronos Automatic', price: 1290, image: img('1523170335258-f5ed11844a49'), category: 'Watches', rating: 4.9, reviews: 412 },
  { id: 'w2', name: 'Meridian Steel Chronograph', price: 840, image: img('1524592094714-0f0654e20314'), category: 'Watches', rating: 4.8, reviews: 286 },
  { id: 'w3', name: 'Aurelia Rose Gold', price: 1590, image: img('1587836374828-4dbafa94cf0e'), category: 'Watches', rating: 4.9, reviews: 197 },
  { id: 'w4', name: 'Noir Minimalist', price: 520, image: img('1547996160-81dfa63595aa'), category: 'Watches', rating: 4.7, reviews: 341 },

  // Wallets
  { id: 'l1', name: 'Heritage Bifold Wallet', price: 185, image: img('1627123424574-724758594e93'), category: 'Wallets', rating: 4.8, reviews: 524 },
  { id: 'l2', name: 'Carbon Slim Cardholder', price: 95, image: img('1606503825008-909a67e63c3d'), category: 'Wallets', rating: 4.7, reviews: 389 },
  { id: 'l3', name: 'Saffiano Travel Wallet', price: 240, image: img('1594938298603-c8148c4dae35'), category: 'Wallets', rating: 4.8, reviews: 168 },
  { id: 'l4', name: 'Espresso Leather Trifold', price: 210, image: img('1553062407-98eeb64c6a62'), category: 'Wallets', rating: 4.6, reviews: 231 },

  // Specs
  { id: 's1', name: 'Aviator Gold Polarised', price: 320, image: img('1511499767150-a48a237f0083'), category: 'Specs', rating: 4.8, reviews: 603 },
  { id: 's2', name: 'Wayfarer Tortoise', price: 260, image: img('1572635196237-14b3f281503f'), category: 'Specs', rating: 4.7, reviews: 478 },
  { id: 's3', name: 'Round Titanium Optical', price: 380, image: img('1577803645773-f96470509666'), category: 'Specs', rating: 4.9, reviews: 142 },
  { id: 's4', name: 'Cat-Eye Acetate', price: 295, image: img('1508296695146-257a814070b4'), category: 'Specs', rating: 4.7, reviews: 219 },
];
