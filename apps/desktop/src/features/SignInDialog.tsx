import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { Button, Dialog, Input } from "../components/ui/primitives";
import { call, useStore } from "../lib/store";
import { signInErrorMessage } from "../lib/signin-error";
import {
  PrecutOAuthCallbackSchema,
  type LicenseStatus,
} from "../../../../packages/shared/src/contracts";

export function SignInDialog() {
  const th = useStore((state) => state.settings.language) === "th";
  const licence = useStore((state) => state.licence);
  const open = useStore((state) => state.signinOpen);
  const setOpen = (signinOpen: boolean) =>
    useStore.getState().set({ signinOpen });
  const [phase, setPhase] = useState<
    "idle" | "opening" | "waiting" | "complete"
  >("idle");
  const [callback, setCallback] = useState("");
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    if (
      licence?.loginPhase === "complete" ||
      (open && licence?.signedIn && licence.loginPhase === "idle")
    ) {
      setPhase("complete");
      setCallback("");
      setError("");
    } else if (licence?.loginPhase === "error") {
      setPhase("idle");
      setError(signInErrorMessage(licence.loginError, th));
    } else if (
      licence?.loginPhase === "waiting" ||
      licence?.loginPhase === "completing"
    ) {
      setPhase("waiting");
    } else if (licence?.loginPhase === "idle" && !licence.signedIn) {
      setPhase("idle");
    }
  }, [licence?.loginPhase, licence?.loginError, licence?.signedIn, open, th]);
  async function begin() {
    setOpen(true);
    setPhase("opening");
    setCallback("");
    setError("");
    try {
      const status = await call<LicenseStatus>("license.login");
      useStore.getState().set({ licence: status });
      setPhase(status.loginPhase === "complete" ? "complete" : "waiting");
    } catch {
      setPhase("idle");
      setError(
        th
          ? "เปิดหน้าลงชื่อเข้าใช้ไม่ได้ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง"
          : "Could not open sign-in. Check your connection and try again.",
      );
    }
  }
  async function finish(event: React.FormEvent) {
    event.preventDefault();
    const result = PrecutOAuthCallbackSchema.safeParse(callback);
    if (!result.success) {
      setError(
        th
          ? "วางลิงก์กลับเข้า Precut ให้ครบจากหน้าที่อนุญาตแล้ว"
          : "Paste the complete Precut return link from the approved browser page.",
      );
      return;
    }
    setCompleting(true);
    setError("");
    try {
      const status = await call<LicenseStatus>("license.completeLogin", {
        callbackUrl: result.data,
      });
      useStore.getState().set({ licence: status });
      setCallback("");
      setPhase(status.loginPhase === "complete" ? "complete" : "waiting");
      if (!status.signedIn)
        setError(
          th
            ? "ยังยืนยันบัญชีไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่"
            : "Account could not be verified. Check your connection and retry.",
        );
    } catch {
      setError(signInErrorMessage(useStore.getState().licence?.loginError, th));
    } finally {
      setCompleting(false);
    }
  }
  const busy =
    phase === "opening" || completing || licence?.loginPhase === "completing";
  const complete = phase === "complete";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCallback("");
      }}
      className="account-signin-dialog"
      title={
        complete
          ? th
            ? "เชื่อมบัญชีแล้ว"
            : "Account connected"
          : th
            ? "เข้าสู่ระบบ Precut"
            : "Sign in to Precut"
      }
      description={
        complete
          ? th
            ? "ใช้บัญชีเดียวกับ T2ETECH Store ในแอปนี้ได้แล้ว"
            : "Your T2ETECH Store account is now connected to this app."
          : th
            ? "ดำเนินการในเบราว์เซอร์ แล้วกลับมาทำงานต่อในแอป"
            : "Continue in your browser, then return to your workspace."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {complete
              ? th
                ? "เสร็จสิ้น"
                : "Done"
              : th
                ? "ปิดหน้าต่าง"
                : "Close"}
          </Button>
          {!complete && (
            <Button
              variant="default"
              disabled={busy}
              onClick={() => void begin()}
            >
              <ExternalLink size={14} />
              {phase === "idle"
                ? th
                  ? "เข้าสู่ระบบในเบราว์เซอร์"
                  : "Continue in browser"
                : th
                  ? "เริ่มคำขอใหม่"
                  : "Start a new request"}
            </Button>
          )}
        </>
      }
    >
      <div className="signin-brand">
        <img
          src="./brand/precut-app-icon.png"
          alt="Precut"
          width="48"
          height="48"
        />
        <span>Made by t2etech</span>
        {complete && <CheckCircle2 className="signin-connected" size={24} />}
      </div>
      {complete ? (
        <div className="signin-success" role="status">
          <strong>
            {licence?.activated
              ? th
                ? "เปิดใช้งานสิทธิ์บนเครื่องนี้แล้ว"
                : "Licence activated on this device"
              : th
                ? "เข้าสู่ระบบสำเร็จ"
                : "Signed in successfully"}
          </strong>
          <p>
            {licence?.loginError === "ACTIVATION_PENDING"
              ? th
                ? "เชื่อมบัญชีสำเร็จ แต่ยังเปิดใช้งานสิทธิ์ที่ซื้อไม่ได้ กดตรวจสิทธิ์อีกครั้งจากหน้าตั้งค่า"
                : "Your account is connected. Purchase activation still needs attention. Retry from Licence settings."
              : licence?.activated
                ? th
                  ? "กลับไปแก้ไขและส่งออกงานได้เลย"
                  : "You can return to editing and exporting."
                : th
                  ? "หากยังไม่ได้ซื้อแผน แอปจะใช้สิทธิ์ทดลองที่ร้านกำหนด คุณเปิดใช้งานสิทธิ์ที่ซื้อได้จากหน้าสิทธิ์ใช้งาน"
                  : "Your available trial still applies. Activate a purchase from Licence settings when ready."}
          </p>
        </div>
      ) : (
        <>
          <ol className="signin-steps">
            <li>
              <span>1</span>
              <div>
                <strong>
                  {th ? "เข้าสู่ระบบในเบราว์เซอร์" : "Sign in in your browser"}
                </strong>
                <p>
                  {th
                    ? "ใช้บัญชีเดียวกับที่ซื้อ Precut"
                    : "Use the account that owns your Precut purchase."}
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>
                  {th
                    ? "กดอนุญาตให้เชื่อมบัญชี"
                    : "Allow the account connection"}
                </strong>
                <p>
                  {th
                    ? "เลือก “อนุญาตและกลับไปที่แอป” บนหน้า Store"
                    : "Choose “Allow and return to app” on the Store page."}
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>{th ? "กลับเข้า Precut" : "Return to Precut"}</strong>
                <p>
                  {th
                    ? "หากเบราว์เซอร์ถาม ให้เลือกเปิดแอป"
                    : "If prompted by the browser, choose to open the app."}
                </p>
              </div>
            </li>
          </ol>
          <div className="signin-waiting" role="status">
            {phase === "idle" ? (
              <ArrowRight size={16} />
            ) : (
              <LoaderCircle size={16} className="signin-spinner" />
            )}
            {licence?.loginPhase === "completing"
              ? th
                ? "กำลังเชื่อมบัญชีและตรวจสิทธิ์…"
                : "Connecting your account and checking access…"
              : phase === "opening"
                ? th
                  ? "กำลังเปิดเบราว์เซอร์…"
                  : "Opening your browser…"
                : phase === "waiting"
                  ? th
                    ? "กำลังรอผลจากเบราว์เซอร์"
                    : "Waiting for your browser"
                  : th
                    ? "เริ่มคำขอใหม่เพื่อเข้าสู่ระบบ"
                    : "Start a new request to sign in"}
          </div>
          <details
            className="signin-fallback"
            open={licence?.automaticReturn === false ? true : undefined}
          >
            <summary>{th ? "เปิดแอปไม่ได้?" : "Cannot open the app?"}</summary>
            <p>
              {th
                ? "บนหน้าที่อนุญาตแล้ว เปิด “เบราว์เซอร์เปิดแอปให้ไม่ได้?” คัดลอกลิงก์กลับเข้าแอป แล้ววางด้านล่าง ต้องเป็นลิงก์จากคำขอที่เริ่มในแอปนี้"
                : "On the approved browser page, open “Browser cannot open the app?”, copy the return link and paste it below. Keep the request open in this app."}
            </p>
            <form onSubmit={finish}>
              <label htmlFor="precut-return-link">
                {th ? "ลิงก์กลับเข้า Precut" : "Precut return link"}
              </label>
              <Input
                id="precut-return-link"
                type="password"
                autoComplete="off"
                spellCheck={false}
                maxLength={4096}
                value={callback}
                onChange={(event) => setCallback(event.target.value)}
                disabled={busy}
                placeholder="com.t2etech.precut://oauth/callback?…"
              />
              <Button disabled={busy || !callback.trim()} type="submit">
                {completing ? (
                  <LoaderCircle size={15} className="signin-spinner" />
                ) : (
                  <ArrowRight size={15} />
                )}{" "}
                {th ? "ดำเนินการเข้าสู่ระบบ" : "Complete sign-in"}
              </Button>
            </form>
          </details>
        </>
      )}
      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
      <p className="signin-privacy">
        <LockKeyhole size={13} />
        {th
          ? "ใช้ลิงก์ของคำขอนี้เท่านั้น ไม่ต้องกรอกรหัสผ่านในแอป"
          : "Use this request’s private return link. No account password is entered in the app."}
      </p>
    </Dialog>
  );
}

export function SignInButton() {
  const { licence, settings, set } = useStore();
  const waiting =
    licence?.loginPhase === "waiting" || licence?.loginPhase === "completing";
  return (
    <Button
      variant="outline"
      disabled={licence?.mode !== "configured"}
      onClick={() => set({ signinOpen: true })}
    >
      {licence?.signedIn ? <Check size={14} /> : <ExternalLink size={14} />}
      {waiting
        ? settings.language === "th"
          ? "รอเชื่อมบัญชี"
          : "Continue sign-in"
        : licence?.signedIn
          ? settings.language === "th"
            ? "ดูบัญชี"
            : "View account"
          : settings.language === "th"
            ? "เข้าสู่ระบบ"
            : "Sign in"}
    </Button>
  );
}
