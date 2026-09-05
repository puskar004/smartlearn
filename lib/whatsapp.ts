export function buildParentTabSwitchMessage(
  studentName: string,
  switchCount = 1
) {
  return (
    `Hello Parent,\n\n` +
    `This is an automated focus alert from SmartLearn.\n\n` +
    `Your child (${studentName || "Student"}) left the SmartLearn study tab ` +
    `(tab switch count today/session: ${switchCount}).\n\n` +
    `Please gently check in and encourage them to return to uninterrupted study.\n\n` +
    `— SmartLearn Focus Guardian`
  );
}

export function openParentWhatsApp(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return false;
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const url = `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
