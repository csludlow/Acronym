# CU typography

[CU’s font guide](https://www.cedarville.edu/offices/creative-services/brand/fonts), retrieved November 4, 2026, specifies **Minion for body copy** and **Myriad for larger text and callouts**. It limits use of the University fonts to University-related work.

## Website

The Adobe Fonts project **Acronym CU Typography**, kit **yya5cit**, was created and published through the authenticated Adobe account. It includes Minion Pro and Myriad Pro in regular, bold, italic, and bold italic.

The app requests `https://use.typekit.net/yya5cit.css` after React mounts. The stylesheet initially uses nonmatching `media="print"` and switches to `all` on load, so a slow or stalled Adobe request cannot delay the first screen. Keep this optional loader in `src/main.tsx`; do not restore a blocking stylesheet in the HTML header.

The exact CSS names returned by Adobe are `minion-pro` and `myriad-pro`. The app uses Minion for body paragraphs and source excerpts; Myriad for headings, navigation, controls, labels, numbers, and callouts. Offline fallback families are explicitly listed in CSS.

The kit was configured for `localhost` and `127.0.0.1`. Add the actual CU Launch hostname to this existing web project in Adobe Fonts when that hostname is known. Keep the Adobe subscription/project active. This public kit ID is an embed identifier, not a secret or API credential. No proprietary font binaries are committed.

Font loading contacts `use.typekit.net` and `p.typekit.net`. Production CSP allows those specific origins for their required styles/fonts. The core workflow still works offline with fallback fonts. No assessment answers or evidence are intentionally sent to Adobe for font loading.

The regression in `tests/e2e/fonts.spec.ts` holds the Adobe stylesheet request open while opening a synthetic assessment and downloading a PDF. It failed with the previous header link and passes with the non-blocking loader. Immediate network rejection and a stalled request are different cases; both are covered.

## DOCX

New DOCX reports reference **Minion Pro** for body text and **Myriad Pro** for title, headings, banner, and footer. The document does not embed commercial font files. A recipient needs those licensed desktop fonts installed to render the exact typography; Word or LibreOffice may substitute when they are absent. Old snapshot files are preserved unchanged.

## PDF

An Adobe web kit does not supply server-installable font files. [Adobe’s licensing FAQ](https://helpx.adobe.com/fonts/web/font-licensing/font-licensing.html) distinguishes website fonts, document embedding, and server installation. [Adobe’s web-font printing guidance](https://helpx.adobe.com/fonts/web/web-design-and-development/printing-fonts.html) limits that printing to personal use; the app does not promote browser printing as a purchaser-report licensing workaround.

To use actual CU fonts in server-generated reports, obtain font files licensed for that use and configure a **private directory outside the public repository**:

```text
minion-regular.otf
minion-bold.otf
myriad-regular.otf
myriad-bold.otf
```

`.ttf` files with the same base names also work. Set `CU_PDF_FONT_DIR=/private/path/to/fonts` before starting the server. The font directory is not exposed through HTTP. All four roles must be present; incomplete configuration fails visibly. Verify the applicable font license before deployment. A web-font subscription alone is not recorded as server permission.

Without this configuration, PDF exports use bundled Noto Serif for body text and Noto Sans for headings and include a visible font note. These are fallbacks, not claimed to be Minion or Myriad. The fonts remain available offline and preserve report content. The exact CU PDF typography is unverified until the licensed font files are configured.
