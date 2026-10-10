# แก้ปัญหา Windows export ค้างที่ Starting

## สาเหตุที่พบในโค้ด

Precut รุ่นเดิมเขียนไฟล์ยืนยัน export แล้วเปิดไฟล์นั้นแบบอ่านอย่างเดียว (`r`) เพื่อเรียก `fsync` ก่อนเริ่ม render บน Windows การ flush ใช้ `FlushFileBuffers` ซึ่งต้องมีสิทธิ์เขียน จึงล้มได้ทันที แม้ติดตั้งและ sign in สำเร็จแล้ว

ไฟล์ยืนยันชั่วคราว `<operationId>.receipt.json.tmp` จึงค้างอยู่ แต่ไฟล์ยืนยันหลักยังไม่ถูกสร้าง ระบบเดิมถือว่าผลไม่แน่นอนและกัน trial reservation ไว้ ข้อความ “Restore its export destination and restart Precut” เป็นข้อความกู้คืนทั่วไป ไม่ได้ยืนยันว่าผู้ใช้ย้ายโฟลเดอร์ปลายทาง

ข้อผิดพลาดนี้สอดคล้องกับภาพที่แสดง Starting และมี trial เหลือ 2 ครั้ง แต่การยืนยันเหตุการณ์บนเครื่องลูกค้าต้องตรวจ receipt หรือ diagnostic ของเครื่องนั้นด้วย

อ้างอิงข้อกำหนดสิทธิ์เขียน: [Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)

## การแก้ไข

- เขียนและ flush receipt ด้วย handle แบบเขียนตัวเดียวกัน แล้วปิด handle เสมอ รวมถึงเมื่อเกิดข้อผิดพลาด
- กู้คืนงานเก่าที่มีหลักฐานชัดว่า initial receipt ยังไม่ผ่านขั้น rename และยังไม่มีการสร้างผลลัพธ์ ให้ SDK release reservation ผ่าน Store เมื่อออนไลน์
- เก็บ reservation ต่อเมื่อหลักฐานยังไม่พอ หรืออาจมีผลลัพธ์ถูกส่งออกไปแล้ว
- แสดง “ส่งออกไม่สำเร็จ” เมื่อ job ล้ม และแปลคำแนะนำการกู้คืนเป็นภาษาไทย

## ขั้นตอนให้ผู้ใช้ Windows

1. ปิด Precut ให้หมด ติดตั้ง Windows build ที่มีการแก้นี้ แล้วเปิดแอปด้วยบัญชี Windows เดิม การติดตั้งเวอร์ชันเก่าซ้ำยังมีบั๊กเดิม
2. เชื่อมต่ออินเทอร์เน็ต เปิดโปรเจกต์เดิมและหน้า Export เพื่อให้ SDK ตรวจและคืน reservation ของงานที่ยังไม่เริ่ม กรณีนี้ไม่ต้องคืนโฟลเดอร์ปลายทางเพื่อพิสูจน์ผล
3. ลอง export ไปยังโฟลเดอร์ในเครื่องที่เขียนได้ เช่น Videos เริ่มจากคลิปสั้น พร้อมตรวจ MP4 และ SRT
4. หากยังรายงานผลไม่แน่นอนและเคยเริ่ม render ไปแล้ว ให้เชื่อมต่อไดรฟ์เดิมหรือคืนโฟลเดอร์ปลายทางเดิม ปิดและเปิด Precut ใหม่ แล้วเปิดหน้า Export ขณะออนไลน์เพื่อให้ตรวจผลลัพธ์และ settle reservation
5. หากยังไม่สำเร็จ เก็บข้อมูลจาก Settings → Export diagnostics พร้อมรุ่นแอป และตรวจ receipt ของงานที่มีปัญหา ข้อมูลอยู่ใน `%APPDATA%\com.t2etech.precut\projects\<projectId>\export-cache` ใช้ข้อมูลนี้แยก startup failure, destination failure และ partial publication

ไม่ควรลบ `license-sdk.enc`, receipt หรือข้อมูลโปรเจกต์เพื่อปลดล็อก เพราะจะทำให้หลักฐานกู้คืนหาย และการลบข้อมูลในเครื่องไม่ได้ยกเลิก reservation ที่ Store

## การตรวจสอบก่อนส่งตัวติดตั้ง

ใช้ Node 24.21.0 / pnpm 11.5.2 บน Windows x64 ตาม `docs/BUILDING.md` รัน `pnpm typecheck`, `pnpm test`, `pnpm build` และขั้นตอน native/installer ปกติ ทดสอบ export จริงทั้ง trial และ MP4 พร้อม SRT รวมถึงอัปเดตจากรุ่นที่มี initial `.tmp` ค้าง ตรวจว่า reservation ถูก release เพียงครั้งเดียวและงานสำเร็จถูก commit เพียงครั้งเดียว

การทดสอบอัตโนมัติจำลอง Windows read-only flush และ Store challenge พร้อม device signature รวมถึง render MP4 จริงเมื่อมี bundled native tools การทดสอบเหล่านี้ยังไม่ใช่การยืนยันตัวติดตั้ง Windows บนเครื่องลูกค้า
