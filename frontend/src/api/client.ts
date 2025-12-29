import axios from "axios";

// baseURL을 빈 문자열로 (경로 중복 방지)
const API_BASE = "";

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// 인터셉터: Authorization 헤더 자동 추가
apiClient.interceptors.request.use((config) => {
  const authTokens = localStorage.getItem("authTokens");
  if (authTokens) {
    try {
      const tokens = JSON.parse(authTokens);
      if (tokens.access) {
        config.headers.Authorization = `Bearer ${tokens.access}`;
      }
    } catch (e) {
      console.error("Failed to parse authTokens", e);
    }
  }
  return config;
});

export default apiClient;
