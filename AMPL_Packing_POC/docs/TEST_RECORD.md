# AMPL Packing POC — End-to-end test record

Fill in each **Result** with ✅ Pass or ❌ Fail, and add a note for anything unexpected.

## Test details

| Item | Value |
| --- | --- |
| Date | |
| Tested by | |
| Backend commit (`git log --oneline -1`) | |
| Frontend commit | |
| Laptop / browser | e.g. MacBook, Chrome |
| Phone / browser | e.g. Android, Chrome |
| Product label printer and sticker sheet | |
| Box label printer (100 × 50 mm labels) | |
| Automated tests (`python manage.py test`) | 154 tests — OK / failed |

## A. Main flow (Phase 5)

| # | Step | How | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | SKU exists | Admin → SKUs & UIDs | SKU001 listed and Active | | |
| A2 | Generate 25 UIDs | SKU001 → Generate UIDs → 25 | Green bar: "25 UIDs … are ready"; Generated count +25 on dashboard | | |
| A3 | Print product labels | Print labels → sticker sheet, scale 100% | 25 labels, each with QR + 6-digit UID + SKU001; aligned with stickers | | |
| A4 | Box configuration | Box configurations → BC2 = SKU001 × 25 (Change items if needed) | Latest version shows SKU001 × 25, 25 per box | | |
| A5 | Section assignment | Packing sections → Section A → BC2 (latest) → Save; operator1 listed | Section A shows BC2 and operator1 | | |
| A6 | Operator login on phone | `https://<laptop-ip>:5180`, sign in as operator1 | Section list shows only Section A with BC2 | | |
| A7 | Start box | Section A → Start new box → Start camera → allow | Camera view opens; progress 0 / 25 | | |
| A8 | Scan 25 labels | Point camera at each new label | Beep + green "Added" each time; progress reaches 25 / 25 | | |
| A9 | Box saved automatically | (no button) after the 25th scan | Green "Box full ✓ Saved" with a large box ID (e.g. BOX-000004) | | |
| A10 | Label preview, print, next box | After the last scan: preview opens → Print (paper 100 × 50 mm, scale 100%, margins None) → Next box | Preview stays until Print is tapped; one label (QR on the left; box ID, configuration, quantity, section, date on the right); Next box opens a new box | | |
| A10b | Label PDF | On the preview: Download label PDF (100 × 50 mm), open the file | One page, exactly 100 × 50 mm, same label; the QR scans | | |
| A11 | Scan a box | Scan box / item → scan the printed sticker | Box ID, "Packed ✓", box type BC2, 25 pcs, Section A, packed time and operator, all 25 UIDs | | |
| A12 | Scan an item | Scan box / item → scan one packed label, then one unused label | First: SKU001, "Packed ✓", its box ID and time. Second: "Not packed yet" | | |
| A13 | Dashboard and history | Admin → Dashboard; Packing history | Counts updated; the new box listed as Completed, 25 / 25 | | |

## B. Rejections and edge cases

| # | Case | How | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| B1 | Duplicate scan | Scan the same label twice in an open box (wait 3 s between) | Red "Already scanned"; count does not change | | |
| B2 | Unknown UID | Type `123456` in the UID box | Red "Unknown UID" (pick another number if 123456 happens to exist) | | |
| B3 | Not a product QR | Type `abc` | Red "Not a product QR" | | |
| B4 | Box label in packing | Scan a box sticker while packing | Red "Box label scanned" | | |
| B5 | Wrong SKU | Scan a SKU002 label into a BC2 box | Red "Wrong SKU" | | |
| B6 | Too many of one SKU | In a box with 2 SKUs (e.g. BC3: SKU001 × 10 + SKU002 × 30), scan an 11th SKU001 | Red "SKU already full" | | |
| B7 | Already packed | Scan a label from an already completed box | Red "Already packed in BOX-…" | | |
| B8 | In another open box | Scan a UID that is in Section B's open box from Section A | Red "In another box" | | |
| B9 | Lost connection on the last scan | Turn Wi-Fi off just after the 25th scan, turn it on, reopen the section | Box is saved by itself; only one box ID; history shows one new box | | |
| B10 | Complete too early | (Covered by automated test) server refuses completion below 25 / 25 | `COUNTS_INCOMPLETE` | | |
| B11 | Remove wrong item | In an open box, tap Remove on one UID | Count goes down by 1; UID can be scanned again | | |
| B12 | Cancel box | Cancel this box… → reason → Cancel box | "Box cancelled"; its products become available again | | |
| B13 | Unknown code on Scan box / item | Type `BOX-999999`; then `abc` | "Box not found"; then "Not an AMPL QR" | | |
| B14 | Reprint | Scan box / item → scan a box → Reprint box label | The same label preview opens with Print and Back | | |
| B15 | Camera permission denied | On the phone, deny camera access, then Start camera | Clear message; typing the UID still works | | |
| B16 | Wrong password | Sign in with a wrong password | "Wrong username or password." | | |
| B17 | Operator blocked from admin | As operator1, open `/manage` | Sent back to the operator home | | |
| B18 | Scan log | Admin → Scan log → Rejected only | Rejections from B1–B8 listed with time, user, value | | |

## C. Persistence and printing

| # | Case | How | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | Data survives restart | Note dashboard numbers; stop backend and frontend (Ctrl + C); start both again | Same numbers; open box still open with the same items | | |
| C2 | Box label readable | Scan the printed 100 × 50 mm label from 10–30 cm | Reads within 2 seconds | | |
| C3 | Product label readable | Scan 5 printed product labels | Each reads within 2 seconds | | |

## D. Production readiness (laptop)

| # | Check | Command / action | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| D1 | Deployment safety check | See README → "Production check" | `System check identified no issues (1 silenced).` | | |
| D2 | Frontend production build | `npm run build` (frontend) | Ends with `✓ built in …` | | |
| D3 | HawkN OS untouched | In each repo: `git log origin/dev --grep='^M[0-9]' --name-only --format='' \| sort -u \| grep -v '^AMPL_Packing_POC/'` | Prints nothing (our milestone commits only changed `AMPL_Packing_POC/`) | | |

## Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Tested by | | | |
| Reviewed by | | | |
