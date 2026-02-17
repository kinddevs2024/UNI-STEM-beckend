import nodemailer from "nodemailer";

function getEmailConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP config is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM");
  }

  const secure = port === 465;
  return { host, port, secure, user, pass, from };
}

function createTransport() {
  const cfg = getEmailConfig();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
}

export async function sendPasswordSetupEmail({ to, name, link }) {
  const cfg = getEmailConfig();
  const transporter = createTransport();

  const safeName = name || "there";
  const subject = "Confirm account and set password";
  const text =
    `Hello ${safeName},\n\n` +
    "Your account requires confirmation before sign in.\n" +
    "Use the link below to confirm your account and create a new password:\n\n" +
    `${link}\n\n` +
    "If you did not request this, you can ignore this email.\n";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>Your account requires confirmation before sign in.</p>
      <p>Click the button below to confirm your account and create a new password:</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:12px 20px;background:#0b57d0;color:#fff;text-decoration:none;border-radius:6px;">
          Confirm Account & Set Password
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetCodeEmail({ to, name, code }) {
  const cfg = getEmailConfig();
  const transporter = createTransport();

  const safeName = name || "there";
  const subject = "Your password reset code";
  const text =
    `Hello ${safeName},\n\n` +
    "Use this 6-digit code to reset your password:\n\n" +
    `${code}\n\n` +
    "If you did not request this, you can ignore this email.\n";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>Use this 6-digit code to reset your password:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0b57d0;">${code}</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
}

export async function sendEmailVerification({ to, name, link, code }) {
  const cfg = getEmailConfig();
  const transporter = createTransport();

  const safeName = name || "there";
  const subject = "Verify your Global Olympiad account";
  const hasCode = typeof code === "string" && code.trim().length > 0;
  const hasLink = typeof link === "string" && link.trim().length > 0;

  const text = hasCode
    ? `Hello ${safeName},\n\nPlease verify your email to activate your account.\nUse this 6-digit code:\n\n${code}\n\nIf you did not create this account, you can ignore this email.\n`
    : `Hello ${safeName},\n\nPlease verify your email to activate your account.\nUse the link below to verify:\n\n${hasLink ? link : ""}\n\nIf you did not create this account, you can ignore this email.\n`;

  const html = hasCode
    ? `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>Please verify your email to activate your account.</p>
      <p>Your 6-digit verification code:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0b57d0;">${code}</p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `
    : `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>Please verify your email to activate your account.</p>
      <p>Click the button below to verify:</p>
      <p>
        <a href="${hasLink ? link : "#"}" style="display:inline-block;padding:12px 20px;background:#0b57d0;color:#fff;text-decoration:none;border-radius:6px;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${hasLink ? link : "#"}">${hasLink ? link : ""}</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
}
