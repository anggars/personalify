# Personalify

## 1. Introduction

Personalify adalah dashboard analitik Spotify personal yang dibangun untuk menampilkan preferensi musik pengguna berdasarkan data dari Spotify API. Proyek ini didesain dengan pendekatan distributed system, memanfaatkan integrasi berbagai database (PostgreSQL, MongoDB, Redis) serta fitur seperti FDW dan cache.

## 2. Use Case Overview

| Use Case              | Deskripsi                                                                 |
|-----------------------|---------------------------------------------------------------------------|
| 🎵 Spotify Login/Auth | Pengguna login menggunakan OAuth2 Spotify untuk mengizinkan akses ke data musik mereka. |
| 📥 Sync Top Data      | Data seperti top artists, top tracks, dan genres disinkronisasi dan disimpan di database terdistribusi. |
| 🧠 Caching & History  | Redis digunakan untuk cache cepat, MongoDB untuk menyimpan riwayat sinkronisasi user. |
| 📊 Dashboard          | Frontend responsif menampilkan visualisasi berdasarkan device pengguna (desktop/mobile). |
| 🌍 Distributed Query  | FDW memungkinkan query lintas PostgreSQL dan sumber eksternal (simulasi distribusi). |


## 3. System Architecture

Sistem Personalify terdiri dari beberapa komponen yang terhubung melalui arsitektur berbasis layanan (service-based), dengan backend FastAPI sebagai pusat orkestrasi data dari berbagai sumber (Spotify API, PostgreSQL, Redis, MongoDB, dan FDW).

```text
+-------------+        +------------------+        +---------------+
|   Frontend  | <----> |     FastAPI      | <----> |   PostgreSQL  |
| (Vite/Vue)  |        |   (Backend API)  |        | (Main DB)     |
+-------------+        +--------+---------+        +------+--------+
                                  |                       |
                                  v                       v
                             +---------+           +-------------+
                             | Redis   |           |   MongoDB   |
                             | (Cache) |           | (Sync DB)   |
                             +---------+           +-------------+
                                        \         
                                         \
                                          v
                                +------------------------+
                                | PostgreSQL + FDW       |
                                | (foreign remote table) |
                                +------------------------+
```

**Penjelasan Komponen:**

- **Frontend (Vite + Vue.js) {Future Plan}:**  
  UI berbasis web yang menampilkan top artists, tracks, dan genres pengguna secara interaktif. Tampilan responsif untuk desktop & mobile.
- **FastAPI (Backend API):**  
  Server utama yang menangani proses autentikasi Spotify (OAuth2), sinkronisasi data, penyimpanan ke database, cache, serta penyajian API ke frontend.
- **PostgreSQL (Main DB):**  
  Menyimpan metadata utama seperti user, artist, dan track. Digunakan sebagai pusat relasional sistem.
- **Redis (Cache):**  
  Cache in-memory untuk menyimpan top data (artist, track, genre) per user berdasarkan `spotify_id` dan `time_range`, dengan TTL untuk efisiensi.
- **MongoDB (Sync DB):**  
  Menyimpan log historis sinkronisasi user dalam format dokumen. Cocok untuk data fleksibel dan akses log berdasarkan waktu.
- **PostgreSQL + FDW:**  
  Foreign Data Wrapper digunakan untuk mengakses data dari server PostgreSQL lain (simulasi distribusi). Berguna untuk query lintas instance.


## 4. Technology Stack & Rationale

| Komponen        | Teknologi            | Alasan Pemilihan                                                                 |
|------------------|----------------------|----------------------------------------------------------------------------------|
| **Frontend**     | Vite + Vue.js        | Ringan, cepat build time, dan cocok untuk membuat SPA dengan tampilan reaktif.  |
| **Backend API**  | FastAPI              | Framework modern Python, mendukung async, cepat untuk membangun REST API.       |
| **Main Database**| PostgreSQL           | RDBMS kuat, mendukung relasi kompleks, integrasi FDW, dan kompatibel dengan tools analitik. |
| **Cache**        | Redis                | In-memory cache dengan TTL, sangat cepat untuk menyimpan data sementara per user.|
| **Sync Storage** | MongoDB              | Cocok untuk menyimpan riwayat dalam bentuk dokumen fleksibel (top data per waktu).|
| **Auth**         | Spotify OAuth2       | Protokol standar resmi dari Spotify, aman untuk login dan akses data user.      |
| **FDW**          | PostgreSQL FDW       | Digunakan untuk simulasi query antar instance PostgreSQL (distributed query).   |
| **Containerization** | Docker + Compose | Menjamin isolasi lingkungan, konsistensi deployment, dan kemudahan replikasi.   |


## 5. Database Schema Design

### 🗄️ PostgreSQL (Main DB)

Digunakan untuk menyimpan metadata utama seperti user, artist, dan track. Relasi many-to-many disimpan pada tabel `user_tracks` dan `user_artists`.

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  spotify_id TEXT UNIQUE,
  display_name TEXT
);

-- Artists
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT,
  popularity INTEGER,
  image_url TEXT
);

-- Tracks
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT,
  popularity INTEGER,
  preview_url TEXT
);

-- Relasi user-tracks
CREATE TABLE IF NOT EXISTS user_tracks (
  spotify_id TEXT,
  track_id TEXT,
  PRIMARY KEY (spotify_id, track_id),
  FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Relasi user-artists
CREATE TABLE IF NOT EXISTS user_artists (
  spotify_id TEXT,
  artist_id TEXT,
  PRIMARY KEY (spotify_id, artist_id),
  FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
```

### 📄 MongoDB (Sync History DB)

MongoDB digunakan sebagai database fleksibel untuk menyimpan histori hasil sinkronisasi data pengguna dari Spotify. Data disimpan dalam koleksi `user_syncs`, yang berisi satu dokumen untuk setiap kombinasi `spotify_id` dan `time_range` (`short_term`, `medium_term`, `long_term`)

Struktur dokumen bersifat fleksibel dan dapat berkembang sesuai kebutuhan, biasanya berisi daftar top artists, tracks, dan genres hasil sinkronisasi. MongoDB dipilih karena keunggulannya dalam menyimpan data semi-terstruktur tanpa perlu migrasi schema.

Proses sinkronisasi menggunakan operasi `upsert`, sehingga jika data untuk kombinasi tertentu sudah ada, maka akan diperbarui. Hal ini memungkinkan backend menyimpan histori secara efisien dan tetap menjaga satu entri unik per user dan time range.

### ⚡ Redis (In-Memory Cache)

Redis digunakan sebagai lapisan cache untuk mempercepat penyajian data ke dashboard frontend. Cache ini menyimpan hasil sinkronisasi dalam bentuk key-value, dengan key yang disusun berdasarkan kombinasi `spotify_id` dan `time_range`.

Karena Redis adalah cache volatile (tidak permanen), data yang disimpan di dalamnya bersifat sementara dan dapat diberikan TTL (Time-To-Live) agar otomatis terhapus setelah periode tertentu. Hal ini mengurangi beban pada database utama maupun API Spotify saat data yang sama sering diakses dalam waktu singkat.

Cache akan dicek terlebih dahulu setiap kali dashboard dipanggil. Jika data tidak ditemukan, backend akan mengambil ulang dari Spotify, menyimpan ke Redis, dan meneruskannya ke frontend.

## 6. Sharding and Replication Strategy

Sistem `Personalify` memanfaatkan prinsip-prinsip pemrosesan data terdistribusi melalui kombinasi penggunaan tiga jenis database yang memiliki karakteristik berbeda, dengan strategi berikut:

### 🧩 Redis (Cache-Based Sharding)

Redis digunakan sebagai in-memory cache yang secara tidak langsung membentuk pola sharding berdasarkan key `spotify_id` dan `time_range`. Karena Redis menyimpan data dalam bentuk key-value, distribusi data terjadi secara otomatis berdasarkan key space. Dengan pendekatan ini, setiap user memiliki partisi cache tersendiri, sehingga tidak saling mengganggu dan cepat diakses.

Redis juga memungkinkan scale-out horizontal dengan teknik clustering jika kapasitas bertambah besar.

### 🗂️ MongoDB (Document-Based Distribution)

MongoDB menyimpan histori sinkronisasi Spotify user dalam format dokumen, dan sangat cocok untuk model penyimpanan data semi-terstruktur yang terus berkembang. Walaupun deployment saat ini menggunakan instance tunggal, MongoDB mendukung replikasi otomatis (replica set) dan sharding native berdasarkan key seperti `spotify_id`.

Strategi replikasi MongoDB:
- Memberikan toleransi terhadap kegagalan (failover).
- Memungkinkan pembacaan dari secondary nodes (read scalability).

Strategi sharding MongoDB (opsional):
- Dapat diaktifkan menggunakan hashed sharding key (misalnya `spotify_id`).
- Cocok untuk distribusi data user secara merata.

### 🏛️ PostgreSQL FDW (Distributed Query via Foreign Data Wrapper)

Salah satu poin utama dalam arsitektur ini adalah penggunaan **PostgreSQL Foreign Data Wrapper (FDW)**, yang memungkinkan backend melakukan query ke database eksternal seolah-olah mereka adalah bagian dari satu sistem terpadu.

Dalam sistem ini:
- PostgreSQL utama menyimpan metadata.
- Instance PostgreSQL lain (dummy/fdw) dapat disambungkan menggunakan `postgres_fdw`.
- Query lintas node dapat dieksekusi seperti biasa dengan `SELECT` atau `JOIN`, tanpa perlu melakukan ETL manual.

Contoh skenario:
- Menyimpan data Spotify user di node A, dan statistik agregat di node B.
- Node A dapat melakukan query ke node B tanpa perlu migrasi data, cukup dengan `IMPORT FOREIGN SCHEMA`.

### 🔄 Integrasi Multi-Database (Manual Sharding)

Secara keseluruhan, sistem ini memanfaatkan "manual sharding" berdasarkan fungsi:

| Layer      | Database     | Fungsi                                              |
|------------|--------------|-----------------------------------------------------|
| Metadata   | PostgreSQL   | Menyimpan data artist, track, user, dan relasinya  |
| Riwayat    | MongoDB      | Menyimpan histori sinkronisasi (document-based)    |
| Cache      | Redis        | Penyajian cepat berdasarkan key `spotify_id`       |
| Cross-node | PostgreSQL + FDW | Simulasi distribusi query antar instance DB  |

Strategi ini dipilih untuk mendemonstrasikan bagaimana sistem dapat menggunakan berbagai model penyimpanan dan distribusi untuk kebutuhan yang berbeda, serta mendukung skalabilitas jika proyek tumbuh lebih besar.


## 7. Sample Distributed Query or Scenario

Berikut adalah contoh skenario nyata yang mendemonstrasikan integrasi sistem terdistribusi dalam proyek Personalify, dengan fokus pada pemanfaatan PostgreSQL Foreign Data Wrapper (FDW) dan query lintas sumber data.

### 🐧 A. Masuk ke Container PostgreSQL
Langkah pertama: masuk ke container postgresfy untuk mengakses database utama (streamdb):
sudo docker exec -it postgresfy psql -U admin -d streamdb

Untuk menampilkan daftar tabel beserta detailnya:
```bash 
\dt+
```
Untuk melihat struktur tabel lokal seperti users, artists, dan tracks:
```bash 
\d+ users
\d+ artists
\d+ tracks
```
Gunakan query berikut untuk melihat isi tabel utama:
```sql
SELECT * FROM users;
SELECT * FROM artists;
SELECT * FROM tracks;
SELECT * FROM user_tracks;
SELECT * FROM user_artists;
```

Jika sudah mengatur postgres_fdw dan mengimpor foreign table seperti dummy_data, maka bisa menjalankan:
1. Lihat struktur tabel foreign:
```bash 
\d+ dummy_data 
```
2. Tampilkan isi tabel foreign:
```sql 
SELECT * FROM dummy_data; 
```
3. Join tabel lokal (users) dengan tabel foreign (dummy_data):
```sql 
SELECT u.display_name, d.name AS remote_note
FROM users u
JOIN dummy_data d ON u.id = d.id;
```

4. Lihat execution plan dan remote SQL:
EXPLAIN VERBOSE SELECT * FROM dummy_data;

### 🍃 B. Query Sync History dari MongoDB
MongoDB digunakan untuk menyimpan data sinkronisasi Spotify berdasarkan spotify_id dan time_range. Data disimpan sebagai dokumen JSON fleksibel di koleksi user_syncs.

1. Masuk ke MongoDB container:
```bash 
sudo docker exec -it maogofy mongosh 
```
2. Gunakan database dan cek koleksi:
```bash 
use personalify_db 
db.user_syncs.find().pretty() 
```
3. Contoh query history user berdasarkan spotify_id:
```bash 
db.user_syncs.find({ spotify_id: "31xon7qetimdnbmhkupbaszl52nu" }).pretty() 
```

### 🔴 C. Akses Cache Redis untuk Top Data
Redis digunakan untuk menyimpan data top artists/tracks/genres hasil sinkronisasi agar akses cepat dan tidak selalu memanggil API Spotify.
1. Masuk ke Redis container:
```bash 
sudo docker exec -it redisfy redis-cli 
```
2. Tampilkan isi cache berdasarkan key:
```bash
GET top:31xon7qetimdnbmhkupbaszl52nu:short_term
```
3. (Opsional) Format JSON menggunakan jq:
```bash
sudo docker exec -it redisfy redis-cli GET top:31xon7qetimdnbmhkupbaszl52nu:short_term | jq
```

Dengan tiga lapis distribusi ini (PostgreSQL-FDW, MongoDB, Redis), sistem dapat menggabungkan kekuatan relational query, document storage, dan high-speed caching dalam satu aplikasi yang ringan dan scalable.

## 8. Challenges & Lessons Learned
Selama pengembangan Personalify, sejumlah tantangan teknis muncul seiring dengan upaya mengintegrasikan sistem multi-database dan containerized environment. Berikut adalah beberapa tantangan utama beserta pembelajaran yang didapat:

### 🔄 A. FDW (Foreign Data Wrapper)
Tantangan:
- Saat menggunakan postgres_fdw, hostname database remote tidak bisa menggunakan localhost, karena konteksnya berada di dalam container Docker.
- Kesalahan umum terjadi jika tidak mengganti localhost dengan nama service container yang sesuai (remotedb, postgresfy, dsb).

Solusi:
- Pastikan semua koneksi antar-database dalam konteks Docker menggunakan service name dari docker-compose.yml.

Pembelajaran:
- Pahami bahwa localhost dalam container berbeda konteks dari localhost di host machine.
- Gunakan IMPORT FOREIGN SCHEMA untuk mempermudah pengaturan foreign tables daripada membuatnya satu per satu.

### 🧩 B. Sinkronisasi Data & Skema
Tantangan:
- Data Spotify yang didapat dari API sangat fleksibel (non-tabular), sedangkan PostgreSQL bersifat struktural dan membutuhkan skema tetap.
- Skema harus konsisten antara relasi user, artist, dan track — terutama saat menyimpan many-to-many data (e.g. user_tracks, user_artists).

Solusi:
- Gunakan MongoDB untuk menyimpan data mentah hasil sinkronisasi per time_range.
- Gunakan Redis untuk caching hasil query yang sudah diformat agar tidak perlu parsing berulang kali.

Pembelajaran:
- Penyimpanan data di tempat yang sesuai (structured vs unstructured) penting untuk efisiensi dan skalabilitas.

### 🚨 C. Caching Strategy
Tantangan:

- Data Redis bersifat ephemeral. Jika container Redis mati tanpa volume persistence, seluruh cache hilang.
- Tanpa pengelolaan key yang baik (misal: top:{spotify_id}:{time_range}), cache bisa saling timpa atau bentrok.

Solusi:
- Terapkan penamaan key yang sistematis dan unik.
- Simpan cache hasil sync per user + time_range untuk menghindari redudansi.

Pembelajaran:
- Redis ideal untuk read-heavy scenarios seperti dashboard, tapi bukan untuk data permanen.

### 🔧 D. Deployment & Containerization
Tantangan:
- Debugging multi-container bisa rumit tanpa log monitoring yang baik.
- Beberapa container service butuh urutan start tertentu (e.g. Postgres harus siap sebelum backend query).

Solusi:
- Gunakan depends_on di docker-compose.yml.
Manfaatkan volume untuk persistensi dan named network agar service saling mengenali.

Pembelajaran:
- Containerization sangat powerful untuk isolasi, tapi perlu pemahaman dependency dan urutan lifecycle.

## 9. Conclusion
Personalify merupakan proyek yang dirancang untuk mengeksplorasi konsep sistem terdistribusi dalam konteks aplikasi berbasis data nyata. Dengan memanfaatkan data dari Spotify melalui proses otentikasi OAuth2, pengguna dapat melihat preferensi musik mereka seperti artis, lagu, dan genre teratas yang dikelompokkan berdasarkan rentang waktu tertentu. Data tersebut kemudian disimpan dan diolah melalui kombinasi database yang masing-masing memiliki peran berbeda, mencerminkan pendekatan arsitektur multi-layer dan terdistribusi secara nyata.

PostgreSQL digunakan sebagai basis data utama untuk menyimpan entitas yang bersifat relasional seperti pengguna, artis, dan lagu, termasuk relasi many-to-many antar entitas tersebut. Sementara itu, MongoDB berperan sebagai penyimpan histori sinkronisasi per user dan time_range dalam format dokumen JSON yang lebih fleksibel, mencerminkan pemisahan beban kerja (separation of concern) antara struktur dan fleksibilitas data. Redis juga digunakan untuk menyimpan hasil sinkronisasi yang telah diformat ulang dalam bentuk cache, sehingga sistem dapat menghindari permintaan ulang ke API Spotify atau query ke database utama untuk data yang sama.

Lebih jauh lagi, proyek ini mengimplementasikan PostgreSQL Foreign Data Wrapper (FDW) untuk mengakses tabel dari database eksternal (remote DB) secara real-time. Hal ini menunjukkan bagaimana query lintas database dapat dilakukan seolah-olah berasal dari satu sumber, memungkinkan fleksibilitas federasi data dan skenario lintas node. Dalam praktiknya, FDW digunakan untuk membaca tabel eksternal dan menggabungkannya dengan data lokal melalui operasi join yang berjalan transparan.

Selama pengembangan, sejumlah tantangan teknis berhasil diatasi, mulai dari sinkronisasi data yang tidak homogen antara API Spotify dan struktur tabel relasional, hingga konfigurasi hostname antar-container Docker agar dapat saling terhubung. Tantangan-tantangan ini menghasilkan pembelajaran praktis seputar pemilihan teknologi, pengelolaan cache, dan penggabungan data dari sumber berbeda secara efisien.

Secara keseluruhan, Personalify telah berhasil menjadi bukti konsep dari sistem terdistribusi yang memadukan otentikasi modern, sinkronisasi API eksternal, penyimpanan multi-database, serta cache dan federasi data dalam satu ekosistem yang kohesif. Proyek ini bukan hanya memenuhi aspek fungsional dan teknis dari tugas Pemrosesan Data Terdistribusi, tetapi juga memberikan pengalaman praktik nyata dalam membangun dan mengelola sistem data yang kompleks dan dapat diskalakan.