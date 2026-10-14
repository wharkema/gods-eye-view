# God's Eye View op de Synology NAS: https://wharkema.nl/gods-eye-view

Deze handleiding zet de app één keer op de NAS, op dezelfde manier als TTD2026 en Trading. Daarna gaat elke
wijziging op `main` **automatisch live**, binnen ongeveer 5 minuten (Taakplanner).

```
pull request  →  merge naar main
                     ↓
NAS (elke 5 min):  git fetch  →  nieuwe versie op main?  →  docker compose up -d --build
                     ↓
https://wharkema.nl/gods-eye-view  →  nginx (Web Station)  →  container (127.0.0.1:8019)  →  loginscherm  →  app
```

- **Alleen jij komt erin.** De container start alleen als er een account in `.env` staat
  (`APP_LOGIN_VERPLICHT=1`). Zonder sessie geeft elke pagina het loginscherm en elke `/api/`-aanroep 401.
  Alleen `/api/health` (voor de health-check) is open.
- **Sleutels staan alleen op de NAS**, in `/volume1/docker/gods-eye-view/.env`. Nooit in git: deze repo is
  **openbaar**.
- **Alleen `main` gaat live.** Branches en pull requests niet.

| Wat | Waarde |
|---|---|
| `NAAM` | `gods-eye-view` |
| `REPO` | `wharkema/gods-eye-view` |
| `POORT` | `8019` (8017 = TTD2026, 8018 = Trading) |

Al geregeld voor TTD2026 en niet opnieuw nodig: Git, Container Manager, SSH op poort 2222, het certificaat
voor `wharkema.nl` en de nginx-map van Web Station.

---

## Stap 1: het account en het geheim maken (op je pc)

Doe dit in PowerShell, in de map van het project op je pc (`cd $HOME\Documents\gods-eye-view`). Haal eerst de
laatste versie op met `git pull`.

```powershell
node scripts/login.mjs hash
node scripts/login.mjs geheim
```

- `hash` vraagt een gebruikersnaam en een wachtwoord van minstens 12 tekens. Wat je typt zie je niet. Je krijgt
  een regel `APP_GEBRUIKERS=jouwnaam=pbkdf2-sha256....`.
- `geheim` geeft een regel `APP_GEHEIM=...`.

Bewaar beide regels even, bijvoorbeeld in Kladblok. Je wachtwoord zelf staat er niet in, alleen een hash.

> Heb je al een account-regel uit TTD2026 (`python -m superp_login.auth hash`)? Die werkt hier ook. Maak wel
> een **eigen** `APP_GEHEIM` voor dit project.

## Stap 2: inloggen op de NAS en de variabelen zetten

```powershell
ssh -p 2222 Wesley@wharkema.nl
```

```sh
sudo -i
```

```sh
NAAM=gods-eye-view
REPO=wharkema/gods-eye-view
POORT=8019
MAP=/volume1/docker/$NAAM
NGINX=/usr/local/etc/nginx/conf.d/855359b7-aceb-49e4-899d-ef4281f36b77
echo "Project $NAAM uit $REPO in $MAP op poort $POORT"
docker ps --format '{{.Names}} {{.Ports}}' | grep ":$POORT->"
```

De laatste opdracht hoort **niets** te tonen: dan is poort 8019 vrij.

## Stap 3: de repo op de NAS zetten

De repo is openbaar, dus een deploy key is niet nodig:

```sh
git clone https://github.com/$REPO.git $MAP
cd $MAP && git log --oneline -1 && ls deploy
```

Je hoort `nas-update.sh` en `nginx-gods-eye-view.conf` te zien. Staan ze er niet, dan is de pull request met
deze bestanden nog niet gemerged naar `main`.

## Stap 4: `.env` met de sleutels (alleen op de NAS)

```sh
cd $MAP && cp -n .env.example .env && vi .env
```

In `vi`: druk op `i` om te typen, opslaan en sluiten met `Esc`, dan `:wq` en `Enter`.

Vul in:

| Regel | Waarde |
|---|---|
| `APP_GEBRUIKERS=` | de regel uit stap 1 |
| `APP_GEHEIM=` | de regel uit stap 1 |
| `GOOGLE_MAPS_API_KEY=` | dezelfde als op je pc |
| `CESIUM_ION_TOKEN=` | dezelfde als op je pc |
| `OPENSKY_CLIENT_ID=` / `OPENSKY_CLIENT_SECRET=` | dezelfde als op je pc (of `OPENSKY_AUTH_MODE=anon`) |
| `FIRMS_MAP_KEY=` | dezelfde als op je pc (zonder `#` ervoor) |
| `AISSTREAM_API_KEY=` | dezelfde als op je pc |
| `TOMTOM_API_KEY=` | dezelfde als op je pc (zonder `#` ervoor) |
| `OPENROUTER_API_KEY=` | dezelfde als op je pc |

`HOST`, `PORT`, de cookie-instellingen en `PREVIEW_ALLOWED_HOSTS` zet `docker-compose.yml` al goed; die hoef je
niet in te vullen.

Zet daarna de rechten goed. De laatste opdracht toont alleen de namen, zonder waarden:

```sh
chmod 600 $MAP/.env
grep -v '^#' $MAP/.env | grep . | sed 's/=.*/=…/'
```

## Stap 5: de sleutels van Google en Cesium op het nieuwe adres zetten

Beide sleutels staan in de browser en werken alleen op adressen die je toestaat:

- **Google Cloud Console › APIs & Services › Credentials › je sleutel › Websites:** voeg
  `https://wharkema.nl/gods-eye-view/*` toe.
- **Cesium ion › Access Tokens › je token › Allowed URLs:** voeg `https://wharkema.nl` toe.

## Stap 6: de container bouwen en starten

De eerste keer duurt het een paar minuten (`npm ci` en het bouwen van de Cesium-bundel).

```sh
sh $MAP/deploy/nas-update.sh $MAP --forceer
sleep 30
docker ps --filter name=$NAAM
curl -s http://127.0.0.1:$POORT/api/health; echo
```

Zo hoort het te zijn:

- de status is `Up …`, en na ongeveer 30 seconden `(healthy)`;
- de health-check geeft `{"status":"ok"}`.

Start de container niet, dan staat de reden in `docker logs --tail 30 $NAAM`. Een melding over
`APP_GEBRUIKERS` of `APP_GEHEIM` betekent dat stap 4 niet klopt.

## Stap 7: koppelen aan https://wharkema.nl/gods-eye-view (nginx)

```sh
cp $MAP/deploy/nginx-$NAAM.conf $NGINX/user.conf.$NAAM
grep -n "location\|proxy_pass" $NGINX/user.conf.$NAAM
nginx -t && nginx -s reload && echo "nginx herladen"
```

Test op de NAS zelf:

```sh
curl -sk -o /dev/null -w "%{http_code} -> %{redirect_url}\n" --resolve wharkema.nl:443:127.0.0.1 https://wharkema.nl/$NAAM
curl -sk -o /dev/null -w "%{http_code} -> %{redirect_url}\n" --resolve wharkema.nl:443:127.0.0.1 https://wharkema.nl/$NAAM/
```

Zo hoort het te zijn:

- **eerste regel:** `301 -> https://wharkema.nl/gods-eye-view/`;
- **tweede regel:** `303 -> https://wharkema.nl/gods-eye-view/login`.

De meldingen over `wasm` en `10.1.1.110/24` bij `nginx -t` zijn bekend en onschuldig. Open daarna
**https://wharkema.nl/gods-eye-view** en log in. De uitlogknop staat bovenaan in het midden, rechts in de rij ronde knoppen.

## Stap 8: automatisch bijwerken (Taakplanner)

Laat eerst de exacte scriptregel maken en **kopieer de uitvoer**:

```sh
echo "sh $MAP/deploy/nas-update.sh >> $MAP-update.log 2>&1"
```

Maak dan in DSM de taak:

1. **Configuratiescherm › Taakplanner › Maken › Geplande taak › Door gebruiker gedefinieerd script**.
2. Tabblad **Algemeen**: taak `gods-eye-view bijwerken`, gebruiker **root**.
3. Tabblad **Schema**: *Dagelijks uitvoeren*, **frequentie** *Elke 5 minuten*, eerste uitvoering 00:00,
   laatste 23:55.
4. Tabblad **Taakinstellingen**, bij *Door gebruiker gedefinieerd script*: plak de regel van hierboven.
5. **OK**. Selecteer de taak en kies **Uitvoeren** om hem één keer te testen.

```sh
tail -5 $MAP-update.log
```

Een leeg log is goed: er was niets nieuws op `main`. Bij een update staat er `bijgewerkt naar <commit>`.

## Een sleutel veranderen

Pas `.env` aan en bouw opnieuw:

```sh
sh /volume1/docker/gods-eye-view/deploy/nas-update.sh /volume1/docker/gods-eye-view --forceer
```

Dat is nodig omdat `GOOGLE_MAPS_API_KEY` en `CESIUM_ION_TOKEN` bij het bouwen in de app worden gezet. De
andere sleutels gelden na het opnieuw starten van de container, wat dezelfde opdracht ook doet.

Een nieuw wachtwoord: maak een nieuwe regel met `node scripts/login.mjs hash` (stap 1), zet die in `.env` en
draai dezelfde opdracht. Alle bestaande sessies vervallen dan.

## Problemen oplossen

| Wat je ziet | Oplossing |
|---|---|
| 502 Bad Gateway | De container draait niet. Bekijk `docker ps -a` en `docker logs gods-eye-view`. |
| `/gods-eye-view` geeft 301, maar `/gods-eye-view/` geeft 404 | Er staat `location /gods-eye-view/` zonder `^~`. Kopieer het bestand opnieuw (stap 7). |
| *Blocked request. This host is not allowed* | Je opent de app via een ander adres dan `wharkema.nl`. Voeg dat adres toe aan `PREVIEW_ALLOWED_HOSTS` in `docker-compose.yml`. |
| Na inloggen kom je weer op het loginscherm | Open de site via **https**: het sessie-cookie is `Secure`. |
| De aarde blijft leeg, in de console staat iets over de API key | Het adres staat niet bij de sleutel in Google Cloud (stap 5), of je hebt na het wijzigen van de sleutel niet met `--forceer` opnieuw gebouwd. |
| Update-log: *detected dubious ownership* | De taak draait niet als **root**. |
| Update-log: *Geen .env* | Stap 4 is overgeslagen. |
| Na een DSM-update werkt `/gods-eye-view` niet meer | Kijk of `$NGINX/user.conf.gods-eye-view` er nog staat. Herhaal anders stap 7. |

## Weer weghalen

```sh
cd $MAP && docker compose down --rmi local --volumes
rm $NGINX/user.conf.$NAAM && nginx -t && nginx -s reload
```

Verwijder daarna de taak in de Taakplanner en als laatste de map: `rm -r $MAP`.
