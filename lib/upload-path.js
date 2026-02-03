import path from "path";

const DEFAULT_UPLOAD_PATH = process.env.UPLOAD_PATH || "./uploads";

export function isServerlessRuntime() {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.VERCEL ||
      process.env.NETLIFY
  );
}

export function getUploadBaseDir(uploadDir = DEFAULT_UPLOAD_PATH) {
  if (path.isAbsolute(uploadDir)) {
    return uploadDir;
  }

  if (isServerlessRuntime()) {
    const tmpBase = process.env.TMPDIR || "/tmp";
    const cleaned = uploadDir.replace(/^\.?[\\/]/, "");
    return path.join(tmpBase, cleaned);
  }

  return path.join(process.cwd(), uploadDir);
}

