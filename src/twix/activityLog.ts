// auth class extends AuthContext by adding functions to validate access

import { log, loge } from "../common/log.js";
import { AuthKind } from "../rolo/auth.js";
import { getRolo } from "./rolo.js";
import { z } from "zod";

const ZLogResponse = z.object({
  id: z.string(),
  url: z.string(),
});

export class ActivityLog {
  messages: string[];
  cursor: number;
  postQueue: string[];
  id: string | undefined;
  authKind: AuthKind;
  constructor(authKind: AuthKind) {
    this.messages = [];
    this.postQueue = [];
    this.cursor = 0;
    this.authKind = authKind;
  }
  async prepareRemote(message: string = "Log Open") {
    try {
      const { data } = await getRolo(this.authKind).post("/logs", { message });
      const { id, url } = ZLogResponse.parse(data);
      this.id = id;
      this.postRemote();
      return url;
    } catch (error) {
      loge("Failed to create remote log: ", error);
    }
  }
  async postRemote() {
    if (this.id) {
      while (this.postQueue.length) {
        const message = this.postQueue.shift();
        try {
          await getRolo(this.authKind).patch(`/logs/${this.id}`, { message });
        } catch (error) {
          loge("Failed to post message to remote log");
        }
      }
    }
  }
  log(message: string) {
    if (this.cursor === this.messages.length) {
      process.nextTick(() => {
        const merged = this.messages.slice(this.cursor).join("\n");
        this.cursor = this.messages.length;
        log(merged);
        this.postQueue.push(merged);
        this.postRemote();
      });
    }
    this.messages.push(message);
  }
  getString() {
    return this.messages.join("\n");
  }
}
