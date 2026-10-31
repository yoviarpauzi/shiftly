# PRD Shiftly

2026-10-31 · Yoviar Pauzi

## Ringkasan eksekutif

**Masalah:** Penyusunan roster shift untuk beberapa site dilakukan manual. Akibatnya, sulit memastikan setiap karyawan PKDW mendapat pola kerja, break, dan jatah off sesuai aturan.

**Solusi:** Shiftly menerima request roster daily atau weekly, lalu menyusun jadwal karyawan PKDW per site dan department secara otomatis dengan rule engine.

**Kriteria sukses (target awal, perlu dikonfirmasi):**

- 0 pelanggaran aturan (pola kerja, pindah shift, break, dan jatah off) pada roster yang dihasilkan.
- Roster weekly untuk satu site selesai dalam 5 menit.
- Waktu penyusunan roster turun 70% dibanding proses manual. Baseline perlu diukur dulu.
- Minimal 80% roster disetujui admin site tanpa revisi manual.

## Pengguna dan fitur

**Role**

Sistem punya tiga role: superadmin, HO, dan admin site. Ketiganya dan multi-site masuk MVP.

| Role       | Cakupan        | Kemampuan                                                                                                 | Tahap |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| Admin site | Satu site      | Membuat request roster daily atau weekly untuk site sendiri. Meninjau roster site sendiri dan meminta revisi. | MVP   |
| HO         | Beberapa site  | Membuat request roster daily atau weekly untuk beberapa site. Menyetujui request weekly (lihat pertanyaan terbuka). | MVP   |
| Superadmin | Semua site     | Akses ke semua site dan department, termasuk mengelola pengguna dan role.                                 | MVP   |

Kemampuan HO dan superadmin disimpulkan dari persona sebelumnya dan perlu dikonfirmasi.

Karyawan PKDW bukan role di sistem. Mereka melihat jadwal pribadinya (opsional, dijadwalkan di v2.0).

**Aturan roster**

| Aturan                 | Nilai                                  | Catatan                                                  |
| ---------------------- | -------------------------------------- | -------------------------------------------------------- |
| Pola kerja             | 5 atau 7 hari kerja per minggu         | Tidak seragam. PKDW tidak selalu 5 hari kerja            |
| Shift                  | Dikelola per site                      | Jenis dan jam shift belum didefinisikan                  |
| Pengelompokan          | Per department                         | Roster dibuat per department dalam satu site             |
| Sub-department         | Opsional, di bawah department          | Contoh: LM Department → Rework. Daftar lengkap belum ada |
| Keanggotaan department | Lebih dari satu department             | Karyawan bisa menjadi anggota beberapa department        |
| Posisi                 | Helper, Helper BerSIO, Forklift Driver | Daftar posisi awal                                       |
| Break                  | 4 hari setiap 3 bulan                  | Asumsi: break diberikan setiap siklus 3 bulan            |
| Off tahunan            | 20 hari per karyawan per tahun         | Asumsi: jatah off per tahun                              |

**Istilah:** "Work Area" diubah menjadi "Department" di seluruh dokumen, UI, dan data.

**Aturan pindah shift**

- Karyawan tidak boleh pindah ke shift dengan nomor lebih kecil, yaitu 2 → 1, 3 → 1, atau 3 → 2. Pindah ke shift dengan nomor lebih besar diizinkan, misalnya 1 → 2, 2 → 3, atau 1 → 3.
- Pengecualian: karyawan sudah bekerja 7 hari kerja.
- Asumsi: pengecualian dihitung dalam 7 hari kerja, lihat pertanyaan terbuka.

**Aturan persetujuan**

- Request roster weekly wajib disetujui admin sebelum roster final.
- Request roster daily tidak perlu persetujuan.

**User stories**

1. Sebagai admin site, saya ingin membuat request roster daily untuk site saya, agar jadwal satu hari langsung tersusun.
   - Request daily memuat tanggal, site, dan department.
   - Sistem menolak roster yang melanggar pola kerja karyawan.
2. Sebagai admin site, saya ingin membuat request roster weekly, agar jadwal satu minggu penuh tersusun sekaligus.
   - Roster weekly mencakup 7 hari.
   - Jumlah hari off setiap karyawan sesuai pola kerjanya.
3. Sebagai admin site, saya ingin melihat sisa break dan off tiap karyawan, agar jatahnya tidak terlewat.
   - Sistem menampilkan sisa off tahunan dan jadwal break berikutnya per karyawan.
4. Sebagai admin site, saya ingin melihat roster per department di site saya, agar saya bisa mengecek jadwal tim.
   - Roster bisa difilter menurut site dan department.

**User story tambahan**

5. Sebagai admin site, saya ingin sistem mencegah pindah shift yang tidak diizinkan, agar roster tidak melanggar aturan pindah shift.
   - Sistem menolak roster yang memindahkan karyawan ke shift dengan nomor lebih kecil.
   - Sistem menolak roster yang memindahkan karyawan ke shift dengan nomor lebih kecil sebelum karyawan bekerja 7 hari kerja.
6. Sebagai admin site, saya ingin memilih pekerja secara manual saat kuota pekerja tersedia kurang dari kebutuhan request, agar shift tetap terisi dengan pilihan saya.
   - Sistem menampilkan jumlah pekerja tersedia dan jumlah kebutuhan request.
   - Admin bisa memilih pekerja secara manual dari daftar pekerja yang tersedia.
   - Pilihan manual tetap divalidasi terhadap semua aturan roster.
7. Sebagai HO, saya ingin mengimpor data pekerja baru secara massal dari Excel, agar tidak perlu menginput satu per satu.
   - Impor memakai template Excel. Kolom final menunggu format dari Pak Kukuh.
   - Sistem memvalidasi setiap baris dan menampilkan baris yang gagal beserta alasannya.
   - Pekerja baru tersimpan dengan posisi dan department yang valid.
8. Sebagai HO, saya ingin mengimpor Excel untuk memperpanjang tanggal akhir kontrak pekerja yang sudah ada, agar perpanjangan banyak pekerja bisa diproses sekaligus.
   - Pekerja dicocokkan dengan pengenal unik (NIK atau ID karyawan, TBD).
   - Hanya tanggal akhir kontrak yang berubah. Data lain tidak ikut berubah.
   - Tanggal akhir baru harus lebih besar dari tanggal akhir lama.
9. Sebagai HO, saya ingin mencetak form absen dengan logo Sodexo dan nama pembuat, agar dokumen terlihat resmi dan bisa dilacak pembuatnya.
   - Form absen menampilkan logo Sodexo di bagian header.
   - Form absen menampilkan "Dibuat oleh: [nama pengguna yang login]" dan tanggal pembuatan.
   - Format output (PDF atau cetak) TBD.

**Non-goals**

- Penggajian dan perhitungan lembur.
- Absensi atau clock-in.
- Integrasi dengan sistem HRIS eksternal di versi pertama.
- Pemilihan shift otomatis berbasis AI.

## Spesifikasi AI

Tidak berlaku. Shiftly memakai rule engine deterministik tanpa model AI. Input yang sama harus menghasilkan roster yang sama.

**Strategi pengujian:**

- Unit test untuk setiap aturan (pola kerja, pindah shift, break, off tahunan, pengelompokan department).
- Roster hasil uji divalidasi ulang terhadap daftar aturan. Hasil yang melanggar dihitung sebagai gagal.

## Spesifikasi teknis

**Stack:** Next.js untuk frontend dan API. Repo saat ini dibuat dari create-next-app. Database, auth, dan hosting: TBD.

**Alur data:**

1. Admin membuat request roster daily atau weekly per site dan department.
2. API menyimpan request dan memuat data karyawan PKDW, termasuk riwayat off dan break.
3. Rule engine menyusun jadwal dan memvalidasi setiap aturan.
4. Jika ada aturan yang tidak bisa dipenuhi, sistem menandai konflik beserta alasannya.
5. Roster yang valid disimpan dan ditampilkan per site dan department.

Rule engine membaca shift terakhir dan jumlah hari kerja berturut-turut per karyawan dari riwayat roster untuk memvalidasi aturan pindah shift.

**Integrasi:**

- Database: TBD.
- Auth: TBD. Login dengan tiga role: superadmin, HO, dan admin site. Ketiganya masuk MVP.
- Impor Excel: template dan validasi mengikuti format dari Pak Kukuh (belum diterima).
- Output form absen: logo Sodexo dan nama pengguna yang login diambil saat dokumen dibuat.

**Keamanan dan privasi:**

- Data karyawan adalah data pribadi. Akses dibatasi menurut role dan site.
- Riwayat roster disimpan untuk audit.
- Pemrosesan data karyawan perlu ditinjau terhadap UU Pelindungan Data Pribadi.

## Fase 2: Tracing PO

- Department terkait dengan PO.
- PO terkait dengan budget.
- Pekerja baru yang dimasukkan ke department dihitung sebagai biaya department. Dengan ini, biaya bisa ditelusuri dari department → PO → budget.
- Kardinalitas relasi, rumus biaya, dan periode perhitungan TBD.

## Risiko dan roadmap

**Fase rollout:**

| Fase    | Cakupan                                                                                            | Kriteria keluar                               |
| ------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| MVP     | Multi-site. Request daily dan weekly untuk beberapa site, validasi pola kerja, pindah shift, jatah off tahunan, dan tiga role (superadmin, HO, admin site) | Roster valid selama 2 minggu uji di satu site |
| v1.1    | Aturan break 4 hari per 3 bulan dan ekspor roster                                                                                                   | Semua site aktif memakai Shiftly              |
| v2.0    | Portal karyawan, notifikasi, dan riwayat revisi                                                    | Karyawan bisa melihat jadwal pribadinya       |
| Phase 2 | Tracing PO: relasi department → PO → budget, dan biaya pekerja baru per department                 | TBD. Urutan terhadap v2.0 perlu dikonfirmasi  |

**Risiko teknis dan bisnis:**

| Risiko                                     | Dampak                          | Mitigasi                                               |
| ------------------------------------------ | ------------------------------- | ------------------------------------------------------ |
| Aturan break dan off bertabrakan           | Roster tidak bisa dibuat        | Sistem menampilkan konflik, admin menentukan prioritas |
| Jumlah karyawan kurang untuk menutup shift | Shift kosong                    | Sistem menampilkan kekurangan orang per hari           |
| Definisi aturan belum final                | Rule engine salah               | Konfirmasi aturan sebelum MVP                          |
| Data karyawan tidak lengkap                | Roster tidak akurat             | Validasi data saat impor                               |
| Performa saat site dan karyawan banyak     | Roster lambat                   | Ukur dengan data nyata sebelum v1.1                    |
| Karyawan menjadi anggota banyak department | Jadwal bentrok antar department | Sistem menandai bentrok, admin menentukan prioritas    |
| Impor Excel berisi data salah              | Data karyawan tidak akurat      | Validasi per baris dan tampilkan alasan gagal          |
| Format Excel dari Pak Kukuh belum diterima | Impor massal belum bisa dibuat  | Action item: minta template dan data ke Pak Kukuh      |

## Pertanyaan terbuka

- [ ] "3 bulan break 4 hari": apakah setiap 3 bulan karyawan dapat 4 hari break?
- [ ] "20 hari off": apakah ini jatah per tahun?
- [ ] Apa kepanjangan PKDW, dan apakah itu jenis karyawan?
- [ ] Apa saja jenis dan jam shift per site?
- [ ] Berapa jumlah site, department, dan karyawan?
- [ ] Jika break atau off bertabrakan dengan pola kerja, mana yang diprioritaskan?
- [ ] Apa database, auth, dan hosting yang dipakai?
- [ ] Kapan target tanggal MVP?

**Pertanyaan tambahan (aturan pindah shift)**

- [x] Dijawab: 1 → 2 diizinkan. Pindah ke shift nomor lebih kecil dilarang (2 → 1, 3 → 1, 3 → 2).
- [ ] Apakah 7 hari kerja untuk pengecualian harus berturut-turut?
- [ ] Apakah pengecualian 7 hari kerja berlaku untuk pindah ke shift nomor lebih kecil?
- [x] Dijawab: pindah ke shift nomor lebih besar diizinkan (1 → 2, 2 → 3, 1 → 3).

**Pertanyaan tambahan (fitur baru)**

- [ ] "No rest day after shift 3": apakah maksudnya setelah shift 3 hari berikutnya wajib kerja, atau ada pengecualian?
- [ ] Apakah sub-department punya roster dan aturan sendiri, atau mengikuti department induk? Daftar lengkap sub-department belum ada.
- [ ] Jika karyawan anggota beberapa department dan jadwalnya bentrok, department mana yang diprioritaskan?
- [ ] Siapa yang menyetujui request weekly: admin site, HO, atau superadmin?
- [ ] Konfirmasi kemampuan role HO dan superadmin di bagian Role. Kemampuan itu disimpulkan dari persona sebelumnya.
- [ ] Impor Excel dan form absen (cerita 7 sampai 9): dilakukan oleh HO atau admin site?
- [ ] Pilihan manual pekerja: apakah tetap harus memenuhi semua aturan roster?
- [ ] Impor Excel: semua baris harus valid (all-or-nothing), atau baris yang valid tetap disimpan?
- [ ] Apa pengenal unik pekerja (NIK atau ID karyawan) untuk impor perpanjangan kontrak?
- [ ] Apakah perpanjangan kontrak perlu persetujuan admin?
- [ ] "Absent form": apakah maksudnya form absen? Format output-nya PDF atau cetak? Logo Sodexo sudah tersedia?
- [ ] Phase 2 (Tracing PO) dikerjakan sebelum atau sesudah v2.0?
- [ ] Relasi department ke PO: satu-ke-banyak, atau banyak-ke-banyak?
- [ ] Action item: minta data department, sub-department, pekerja, dan posisi ke Pak Kukuh dalam format Excel. Status: belum diterima.
