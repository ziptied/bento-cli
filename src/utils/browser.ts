import { spawn } from "node:child_process";

class BrowserOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserOpenError";
  }
}

export async function openInBrowser(url: string): Promise<void> {
  const { command, args } = getOpenCommand(url);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
    });

    child.once("error", (error) => {
      reject(new BrowserOpenError(`Failed to launch browser: ${error.message}`));
    });

    child.once("close", (code) => {
      if (typeof code === "number" && code > 0) {
        reject(new BrowserOpenError(`Browser command exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.unref();
  });
}

function getOpenCommand(url: string): { command: string; args: string[] } {
  if (process.platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export { BrowserOpenError };
