const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateStaffPassword(length = 10) {
  const size = Math.max(6, Math.min(length, 16));
  let password = "";

  for (let index = 0; index < size; index += 1) {
    const randomIndex = Math.floor(Math.random() * PASSWORD_CHARS.length);
    password += PASSWORD_CHARS[randomIndex];
  }

  return password;
}

export function validatePasswordPair(password: string, confirmPassword: string) {
  if (!password || password.length < 6) {
    return { ok: false as const, message: "Kata sandi minimal 6 karakter." };
  }

  if (password !== confirmPassword) {
    return { ok: false as const, message: "Konfirmasi kata sandi tidak cocok." };
  }

  return { ok: true as const, message: undefined };
}