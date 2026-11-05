# Prekovremeni

Evidencija prekovremenih sati: unos sa telefona ili računara, mjesečni pregled i izvoz u Excel u istom obliku kao `Trifa_prekovremeni_2026.xlsx`.

**Aplikacija:** https://tr1fa.github.io/Prekovremeni/

## Prijava

Izabereš svoje ime i upišeš šifru. Kvačica „Zapamti me“ drži prijavu 30 dana na tom uređaju.

## Šta aplikacija radi

- **Unos**: datum, opis rada, sati i napomena. Sati se mogu upisati kao `2`, `1,5`, `3+4` ili `1:30`. Ima brza dugmad za sate i za česte opise. Vikend je obojen kao u Excelu.
- **Period** je obračunski mjesec (npr. „Novembar 2026“). Kad predaš evidenciju, klikni **Zaključi period**: unosi se zaključaju, a novi idu u sljedeći mjesec. Period se može ponovo otvoriti.
- **Excel**: izvoz jednog mjeseca ili cijele godine (jedan list po mjesecu plus list „Pregled“). Formule ostaju žive.
- **Štampaj / PDF**: A4 obrazac sa potpisima zaposlenog i rukovodioca.
- **Pregled**: sati po mjesecu, dani u sedmici, najčešći rad i tabela perioda.
- Radi i bez interneta. Na telefonu se instalira preko „Dodaj na početni ekran“.

## Gdje su podaci i zašto je repozitorij javan

Podaci su u `data/<id>.enc.json` i šifrovani su šifrom korisnika (PBKDF2-SHA256 sa 600 000 iteracija, pa AES-256-GCM). Bez šifre se fajl ne može pročitati, ni ovdje na GitHubu. Šifra se nigdje ne čuva, a prijava uspije samo ako šifra otključa fajl.

Na svakom uređaju se podaci čuvaju lokalno (takođe šifrovani). Da bi telefon i računar imali iste unose, aplikacija ih šalje na GitHub. Za to treba **GitHub token**, koji se unosi jednom po uređaju u *Podešavanja → Čuvanje na GitHubu*. Token se pravi ovako: fine-grained token, samo repozitorij *Prekovremeni*, *Contents: Read and write*. Izmjene sa dva uređaja se spajaju po unosu, pa se ništa ne gubi.

## Alati (za održavanje)

```
python tools/pk.py uvoz  --excel "...\Trifa_prekovremeni_2026.xlsx" --id djordje   # uvoz iz Excela
python tools/pk.py novi  --id marko --ime "Marko Marković" --pozicija "..."         # novi korisnik
python tools/pk.py citaj --id djordje                                               # provjera šifre i sažetak
python tools/make_icons.py                                                           # ikonice
```

Šifra se unosi skriveno (ili preko varijable `PK_SIFRA`). Za lokalni test pokreni `python -m http.server 8765` i otvori http://localhost:8765/.

Za novu verziju povećaj `CACHE` u `sw.js`, jer instalirane aplikacije inače drže stare fajlove.
