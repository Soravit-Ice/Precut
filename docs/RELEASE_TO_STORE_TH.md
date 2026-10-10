# นำ Precut ขึ้นขายบน T2ETECH Store

ฉบับสำหรับ Precut `2.0.0` ผ่าน GitHub Actions วันที่ 11 ตุลาคม 2026 พร้อมประวัติการปล่อย `1.0.1` แบบ manual — Made by t2etech

## รุ่น 2.0.0 ผ่าน GitHub Actions

รอบ [38082070020](https://github.com/Soravit-Ice/Precut/actions/runs/38082070020) ผ่านทุก job แล้วที่ commit `3095d90315722109abc606d6dc5619a670be0e4b` วันที่ 11 ตุลาคม 2026 ตามเวลาไทย: Mac Apple Silicon, Mac Intel และ Windows X64 ผ่าน 126 tests / 17 test files ต่อระบบ รวมถึงการเปิดแอปที่แพ็กจริงเพื่อทดสอบ import, speech, waveform และ restart persistence

upload job ส่ง `precut-2.0.0-mac-arm64.dmg`, `precut-2.0.0-mac-x64.dmg` และ `precut-2.0.0-win-x64.exe` เข้า Store สำเร็จ โดย session `7a219715-9cda-4da3-a89c-439341a36275` ตอบ `submittedForVerification: true`, `published: false` ผลนี้ยืนยันการอัปโหลดและการขอตรวจไฟล์ ยังไม่ใช่การยืนยัน READY หรือ Publish ดูผลทดสอบและ SHA-256 ของไฟล์จาก CI ที่ `docs/github-release-acceptance-2.0.0.json`

tag `v2.0.0` ชี้ไปยัง source ที่ผ่านรอบนี้แล้ว ห้ามย้าย tag หรือแทนที่ installer ของรุ่นนี้ การแก้แอปถัดไปให้ใช้เลขเวอร์ชันและ tag ใหม่

`package.json` ต้องเป็น `2.0.0`, มี `releases/2.0.0.md` และ tag `v2.0.0` ต้องชี้ไปยัง commit ที่มีไฟล์ทั้งสองนี้แล้ว การตั้งชื่อ commit หรือสร้าง tag เพียงอย่างเดียวไม่เปลี่ยนเวอร์ชันแอป

workflow เพิ่ม job `validate` เพื่อตรวจ tag, package version และ release notes ก่อนเริ่ม native build ทั้งสามระบบ ส่วนแต่ละ build ยังตรวจ production config, tests และ native binaries แล้วเปิดแอปที่แพ็กจริงก่อนอัปโหลด

หลัง push commit และ tag ให้เปิด Actions → **Hosted release to T2ETECH Store (manual, uses GitHub quota)** → Run workflow แล้วเลือก **`v2.0.0`** ต้องเริ่ม run ใหม่จาก tag ที่ถูกต้อง การ Re-run ของ run ที่ล้มจาก commit เก่าไม่เปลี่ยน source snapshot ของ run นั้น

รอบ `38080643479` ของ `v2.0.0` ล้มที่ `release:check` เนื่องจาก package ยังเป็น `1.0.1`; upload ถูกข้ามและไม่มี installer ถูกส่งจากรอบนั้น การแก้ tag ของรอบที่ยังไม่เผยแพร่ต้องตรวจ SHA เดิมก่อนอัปเดต ห้ามย้าย tag หรือแทนที่ไฟล์ของเวอร์ชันที่เผยแพร่แล้ว

เมื่อ Mac ARM64, Mac Intel และ Windows X64 ผ่านครบ upload job จะส่งทั้งสาม installer เข้า Store ผ่าน OIDC และขอตรวจ SHA-256 ฝั่ง server จากนั้นรอ release เป็น **READY** ใน Store Admin การ Publish ใช้ขั้นตอน Admin เดิม; CI ไม่มีสิทธิ์ Publish

เนื้อหา manual ของ `1.0.1` ด้านล่างเป็นประวัติและทางเลือกสำหรับรอบที่ไม่ต้องการใช้ hosted runners ส่วน release ใหม่ให้ใช้ไฟล์ที่ build และทดสอบจาก source ของเวอร์ชันนั้นเท่านั้น

## วิธี manual เพื่อไม่ใช้ GitHub-hosted CI

เครื่องที่เจ้าของมีตอนนี้คือ Mac Apple Silicon: build ARM64 ในเครื่องได้ ส่วน Mac Intel 1.0.1 ดึงไฟล์จากรอบที่ build และทดสอบผ่านแล้วมาใช้ โดยตรวจ SHA-256 ตรงกับ manifest เดิม ไม่มีการรัน hosted CI เพิ่ม Windows ยังไม่พร้อมเผยแพร่ สำหรับเวอร์ชันถัดไปต้อง build และทดสอบ Intel/Windows ใหม่ด้วย environment ของแต่ละระบบ ดูแหล่งที่มาของไฟล์ชุดนี้ที่ `docs/manual-release-acceptance-1.0.1.json`

ตั้งแต่ 10 ตุลาคม 2026 workflow ของ Precut ไม่รันเมื่อ push, pull request หรือสร้าง tag อีกต่อไป hosted checks/release เหลือ `workflow_dispatch` เท่านั้น **อย่ากด Run workflow หากไม่ต้องการใช้โควต้า hosted runners** การ build/test ในเครื่องไม่ใช้นาที GitHub Actions ไม่ได้เปลี่ยน budget, payment method หรือความเป็น private ของ repository

### Build ในเครื่อง

ใช้ Node 24.21.0 และ pnpm 11.5.2 พร้อม `product.config.json` production ของ PC แล้วรันในโฟลเดอร์ Precut:

```sh
pnpm install --frozen-lockfile
# Windows x64 หรือ Mac Intel: สร้าง native tools ด้วยคำสั่งนี้
node scripts/bootstrap-native.mjs
# Mac Apple Silicon: ใช้ native/darwin-arm64 ที่เตรียมไว้ใน workspace นี้
pnpm models:prepare
pnpm release:build
pnpm fixtures:prepare
node scripts/release-smoke.mjs
pnpm release:manual
```

บน Windows ต้องมี Git, CMake และ Visual Studio Build Tools ที่ติดตั้ง C++ workload; Mac Intel ต้องมี Xcode command line tools/CMake ดู `docs/BUILDING.md` และอย่าใช้ bootstrap Intel/Windows บน Mac ARM64 ตัว script จะปฏิเสธ platform ที่ไม่รองรับ

ไฟล์สำหรับลูกค้าอยู่ใน `out/`: `precut-1.0.1-mac-arm64.dmg`, `precut-1.0.1-mac-x64.dmg` หรือ `precut-1.0.1-win-x64.exe` ตามเครื่องที่ build โดยมี `artifacts-<platform>-<arch>.json` เก็บ SHA-256/ขนาดไฟล์ของ build เดียวกัน ต้องทดสอบแต่ละระบบจริงก่อนอ้างว่ารองรับครบสามระบบ Windows fix ล่าสุดยังรอยืนยันบน Windows

### ระบบ manual ของ Store

เพิ่ม **Admin → Releases → นำเข้า release จาก R2** แล้ว โดยใช้ Admin session และการยืนยันตัวตนใหม่ ไม่ต้องใช้ GitHub OIDC เส้นทาง CI เดิมยังตรวจ repository/workflow/tag/commit ตามเดิม `pnpm release:upload` เป็นคำสั่งสำหรับ CI เท่านั้น สำหรับ manual ใช้ `pnpm release:manual` และฟอร์ม Admin

การอัปโหลดไฟล์ไว้ใน private R2 เพียงอย่างเดียวยังไม่เปลี่ยน download/latest ของ Store ต้องนำเข้า manifest ใน Admin → ตรวจไฟล์จริง → READY → Publish ฟอร์มคำนวณ object key และแสดงโฟลเดอร์ที่ต้องอัปโหลดให้ ไม่รับ URL หรือ object ของสินค้าอื่น

อีกทางที่ระบบเดิมรองรับคือ self-hosted GitHub runner บนเครื่องของเจ้าของ ซึ่งยังใช้ OIDC ได้โดยไม่ใช้ GitHub-hosted compute แต่ต้องมีเครื่องของแต่ละระบบและควบคุมพื้นที่ artifacts/storage ด้วย อย่าเปลี่ยน repository เป็น public เพียงเพื่อใช้ฟรีโดยไม่ตั้งใจเผยแพร่ source

### นำไฟล์ 1.0.1 ขึ้น Store แบบ manual

1. เปิด Store Admin → Releases → นำเข้า release จาก R2 แล้วเลือก `out/manual-release.json` ที่เตรียมไว้ ตรวจว่าเป็น PC 1.0.1, STABLE และมี MACOS/ARM64 กับ MACOS/X64
2. เปิด Cloudflare → R2 → `t2etech-store-releases` (private, Standard storage) สร้างโฟลเดอร์ของแต่ละไฟล์ตามฟอร์ม หรือคัดลอกจาก `out/r2-upload-instructions.txt` แล้วอัปโหลดทั้ง `precut-1.0.1-mac-arm64.dmg` และ `precut-1.0.1-mac-x64.dmg` โดยคงชื่อไฟล์เดิม แต่ละไฟล์ใช้โฟลเดอร์ SHA-256 ของตัวเอง
3. ตรวจ Content-Type ของทั้งสอง object เป็น `application/x-apple-diskimage` ให้ตรง manifest ถ้า dashboard ตั้งเป็น `application/octet-stream` ให้แก้ HTTP metadata ของ object ก่อนนำเข้า ไม่อัปโหลด ZIP หรือ JSON เป็น installer
4. กลับ Admin ติ๊กอัปโหลดครบ ระบุเหตุผลและยืนยันตัวตน กดนำเข้าและตรวจไฟล์
5. รีเฟรชจนเป็น READY และ artifact VERIFIED แล้วกด Publish release ยืนยัน PUBLISH
6. ทดสอบดาวน์โหลดและติดตั้งจากหน้าร้าน เลือก Apple Silicon (macOS 27 ขึ้นไป) หรือ Intel (macOS 15 ขึ้นไป) ให้ตรงกับเครื่อง ตัวไฟล์ยัง unsigned จึงอาจมีคำเตือนของระบบ ส่วน checkout ต้องผ่าน readiness แยกจาก trial download

ชุด 1.0.1 ในเครื่องรวม manifests แล้วด้วยคำสั่งนี้ ไม่ต้อง build Intel ใหม่หรือกด GitHub Actions:

```sh
pnpm release:manual --manifest out/artifacts-darwin-arm64.json --manifest out/artifacts-darwin-x64.json
```

สำหรับ version ถัดไป เปลี่ยน `package.json` เช่น 1.0.2 และเขียน `releases/1.0.2.md` → build → packaged smoke → `pnpm release:manual` → อัปโหลด R2 → import → READY → Publish ห้ามเขียนทับ version เดิม

หากจะเพิ่ม Mac Intel/Windows ใน release เดียว ต้องมี build และผล smoke ของแต่ละระบบในเครื่อง แล้วรวม manifests ด้วย `pnpm release:manual --manifest out/artifacts-darwin-arm64.json --manifest out/artifacts-darwin-x64.json --manifest out/artifacts-win32-x64.json` ไม่เอาไฟล์ ARM64 ไปเปลี่ยนชื่อเป็น x64

### การอัปเดตตัวแอป

ไฟล์รุ่นใหม่ต้องใช้เลขเวอร์ชันใหม่ ห้ามเขียนทับ installer ของ version ที่เผยแพร่แล้ว หลัง Store ลงทะเบียนและ Publish release ใหม่ หน้า download จะใช้ไฟล์ใหม่ตาม platform/architecture แอป unsigned รุ่นนี้ใช้การดาวน์โหลดและติดตั้งทับด้วยมือผ่าน Store; การวางไฟล์ใน R2 ไม่ใช่ automatic installation ในแอป

R2 Standard มี free tier แบบจำกัด (10 GB-month, 1 ล้าน Class A และ 10 ล้าน Class B ต่อเดือน, egress ฟรี) ดู https://developers.cloudflare.com/r2/pricing/ จึงไม่รับประกันฟรีไม่จำกัดเมื่อสะสม installer หลายรุ่น สำหรับ GitHub ใช้ budget ที่เปิด Stop usage when budget limit is reached และตรวจยอด Net/invoice; ส่วน R2 ต้องตรวจ storage/operations ให้ไม่เกิน free tier ไม่อ้างว่ามี hard spending cap ของ R2 โดยไม่ได้ตรวจ Gross metered usage ใน GitHub ไม่ใช่ยอดสุทธิหลังส่วนลด

การตรวจ checksum ยังใช้ Trigger.dev ของ deployment เดิม แผน Free มีเครดิต $5 ต่อเดือนและหยุดงานเมื่อหมดเครดิต ดู https://trigger.dev/pricing ไม่ได้ทำให้ backend ทุกบริการฟรีไม่จำกัด ถ้าใช้ Vercel Hobby ต้องทราบว่าแผนนี้จำกัดการใช้งานส่วนบุคคลที่ไม่ใช่เชิงพาณิชย์ ดู https://vercel.com/docs/plans/hobby ก่อนเปิดขายจริง คู่มือนี้ไม่ได้เปลี่ยนแผนหรือวิธีชำระเงินของบริการใด

## 1. สิ่งที่เตรียมแล้วและสิ่งที่ต้องทำก่อนเปิดขาย

ชุดที่เผยแพร่เดิมคือ **1.0.0 สำหรับ Mac Apple Silicon / ARM64** ส่วนชุด manual 1.0.1 ที่เตรียมในเครื่องประกอบด้วย:

- `out/precut-1.0.1-mac-arm64.dmg` — Apple Silicon บน macOS 27 ขึ้นไป
- `out/precut-1.0.1-mac-x64.dmg` — Intel บน macOS 15 ขึ้นไป
- `out/manual-release.json` — manifest รวมสอง installer สำหรับ Store Admin
- `out/r2-upload-instructions.txt` — object key, Content-Type, ขนาดและ SHA-256 สำหรับแต่ละไฟล์
- `docs/release-results-1.0.1-darwin-arm64.json` และ `docs/release-results-1.0.1-darwin-x64.json` — ผลทดสอบแอปที่แพ็กจริง
- `docs/manual-release-acceptance-1.0.1.json` — แหล่งที่มาและขอบเขตการทดสอบของชุด manual

แอปใช้ public `product.config.json` สำหรับสินค้า `PC`, เวอร์ชันจาก `package.json`, icon/logo ที่ให้มา และข้อความ Made by t2etech แล้ว ชื่อแอปและที่เก็บข้อมูลคงเดิมเมื่ออัปเดต ไม่มี private key หรือ client secret ใน config นี้

การทดสอบบนเครื่องนี้ผ่านการเปิดแอปจริง, config production, import, วิเคราะห์เสียงด้วย native tools ที่อยู่ในแอป, waveform และอ่านโปรเจกต์หลังปิดเปิดใหม่ ยังต้องทดสอบ **login → trial export → ซื้อ → activate → export → ปิดเปิดใหม่** กับ Store ที่ตั้งค่าเสร็จแล้วก่อนเปิดขายจริง ผล smoke ไม่ได้ยืนยันการซื้อหรือใช้โควต้า

ตัวติดตั้งนี้ไม่ลง Developer ID/Windows publisher และไม่ notarize สามารถส่งเข้า backend ที่ปรับแล้วได้; ลูกค้าอาจพบคำเตือนของระบบปฏิบัติการ การอัปเดตแบบ unsigned ใช้ดาวน์โหลดและติดตั้งเองจาก Store ส่วนการติดตั้งอัตโนมัติที่ตรวจผู้ลงลายเซ็นยังต้องมี signer pins

**Source ขึ้น GitHub และ customer installer อัปโหลดเข้า private R2 แล้ว**:
[release run 37942852278](https://github.com/Soravit-Ice/Precut/actions/runs/37942852278)
ผ่านเมื่อ 9 ตุลาคม 2026 และ Trigger.dev Production ตรวจไฟล์จริงสำเร็จ:
`precut-1.0.0-mac-arm64.dmg` เป็น **VERIFIED**, release `PC 1.0.0` เป็น
**PUBLISHED** และ trial-installer API คืนไฟล์ ARM64 `1.0.0` ได้แล้วเมื่อ 9 ตุลาคม
ส่วน `1.0.1` เตรียมสำหรับเผยแพร่ Mac สองระบบแบบ manual โดยยังไม่รวม Windows และยังไม่ได้อัปโหลด/Publish รุ่นใหม่

ผล Mac Intel: [candidate 37962923865](https://github.com/Soravit-Ice/Precut/actions/runs/37962923865) ทดสอบบน macOS 15.7.9, เปิดแอป 2.944 วินาที, ถอดเสียง 22 คำ, waveform และ restart ผ่าน ตัวแอปประกาศขั้นต่ำ macOS 15.0.0 อย่าอ้างว่ารองรับ Windows จน CI ผ่านและเผยแพร่ release ใหม่

### สถานะ 10 ตุลาคม 2026 และการทำต่อ

Windows เปิดแอปและ import ได้ แต่ [diagnostic run 37964187634](https://github.com/Soravit-Ice/Precut/actions/runs/37964187634) ค้างที่ `Choosing the recording language` เพิ่มการจำกัด speech threads ตาม CPU และ native language/pipe smoke แล้ว; typecheck และ 90 tests ในเครื่องผ่าน แต่ยัง **ไม่ได้ยืนยัน fix นี้บน Windows**

[รอบใหม่ 37966185274](https://github.com/Soravit-Ice/Precut/actions/runs/37966185274) ไม่เริ่ม runner เพราะ GitHub แจ้งปัญหา account payments/spending limit ให้เจ้าของตรวจ Settings → Billing & licensing → Budgets and alerts ของ **Actions** และสถานะ payment ดู [เอกสาร GitHub](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows) ไม่ใช่บั๊ก R2 และไม่ใช่ผลทดสอบแอป

เจ้าของเลือกไม่ใช้ hosted runners จึงไม่ต้องเพิ่ม spending limit หรือแก้ billing เพื่อปล่อยรุ่น Mac ปัจจุบัน build และ packaged smoke ของ Mac ARM64 1.0.1 ในเครื่องผ่านแล้ว (import, ถอดเสียง 22 คำ, waveform, restart) และดึง Mac Intel จาก artifact เดิมที่ทดสอบผ่านแล้วพร้อมตรวจ checksum ไฟล์ทั้งสองอยู่ใน `out/` Windows fix ยังรอยืนยันบน Windows ไม่มี tag `v1.0.1` และยังไม่อัปโหลด/Publish 1.0.1 ระบบ import manual, DB migration และ worker verification ขึ้น production แล้วเมื่อ 10 ตุลาคม 2026

ก่อนส่งเวอร์ชันถัดไป ตรวจว่า Vercel Production ใช้ `TRIGGER_SECRET_KEY`
ของ Trigger.dev **Production** และ redeploy หลังบันทึก key; development key
ไม่ส่งงานไป worker production อย่าใส่ key นี้ใน desktop config หรือ GitHub
variables ของ Precut เมื่อไฟล์อยู่ใน R2 และค้าง VERIFYING ให้แก้ worker/outbox
แทนการอัปโหลดซ้ำหรือย้าย tag

การที่ release เป็น READY ยืนยันความถูกต้องของไฟล์ ไม่ใช่ผลทดสอบการรับเงินจริง
หลัง redeploy Vercel วันที่ 9 ตุลาคม `/healthz` ตอบ 200 แต่ `/readyz` ยังตอบ
503 และ runtime logs ระบุ `configuration` ใน source Store
`approvedLegalCopy` ยังเป็น `null`: การตั้ง `LEGAL_APPROVAL_ID` อย่างเดียวไม่ติดตั้ง
ชุดนโยบายที่อนุมัติ ต้องตรวจและติดตั้ง bundle ตาม
`t2etech-store/docs/legal/README.md` พร้อมตรวจ configuration ให้ `/readyz` ผ่าน
ก่อนเปิดรับเงินจริง ไม่ปิด readiness guard เพื่อให้หน้าแสดงพร้อมขาย

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

เชื่อม repository สำเร็จแล้วใน Store Admin: default branch `main`, source อยู่บน GitHub และ CI ตรวจโค้ดผ่านแล้ว ณ release `2.0.0` repository เป็น public

ค่าที่บันทึกใน Precut → เชื่อมต่อ GitHub:

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

## 4. ตั้งค่า GitHub Actions (ทางเลือกที่ใช้โควต้า hosted runners)

ตั้งค่าใน [Soravit-Ice/Precut](https://github.com/Soravit-Ice/Precut) → Settings → Secrets and variables → Actions → **Variables** แล้ว:

| Variable                         | สิ่งที่ใส่                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `PRECUT_PRODUCT_CONFIG_JSON`     | JSON ทั้งไฟล์ที่ export จาก Store สำหรับ PC เป็น public config       |
| `PRECUT_NATIVE_MAC_ARM64_URL`    | GitHub API URL ของ native ZIP ใน private prerelease                  |
| `PRECUT_NATIVE_MAC_ARM64_SHA256` | ค่า hash จาก `out/native-darwin-arm64.zip.sha256` เฉพาะตัวเลข 64 ตัว |

native ZIP ต้องมี `bin/`, `lib/`, `manifest.json` อยู่ที่ root ไม่ต้องใส่โฟลเดอร์ native ครอบอีกชั้น ชุดนี้อัปโหลดไว้ใน private prerelease `native-darwin-arm64-78605daab575` แล้ว:

- API URL: `https://api.github.com/repos/Soravit-Ice/Precut/releases/assets/624818295`
- SHA-256: `78605daab575120b738353a19bd9da9ddd207c5cc0c6edcde88fd7bf98b0010c`

workflow ส่ง GitHub token ที่มี `contents: read` เฉพาะ GitHub API ของ repository นี้ แล้วดาวน์โหลด signed asset URL โดยไม่ส่ง token ต่อ ตรวจ hash ก่อนแตกไฟล์ ไม่ต้องเปิด native archive เป็น public หรือเพิ่ม PAT secret

ค่านี้เป็น build tools สำหรับ CI **ไม่ใช่ไฟล์ DMG ให้ลูกค้าซื้อ** และต้องจัด source/notices สำหรับ native distribution ด้วย

target Apple Silicon ใช้ โดยใช้ runner `xcode-27` เพราะ FFmpeg ใน native archive นี้มี deployment target macOS 27 (whisper-cli 26.2) ใช้ macOS 15 runner จะรันไม่ได้ แอปกำหนด `minimumSystemVersion: 27.0.0` ให้ตรงกับไฟล์จริง ดู [runner image](https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md)

หากต้องการรองรับ macOS รุ่นเก่า ต้อง rebuild FFmpeg, dependencies และ speech tools ด้วย deployment target ที่ต้องการ แล้วทดสอบบน OS นั้นก่อนลด minimumSystemVersion; การเปลี่ยนชื่อ runner หรือแก้เลข minimum เพียงอย่างเดียวไม่ทำให้ native tools รองรับ

ค่าปัจจุบันสำหรับ release ใหม่รวม 3 ระบบ (บันทึก `PRECUT_RELEASE_TARGETS` แล้ว):

```json
[
  {
    "runner": "xcode-27",
    "platform": "darwin",
    "arch": "arm64",
    "bundle_url": "PRECUT_NATIVE_MAC_ARM64_URL",
    "bundle_sha": "PRECUT_NATIVE_MAC_ARM64_SHA256"
  },
  {
    "runner": "macos-15-intel",
    "platform": "darwin",
    "arch": "x64",
    "build_native": true
  },
  {
    "runner": "windows-2025",
    "platform": "win32",
    "arch": "x64",
    "build_native": true
  }
]
```

Intel/Windows ใช้ `scripts/bootstrap-native.mjs`: ดาวน์โหลด FFmpeg/FFprobe 9.0.2 จาก versioned URL ที่ pin SHA-256 ไว้ แล้ว compile whisper.cpp 1.9.5 พร้อม patch ของ Precut บน runner ระบบนั้น ไม่ต้องใส่ native URL/hash variables อีกสองชุด และไม่ใช้ archive ARM64 กับ x64

ตัวติดตั้ง Intel กำหนดขั้นต่ำ macOS 15 แยกจาก ARM64 ที่ยังเป็น macOS 27; `native:verify` ตรวจ architecture และ deployment target ของ native Mach-O ทุกไฟล์ก่อน packaging ข้อมูลแหล่งที่มาและ binary hashes อยู่ใน `licenses/native-provenance.json` ในตัวติดตั้ง

workflow เปิดแอปที่แพ็กจริงทุก target แล้วทดสอบ analysis/restart; upload job เริ่มเมื่อ **ทั้ง 3 build ผ่าน** และ merge manifest ต้องมี installer ครบ 3 เป้าหมาย ก่อนส่ง release เดียวไป Store

สร้าง environment **`release-upload`** แล้ว จำกัด tag ที่อนุญาตเป็น `v*` ส่วน reviewer/wait timer ไม่ได้เปิดเพราะ plan ปัจจุบันไม่รองรับ protection ดังกล่าว workflow ใช้ OIDC จึงไม่ต้องใส่ Store API token/Cloudflare secret/Supabase service role ใน repo นี้

## 5. ประวัติ release 1.0.0 และเส้นทาง hosted CI เดิม

Source ขึ้น `main` ใน GitHub แล้ว ไม่ต้อง `git init` หรือเพิ่ม remote ซ้ำ Git authentication ใช้บัญชีเจ้าของ repository ที่ตั้งค่าในเครื่องนี้

`.gitignore` กัน `.env*`, `*.key`, `product.config.json`, native outputs, `out/`, `.tools/`, cache และ node_modules แล้ว อย่า force-add secrets หรือ native binaries ลง source repo `product.config.json` ส่งผ่าน public variable ในขั้นก่อนหน้า

รอบทดสอบบน GitHub ผ่านแล้ว: [Installer candidates 37927034810](https://github.com/Soravit-Ice/Precut/actions/runs/37927034810) — 88 tests, build DMG/ZIP, เปิด packaged app วิเคราะห์เสียงและทดสอบ restart ผ่าน ดาวน์โหลดไฟล์จาก Artifacts ในหน้านี้ ผลและ SHA ของ CI อยู่ที่ `docs/github-installer-acceptance-1.0.0.json` (hash ของ CI ต่างจาก local build ให้ใช้ manifest ที่มากับไฟล์เสมอ)

workflow **Precut installer candidates** แพ็กตัวติดตั้งและทดสอบแอปจริงตาม targets ที่ตั้งไว้ เก็บ DMG/manifest/acceptance report เป็น artifact และไม่มีสิทธิ์อัปโหลดหรือ Publish เข้า Store เป็นทางเลือกที่ใช้โควต้า hosted runners ไม่ต้องกด Run workflow สำหรับขั้นตอน manual ในคู่มือนี้

tag `v1.0.0` ถูกสร้างและส่งแล้วที่ commit
`535f417197670c80339444b0979b6920d62fdc4b` ห้ามสร้างทับ ย้าย หรือ force-push
tag นี้ ขณะนี้ให้ไปขั้นทดสอบด้านล่าง; เวอร์ชันถัดไปใช้เลขและ tag ใหม่
ตามหัวข้ออัปเดต

เส้นทาง hosted CI เดิม (ใช้โควต้า/อาจมีค่าใช้จ่าย): เปิด GitHub → Actions → **Hosted release to T2ETECH Store (manual, uses GitHub quota)** เลือก tag ที่ต้องการแล้ว Run workflow จึงจะเริ่ม งานไม่รันอัตโนมัติจาก tag แล้ว:

1. ติดตั้ง dependency แบบ frozen lockfile และตรวจ SDK archive
2. คืน public config, ตรวจ package version ตรง tag, ดาวน์โหลด native bundle พร้อมตรวจ hash
3. ตรวจ type/tests/native tools แล้วแพ็กแอป
4. เปิดแอปที่แพ็กจริงและทดสอบ import/analysis/restart
5. เก็บ installers/manifest และ acceptance report เป็น Actions artifacts
6. ขออนุมัติ `release-upload` ถ้าตั้ง reviewer ไว้
7. ใช้ OIDC อัปโหลดเข้า private R2 และขอ server verification

ผล upload จะเป็น `submittedForVerification: true`, `published: false` ตรวจสอบ hash/ขนาดของ artifact ที่ได้จาก **CI**; hash อาจต่างจาก DMG ที่ build ในเครื่องเพราะเวลา/packaging metadata อย่าใช้ manifest local กับไฟล์จากอีก build

workflow_dispatch ใช้ได้เมื่อเลือก **tag ของเวอร์ชันใหม่ เช่น `v1.0.1`**; เลือก `main` จะถูก `release:check` ปฏิเสธ หากอัปโหลดเสร็จแล้วให้ตรวจ release ที่มีอยู่ใน Store ก่อนกด rerun การ upload เป็นขั้นที่ผูก session ไม่ใช่ปุ่ม retry verification

ปัจจุบัน DMG local นำเข้า Store ผ่านฟอร์ม manual ได้แล้วโดยไม่ใช้ GitHub OIDC แต่การวางไฟล์ใน R2 เพียงอย่างเดียวยังไม่สร้าง release หรือ Publish

### ถ้า upload ได้ HTTP 403 หรือ Cloudflare challenge

ตรวจ Cloudflare → `t2etech.com` → Security → Analytics → Events ให้เวลา, host `store.t2etech.com` และ path `/internal/v1/releases/start` ตรงกับ job ถ้า Service เป็น **Bot fight mode** / Action เป็น **Managed Challenge** คำขอยังไม่ถึง backend และการแก้ repository binding หรือ build แอปใหม่ไม่ช่วย

Bot Fight Mode ของ Free plan ทำข้อยกเว้นด้วย WAF Skip rule ไม่ได้ ตาม [เอกสาร Cloudflare](https://developers.cloudflare.com/bots/troubleshooting/false-positives/) การปิดฟีเจอร์นี้มีผลทั้ง zone และต้องให้เจ้าของอนุมัติ; อีกทางคือใช้ Super Bot Fight Mode ที่รองรับข้อยกเว้นสำหรับ API โดยตรวจ plan/cost ก่อน อย่าปิดการตรวจ OIDC, ขยายสิทธิ์ repository หรือใส่ token ใน URL เพื่อแก้ challenge

เมื่อแก้การป้องกันที่หน้าด่านแล้ว และยังไม่มี release session/ไฟล์ที่อัปโหลดสำเร็จ ให้ใช้ **Re-run failed jobs** ใน run เดิมเพื่อส่ง installer จาก artifact เดิม ไม่ต้องย้าย tag หรือเปลี่ยนเวอร์ชัน การ retry upload ใช้ tooling จาก trusted `main` ส่วน metadata, installer และ commit ยังคงเป็นของ tag เดิม

## 6. Publish และทดสอบก่อนเปิดขาย

1. Admin → Releases → ตรวจสินค้า `PC`, เวอร์ชันใหม่ `1.0.1`, channel **STABLE** และ installer **MACOS/ARM64**, **MACOS/X64** ไม่รวม Windows ที่ยังไม่ผ่านการทดสอบ
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

ถ้าเป็น bugfix ใช้ `1.0.2`; เพิ่มความสามารถที่เข้ากันได้ใช้ `1.1.0` ทุก build ที่เผยแพร่ต้องใช้เลขใหม่ ไม่แทนที่ไฟล์ที่ขายแล้วภายใต้ version เดิม

```sh
# ใช้ Node 24.21.0 / pnpm 11.5.2 ตาม docs/BUILDING.md
pnpm version 1.0.2 --no-git-tag-version
# เขียน releases/1.0.2.md อธิบายการเปลี่ยนแปลง
pnpm release:check
pnpm typecheck
pnpm test
git add package.json pnpm-lock.yaml releases/1.0.2.md apps packages scripts
git commit -m "Release Precut 1.0.2"
git push origin main
git tag -a v1.0.2 -m "Precut 1.0.2"
git push origin v1.0.2
```

สำหรับเส้นทาง hosted CI เดิม ต้องสั่ง Run workflow ด้วยมือก่อน แล้วรอ VERIFIED/READY → กด Publish release ใหม่เหมือนเดิม สินค้าที่ PUBLISHED แล้วไม่ต้องสร้างใหม่, ไม่ต้องเปลี่ยน OAuth Client ID, Product Code หรือ policy เพราะแค่แก้เวอร์ชันแอป หาก config ฝั่ง Store เปลี่ยนให้ export ใหม่และอัปเดต GitHub variable ก่อน tag

ทดสอบ upgrade จากตัวติดตั้ง `1.0.1` **ที่มีโปรเจกต์และ activation จริง** ไป `1.0.2`: บันทึกงานและปิดแอป, ติดตั้งทับ Precut เดิมใน Applications, เปิดใหม่ ตรวจงาน/แคช/บัญชี/สิทธิ์และ export ข้อมูลแอปใช้ `appData/com.t2etech.precut` เดิม จึงอย่าลบโฟลเดอร์นี้ระหว่างอัปเดต บน Windows ตัว NSIS กำหนดไม่ลบ AppData เมื่อ uninstall; ต้องทดสอบบน Windows เมื่อมี installer แล้ว

แอป unsigned รุ่นนี้: Settings → About Precut → Check for updates จะแสดงทางไป Store → ดาวน์โหลดเวอร์ชันใหม่ → ปิดแอปและติดตั้งทับเอง ไม่อ้างว่ารุ่นปัจจุบันเป็นรุ่นล่าสุดจาก server หากเพิ่ม signer pins ในอนาคตจึงเปิดเส้นทาง SDK ตรวจลายเซ็นและติดตั้ง verified update

ถ้ารุ่นใหม่มีปัญหา ใช้ Admin → Releases → Yank รุ่นนั้นตาม confirmation ในหน้าจอ แล้วทดสอบว่าหน้า download/latest กลับไปใช้รุ่นที่ยังเผยแพร่ได้ ห้ามแก้ไฟล์ installer เก่าที่ immutable และอย่า rollback ข้อมูล SQLite ด้วยการลบข้อมูลลูกค้า

## คำสั่ง build ในเครื่องนี้

```sh
cd /Users/soravit_ice/Desktop/Brand/Precut
export PATH="$PWD/.tools/node-v24.21.0-darwin-arm64/bin:$PATH"
pnpm release:build
pnpm fixtures:prepare
node scripts/release-smoke.mjs
pnpm release:manual
```

`release:build` ปฏิเสธ development/test overrides และ tag ที่ไม่ตรง version; manifest เลือกชื่อ installer ตรงเวอร์ชันเท่านั้น ไม่ปะปน RC เก่า โหมด local ใช้ `pnpm release:manual` และ Store Admin ไม่ต้องมี OIDC สำหรับ upload
