/**
 * One prompt, one call: extract structure AND render it in Indonesian.
 *
 * Keeping translation in the extraction call (rather than a second pass) is
 * what makes the cook view feel native — there is no English intermediate to
 * drift out of sync, and no "translate" button anywhere in the app.
 */
export const SYSTEM_PROMPT = `Kamu membantu sebuah rumah tangga di Bandung merapikan resep masakan.

Tugasmu: baca teks atau gambar resep, lalu kembalikan resep terstruktur dalam BAHASA INDONESIA.

Aturan bahasa:
- Bahasa Indonesia adalah bahasa utama. Tulis judul, bahan, dan langkah dalam bahasa Indonesia.
- Pakai istilah yang dipakai sehari-hari di dapur dan pasar Indonesia — "bawang bombay", bukan terjemahan harfiah dari "onion". "Daun bawang", bukan "bawang hijau".
- Istilah yang memang dipakai apa adanya di dapur Indonesia biarkan saja (misalnya "saus teriyaki", "pasta", "oregano").
- Satuan: pakai sdm, sdt, gram, ml, buah, siung, butir, lembar, secukupnya.
- Kalau sumbernya berbahasa Inggris, isi juga title_en dan item_en / en sebagai catatan untuk perencana. Kalau sumbernya sudah bahasa Indonesia, biarkan field itu null.

Aturan isi:
- Pisahkan takaran dari nama bahan: qty ("2"), unit ("sdm"), item_id ("kecap manis").
- Kalau tidak ada takaran, isi qty dan unit dengan null.
- Langkah masak: kalimat pendek dan jelas, satu tindakan per langkah. Jangan menomori (nomor ditambahkan otomatis).
- Buang basa-basi blog, iklan, cerita pribadi, dan ajakan berlangganan.
- total_minutes: perkiraan total waktu memasak dalam menit. Kalau tidak yakin, perkirakan wajar.
- tags: 2-5 label pendek huruf kecil untuk memudahkan pencarian nanti (contoh: ayam, mie, pedas, cepat, makan-malam, vegetarian).
- notes: hanya diisi kalau ada catatan penting dari sumber (misalnya "lebih enak didiamkan semalam"). Kalau tidak ada, null.

Jangan mengarang bahan atau langkah yang tidak ada di sumber. Kalau ada bagian yang tidak terbaca, lewati saja.`;

export const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title_id: { type: "string" },
    title_en: { type: ["string", "null"] },
    servings: { type: ["integer", "null"] },
    total_minutes: { type: ["integer", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          qty: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          item_id: { type: "string" },
          item_en: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
        },
        required: ["qty", "unit", "item_id", "item_en", "note"],
        additionalProperties: false,
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          en: { type: ["string", "null"] },
        },
        required: ["id", "en"],
        additionalProperties: false,
      },
    },
    tags: { type: "array", items: { type: "string" } },
    notes: { type: ["string", "null"] },
  },
  required: [
    "title_id",
    "title_en",
    "servings",
    "total_minutes",
    "ingredients",
    "steps",
    "tags",
    "notes",
  ],
  additionalProperties: false,
} as const;

export function userPromptForText(text: string, sourceUrl?: string): string {
  const source = sourceUrl ? `\n\nSumber: ${sourceUrl}` : "";
  return `Rapikan resep berikut menjadi data terstruktur berbahasa Indonesia.${source}\n\n---\n${text}\n---`;
}

export const IMAGE_PROMPT =
  "Baca resep di gambar ini (bisa halaman buku masak, tulisan tangan, atau screenshot) " +
  "dan kembalikan sebagai data terstruktur berbahasa Indonesia.";
