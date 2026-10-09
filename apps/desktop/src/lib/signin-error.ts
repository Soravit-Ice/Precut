export function signInErrorMessage(code: string | undefined, th: boolean) {
  switch (code) {
    case "OAUTH_CLIENT_INVALID":
    case "OAUTH_SCOPE_INVALID":
      return th
        ? "การตั้งค่าการเข้าสู่ระบบของ Precut ยังไม่ถูกต้อง กรุณาติดต่อ T2ETECH เพื่อแก้ไขก่อนลองใหม่"
        : "Precut’s sign-in setup needs attention. Please contact T2ETECH before retrying.";
    case "OAUTH_NETWORK_ERROR":
      return th
        ? "เชื่อมต่อบริการเข้าสู่ระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วเริ่มคำขอใหม่"
        : "Could not reach the sign-in service. Check your connection and start a new request.";
    case "OAUTH_SERVER_ERROR":
    case "OAUTH_RESPONSE_INVALID":
      return th
        ? "บริการเข้าสู่ระบบตอบกลับไม่สำเร็จ กรุณารอสักครู่แล้วเริ่มคำขอใหม่"
        : "The sign-in service could not complete this request. Wait a moment, then start a new request.";
    case "OAUTH_RATE_LIMITED":
      return th
        ? "มีคำขอเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วเริ่มคำขอใหม่"
        : "Too many sign-in requests. Wait a moment, then start a new request.";
    case "OAUTH_ACCESS_DENIED":
      return th
        ? "ยกเลิกการเชื่อมบัญชีแล้ว เริ่มคำขอใหม่เมื่อต้องการเข้าสู่ระบบ"
        : "Account connection was cancelled. Start a new request when ready.";
    case "OAUTH_GRANT_INVALID":
    case "OAUTH_CALLBACK_INVALID":
    case "OAUTH_REQUEST_EXPIRED":
      return th
        ? "ลิงก์นี้หมดอายุ ถูกใช้แล้ว หรือไม่ตรงกับคำขอ เริ่มคำขอใหม่แล้วใช้ลิงก์ใหม่จากเบราว์เซอร์"
        : "This return link expired, was already used, or does not match. Start a new request and use its new link.";
    default:
      return th
        ? "เข้าสู่ระบบไม่สำเร็จ เริ่มคำขอใหม่เพื่อลองอีกครั้ง"
        : "Sign-in could not finish. Start a new request to retry.";
  }
}
