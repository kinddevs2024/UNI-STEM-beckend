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
  const subject = "Set your UNI STEM password";
  const text =
    `Hello ${safeName},\n\n` +
    "We received a login attempt for your account, but no password is set yet.\n" +
    "Use the link below to set your password:\n\n" +
    `${link}\n\n` +
    "If you did not request this, you can ignore this email.\n";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>We received a login attempt for your account, but no password is set yet.</p>
      <p>Click the button below to set your password:</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:12px 20px;background:#0b57d0;color:#fff;text-decoration:none;border-radius:6px;">
          Set Password
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

export async function sendEmailVerification({ to, name, link }) {
  const cfg = getEmailConfig();
  const transporter = createTransport();

  const safeName = name || "there";
  const subject = "Verify your UNI STEM account";
  const text =
    `Hello ${safeName},\n\n` +
    "Please verify your email to activate your account.\n" +
    "Use the link below to verify:\n\n" +
    `${link}\n\n` +
    "If you did not create this account, you can ignore this email.\n";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${safeName},</p>
      <p>Please verify your email to activate your account.</p>
      <p>Click the button below to verify:</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:12px 20px;background:#0b57d0;color:#fff;text-decoration:none;border-radius:6px;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${link}">${link}</a></p>
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
