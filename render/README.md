# Fotorealistik renderlar (Blender · Cycles)

`render_campus.py` maketning GLB modelini (`exports/akademiya-kampus.glb`) Blender’ga import qiladi va fotorealistik kadrlar chiqaradi. Tayyor kadrlar `render/out/` papkasida.

| Kadr | Vaqt | Nima ko‘rsatadi |
|---|---|---|
| `aerial.jpg` | 23-sentabr, 17:00 | Butun kampus janubi-g‘arbdan, shahar konteksti bilan |
| `entrance.jpg` | 23-sentabr, 15:45 | Ceremonial Entrance va Grand Academy Hall portigi |
| `courtyard.jpg` | 23-sentabr, 09:18 | Chorbog‘ hovlisi Knowledge Centre terrasasidan |
| `arcade.jpg` | 23-sentabr, 10:18 | Sharqiy ravoq: soyali promenada |
| `garden.jpg` | 21-iyun, 17:30 | Research Institute va Scholars’ Garden |
| `dusk.jpg` | 21-iyun, 20:43 | Grand Hall oqshom yoritilishida |

## Skript nima qiladi

- **Materiallar.** GLB’dagi material nomi bo‘yicha (`stone`, `glass`, `water`, `bronze`...) PBR materiallarga almashtiriladi. Tosh choklari GLB’dagi tekstura masshtabi bilan saqlanadi (0,75 × 1,5 m plitalar). Girih panjara naqshi Blender ichida qayta chiziladi, chunki glTF `alphaMap`’ni saqlamaydi.
- **O‘simliklar.**
  - Daraxt tojlariga geometry nodes orqali barglar sochiladi. Har bir daraxt o‘z shakli va rangiga ega.
  - Shoxlar ham qo‘shiladi.
  - Yaqin kadrlarda maysaga o‘t tutamlari qo‘shiladi. Yo‘lak, yo‘l va suv ostida o‘t chiqmaydi.
- **Yorug‘lik.**
  - Toshkent (41,3° sh.k.) uchun quyosh holati NOAA algoritmi bilan hisoblanadi.
  - Osmon fizik modelda (Multiple Scattering) quriladi.
  - Kechki kadrda ustunlarni pastdan yorituvchi chiroqlar, yozuvni yorituvchi chiroq va ko‘cha chiroqlarining yorug‘ligi bor.
- **Kontekst.** Atrofdagi shahar bloklari, ko‘cha daraxtlari, uzoqdagi tog‘lar va masofaga qarab ortib boradigan havo tumanligi qo‘shiladi.
- **Render.** Cycles CPU, adaptiv sampling, OpenImageDenoise, AgX rang boshqaruvi.

## Ishga tushirish

Blender 5.2 kerak (<https://www.blender.org/download/>):

```bash
blender -b --python render/blender/render_campus.py -- \
  --glb exports/akademiya-kampus.glb --out render/out \
  --views all --samples 96 --res 1920x1080 --format JPEG
```

Parametrlar:

| Parametr | Ma’nosi | Standart |
|---|---|---|
| `--views` | `aerial,entrance,courtyard,arcade,dusk,garden` yoki `all` | `all` |
| `--samples` | Cycles sample soni (denoise bilan 64–160 yetarli) | 160 |
| `--res` | o‘lcham, masalan `3840x2160` | `1920x1080` |
| `--format` | `PNG` yoki `JPEG` | `PNG` |
| `--leaf-density`, `--grass-density` | barg va o‘t zichligi | 34, 26 |
| `--save-blend` | sahnani `.blend` sifatida saqlash (keyin qo‘lda tahrirlash uchun) | — |

4 yadroli CPU’da 1920×1080, 96 sample bitta kadrga taxminan 10–15 daqiqa ketadi. GPU (CUDA/OptiX) bo‘lsa, Blender’da Cycles qurilmasini GPU’ga almashtirish kifoya.

Yangi ko‘rinish qo‘shish uchun skriptdagi `VIEWS` lug‘atiga kamera nuqtasi (`pos`), nishon (`target`), obyektiv (`lens`), sana (`doy`) va soatni (`hour`) yozing. Koordinatalar web-maketdagidek beriladi: x sharqqa, y yuqoriga, z janubga.

## Cheklovlar

- Geometriya hajmiy maket darajasida: xona rejalari va mayda fasad detallari yo‘q.
- Odamlar va avtomobillar soddalashtirilgan yoki umuman yo‘q. Arxitektorlar GLB’ni Twinmotion yoki Lumion’ga olib, o‘z kutubxonalaridan odam va mashina qo‘shishi mumkin.
