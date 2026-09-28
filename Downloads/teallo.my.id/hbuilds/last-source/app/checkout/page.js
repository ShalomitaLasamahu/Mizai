"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { products as localProducts } from "../libs/product";

const CART_KEY = "food-po-cart";
const CUSTOMER_KEY = "food-po-customer";

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

function compressImage(file, maxSize = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("tidak dapat memproses foto."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Foto bukti pembayaran tidak dapat dibaca."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Foto bukti pembayaran gagal dibaca."));
    reader.readAsDataURL(file);
  });
}

function getJakartaTodayParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const result = {};
  for (const part of parts) {
    if (part.type !== "literal") result[part.type] = part.value;
  }
  return { year: Number(result.year), month: Number(result.month), day: Number(result.day) };
}

function createPickupDate(offset = 0) {
  const today = getJakartaTodayParts();
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const value = `${year}-${month}-${day}`;
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return { value, label };
}

export default function Checkout() {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [customer, setCustomer] = useState({ name: "", whatsapp: "", note: "" });
  const [paymentProof, setPaymentProof] = useState(null);
  const [proofName, setProofName] = useState("");
  const [pickupMethod, setPickupMethod] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pickupDates = useMemo(() => [createPickupDate(0), createPickupDate(1)], []);

  useEffect(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setCart(Array.isArray(savedCart) ? savedCart : []);
      const savedCustomer = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}");
      setCustomer((current) => ({ ...current, ...savedCustomer }));
    } catch {
      setCart([]);
    }

    fetch("/api/products", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setProducts(data.products || []);
        else setProducts(localProducts);
      })
      .catch(() => setProducts(localProducts));
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

  // GANTI: SELALU gunakan localProducts untuk harga
  const cartItems = useMemo(
    () =>
      cart
        .map((c) => {
          // Nama, harga, dan gambar selalu berasal dari menu lokal.
          // Google Sheet hanya menyuplai stok.
          const product = localProducts.find((p) => p.id === c.id);
          if (!product) return null;
          return {
            ...product,
            ...c,
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            unitPrice: getItemPrice(product, c.options),
          };
        })
        .filter(Boolean),
    [cart, products]
  );

  const total = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const availableTimes = useMemo(() => {
    if (pickupLocation === "Ropa Studio - Pondok Jagung Timur")
      return ["10.00 - 12.00", "15.00 - 17.00", "18.00 - 20.00"];
    return [];
  }, [pickupLocation]);

  const pickupByOrderTimes = ["10.00 - 12.00", "15.00 - 17.00", "18.00 - 20.00"];

  useEffect(() => {
    setPickupTime("");
  }, [pickupLocation]);

  useEffect(() => {
    if (pickupMethod === "Pickup by Order") {
      setPickupLocation("");
      setPickupDate("");
    }
  }, [pickupMethod]);

  const submitOrder = async (event) => {
    event.preventDefault();
    setError("");

    if (!cartItems.length) {
      setError("Keranjang kosong. Kembali ke menu.");
      return;
    }

    if (!customer.name.trim() || !customer.whatsapp.trim()) {
      setError("Nama dan WhatsApp wajib diisi.");
      return;
    }

    if (!pickupMethod) {
      setError("Silakan pilih cara pengambilan pesanan.");
      return;
    }

    if (pickupMethod === "Pickup by Order" && !pickupTime) {
      setError("Silakan pilih waktu pickup.");
      return;
    }

    if (pickupMethod === "Pickup langsung") {
      if (!pickupLocation) { setError("Silakan pilih lokasi pickup."); return; }
      if (!pickupDate) { setError("Silakan pilih hari pickup."); return; }
      if (!pickupTime) { setError("Silakan pilih waktu pickup."); return; }
    }

    if (!paymentProof) {
      setError("Bukti transfer wajib diupload.");
      return;
    }

    setLoading(true);

    try {
      const compressed = await compressImage(paymentProof);

      const payload = {
        customer: {
          name: customer.name.trim(),
          whatsapp: customer.whatsapp.trim(),
          note: customer.note?.trim() || "",
        },
        items: cartItems.map((item) => {
          // Ambil harga dari localProducts sebagai sumber terpercaya
          const localProduct = localProducts.find((p) => p.id === item.id);
          const basePrice = localProduct ? Number(localProduct.price) : Number(item.price) || 0;
          
          return {
            id: String(item.id),
            name: String(item.name),
            price: basePrice, // HARGA DASAR dari local
            quantity: Number(item.quantity) || 0,
            options: {
              box: isGabin(item.name) ? Boolean(item.options?.box) : false,
              topping: isGabin(item.name) ? item.options?.topping || "" : "",
            },
          };
        }),
        total: Number(total) || 0,
        paymentMethod: "QRIS",
        paymentStatus: "Pembayaran Berhasil",
        pickupMethod,
        pickupLocation: pickupMethod === "Pickup by Order" ? "Ropa Studio - Pondok Jagung Timur" : pickupLocation,
        pickupDate: pickupMethod === "Pickup langsung" ? pickupDate : "",
        pickupTime,
        paymentProof: {
          name: proofName || "bukti-transfer.jpg",
          type: "image/jpeg",
          data: compressed,
        },
      };

      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Gagal menyimpan pesanan.");
      }

      localStorage.removeItem(CART_KEY);

      const savedOrder = {
        ...(data.order || {}),
        pickupMethod,
        pickupLocation: pickupMethod === "Pickup by Order" ? "Ropa Studio - Pondok Jagung Timur" : pickupLocation,
        pickupDate: pickupMethod === "Pickup langsung" ? pickupDate : "",
        pickupTime,
      };

      localStorage.setItem("food-po-last-order", JSON.stringify(savedOrder));
      router.push("/thanks");
    } catch (err) {
      setError(err?.message || "Gagal mengirim PO.");
    } finally {
      setLoading(false);
    }
  };

  if (!cartItems.length && products.length) {
    return (
      <main className="min-h-screen bg-[#e8e4d9] px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold">Keranjang masih kosong</h1>
          <p className="mt-2 text-[#59665c]">Pilih menu terlebih dahulu sebelum lanjut ke checkout.</p>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-[#385144] px-6 py-3 font-semibold text-white">
            Kembali ke Menu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e8e4d9] text-[#385144]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-[#59665c]">← Kembali ke menu</Link>
        <header className="mb-6 mt-5">
          <h1 className="text-3xl font-bold">Transaksi</h1>
          <p className="mt-2 text-[#59665c]">Isi data pesanan, pilih pengambilan, lalu bayar melalui QRIS.</p>
        </header>

        <form onSubmit={submitOrder} className="space-y-5">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold">Data Customer</h2>
            <div className="mt-4 space-y-3">
              <input required placeholder="Nama" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black" />
              <input 
                required 
                placeholder="WhatsApp"  
                inputMode="tel" 
                pattern="[0-9+()\-\s]{8,30}" 
                title="Nomor WhatsApp hanya boleh berisi angka, +, -, spasi, dan tanda kurung" 
                type="tel" 
                value={customer.whatsapp} 
                onChange={(e) => { 
                  const cleaned = e.target.value.replace(/[^0-9+()\-\s]/g, ''); 
                  setCustomer({ ...customer, whatsapp: cleaned }); 
                }} 
                className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black" 
              />              
              <textarea placeholder="Catatan (opsional)" value={customer.note} onChange={(e) => setCustomer({ ...customer, note: e.target.value })} className="min-h-20 w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold">Pesanan</h2>
            <div className="mt-4 divide-y">
              {cartItems.map((item, index) => (
                <div key={`${item.id}-${item.options?.box}-${item.options?.topping}-${index}`} className="py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>
                      {item.name} × {item.quantity}
                      {isGabin(item.name) && item.options?.box && <span className="text-xs text-[#68746b]"> (Box)</span>}
                      {isGabin(item.name) && item.options?.topping && <span className="text-xs text-[#68746b]"> + {item.options.topping}</span>}
                    </span>
                    <span className="font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-4 text-lg font-bold">
                <span>Total</span>
                <span>{formatRupiah(total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold">Pengambilan Pesanan</h2>
            <p className="mt-1 text-sm text-[#68746b]">Pilih cara kamu menerima pesanan.</p>

            <button type="button" onClick={() => { setPickupMethod("Pickup by Order"); setPickupLocation(""); setPickupDate(""); setPickupTime(""); }} className={`mt-4 w-full rounded-2xl border-2 p-4 text-left transition ${pickupMethod === "Pickup by Order" ? "border-[#385144] bg-[#f1eee6]" : "border-gray-200"}`}>
              <div className="flex gap-4">
                <div className="text-2xl">🛵</div>
                <div>
                  <p className="font-bold">Pickup by Order</p>
                  <p className="text-sm text-[#68746b]">Pesanan diambil atau dikirim menggunakan kurir yang kamu pesan sendiri.</p>
                </div>
              </div>
            </button>

            {pickupMethod === "Pickup by Order" && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-[#f1eee6] p-4">
                  <p className="text-sm text-[#68746b]">Lokasi pickup</p>
                  <p className="mt-1 font-bold">📍 Ropa Studio - Pondok Jagung Timur</p>
                  <p className="mt-1 text-sm text-[#68746b]">Kurir mengambil pesanan dari lokasi ini.</p>
                  <a href="https://maps.app.goo.gl/GxaaaRAcxBEF8ytM6" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold underline">Lihat lokasi di Google Maps →</a>
                </div>
                <div>
                  <label className="mb-2 block font-semibold">Pilih waktu pickup</label>
                  <div className="space-y-3">
                    {pickupByOrderTimes.map((time) => (
                      <button key={time} type="button" onClick={() => setPickupTime(time)} className={`w-full rounded-2xl border-2 p-4 text-left transition ${pickupTime === time ? "border-[#385144] bg-[#f1eee6]" : "border-gray-200"}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{time}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button type="button" onClick={() => { setPickupMethod("Pickup langsung"); setPickupLocation(""); setPickupDate(""); setPickupTime(""); }} className={`mt-3 w-full rounded-2xl border-2 p-4 text-left transition ${pickupMethod === "Pickup langsung" ? "border-[#385144] bg-[#f1eee6]" : "border-gray-200"}`}>
              <div className="flex gap-4">
                <div className="text-2xl">🤝</div>
                <div>
                  <p className="font-bold">Pickup langsung</p>
                  <p className="text-sm text-[#68746b]">Ambil langsung / ketemu.</p>
                </div>
              </div>
            </button>

            {pickupMethod === "Pickup langsung" && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 font-semibold">Pilih lokasi pickup</p>
                  <button 
                    type="button" 
                    onClick={() => { setPickupLocation("Ropa Studio - Pondok Jagung Timur"); setPickupTime(""); }} 
                    className={`w-full rounded-2xl border-2 p-4 text-left ${pickupLocation === "Ropa Studio - Pondok Jagung Timur" ? "border-[#385144] bg-[#f1eee6]" : "border-gray-200"}`}
                  >
                    <p className="font-bold">📍 Ropa Studio - Pondok Jagung Timur</p>
                  </button>
                </div>

                {pickupLocation && (
                  <div>
                    <label className="mb-2 block font-semibold">Pilih hari pickup</label>
                    <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black">
                      <option value="">Pilih hari pickup</option>
                      {pickupDates.map((date) => (
                        <option key={date.value} value={date.value}>{date.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {pickupLocation && pickupDate && (
                  <div>
                    <label className="mb-2 block font-semibold">Pilih waktu pickup</label>
                    <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black">
                      <option value="">Pilih waktu pickup</option>
                      {availableTimes.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold">Pembayaran QRIS</h2>
            <p className="mt-1 text-sm text-[#68746b]">Scan QRIS berikut sesuai dengan total pembayaran.</p>
            <div className="mt-4 flex justify-center rounded-2xl bg-[#f1eee6] p-5">
              <img src="/qris.jpeg" alt="QRIS teallo" className="max-h-[420px] w-auto max-w-full rounded-xl object-contain" />
            </div>
            <div className="mt-4 rounded-xl bg-[#f1eee6] p-4 text-center">
              <p className="text-sm text-[#68746b]">Total pembayaran</p>
              <p className="text-2xl font-bold">{formatRupiah(total)}</p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold">Bukti Transfer</h2>
            <p className="mt-1 text-sm text-[#68746b]">Upload screenshot/foto bukti pembayaran.</p>
            <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center hover:bg-[#f1eee6]">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  setError("File harus berupa gambar.");
                  return;
                }
                setError("");
                setPaymentProof(file);
                setProofName(file.name);
              }} />
              <span className="font-semibold">{proofName || "Pilih foto bukti transfer"}</span>
              <span className="mt-1 block text-xs text-[#68746b]">JPG atau png</span>
            </label>
            {proofName && <p className="mt-2 text-center text-xs text-green-600">Bukti pembayaran sudah diupload</p>}
          </section>

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={loading || !cartItems.length} className="w-full rounded-xl bg-[#385144] px-4 py-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Pemesan sedang diproses..." : "Lanjut Pemesanan"}
          </button>

          <p className="pb-5 text-center text-xs text-[#68746b]">
            Dengan menekan pembayaran di atas, pesanan dan bukti pembayaran akan dicek kembali oleh admin.
          </p>
        </form>
      </div>
    </main>
  );
}