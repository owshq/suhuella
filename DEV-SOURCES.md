# DEV-SOURCES

Localhost-only Developer Sources. Production never shows this panel.

```text
LOCALHOST                         PRODUCTION
Developer Sources                 Connect folder
  ├── Reconnect previous
  ├── Add local folder…
  └── Load demo data
```

The browser host stays the same. On localhost a Dev Host driver can seed `/dev-data` without opening Chrome’s picker. That is not a filesystem exception in the web page. Production still uses the branded modal and native picker.

## Use

1. `npm run dev --prefix site`
2. Open http://localhost:3000/sources
3. **Load demo data** or **Add local folder…**
4. **Reconnect** if Chrome dropped a stored handle

## Tests

```text
npm run test:browser-dev-sources --prefix site
BROWSER_CONNECT_URL=http://127.0.0.1:3000 npm run test:browser-dev-sources-playwright --prefix site
```
