import express from "express";
import cors from "cors";
import { employeesRouter } from "./routes/employees";
import { requestsRouter } from "./routes/requests";
import { invoicesRouter } from "./routes/invoices";
import { personalUseRouter } from "./routes/personalUse";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/employees", employeesRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api", personalUseRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Taxi Management API listening on http://localhost:${port}`);
});
