/* ============================================================
   SOAL BAWAAN (30 soal) — digunakan saat game berjalan
   di GitHub Pages / tanpa server Python (mode HP).
   Di server Python, soal diambil dari data.json (bisa
   diubah lewat menu Admin).
   ============================================================ */
'use strict';

const DEFAULT_QUESTIONS = [
 {
  "id": 1,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Ibu kota Kerajaan Majapahit dahulu terletak di Trowulan. Sekarang Trowulan berada di kabupaten ...",
  "choices": [
   "Surabaya",
   "Sidoarjo",
   "Gresik",
   "Lamongan"
  ],
  "answer": 1,
  "explanation": "Trowulan adalah kecamatan di Kabupaten Sidoarjo, yang kini menjadi kawasan situs budaya Kerajaan Majapahit."
 },
 {
  "id": 2,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Nama “Sidoarjo” punya arti yang indah: “sido” berarti jadi, “arjo” berarti makmur. Jadi Sidoarjo bermakna ...",
  "choices": [
   "jadi makmur",
   "jadi besar",
   "jadi ramai",
   "jadi kuat"
  ],
  "answer": 0,
  "explanation": "Dalam bahasa Jawa, “sido” artinya “jadi” dan “arjo” artinya “makmur / mulia”. Doanya agar warga Sidoarjo hidup makmur dan damai."
 },
 {
  "id": 3,
  "category": "Sejarah",
  "difficulty": 2,
  "question": "Dahulu daerah Sidoarjo bernama Sidokare, lalu diganti namanya pada tahun 1859 menjadi Sidoarjo. Mengapa diganti?",
  "choices": [
   "karena “kare” kurang pantas artinya",
   "karena terlalu panjang",
   "karena permintaan raja",
   "karena ada candi baru"
  ],
  "answer": 0,
  "explanation": "Nama Sidokare diganti pada 1859 karena kata “kare” kurang pantas maknanya (tertinggal). Nama baru Sidoarjo berarti “jadi makmur”."
 },
 {
  "id": 4,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Candi Pari adalah candi peninggalan abad ke-14 masa Kerajaan Majapahit. Candi Pari terletak di kecamatan ...",
  "choices": [
   "Porong",
   "Jabon",
   "Krian",
   "Buduran"
  ],
  "answer": 0,
  "explanation": "Candi Pari dibangun tahun 1371 masa pemerintahan Raja Hayam Wuruk, berada di Desa Candipari Kulon, Kecamatan Porong. Berlatar belakang agama Hindu."
 },
 {
  "id": 5,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Salah satu Wali Songo yang makam dan masjidnya ada di Desa Cukir, Kecamatan Sedati Sidoarjo adalah ...",
  "choices": [
   "Sunan Drajat",
   "Sunan Bonang",
   "Sunan Giri",
   "Sunan Kudus"
  ],
  "answer": 0,
  "explanation": "Makam dan Masjid Sunan Drajat berada di Desa Cukir, Sedati, Sidoarjo. Beliau menyebarkan Islam melalui seni budaya dan kepedulian sosial."
 },
 {
  "id": 6,
  "category": "Sejarah",
  "difficulty": 2,
  "question": "Bencana lumpur lapindo yang terjadi pada tahun 2006 berada di wilayah kecamatan ...",
  "choices": [
   "Porong",
   "Taman",
   "Candi",
   "Tambak"
  ],
  "answer": 0,
  "explanation": "Bencana lumpur lapindo 2006 terjadi di wilayah Kecamatan Porong. Peristiwa besar itu menjadi pelajaran penting tentang lingkungan dan kehati-hatian."
 },
 {
  "id": 7,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Sungai besar yang mengalir melewati wilayah Kabupaten Sidoarjo adalah Sungai ...",
  "choices": [
   "Brantas",
   "Ciliwung",
   "Mahakam",
   "Bengawan Solo"
  ],
  "answer": 0,
  "explanation": "Sungai Brantas adalah sungai terpanjang di Jawa Timur dan alirannya melewati wilayah Kabupaten Sidoarjo."
 },
 {
  "id": 8,
  "category": "Sejarah",
  "difficulty": 2,
  "question": "Rangkaian pegunungan yang berada di batas utara Kabupaten Sidoarjo adalah ...",
  "choices": [
   "Arjuno-Welirang",
   "Merapi",
   "Semeru",
   "Ijen"
  ],
  "answer": 0,
  "explanation": "Pegunungan Arjuno-Welirang berada di perbatasan utara Sidoarjo dan menjadi salah satu sumber air bagi wilayah sekitar."
 },
 {
  "id": 9,
  "category": "Sejarah",
  "difficulty": 1,
  "question": "Pada 10 November 1945, rakyat Sidoarjo ikut berjuang melawan Belanda bersama rakyat Surabaya. Tanggal itu kini diperingati sebagai ...",
  "choices": [
   "Hari Pahlawan",
   "Hari Kemerdekaan",
   "Hari Guru",
   "Hari Kartini"
  ],
  "answer": 0,
  "explanation": "Perlawanan rakyat Surabaya dan Jawa Timur pada 10 November 1945 diperingati setiap tahun sebagai Hari Pahlawan."
 },
 {
  "id": 10,
  "category": "Sejarah",
  "difficulty": 2,
  "question": "Pada tahun 2022 terjadi banjir besar di Porong karena jebolnya ...",
  "choices": [
   "tanggul Sungai Porong",
   "jembatan Porong",
   "tanggul kereta api",
   "dam bendungan"
  ],
  "answer": 0,
  "explanation": "Pada 2022 tanggul Sungai Porong jebol dan menyebabkan banjir besar di Porong dan sekitarnya. Warga kini lebih waspada mengenali daerah rawan banjir."
 },
 {
  "id": 11,
  "category": "Kearifan Lokal",
  "difficulty": 1,
  "question": "“Gotong royong” adalah kearifan lokal yang artinya ...",
  "choices": [
   "bekerja bersama tanpa upah untuk kepentingan bersama",
   "berlomba menjadi yang terkaya",
   "bekerja sendiri agar cepat selesai",
   "bekerja hanya di waktu malam"
  ],
  "answer": 0,
  "explanation": "Gotong royong adalah bekerja bersama-sama tanpa mengharapkan upah. Kearifan ini mempererat persaudaraan antarwarga."
 },
 {
  "id": 12,
  "category": "Kearifan Lokal",
  "difficulty": 1,
  "question": "Kenduri atau selamatan adalah tradisi berdoa bersama, setelah itu warga ...",
  "choices": [
   "makan bersama sebagai bentuk berkat",
   "balapan lari",
   "bermain congklak",
   "berjualan kue"
  ],
  "answer": 0,
  "explanation": "Dalam selamatan warga berdoa bersama lalu makan “berkat” bersama-sama. Tradisi ini cara menyyukuri nikmat dan mempererat hubungan sosial."
 },
 {
  "id": 13,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "Tumpeng yang disajikan saat hajatan bagian atasnya dibuat runcing. Artinya melambangkan ...",
  "choices": [
   "doa yang diarahkan kepada Tuhan Yang Maha Esa",
   "kue yang dibuat tinggi-tinggi",
   "toples nasi yang besar",
   "bentuk masjid di desa"
  ],
  "answer": 0,
  "explanation": "Ujung tumpeng yang runcing adalah simbol doa yang diarahkan kepada Tuhan Yang Maha Esa, satu dan tidak dua."
 },
 {
  "id": 14,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "“Urip iku urup” adalah kearifan lokal Jawa Timur yang artinya ...",
  "choices": [
   "hidup itu harus menerangi orang lain",
   "hidup itu cepat sekali",
   "hidup harus hemat",
   "hidup itu penuh tangis"
  ],
  "answer": 0,
  "explanation": "“Urip iku urup” berarti hidup ini hendaknya menjadi penerang dan bermanfaat bagi orang lain, bukan menjadi beban."
 },
 {
  "id": 15,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "Pepatah “Alus basa winukul karsa” artinya ...",
  "choices": [
   "kata-kata yang halus dapat memikat hati",
   "berbicara pelan membuat kuat",
   "berbicara cepat membuat pintar",
   "berbicara keras membuat disegani"
  ],
  "answer": 0,
  "explanation": "Bahasa yang lembut dan sopan membuat hati orang menjadi senang danWith rela membantu. Mulut yang terjaga adalah pembawa kebaikan."
 },
 {
  "id": 16,
  "category": "Kearifan Lokal",
  "difficulty": 1,
  "question": "Tradisi “munggahan” dilakukan pada ...",
  "choices": [
   "malam sebelum Hari Raya Idul Fitri",
   "malam tanggal 17 Agustus",
   "malam tahun baru",
   "malam sebelum berangkat sekolah"
  ],
  "answer": 0,
  "explanation": "Munggahan adalah tradisi silaturahmi dan memberi ucapan maaf di malam sebelum Lebaran, khas masyarakat Jawa Timur."
 },
 {
  "id": 17,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "“Sedekah bumi” adalah tradisi ...",
  "choices": [
   "berbagi hasil panen sebagai rasa syukur kepada Tuhan",
   "menjual hasil panen dengan harga murah",
   "menanam padi di musim kemarau",
   "membagikan buku kepada warga"
  ],
  "answer": 0,
  "explanation": "Sedekah bumi adalah tradisi petani berterima kasih kepada Tuhan atas hasil panen dengan membagikan hasilnya kepada warga."
 },
 {
  "id": 18,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "Nelayan kupang di Desa Balongdowo rutin mengadakan tradisi Nyadran. Tujuannya adalah ...",
  "choices": [
   "bersyukur kepada Tuhan dan mendoakan keselamatan melaut",
   "lomba menangkap ikan",
   "menjual perahu ikan",
   "mengundang tamu dari luar negeri"
  ],
  "answer": 0,
  "explanation": "Nyadran adalah bentuk syukur nelayan kupang Desa Balongdowo (Kecamatan Candi) kepada Tuhan serta doa agar melaut selalu diberi keselamatan."
 },
 {
  "id": 19,
  "category": "Kearifan Lokal",
  "difficulty": 1,
  "question": "Ungkapan “aji mumpung” dalam budaya Jawa Timur artinya ...",
  "choices": [
   "memanfaatkan kesempatan selagi ada",
   "bekerja sampai malam hari",
   "meminjam barang lebih dulu",
   "menunggu waktu yang tepat"
  ],
  "answer": 0,
  "explanation": "“Aji mumpung” artinya cepat memanfaatkan kesempatan ketika masih ada. Waktu belajar yang tepat jangan disia-siakan!"
 },
 {
  "id": 20,
  "category": "Kearifan Lokal",
  "difficulty": 2,
  "question": "“Yasinan” adalah tradisi warga yang kumpul di masjid untuk ...",
  "choices": [
   "membaca Al-Qur’an bersama dan mendengarkan ceramah",
   "lomba memasak nasi",
   "rapat pemilihan ketua RT",
   "pawai obor keliling desa"
  ],
  "answer": 0,
  "explanation": "Yasinan adalah kegiatan rutin warga, biasanya seminggu sekali, membaca Al-Qur’an (Surah Yasin) bersama lalu mendengarkan ceramah agama."
 },
 {
  "id": 21,
  "category": "Budaya",
  "difficulty": 1,
  "question": "Lontong balap yang terkenal hingga ke seluruh Indonesia aslinya berasal dari ...",
  "choices": [
   "Sidoarjo",
   "Yogyakarta",
   "Bandung",
   "Makassar"
  ],
  "answer": 0,
  "explanation": "Lontong balap berasal dari Sidoarjo! Namanya berasal dari kebiasaan para pedagangnya yang berbaris berlari-lari kecil saat berjualan."
 },
 {
  "id": 22,
  "category": "Budaya",
  "difficulty": 2,
  "question": "Bahan khas yang membuat kuah lontong balap Sidoarjo terasa berbeda dari daerah lain adalah ...",
  "choices": [
   "petis udang",
   "madu",
   "saus tomat",
   "kecap manis"
  ],
  "answer": 0,
  "explanation": "Ciri khas lontong balap Sidoarjo adalah petis udang Sidoarjo yang menjadi rahasia gurihnya kuah, ditemani tauge, tahu, dan lentho."
 },
 {
  "id": 23,
  "category": "Budaya",
  "difficulty": 1,
  "question": "“Egrang” adalah permainan tradisional di mana anak-anak ...",
  "choices": [
   "memegang bambu berkuda lalu melompat-lompat",
   "berlomba menutup mata",
   "membalut kaki dengan kain",
   "berlari mengelilingi lapangan"
  ],
  "answer": 0,
  "explanation": "Egrang adalah permainan naik “bumi” dari bambu: anak memelintir kaki di kursi bambu lalu melompat-lompat. Permainan ini melatih keseimbangan dan keberanian."
 },
 {
  "id": 24,
  "category": "Budaya",
  "difficulty": 1,
  "question": "“Congklak” dimainkan menggunakan ...",
  "choices": [
   "papan berlubang dan biji-bijian kecil",
   "kartu bergambar",
   "kelereng warna-warni",
   "bola dan gawang"
  ],
  "answer": 0,
  "explanation": "Congklak dimainkan dengan papan berlubang dan biji (kerang, kelereng, atau biji sereh) yang diperebutkan selangkah demi selangkah. Main ini melatih otak dan strategi."
 },
 {
  "id": 25,
  "category": "Budaya",
  "difficulty": 1,
  "question": "“Gobak sodor” dimainkan di lapangan yang digarap kotak-kotak, permainannya berupa ...",
  "choices": [
   "kejar-kejaran dan berlari dari satu kotak ke kotak lain",
   "berenang di kolam",
   "mengayuh sepeda bersama",
   "menangkap bola dengan tangan"
  ],
  "answer": 0,
  "explanation": "Gobak sodor adalah permainan kejar-kejaran di lapangan kotak-kotak: satu pihak mengejar, satu pihak menghindar. Seru dan banyak gerak!"
 },
 {
  "id": 26,
  "category": "Budaya",
  "difficulty": 1,
  "question": "“Hadrah” adalah pergelaran musik yang melantunkan puji-pujian kepada ...",
  "choices": [
   "Nabi Muhammad SAW",
   "raja-raja dahulu",
   "pahlawan bangsa",
   "guru-guru sekolah"
  ],
  "answer": 0,
  "explanation": "Hadrah adalah majelis sholawat yang melantunkan puji-pujian kepada Nabi Muhammad SAW, sering diadakan pada acara-acara Islami."
 },
 {
  "id": 27,
  "category": "Budaya",
  "difficulty": 2,
  "question": "“Ludruk” adalah seni teater khas Jawa Timur yang ciri khasnya ...",
  "choices": [
   "bercerita dengan humor dan diiringi gamelan calong arang",
   "hanya diisi oleh penari",
   "disajikan dengan bisik-bisik",
   "tanpa musik pengiring"
  ],
  "answer": 0,
  "explanation": "Ludruk adalah teater tradisional Jawa Timur yang lucu (humor) dan diiringi grup musik calong arang. Sering dipentaskan pada hajatan."
 },
 {
  "id": 28,
  "category": "Budaya",
  "difficulty": 1,
  "question": "Cerita pada pementasan wayang kulit umumnya diambil dari ...",
  "choices": [
   "Mahabharata dan Ramayana",
   "buku komik",
   "berita harian",
   "buku pelajaran IPA"
  ],
  "answer": 0,
  "explanation": "Wayang kulit mempertontonkan kisah Mahabharata dan Ramayana yang dimainkan dalang, diiringi gamelan. Wayang adalah warisan budaya dunia."
 },
 {
  "id": 29,
  "category": "Budaya",
  "difficulty": 2,
  "question": "Pusat produksi batik Sidoarjo yang sudah turun-temurun sejak tahun 1675 adalah ...",
  "choices": [
   "Batik Jetis",
   "Batik Pekalongan",
   "Batik Solo",
   "Batik Bali"
  ],
  "answer": 0,
  "explanation": "Batik Jetis (Desa Jetis, Kecamatan Candi) sudah menjadi sentra batik Sidoarjo sejak tahun 1675 dan terus dibuat turun-temurun hingga sekarang."
 },
 {
  "id": 30,
  "category": "Budaya",
  "difficulty": 2,
  "question": "“Jaran kepang” adalah tari tradisional yang menggambarkan ...",
  "choices": [
   "berkuda-kudaan dengan properti kuda dari kepangan",
   "berenang di sungai",
   "terbang layang-layang",
   "berdansa meniru burung"
  ],
  "answer": 0,
  "explanation": "Jaran kepang adalah tarian menggunakan properti “kuda” dari anyaman/kepangan, diarak keliling pada acara-acara hajatan dan pesta desa."
 }
];
