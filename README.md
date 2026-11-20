# Klart — Att göra

En fristående PWA på svenska för att bryta ned saker att göra i daterade actions.

## Funktioner

- Skapa saker att göra.
- Öppna varje sak och lägg till valfritt antal actions.
- Ange datum för varje action.
- Markera varje action som färdig; färdigdatum sparas automatiskt.
- Markera saken som färdig när alla actions är klara.
- Se färdiga saker och deras actions i historiken.
- Återställ en färdig sak till listan eller ta bort den permanent.
- Lokal lagring i webbläsaren, responsiv layout och offlinestöd.

## Starta lokalt

PWA-funktioner kräver HTTP/HTTPS (inte bara `file://`). Kör i den här mappen:

```bash
python3 -m http.server 8080
```

Öppna sedan `http://localhost:8080`.

## Data

All data sparas lokalt under nyckeln `klart-pwa-data-v1` i webbläsarens `localStorage`.
