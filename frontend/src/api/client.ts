// src/api/client.ts
import axios from "axios";

const API_BASE_URL: string | undefined = import.meta.env.VITE_API_BASE_URL;
// CRA라면: const API_BASE_URL = process.env.REACT_APP_API_URL;
// Next라면: const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.warn("⚠️ API_BASE_URL(백엔드 주소)이 설정되지 않았습니다.");
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});
