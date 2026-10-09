import { useState } from "react";
import {
  Check,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  LoaderCircle,
  Download,
  LogOut,
} from "lucide-react";
import { Button, Dialog, Input } from "../components/ui/primitives";
import { call, useStore } from "../lib/store";
import { SignInButton } from "./SignInDialog";
import { appVersion } from "../lib/app-info";
import type { LicenseStatus } from "../../../../packages/shared/src/contracts";

export function AccountSettings() {
  const { licence, settings, set } = useStore();
  const th = settings.language === "th";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"key" | "deactivate" | "logout">();
  const [key, setKey] = useState("");
  const waiting =
    licence?.loginPhase === "waiting" || licence?.loginPhase === "completing";
  const checked = licence?.verification === "verified";
  const active = Boolean(licence?.valid && licence.activated);
  const trial = licence?.tier === "FREE" && licence.valid;
  async function run(
    method:
      | "license.status"
      | "license.activate"
      | "license.deactivate"
      | "license.logout",
    input = {},
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await call<LicenseStatus>(method, input);
      set({ licence: result });
      setAction(undefined);
      setKey("");
    } catch {
      setError(
        method === "license.activate"
          ? th
            ? "เปิดใช้งานไม่ได้ ตรวจว่าบัญชีนี้ซื้อ Precut แล้ว หรือคีย์ถูกต้อง และลองอีกครั้ง"
            : "Activation could not finish. Check your Precut purchase or licence key and retry."
          : th
            ? "ดำเนินการไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง"
            : "This action could not finish. Check your connection and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const notice =
    licence?.mode === "pending-config"
      ? licence.configurationError === "DEVICE_STORAGE_INVALID"
        ? th
          ? "แอปเปิดข้อมูลสิทธิ์ที่เข้ารหัสไว้ไม่ได้ ข้อมูลเดิมยังอยู่ อาจเกิดจากเปลี่ยนจาก Electron รุ่นพัฒนาเป็นแอปติดตั้ง ต้องกู้การเชื่อมบัญชีก่อน"
          : "This app cannot open the encrypted licence storage. It is preserved. Switching from the development runner can require account storage migration."
        : licence.configurationError === "SDK_STORAGE_IN_USE"
          ? th
            ? "ปิด Precut หรือ Electron อีกหน้าต่าง แล้วเปิดแอปนี้ใหม่"
            : "Close the other Precut or Electron session, then restart this app."
          : licence.configurationError === "SECURE_STORAGE_UNAVAILABLE"
            ? th
              ? "ระบบเก็บข้อมูลที่ปลอดภัยยังไม่พร้อม ปลดล็อก Keychain แล้วเปิดแอปใหม่"
              : "Secure storage is unavailable. Unlock the system keychain and restart Precut."
            : th
              ? "ยังไม่พบการตั้งค่า Precut ที่ใช้ได้ ตรวจ product.config.json แล้วเปิดแอปใหม่"
              : "A valid Precut configuration is unavailable. Check product.config.json and restart the app."
      : licence?.verification === "unavailable"
        ? th
          ? licence.signedIn
            ? "ยังตรวจสิทธิ์ออนไลน์ไม่ได้ สถานะบัญชียังคงอยู่ กดตรวจสิทธิ์เพื่อลองอีกครั้ง"
            : "ยังตรวจสิทธิ์ออนไลน์ไม่ได้ ตรวจการเชื่อมต่อแล้วกดตรวจสิทธิ์อีกครั้ง"
          : licence.signedIn
            ? "Access could not be verified. Your account connection is retained. Retry the access check."
            : "Access could not be verified. Check your connection and retry the access check."
        : licence?.loginError === "ACTIVATION_PENDING"
          ? th
            ? "เชื่อมบัญชีสำเร็จ แต่ยังเปิดใช้งานสิทธิ์ที่ซื้อไม่ได้ ลองเปิดใช้งานจากบัญชีอีกครั้ง"
            : "Account connected. Purchase activation still needs attention; retry account activation."
          : undefined;
  return (
    <section
      className="settings-section account-section"
      aria-labelledby="account-title"
    >
      <div className="settings-section-title">
        <ShieldCheck size={17} />
        <h2 id="account-title">
          {th ? "บัญชีและสิทธิ์ใช้งาน" : "Account & licence"}
        </h2>
      </div>
      <div className="account-card">
        <div className="account-card-heading">
          <img
            src="./brand/precut-app-icon.png"
            width="52"
            height="52"
            alt=""
          />
          <div>
            <strong>Precut</strong>
            <p>
              {th
                ? "พื้นที่สร้างสรรค์ของคุณ บนเครื่องของคุณ"
                : "Your creative workspace. On your computer."}
            </p>
          </div>
          <span className={`account-badge ${active || trial ? "ready" : ""}`}>
            {active ? <Check size={12} /> : <ShieldCheck size={12} />}
            {active
              ? th
                ? "เปิดใช้งานแล้ว"
                : "Activated"
              : trial
                ? th
                  ? "ทดลองฟรี"
                  : "Free trial"
                : checked
                  ? th
                    ? "ยังไม่มีสิทธิ์"
                    : "No active licence"
                  : th
                    ? "รอตรวจสิทธิ์"
                    : "Check access"}
          </span>
        </div>
        <div className="account-facts">
          <div>
            <span>{th ? "บัญชี T2ETECH" : "T2ETECH account"}</span>
            <strong>
              {waiting
                ? th
                  ? "กำลังรอเบราว์เซอร์"
                  : "Waiting for browser"
                : licence?.signedIn
                  ? th
                    ? "เชื่อมบัญชีแล้ว"
                    : "Connected"
                  : th
                    ? "ยังไม่ได้เข้าสู่ระบบ"
                    : "Not signed in"}
            </strong>
          </div>
          <div>
            <span>{th ? "สิทธิ์ส่งออก" : "Export access"}</span>
            <strong>
              {active
                ? licence?.permanentOffline
                  ? th
                    ? "ใช้งานออฟไลน์ได้"
                    : "Available offline"
                  : th
                    ? "ตามนโยบายที่ซื้อ"
                    : "Purchase policy applies"
                : trial
                  ? th
                    ? "ทดลองฟรี · ใช้อินเทอร์เน็ต"
                    : "Trial · internet required"
                  : th
                    ? "ยังไม่ยืนยัน"
                    : "Not verified"}
            </strong>
          </div>
          <div>
            <span>{th ? "โควตาทดลองที่เหลือ" : "Trial exports remaining"}</span>
            <strong>
              {active
                ? "—"
                : licence?.remaining === undefined
                  ? th
                    ? "ยังตรวจไม่ได้"
                    : "Not yet verified"
                  : `${licence.remaining} ${th ? "ครั้ง" : "exports"}`}
            </strong>
          </div>
        </div>
        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        {licence?.pendingOperations ? (
          <p className="account-notice" role="status">
            {th
              ? "มีงานส่งออกที่รอการกู้คืน เปิดแอปใหม่หลังคืนตำแหน่งไฟล์ส่งออก"
              : "An export is awaiting recovery. Restore its destination and restart Precut."}
          </p>
        ) : null}
        <div className="account-actions">
          <SignInButton />
          {licence?.signedIn && !active && (
            <Button
              disabled={busy || waiting}
              onClick={() => void run("license.activate")}
            >
              {th ? "เปิดใช้งานจากบัญชี" : "Activate purchase"}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={busy || waiting || licence?.mode !== "configured"}
            onClick={() => {
              setError("");
              setAction("key");
            }}
          >
            <KeyRound size={14} />
            {th ? "ใช้คีย์สิทธิ์" : "Use licence key"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || waiting || licence?.mode !== "configured"}
            onClick={() => void run("license.status")}
          >
            <RefreshCw size={14} className={busy ? "signin-spinner" : ""} />
            {th ? "ตรวจสิทธิ์" : "Refresh access"}
          </Button>
        </div>
        {(licence?.signedIn || licence?.activated) && (
          <div className="account-management">
            {licence.activated && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || waiting}
                onClick={() => {
                  setError("");
                  setAction("deactivate");
                }}
              >
                {th ? "ยกเลิกสิทธิ์บนเครื่องนี้" : "Deactivate this device"}
              </Button>
            )}
            {licence.signedIn && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || waiting}
                onClick={() => {
                  setError("");
                  setAction("logout");
                }}
              >
                <LogOut size={13} />
                {th ? "ออกจากระบบ" : "Sign out"}
              </Button>
            )}
          </div>
        )}
        {!action && error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setAction(undefined);
            setKey("");
            setError("");
          }
        }}
        title={
          action === "key"
            ? th
              ? "เปิดใช้งานด้วยคีย์"
              : "Activate a licence key"
            : action === "deactivate"
              ? th
                ? "ยกเลิกสิทธิ์บนเครื่องนี้?"
                : "Deactivate this device?"
              : th
                ? "ออกจากระบบ Precut?"
                : "Sign out of Precut?"
        }
        description={
          action === "key"
            ? th
              ? "ใช้คีย์ Precut ที่ได้รับจาก T2ETECH Store"
              : "Use the Precut key from your T2ETECH Store purchase."
            : action === "deactivate"
              ? th
                ? "คืนที่นั่งของเครื่องนี้เพื่อใช้งานเครื่องอื่น โปรเจกต์และไฟล์ต้นฉบับยังอยู่"
                : "Release this device seat for another computer. Projects and source footage stay here."
              : th
                ? "ยกเลิกการเชื่อมบัญชีบนเครื่องนี้ สิทธิ์ที่เปิดใช้งานแล้วเป็นการตั้งค่าแยกต่างหาก"
                : "Disconnect the account on this computer. An activated device licence is managed separately."
        }
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAction(undefined);
                setKey("");
                setError("");
              }}
            >
              {th ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
              disabled={busy || (action === "key" && !key.trim())}
              variant={action === "key" ? "default" : "danger"}
              onClick={() =>
                void run(
                  action === "key"
                    ? "license.activate"
                    : action === "deactivate"
                      ? "license.deactivate"
                      : "license.logout",
                  action === "key" ? { key: key.trim() } : {},
                )
              }
            >
              {busy && <LoaderCircle size={14} className="signin-spinner" />}
              {action === "key"
                ? th
                  ? "เปิดใช้งาน"
                  : "Activate"
                : action === "deactivate"
                  ? th
                    ? "ยกเลิกสิทธิ์"
                    : "Deactivate"
                  : th
                    ? "ออกจากระบบ"
                    : "Sign out"}
            </Button>
          </>
        }
      >
        {action === "key" && (
          <label className="licence-key-label">
            {th ? "คีย์สิทธิ์ใช้งาน" : "Licence key"}
            <Input
              data-dialog-autofocus=""
              type="password"
              autoComplete="off"
              maxLength={200}
              placeholder="T2E-PC-…"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={busy}
            />
          </label>
        )}
        {error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </section>
  );
}

export function AboutPrecut() {
  const { licence, settings } = useStore();
  const th = settings.language === "th";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [update, setUpdate] = useState<{
    manual?: boolean;
    hasUpdate: boolean;
    version?: string;
    releaseNotes?: string;
  }>();
  return (
    <section className="settings-section about-precut">
      <img
        src="./brand/precut-app-icon.png"
        width="62"
        height="62"
        alt="Precut"
      />
      <div className="about-description">
        <strong>
          Precut <span>{appVersion}</span>
        </strong>
        <p>Made by t2etech</p>
        <small>
          {th ? "ตัดต่อน้อยลง สร้างสรรค์มากขึ้น" : "Edit less. Create more."}
        </small>
      </div>
      <Button
        variant="outline"
        disabled={busy || licence?.mode !== "configured"}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setUpdate(await call("license.checkUpdates"));
          } catch {
            setError(
              th
                ? "ตรวจอัปเดตไม่ได้ ลองอีกครั้งภายหลัง"
                : "Could not check updates. Retry later.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={14} className={busy ? "signin-spinner" : ""} />
        {th ? "ตรวจอัปเดต" : "Check for updates"}
      </Button>
      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
      {update && (
        <div className="about-update" role="status">
          {update.manual ? (
            <>
              <strong>
                {th
                  ? "อัปเดตผ่าน T2ETECH Store"
                  : "Update through T2ETECH Store"}
              </strong>
              <p>
                {th
                  ? "ดาวน์โหลดตัวติดตั้งใหม่ บันทึกงานและปิด Precut แล้วติดตั้งทับเวอร์ชันเดิม โปรเจกต์และการตั้งค่าจะยังอยู่"
                  : "Download the new installer, save your work and close Precut, then install over the current version. Your projects and settings stay in place."}
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await call("license.installUpdate");
                  } catch {
                    setError(
                      th
                        ? "เปิด Store ไม่ได้ ลองอีกครั้ง"
                        : "Could not open the Store. Try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={14} />
                {th ? "เปิดหน้า Precut ใน Store" : "Open Precut in the Store"}
              </Button>
            </>
          ) : update.hasUpdate ? (
            <>
              <strong>
                {th ? "เวอร์ชันใหม่" : "New version"} {update.version}
              </strong>
              <p>{update.releaseNotes}</p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await call("license.installUpdate");
                  } catch {
                    setError(
                      th
                        ? "ติดตั้งไม่ได้ ต้องใช้ไฟล์ที่ตรวจสอบผู้เผยแพร่ได้"
                        : "Could not install. The installer must pass publisher verification.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={14} />
                {th ? "ติดตั้งอัปเดต" : "Install update"}
              </Button>
            </>
          ) : (
            <>
              <Check size={14} />
              {th
                ? "คุณใช้เวอร์ชันล่าสุดที่พร้อมให้เครื่องนี้แล้ว"
                : "You have the latest available version for this device."}
            </>
          )}
        </div>
      )}
    </section>
  );
}
