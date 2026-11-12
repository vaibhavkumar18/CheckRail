import { Pool } from "pg";
import config from "./config.js";

const DB = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
  },
});

DB.on("error", (error) => {
  console.error("Unexpected database pool error:", error);
});

export default DB;