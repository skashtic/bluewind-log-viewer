import express from "express";
import fs from "fs";
import path from "path";
import logsController from "./logs/logs.controller";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found-handler";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/logs", logsController);

if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.resolve(
    __dirname,
    "../../frontend/dist/frontend/browser"
  );

  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
        if (err) {
          next(err);
        }
      });
    });
  } else {
    console.warn(
      `[bluewind-log-viewer] NODE_ENV=production but Angular browser build not found at ${frontendDistPath}. ` +
        "Run `npm run build` from the repository root (or `ng build` in frontend/) before starting."
    );
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
