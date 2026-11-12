import "./src/config/loadEnv.js";
import DB from "./src/config/DB.js";
import app from "./src/app.js";
import config from "./src/config/config.js";
const PORT = config.PORT;

async function startServer() {
  try {
    await DB.query("SELECT 1");

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
