# นำ Precut ขึ้นขายบน T2ETECH Store

ฉบับสำหรับ Precut `1.0.0` วันที่ 9 ตุลาคม 2026 — Made by t2etech

## 1. สิ่งที่เตรียมแล้วและสิ่งที่ต้องทำก่อนเปิดขาย

ตัวติดตั้งที่สร้างจากเครื่องนี้คือ **Mac Apple Silicon / ARM64**:

- `out/precut-1.0.0-mac-arm64.dmg` — ไฟล์ให้ลูกค้าติดตั้งและอัปโหลดเข้า Store
- `out/precut-1.0.0-mac-arm64.zip` — แอปแบบ ZIP สำหรับทดสอบ/สำรอง
- `out/artifacts-darwin-arm64.json` — metadata, ขนาดไฟล์ และ SHA-256 ของ DMG
- `out/native-darwin-arm64.zip` และ `.sha256` — native tools สำหรับ runner สร้างเวอร์ชันถัดไป
- `docs/release-results-1.0.0-darwin-arm64.json` — ผลทดสอบแอปที่แพ็กจริง

แอปใช้ public `product.config.json` สำหรับสินค้า `PC`, เวอร์ชันจาก `package.json`, icon/logo ที่ให้มา และข้อความ Made by t2etech แล้ว ชื่อแอปและที่เก็บข้อมูลคงเดิมเมื่ออัปเดต ไม่มี private key หรือ client secret ใน config นี้

การทดสอบบนเครื่องนี้ผ่านการเปิดแอปจริง, config production, import, วิเคราะห์เสียงด้วย native tools ที่อยู่ในแอป, waveform และอ่านโปรเจกต์หลังปิดเปิดใหม่ ยังต้องทดสอบ **login → trial export → ซื้อ → activate → export → ปิดเปิดใหม่** กับ Store ที่ตั้งค่าเสร็จแล้วก่อนเปิดขายจริง ผล smoke ไม่ได้ยืนยันการซื้อหรือใช้โควต้า

ตัวติดตั้งนี้ไม่ลง Developer ID/Windows publisher และไม่ notarize สามารถส่งเข้า backend ที่ปรับแล้วได้; ลูกค้าอาจพบคำเตือนของระบบปฏิบัติการ การอัปเดตแบบ unsigned ใช้ดาวน์โหลดและติดตั้งเองจาก Store ส่วนการติดตั้งอัตโนมัติที่ตรวจผู้ลงลายเซ็นยังต้องมี signer pins

**ยังไม่ได้อัปโหลดหรือกด Publish สินค้าให้ลูกค้า** และยังไม่มีตัวติดตั้ง Windows หรือ Mac Intel ที่ผ่านการทดสอบ ให้เปิดขายเฉพาะระบบที่มีไฟล์และทดสอบแล้ว

native FFmpeg ที่ใช้เป็น GPL-enabled build: ก่อนแจกไฟล์สาธารณะต้องเตรียม corresponding source/build materials ตาม `THIRD_PARTY_NOTICES.md` และ `docs/BUILDING.md` รักษา notices ที่อยู่ในตัวติดตั้งด้วย การไม่มี Team ID ไม่ได้ยกเลิกเงื่อนไขนี้

## 2. ตั้งค่า Store ครั้งแรก

1. Deploy การแก้ backend ที่ยอมรับ `codeSigned: false` / `notarized: false` จากโฟลเดอร์ `t2etech-store` ก่อน ขั้นตอน build Precut ไม่ได้ deploy Store ให้
2. ตั้งค่า private R2 release bucket, GitHub OIDC และ Trigger.dev สำหรับ verification ตาม `t2etech-store/docs/deployment.md` ต้องมี worker ตรวจ SHA-256 จริงและ outbox dispatch ทำงาน จึงจะได้ `READY`
3. เปิด Admin → Products → Precut ตรวจข้อมูลสินค้า รูป cover ที่อนุมัติ และราคาเป็น **บาท** เช่น 599 บาท ถ้าต้องการราคา 599 อย่าใช้ 5.99 บาท
4. ตรวจ Stripe price mapping: เป็น THB, ราคา/ประเภท one-time ตรงกัน, price active และผูก licensing policy ที่ต้องการ ใช้ Stripe test mode ใน staging สำหรับซื้อทดสอบก่อน production
5. Licensing: policy v2 Precut คือข้อกำหนดสิทธิ์ ไม่ใช่เวอร์ชันแอป เลือกจำนวนเครื่อง/features/สิทธิ์ออฟไลน์ตามที่ขาย โควต้า trial เป็นอีกการตั้งค่าหนึ่ง กดบันทึกโควต้าให้สำเร็จ
6. SDK Integration: OAuth client เป็น **Public Client**, ใช้ PKCE และ callback `com.t2etech.precut://oauth/callback` แล้วใส่ Client ID → `PC` ใน `DESKTOP_OAUTH_CLIENTS_JSON` ของ deployment เดียวกัน
7. Export `product.config.json` ใหม่เมื่อเปลี่ยน Client ID/trial/config; วางที่ root Precut แล้ว build ใหม่ การแก้ JSON เพียงอย่างเดียวไม่เปลี่ยนโควต้าฝั่ง server ตัวเลขที่แสดงหลัง refresh ต้องมาจากการยืนยัน server

ไม่ต้องสร้าง product/policy ใหม่ทุกครั้งที่แก้แอป รักษา `PC`, `com.t2etech.precut`, callback และ user-data location เดิม

## 3. ผูก GitHub repository ใน Store

ตรวจ metadata จาก GitHub connector แล้ว: repository เป็น private, default branch `main`, ยังไม่มี source commit ในขณะเตรียมคู่มือนี้

เปิด Precut → Repository หรือ Admin → Repositories แล้วบันทึกค่าดังนี้:

| Field              | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Owner login        | `Soravit-Ice`                                                            |
| Repository name    | `Precut`                                                                 |
| Owner ID           | `80631648`                                                               |
| Repository ID      | `1411644739`                                                             |
| Workflow ref       | `Soravit-Ice/Precut/.github/workflows/store-release.yml@refs/heads/main` |
| Allowed tag prefix | `refs/tags/v`                                                            |

ใช้ numeric IDs ตามตาราง ไม่ใช่ Product UUID/OAuth Client ID หากลบและสร้าง repository ใหม่ต้องอ่าน Repository ID ใหม่

workflow มี caller `release.yml` เรียก reusable `store-release.yml@main` เพื่อให้ token มี `job_workflow_ref` ที่ตรงกับ Store แม้เวอร์ชัน tag จะเปลี่ยน เป็นพฤติกรรมที่อธิบายไว้ใน [GitHub OIDC reusable workflows](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows)

รักษา workflow บน `main` และจำกัดผู้แก้ไข branch นี้ เพราะเป็นตัวที่ Store เชื่อถือ

## 4. ตั้งค่า GitHub Actions

ใน [Soravit-Ice/Precut](https://github.com/Soravit-Ice/Precut) → Settings → Secrets and variables → Actions → **Variables** เพิ่ม:

| Variable                         | สิ่งที่ใส่                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `PRECUT_PRODUCT_CONFIG_JSON`     | JSON ทั้งไฟล์ที่ export จาก Store สำหรับ PC เป็น public config       |
| `PRECUT_NATIVE_MAC_ARM64_URL`    | HTTPS URL ดาวน์โหลด `native-darwin-arm64.zip` โดยไม่ต้อง login       |
| `PRECUT_NATIVE_MAC_ARM64_SHA256` | ค่า hash จาก `out/native-darwin-arm64.zip.sha256` เฉพาะตัวเลข 64 ตัว |

native ZIP ต้องมี `bin/`, `lib/`, `manifest.json` อยู่ที่ root ไม่ต้องใส่โฟลเดอร์ native ครอบอีกชั้น อัปโหลด ZIP ไว้ในพื้นที่ public download ที่ควบคุมได้ เช่น R2 และใช้ URL ที่ downloader เข้าถึงได้ตรง ๆ อย่าใช้ private GitHub asset URL ที่ต้องมี token เพราะ downloader นี้ไม่ได้ส่ง token

ค่านี้เป็น build tools สำหรับ CI **ไม่ใช่ไฟล์ DMG ให้ลูกค้าซื้อ** และต้องจัด source/notices สำหรับ native distribution ด้วย

ไม่ต้องใส่ `PRECUT_RELEASE_TARGETS` ถ้าปล่อยเฉพาะ Apple Silicon ซึ่งเป็นค่าเริ่มต้น หากมี approved native bundles ของ Intel/Windows และพร้อมทดสอบแล้ว จึงใส่:

```json
[
  {
    "runner": "macos-15",
    "platform": "darwin",
    "arch": "arm64",
    "bundle_url": "PRECUT_NATIVE_MAC_ARM64_URL",
    "bundle_sha": "PRECUT_NATIVE_MAC_ARM64_SHA256"
  },
  {
    "runner": "macos-15-intel",
    "platform": "darwin",
    "arch": "x64",
    "bundle_url": "PRECUT_NATIVE_MAC_X64_URL",
    "bundle_sha": "PRECUT_NATIVE_MAC_X64_SHA256"
  },
  {
    "runner": "windows-2025",
    "platform": "win32",
    "arch": "x64",
    "bundle_url": "PRECUT_NATIVE_WINDOWS_X64_URL",
    "bundle_sha": "PRECUT_NATIVE_WINDOWS_X64_SHA256"
  }
]
```

เพิ่ม URL/hash variables ของ target ที่เพิ่มตามชื่อใน JSON ห้ามนำ ARM64 ZIP ไปใช้กับ x64 runner

Settings → Environments → สร้าง **`release-upload`** จำกัด tag ที่อนุญาตเป็น `v*` และตั้ง reviewer ก่อน upload หาก GitHub plan รองรับ protection นี้ workflow ใช้ OIDC จึงไม่ต้องใส่ Store API token/Cloudflare secret/Supabase service role ใน repo นี้

## 5. ส่ง source และ release เวอร์ชันแรก

โฟลเดอร์ Precut ในเครื่องนี้ยังไม่มี `.git` และ remote ว่างในขณะตรวจ ดังนั้นทำ initial push หลังตั้ง Git authentication ไว้แล้ว:

```sh
cd /Users/soravit_ice/Desktop/Brand/Precut
git init -b main
git remote add origin https://github.com/Soravit-Ice/Precut.git
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare Precut 1.0.0 desktop release"
git push -u origin main
```

ตรวจรายการก่อน commit: `.gitignore` กัน `.env*`, `*.key`, `product.config.json`, native outputs, `out/`, `.tools/`, cache และ node_modules แล้ว อย่า force-add secrets หรือ native binaries ลง source repo `product.config.json` ส่งผ่าน public variable ในขั้นก่อนหน้า

เมื่อ Store repository binding, variables และ services พร้อมแล้ว:

```sh
git tag -a v1.0.0 -m "Precut 1.0.0"
git push origin v1.0.0
```

เปิด GitHub → Actions → **Release Precut to T2ETECH Store** แล้วดูขั้นตอน:

1. ติดตั้ง dependency แบบ frozen lockfile และตรวจ SDK archive
2. คืน public config, ตรวจ package version ตรง tag, ดาวน์โหลด native bundle พร้อมตรวจ hash
3. ตรวจ type/tests/native tools แล้วแพ็กแอป
4. เปิดแอปที่แพ็กจริงและทดสอบ import/analysis/restart
5. เก็บ installers/manifest และ acceptance report เป็น Actions artifacts
6. ขออนุมัติ `release-upload` ถ้าตั้ง reviewer ไว้
7. ใช้ OIDC อัปโหลดเข้า private R2 และขอ server verification

ผล upload จะเป็น `submittedForVerification: true`, `published: false` ตรวจสอบ hash/ขนาดของ artifact ที่ได้จาก **CI**; hash อาจต่างจาก DMG ที่ build ในเครื่องเพราะเวลา/packaging metadata อย่าใช้ manifest local กับไฟล์จากอีก build

workflow_dispatch ใช้ได้เมื่อเลือก **tag `v1.0.0`**; เลือก `main` จะถูก `release:check` ปฏิเสธ หากอัปโหลดเสร็จแล้วให้ตรวจ release ที่มีอยู่ใน Store ก่อนกด rerun การ upload เป็นขั้นที่ผูก session ไม่ใช่ปุ่ม retry verification

DMG local ที่เตรียมไว้ใช้ทดสอบได้ทันที แต่ flow เข้า Store ปัจจุบันรับ release ผ่าน GitHub OIDC ดังนั้นไม่ใช่นำไฟล์วาง public R2 แล้วจะเปิดขายเอง

## 6. Publish และทดสอบก่อนเปิดขาย

1. Admin → Releases → ตรวจสินค้า `PC`, เวอร์ชัน `1.0.0`, channel **STABLE**, platform **MACOS**, architecture **ARM64**
2. รอทุก artifact เป็น **VERIFIED** และ release เป็น **READY** ถ้าค้าง `VERIFYING` ตรวจ Trigger.dev และ outbox; ถ้า FAILED อ่านเหตุผลและแก้ต้นเหตุ แล้วใช้ retry verification ใน Admin
3. กด Publish release, ใส่ reason และยืนยันตัวตนตาม modal พิมพ์ confirmation ที่หน้าจอระบุ (`PUBLISH` สำหรับคำสั่ง publish release)
4. เปิด Product → Publishing ตรวจ cover, Stripe pricing, active licensing policy และ published distributable release
5. Change status → **PUBLISHED**, ใส่ reason, ยืนยันตัวตน และยืนยันตามข้อความในหน้าจอ (`PUBLISHED` สำหรับสถานะสินค้า)
6. เปิดหน้าสินค้าจากบัญชีลูกค้า ให้เห็นราคาและระบบที่ดาวน์โหลดได้จริง
7. ติดตั้ง DMG ที่ได้จาก Store ใน environment ทดสอบ: ลาก Precut ไป Applications, เปิด, sign in, approve connection, กลับแอป แล้ว Refresh access
8. ทดลอง export ให้ quota ลดหลังสำเร็จ, ทดสอบซื้อใน staging/Stripe test, activate purchase, export อีกครั้งและปิดเปิดใหม่ให้สิทธิ์ยังอยู่ การ connect account อย่างเดียวไม่ได้ยืนยัน paid licence
9. ทดลองโหมด offline ตาม policy, quota หมด, ไม่มีสิทธิ์ และจำนวนเครื่องสูงสุด รวมถึง import/export วิดีโอของงานจริงก่อนเปิด production checkout

macOS อาจเตือนเรื่อง unsigned app ให้ผู้ใช้จัดการตามคำแนะนำปกติของระบบ ไม่ปิด Gatekeeper ทั้งเครื่อง ตัว build นี้ยังไม่ได้ผ่านการทดสอบ clean install บน Mac อีกเครื่อง จึงควรใช้ไฟล์จาก Store ที่จะขายจริงในขั้นนี้

## 7. เมื่อมีอัปเดต

ถ้าเป็น bugfix ใช้ `1.0.1`; เพิ่มความสามารถที่เข้ากันได้ใช้ `1.1.0` ทุก build ที่เผยแพร่ต้องใช้เลขใหม่ ไม่แทนที่ไฟล์ที่ขายแล้วภายใต้ version เดิม

```sh
# ใช้ Node 24.21.0 / pnpm 11.5.2 ตาม docs/BUILDING.md
pnpm version 1.0.1 --no-git-tag-version
# เขียน releases/1.0.1.md อธิบายการเปลี่ยนแปลง
pnpm release:check
pnpm typecheck
pnpm test
git add package.json pnpm-lock.yaml releases/1.0.1.md apps packages scripts
git commit -m "Release Precut 1.0.1"
git push origin main
git tag -a v1.0.1 -m "Precut 1.0.1"
git push origin v1.0.1
```

รอ CI → VERIFIED/READY → กด Publish release ใหม่เหมือนเดิม สินค้าที่ PUBLISHED แล้วไม่ต้องสร้างใหม่, ไม่ต้องเปลี่ยน OAuth Client ID, Product Code หรือ policy เพราะแค่แก้เวอร์ชันแอป หาก config ฝั่ง Store เปลี่ยนให้ export ใหม่และอัปเดต GitHub variable ก่อน tag

ทดสอบ upgrade จากตัวติดตั้ง `1.0.0` **ที่มีโปรเจกต์และ activation จริง** ไป `1.0.1`: บันทึกงานและปิดแอป, ติดตั้งทับ Precut เดิมใน Applications, เปิดใหม่ ตรวจงาน/แคช/บัญชี/สิทธิ์และ export ข้อมูลแอปใช้ `appData/com.t2etech.precut` เดิม จึงอย่าลบโฟลเดอร์นี้ระหว่างอัปเดต บน Windows ตัว NSIS กำหนดไม่ลบ AppData เมื่อ uninstall; ต้องทดสอบบน Windows เมื่อมี installer แล้ว

แอป unsigned รุ่นนี้: Settings → About Precut → Check for updates จะแสดงทางไป Store → ดาวน์โหลดเวอร์ชันใหม่ → ปิดแอปและติดตั้งทับเอง ไม่อ้างว่ารุ่นปัจจุบันเป็นรุ่นล่าสุดจาก server หากเพิ่ม signer pins ในอนาคตจึงเปิดเส้นทาง SDK ตรวจลายเซ็นและติดตั้ง verified update

ถ้ารุ่นใหม่มีปัญหา ใช้ Admin → Releases → Yank รุ่นนั้นตาม confirmation ในหน้าจอ แล้วทดสอบว่าหน้า download/latest กลับไปใช้รุ่นที่ยังเผยแพร่ได้ ห้ามแก้ไฟล์ installer เก่าที่ immutable และอย่า rollback ข้อมูล SQLite ด้วยการลบข้อมูลลูกค้า

## คำสั่ง build ในเครื่องนี้

```sh
cd /Users/soravit_ice/Desktop/Brand/Precut
export PATH="$PWD/.tools/node-v24.21.0-darwin-arm64/bin:$PATH"
pnpm release:build
pnpm fixtures:prepare
node scripts/release-smoke.mjs
node scripts/native-archive.mjs
```

`release:build` ปฏิเสธ development/test overrides และ tag ที่ไม่ตรง version; manifest เลือกชื่อ installer ตรงเวอร์ชันเท่านั้น ไม่ปะปน RC เก่า โหมด local ไม่มี OIDC สำหรับ upload ให้ใช้ workflow เมื่อผูก repository แล้ว
