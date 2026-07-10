# TETHYS — Data Ecosystem & Predictive Matrix Specification

## Overview

Dokumen ini mendefinisikan arsitektur data hibrida dan matriks prediktif untuk ekosistem Tethys. Membawa Tethys melampaui pemantauan pasif (*passive monitoring*), fase ini bertujuan untuk membangun model prediksi eksperimental menggunakan teori **LAIC (Lithosphere-Atmosphere-Ionosphere Coupling)** dan fusi sensor lintas domain (*cross-domain sensor fusion*).

*Peringatan Sains:* Konsensus utama saat ini menyatakan bahwa presisi absolut dalam memprediksi gempa bumi adalah tidak mungkin. Oleh karena itu, mesin prediksi Tethys beroperasi pada ranah probabilitas statistik berdasarkan deteksi anomali prekursor (fringe science), bukan ramalan deterministik.

---

## PART 1: The Data Ecosystem (Katalog Sumber Data)

Infrastruktur data Tethys dibagi menjadi empat tingkatan berdasarkan perannya dalam melatih model *Time-Series Transformer* dan agen kecerdasan buatan.

### 1. Observasi Fundamental (Baseline Data)
Data ini digunakan sebagai *ground truth* (kebenaran lapangan) dan indikator kejadian yang sedang/sudah berlangsung.
* **USGS FDSN (Katalog Seismik):** Episentrum, kedalaman, dan magnitudo global. (Format: GeoJSON).
* **NOAA SWPC (Real-Time Solar Wind):** Kecepatan, kepadatan, dan suhu plasma matahari. (Format: JSON).
* **NOAA GOES (X-Ray Flux):** Intensitas *Solar Flares* / radiasi sinar-X. (Format: JSON).
* **NASA DONKI:** Laporan *Coronal Mass Ejection* (CME). (Format: REST API).
* **Open-Meteo / ECMWF:** Cuaca permukaan (suhu, tekanan, angin). (Format: JSON).
* **Smithsonian GVP:** Laporan aktivitas magmatik dan erupsi gunung berapi. (Format: XML/JSON).
* **NOAA SWPC (Geomagnetic Indices):** Kp, Dst, AE indices untuk mengukur respons geomagnetik terhadap angin surya. (Format: JSON). **Priority: 🔴 CRITICAL**
* **Copernicus Marine:** Data oseanografi global (suhu laut, salinitas, arus, sea surface height). (Format: NetCDF).
* **NOAA ENSO/NAO:** Indeks iklim jangka panjang (El Niño/La Niña, North Atlantic Oscillation). (Format: CSV).
* **NASA GRACE-FO:** Perubahan medan gravitasi bumi dan penyimpanan air tanah. (Format: NetCDF). Update bulanan.

### 2. Sinyal Prekursor Ekstrem (Predictive Signals)
Data anomali yang mendahului kejadian fisik utama. Ini adalah "bahan bakar" utama untuk melatih mesin prediktif.
* **NOAA SWPC Global TEC / NASA CDDIS (Ionosfer):** Anomali *Total Electron Content* (TEC) yang mengindikasikan emisi elektromagnetik dari tekanan tektonik sebelum retak. (Format: JSON/IONEX). **Priority: 🟡 HIGH**
* **INTERMAGNET (Magnetometer Terestrial):** Distorsi medan magnet lokal di permukaan bumi akibat tegangan kerak bumi. (Format: IAGA-2002 / FTP).
* **NASA LANCE / FIRMS (Thermal Infrared - TIR):** Lonjakan *thermal hotspots* di sepanjang garis patahan bumi akibat gesekan batuan dan pelepasan gas radon. (Format: API JSON/CSV). **Priority: 🟢 MEDIUM**
* **NMDB (Neutron Monitor Database):** Cosmic ray flux variations yang menunjukkan Forbush decreases dan ground-level enhancements. (Format: JSON). **Priority: 🟡 HIGH**
* **Japanese/European Radon Networks:** Konsentrasi gas radon tanah yang meningkat sebelum gempa akibat microfractures. (Format: CSV/JSON). **Priority: 🔴 CRITICAL**

### 3. Validasi Kaskade & Ekologi (Ripple Effects)
Sumber data untuk memvalidasi rambatan bencana sesaat setelah kejadian utama (*Event Zero*) terjadi.
* **NOAA NDBC / DART (Buoy Laut Dalam):** Perubahan tekanan kolom air laut untuk mendeteksi rambatan tsunami. (Format: Fixed-width TXT / XML).
* **Copernicus Sentinel-5P:** Deteksi konsentrasi emisi SO2 (Sulfur Dioksida) dan gas vulkanik/tektonik di atmosfer. (Format: NetCDF / OData REST).
* **Space Observing System Tomsk (Resonansi Schumann):** Pemantauan frekuensi ELF (Extremely Low Frequency) untuk korelasi cuaca ekstrem tingkat lanjut. (Format: Image Spectrogram / Scraper).
* **NOAA Tsunami Warning Center:** Alert dan warning untuk validasi event seismik besar. (Format: XML/CAP). **Priority: 🟡 HIGH**
* **WWLLN (Lightning Network):** Data petir global untuk korelasi dengan aktivitas seismik dan atmosfer. (Format: CSV/JSON). **Priority: 🟢 MEDIUM**
* **NOAA/IOC Tide Gauges:** Data tinggi muka laut untuk validasi tsunami dan anomali oseanografi. (Format: JSON/CSV). **Priority: 🟢 LOW**
* **Space-Track.org:** Telemetri satelit untuk deteksi anomali atmosfer (perubahan kepadatan atmosfer mempengaruhi orbit). (Format: JSON/XML). **Priority: 🟢 LOW**

### 4. Intelijen Visi Multimodal (Visual Intelligence)
Input spasial-visual untuk dianalisis oleh model *Computer Vision* (seperti YOLOv12).
* **Satelit Himawari-9 & GOES-16:** Citra cuaca dan bumi resolusi tinggi (Spektrum Visual dan Inframerah). (Format: PNG/Tile Map).

---

## PART 2: The Predictive Matrix (Matriks Prediksi)

Tethys akan difokuskan untuk menghasilkan tiga kategori prediksi probabilitas. Seluruh data deret waktu dari ekosistem di atas akan difusikan ke dalam model *Time-Series Transformer* dan diekspor ke ONNX untuk inferensi di peladen tepi (*edge server*).

### Prediksi 1: Space-to-Earth (Kaskade Geomagnetik)
* **Target Prediksi:** Probabilitas dan lokasi pemadaman radio (HF), gangguan satelit, serta anomali arus induksi geomagnetik di jaringan listrik bumi.
* **Jendela Waktu (Lead Time):** 24 hingga 72 jam sebelum dampak terasa di kerak bumi.
* **Fusi Data (Sensor Fusion):**
  * *Trigger Awal:* NOAA GOES (X-Ray Flux) -> Peringatan 8 menit.
  * *Validasi Jalur:* NASA DONKI (Arah CME).
  * *Payload Utama:* NOAA SWPC (Metrik kecepatan dan kepadatan angin surya).

### Prediksi 2: Seismic Precursor (Model Eksperimental LAIC)
* **Target Prediksi:** Probabilitas penumpukan stres tektonik yang mengarah pada pelepasan energi kegempaan signifikan (>M5.0) di zona spesifik.
* **Jendela Waktu (Lead Time):** 24 hingga 72 jam sebelum *Event Zero*.
* **Fusi Data (Sensor Fusion):**
  * *Anomali Atmosfer:* NOAA SWPC Global TEC (Lonjakan elektron non-surya).
  * *Anomali Permukaan:* NASA FIRMS (TIR / Suhu gesekan permukaan yang aneh).
  * *Anomali Elektromagnetik:* INTERMAGNET (Distorsi magnetik lokal).
  * *Ground Truth Training:* USGS Seismic Catalog (Hanya digunakan saat *training* agar model mengenali pola prekursor mana yang memicu gempa sesungguhnya).

### Prediksi 3: Earth-Ocean-Atmosphere (Kaskade Rambatan)
* **Target Prediksi:** Arah pergerakan abu vulkanik/gas beracun pasca erupsi dan rambatan anomali hidrologi (tsunami) pasca gempa laut.
* **Jendela Waktu (Lead Time):** *Real-time* hingga 6 jam pasca *Event Zero*.
* **Fusi Data (Sensor Fusion):**
  * *Event Zero:* USGS (Gempa Laut) atau Smithsonian GVP (Erupsi).
  * *Konfirmasi Oceanografi:* NOAA NDBC/DART (Tekanan air anomali).
  * *Analisis Visi:* Himawari-9 / GOES-16 (Dianalisis oleh YOLOv12 untuk melacak bentuk awan abu).
  * *Vektor Penyebaran:* Open-Meteo (Arah dan kecepatan angin) + Sentinel-5P (Kerapatan SO2).

---

## PART 3: Catatan Implementasi Model

Menyatukan format JSON, TXT, XML, dan gambar dalam satu waktu adalah tantangan *data engineering* terberat di Fase X. 
1. **Pipa Homogenisasi:** Semua data mentah dari Kolektor (Python) harus dipaksa masuk menjadi rentang waktu terstandarisasi (*time-binned*) di dalam *TimescaleDB hypertables*.
2. **Arsitektur Model:** Hindari ARIMA atau regresi linier. Gunakan arsitektur *Deep Learning* modern seperti **Informer, Autoformer, atau PatchTST** yang didesain khusus untuk mencari korelasi tersembunyi pada deret waktu dengan jeda (*lag*) yang sangat panjang.

---

## PART 4: Data Source Priority & Implementation Roadmap

### Priority Matrix

| Priority | Data Source | Implementation Effort | Impact on Phase 4 |
|----------|-------------|----------------------|-------------------|
| 🔴 **CRITICAL** | Geomagnetic Indices (Kp, Dst, AE) | 🟢 Low (1-2 days) | Essential for pattern detection |
| 🔴 **CRITICAL** | Radon Gas | 🟡 Medium (3-5 days) | Leading earthquake indicator |
| 🟡 **HIGH** | Ionospheric TEC | 🟡 Medium (2-3 days) | Ionospheric anomaly detection |
| 🟡 **HIGH** | Cosmic Ray (Neutron Monitors) | 🟢 Low (1-2 days) | Forbush decrease detection |
| 🟡 **HIGH** | Tsunami Warning | 🟢 Low (1 day) | Event validation |
| 🟢 **MEDIUM** | Lightning (WWLLN) | 🟡 Medium (2-3 days) | Atmospheric-seismic correlation |
| 🟢 **MEDIUM** | Ocean Indices (ENSO/NAO) | 🟢 Low (1 day) | Long-term climate context |
| 🟢 **MEDIUM** | Fire Detection (FIRMS) | 🟢 Low (1 day) | Atmospheric composition |
| 🟢 **LOW** | Gravity Field (GRACE-FO) | 🟡 Medium (2-3 days) | Monthly mass redistribution |
| 🟢 **LOW** | Tide Gauge | 🟡 Medium (2-3 days) | Sea level anomalies |
| 🟢 **LOW** | Satellite Telemetry | 🟡 Medium (2-3 days) | Rare anomalies |

### Implementation Roadmap

**Phase 4A: Critical Data Sources (Before Intelligence Layer)**
1. **Geomagnetic Indices** — 1-2 days
   - Collector for Kp, Dst, AE indices
   - Table `geomagnetic_indices` already exists
   - Enables: Solar wind → geomagnetic response → seismic correlation

2. **Cosmic Ray** — 1-2 days
   - Collector for neutron monitor data
   - New table `cosmic_ray_data`
   - Enables: Forbush decrease detection, earthquake precursor analysis

**Phase 4B: High Priority Data Sources (Parallel with Intelligence Layer)**
3. **Ionospheric TEC** — 2-3 days
   - Collector for TEC data (NASA JPL or Madrigal)
   - New table `ionospheric_tec`
   - Enables: Ionospheric anomaly detection

4. **Tsunami Warning** — 1 day
   - Collector for NOAA tsunami alerts
   - New table `tsunami_warnings`
   - Enables: Event validation, safety context

**Phase 4C: Medium Priority Data Sources (After Intelligence Layer)**
5. **Lightning** — 2-3 days
6. **Ocean Indices** — 1 day
7. **Fire Detection** — 1 day

**Phase 4D: Low Priority Data Sources (Future Enhancement)**
8. **Radon Gas** — 3-5 days (requires research network integration)
9. **Gravity Field** — 2-3 days
10. **Tide Gauge** — 2-3 days
11. **Satellite Telemetry** — 2-3 days

### Data Source Dependencies

```
Solar Wind (DSCOVR)
    ↓
Geomagnetic Indices (Kp, Dst, AE) ← CRITICAL MISSING LINK
    ↓
Ionospheric TEC ← Ionospheric response
    ↓
Seismic Activity (USGS)
    ↑
Cosmic Ray (Neutron Monitors) ← Forbush decreases
    ↑
Radon Gas ← Earthquake precursor
```

**Key Insight:** Geomagnetic indices are the missing link between solar wind and seismic activity. Without this data, pattern detection will be incomplete.