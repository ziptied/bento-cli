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

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    child.once("error", (error) => {
      finish(new BrowserOpenError(`Failed to launch browser: ${error.message}`));
    });

    child.once("close", (code) => {
      if (typeof code === "number" && code > 0) {
        finish(new BrowserOpenError(`Browser command exited with code ${code}`));
        return;
      }
      finish();
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
