import { getProductStock } from './data';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

// In-memory store: chatId -> Cart
export const carts = new Map<number, Cart>();

export function getCart(chatId: number): Cart {
  if (!carts.has(chatId)) {
    carts.set(chatId, { items: [] });
  }
  return carts.get(chatId)!;
}

export function addToCart(chatId: number, product: { id: string; name: string; price: number; emoji: string }): { success: boolean; error?: string } {
  const cart = getCart(chatId);
  const existing = cart.items.find(i => i.productId === product.id);
  const currentQtyInCart = existing ? existing.quantity : 0;
  const availableStock = getProductStock(product.id);

  if (currentQtyInCart >= availableStock) {
    return { success: false, error: availableStock === 0 ? `${product.emoji} ${product.name} is out of stock!` : `Only ${availableStock} units of ${product.name} available!` };
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.items.push({ productId: product.id, name: product.name, price: product.price, emoji: product.emoji, quantity: 1 });
  }
  return { success: true };
}

export function removeFromCart(chatId: number, productId: string) {
  const cart = getCart(chatId);
  const existing = cart.items.find(i => i.productId === productId);
  if (existing) {
    if (existing.quantity > 1) {
      existing.quantity -= 1;
    } else {
      cart.items = cart.items.filter(i => i.productId !== productId);
    }
  }
}

/** Decrement quantity by 1 (alias for removeFromCart) */
export function decrementFromCart(chatId: number, productId: string) {
  removeFromCart(chatId, productId);
}

/** Set exact quantity for an item. Removes item if qty <= 0. */
export function setQuantity(chatId: number, productId: string, qty: number): { success: boolean; error?: string } {
  const cart = getCart(chatId);
  if (qty <= 0) {
    cart.items = cart.items.filter(i => i.productId !== productId);
    return { success: true };
  }
  const availableStock = getProductStock(productId);
  if (qty > availableStock) {
    return { success: false, error: `Only ${availableStock} units available in stock!` };
  }
  const existing = cart.items.find(i => i.productId === productId);
  if (existing) {
    existing.quantity = qty;
  }
  return { success: true };
}

/** Delete a specific item entirely from cart */
export function deleteFromCart(chatId: number, productId: string) {
  const cart = getCart(chatId);
  cart.items = cart.items.filter(i => i.productId !== productId);
}

export function clearCart(chatId: number) {
  carts.set(chatId, { items: [] });
}

export function getCartTotal(chatId: number): number {
  const cart = getCart(chatId);
  return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

// ─── Purchase History & Refund Eligibility ──────────────────────────────────────
export interface PurchasedItem {
  orderId: string;
  productId: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
  date: Date;
}

// In-memory store: chatId -> PurchasedItem[]
export const orderHistory = new Map<number, PurchasedItem[]>();

export function recordPurchase(chatId: number, orderId: string, items: CartItem[]) {
  if (!orderHistory.has(chatId)) {
    orderHistory.set(chatId, []);
  }
  const history = orderHistory.get(chatId)!;
  for (const item of items) {
    history.push({
      orderId,
      productId: item.productId,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      quantity: item.quantity,
      date: new Date()
    });
  }
}

export function getPurchasedItems(chatId: number): PurchasedItem[] {
  return orderHistory.get(chatId) || [];
}
