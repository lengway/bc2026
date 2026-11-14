import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { createTestDatabase } from "../backend/db-helper";
import { expect, test } from "@playwright/test";

test("real account flow with isolated PostgreSQL and SMTP capture", async ({
  page,
}) => {
  test.skip(
    process.env.GAMBIT_ACCOUNTS_SMTP_E2E !== "1",
    "Set GAMBIT_ACCOUNTS_SMTP_E2E=1 with TEST_DATABASE_URL to run isolated SMTP delivery.",
  );
  test.setTimeout(120_000);
  const db = await createTestDatabase();
  const messages: string[] = [];
  const smtp = createServer((socket) => {
    socket.write("220 localhost Gambit SMTP capture\r\n");
    socket.setEncoding("utf8");
    let buffer = "";
    let message: string[] | null = null;
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      for (
        let newline = buffer.indexOf("\r\n");
        newline >= 0;
        newline = buffer.indexOf("\r\n")
      ) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (message !== null) {
          if (line === ".") {
            messages.push(message.join("\r\n"));
            message = null;
            socket.write("250 Captured\r\n");
          } else message.push(line.startsWith("..") ? line.slice(1) : line);
        } else if (line.startsWith("EHLO ") || line.startsWith("HELO ")) {
          socket.write("250 localhost\r\n");
        } else if (line === "DATA") {
          message = [];
          socket.write("354 End data with <CRLF>.<CRLF>\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Goodbye\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });
  });
  try {
    smtp.listen(0, "127.0.0.1");
    await once(smtp, "listening");
    const smtpAddress = smtp.address();
    if (!smtpAddress || typeof smtpAddress === "string")
      throw new Error("Could not start the SMTP capture server");
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const webAddress = reservation.address();
    reservation.close();
    await once(reservation, "close");
    if (!webAddress || typeof webAddress === "string")
      throw new Error("Could not reserve a local web-server port");
    const origin = `http://127.0.0.1:${webAddress.port}`;
    const server = spawn(
      process.execPath,
      [
        path.resolve("node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(webAddress.port),
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "development",
          NEXT_PUBLIC_API_MOCKS: "0",
          APP_URL: origin,
          DATABASE_URL: db.url,
          LLM_MODEL: "unused-in-account-e2e",
          OPENAI_API_KEY: "unused-in-account-e2e",
          SMTP_HOST: "127.0.0.1",
          SMTP_PORT: String(smtpAddress.port),
          SMTP_SECURE: "false",
          SMTP_FROM: "gambit@example.com",
          SMTP_USER: "",
          SMTP_PASSWORD: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const logs: Buffer[] = [];
    server.stdout?.on("data", (data: Buffer) => logs.push(data));
    server.stderr?.on("data", (data: Buffer) => logs.push(data));
    try {
      await expect
        .poll(
          async () => {
            try {
              return (
                await fetch(`${origin}/login`, {
                  signal: AbortSignal.timeout(10_000),
                })
              ).status;
            } catch {
              return 0;
            }
          },
          { timeout: 50_000 },
        )
        .toBe(200);
      const delivery = `maya+${randomUUID()}@example.com`;
      const password = "isolated SMTP test password";
      await page.goto(`${origin}/signup`);
      await page.getByLabel("Full name").fill("Maya Rivera");
      await page.getByLabel("Email", { exact: true }).fill(delivery);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("checkbox", { name: /I agree/ }).check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(
        page.getByRole("heading", { name: "Check your inbox" }),
      ).toBeVisible();
      await expect.poll(() => messages.length).toBe(1);
      const mail = messages[0].replace(/=\r\n/g, "").replace(/=3D/g, "=");
      const confirmation = mail
        .split(/\r\n/)
        .find((line) => line.startsWith(`${origin}/verify-email?token=`));
      if (!confirmation)
        throw new Error("Confirmation URL missing from captured mail");
      await page.goto(confirmation);
      await page.getByRole("button", { name: "Confirm email" }).click();
      await expect(page.getByText("Your email is confirmed.")).toBeVisible();
      await page.getByRole("button", { name: "Continue to Gambit" }).click();
      const profile = page.getByRole("button", { name: "Profile menu" });
      await profile.click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto(`${origin}/login?next=%2Fsettings%2Faccount`);
      await page.getByLabel("Email", { exact: true }).fill(delivery);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/settings\/account$/);
      await expect(page.getByLabel("Full name")).toHaveValue("Maya Rivera");
      await expect(
        page.getByText(delivery, { exact: false }).first(),
      ).toBeVisible();
      await profile.click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto(`${origin}/settings/account`);
      await expect(page).toHaveURL(/\/login/);
    } catch (error) {
      // Do not include mail or passwords in test output.
      const detail = Buffer.concat(logs)
        .toString()
        .split("\n")
        .filter((line) => line.includes("Error"))
        .slice(-5)
        .join("\n");
      if (detail)
        test
          .info()
          .annotations.push({ type: "next-server", description: detail });
      throw error;
    } finally {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
    }
  } finally {
    smtp.close();
    await db.cleanup();
  }
});
