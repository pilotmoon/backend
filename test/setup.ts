import axios, { AxiosInstance } from "axios";

let roloInstance: AxiosInstance;

export function rolo() {
  if (!roloInstance) {
    roloInstance = axios.create({
      baseURL: `http://localhost:${process.env.APP_PORT}/v1/`,
      headers: { "X-Api-Key": "dummy" },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
