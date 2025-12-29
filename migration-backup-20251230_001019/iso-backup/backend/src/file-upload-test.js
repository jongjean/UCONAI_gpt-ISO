import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: path.join(__dirname, "uploads") });

// 정적 파일 서빙 (업로드된 파일)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(4400, () => {
  console.log("File upload test server running on 4400");
});
