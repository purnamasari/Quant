# Implementation Plan v3 — Satu Produk (rencana eksekusi, bukan arsitektur)

> Status: **plan final (2026-08-01)** · Menggabungkan `docs/deepseek-pragmatic-architecture.md` (scope + urutan) dan `docs/Opus.md` (domain model: Opportunity, Evidence, Ticket, bot = front door).
> `docs/product-architecture-v2.md` = referensi awal, **superseded** di setiap titik yang bertentangan.
> Dokumen ini executable: ambil satu Sprint, kerjakan, tanpa nanya lagi.

## 0. Kondisi lapangan (diverifikasi di box ini, 2026-08-01)

Angka di bawah ini dicek langsung — bukan asumsi dari dokumen sebelumnya:

| Fakta | Bukti |
|---|---|
| `backend/app/quant/router.py` = proxy HTTP ke `localhost:8787` (`/state`, `/token`) | `curl localhost:8787/api/state` → 401 (butuh initData); router forward header apa adanya |
| `backend/app/tradeway/router.py` = proxy ke `localhost:8100` — **service ini HIDUP**, bukan 503 | `tradeway-api.service` active, `WorkingDirectory=/home/ubuntu/code/personal/tradeway`, `pnpm positions:api`; `GET /positions` mengembalikan **4 posisi Binance futures** (EUL/BTW/UNI/ARB) |
| `alerts` sudah lengkap: `severity`, `dedupe_key` UNIQUE, `delivered_at`, `read` | `backend/app/execution/alert_models.py` |
| Dual-auth bridge sudah ada | `backend/app/auth/dependencies.py:22` — `X-Internal-Key` + `X-Internal-User-Id` |
| Keputusan (termasuk skip) sudah punya tabel | `decisions` + `user_action ∈ {accepted_skip, rejected_skip, took_trade, ignored}` (`decision_router.py`) |
| **`/execution/skip-check` BUKAN skip-capture** — dia dry-run gate pra-trade, tidak menyimpan apa pun | `skip_check_router.py` docstring: "nothing is persisted" |
| arq worker hidup, cron 5 menit + alert pass menit ke-1 | `backend/app/worker/config.py` |
| notifier-bot kirim langsung ke Telegram | `src/deliverAlert.js` → `src/telegram.js` |
| notifier-bot cron: `cryptoJob` tiap jam 06–22, `macroPing` :05 tiap jam, `dailyBias` 09:00 | `crontab -l` |
| **`getUpdates` sudah dipakai** `src/tracking.js` (tombol FOLLOW/SKIP) — konsumen kedua akan mencuri callback | `src/dailyBias.js:16-17` menulis peringatan ini eksplisit |
| RAM box: 3723 MB total, **~660 MB available** | `free -m` |
| Migrasi backend = Alembic di `backend/migrations/versions/` | 15 revisi, terakhir `f1a2b3c4d5e6_binance_review_models.py` |

Konsekuensi: pekerjaan ini **bukan membangun dari nol**. Ini *membalik arah* — matikan proxy jadi writer, satukan mulut notifikasi, tambah satu feed. Koreksi terpenting atas DeepSeek: skip-capture belum ada (dia mengira `skip_check` = itu), dan tradeway-api **sudah jalan** (dia mengira belum).

---

## 1. Prinsip eksekusi

1. **Strangler, bukan big-bang.** Sistem lama tetap hidup sampai penggantinya terbukti; tidak ada jendela pecah — VPS ini produksi.
2. **Tiap fase ≤3 hari dan berakhir live & terpakai.** Kalau sebuah fase tidak bisa dipakai Dee di hari terakhirnya, fase itu terlalu besar — pecah.
3. **Rollback satu baris.** Tiap fase punya satu env flag / satu `systemctl` / satu redirect yang mengembalikan keadaan. Ditulis *sebelum* mulai.
4. **Pindah writer = dual-run 48 jam + rekonsiliasi hitungan.** Dual-run berarti dua jalur *menulis*, tapi hanya **satu yang mengirim** (`delivery_state='suppressed'`), supaya nol notifikasi ganda.
5. **Append-only untuk fakta, read model untuk tampilan.** `signal_events` tidak pernah di-update; `Opportunity` dihitung, tidak disimpan — mengubah ranking tidak boleh merusak sejarah.
6. **Tidak ada proxy runtime untuk data yang kita miliki.** Proxy hanya boleh untuk *state milik sistem lain* (posisi tradeway-api), tidak untuk fakta yang seharusnya jadi record kita.
7. **Semantik engine tetap tunduk version bump + pre-registered spike.** Migrasi IA/produk **bukan** alasan menyentuh semantik decision/trigger (`engine/smc/version.py` = 2.0.0).
8. **Bahasa: Indonesia untuk teks produk/UI, Inggris untuk teknis** (nama tabel, kolom, route, kode, log). Jargon internal dilarang muncul di UI: *shadow record → "masih dikumpulkan buktinya"*, *forward-test → "track record live"*.

### 1.5 Lima konflik — keputusan

| # | Konflik | **Keputusan** |
|---|---|---|
| 1 | `signal_events`: kontrak penuh (Opus) vs subset (DeepSeek) | **Subset + `dedup_key` sejak hari pertama.** `context_ref` dan `status` ditunda. Alasan: `dedup_key` UNIQUE-lah yang membuat append-only aman terhadap retry, dan rekonsiliasi Sprint 2 bergantung padanya; `context_ref` bisa di-backfill dari `detected_at` (pola `context_stamper.py` sudah ada), jadi menyimpannya sekarang tidak membeli apa-apa; `status shadow/live` masih kebijakan 1 sumber — cukup allowlist di config sampai sumber kedua muncul (Sprint 5). |
| 2 | Nav: 4 tab sekarang (Opus P4) vs tunda (DeepSeek) | **4 tab mendarat di Sprint 5, sesudah Ideas (S3) dan Book (S4) punya isi, bersamaan dengan Lab shell.** Sprint 3 hanya menambah 1 tab "Ideas" (nav sementara 5 slot). Alasan: tab tanpa isi mengajarkan Dee untuk tidak menekannya; nav adalah *hasil* struktur, bukan penyebabnya. |
| 3 | Parquet/research plane: bangun (Opus P6) vs tunda (DeepSeek) | **Komitmen minimal: `source_scorecard` nightly di Postgres (Sprint 5). Parquet + DuckDB TIDAK dibangun sekarang** — dengan 660 MB RAM tersisa, DuckDB scan akan bersaing dengan Postgres produksi. Trigger tertulis untuk membangunnya: satu query scorecard >10 s **atau** `signal_events` >5 juta baris **atau** butuh sweep parameter lintas-universe. Backtest tetap di notifier-bot (sudah tervalidasi, jangan diulang). |
| 4 | tradeway-api/8100: "jangan dibangun" (DeepSeek) | **Moot — sudah dibangun dan jalan** (`tradeway-api.service`, 4 posisi Binance futures live). Tidak ada yang perlu dibangun; proxy read-only yang sudah ada dipertahankan sebagai **pengecualian sah** dari prinsip 6 (state milik sistem lain, kita tidak jadi pemiliknya) dan baru dipasang ke Book di **Sprint 4**, dengan label sumber + cache 15 s + offline state jujur. |
| 5 | Zipline | **Tetap ditolak, permanen.** Runner = **runner sendiri di atas kode settlement forward-test yang sudah ada**, supaya backtest dan forward-test memakai kode settlement yang sama dan angkanya bisa dibandingkan. `vectorbt` boleh menyusul khusus sweep parameter. `nautilus_trader` hanya kalau butuh fidelity funding/fee event-driven. |

---

## 2. Kontrak data inti

### 2.1 `signal_events` (append-only) — subset pragmatis

Satu Alembic revision baru di `backend/migrations/versions/` (model SQLAlchemy di `backend/app/signals/models.py`).

```sql
CREATE TABLE signal_events (
  id             varchar(36)  PRIMARY KEY,          -- uuid4, dibuat writer
  source         varchar(32)  NOT NULL,             -- 'quant' | 'smc' | 'tradeway'
  source_version varchar(32)  NOT NULL,             -- provenance: git sha pendek / '2.0.0'
  symbol         varchar(20)  NOT NULL,
  side           varchar(8)   NOT NULL,             -- 'long' | 'short'
  horizon        varchar(16)  NOT NULL,             -- 'scalp'|'intraday'|'swing'|'position'
  kind           varchar(48)  NOT NULL,             -- detector id: 'ma-alignment', 'bos-bullish', ...
  conviction     varchar(16),                       -- 'low'|'medium'|'high'|'very_high' (nullable)
  detected_at    timestamptz  NOT NULL,             -- waktu sumber mendeteksi (BUKAN waktu ingest)
  expires_at     timestamptz,                       -- null = tanpa kadaluarsa eksplisit
  features       jsonb        NOT NULL DEFAULT '{}'::jsonb,  -- payload asli sumber, TIDAK ditafsir
  dedup_key      varchar(255) NOT NULL,             -- '{source}|{symbol}|{side}|{horizon}|{YYYY-MM-DD}|{kind}'
  ingested_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT signal_events_dedup_key_key UNIQUE (dedup_key)
);
CREATE INDEX signal_events_symbol_detected_idx ON signal_events (symbol, detected_at DESC);
CREATE INDEX signal_events_detected_idx        ON signal_events (detected_at DESC);
CREATE INDEX signal_events_source_idx          ON signal_events (source, source_version);
```

**Append-only ditegakkan di dua lapis** (bukan cuma konvensi):

```sql
CREATE FUNCTION signal_events_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'signal_events is append-only'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_events_no_mutate
  BEFORE UPDATE OR DELETE ON signal_events
  FOR EACH ROW EXECUTE FUNCTION signal_events_immutable();
```

dan di repo: `backend/app/signals/repo.py` hanya mengekspor `insert_signal()` + query baca. Koreksi sinyal = event baru, bukan update.

**Kolom yang sengaja BELUM ada** (dan kapan boleh masuk):
- `context_ref` → Sprint 5, kalau scorecard per-regime terbukti butuh join yang lebih cepat daripada join `detected_at → context snapshot`.
- `status ('shadow'|'live')` → Sprint 5, saat sumber kedua (`smc`/`tradeway`) mulai menulis. Sampai itu, kelayakan tampil = allowlist `SIGNAL_SOURCES_LIVE` di `backend/app/config.py`.

### 2.2 Notifikasi: **pakai `alerts` yang sudah ada, jangan bikin `notifications` baru**

`alerts` sudah punya `severity`, `dedupe_key` UNIQUE, `delivered_at`, `user_id`, `token_symbol`. Menambah tabel `notifications` = tabel kedua untuk konsep yang sama. Yang ditambahkan cuma tiga kolom (satu Alembic revision):

```sql
ALTER TABLE alerts ADD COLUMN delivery_state   varchar(16) NOT NULL DEFAULT 'pending';  -- pending|sent|suppressed|failed
ALTER TABLE alerts ADD COLUMN delivery_attempts smallint   NOT NULL DEFAULT 0;
ALTER TABLE alerts ADD COLUMN source            varchar(32) NOT NULL DEFAULT 'market_pulse'; -- 'quant'|'tradeway'|'market_pulse'
CREATE INDEX alerts_delivery_state_idx ON alerts (delivery_state, created_at);
```

`AlertType` bertambah: `daily_digest`, `position_risk`, `opportunity`. Prioritas kirim: `critical` (posisi & risiko) > `warning` > `info`; quiet hours **hanya** berlaku untuk `info`.

### 2.3 `Opportunity` — read model, bukan tabel

Dihitung on-read oleh `backend/app/opportunities/service.py` dari `signal_events × context(regime) × source_scorecard`. Tidak pernah dipersist.

```python
class OpportunitySource(BaseModel):
    source: str; source_version: str; kind: str
    conviction: str | None; detected_at: datetime
    reason: str                      # satu baris, bahasa Indonesia, siap tampil

class Evidence(BaseModel):
    status: Literal["ok", "insufficient"]
    n: int; hit_rate: float | None; avg_r: float | None
    window_days: int = 30

class Opportunity(BaseModel):
    key: str                         # '{symbol}|{side}|{horizon}|{YYYY-MM-DD}'
    symbol: str; side: str; horizon: str
    sources: list[OpportunitySource] # >1 = "N sumber sepakat"
    conviction: Literal["low", "medium", "high"]
    regime_alignment: Literal["aligned", "counter", "neutral"]
    rank_score: float
    evidence: Evidence               # 'insufficient' saat n < 20 — JANGAN tampilkan persentase palsu
    first_detected_at: datetime; last_detected_at: datetime; expires_at: datetime | None
```

**Ranking (deterministik, ditulis di kode, bukan di kepala):**

```
rank_score = conviction_weight        # low .4 | medium .7 | high 1.0 | very_high 1.2
           * (1 + 0.35 * (len(sources) - 1))          # kesepakatan lintas sumber
           * freshness                                 # exp(-jam_sejak_detect / 12)
           * regime_factor                             # aligned 1.0 | neutral .8 | counter .4
```

Counter-regime **tenggelam, tidak dihapus** — transparansi di atas kepura-puraan.

---

## 3. Fase eksekusi

Urutan mengikuti brief: Delivery → Writer → Ideas/Ticket → Book → Lab/IA. Satu penyimpangan teknis dijelaskan di Sprint 2 (flip proxy dilakukan **sebagian**, bukan total).

---

### Sprint 1 — Satu Mulut (Delivery) · **2 hari**

**Tujuan:** persepsi "satu produk" di titik kontak harian, tanpa menyentuh UI.

**Tugas:**
1. Alembic revision: 3 kolom `alerts` di §2.2.
2. `backend/app/delivery/sender.py` — `send_telegram(text, *, chat_id, reply_markup=None)`; `httpx` langsung ke `https://api.telegram.org/bot{PLATFORM_BOT_TOKEN}/sendMessage`, `parse_mode=HTML`, retry 3× backoff 1.5 s (tiru `notifier-bot/src/telegram.js`). **Tanpa framework bot, tanpa `getUpdates`** (lihat Risiko R2).
3. `backend/app/delivery/service.py` — `run_delivery_pass(db)`: ambil `alerts WHERE delivery_state='pending' AND created_at > now() - interval '2 hours'` urut `severity DESC, created_at`, kirim, set `delivery_state='sent'` + `delivered_at`; gagal 3× → `'failed'`. Quiet hours 22:00–06:00 WIB hanya menahan `severity='info'`.
4. `backend/app/worker/config.py` — cron `delivery_tick` tiap menit, `timeout=120`.
5. `backend/app/delivery/router.py` — `POST /api/v1/alerts/ingest`, auth `X-Internal-Key` + `X-Internal-User-Id` (dependency existing), body = `{type, token_symbol, title, body, severity, dedupe_key, source}` → `alert_service.create_alerts()`. Daftarkan di `backend/app/main.py`.
6. Config baru di `backend/app/config.py`: `PLATFORM_BOT_TOKEN`, `PLATFORM_CHAT_ID`, `DELIVERY_ENABLED: bool = False`, `QUIET_HOURS_START/END`.
7. notifier-bot: `src/platformAlert.js` — `postAlert(alert)` ke `POST /api/v1/alerts/ingest`. Panggil dari `src/deliverAlert.js` dan `src/dailyBias.js`. Flag `PLATFORM_DELIVERY=off|shadow|live`:
   - `off` — perilaku sekarang.
   - `shadow` — legacy tetap kirim; platform ingest dengan `delivery_state='suppressed'` (parameter di body).
   - `live` — legacy **berhenti** kirim; platform yang kirim.
8. Setiap pesan berakhir dengan deep link `https://iq.heydewi.com/token/{SYMBOL}`.
9. Pindahkan **satu** alert nyata dulu: digest pagi `dailyBias.js` (09:00).

**Exit criteria (terukur):**
- 48 jam `shadow`: `SELECT count(*) FROM alerts WHERE source='quant'` == jumlah baris kirim di `/home/ubuntu/quant-logs/quant-*.log` pada jendela yang sama (toleransi 0).
- Setelah flip `live`: 2 pagi berturut-turut digest terkirim **tepat sekali**, dari **satu** bot.
- Deep link mendarat di halaman token yang benar (cek manual 3 simbol).
- `alerts WHERE delivery_state='failed'` = 0 selama 48 jam.

**Rollback:** `PLATFORM_DELIVERY=off` di env notifier-bot (+ `DELIVERY_ENABLED=false` di API). Legacy kirim lagi; nol data hilang.

---

### Sprint 2 — Balik Arah: proxy → writer · **3 hari**

**Tujuan:** MP jadi pemilik fakta sinyal, bukan jendela ke app lain.

**Tugas:**
1. Alembic revision: `signal_events` + trigger immutability (§2.1).
2. `backend/app/signals/` — `models.py`, `repo.py` (`insert_signal`, `list_signals(symbol?, since, sources)`), `ingest_router.py`: `POST /api/v1/ingest/signal` (internal key), idempoten lewat `ON CONFLICT (dedup_key) DO NOTHING` → 200 `{inserted: bool}`.
3. notifier-bot `src/platformSignal.js` — dipanggil dari `src/signalStore.js#recordSignal` (titik yang **sudah** merekam setiap sinyal, termasuk yang silent). Map: `entry.kind→kind`, `entry.direction→side`, `entry.conviction→conviction`, sisanya utuh ke `features`. `source_version` = `git rev-parse --short HEAD` saat boot.
4. `backend/app/opportunities/service.py` + `router.py` — `GET /api/v1/opportunities?horizon=&limit=`: group by `(symbol, side, horizon, hari)`, gate + rank per §2.3, `evidence.status='insufficient'` selama Sprint 5 belum jalan.
5. **Flip proxy — sebagian, dan ini disengaja.** `quant/router.py`: `/quant/state` berhenti forward untuk **bagian signal feed** (baca `signal_events`), sementara `regime`/`flow`/`news` dan `/quant/token` (forecast cone) **tetap proxy**. Alasan: forecast engine ada di `notifier-bot/src/forecast` — mem-port-nya bukan pekerjaan 3 hari, dan memaksakannya membuat Sprint 2 melar. DeepSeek menulis "berhenti forward" total; itu tidak realistis di kode yang ada. Port forecast dijadwalkan Sprint 5.

**Exit criteria:**
- 48 jam dual-run: `SELECT count(*) FROM signal_events WHERE source='quant' AND detected_at >= X` == jumlah entri baru di `notifier-bot/data/signal-feed.json` pada jendela sama (toleransi 0).
- `GET /api/v1/opportunities` mengembalikan ≥1 kartu di hari dengan sinyal, **tanpa** menyentuh 8787 (verifikasi: matikan `quant-dashboard.service` 5 menit; endpoint tetap 200).
- `UPDATE signal_events SET symbol='X'` gagal dengan `signal_events is append-only`.

**Rollback:** matikan pemanggilan `platformSignal.js` (flag `PLATFORM_SIGNALS=0`) dan kembalikan `/quant/state` ke forward penuh (satu konstanta `FEED_FROM_DB=False`). Tabel ditinggal — tidak ada yang rusak.

---

### Sprint 3 — Ideas feed + Ticket + capture keputusan · **3 hari**

**Tujuan:** loop notifikasi → Ideas → Ticket → keputusan tercatat, ≤2 tap.

**Tugas:**
1. `frontend/src/routes/api/opportunities.ts` — server route proxy ke `:8002/api/v1/opportunities` (pola `api/alerts.ts`, internal key).
2. `frontend/src/routes/ideas.tsx` — feed kartu: simbol, arah, alasan satu baris, **badge sumber** (`Quant · ma-align`), badge "N sumber sepakat", blok bukti (`hit-rate 30 hari` atau **"Belum cukup data"**). Counter-regime di bawah dengan label *"melawan regime"*. Empty state wajib kalimat: *"Belum ada ide lolos gate hari ini — regime choppy."*
3. `frontend/src/components/features/bottom-nav.tsx` — tambah 1 slot "Ideas" (sementara 5 slot; dirapikan Sprint 5).
4. `frontend/src/routes/token.$symbol.tsx` jadi **Ticket** (halaman yang sudah ada, 874 baris — tambah, jangan tulis ulang):
   - section "Sinyal terkait" dari `GET /api/v1/signals?symbol=` (Sprint 2),
   - tombol **Entry** → jalur permit/execute yang sudah ada (`/execution/permit`, `/execution/execute`),
   - tombol **Lewati** → skip capture (di bawah).
5. **Skip capture — ini belum ada** (koreksi atas DeepSeek: `/execution/skip-check` adalah dry-run gate, tidak menyimpan apa pun). Kerjanya:
   - Alembic revision: `ALTER TABLE decisions ADD COLUMN skip_reason varchar(24)` (`invalid|late|no_conviction|risk`).
   - `DecisionActionPatch` di `decision_router.py` menerima `skip_reason` saat `user_action ∈ {accepted_skip, rejected_skip}`.
   - UI: satu sheet, empat tombol, satu tap. Tidak ada field teks wajib.
6. Deep link dari alert Sprint 1 mendarat langsung di `token/{symbol}` dengan konteks terisi.

**Exit criteria:**
- Alur penuh terekam untuk 1 simbol nyata: alert → tap → Ticket → **Entry** menghasilkan permit + baris `decisions.user_action='took_trade'`; jalur **Lewati** menghasilkan baris `decisions` dengan `skip_reason` terisi.
- ≤2 tap dari notifikasi ke layar keputusan (hitung manual di HP).
- `GET /api/v1/opportunities` p95 <800 ms dengan 7 hari data.

**Rollback:** hapus slot nav "Ideas" (1 baris) + sembunyikan section sinyal di Ticket (1 flag). Endpoint dibiarkan hidup.

---

### Sprint 4 — Book: posisi + alert risiko · **2 hari**

**Tujuan:** Journey D (regime flip saat posisi terbuka) punya rumah.

**Tugas:**
1. `frontend/src/routes/book.tsx` — satu layar:
   - posisi ter-eksekusi MP via SSE `frontend/src/routes/api/positions.stream.ts` (`/execution/positions/stream`),
   - posisi dari `tradeway-api` via `GET /api/v1/tradeway/positions` (**sudah hidup**, 4 posisi), di-cache 15 s, **berlabel sumber** dan tidak pernah dicampur dengan posisi ter-eksekusi MP. Kalau 8100 mati → blok offline jujur, bukan spinner.
   - exposure total, sisa risk budget, state kill-switch (data dari `execution/constitution`).
2. `backend/app/worker/alert_pass.py` — dua aturan baru, tipe `position_risk`, severity `critical`:
   - **regime flip vs posisi terbuka**: regime berubah arah sementara ada posisi berlawanan → satu alert per flip per user (`dedupe_key = 'regime_flip|{user}|{from}->{to}|{YYYY-MM-DD-HH}'`),
   - **stop dekat**: harga dalam ≤0.5% dari stop → 1 alert per posisi per hari.
3. Alert `critical` **menembus quiet hours** (sudah didesain di §2.2) dan deep link ke `/book`.

**Exit criteria:**
- Uji buatan (posisi testnet + regime flip dipaksa di staging DB): alert terkirim <5 menit sejak kondisi terpenuhi, mendarat di `/book`.
- Nol alert ganda dalam 24 jam (`dedupe_key` bekerja).
- `/book` render <1.5 s dengan 8100 hidup **dan** dengan 8100 dimatikan.

**Rollback:** `POSITION_RISK_ALERTS=0` (aturan alert mati); route `/book` boleh tetap.

---

### Sprint 5 — Lab + nav 4 tab + Mini App adapter + pensiun artefak · **3 hari**

**Tujuan:** tutup loop bukti, dan hentikan produk kedua/ketiga.

**Tugas:**
1. **Evidence.** Tabel `source_scorecard(source, source_version, regime, horizon, window_days, n, hit_rate, avg_r, computed_at)` + cron arq 00:00 UTC (07:00 WIB) yang menghitungnya dari `signal_events` + settlement forward-test yang **sudah ada** (kode settlement yang sama — inilah alasan menolak Zipline). `n < 20` → `evidence.status='insufficient'`, kartu Ideas menulis *"Belum cukup data"*.
2. Kolom `signal_events.status` + `context_ref` masuk **sekarang** (sumber kedua mulai menulis) — sumber baru default `shadow`, naik ke `live` hanya lewat scorecard.
3. `frontend/src/routes/lab.tsx` — scorecard per sumber, riwayat keputusan + `skip_reason` (pertanyaan Journey E: *"minggu ini kamu lewati 6 setup dari sumber hit-rate 61%"*), forensics existing (`review.forensics.ts`).
4. **Nav 4 tab**: `Now (/)` · `Ideas` · `Book` · `Lab`. `Settings` pindah ke header/avatar. Rute `markets`, `rankings`, `regime`, `rotation`, `technical`, `news`, `journal`, `review`, `tracker`, `trades` → **redirect** ke rumah barunya (bukan 404); sisakan **satu** "Market detail" di balik Now.
5. **Port forecast cone** dari `notifier-bot/src/forecast` ke Ticket; setelah itu `/quant/token` berhenti proxy dan `quant/router.py` bisa dihapus seluruhnya.
6. **Mini App adapter** di `frontend/src/routes/__root.tsx`: deteksi `window.Telegram.WebApp` → theme params, safe-area, `BackButton` native, `MainButton` untuk aksi utama Ticket. **Satu route tree.** Rute `/app` (174 baris) pensiun → redirect ke `/`; `miniapp.service` di-stop + disable.
7. **Pensiun dashboard Quant**: nginx `quant.dev.heydewi.com` → **301** ke `iq.heydewi.com`. `quant-dashboard.service` baru di-stop **7 hari setelah** redirect (jendela backfill), lalu disable.

**Exit criteria:**
- Setiap kartu Ideas menampilkan angka bukti **atau** kalimat "Belum cukup data" — tidak ada kartu tanpa keduanya.
- Nav 4 tab live di web **dan** di Telegram Mini App dari satu build; nol rute yatim (`grep` routeTree vs nav + redirect map).
- `curl -I https://quant.dev.heydewi.com` → 301.
- 7 hari berturut cron scorecard sukses (log arq bersih).
- `miniapp.service` dan `quant-dashboard.service` `inactive` + `disabled`; tidak ada 5xx di log nginx setelahnya.

**Rollback:** hapus redirect nginx (301 → proxy lama), `systemctl start` dua service, `NAV_V2=0` mengembalikan nav lama (rute lama masih ada di router selama 2 minggu sebelum dihapus permanen).

---

## 4. Yang DIPOTONG dan yang DIPERTAHANKAN

### Dipotong — selamanya

| Item | Alasan |
|---|---|
| **Zipline** | Dibuat untuk ekuitas US, daily bar, trading calendar. Kita: perp crypto 24/7, funding, leverage, entri 15m/1H. Biaya sebenarnya: kehilangan komparabilitas backtest ↔ forward-test. |
| **Bybit sebagai execution provider** | Menggandakan Trading Constitution, matematika likuidasi, symbol mapping, format order algo — di jalur yang bisa kehilangan uang nyata, untuk nol pertanyaan trader yang terjawab. Read-only saja. |
| **Bot Telegram terpisah (3 → 1)** | Tiga mulut = tiga produk di kepala pengguna. |
| **Standalone miniapp repo** (`quant-notifier/miniapp`, `mini.dev`) | Rantai proxy tanpa kedalaman; digantikan adapter di app utama. |
| **Dashboard `quant.dev` sebagai permukaan produk** | Developer surface yang naik pangkat. Nilainya di deteksi. |

### Dipotong — sekarang, boleh ditinjau ulang nanti

| Item | Kapan ditinjau |
|---|---|
| **Parquet lake + DuckDB** | Kalau trigger §1.5-#3 terpenuhi (query >10 s / >5 juta baris / butuh sweep). |
| **Monorepo** | Sesudah Sprint 4, hanya kalau perubahan kontrak sering lintas repo. Kalau tidak sering — jangan. |
| **`signal_events.context_ref` & `status`** | Sprint 5 (sudah dijadwalkan). |
| **Port penuh forecast engine** | Sprint 5; sampai itu proxy `/quant/token` dipertahankan dengan sadar. |
| **Redesign nav 4 tab** | Sprint 5, sesudah Ideas & Book berisi. |

### Dipertahankan — jangan disentuh

- **Trading Constitution deterministik + permit; AI tidak bisa override `REJECT`** (EDR 0020).
- **Testnet-first**, kill switch default-off, tolak API key ber-scope withdrawal.
- **Version bump + pre-registered spike** untuk setiap perubahan semantik decision/trigger (`engine/smc/version.py` 2.0.0). Migrasi produk bukan alasan menyentuh ini.
- **Pipeline validasi 5 tahap notifier-bot** (`AGENTS.md`): tidak ada sinyal jadi alert live tanpa lolos semuanya. MP **tidak** boleh menambah/menyetel detektor sendiri.
- **`TEST_DATABASE_URL`** wajib untuk suite DB — VPS ini produksi.
- **SSE, bukan WebSocket server** — stack ini tidak bisa upgrade koneksi.
- **`alerts.dedupe_key`** dan pola idempoten cron pass yang sudah terbukti.

---

## 5. Risiko & mitigasi

| # | Risiko | Mitigasi |
|---|---|---|
| **R1** | **Jam operasional.** `cryptoJob` jalan tiap jam 06–22, `macroPing` :05 tiap jam. Sprint 1 memindahkan jalur kirim di tengah jam kerja bot → alert bisa hilang atau ganda saat deploy. | Deploy delivery **hanya di jendela 23:00–05:00** (di luar cron cryptoJob). Flip `shadow → live` dilakukan sesudah `dailyBias` 09:00 selesai, bukan sebelum. `delivery_state='failed'` dipantau; alert lama tetap di DB, bisa dikirim ulang dengan reset satu kolom. |
| **R2** | **Konflik `getUpdates`.** `notifier-bot/src/tracking.js` sudah polling `getUpdates` untuk tombol FOLLOW/SKIP; konsumen kedua pada token yang sama **mencuri callback** (peringatan ini sudah tertulis di `dailyBias.js:16`). | Platform bot pakai **token berbeda** (`PLATFORM_BOT_TOKEN`) dan **send-only** — tidak pernah memanggil `getUpdates` maupun `setWebhook` sampai `tracking.js` dipensiunkan (paling cepat Sprint 5, sesudah skip capture di app terbukti dipakai). |
| **R3** | **Look-ahead / survivorship pada backtest & scorecard.** `AGENTS.md` mencatat kasus nyata: `time` candle OKX adalah timestamp **open**, dan versi awal memakainya sebagai awal jendela intraday → hasil 1.1% → 6.0% yang murni artifact. Scorecard kita rawan hal yang sama. | Scorecard **hanya** dari `signal_events.detected_at` (waktu deteksi live, bukan hasil re-derivasi) yang di-settle oleh kode settlement forward-test yang sama. **Dilarang** menghitung ulang sinyal historis dari candle di MP. Setiap cross-timeframe join membandingkan **close time**, bukan open. Sumber tanpa n≥20 tampil sebagai "Belum cukup data", jadi survivorship tidak pernah tersamar jadi angka. |
| **R4** | **RAM VPS 3.7 GB, ~660 MB tersisa** (Postgres + 3 unit MP + quant dashboard + miniapp + tradeway-api). Satu proses riset bisa mematikan API produksi. | Parquet/DuckDB ditunda (§1.5-#3). Delivery pakai `httpx` di worker yang sudah jalan, **bukan** proses/bot framework baru. Sprint 5 justru **melepas** dua service (`miniapp`, `quant-dashboard`) — RAM balik sebelum Lab menambah beban. Query scorecard nightly di jam sepi (00:00 UTC) dengan `statement_timeout`. |
| **R5** | **Double-writer, double-notify.** Dual-run dua kali (Sprint 1 delivery, Sprint 2 signal) — ini titik paling rawan mengirim dua notifikasi ke Dee. | Dual-run hanya untuk **penulisan**; pengiriman selalu satu (`delivery_state='suppressed'` di sisi shadow). Rekonsiliasi berbasis hitungan (`count(*)` vs log) wajib **nol selisih** sebelum flip, bukan "kira-kira sama". `dedupe_key` UNIQUE membuat retry aman by construction. |
| **R6** | **Push ke `main` = deploy ke produksi**, dan riwayat git ter-sync ke Lovable (dilarang force-push). Satu commit setengah jadi mematikan `iq.heydewi.com`. | Tiap Sprint dikerjakan di branch, di-merge hanya saat exit criteria terpenuhi. Alembic revision selalu **additive** (kolom nullable / tabel baru) sehingga API versi lama tetap jalan setelah migrasi — tidak ada urutan deploy yang mengunci. Tidak pernah rebase/amend commit yang sudah ter-push. |

---

## Lampiran — Uji "satu produk" (kapan rencana ini dianggap selesai)

1. Dee bisa pergi dari **notifikasi → keputusan tereksekusi dalam 2 tap**, tanpa pindah aplikasi. *(Sprint 3)*
2. Setiap peluang menampilkan **track record sumbernya**, atau menyatakan jujur bahwa buktinya belum cukup. *(Sprint 5)*
3. **Skip tercatat** sama seriusnya dengan entry. *(Sprint 3)*
4. Ada **satu bot, satu login, satu URL**. *(Sprint 1 + Sprint 5)*
5. Menambah sumber sinyal baru **tidak menambah tab, tidak menambah bot, tidak menambah dashboard** — hanya menambah baris di `signal_events` dan satu badge di Ideas. *(Sprint 2, dibuktikan saat `smc`/`tradeway` jadi sumber kedua di Sprint 5)*
