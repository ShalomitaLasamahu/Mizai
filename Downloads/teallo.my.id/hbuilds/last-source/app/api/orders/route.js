import { NextResponse } from "next/server";
import { products as localProducts } from "../../libs/product";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 7 * 1024 * 1024;
const MAX_PROOF_BASE64_CHARS = 6 * 1024 * 1024;
const MAX_QTY_PER_ITEM = 50;

const BOX_PRICE = 1000;
const TOPPING_PRICE = 3000;
const ALLOWED_TOPPINGS = [
  "Oreo",
  "Coco crunch",
  "Ovaltine",
  "Choco chips",
  "Regal",
];
// GANTI: gunakan "gabin" bukan "roasted milk tea"
const GABIN_KEYWORD = "gabin";

const clean = (value, maxLength = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, maxLength);

const normalizeName = (value) =>
  clean(value, 200)
    .toLowerCase()
    .replace(/\s+/g, " ");

const jsonError = (error, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

function validateOptions(product, item) {
  const rawOptions = item?.options && typeof item.options === "object" ? item.options : {};
  const isGabin = normalizeName(product.name).includes(GABIN_KEYWORD);

  // Produk selain Gabin tidak boleh menerima options
  if (!isGabin) {
    return { box: false, topping: "" };
  }

  const box = rawOptions.box === true;
  const topping = String(rawOptions.topping || "").trim();

  if (topping && !ALLOWED_TOPPINGS.includes(topping)) {
    throw new Error(`Topping "${topping}" tidak tersedia.`);
  }

  if (topping && !box) {
    throw new Error("Topping hanya boleh jika memakai box.");
  }

  return { box, topping };
}

export async function POST(request) {
  try {
    // Jangan menerima request body yang sengaja dibuat terlalu besar.
    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonError(
        "Request terlalu besar. Ukuran bukti transfer maksimal 5 MB.",
        413
      );
    }

    const googleSheetsUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!googleSheetsUrl) {
      return jsonError(
        "Konfigurasi server belum lengkap.",
        500
      );
    }

    const body = await request.json();

    const {
      customer,
      items,
      pickupMethod,
      pickupLocation,
      pickupDate,
      pickupTime,
      paymentProof,
    } = body;

    // =========================
    // CUSTOMER
    // =========================
    const customerName = clean(customer?.name, 100);
    const whatsapp = clean(customer?.whatsapp, 30);
    const note = clean(customer?.note, 500);

    if (!customerName || !whatsapp) {
      return jsonError("Nama dan WhatsApp wajib diisi.");
    }

    if (!/^[0-9+()\-\s]{8,30}$/.test(whatsapp)) {
      return jsonError("Nomor WhatsApp tidak valid.");
    }

    // =========================
    // PICKUP
    // =========================
    const safePickupMethod = clean(pickupMethod, 50);

    if (
      safePickupMethod !== "Pickup by Order" &&
      safePickupMethod !== "Pickup langsung"
    ) {
      return jsonError("Metode pickup tidak valid.");
    }

    const safePickupTime = clean(pickupTime, 20);

    if (!safePickupTime) {
      return jsonError("Waktu pickup belum dipilih.");
    }

    let safePickupLocation = "";
    let safePickupDate = "";

    if (safePickupMethod === "Pickup by Order") {
      safePickupLocation =
        "Ropa Studio - Pondok Jagung Timur";
    } else {
      safePickupLocation = clean(pickupLocation, 150);
      safePickupDate = clean(pickupDate, 50);

      if (!safePickupLocation || !safePickupDate) {
        return jsonError(
          "Lokasi dan hari pickup wajib diisi."
        );
      }
    }

    // =========================
    // BUKTI TRANSFER
    // =========================
    const proofData = paymentProof?.data;

    if (
      typeof proofData !== "string" ||
      !proofData.startsWith("data:image/")
    ) {
      return jsonError(
        "Bukti transfer harus berupa gambar."
      );
    }

    if (proofData.length > MAX_PROOF_BASE64_CHARS) {
      return jsonError(
        "Ukuran bukti transfer terlalu besar. Maksimal 5 MB.",
        413
      );
    }

    // Hanya izinkan format gambar yang memang digunakan aplikasi.
    const proofMatch = proofData.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/
    );

    if (!proofMatch) {
      return jsonError(
        "Format bukti transfer tidak didukung."
      );
    }

    // =========================
    // AMBIL PRODUK TERBARU DARI SERVER
    // =========================
    const productsResponse = await fetch(
      `${googleSheetsUrl}?action=products`,
      {
        cache: "no-store",
      }
    );

    const productsText = await productsResponse.text();

    let productsData;

    try {
      productsData = JSON.parse(productsText);
    } catch {
      return jsonError(
        "Data produk dari server tidak valid.",
        502
      );
    }

    if (
      !productsResponse.ok ||
      productsData?.ok === false
    ) {
      return jsonError(
        "Stok sedang tidak dapat diverifikasi.",
        502
      );
    }

    const remoteProducts = Array.isArray(
      productsData?.products
    )
      ? productsData.products
      : [];

    // Produk lokal = sumber harga terpercaya.
    // Sheet = sumber stok terbaru.
    const findLocalProduct = (item) =>
      localProducts.find(
        (product) => String(product.id) === String(item?.id || "").trim()
      );

    const findRemoteProduct = (localProduct) =>
      remoteProducts.find(
        (product) => String(product?.id || "").trim() === localProduct.id
      );

    // =========================
    // ITEMS + HARGA + STOK + OPTIONS
    // =========================
    if (!Array.isArray(items) || !items.length) {
      return jsonError("Pesanan tidak ditemukan.");
    }

    if (items.length > localProducts.length) {
      return jsonError("Data pesanan tidak valid.");
    }

    const safeItems = [];

    for (const item of items) {
      const quantity = Number(item?.quantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > MAX_QTY_PER_ITEM
      ) {
        return jsonError(
          "Jumlah produk tidak valid."
        );
      }

      const localProduct = findLocalProduct(item);

      if (!localProduct) {
        return jsonError(
          "Produk tidak ditemukan."
        );
      }

      const remoteProduct =
        findRemoteProduct(localProduct);

      if (!remoteProduct) {
        return jsonError(
          `Produk "${localProduct.name}" tidak tersedia.`
        );
      }

      const stock = Number(remoteProduct.stock);
      const price = Number(localProduct.price);

      if (!Number.isFinite(stock) || stock < 0) {
        return jsonError(
          "Data stok produk tidak valid.",
          502
        );
      }

      if (!Number.isFinite(price) || price < 0) {
        return jsonError(
          "Data harga produk tidak valid.",
          500
        );
      }

      if (quantity > stock) {
        return jsonError(
          `Stok "${localProduct.name}" tidak cukup. Stok saat ini ${stock}, sedangkan dipesan ${quantity}.`
        );
      }

      // Validasi options (box & topping)
      let options;
      try {
        options = validateOptions(localProduct, item);
      } catch (error) {
        return jsonError(error.message);
      }

      const unitPrice = price + (options.box ? BOX_PRICE : 0) + (options.topping ? TOPPING_PRICE : 0);

      safeItems.push({
        id: String(localProduct.id),
        name: String(localProduct.name),
        price,
        unitPrice,
        quantity,
        options,
        subtotal: unitPrice * quantity,
      });
    }

    // =========================
    // TOTAL DARI SERVER
    // =========================
    const calculatedTotal = safeItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    // =========================
    // ORDER NUMBER
    // =========================
    const orderNumber =
      `PO-${Date.now().toString().slice(-8)}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;

    // =========================
    // JANGAN PERCAYA PAYMENT STATUS
    // DARI BROWSER
    // =========================
    const order = {
      orderNumber,
      createdAt: new Date().toISOString(),

      customer: {
        name: customerName,
        whatsapp,
        note,
      },

      pickupMethod: safePickupMethod,
      pickupLocation: safePickupLocation,
      pickupDate: safePickupDate,
      pickupTime: safePickupTime,

      items: safeItems,
      total: calculatedTotal,

      paymentMethod: "QRIS",

      // Status ditentukan server, bukan request customer.
      paymentStatus: "Pembayaran Berhasil",

      paymentProof: {
        name:
          clean(paymentProof?.name, 100) ||
          "bukti-transfer.jpg",
        type: proofMatch[1],
        data: proofData,
      },
    };

    // =========================
    // KIRIM KE GOOGLE APPS SCRIPT
    // =========================
    const response = await fetch(
      googleSheetsUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(order),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let result = null;

    try {
      result = JSON.parse(text);
    } catch {
      result = null;
    }

    if (!response.ok || !result?.ok) {
      console.error(
        "Google Apps Script error:",
        response.status
      );

      return jsonError(
        result?.error ||
          "PO gagal disimpan. Silakan coba lagi.",
        502
      );
    }

    // Jangan kirim kembali data bukti transfer Base64 ke browser.
    const { paymentProof: _proof, ...safeOrder } =
      order;

    return NextResponse.json({
      ok: true,
      order: {
        ...safeOrder,
        paymentProofUrl:
          result.paymentProofUrl || "",
      },
    });
  } catch (error) {
    console.error("Orders API error:", error);

    return jsonError(
      "Server gagal memproses pesanan.",
      500
    );
  }
}