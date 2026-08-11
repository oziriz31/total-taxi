import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { getCurrentEmployeeId, setCurrentEmployeeId } from "../api/client";
import type { Employee } from "../api/types";

// Stand-in "log in as" picker for the Auth seam described in
// docs/taxi-management-module-spec.md section 8 — no real login exists yet.
interface IdentityContextValue {
  employees: Employee[];
  currentEmployee: Employee | null;
  loading: boolean;
  switchTo: (employeeId: string) => void;
  refresh: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployeeId, setCurrentEmployeeIdState] = useState<string | null>(getCurrentEmployeeId());
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const list = await api.get<Employee[]>("/employees");
      setEmployees(list);
      if (!currentEmployeeId && list.length > 0) {
        switchTo(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  function switchTo(employeeId: string) {
    setCurrentEmployeeId(employeeId);
    setCurrentEmployeeIdState(employeeId);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId) ?? null;

  return (
    <IdentityContext.Provider value={{ employees, currentEmployee, loading, switchTo, refresh }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within an IdentityProvider");
  return ctx;
}
