# PixEdito — GitHub Pages background-remover build v13

This is the complete GitHub Pages root-ready version of the verified PixEdito
v13 web app. It preserves the same editor, 36 indexable canonical URLs,
English/French content structure and one focused AI function: remove the
background from a person or portrait.

The result can be previewed with transparency, downloaded as a transparent PNG
or added to the editor as a new layer. The MediaPipe portrait model and WASM
runtime are included locally and load only when the background remover is used.
No API key, account, database, PHP or server-side application is required.

GitHub Pages requirements included in this package:

- `index.html` at the repository root
- `.nojekyll` so GitHub serves all static assets directly
- `CNAME` containing `pixedito.com`
- a custom `404.html`
- root-relative links for the `pixedito.com` custom domain
- versioned `/editor-v13/`, CSS and JavaScript assets to avoid the old v11 UI

The editor shell remains `noindex, indexifembedded, follow`. The crawlable
homepage contains the product copy, internal links and structured data. The
sitemap contains the 36 indexable canonical URLs.

Follow `UPLOAD-INSTRUCTIONS.txt`. Upload the contents of this package—not the
ZIP itself—to the root of the GitHub repository used by GitHub Pages.
