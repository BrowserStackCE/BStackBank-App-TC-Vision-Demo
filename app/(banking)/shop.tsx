import { withShimmer } from '@/components/shimmer';
import { TransactionAuthModal } from '@/components/TransactionAuthModal';
import { PRODUCTS, SHOP_CATEGORIES } from '@/constants/products';
import { BSColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, API_URL } from '@/store/api';
import { BankStore } from '@/store/banking';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48 - 12) / 2; // 2-column grid

const CATEGORIES = SHOP_CATEGORIES;

type CartMap = Record<string, number>;

function ShopScreen() {
  const { primaryColor } = useTheme();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [cart, setCart] = useState<CartMap>({});
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Checkout state
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = PRODUCTS.find(p => p.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: PRODUCTS.find(p => p.id === id)!, qty }))
    .filter(i => i.product);

  const addToCart = (id: string) => setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const removeFromCart = (id: string) => setCart(prev => {
    const next = { ...prev };
    if (next[id] > 1) next[id]--;
    else delete next[id];
    return next;
  });
  const removeItemFully = (id: string) => setCart(prev => {
    const next = { ...prev };
    delete next[id];
    return next;
  });

  const filteredProducts = PRODUCTS.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Pay from account balance — requires biometric / passcode
  const handleBalanceCheckout = () => {
    if (cartCount === 0) return;
    if (!BankStore.canAfford(cartTotal)) {
      setCheckoutError(`Insufficient balance. Available: $${BankStore.getBalance().toLocaleString()}`);
      return;
    }
    setCheckoutError('');
    setShowAuth(true);
  };

  // After a successful order: empty the cart and show the receipt screen.
  const showReceipt = (orderId: string) => {
    setCart({});
    setShowCart(false);
    router.push({ pathname: '/(banking)/receipt' as any, params: { orderId } });
  };

  const executeBalanceCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const orderItems = cartItems.map(({ product, qty }) => ({
        id: product.id, name: product.name, price: product.price, qty,
      }));
      const { order } = await api.placeOrder(orderItems, cartTotal, `Shop: ${cartItems.map(i => i.product.name).join(', ')}`);
      BankStore.sync().catch(() => {});
      showReceipt(order.id);
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Pay by card via Stripe — goes straight to the payment sheet, no biometric step
  const handleCheckout = async () => {
    if (cartCount === 0) return;
    await executeCheckout();
  };

  const executeCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const cents = Math.round(cartTotal * 100);
      const response = await fetch(`${API_URL}/payment-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, currency: 'usd', customerName: 'Shop Customer' }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const { paymentIntent, ephemeralKey, customer } = await response.json();
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'BrowserStack Shop',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false,
        returnURL: 'demobankingapp://stripe-redirect',
      });
      if (initError) { setCheckoutError(initError.message); setCheckoutLoading(false); return; }
      setCheckoutLoading(false);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') setCheckoutError(presentError.message);
      } else {
        // Record order in backend (deducts balance + saves order + transaction)
        const orderItems = cartItems.map(({ product, qty }) => ({
          id: product.id, name: product.name, price: product.price, qty,
        }));
        try {
          const { order } = await api.placeOrder(orderItems, cartTotal, `Shop: ${cartItems.map(i => i.product.name).join(', ')}`);
          BankStore.sync().catch(() => {});
          showReceipt(order.id);
        } catch {
          // The card was charged but the order could not be saved: record the payment locally.
          // There is no order record, so there is no receipt to show — say so instead of hiding it.
          await BankStore.recordPayment(cartTotal, `Shop: ${cartItems.map(i => i.product.name).join(', ')}`);
          setCart({});
          setShowCart(false);
          Alert.alert(
            'Payment received',
            `$${cartTotal.toFixed(2)} was paid, but we could not create your order receipt. Please contact support with your payment confirmation.`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.getOrders();
      setOrders(res.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const renderStars = (rating: number) => '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.pageTitle}>Shop</Text>
          <Text style={styles.pageSubtitle}>Discover & buy</Text>
        </View>
        <TouchableOpacity style={[styles.cartBtn, { marginLeft: 0 }]} onPress={() => { fetchOrders(); setShowOrders(true); }} testID="orders-icon" accessibilityLabel="View orders" accessibilityRole="button">
          <Ionicons name="receipt-outline" size={20} color={BSColors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartBtn} onPress={() => setShowCart(true)} testID="cart-icon" accessibilityLabel={`Shopping cart, ${cartCount} items`} accessibilityRole="button">
          <Ionicons name="bag-outline" size={22} color={BSColors.textPrimary} />
          {cartCount > 0 && (
            <View style={[styles.cartBadge, { backgroundColor: primaryColor }]}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={BSColors.darkGray} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search" accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <View style={styles.catFilterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, activeCategory === cat && { backgroundColor: primaryColor, borderColor: primaryColor }]}
              onPress={() => setActiveCategory(cat)}
              testID={`cat-${cat}`}
            >
              <Text style={[styles.catChipText, activeCategory === cat && { color: BSColors.white }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product Grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false} style={styles.gridScroll}>
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color={BSColors.mediumGray} />
            <Text style={styles.emptyStateText}>No products found</Text>
          </View>
        ) : (
          <View style={styles.gridRow}>
            {filteredProducts.map(item => (
              <View key={item.id} style={styles.productCard}>
                <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                <View style={[styles.catBadge, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.catBadgeText, { color: primaryColor }]}>{item.category}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.ratingRow}>
                    <Text style={styles.stars}>{renderStars(item.rating)}</Text>
                    <Text style={styles.ratingText}>{item.rating}</Text>
                  </View>
                  <Text style={[styles.productPrice, { color: primaryColor }]}>${item.price.toFixed(2)}</Text>
                  {cart[item.id] ? (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { borderColor: primaryColor }]}
                        onPress={() => removeFromCart(item.id)}
                        testID={`remove-${item.id}`}
                      >
                        <Ionicons name="remove" size={16} color={primaryColor} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{cart[item.id]}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: primaryColor, borderColor: primaryColor }]}
                        onPress={() => addToCart(item.id)}
                        testID={`add-${item.id}`}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: primaryColor }]}
                      onPress={() => addToCart(item.id)}
                      testID={`add-${item.id}`}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: cartCount > 0 ? 100 : 24 }} />
      </ScrollView>

      {/* Floating Cart Bar */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.floatingCart, { backgroundColor: primaryColor }]}
          onPress={() => setShowCart(true)}
          testID="floating-cart-btn"
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.floatingCartBadge}>
              <Text style={[styles.floatingCartBadgeText, { color: primaryColor }]}>{cartCount}</Text>
            </View>
            <Text style={styles.floatingCartLabel}>View Cart</Text>
          </View>
          <Text style={styles.floatingCartTotal}>${cartTotal.toFixed(2)}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Orders Modal */}
      <Modal visible={showOrders} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safe}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>My Orders</Text>
            <TouchableOpacity onPress={() => setShowOrders(false)} style={styles.cartCloseBtn}>
              <Ionicons name="close" size={22} color={BSColors.textPrimary} />
            </TouchableOpacity>
          </View>
          {ordersLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: BSColors.darkGray, fontSize: 14 }}>Loading orders...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="receipt-outline" size={48} color={BSColors.mediumGray} />
              <Text style={styles.emptyCartTitle}>No orders yet</Text>
              <Text style={styles.emptyCartSub}>Your completed orders will appear here</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {orders.map((order: any) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowOrders(false);
                    router.push({ pathname: '/(banking)/receipt' as any, params: { orderId: order.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View receipt for order ${order.referenceId}`}
                  testID={`order-card-${order.referenceId}`}
                >
                  <View style={styles.orderCardTop}>
                    <View style={[styles.orderStatusBadge, { backgroundColor: primaryColor + '15' }]}>
                      <Text style={[styles.orderStatusText, { color: primaryColor }]}>{order.status}</Text>
                    </View>
                    <Text style={styles.orderDate}>{order.date}</Text>
                  </View>
                  <Text style={styles.orderRef}>Ref: {order.referenceId}</Text>
                  <View style={{ marginTop: 8 }}>
                    {(order.items || []).map((item: any, i: number) => (
                      <Text key={i} style={styles.orderItem}>• {item.name} × {item.qty}</Text>
                    ))}
                  </View>
                  <View style={styles.orderTotal}>
                    <Text style={styles.orderTotalLabel}>Total paid</Text>
                    <Text style={[styles.orderTotalValue, { color: primaryColor }]}>${order.total?.toFixed(2)}</Text>
                  </View>
                  <Text style={{ color: primaryColor, fontSize: 12, fontFamily: 'Urbanist-SemiBold', marginTop: 8 }}>View receipt</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Your Cart</Text>
            <TouchableOpacity onPress={() => setShowCart(false)} style={styles.cartCloseBtn}>
              <Ionicons name="close" size={22} color={BSColors.textPrimary} />
            </TouchableOpacity>
          </View>
          {cartItems.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="bag-outline" size={56} color={BSColors.mediumGray} />
              <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
              <Text style={styles.emptyCartSub}>Add items to get started</Text>
              <TouchableOpacity style={[styles.continueShoppingBtn, { backgroundColor: primaryColor }]} onPress={() => setShowCart(false)}>
                <Text style={styles.continueShoppingText}>Continue Shopping</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView style={styles.cartList} contentContainerStyle={{ paddingBottom: 16 }}>
                {cartItems.map(({ product, qty }) => (
                  <View key={product.id} style={styles.cartItem}>
                    <Image source={{ uri: product.image }} style={styles.cartItemImage} resizeMode="cover" />
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={2}>{product.name}</Text>
                      <Text style={[styles.cartItemPrice, { color: primaryColor }]}>${product.price.toFixed(2)}</Text>
                      <View style={styles.cartQtyRow}>
                        <TouchableOpacity style={[styles.cartQtyBtn, { borderColor: primaryColor }]} onPress={() => removeFromCart(product.id)}>
                          <Ionicons name="remove" size={14} color={primaryColor} />
                        </TouchableOpacity>
                        <Text style={styles.cartQtyText}>{qty}</Text>
                        <TouchableOpacity style={[styles.cartQtyBtn, { backgroundColor: primaryColor, borderColor: primaryColor }]} onPress={() => addToCart(product.id)}>
                          <Ionicons name="add" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.cartItemRight}>
                      <Text style={[styles.cartItemTotal, { color: primaryColor }]}>${(product.price * qty).toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => removeItemFully(product.id)} style={styles.cartRemoveBtn}>
                        <Ionicons name="trash-outline" size={18} color={BSColors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.orderSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal ({cartCount} items)</Text>
                  <Text style={styles.summaryValue}>${cartTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Shipping</Text>
                  <Text style={[styles.summaryValue, { color: BSColors.success }]}>Free</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={[styles.summaryTotalValue, { color: primaryColor }]}>${cartTotal.toFixed(2)}</Text>
                </View>
                {checkoutError ? (
                  <View style={styles.checkoutError}>
                    <Ionicons name="warning-outline" size={15} color={BSColors.error} />
                    <Text style={styles.checkoutErrorText}>{checkoutError}</Text>
                  </View>
                ) : null}
                <View style={styles.balanceRow}>
                  <Ionicons name="wallet-outline" size={14} color={BSColors.darkGray} />
                  <Text style={styles.balanceText}>Balance: <Text style={{ color: primaryColor, fontFamily: 'Urbanist-Bold' }}>${BankStore.getBalance().toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text></Text>
                </View>
                <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: primaryColor }, checkoutLoading && { opacity: 0.7 }]} onPress={handleCheckout} disabled={checkoutLoading} testID="checkout-btn">
                  {checkoutLoading ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : <Ionicons name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 8 }} />}
                  <Text style={styles.checkoutBtnText}>{checkoutLoading ? 'Processing...' : `Pay $${cartTotal.toFixed(2)} by Card`}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.balanceBtn, { borderColor: primaryColor }, checkoutLoading && { opacity: 0.7 }]} onPress={handleBalanceCheckout} disabled={checkoutLoading} testID="balance-checkout-btn">
                  <Ionicons name="wallet-outline" size={18} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={[styles.balanceBtnText, { color: primaryColor }]}>Pay from Balance</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}><Ionicons name="lock-closed-outline" size={13} color={BSColors.textSecondary} /><Text style={styles.secureNote}>Secured by Stripe</Text></View>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <TransactionAuthModal
        visible={showAuth}
        amount={`$${cartTotal.toFixed(2)}`}
        description={`${cartCount} item${cartCount !== 1 ? 's' : ''}`}
        onSuccess={() => { setShowAuth(false); executeBalanceCheckout(); }}
        onCancel={() => { setShowAuth(false); setCheckoutError('Transaction could not be completed.'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BSColors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  pageTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-ExtraBold' },
  pageSubtitle: { color: BSColors.darkGray, fontSize: 12 },
  cartBtn: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 14, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cartBadge: { position: 'absolute', top: -4, right: -4, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: BSColors.bgPage },
  cartBadgeText: { color: BSColors.white, fontSize: 10, fontFamily: 'Urbanist-ExtraBold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BSColors.white, marginHorizontal: 20, marginBottom: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: BSColors.mediumGray },
  searchInput: { flex: 1, fontSize: 14, color: BSColors.textPrimary },
  catFilterWrap: { flexShrink: 0 },
  catRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: BSColors.white, borderWidth: 1.5, borderColor: BSColors.mediumGray, flexShrink: 0 },
  catChipText: { color: BSColors.textSecondary, fontSize: 12, fontFamily: 'Urbanist-SemiBold' },
  gridScroll: { flex: 1 },
  grid: { paddingHorizontal: 20 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { width: CARD_W, backgroundColor: BSColors.white, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  productImage: { width: '100%', height: 140, backgroundColor: BSColors.lightGray },
  catBadge: { position: 'absolute', top: 10, left: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 10, fontFamily: 'Urbanist-Bold' },
  productInfo: { padding: 12 },
  productName: { color: BSColors.textPrimary, fontSize: 13, fontFamily: 'Urbanist-Bold', marginBottom: 6, lineHeight: 18 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  stars: { color: BSColors.warning, fontSize: 12 },
  ratingText: { color: BSColors.darkGray, fontSize: 11 },
  productPrice: { fontSize: 16, fontFamily: 'Urbanist-ExtraBold', marginBottom: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: BSColors.textPrimary, fontSize: 15, fontFamily: 'Urbanist-ExtraBold', minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, paddingVertical: 8 },
  addBtnText: { color: BSColors.white, fontSize: 13, fontFamily: 'Urbanist-Bold' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12, width: '100%' },
  emptyStateText: { color: BSColors.darkGray, fontSize: 15 },
  floatingCart: { position: 'absolute', bottom: 20, left: 20, right: 20, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  floatingCartLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  floatingCartBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: BSColors.white, alignItems: 'center', justifyContent: 'center' },
  floatingCartBadgeText: { fontSize: 13, fontFamily: 'Urbanist-ExtraBold' },
  floatingCartLabel: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  floatingCartTotal: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-ExtraBold', marginRight: 8 },
  cartModal: { flex: 1, backgroundColor: BSColors.bgPage },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BSColors.mediumGray },
  cartTitle: { color: BSColors.textPrimary, fontSize: 20, fontFamily: 'Urbanist-ExtraBold' },
  cartCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: BSColors.lightGray, alignItems: 'center', justifyContent: 'center' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyCartTitle: { color: BSColors.textPrimary, fontSize: 18, fontFamily: 'Urbanist-Bold' },
  emptyCartSub: { color: BSColors.darkGray, fontSize: 14 },
  continueShoppingBtn: { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  continueShoppingText: { color: BSColors.white, fontSize: 15, fontFamily: 'Urbanist-Bold' },
  cartList: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  cartItem: { flexDirection: 'row', backgroundColor: BSColors.white, borderRadius: 16, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cartItemImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: BSColors.lightGray },
  cartItemInfo: { flex: 1, paddingHorizontal: 12 },
  cartItemName: { color: BSColors.textPrimary, fontSize: 13, fontFamily: 'Urbanist-SemiBold', marginBottom: 4, lineHeight: 18 },
  cartItemPrice: { fontSize: 13, fontFamily: 'Urbanist-Bold', marginBottom: 8 },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartQtyBtn: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cartQtyText: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-Bold', minWidth: 18, textAlign: 'center' },
  cartItemRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  cartItemTotal: { fontSize: 15, fontFamily: 'Urbanist-ExtraBold' },
  cartRemoveBtn: { padding: 4 },
  orderSummary: { backgroundColor: BSColors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: BSColors.darkGray, fontSize: 14 },
  summaryValue: { color: BSColors.textPrimary, fontSize: 14, fontFamily: 'Urbanist-SemiBold' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: BSColors.mediumGray, paddingTop: 12, marginTop: 4, marginBottom: 14 },
  summaryTotalLabel: { color: BSColors.textPrimary, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  summaryTotalValue: { fontSize: 20, fontFamily: 'Urbanist-ExtraBold' },
  checkoutError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BSColors.errorBg, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: BSColors.errorBorder },
  checkoutErrorText: { color: BSColors.error, fontSize: 12, flex: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  balanceText: { color: BSColors.darkGray, fontSize: 13 },
  checkoutBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  balanceBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1.5, backgroundColor: BSColors.white },
  balanceBtnText: { fontSize: 15, fontFamily: 'Urbanist-Bold' },
  checkoutBtnText: { color: BSColors.white, fontSize: 16, fontFamily: 'Urbanist-Bold' },
  secureNote: { color: BSColors.darkGray, fontSize: 12, textAlign: 'center' },
  orderCard: { backgroundColor: BSColors.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  orderStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  orderStatusText: { fontSize: 12, fontFamily: 'Urbanist-Bold' },
  orderDate: { color: BSColors.darkGray, fontSize: 12 },
  orderRef: { color: BSColors.darkGray, fontSize: 11, marginBottom: 4 },
  orderItem: { color: BSColors.textSecondary, fontSize: 13, marginBottom: 2 },
  orderTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BSColors.lightGray },
  orderTotalLabel: { color: BSColors.darkGray, fontSize: 13 },
  orderTotalValue: { fontSize: 16, fontFamily: 'Urbanist-ExtraBold' },
});

export default withShimmer(ShopScreen);
