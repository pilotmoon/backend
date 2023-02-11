import axios, { AxiosInstance } from "axios";

let roloInstance: AxiosInstance;

export function rolo(key = process.env.API_KEY_TEST_GOOD) {
  if (!roloInstance) {
    roloInstance = axios.create({
      baseURL: process.env.APP_URL,
      headers: {
        "Authorization": `Bearer ${key}`,
      },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
