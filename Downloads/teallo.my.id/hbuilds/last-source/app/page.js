"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { products as localProducts } from "./libs/product";

const CART_KEY = "food-po-cart";

const BOX_PRICE = 1000;
const TOPPING_PRICE = 3000;
const ALLOWED_TOPPINGS = [
  "Oreo",
  "Coco crunch",
  "Ovaltine",
  "Choco chips",
  "Regal",
];
const GABIN_KEYWORD = "gabin";

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setCart(Array.isArray(saved) ? saved : []);
    } catch {
      setCart([]);
    }

    const loadProducts = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch("/api/products", {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Stok tidak dapat dimuat.");
        }

        // Google Sheet HANYA mengatur stok.
        // Nama, harga, deskripsi, dan gambar selalu berasal dari menu lokal berdasarkan menu-id.
        const mergedProducts = localProducts.map((local) => {
          const remote = data.products?.find(
            (p) => String(p?.id || "").trim() === local.id
          );
          return {
            ...local,
            stock: remote ? Number(remote.stock) : 0,
          };
        });

        setProducts(mergedProducts);
      } catch {
        setProducts(localProducts);
        setError("Sedang Offline,Saat ini Menampilkan stock sementara");
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const isGabin = (name) => name.toLowerCase().includes(GABIN_KEYWORD);

  const getItemPrice = (item, options) => {
    let price = Number(item.price || 0);
    if (isGabin(item.name)) {
      if (options?.box) price += BOX_PRICE;
      if (options?.topping) price += TOPPING_PRICE;
    }
    return price;
  };

  const saveCart = (next) => {
    setCart(next);
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  };

  // FUNGSI UNTUK MENAMBAH ITEM DENGAN ID UNIK
  const handleAddToCart = (product, options) => {
    const existing = cart.find(
      (c) =>
        c.id === product.id &&
        c.options?.box === options.box &&
        c.options?.topping === options.topping
    );

    if (existing) {
      // GABUNG: quantity ditambah
      const next = cart.map((c) =>
        c === existing ? { ...c, quantity: c.quantity + 1 } : c
      );
      saveCart(next);
    } else {
      // TAMBAH BARU: buat item baru dengan ID unik
      // SIMPAN DATA LENGKAP DI CART
      saveCart([...cart, { 
        id: product.id, 
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image,
        options, 
        quantity: 1, 
        itemId: Date.now() + Math.random() 
      }]);
    }
  };

  const handleDecrease = (product, options) => {
    const existing = cart.find(
      (c) =>
        c.id === product.id &&
        c.options?.box === options.box &&
        c.options?.topping === options.topping
    );

    if (!existing) return;

    if (existing.quantity <= 1) {
      saveCart(cart.filter((c) => c !== existing));
    } else {
      saveCart(
        cart.map((c) =>
          c === existing ? { ...c, quantity: c.quantity - 1 } : c
        )
      );
    }
  };

  const getCartQuantity = (product) => {
    return cart
      .filter((c) => c.id === product.id)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const total = cart.reduce(
    (sum, c) => {
      const product = products.find((p) => p.id === c.id);
      if (!product) return sum;
      return sum + getItemPrice(product, c.options) * c.quantity;
    },
    0
  );

  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // GAMBAR TIDAK PERNAH diambil dari Google Sheet/API.
  // menu-id menjadi sumber kebenaran untuk gambar lokal /public.
  const getProductImage = (item) => {
    const localProduct = localProducts.find(
      (product) => String(product.id) === String(item?.id)
    );
    return localProduct?.image || "/Logo.png";
  };

  const updateCartQuantity = (itemId, options, delta) => {
    const existing = cart.find((c) => c.itemId === itemId);

    if (!existing) return;

    const product = products.find((p) => p.id === existing.id);
    const maxStock = product?.stock || Infinity;

    if (existing.quantity + delta > maxStock) return;

    if (existing.quantity + delta <= 0) {
      saveCart(cart.filter((c) => c !== existing));
    } else {
      saveCart(
        cart.map((c) =>
          c === existing ? { ...c, quantity: c.quantity + delta } : c
        )
      );
    }
  };

  const removeCartItem = (itemId) => {
    saveCart(cart.filter((c) => c.itemId !== itemId));
  };

  const cartItems = cart
    .map((c) => {
      const product = products.find((p) => p.id === c.id) || localProducts.find((p) => p.id === c.id);
      if (!product) return null;
      return { ...product, ...c, unitPrice: getItemPrice(product, c.options) };
    })
    .filter(Boolean);

  // FUNGSI UNTUK MENGUBAH BOX/TOPPING HANYA PADA SATU ITEM (berdasarkan itemId)
  const updateItemOptions = (itemId, newOptions) => {
    const nextCart = cart.map((c) =>
      c.itemId === itemId ? { ...c, options: newOptions } : c
    );
    saveCart(nextCart);
  };

  return (
    <main className="min-h-screen bg-[#e8e4d9] text-[#385144] pb-28">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-7">
          <div className="mb-4">
            <img
              src="/Logobyteallo.png"
              alt="Gabin Bar"
              className="h-auto w-full max-w-[350px] object-contain"
            />
          </div>

          <h1 className="mt-2 text-3xl font-bold">Menu</h1>
          <p className="mt-2 text-[#59665c]">Pilih menu sesuai stok yang tersedia.</p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
            Memuat menu...
          </div>
        ) : !products.length ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
            Belum ada menu yang tersedia.
          </div>
        ) : (
          <section className="space-y-4">
            {products.map((item) => {
              const soldOut = item.stock <= 0;
              const isG = isGabin(item.name);
              const opts = selectedOptions[item.id] || { box: false, topping: "" };
              const qty = getCartQuantity(item);

              return (
                <article
                  key={item.id}
                  className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
                >
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#dedbd0]">
                    <img
                      src={getProductImage(item)}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        if (e.currentTarget.src.endsWith("/Logo.png")) return;
                        e.currentTarget.src = "/Logo.png";
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">{item.name}</h2>

                    <div className="mt-2">
                      <b>{formatRupiah(getItemPrice(item, opts))}</b>
                      {isG && (
                        <p className="text-xs text-[#68746b]">tanpa box / box</p>
                      )}
                      <p className={`text-xs font-semibold ${soldOut ? "text-red-500" : "text-[#68746b]"}`}>
                        {soldOut ? "Habis" : `Stok ${item.stock}`}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!qty}
                          onClick={() => handleDecrease(item, opts)}
                          className="h-9 w-9 rounded-full border disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-semibold">{qty}</span>
                        <button
                          type="button"
                          disabled={soldOut || qty >= item.stock}
                          onClick={() => handleAddToCart(item, opts)}
                          className="h-9 w-9 rounded-full bg-[#385144] text-white disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-[#68746b]">
                        {formatRupiah(getItemPrice(item, opts) * qty)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {/* Bar Bawah: Tombol "Keranjang" */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs text-[#68746b]">{itemCount} item</p>
            <p className="font-bold">{formatRupiah(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className={`rounded-xl px-6 py-3 font-semibold text-white ${itemCount ? "bg-[#385144]" : "bg-[#c8c9c0]"}`}
          >
            Keranjang
          </button>
        </div>
      </div>

      {/* Sidebar Keranjang */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-xl font-bold">Keranjang</h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full p-2 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cartItems.length === 0 ? (
                  <div className="py-10 text-center text-[#68746b]">
                    <p>Keranjang kosong</p>
                    <button
                      type="button"
                      onClick={() => setCartOpen(false)}
                      className="mt-4 rounded-xl bg-[#385144] px-6 py-3 font-semibold text-white"
                    >
                      Kembali ke Menu
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cartItems.map((item, index) => (
                      <div key={item.itemId} className="rounded-2xl bg-[#f1eee6] p-4">
                        <div className="flex gap-3">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#dedbd0]">
                            <img
                              src={getProductImage(item)}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                if (e.currentTarget.src.endsWith("/Logo.png")) return;
                                e.currentTarget.src = "/Logo.png";
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold">{item.name}</h3>
                            {isGabin(item.name) && (
                              <div className="mt-1 text-xs text-[#68746b]">
                                {item.options?.box && <span>Box (+{formatRupiah(BOX_PRICE)})</span>}
                                {item.options?.topping && (
                                  <span className="ml-2">| Topping: {item.options.topping} (+{formatRupiah(TOPPING_PRICE)})</span>
                                )}
                              </div>
                            )}

                            <div className="mt-2">
                              <span className="text-sm font-semibold">
                                {formatRupiah(item.unitPrice)} × {item.quantity}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.itemId, item.options, -1)}
                                  className="h-8 w-8 rounded-full border"
                                >
                                  −
                                </button>
                                <span className="w-5 text-center font-semibold">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.itemId, item.options, 1)}
                                  disabled={item.quantity >= item.stock}
                                  className="h-8 w-8 rounded-full bg-[#385144] text-white disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pilihan Box & Topping - HANYA UNTUK ITEM INI */}
                        {isGabin(item.name) && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.options?.box}
                                onChange={(e) => {
                                  const newBox = e.target.checked;
                                  updateItemOptions(item.itemId, { box: newBox, topping: newBox ? item.options?.topping || "" : "" });
                                }}
                                className="h-4 w-4"
                              />
                              <span>Pakai Box (+{formatRupiah(BOX_PRICE)})</span>
                            </label>

                            {item.options?.box && (
                              <select
                                value={item.options?.topping || ""}
                                onChange={(e) => {
                                  updateItemOptions(item.itemId, { ...item.options, topping: e.target.value });
                                }}
                                className="w-full rounded-xl border p-2 text-sm"
                              >
                                <option value="">Tanpa topping</option>
                                {ALLOWED_TOPPINGS.map((t) => (
                                  <option key={t} value={t}>{t} (+{formatRupiah(TOPPING_PRICE)})</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="border-t p-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatRupiah(total)}</span>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={() => setCartOpen(false)}
                    className="mt-4 block w-full rounded-xl bg-[#385144] px-4 py-4 text-center font-semibold text-white"
                  >
                    Lanjut Transaksi
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}