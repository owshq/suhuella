SuHuella brand binaries stay in their current public locations so this slice does not duplicate or relocate persistent URLs:

- `site/public/suhuella-logo.svg`
- `site/public/suhuella-logo.png`
- `site/public/suhuella-icon-192.png`
- `site/public/suhuella-icon-256.png`
- `site/public/suhuella-icon-512.png`
- `desktop/assets/*`

`brands/suhuella/brand.ts` is the path authority. A future brand adds its own `brands/<id>/assets/` and only that folder is packaged for that build.
