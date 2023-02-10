import axios, { AxiosInstance } from "axios";

let roloInstance: AxiosInstance;

export function rolo(key = process.env.API_KEY_TEST_GOOD) {
  if (!roloInstance) {
    roloInstance = axios.create({
      baseURL: `http://localhost:${process.env.APP_PORT}/v1/`,
      headers: { "X-Api-Key": key },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
