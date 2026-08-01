# Opus — Product Architecture Review & Redesign

> Status: independent architectural opinion (2026-08-01)
> Peran penulis: Principal Product Architect
> Objek review: Quant notifier-bot · Market Pulse · Tradeway — sebagai **satu produk**, bukan tiga repo
> Dokumen ini **berbeda pendapat** di beberapa titik dengan `docs/product-architecture-v2.md`. Perbedaannya ditandai eksplisit di §9.

---

## Ringkasan Eksekutif

1. Masalahnya bukan "3 aplikasi", tapi **3 tahap dari 1 pipeline yang masing-masing menumbuhkan UI sendiri** (deteksi → keputusan → eksekusi).
2. Navigasi sekarang mencerminkan **struktur repo**, bukan cara berpikir trader (Conway's Law yang terlihat di bottom nav).
3. Tidak ada objek bersama bernama **Opportunity**. Tanpa itu, menyatukan UI cuma menempel tiga app di balik satu nav.
4. Aset paling bernilai bukan UI mana pun — tapi **deteksi Quant + evidence ledger (forward-test 2.0.0)**. Yang lain bisa dibuang.
5. **Quant tidak layak jadi tab.** Quant adalah *source*, bukan destinasi. Tapi jangan dikubur jadi "data" — beri badge, beri scorecard.
6. **Market tidak perlu dipisah.** Konteks adalah lapisan yang mewarnai setiap layar, bukan tujuan browsing.
7. **Position memang bukan modul — tapi Book (posisi + risk budget) tetap layak jadi tab.** Ini koreksi halus atas asumsi Dee.
8. Nav final: **Now · Ideas · Book · Lab**, + **Ticket** (sheet, bukan tab), + **Bot** (permukaan ke-5 di luar app).
9. Tiga keputusan Dee kutentang: **Zipline** (salah tool untuk perp futures), **"semua data di Postgres"** (salah untuk raw OHLCV), **Bybit sebagai execution provider** (menggandakan permukaan risiko tanpa nilai produk).
10. Migrasi 7 fase strangler, tiap fase live & bisa dipakai; fase pertama adalah **notifikasi**, bukan UI.

---

## 1. Kritik Arsitektur Produk Saat Ini

### 1.1 Diagnosis inti: ini bukan 3 produk, ini 1 pipeline yang pecah

Kalau digambar sebagai alur nilai, ketiganya menempati posisi berurutan di **satu** rantai:

```
[Quant]         [Market Pulse]                    [Tradeway]
detection  →    context · decision · execution →  execution (venue lain)
                · review · journal
```

Yang terjadi: setiap tahap tumbuh UI-nya sendiri karena tiap repo butuh "cara melihat hasil kerjanya". Dashboard Quant lahir bukan karena trader butuh dashboard Quant — tapi karena developer Quant butuh melihat output-nya. **Itu developer surface yang naik pangkat jadi product surface.** Ini penyakit paling umum di platform buatan solo founder, dan ini penyakit utama di sini.

Konsekuensinya: menggabungkan tiga UI di balik satu bottom nav **tidak menyelesaikan apa pun**. Hasilnya tetap tiga aplikasi, cuma dengan satu header.

### 1.2 IA sekarang adalah cerminan repo, bukan cerminan trader

Tab "Market / Quant / Posisi / Journal" memetakan hampir 1:1 ke `market-pulse` / `notifier-bot` / `tradeway` / `market-pulse.review`. Itu Conway's Law yang bocor ke permukaan produk.

Trader tidak pernah berpikir "aku mau buka tab Quant". Trader berpikir dalam **pertanyaan**:

- "Hari ini kondisinya gimana?"
- "Ada yang layak dilihat nggak?"
- "Ini worth di-entry nggak?"
- "Posisiku aman nggak?"
- "Kemarin aku salah di mana?"

Lima pertanyaan. IA harus punya jawaban untuk lima pertanyaan itu, bukan lima gudang data.

### 1.3 Market Pulse sendiri sudah over-featured — ini kritik yang belum ada yang berani bilang

`frontend/src/routes/` punya: `index`, `markets`, `rankings`, `regime`, `rotation`, `technical`, `news`, `journal`, `review`, `tracker`, `trades`, `token.$symbol`, `settings`, `app`, `login`.

Dan sesuai CLAUDE.md, **`index`/`markets`/`rankings`/`regime`/`rotation`/`technical` semuanya selector di atas satu `MarketSnapshot` yang sama.** Enam rute untuk satu objek data. Itu bukan produk — itu museum dari satu struct.

Ini bukti bahwa masalah "3 aplikasi" bahkan bukan masalah terbesar. **Masalah terbesar: tidak ada yang pernah menghapus.** Setiap ide baru dapat rute baru. Platform profesional dibedakan bukan dari berapa banyak yang dia tampilkan, tapi dari berapa banyak yang dia **berani tidak tampilkan**.

### 1.4 Tidak ada objek bersama "Opportunity" — ini akar teknis dari rasa "tiga app"

Sekarang ada tiga konsep "peluang" yang tidak kompatibel:

| Sistem | Objeknya | Bukti yang menyertainya | Umur |
|---|---|---|---|
| Quant | signal (`ma-alignment`, `bos-bullish`, …) regime-gated | ratusan jam backtest | event, kadaluarsa |
| Market Pulse | universe verdict `go/wait/no_go` + POI/SMC assessment | forward-test 2.0.0, ter-provenance | hysteresis, tahan sampai trigger pecah |
| Tradeway | setup SMC/FVG di Bybit | backtest internal TS | bar-scoped |

Tiga skema, tiga clock, tiga definisi "valid", tiga standar bukti. Selama tiga objek ini tidak dipeta ke **satu skema kanonik**, "satu produk" hanya kosmetik. Ini pekerjaan arsitektur nomor satu, di atas semua urusan UI.

### 1.5 Notifikasi adalah permukaan produk yang paling sering dipakai — dan paling tidak diarsitekturi

Realitanya: mayoritas interaksi harian bukan buka aplikasi. Mayoritas interaksi adalah **menerima alert di Telegram**. Sekarang ada **tiga sumber notifikasi independen**: Telegram bot Quant, SSE/alert Market Pulse, notifier Tradeway. Satu otak, tiga mulut.

Untuk produk yang mobile-first + Telegram Mini App, ini bukan detail — ini **the front door**. App itu drill-down; bot itu produknya. Rencana v2 memperlakukan notifikasi sebagai efek samping. Menurutku itu salah prioritas: **unifikasi notifikasi harus fase pertama**, bukan fase terakhir, karena itu satu-satunya perubahan yang langsung terasa "satu produk" tanpa menyentuh satu baris pun UI.

### 1.6 Tiga klaim alpha, nol perbandingan

Quant punya backtest-nya. MP punya forward-test 2.0.0 dengan disiplin versi yang serius (`engine/smc/version.py`, EDR, spike pre-registered). Tradeway punya backtest TS-nya. **Tidak ada satu pun angka yang bisa dibandingkan lintas sistem**, karena masing-masing punya ledger sendiri.

Padahal justru **disiplin evidence Market Pulse (version bump, pre-registered spike, provenance stamp) adalah aset intelektual paling langka di sini** — lebih langka daripada detektornya. Itu yang harus diangkat jadi **layanan platform**, dan setiap sumber sinyal harus tunduk padanya. Platform yang punya satu ledger bukti bisa menjawab: "detektor mana yang layak dipercaya bulan ini?" Tiga app yang ditempel tidak akan pernah bisa.

### 1.7 Kritik ke rencana yang sudah ada (`product-architecture-v2.md`)

Rencana itu benar di arah besarnya (Quant = engine, Market = layer, no live-proxy, satu auth). Tiga hal yang menurutku keliru:

1. **"Trade" dijadikan tab.** Tab yang tidak bisa dibuka tanpa konteks simbol bukan tab — itu detail view. Kalau di-tap tanpa simbol, isinya apa? Daftar simbol = duplikat Ideas. Trade harus jadi **Ticket sheet** yang bisa dibuka dari mana saja (Ideas, Book, alert deep-link, search).
2. **"Journal" dijadikan tab.** Journaling yang berguna terjadi **saat keputusan diambil**, bukan malam hari. Kalau journal adalah tempat yang harus didatangi, dia akan kosong dalam 2 minggu. Journal harus jadi **byproduct otomatis dari Ticket**, dan dibaca di Lab.
3. **Bybit dijadikan execution provider di F4.** Menambah venue eksekusi berarti menggandakan permukaan Trading Constitution, liquidation math, symbol mapping, dan mode margin — untuk nol nilai produk baru. Tradeway harusnya masuk sebagai **signal source + position feed (read-only)**, bukan order sink.

---

## 2. Product Vision (satu kalimat)

> **Satu ruang kerja trading yang, setiap kali dibuka, menjawab satu pertanyaan berikutnya milik trader — dari "kondisi hari ini apa" sampai "aku salah di mana" — dengan setiap peluang membawa bukti performanya sendiri.**

Dua klausa itu sengaja:

- **"pertanyaan berikutnya"** — produk ini berbentuk alur, bukan koleksi halaman.
- **"membawa bukti performanya sendiri"** — ini pembeda dari 99% tool sinyal. Setiap sinyal muncul dengan track record sumbernya. Ini yang bikin platform, bukan bot.

Uji pakai: setiap fitur baru harus bisa menjawab *"pertanyaan trader yang mana?"* dan *"buktinya dari ledger mana?"*. Kalau tidak bisa, jangan dibuat.

---

## 3. User Journey Ideal

**Prinsip: journey tidak dimulai di aplikasi. Journey dimulai di notifikasi.** Setiap desain yang mengasumsikan trader "membuka app" duluan sudah salah di langkah nol.

### Journey A — Pagi (07:05 WIB, 40 detik total)

1. **[Luar app] Telegram push:** *"BEAR · conf 0.78 · 2 macro high-impact hari ini · 3 ideas baru (1 high conviction)"*. Satu pesan, dari satu bot. Ini menggantikan tiga notifikasi hari ini.
2. **Tap → Now (8 detik).** Regime + confidence, bias 1D/4H, macro hari ini, breadth, sentimen. Tanpa scroll. Kalau tidak ada yang berubah dari kemarin, layar harus **bilang begitu** ("tidak ada perubahan material sejak kemarin") — bukan menampilkan 6 kartu identik.
3. **Swipe → Ideas (15 detik).** Feed peluang terurut. Tiap kartu: simbol, arah, alasan satu baris, badge sumber (`Quant · ma-align`, `SMC · OB-retest`, `Tradeway · FVG`), dan **hit-rate 30 hari sumber itu**. Yang bertentangan dengan regime otomatis tenggelam, tidak dihapus (transparansi > kepura-puraan).
4. **Tap kartu → Ticket (belum keputusan, baru 15 detik).** Chart + forecast cone + TP/SL probability (aset Quant), zona SMC, event terkait, funding, jarak likuidasi vs stop.

### Journey B — Keputusan (60 detik, di dalam Ticket)

5. **Baca bukti.** Satu blok: "sumber ini, di regime ini, 30 hari terakhir: n=24, hit 58%, avg R 0.7". Kalau n < ambang → tampilkan **"insufficient evidence"**, jangan tampilkan persentase palsu.
6. **Set risiko.** Drag entry/stop/target di chart (sudah ada di MP) → sizing otomatis dari risk budget, bukan dari nominal.
7. **Permit.** Trading Constitution mengevaluasi: exposure total, korelasi dengan posisi terbuka, jarak likuidasi vs stop, event window, kill switch. Hasil: `ALLOW` / `ALLOW WITH LIMITS` / `REJECT (alasan)`. **AI tidak bisa membatalkan REJECT** — ini sudah benar di EDR 0020, pertahankan mati-matian.
8. **Execute.** Satu tombol. Journal entry ditulis **otomatis** di detik itu: thesis, bukti yang dilihat, permit verdict, harga, ukuran. Trader tidak mengetik apa pun kecuali ingin.
9. **Skip juga dicatat.** Kalau menutup Ticket tanpa entry, tanya satu tap: *kenapa?* (`invalid` / `late` / `no conviction` / `risk`). **Skip adalah data**. Tanpa ini, review cuma bisa menilai trade yang diambil — separuh perilaku hilang.

### Journey C — Hari tanpa trade (10 detik) — journey yang paling sering, dan paling sering dilupakan

Buka app → Now bilang: *"Regime choppy. 0 ide lolos gate. Tidak ada aksi hari ini."* → tutup app. **Produk yang jujur bilang "tidak ada apa-apa" lebih bernilai daripada produk yang selalu menemukan sesuatu.** Ini juga satu-satunya cara mengukur diri: kalau feed selalu penuh, gate-nya rusak.

### Journey D — Posisi berjalan (paling tinggi taruhannya)

Regime flip saat posisi terbuka → push: *"Regime BULL→BEAR. Kamu punya 2 posisi long, exposure 1.8R. ETH stop 0.4% dari harga."* → tap → **Book**, bukan Ideas. Aksi cepat: tighten stop / partial close / do nothing (dengan alasan tercatat). Ini momen di mana platform benar-benar menyelamatkan uang, dan sekarang paling tidak terlayani.

### Journey E — Refleksi (mingguan, 5 menit, di Lab)

Bukan "lihat trade-mu". Tapi: *"Minggu ini kamu skip 6 setup dari sumber yang hit-rate-nya 61%, dan mengambil 3 dari sumber 38%."* Refleksi harus menyerang **pola perilaku**, bukan menampilkan tabel P&L. Data untuk ini datang dari langkah 9 (skip capture).

---

## 4. Information Architecture & Navigation

### 4.1 Nav utama — 4 tab, bukan 5

```
┌──────────┬──────────┬──────────┬──────────┐
│   Now    │  Ideas   │   Book   │   Lab    │
└──────────┴──────────┴──────────┴──────────┘
      +  Ticket (bottom sheet, symbol-scoped, dari mana saja)
      +  Bot (permukaan di luar app: alert, digest, deep-link)
```

| Tab | Pertanyaan | Isi | Yang TIDAK boleh ada |
|---|---|---|---|
| **Now** | "Apa yang terjadi sekarang?" | Regime + confidence, bias 1D/4H, macro hari ini, sentimen, breadth, alert terbaru, delta-vs-kemarin | Tabel universe penuh, ranking, heatmap eksploratif |
| **Ideas** | "Mana yang layak kulihat?" | Feed Opportunity ter-rank (semua sumber, badge + hit-rate), filter, watchlist, search | Detail analisis (itu Ticket) |
| **Book** | "Di mana posisiku & berapa sisa risikonya?" | Posisi live + uPnL, open orders, exposure & korelasi, risk budget tersisa, kill-switch state | Riwayat trade panjang (itu Lab) |
| **Lab** | "Apa yang berhasil, dan aku salah di mana?" | Source scorecards, backtest runs (03:00), forward-test evidence, journal & forensics, behavior review | Konfigurasi harian (itu Settings) |

**Ticket** (sheet, bukan tab): chart + forecast + zona + events + risiko + permit + execute + journal capture. Selalu terbuka di atas konteks pemanggilnya — kembali = tutup sheet, tidak kehilangan tempat. Ini yang bikin terasa "satu app": trader tidak pernah *pindah halaman* untuk memutuskan.

**Settings** masuk avatar/header, bukan tab. Tab adalah barang mewah; jangan dipakai untuk hal yang dibuka sebulan sekali.

### 4.2 Kenapa 4, bukan 5

Di viewport Telegram Mini App, tab ke-5 menekan target sentuh di bawah ambang nyaman dan memaksa label disingkat sampai kehilangan arti. Lebih penting: **tab ke-5 selalu jadi tempat sampah**. Empat tab memaksa setiap fitur baru menjawab "ini masuk pertanyaan yang mana?" — itu disiplin yang selama ini hilang di repo ini (lihat §1.3).

### 4.3 Jawaban langsung untuk challenge Dee

| Pertanyaan Dee | Jawaban | Alasan |
|---|---|---|
| Quant masih layak jadi tab utama? | **Tidak.** | Quant adalah *source*, bukan destinasi. Tapi jangan dikubur: tampilkan sebagai **badge bermerek + scorecard** di Ideas, dan **promosikan forecast cone-nya ke dalam Ticket** — itu aset visual paling khas yang kamu punya, sayang kalau hilang bersama dashboard-nya. |
| Market masih perlu dipisah? | **Tidak.** | Konteks adalah *lapisan*, bukan tujuan. Ia mewarnai Now (ringkasan), Ideas (gating & ranking), dan Ticket (risiko). Tapi enam rute snapshot (`markets/rankings/regime/rotation/technical`) jangan dipindah — **dihapus**, sisakan satu "Market detail" yang bisa dibuka dari Now untuk yang benar-benar mau menggali. |
| Position harus jadi fitur, bukan modul? | **Setengah setuju — dan di sini aku menentang.** | Objek `Position` memang *state*, benar. Tapi pertanyaan "berapa sisa risikoku" adalah domain penuh (exposure, korelasi, risk budget, kill switch) dan itu **pertanyaan paling sering setelah entry**. Menurunkannya jadi widget di halaman lain adalah kesalahan. **Position = state; Book = domain & tab.** |
| Flow sekarang sudah mengikuti workflow trader? | **Belum.** | Flow sekarang: pilih gudang data → cari sendiri. Flow trader: konteks → kandidat → validasi → risiko → aksi → catat. Perbedaan terbesar bukan urutan tab — tapi bahwa flow sekarang **tidak dimulai dari notifikasi** dan **tidak mencatat keputusan skip**. Dua lubang itu yang membuat loop tidak pernah tertutup. |

### 4.4 Aturan navigasi

1. **Setiap layar menjawab satu pertanyaan.** Kalau butuh dua judul, itu dua layar.
2. **Kedalaman maksimal 2 tap dari notifikasi ke aksi.** Deep-link alert harus mendarat langsung di Ticket dengan simbol terisi.
3. **Ticket tidak pernah jadi halaman.** Kalau ia jadi URL penuh, trader kehilangan konteksnya dan produk kembali terasa seperti banyak app.
4. **Empty state wajib punya kalimat.** "Tidak ada ide lolos gate hari ini karena regime choppy" — bukan spinner, bukan kartu kosong.

---

## 5. Domain yang Benar

Bounded context yang benar (bukan tab, bukan repo):

| # | Domain | Tanggung jawab | Objek inti |
|---|---|---|---|
| 1 | **Context** | Keadaan pasar: regime, bias multi-TF, macro, sentimen, breadth, funding | `RegimeState`, `MacroEvent`, `SentimentSnapshot` |
| 2 | **Signal** | Deteksi mentah dari banyak sumber, append-only, tidak pernah di-overwrite | `SignalEvent{source, source_version, symbol, side, horizon, features}` |
| 3 | **Opportunity** | Kandidat yang layak dilihat manusia: dedup lintas sumber, gating oleh Context, ranking | `Opportunity{symbol, side, sources[], conviction, evidence_ref, expires_at}` |
| 4 | **Decision** | Ticket, sizing, Trading Constitution/permit, journal entry, **skip entry** | `Ticket`, `Permit`, `JournalEntry` |
| 5 | **Execution** | Order routing + reconciliation ke venue | `Order`, `Fill`, `ExecutionKey` |
| 6 | **Book** | Posisi, exposure, korelasi, risk budget, kill switch | `Position`, `RiskBudget`, `ExposureView` |
| 7 | **Evidence** | Backtest, forward-test, settlement, scorecard per sumber, forensics | `BacktestRun`, `ForwardRecord`, `SourceScorecard` |
| 8 | **Delivery** | Satu kanal notifikasi: prioritas, dedup, quiet hours, deep-link | `Notification`, `DeliveryRule` |

**Dua domain yang belum pernah diakui, dan justru paling menentukan:**

- **Evidence (7)** — ini yang mengubah "kumpulan bot" jadi platform. Aturannya keras: *tidak ada sumber yang boleh naik ke Ideas tanpa scorecard*. Sumber baru masuk sebagai `shadow` (tercatat, tak ditampilkan) sampai n cukup. Disiplin ini sudah ada di MP untuk engine SMC — angkat jadi **layanan lintas sumber**.
- **Delivery (8)** — permukaan yang paling sering dilihat trader. Sekarang tidak punya pemilik, jadi tiga sistem berteriak sendiri-sendiri.

**BUKAN domain (infrastruktur — jangan pernah muncul di nav):**
Quant detection pipeline · Tradeway bot · Binance/Bybit API · parquet lake · arq worker · TanStack SSR.

**Bahasa yang harus dibunuh** (jargon internal yang bocor ke UI): "shadow record", "anticipatory", "forward-test", "hysteresis", "POI", "engine version". Trader tidak peduli. Terjemahkan: shadow → *"belum ditampilkan, masih dikumpulkan buktinya"*; forward-test → *"track record live"*.

---

## 6. Hapus · Gabung · Pindah

### HAPUS (benar-benar hapus, bukan diarsip)

| Item | Alasan |
|---|---|
| Dashboard `quant.dev.heydewi.com` | Developer surface yang naik pangkat. Nilainya di deteksi, bukan tampilan. Redirect ke platform. |
| Mini App proxy (`/app` shell + rantai proxy) | Glue tanpa kedalaman; proxy antar-sistem adalah utang, bukan arsitektur. |
| Rute `markets`, `rankings`, `regime`, `rotation`, `technical` | Enam view dari satu snapshot. Sisakan **satu** "Market detail" di balik Now. |
| Rute `news` sebagai tab | News adalah atribut simbol & konteks, bukan destinasi. Muncul di Now (top 3) + Ticket (event terkait). |
| Notifier terpisah Quant & Tradeway | Diganti Delivery tunggal. Ini bukan penghapusan fitur, ini penghapusan **duplikasi mulut**. |
| Bot Telegram terpisah (3 → 1) | Satu identitas produk. Tiga bot = tiga produk di kepala pengguna. |
| Tab "Journal" | Journaling pindah ke Ticket (otomatis); pembacaannya ke Lab. |
| Rencana Bybit sebagai **order sink** | Lihat §9.3. |
| Rencana **Zipline** | Lihat §9.1. |

### GABUNG

| Dari | Ke | Catatan |
|---|---|---|
| Regime Quant + regime/verdict MP | **Context**, satu `RegimeState` | Kalau dua-duanya punya opini, simpan keduanya sebagai *sumber*, tampilkan satu konsensus + tanda kalau berselisih. **Perselisihan adalah informasi**, jangan disembunyikan. |
| Sinyal Quant + verdict universe MP + setup Tradeway | **Opportunity feed (Ideas)** | Dedup by `(symbol, side, horizon-bucket)`; kalau 2+ sumber setuju → conviction naik, dan itu ditampilkan (*"3 sumber sepakat"* adalah kartu terkuat di produk ini). |
| Forecast cone + TP/SL prob (Quant) + chart/zona/events (MP) | **Ticket** | Satu layar keputusan. |
| Review + forensics + backtest + scorecard | **Lab** | Refleksi dan riset adalah loop yang sama, beda horizon. |
| 3 kanal notifikasi | **Delivery** | Prioritas: `critical` (posisi & risiko) > `opportunity` > `digest`. Quiet hours hanya berlaku untuk dua terakhir. |

### PINDAH

| Item | Dari | Ke |
|---|---|---|
| Detektor Quant | proses + dashboard sendiri | **service ingestion** yang menulis `signal_events` ke Postgres. Tanpa proxy runtime. |
| Forecast engine Quant | `notifier-bot/src/forecast` | package bersama, dipanggil API platform (port bertahap, boleh jalan sebagai service dulu — asal kontraknya tabel, bukan HTTP proxy) |
| Strategi SMC/FVG Tradeway | bot mandiri | **signal source** (emit ke `signal_events`) + **position feed read-only** ke Book |
| Disiplin versi & provenance (`engine/smc/version.py`, EDR, pre-registered spike) | khusus engine SMC | **aturan platform** untuk semua sumber di domain Evidence |
| Settings | tab | header/avatar |

### PERTAHANKAN (jangan disentuh)

- Trading Constitution deterministik + permit; AI tidak bisa override REJECT (EDR 0020).
- Testnet-first, kill switch default-off, tolak key ber-scope withdrawal.
- Disiplin version bump saat semantik decision/trigger berubah.
- Aturan `TEST_DATABASE_URL` untuk suite DB (VPS ini adalah produksi).

---

## 7. Software Architecture

Arsitektur software **mengikuti** product architecture di atas — bukan sebaliknya.

### 7.1 Bentuk besar

```
                     ┌──────────────────────────────┐
                     │  DELIVERY (satu bot Telegram)│  ← front door
                     │  prioritas · dedup · deeplink│
                     └───────────────┬──────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────┐
│  ONE APP  — TanStack Start, responsive                              │
│  Web (iq.heydewi.com) === Mini App (Telegram WebApp adapter)        │
│  Now · Ideas · Book · Lab  +  Ticket sheet                          │
└────────────────────────────────────┬────────────────────────────────┘
                                     │  /api/v1 (SSE untuk push; TIDAK ada WS server)
┌────────────────────────────────────┴────────────────────────────────┐
│  FastAPI — read models per domain                                   │
│  context · opportunities · ticket/{sym} · book · lab · delivery     │
└──────┬──────────────┬───────────────┬───────────────┬───────────────┘
       │              │               │               │
┌──────┴─────┐ ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────────────┐
│  Postgres  │ │  Ranker     │ │  Evidence   │ │  Execution          │
│ product    │ │ signal→opp  │ │ settle +    │ │ Binance only        │
│ state      │ │ dedup+gate  │ │ scorecard   │ │ constitution gate   │
└──────┬─────┘ └─────────────┘ └──────┬──────┘ └─────────────────────┘
       │                              │
┌──────┴──────────────────────────────┴───────────────────────────────┐
│  INGESTION (arq cron)                                               │
│  quant detectors · SMC engine 2.0.0 · tradeway feed · news · macro  │
│  semua menulis signal_events / context_* — TIDAK ADA proxy runtime  │
└──────┬──────────────────────────────────────────────────────────────┘
       │
┌──────┴──────────────────────────────────────────────────────────────┐
│  RESEARCH PLANE  parquet lake (raw OHLCV) + DuckDB + backtest runner│
│  03:00 WIB suite → backtest_runs → 07:00 WIB report → Delivery+Lab  │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Kontrak kunci: `signal_events` (append-only)

Ini **satu keputusan teknis yang paling menentukan** apakah ini jadi satu produk.

```sql
signal_events(
  id, source, source_version, symbol, side, horizon,
  detected_at, expires_at,
  features jsonb,              -- payload asli sumber, tak ditafsir
  context_ref,                 -- regime saat terdeteksi (untuk segmentasi evidence)
  dedup_key,                   -- (symbol, side, horizon_bucket, day)
  status                       -- shadow | live
)
```

Aturan keras:
- **Append-only.** Sinyal tidak pernah di-update; koreksi = event baru.
- **Setiap baris ber-provenance** (`source` + `source_version`). Semua statistik segmentasi per `source_version` — persis pola yang sudah terbukti di `engine/smc`.
- **Sumber baru selalu masuk `shadow`** sampai Evidence bilang layak. Ini mencegah dashboard penuh sinyal tak teruji.
- **Tidak ada proxy runtime antar sistem.** Kalau data belum ada, UI menampilkan empty state jujur. Proxy HTTP antar-app adalah cara tercepat membangun kembali "tiga aplikasi" di balik satu domain.

`Opportunity` **bukan tabel sumber kebenaran** — ia read model yang dihitung ranker dari `signal_events × context × scorecard`. Jadi mengubah ranking tidak pernah merusak data historis.

### 7.3 Data plane — dan koreksi atas "semua data di Postgres"

| Jenis data | Simpan di | Alasan |
|---|---|---|
| Raw OHLCV multi-TF, seluruh universe, historis panjang | **Parquet** (partisi `symbol/timeframe/date`), dibaca DuckDB | Kolumnar, kompresi 10–20×, scan riset cepat, tidak membebani DB produksi |
| Fitur turunan untuk backtest | **Parquet** | Recompute-able, tidak perlu durabilitas transaksional |
| `signal_events`, context, positions, orders, journal, evidence, scorecard | **Postgres** | Butuh transaksi, relasi, auth, dan dibaca API |
| Candle window kecil untuk render UI | Postgres/cache | Latency |

**Ini menentang keinginan Dee "semua data di Postgres".** Detailnya di §9.2.

### 7.4 Mini App = adapter, bukan aplikasi

Satu codebase, satu URL, satu route tree. Deteksi `window.Telegram.WebApp` → aktifkan adapter: theme params, viewport/safe-area, BackButton native (bukan tombol back sendiri), MainButton untuk aksi utama Ticket, haptics. **Tidak ada route tree kedua.** Kalau ada `/app` terpisah, dalam 3 bulan ia akan tertinggal fitur dan kamu kembali punya dua produk.

Auth: `initData` diverifikasi server → session cookie yang sama dengan web. Satu identitas.

Konsekuensi desain yang harus diterima: karena Mini App tidak bisa push sendiri, **semua push wajib lewat bot** — memperkuat kenapa Delivery adalah domain, bukan utilitas.

### 7.5 Batas repo

Jangan paksa monorepo di awal — biaya migrasi tinggi, nilai rendah. Yang wajib bersatu adalah **kontrak dan data**, bukan folder:

- `market-pulse` = **platform** (app + API + Postgres + worker + research plane). Ini pusatnya.
- `notifier-bot` = **detector library/service**; berhenti punya UI & bot sendiri; output = `signal_events`.
- `tradeway` = **venue bot Bybit**; output = `signal_events` + position feed read-only.

Monorepo boleh dipertimbangkan **setelah** fase 4, kalau ternyata perubahan kontrak sering lintas repo. Kalau tidak sering — jangan.

### 7.6 Research loop (03:00 / 07:00 WIB)

- **20:00 UTC (03:00 WIB)** — arq cron: tarik data → parquet → jalankan suite backtest (semua sumber, semua regime) → tulis `backtest_runs` + artefak parquet. Wajib deterministik & ber-seed; setiap run menyimpan commit hash + config hash.
- **00:00 UTC (07:00 WIB)** — report: gabung backtest + forward-test → refresh `source_scorecard` → render Now + kirim satu digest lewat Delivery.
- **Lab** menampilkan run: equity curve, per-detector, per-regime, dan **diff terhadap run kemarin** (yang menarik bukan angkanya, tapi perubahannya).

Aturan penting: **backtest tidak boleh mengubah gate produksi secara otomatis.** Perubahan semantik tetap lewat pre-registered spike + version bump. Loop harian menghasilkan *usulan*, bukan *deploy*.

---

## 8. Migration Plan (tanpa big-bang)

Prinsip: **strangler**, tiap fase berakhir di state live & pakai. VPS ini produksi — tidak boleh ada jendela pecah.

| Fase | Fokus | Isi | Exit criteria | Rollback |
|---|---|---|---|---|
| **P0 — Freeze & kontrak** (0.5 hari) | Hentikan pendarahan | Stop fitur baru di dashboard Quant & mini proxy. Migrasi `signal_events` + `source_scorecard`. Tulis skema `Opportunity` di dokumen. | Tabel ada, migrasi jalan di staging DB | drop migration |
| **P1 — Delivery tunggal** (1–2 hari) | Permukaan paling sering dipakai | Satu bot. Quant & Tradeway berhenti kirim langsung → publish `notifications`. Prioritas + dedup + quiet hours + deep-link. | 1 hari penuh: nol notifikasi dobel, semua deep-link mendarat benar | flag: nyalakan lagi notifier lama |
| **P2 — Ingestion kontrak** (2 hari) | Satu data | Detektor Quant menulis `signal_events` (dual-run: tetap kirim TG lama di belakang flag). Tradeway emit signal + position feed. | 48 jam: jumlah sinyal di DB == jumlah alert lama | matikan writer, tak ada yang rusak |
| **P3 — Ideas + Ticket** (3–4 hari) | Inti produk | Ranker (dedup + gate regime). Ideas feed dengan badge sumber. **Ticket sheet** + skip-capture + journal otomatis. Port forecast cone ke Ticket. | Trader bisa: alert → Ticket → permit → execute, tanpa keluar app | route lama masih hidup |
| **P4 — IA final** (2–3 hari) | Satu produk | Now/Ideas/Book/Lab. Hapus `markets/rankings/regime/rotation/technical/news` (redirect ke Now). Telegram adapter di app utama; `/app` shell pensiun. `quant.dev` → 301. | Nav 4 tab live di web + Mini App; nol rute yatim | redirect balik |
| **P5 — Evidence plane** (2–3 hari) | Moat | Settlement lintas sumber, `source_scorecard`, aturan shadow→live, tampilkan hit-rate di kartu Ideas, forensics di Lab. | Setiap kartu Ideas menampilkan bukti atau "insufficient evidence" | sembunyikan blok bukti |
| **P6 — Research plane** (3–4 hari) | Loop harian | Parquet lake + DuckDB, backtest runner (bukan Zipline), cron 03:00/07:00, dashboard run di Lab. | 3 hari berturut run otomatis + digest terkirim | cron off |
| **P7 — Book & risk** (2 hari) | Kelengkapan | Exposure, korelasi, risk budget, alert regime-flip untuk posisi terbuka (Journey D). | Alert posisi terkirim & mendarat di Book | flag |

**Aturan migrasi:**
1. Tidak ada fase yang menyentuh 3 repo sekaligus untuk hal yang sama.
2. Setiap penghapusan didahului **redirect**, bukan 404.
3. Setiap perpindahan writer pakai **dual-run + rekonsiliasi hitungan**, minimal 48 jam.
4. Perubahan semantik engine tetap tunduk version bump + pre-registered spike — migrasi IA **bukan** alasan menyentuh semantik.
5. Setiap fase punya **kill criteria** tertulis sebelum mulai.

**Urutan ini sengaja tidak dimulai dari UI.** P1 (notifikasi) memberi rasa "satu produk" paling cepat dengan risiko paling kecil, dan P2 (kontrak data) adalah prasyarat agar UI baru tidak lahir di atas proxy.

---

## 9. Keputusan Dee yang Kutentang (eksplisit)

### 9.1 Zipline — **jangan pakai**

Zipline lahir untuk **ekuitas US, daily bar, long/short portfolio dengan trading calendar**. Yang kamu punya: **perp futures crypto, 24/7 tanpa kalender, funding rate periodik, leverage & liquidation, entri intraday 15m/1H, per-simbol bukan portfolio**. Hampir setiap asumsi inti Zipline salah di sini, dan kamu akan menghabiskan waktu melawan framework-nya, bukan menjalankan riset. Ditambah: pipeline sinyalmu (Quant detectors, `engine/smc` 2.0.0) **sudah ada dan sudah bervalidasi** — memaksanya masuk bundle/pipeline API Zipline berarti menulis ulang logika yang sudah terbukti, dan memutus perbandingan dengan forward-test yang sedang berjalan.

**Alternatif, berurutan preferensi:**
1. **Runner sendiri di atas engine yang sudah ada** — replay bar-by-bar `signal_events` + settlement yang sudah dipakai forward-test. Keunggulan menentukan: **backtest dan forward-test memakai kode settlement yang sama**, jadi angkanya bisa dibandingkan. Ini yang paling penting, dan tidak bisa diberikan framework mana pun.
2. **vectorbt** untuk sweep parameter cepat (vektor, cocok untuk grid harian).
3. **nautilus_trader** kalau nanti butuh fidelity event-driven + fees/funding realistis.

Kalau tetap ingin Zipline setelah membaca ini, itu keputusanmu dan aku akan bangun di atasnya — tapi catat bahwa biayanya adalah **kehilangan komparabilitas backtest↔forward-test**, dan itu justru moat yang sedang kita bangun.

### 9.2 "Semua data di Postgres" — **benar sebagai niat, salah sebagai aturan literal**

Niatnya benar: satu sumber kebenaran, hentikan data tersebar di file JSON/proses masing-masing. Yang salah: menaruh **raw OHLCV multi-timeframe untuk seluruh universe** di Postgres. Itu puluhan-ratusan juta baris yang tidak pernah di-update, tidak butuh transaksi, dan hanya dibaca dalam scan besar untuk riset — pola beban yang tepat untuk kolumnar, bukan row-store OLTP yang sama dengan yang melayani permintaan trading live.

**Aturan yang benar:** *Semua **state produk** di Postgres. Semua **raw & derived research data** di Parquet.* Postgres tetap satu-satunya sumber kebenaran untuk apa pun yang punya konsekuensi (sinyal, keputusan, order, posisi, bukti).

### 9.3 Bybit sebagai execution provider — **jangan, atau tunda tanpa batas**

Menambah venue eksekusi berarti mengganda: Trading Constitution per-venue, aturan margin/leverage, matematika likuidasi, symbol mapping, format order algo, penanganan error, rekonsiliasi, dan penyimpanan kunci. Semua itu ada di jalur yang bisa **kehilangan uang nyata**, dan MP baru saja stabil di satu venue (Binance testnet→mainnet, `/fapi/v1/algoOrder`, dsb).

Nilai produknya: nol. Tidak ada pertanyaan trader yang dijawab oleh "aku bisa entry di Bybit juga".
**Alternatif:** Tradeway tetap bot Bybit yang berjalan sendiri; platform membaca **posisi (read-only)** ke Book dan **sinyalnya** ke Ideas. Trader melihat semuanya di satu tempat tanpa platform ikut memikul risiko eksekusi venue kedua.

### 9.4 "Trade" sebagai tab & "Journal" sebagai tab — **keduanya salah bentuk**

Sudah dibahas di §1.7 dan §4. Ringkas: Trade adalah **sheet** (butuh konteks simbol), Journal adalah **byproduct** (harus terjadi saat keputusan, bukan malam hari).

### 9.5 "Position = fitur, bukan modul" — **setengah salah**

Objeknya memang state. Tapi **risk budget adalah domain**, dan itu pertanyaan paling sering setelah entry. Turunkan `Position` jadi widget, dan Journey D (regime flip saat posisi terbuka — momen paling mahal) kehilangan rumah. **Book tetap tab.**

### 9.6 "Semua harus jadi Mini App" — **hampir benar, satu koreksi**

Mini App tidak bisa push, tidak bisa jalan di background, dan viewport-nya sempit. Jadi Mini App **tidak bisa** jadi keseluruhan produk — ia adalah *ruang drill-down*. Produk sesungguhnya berbentuk **bot (notifikasi & digest) + Mini App (kedalaman) + web (riset di Lab, layar besar)**, semuanya dari satu codebase. Desain untuk bot dulu, app-nya menyusul; bukan sebaliknya.

---

## 10. Yang Dee Sudah Benar (jangan diganggu)

- **Menolak auto-trading.** Permit + konfirmasi manusia adalah keputusan produk yang benar dan jarang dipegang orang.
- **Constitution deterministik yang tidak bisa di-override AI.** Ini pemisahan tanggung jawab yang tepat: AI menarasikan & menggugat, kode yang menolak.
- **Disiplin version bump + pre-registered spike.** Ini praktik kelas institusi. Angkat jadi aturan platform, jangan cuma untuk engine SMC.
- **Insting bahwa Quant & Market bukan tab.** Benar, dan lebih benar dari yang kamu kira — ikuti sampai ujungnya: **hapus**, jangan pindahkan.
- **Mobile-first / Telegram.** Benar untuk trader futures. Tinggal dilengkapi: front door-nya bot, bukan app.

---

## Lampiran A — Uji "satu produk"

Produk lulus kalau lima kalimat ini benar:

1. Trader bisa pergi dari **notifikasi → keputusan tereksekusi dalam 2 tap**, tanpa pindah aplikasi.
2. Setiap peluang menampilkan **track record sumbernya**, atau menyatakan jujur bahwa buktinya belum cukup.
3. **Skip tercatat** sama seriusnya dengan entry.
4. Ada **satu bot, satu login, satu URL**.
5. Menambah sumber sinyal baru **tidak menambah tab, tidak menambah bot, tidak menambah dashboard** — hanya menambah baris di `signal_events` dan satu badge di Ideas.

Poin 5 adalah ujian terkeras, dan satu-satunya yang membuktikan ini platform, bukan tiga aplikasi yang ditempel.
