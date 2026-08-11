import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";

// Stand-in for the shared Auth module referenced in
// docs/taxi-management-module-spec.md section 8. No login exists yet — the
// caller identifies themselves via the X-Employee-Id header, which the
// client sets from a "log in as" picker. Swap this for real session/JWT
// auth once the platform's Auth module exists.
declare global {
  namespace Express {
    interface Request {
      currentEmployeeId?: string;
    }
  }
}

export async function requireCurrentUser(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.header("x-employee-id");
  if (!employeeId) {
    return res.status(401).json({ error: "Missing X-Employee-Id header" });
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return res.status(401).json({ error: "Unknown employee id" });
  }
  req.currentEmployeeId = employeeId;
  next();
}
