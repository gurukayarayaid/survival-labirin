#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GAME SURVIVAL LABIRIN
SD Negeri Semambung Jabon Sidorjo — dibuat untuk murid SD.

Backend Python (Flask):
  - CRUD soal (menu admin, login kata sandi)
  - Simpan / lanjutkan sesi game per nama murid
  - Papan skor (leaderboard)

Frontend: folder static/ (HTML5 + CSS + JavaScript) — dibuka langsung di
browser Android, full touch, anti pull-to-refresh, efek suara Web Audio.

Jalankan:  python app.py  (buka http://localhost:5000)
"""

import argparse
import json
import os
import secrets
import threading
import time
from contextlib import contextmanager

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_FILE = os.path.join(BASE_DIR, "data.json")
ADMIN_PASSWORD_DEFAULT = os.environ.get("ADMIN_PASSWORD", "admin123")
CATEGORIES = ("Sejarah", "Kearifan Lokal", "Budaya")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
_lock = threading.Lock()
_tokens = {}  # token -> expire epoch


# --------------------------------------------------------------- database --
def _load_unlocked():
    if not os.path.exists(DATA_FILE):
        d = _default_data()
        _save(d)
        return d
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save(d):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA_FILE)


@contextmanager
def db():
    """Akses data.json terkunci (thread-safe), auto-save saat keluar."""
    with _lock:
        d = _load_unlocked()
        yield d
        _save(d)


def _seed_questions():
    raw = [
        # ------------------------------- SEJARAH ----------------------------
        ("Sejarah", 1,
         "Ibu kota Kerajaan Majapahit dahulu terletak di Trowulan. Sekarang Trowulan berada di kabupaten ...",
         ["Surabaya", "Sidoarjo", "Gresik", "Lamongan"], 1,
         "Trowulan adalah kecamatan di Kabupaten Sidoarjo, yang kini menjadi kawasan situs budaya Kerajaan Majapahit."),
        ("Sejarah", 1,
         "Nama \u201cSidoarjo\u201d punya arti yang indah: \u201csido\u201d berarti jadi, \u201carjo\u201d berarti makmur. Jadi Sidoarjo bermakna ...",
         ["jadi makmur", "jadi besar", "jadi ramai", "jadi kuat"], 0,
         "Dalam bahasa Jawa, \u201csido\u201d artinya \u201cjadi\u201d dan \u201carjo\u201d artinya \u201cmakmur / mulia\u201d. Doanya agar warga Sidoarjo hidup makmur dan damai."),
        ("Sejarah", 2,
         "Dahulu daerah Sidoarjo bernama Sidokare, lalu diganti namanya pada tahun 1859 menjadi Sidoarjo. Mengapa diganti?",
         ["karena \u201ckare\u201d kurang pantas artinya", "karena terlalu panjang", "karena permintaan raja", "karena ada candi baru"], 0,
         "Nama Sidokare diganti pada 1859 karena kata \u201ckare\u201d kurang pantas maknanya (tertinggal). Nama baru Sidoarjo berarti \u201cjadi makmur\u201d."),
        ("Sejarah", 1,
         "Candi Pari adalah candi peninggalan abad ke-14 masa Kerajaan Majapahit. Candi Pari terletak di kecamatan ...",
         ["Porong", "Jabon", "Krian", "Buduran"], 0,
         "Candi Pari dibangun tahun 1371 masa pemerintahan Raja Hayam Wuruk, berada di Desa Candipari Kulon, Kecamatan Porong. Berlatar belakang agama Hindu."),
        ("Sejarah", 1,
         "Salah satu Wali Songo yang makam dan masjidnya ada di Desa Cukir, Kecamatan Sedati Sidoarjo adalah ...",
         ["Sunan Drajat", "Sunan Bonang", "Sunan Giri", "Sunan Kudus"], 0,
         "Makam dan Masjid Sunan Drajat berada di Desa Cukir, Sedati, Sidoarjo. Beliau menyebarkan Islam melalui seni budaya dan kepedulian sosial."),
        ("Sejarah", 2,
         "Bencana lumpur lapindo yang terjadi pada tahun 2006 berada di wilayah kecamatan ...",
         ["Porong", "Taman", "Candi", "Tambak"], 0,
         "Bencana lumpur lapindo 2006 terjadi di wilayah Kecamatan Porong. Peristiwa besar itu menjadi pelajaran penting tentang lingkungan dan kehati-hatian."),
        ("Sejarah", 1,
         "Sungai besar yang mengalir melewati wilayah Kabupaten Sidoarjo adalah Sungai ...",
         ["Brantas", "Ciliwung", "Mahakam", "Bengawan Solo"], 0,
         "Sungai Brantas adalah sungai terpanjang di Jawa Timur dan alirannya melewati wilayah Kabupaten Sidoarjo."),
        ("Sejarah", 2,
         "Rangkaian pegunungan yang berada di batas utara Kabupaten Sidoarjo adalah ...",
         ["Arjuno-Welirang", "Merapi", "Semeru", "Ijen"], 0,
         "Pegunungan Arjuno-Welirang berada di perbatasan utara Sidoarjo dan menjadi salah satu sumber air bagi wilayah sekitar."),
        ("Sejarah", 1,
         "Pada 10 November 1945, rakyat Sidoarjo ikut berjuang melawan Belanda bersama rakyat Surabaya. Tanggal itu kini diperingati sebagai ...",
         ["Hari Pahlawan", "Hari Kemerdekaan", "Hari Guru", "Hari Kartini"], 0,
         "Perlawanan rakyat Surabaya dan Jawa Timur pada 10 November 1945 diperingati setiap tahun sebagai Hari Pahlawan."),
        ("Sejarah", 2,
         "Pada tahun 2022 terjadi banjir besar di Porong karena jebolnya ...",
         ["tanggul Sungai Porong", "jembatan Porong", "tanggul kereta api", "dam bendungan"], 0,
         "Pada 2022 tanggul Sungai Porong jebol dan menyebabkan banjir besar di Porong dan sekitarnya. Warga kini lebih waspada mengenali daerah rawan banjir."),
        # --------------------------- KEARIFAN LOKAL -------------------------
        ("Kearifan Lokal", 1,
         "\u201cGotong royong\u201d adalah kearifan lokal yang artinya ...",
         ["bekerja bersama tanpa upah untuk kepentingan bersama", "berlomba menjadi yang terkaya", "bekerja sendiri agar cepat selesai", "bekerja hanya di waktu malam"], 0,
         "Gotong royong adalah bekerja bersama-sama tanpa mengharapkan upah. Kearifan ini mempererat persaudaraan antarwarga."),
        ("Kearifan Lokal", 1,
         "Kenduri atau selamatan adalah tradisi berdoa bersama, setelah itu warga ...",
         ["makan bersama sebagai bentuk berkat", "balapan lari", "bermain congklak", "berjualan kue"], 0,
         "Dalam selamatan warga berdoa bersama lalu makan \u201cberkat\u201d bersama-sama. Tradisi ini cara menyyukuri nikmat dan mempererat hubungan sosial."),
        ("Kearifan Lokal", 2,
         "Tumpeng yang disajikan saat hajatan bagian atasnya dibuat runcing. Artinya melambangkan ...",
         ["doa yang diarahkan kepada Tuhan Yang Maha Esa", "kue yang dibuat tinggi-tinggi", "toples nasi yang besar", "bentuk masjid di desa"], 0,
         "Ujung tumpeng yang runcing adalah simbol doa yang diarahkan kepada Tuhan Yang Maha Esa, satu dan tidak dua."),
        ("Kearifan Lokal", 2,
         "\u201cUrip iku urup\u201d adalah kearifan lokal Jawa Timur yang artinya ...",
         ["hidup itu harus menerangi orang lain", "hidup itu cepat sekali", "hidup harus hemat", "hidup itu penuh tangis"], 0,
         "\u201cUrip iku urup\u201d berarti hidup ini hendaknya menjadi penerang dan bermanfaat bagi orang lain, bukan menjadi beban."),
        ("Kearifan Lokal", 2,
         "Pepatah \u201cAlus basa winukul karsa\u201d artinya ...",
         ["kata-kata yang halus dapat memikat hati", "berbicara pelan membuat kuat", "berbicara cepat membuat pintar", "berbicara keras membuat disegani"], 0,
         "Bahasa yang lembut dan sopan membuat hati orang menjadi senang danWith rela membantu. Mulut yang terjaga adalah pembawa kebaikan."),
        ("Kearifan Lokal", 1,
         "Tradisi \u201cmunggahan\u201d dilakukan pada ...",
         ["malam sebelum Hari Raya Idul Fitri", "malam tanggal 17 Agustus", "malam tahun baru", "malam sebelum berangkat sekolah"], 0,
         "Munggahan adalah tradisi silaturahmi dan memberi ucapan maaf di malam sebelum Lebaran, khas masyarakat Jawa Timur."),
        ("Kearifan Lokal", 2,
         "\u201cSedekah bumi\u201d adalah tradisi ...",
         ["berbagi hasil panen sebagai rasa syukur kepada Tuhan", "menjual hasil panen dengan harga murah", "menanam padi di musim kemarau", "membagikan buku kepada warga"], 0,
         "Sedekah bumi adalah tradisi petani berterima kasih kepada Tuhan atas hasil panen dengan membagikan hasilnya kepada warga."),
        ("Kearifan Lokal", 2,
         "Nelayan kupang di Desa Balongdowo rutin mengadakan tradisi Nyadran. Tujuannya adalah ...",
         ["bersyukur kepada Tuhan dan mendoakan keselamatan melaut", "lomba menangkap ikan", "menjual perahu ikan", "mengundang tamu dari luar negeri"], 0,
         "Nyadran adalah bentuk syukur nelayan kupang Desa Balongdowo (Kecamatan Candi) kepada Tuhan serta doa agar melaut selalu diberi keselamatan."),
        ("Kearifan Lokal", 1,
         "Ungkapan \u201caji mumpung\u201d dalam budaya Jawa Timur artinya ...",
         ["memanfaatkan kesempatan selagi ada", "bekerja sampai malam hari", "meminjam barang lebih dulu", "menunggu waktu yang tepat"], 0,
         "\u201cAji mumpung\u201d artinya cepat memanfaatkan kesempatan ketika masih ada. Waktu belajar yang tepat jangan disia-siakan!"),
        ("Kearifan Lokal", 2,
         "\u201cYasinan\u201d adalah tradisi warga yang kumpul di masjid untuk ...",
         ["membaca Al-Qur\u2019an bersama dan mendengarkan ceramah", "lomba memasak nasi", "rapat pemilihan ketua RT", "pawai obor keliling desa"], 0,
         "Yasinan adalah kegiatan rutin warga, biasanya seminggu sekali, membaca Al-Qur\u2019an (Surah Yasin) bersama lalu mendengarkan ceramah agama."),
        # -------------------------------- BUDAYA ----------------------------
        ("Budaya", 1,
         "Lontong balap yang terkenal hingga ke seluruh Indonesia aslinya berasal dari ...",
         ["Sidoarjo", "Yogyakarta", "Bandung", "Makassar"], 0,
         "Lontong balap berasal dari Sidoarjo! Namanya berasal dari kebiasaan para pedagangnya yang berbaris berlari-lari kecil saat berjualan."),
        ("Budaya", 2,
         "Bahan khas yang membuat kuah lontong balap Sidoarjo terasa berbeda dari daerah lain adalah ...",
         ["petis udang", "madu", "saus tomat", "kecap manis"], 0,
         "Ciri khas lontong balap Sidoarjo adalah petis udang Sidoarjo yang menjadi rahasia gurihnya kuah, ditemani tauge, tahu, dan lentho."),
        ("Budaya", 1,
         "\u201cEgrang\u201d adalah permainan tradisional di mana anak-anak ...",
         ["memegang bambu berkuda lalu melompat-lompat", "berlomba menutup mata", "membalut kaki dengan kain", "berlari mengelilingi lapangan"], 0,
         "Egrang adalah permainan naik \u201cbumi\u201d dari bambu: anak memelintir kaki di kursi bambu lalu melompat-lompat. Permainan ini melatih keseimbangan dan keberanian."),
        ("Budaya", 1,
         "\u201cCongklak\u201d dimainkan menggunakan ...",
         ["papan berlubang dan biji-bijian kecil", "kartu bergambar", "kelereng warna-warni", "bola dan gawang"], 0,
         "Congklak dimainkan dengan papan berlubang dan biji (kerang, kelereng, atau biji sereh) yang diperebutkan selangkah demi selangkah. Main ini melatih otak dan strategi."),
        ("Budaya", 1,
         "\u201cGobak sodor\u201d dimainkan di lapangan yang digarap kotak-kotak, permainannya berupa ...",
         ["kejar-kejaran dan berlari dari satu kotak ke kotak lain", "berenang di kolam", "mengayuh sepeda bersama", "menangkap bola dengan tangan"], 0,
         "Gobak sodor adalah permainan kejar-kejaran di lapangan kotak-kotak: satu pihak mengejar, satu pihak menghindar. Seru dan banyak gerak!"),
        ("Budaya", 1,
         "\u201cHadrah\u201d adalah pergelaran musik yang melantunkan puji-pujian kepada ...",
         ["Nabi Muhammad SAW", "raja-raja dahulu", "pahlawan bangsa", "guru-guru sekolah"], 0,
         "Hadrah adalah majelis sholawat yang melantunkan puji-pujian kepada Nabi Muhammad SAW, sering diadakan pada acara-acara Islami."),
        ("Budaya", 2,
         "\u201cLudruk\u201d adalah seni teater khas Jawa Timur yang ciri khasnya ...",
         ["bercerita dengan humor dan diiringi gamelan calong arang", "hanya diisi oleh penari", "disajikan dengan bisik-bisik", "tanpa musik pengiring"], 0,
         "Ludruk adalah teater tradisional Jawa Timur yang lucu (humor) dan diiringi grup musik calong arang. Sering dipentaskan pada hajatan."),
        ("Budaya", 1,
         "Cerita pada pementasan wayang kulit umumnya diambil dari ...",
         ["Mahabharata dan Ramayana", "buku komik", "berita harian", "buku pelajaran IPA"], 0,
         "Wayang kulit mempertontonkan kisah Mahabharata dan Ramayana yang dimainkan dalang, diiringi gamelan. Wayang adalah warisan budaya dunia."),
        ("Budaya", 2,
         "Pusat produksi batik Sidoarjo yang sudah turun-temurun sejak tahun 1675 adalah ...",
         ["Batik Jetis", "Batik Pekalongan", "Batik Solo", "Batik Bali"], 0,
         "Batik Jetis (Desa Jetis, Kecamatan Candi) sudah menjadi sentra batik Sidoarjo sejak tahun 1675 dan terus dibuat turun-temurun hingga sekarang."),
        ("Budaya", 2,
         "\u201cJaran kepang\u201d adalah tari tradisional yang menggambarkan ...",
         ["berkuda-kudaan dengan properti kuda dari kepangan", "berenang di sungai", "terbang layang-layang", "berdansa meniru burung"], 0,
         "Jaran kepang adalah tarian menggunakan properti \u201ckuda\u201d dari anyaman/kepangan, diarak keliling pada acara-acara hajatan dan pesta desa."),
    ]
    out = []
    for i, (cat, diff, text, ch, ans, expl) in enumerate(raw, 1):
        out.append({
            "id": i, "category": cat, "difficulty": diff,
            "question": text, "choices": ch, "answer": ans,
            "explanation": expl,
        })
    return out


def _default_data():
    qs = _seed_questions()
    return {
        "questions": qs,
        "next_qid": len(qs) + 1,
        "sessions": {},
        "leaderboard": [],
        "admin_password": ADMIN_PASSWORD_DEFAULT,
        "school": "SD Negeri Semambung Jabon Sidorjo",
    }


# ------------------------------------------------------------------ helpers --
def _body():
    return request.get_json(silent=True) or {}


def _norm_name(n):
    n = (n or "").strip().replace("\u00a0", " ")
    return " ".join(n.split())[:16]


def _clean_question(b):
    q = " ".join((b.get("question") or "").split())
    if len(q) < 5:
        return None, "Pertanyaan terlalu pendek."
    cat = b.get("category") or ""
    if cat not in CATEGORIES:
        return None, "Kategori tidak dikenal."
    try:
        diff = int(b.get("difficulty") or 1)
    except Exception:
        diff = 1
    diff = max(1, min(3, diff))
    choices = [(" ".join((c or "").split())) for c in (b.get("choices") or [])][:4]
    while len(choices) < 4:
        choices.append("")
    if sum(1 for c in choices if c) < 3:
        return None, "Isi minimal 3 pilihan jawaban."
    try:
        ans = int(b.get("answer") or 0)
    except Exception:
        ans = 0
    if ans < 0 or ans >= len(choices) or not choices[ans]:
        return None, "Kunci jawaban harus menunjuk pilihan yang terisi."
    expl = " ".join((b.get("explanation") or "").split())
    return {
        "category": cat, "difficulty": diff, "question": q,
        "choices": choices, "answer": ans, "explanation": expl,
    }, None


def _require_admin(f):
    def wrap(*a, **k):
        auth = request.headers.get("Authorization", "")
        tok = auth[7:] if auth.startswith("Bearer ") else ""
        exp = _tokens.get(tok)
        if not exp or exp < time.time():
            return jsonify(error="Login admin diperlukan."), 401
        return f(*a, **k)
    wrap.__name__ = f.__name__
    wrap.__wrapped__ = f
    return wrap


# --------------------------------------------------------------------- pages --
@app.get("/")
def index():
    # index.html di ROOT repo — agar identik dengan struktur GitHub Pages.
    # no-cache: HP selalu cek HTML terbaru (versi ?v= di script/CSS berganti
    # tiap perbaikan → file JS baru langsung terunduh, tak kena cache lama).
    resp = send_from_directory(BASE_DIR, "index.html", max_age=0)
    resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


@app.get("/api/healthz")
def healthz():
    return jsonify(ok=True)


# --------------------------------------------------------------------- admin --
@app.post("/api/admin/login")
def admin_login():
    b = _body()
    with db() as d:
        if b.get("password") == d.get("admin_password"):
            tok = secrets.token_hex(16)
            _tokens[tok] = time.time() + 8 * 3600
            return jsonify(ok=True, token=tok)
    return jsonify(error="Kata sandi salah."), 403


@app.post("/api/admin/password")
@_require_admin
def admin_password():
    b = _body()
    cur, new = b.get("current", ""), b.get("new", "")
    with db() as d:
        if cur != d.get("admin_password"):
            return jsonify(error="Kata sandi lama salah."), 400
        if len(new) < 4:
            return jsonify(error="Kata sandi baru minimal 4 karakter."), 400
        d["admin_password"] = new
    return jsonify(ok=True)


# ------------------------------------------------------------------ questions --
@app.get("/api/questions/public")
def q_public():
    with db() as d:
        return jsonify(ok=True, questions=d["questions"])


@app.get("/api/questions")
@_require_admin
def q_list():
    with db() as d:
        return jsonify(ok=True, questions=d["questions"], total=len(d["questions"]))


@app.post("/api/questions")
@_require_admin
def q_add():
    qn, err = _clean_question(_body())
    if err:
        return jsonify(error=err), 400
    with db() as d:
        qn["id"] = d.get("next_qid", len(d["questions"]) + 1)
        d["next_qid"] = qn["id"] + 1
        d["questions"].append(qn)
    return jsonify(ok=True, question=qn)


@app.put("/api/questions/<int:qid>")
@_require_admin
def q_edit(qid):
    qn, err = _clean_question(_body())
    if err:
        return jsonify(error=err), 400
    with db() as d:
        for i, qq in enumerate(d["questions"]):
            if qq["id"] == qid:
                qn["id"] = qid
                d["questions"][i] = qn
                return jsonify(ok=True, question=qn)
    return jsonify(error="Soal tidak ditemukan."), 404


@app.delete("/api/questions/<int:qid>")
@_require_admin
def q_del(qid):
    with db() as d:
        before = len(d["questions"])
        d["questions"] = [x for x in d["questions"] if x["id"] != qid]
        if len(d["questions"]) == before:
            return jsonify(error="Soal tidak ditemukan."), 404
    return jsonify(ok=True)


# ------------------------------------------------------------------- sessions --
def _session_payload(b):
    try:
        stage = max(1, min(50, int(b.get("stage", 1))))
    except Exception:
        stage = 1
    try:
        lives = max(0, min(5, int(b.get("lives", 3))))
    except Exception:
        lives = 3
    try:
        score = max(0, int(b.get("score", 0)))
    except Exception:
        score = 0
    try:
        coins = max(0, int(b.get("coins", 0)))
    except Exception:
        coins = 0
    try:
        seed = int(b.get("seed") or 0)
    except Exception:
        seed = 0
    used = []
    for x in (b.get("usedQuestions") or [])[:80]:
        try:
            used.append(int(x))
        except Exception:
            pass
    return {"stage": stage, "lives": lives, "score": score,
            "coins": coins, "seed": seed, "usedQuestions": used}


@app.get("/api/sessions/<name>")
def s_get(name):
    n = _norm_name(name)
    if not n:
        return jsonify(error="Nama kosong."), 400
    with db() as d:
        s = d["sessions"].get(n.lower())
    if not s:
        return jsonify(ok=True, found=False)
    return jsonify(ok=True, found=True, session=s)


@app.post("/api/sessions/<name>")
def s_save(name):
    n = _norm_name(name)
    if not n:
        return jsonify(error="Nama kosong."), 400
    b = _body()
    payload = _session_payload(b)
    payload["name"] = n
    payload["updatedAt"] = int(time.time())
    with db() as d:
        d["sessions"][n.lower()] = payload
    return jsonify(ok=True)


@app.delete("/api/sessions/<name>")
def s_del(name):
    n = _norm_name(name)
    with db() as d:
        existed = n.lower() in d["sessions"]
        d["sessions"].pop(n.lower(), None)
    return jsonify(ok=True, deleted=existed)


# ---------------------------------------------------------------- leaderboard --
@app.get("/api/leaderboard")
def lb_get():
    with db() as d:
        rows = sorted(d["leaderboard"],
                      key=lambda r: (-r.get("score", 0), -r.get("stage", 0)))[:20]
    return jsonify(ok=True, leaderboard=rows)


@app.post("/api/leaderboard")
def lb_add():
    b = _body()
    n = _norm_name(b.get("name"))
    if not n:
        return jsonify(error="Nama kosong."), 400
    try:
        score = max(0, int(b.get("score", 0)))
    except Exception:
        score = 0
    try:
        stage = max(0, int(b.get("stage", 0)))
    except Exception:
        stage = 0
    row = {"name": n, "score": score, "stage": stage,
           "completed": bool(b.get("completed", False)), "time": int(time.time())}
    with db() as d:
        d["leaderboard"].append(row)
        d["leaderboard"].sort(key=lambda r: (-r.get("score", 0), -r.get("stage", 0)))
        d["leaderboard"] = d["leaderboard"][:100]
        rank = 1 + sum(1 for r in d["leaderboard"]
                       if (r.get("score", 0), r.get("stage", 0)) > (score, stage))
    return jsonify(ok=True, rank=rank)


# ------------------------------------------------------------------------ run --
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Game Survival Labirin - server")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=5000)
    a = ap.parse_args()
    print(" * Game Survival Labirin berjalan di http://%s:%d" % (a.host, a.port))
    app.run(host=a.host, port=a.port, debug=False)
