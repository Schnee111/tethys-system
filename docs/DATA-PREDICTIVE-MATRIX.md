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

### 2. Sinyal Prekursor Ekstrem (Predictive Signals)
Data anomali yang mendahului kejadian fisik utama. Ini adalah "bahan bakar" utama untuk melatih mesin prediktif.
* **NOAA SWPC Global TEC / NASA CDDIS (Ionosfer):** Anomali *Total Electron Content* (TEC) yang mengindikasikan emisi elektromagnetik dari tekanan tektonik sebelum retak. (Format: JSON/IONEX).
* **INTERMAGNET (Magnetometer Terestrial):** Distorsi medan magnet lokal di permukaan bumi akibat tegangan kerak bumi. (Format: IAGA-2002 / FTP).
* **NASA LANCE / FIRMS (Thermal Infrared - TIR):** Lonjakan *thermal hotspots* di sepanjang garis patahan bumi akibat gesekan batuan dan pelepasan gas radon. (Format: API JSON/CSV).

### 3. Validasi Kaskade & Ekologi (Ripple Effects)
Sumber data untuk memvalidasi rambatan bencana sesaat setelah kejadian utama (*Event Zero*) terjadi.
* **NOAA NDBC / DART (Buoy Laut Dalam):** Perubahan tekanan kolom air laut untuk mendeteksi rambatan tsunami. (Format: Fixed-width TXT / XML).
* **Copernicus Sentinel-5P:** Deteksi konsentrasi emisi SO2 (Sulfur Dioksida) dan gas vulkanik/tektonik di atmosfer. (Format: NetCDF / OData REST).
* **Space Observing System Tomsk (Resonansi Schumann):** Pemantauan frekuensi ELF (Extremely Low Frequency) untuk korelasi cuaca ekstrem tingkat lanjut. (Format: Image Spectrogram / Scraper).

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