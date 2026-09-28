import { NextResponse } from "next/server";
import { products as localProducts } from "../../libs/product";

export const runtime = "nodejs";

export async function GET() {
  try {
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "GOOGLE_APPS_SCRIPT_URL belum diisi di .env.local." },
        { status: 500 }
      );
    }

    const response = await fetch(`${url}?action=products`, { cache: "no-store" });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Response Google Apps Script tidak valid. Cek URL Web App dan deployment Apps Script." },
        { status: 502 }
      );
    }

    if (!response.ok || data.ok === false) {
      return NextResponse.json(
        { ok: false, error: data.error || "Gagal mengambil stok." },
        { status: 502 }
      );
    }

    const remoteProducts = Array.isArray(data.products) ? data.products : [];

    // SUMBER KEBENARAN MENU = lokal.
    // Google Sheet HANYA boleh menyuplai stok berdasarkan menu-id.
    const mergedProducts = localProducts.map((local) => {
      const remote = remoteProducts.find(
        (item) => String(item?.id || "").trim() === local.id
      );

      const stock = remote ? Number(remote.stock) : 0;

      if (!Number.isFinite(stock) || stock < 0) {
        throw new Error(`Data stok tidak valid untuk ${local.id}.`);
      }

      return {
        ...local,
        stock,
      };
    });

    return NextResponse.json(
      { ok: true, products: mergedProducts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { ok: false, error: "Stok sedang tidak dapat dimuat." },
      { status: 500 }
    );
  }
}
