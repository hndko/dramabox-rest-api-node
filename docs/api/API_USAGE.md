# API Usage Guide

## Language Support (Subtitles / Dubbing)

Server ini mendukung parameter `lang` untuk menentukan bahasa yang diinginkan (termasuk preferensi Subtitle/Dubbing yang tersedia).

Default bahasa adalah `in` (Indonesia).

### Cara Menggunakan

Tambahkan parameter `lang` di setiap request API.

**Contoh Request (Indonesia):**
```
GET /api/home?lang=in
GET /api/search?keyword=boss&lang=in
GET /api/stream?bookId=123&episode=1&lang=in
```
*Biasanya akan mengembalikan konten dengan dubbing Indonesia jika tersedia (Sulih Suara).*

**Contoh Request (Inggris):**
```
GET /api/home?lang=en
GET /api/search?keyword=boss&lang=en
```
*Mengembalikan konten dalam bahasa Inggris.*

### Endpoint yang Mendukung Parameter `lang`
- `/api/search`
- `/api/home`
- `/api/vip`
- `/api/detail/:bookId/v2`
- `/api/chapters/:bookId`
- `/api/stream`
- `/api/categories`
- `/api/category/:id`
- `/api/recommend`
