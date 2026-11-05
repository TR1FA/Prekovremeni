"""Alati za aplikaciju Prekovremeni.

Podaci svakog korisnika su u data/<id>.enc.json, sifrovani njegovom sifrom
(PBKDF2-SHA256 600 000 iteracija -> AES-256-GCM), isto kao u js/core.js.
Bez sifre se fajl ne moze procitati, pa je repozitorij smio biti javan.

  python tools/pk.py uvoz  --excel "...\\Trifa_prekovremeni_2026.xlsx" --id djordje
  python tools/pk.py novi  --id marko --ime "Marko Markovic" --pozicija "..."
  python tools/pk.py citaj --id djordje          (provjera: desifruje i ispise sazetak)

Sifra se unosi skriveno (getpass) ili preko varijable okruzenja PK_SIFRA.
Sifra se NIGDJE ne cuva.
"""
import argparse
import base64
import datetime as dt
import getpass
import hashlib
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ITER = 600_000
MONTHS = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "Avgust",
          "Septembar", "Oktobar", "Novembar", "Decembar"]
MONTH_ALIASES = {"jun": 6, "jul": 7, "august": 8, "septembar": 9, "sept": 9}


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def unb64(s: str) -> bytes:
    return base64.b64decode(s)


def derive(password: str, salt: bytes, it: int = ITER) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, it, 32)


def encrypt(doc: dict, password: str) -> dict:
    salt = secrets.token_bytes(16)
    key = derive(password, salt)
    iv = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(doc, ensure_ascii=False).encode("utf-8"), None)
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}


def decrypt(blob: dict, password: str) -> dict:
    key = derive(password, unb64(blob["salt"]), blob["iter"])
    pt = AESGCM(key).decrypt(unb64(blob["iv"]), unb64(blob["ct"]), None)
    return json.loads(pt.decode("utf-8"))


def ask_password(confirm: bool) -> str:
    pw = os.environ.get("PK_SIFRA")
    if pw:
        return pw
    pw = getpass.getpass("Sifra: ")
    if confirm and getpass.getpass("Ponovi sifru: ") != pw:
        sys.exit("Sifre se ne poklapaju.")
    if len(pw) < 4:
        sys.exit("Sifra je prekratka.")
    return pw


def new_id() -> str:
    return "e" + secrets.token_hex(6)


def now_ms() -> int:
    return int(time.time() * 1000)


def load_users() -> list:
    p = DATA / "users.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))["users"]
    return []


def save_users(users: list) -> None:
    DATA.mkdir(exist_ok=True)
    (DATA / "users.json").write_text(
        json.dumps({"users": users}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert_user(uid: str, name: str) -> None:
    users = [u for u in load_users() if u["id"] != uid]
    users.append({"id": uid, "name": name})
    users.sort(key=lambda u: u["name"])
    save_users(users)


def write_blob(uid: str, blob: dict) -> Path:
    DATA.mkdir(exist_ok=True)
    p = DATA / f"{uid}.enc.json"
    p.write_text(json.dumps(blob) + "\n", encoding="ascii")
    return p


def period_from_sheet(title: str):
    m = re.match(r"\s*([A-Za-zČčĆćŠšŽžĐđ]+)\s+(\d{4})", title)
    if not m:
        return None
    word, year = m.group(1).lower(), int(m.group(2))
    for i, name in enumerate(MONTHS, 1):
        if name.lower() == word:
            return f"{year}-{i:02d}"
    if word in MONTH_ALIASES:
        return f"{year}-{MONTH_ALIASES[word]:02d}"
    return None


def parse_hours(v):
    """Vrati (sati, izraz) — Excel moze imati broj ili formulu tipa =3+4."""
    if v is None or v == "":
        return None, None
    if isinstance(v, (int, float)):
        return float(v), None
    s = str(v).strip().lstrip("=").replace(",", ".").replace(" ", "")
    if re.fullmatch(r"\d+(\.\d+)?(\+\d+(\.\d+)?)+", s):
        return sum(float(x) for x in s.split("+")), s
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return float(s), None
    raise ValueError(f"Ne razumijem sate: {v!r}")


def cmd_uvoz(a):
    import openpyxl  # samo za uvoz
    wb = openpyxl.load_workbook(a.excel)
    stamp = now_ms()
    entries, periods, skipped = [], [], []
    profile = {"name": None, "position": "", "unit": "INVENDA SYSTEMS  •  PROIZVODNJA",
               "filePrefix": a.prefiks, "u": stamp}
    for ws in wb.worksheets:
        pid = period_from_sheet(ws.title)
        if not pid:
            print(f"  preskacem list {ws.title!r} (nije mjesec)")
            continue
        # zaglavlje
        for row in ws.iter_rows(min_row=1, max_row=8):
            for c in row:
                if c.value == "Zaposleni:":
                    profile["name"] = profile["name"] or ws.cell(c.row, 3).value
                if c.value == "Pozicija:":
                    profile["position"] = profile["position"] or ws.cell(c.row, 3).value or ""
        if isinstance(ws["A2"].value, str) and ws["A2"].value.strip():
            profile["unit"] = ws["A2"].value
        # tabela od reda 10 do "UKUPNO SATI:"
        r = 10
        while r < 500:
            if str(ws.cell(r, 1).value or "").strip().upper().startswith("UKUPNO"):
                break
            date_v, desc, hours_v, note = (ws.cell(r, 2).value, ws.cell(r, 4).value,
                                           ws.cell(r, 5).value, ws.cell(r, 6).value)
            desc = str(desc).strip() if desc is not None else ""
            hours, expr = parse_hours(hours_v)
            if date_v is None and not desc and hours is None:
                r += 1
                continue
            if not desc and hours is None:
                skipped.append(f"{ws.title} red {r}: samo datum {date_v:%d.%m.%Y} (bez opisa i sati)")
                r += 1
                continue
            if not isinstance(date_v, (dt.date, dt.datetime)):
                sys.exit(f"{ws.title} red {r}: nema datuma ({date_v!r})")
            d = date_v.date() if isinstance(date_v, dt.datetime) else date_v
            entries.append({
                "id": new_id(), "date": d.isoformat(), "desc": desc,
                "hours": round(hours or 0, 2), "expr": expr,
                "note": str(note).strip() if note else "",
                "period": pid, "c": stamp, "u": stamp,
            })
            r += 1
        periods.append(pid)
    if not entries:
        sys.exit("Nema unosa u Excelu.")
    periods = sorted(set(periods))
    last = periods[-1]
    profile["name"] = a.ime or profile["name"]
    doc = {
        "v": 1,
        "profile": profile,
        "periods": [{"id": p, "status": "open" if p == last else "closed",
                     "closedAt": None if p == last else stamp, "u": stamp} for p in periods],
        "entries": entries,
        "saved": stamp,
    }
    pw = ask_password(confirm=not os.environ.get("PK_SIFRA"))
    write_blob(a.id, encrypt(doc, pw))
    upsert_user(a.id, profile["name"])
    print(f"Uvezeno {len(entries)} unosa u {len(periods)} perioda za {profile['name']} -> data/{a.id}.enc.json")
    for p in periods:
        es = [e for e in entries if e["period"] == p]
        print(f"  {p}: {len(es):2d} unosa, {sum(e['hours'] for e in es):g} h")
    for s in skipped:
        print("  preskoceno:", s)


def cmd_novi(a):
    stamp = now_ms()
    today = dt.date.today()
    pid = f"{today.year}-{today.month:02d}"
    doc = {"v": 1,
           "profile": {"name": a.ime, "position": a.pozicija or "", "unit": a.odjel,
                       "filePrefix": a.prefiks or a.ime.split()[-1], "u": stamp},
           "periods": [{"id": pid, "status": "open", "closedAt": None, "u": stamp}],
           "entries": [], "saved": stamp}
    if (DATA / f"{a.id}.enc.json").exists() and not a.force:
        sys.exit(f"data/{a.id}.enc.json vec postoji (dodaj --force da prepises).")
    pw = ask_password(confirm=not os.environ.get("PK_SIFRA"))
    write_blob(a.id, encrypt(doc, pw))
    upsert_user(a.id, a.ime)
    print(f"Napravljen korisnik {a.ime} ({a.id}).")


def cmd_citaj(a):
    blob = json.loads((DATA / f"{a.id}.enc.json").read_text(encoding="ascii"))
    doc = decrypt(blob, ask_password(confirm=False))
    sys.stdout.reconfigure(encoding="utf-8")
    live = [e for e in doc["entries"] if not e.get("del")]
    print(doc["profile"]["name"], "-", len(live), "unosa")
    for p in doc["periods"]:
        es = [e for e in live if e["period"] == p["id"]]
        print(f"  {p['id']} {p['status']:6s} {len(es):2d} unosa {sum(e['hours'] for e in es):g} h")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("uvoz", help="uvezi Excel (jedan list po mjesecu)")
    u.add_argument("--excel", required=True)
    u.add_argument("--id", required=True, help="kratki id, npr. djordje")
    u.add_argument("--ime", help="ime za prikaz (inace iz Excela)")
    u.add_argument("--prefiks", default="Trifa", help="pocetak naziva Excel fajla pri izvozu")
    u.set_defaults(fn=cmd_uvoz)
    n = sub.add_parser("novi", help="novi korisnik bez podataka")
    n.add_argument("--id", required=True)
    n.add_argument("--ime", required=True)
    n.add_argument("--pozicija", default="")
    n.add_argument("--odjel", default="INVENDA SYSTEMS  •  PROIZVODNJA")
    n.add_argument("--prefiks")
    n.add_argument("--force", action="store_true")
    n.set_defaults(fn=cmd_novi)
    c = sub.add_parser("citaj", help="provjeri sifru i ispisi sazetak")
    c.add_argument("--id", required=True)
    c.set_defaults(fn=cmd_citaj)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
