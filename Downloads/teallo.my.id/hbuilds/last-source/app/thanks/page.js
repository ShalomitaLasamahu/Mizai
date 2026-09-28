"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function Thanks() {
  const receiptRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    try {
      const savedOrder = JSON.parse(localStorage.getItem("food-po-last-order") || "null");
      setOrder(savedOrder);
    } catch {
      setOrder(null);
    }
  }, []);

  const getPickupInfo = () => {
    if (!order) return { name: "", mapsUrl: "" };
    if (order.pickupLocation === "Graha Raya MCD") return { name: "Graha Raya MCD", mapsUrl: "https://maps.app.goo.gl/keLoXNEs36wEoUvf7" };
    if (order.pickupLocation === "Ropa Studio - Pondok Jagung Timur") return { name: "Ropa Studio - Pondok Jagung Timur", mapsUrl: "https://maps.app.goo.gl/GxaaaRAcxBEF8ytM6" };
    if (order.pickupMethod === "Pickup by Order") return { name: "Ropa Studio - Pondok Jagung Timur", mapsUrl: "https://maps.app.goo.gl/GxaaaRAcxBEF8ytM6" };
    return { name: order.pickupLocation || "-", mapsUrl: "" };
  };

  const pickupInfo = getPickupInfo();

  const downloadPNG = async () => {
    if (!receiptRef.current || !order) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const link = document.createElement("a");
      link.download = `bukti-PO-${order.orderNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Gagal membuat PNG:", error);
    } finally {
      setDownloading(false);
    }
  };

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e8e4d9] p-5">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold">Bukti PO tidak ditemukan</h1>
          <p className="mt-2 text-sm text-[#68746b]">Silakan kembali ke menu dan buat pesanan kembali.</p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-[#385144] px-5 py-3 font-semibold text-white">Kembali ke menu</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e8e4d9] px-4 py-8 text-[#385144]">
      <div className="mx-auto max-w-md">
        <div ref={receiptRef} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {/* Header */}
          <div className="text-center">
            <div className="mb-1 flex justify-center">
              <img src="/Logo.png" alt="Gabin Bar" className="h-auto w-[200px] object-contain" />
            </div>
            <h1 className="mt-2 text-2xl font-bold">Pembayaran Berhasil</h1>
            <p className="mt-1 text-sm text-[#68746b]">{order.orderNumber}</p>
          </div>

          {/* Data Customer */}
          <div className="mt-6 rounded-2xl bg-[#f1eee6] p-4 text-sm">
            <p><b>Nama:</b> {order.customer?.name || "-"}</p>
            <p className="mt-1"><b>WhatsApp:</b> {order.customer?.whatsapp || "-"}</p>
            {order.customer?.note && <p className="mt-1"><b>Catatan:</b> {order.customer.note}</p>}
          </div>

          {/* Pickup Info */}
          <div className="mt-5 rounded-2xl bg-[#f1eee6] p-4">
            <p className="text-sm text-[#68746b]">Pengambilan Pesanan</p>
            <p className="mt-1 font-bold">{order.pickupMethod || "-"}</p>
            {pickupInfo.name && (
              <div className="mt-3">
                <p className="text-sm text-[#68746b]">Lokasi</p>
                <p className="mt-1 font-semibold">📍 {pickupInfo.name}</p>
                {pickupInfo.mapsUrl && (
                  <a href={pickupInfo.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Lihat lokasi di Google Maps</a>
                )}
              </div>
            )}
            {order.pickupDate && (
              <div className="mt-3">
                <p className="text-sm text-[#68746b]">Hari pickup</p>
                <p className="mt-1 font-semibold">{order.pickupDate}</p>
              </div>
            )}
            {order.pickupTime && (
              <div className="mt-3">
                <p className="text-sm text-[#68746b]">Waktu pickup</p>
                <p className="mt-1 font-semibold">{order.pickupTime}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mt-5 divide-y">
            {order.items?.map((item, index) => (
              <div key={item.id || index} className="py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    {item.name} × {item.quantity}
                    {item.options?.box && <span className="text-xs text-[#68746b]"> (Box)</span>}
                    {item.options?.topping && <span className="text-xs text-[#68746b]"> + {item.options.topping}</span>}
                  </span>
                  <span className="font-semibold">
                    {formatRupiah(item.subtotal ?? Number(item.unitPrice || item.price || 0) * Number(item.quantity || 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-2 flex justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{formatRupiah(order.total)}</span>
          </div>

          {/* Status */}
          <div className="mt-5 rounded-xl bg-[#f1eee6] p-4 text-center">
            <p className="text-sm font-semibold">Pembayaran Berhasil</p>
          </div>

          <p className="mt-5 text-center text-xs text-[#7f8982]">~ Terima kasih sudah order di teallo ~</p>
        </div>

        {/* Tombol aksi */}
        <button onClick={downloadPNG} disabled={downloading} className="mt-5 w-full rounded-xl bg-[#385144] px-5 py-4 font-semibold text-white disabled:opacity-50">
          {downloading ? "Menyiapkan gambar..." : "Download Bukti (PNG)"}
        </button>
        <a href="https://wa.me/6285110539005" target="_blank" rel="noopener noreferrer" className="mt-3 block w-full rounded-xl bg-green-600 px-5 py-4 text-center font-semibold text-white transition hover:bg-green-700">
          Chat Admin via WhatsApp
        </a>
        <Link href="/" className="mt-3 block w-full rounded-xl border bg-white px-5 py-4 text-center font-semibold">
          Kembali ke Menu
        </Link>
      </div>
    </main>
  );
}