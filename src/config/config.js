import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  rootPath: path.resolve(__dirname, "../../"),
  publicPath: path.join(path.resolve(__dirname, "../../"), "public"),
  viewsPath: path.join(path.resolve(__dirname, "../../"), "views"),
};
