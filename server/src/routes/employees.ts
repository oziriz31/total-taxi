import { Router } from "express";
import { prisma } from "../lib/prisma";

export const employeesRouter = Router();

employeesRouter.get("/", async (_req, res) => {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { manager: { select: { id: true, name: true } } },
  });
  res.json(employees);
});

employeesRouter.get("/:id", async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  res.json(employee);
});

employeesRouter.get("/:id/reports", async (req, res) => {
  const reports = await prisma.employee.findMany({ where: { managerId: req.params.id } });
  res.json(reports);
});
