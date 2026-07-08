# TETHYS — Phase X Technical Specification: Extreme Engineering

## Overview

Fase X adalah peta jalan ekspansi eksperimental yang dirancang untuk mendorong Tethys melampaui standar *dashboard* pemantauan konvensional. Fase ini berfokus pada lima jalur rekayasa tingkat lanjut yang mengintegrasikan komputasi grafis kustom, kecerdasan buatan multimodal, pemrosesan paralel klien, dan komputasi spasial. 

Tujuan utama dari fase ini adalah mengubah Tethys dari sebuah instrumen pengamat pasif menjadi agen intelijen planet otonom dengan representasi visual sinematik.

---

## Track 1: Visual Overdrive (Custom 3D Engine)

Mengganti *wrapper library* instan dengan mesin komputasi 3D murni untuk mencapai standar *immersive web* tingkat agensi profesional.

### Konsep
Meninggalkan tekstur 2D statis dan beralih ke material volumetrik dan pencahayaan berbasis fisika (*Physically Based Rendering/PBR*), serta mengorkestrasi pergerakan kamera secara sinematik untuk setiap peristiwa.

### Langkah Eksekusi
* **Migrasi Engine:** Hapus dependensi `globe.gl`. Inisialisasi `<Canvas>` murni menggunakan `@react-three/fiber` (R3F) untuk mendapatkan akses penuh ke *render loop*.
* **Volumetric Shaders:** Tulis *custom WebGL/GLSL shaders*. Gunakan algoritma *Raymarching* pada *fragment shader* untuk merender awan tebal secara volumetrik yang bereaksi terhadap arah cahaya (matahari maya).
* **Atmospheric Scattering:** Implementasikan *Fresnel shader* dan *Rayleigh scattering* pada geometri atmosfer untuk menciptakan efek pendaran (halo) yang realistis saat bumi berotasi.
* **Cinematic Choreography:** Integrasikan modul GSAP (`gsap.to()`) ke dalam kamera R3F. Alih-alih melompat seketika, kamera akan melakukan *sweep* dengan kurva *easing* kustom menembus atmosfer langsung ke episentrum gempa saat sebuah anomali diklik.

### Tech Stack
* React Three Fiber (R3F)
* GLSL (Custom Shaders)
* GSAP (GreenSock Animation Platform)

---

## Track 2: Multimodal Vision-Data Fusion

Menggabungkan pipa data deret waktu (tabular) dengan analisis visi komputer berkecepatan tinggi untuk menciptakan agen peneliti otonom.

### Konsep
Tethys tidak hanya membaca angka, tetapi "melihat" kondisi planet melalui citra satelit waktu nyata, lalu agen AI menyintesis temuan dari kedua sumber tersebut menjadi laporan teknis mandiri.

### Langkah Eksekusi
* **Pipeline Citra Satelit:** Modifikasi kolektor *backend* (FastAPI) untuk menarik *frame* gambar terbaru dari satelit cuaca geostasioner (seperti GOES-16 atau Himawari-9) setiap 10-15 menit.
* **Computer Vision di Edge:** Terapkan model visi ringan (YOLOv12 dalam format ONNX) di peladen VPS. Latih/atur model untuk mendeteksi anomali visual seperti formasi awan badai ekstrem atau titik panas termal (*thermal hotspots*).
* **Agentic RAG (Retrieval-Augmented Generation):** Bangun agen AI yang diotaki oleh LLM berkecepatan tinggi. Beri agen ini akses (*function calling*) untuk:
    1. Mengeksekusi kueri SQL ke `TimescaleDB`.
    2. Membaca *bounding box* hasil deteksi YOLOv12.
* **Otomatisasi Pelaporan:** Saat *Lament Detector* aktif, agen AI secara otomatis menarik data dari kedua sumber, menjalankan uji korelasi, dan mencetak *Mini-Paper* (Laporan Investigasi) yang disiarkan langsung ke klien via WebSocket.

### Tech Stack
* YOLOv12 (ONNX format)
* FastAPI Background Tasks
* LLM API (Groq/Llama-3) + LangChain/LlamaIndex

---

## Track 3: The Simulator (What-If Digital Twin)

Mengisolasi sistem dari data waktu nyata untuk menciptakan mesin simulasi skenario bencana kaskade hipotetis.

### Konsep
Memberikan kendali kepada pengguna (seperti perencana mitigasi bencana) untuk menyuntikkan anomali buatan dan melihat proyeksi rambatan kerusakannya pada planet.

### Langkah Eksekusi
* **State Decoupling:** Modifikasi *store* `Zustand` untuk mendukung mode `LIVE` dan `SIMULATION`. Saat `SIMULATION` aktif, putus koneksi *WebSocket* agar antarmuka berhenti merender data kejadian nyata.
* **Injector UI:** Buat panel instrumen (seperti *slider*) untuk parameter anomali, misalnya "Kepadatan Plasma Matahari (p/cm³)" atau "Magnitudo Seismik Sintetis".
* **Procedural Rendering:** Rancang logika proyeksi di dalam kanvas 3D. Jika pengguna menembakkan badai matahari buatan berskala X-Class, kanvas akan memanipulasi *alpha channel* dari tekstur *Night Lights*, mematikan cahaya lampu di wilayah benua yang menghadap matahari untuk menyimulasikan pemadaman listrik massal.

### Tech Stack
* Zustand (State Management)
* React Three Fiber (Texture Manipulation)

---

## Track 4: WebGPU Edge Computing

Memindahkan beban komputasi analitik tingkat lanjut dari peladen ke kartu grafis (*hardware*) pengguna lokal.

### Konsep
Skalabilitas ekstrem. Daripada VPS kehabisan RAM saat menghitung matriks korelasi untuk jutaan titik data sejarah, jadikan peramban web pengguna sebagai superkomputer paralel.

### Langkah Eksekusi
* **Data Streaming:** Ubah peran *backend* murni menjadi distributor data mentah yang sangat cepat via *WebSocket* tanpa melakukan kalkulasi statistik berat.
* **WGSL Compute Shaders:** Implementasikan API **WebGPU**. Tulis *Compute Shaders* using *WebGPU Shading Language* (WGSL) untuk mengeksekusi algoritma *Dynamic Time Warping* (DTW) atau *Cross-Correlation*.
* **Parallel Execution:** Gunakan arsitektur *pipeline* WebGPU untuk menghitung korelasi antara aktivitas matahari dan ratusan titik stasiun seismik secara paralel di dalam hitungan milidetik langsung di mesin klien.

### Tech Stack
* WebGPU API
* WGSL (WebGPU Shading Language)
* ArrayBuffers & TypedArrays (JavaScript)

---

## Track 5: Spatial Computing (WebXR Hologram)

Menghancurkan batasan monitor datar 2D dan membawa ekosistem Tethys ke dalam ruang fisik pengguna.

### Konsep
Memungkinkan analis yang menggunakan *headset* AR/VR (seperti Meta Quest atau Apple Vision Pro) untuk berinteraksi dengan replika bumi secara spasial.

### Langkah Eksekusi
* **XR Wrapper:** Bungkus `<Canvas>` R3F yang sudah ada dengan *provider* `@react-three/xr`. Tambahkan komponen antarmuka standar untuk menginisiasi sesi Immersive AR/VR.
* **Spatial UI:** Ubah semua panel HTML 2D (seperti *Event Detail* atau *Lament Banner*) menjadi komponen 3D (*floating planes*) yang melayang di sekitar bola bumi.
* **Hand-Tracking Interaction:** Implementasikan profil *controller* pelacakan tangan. Pengguna dapat secara harfiah "menggenggam" bumi untuk memutarnya, menggunakan gestur *pinch-to-zoom*, atau menunjuk langsung ke anomali yang berkedip merah untuk memanggil narasi AI.

### Tech Stack
* `@react-three/xr`
* WebXR Device API
* Meta Quest Browser / VisionOS Safari kompatibilitas