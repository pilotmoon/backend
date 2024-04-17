// auth class extends AuthContext by adding functions to validate access

import { log, loge } from "../common/log.js";
import { AuthKind } from "../rolo/auth.js";
import { getRolo } from "./rolo.js";
import { z } from "zod";

const ZLogResponse = z.object({
  id: z.string(),
  url: z.string(),
});

function safeStringify(obj: unknown) {
  try {
    return String(JSON.stringify(obj, undefined, 2) ?? "");
  } catch (err) {
    return "**stringify error**";
  }
}

function limitString(str: string, limit: number) {
  return str.length > limit
    ? str.slice(0, limit) + "***MESSAGE TRUNCATED***"
    : str;
}

function formatMessage(args: any[]) {
  return args
    .map((arg) => {
      return limitString(
        typeof arg === "string" ? arg : safeStringify(arg),
        1000,
      );
    })
    .join(" ");
}

export class ActivityLog {
  messages: string[];
  cursor: number;
  id: string | undefined;
  authKind: AuthKind;
  constructor(authKind: AuthKind) {
    this.messages = [];
    this.cursor = 0;
    this.authKind = authKind;
  }
  async prepareRemote(message: string = "Log Open") {
    try {
      const { data } = await getRolo(this.authKind).post("/logs", { message });
      const { id, url } = ZLogResponse.parse(data);
      this.id = id;
      return url;
    } catch (error) {
      loge("Failed to create remote log: ", error);
    }
  }
  async postRemote(message: string) {
    if (this.id) {
      try {
        await getRolo(this.authKind).patch(`/logs/${this.id}`, { message });
      } catch (error) {
        loge("Failed to post message to remote log");
      }
    } else {
      loge("No log id to post remote log");
    }
  }
  next() {
    if (this.cursor === this.messages.length) {
      process.nextTick(() => {
        const merged = this.messages.slice(this.cursor).join("\n");
        this.cursor = this.messages.length;
        log(`\n[${new Date().toISOString()}]\n${merged}`);
        this.postRemote(merged);
      });
    }
  }
  log(...args: any[]) {
    this.next();
    this.messages.push(formatMessage(args));
  }
  getString() {
    return this.messages.join("\n");
  }
}
