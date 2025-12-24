import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiGet } from "./api";

export type Capabilities = {
  role: "viewer" | "admin";
  canWriteConfig: boolean;
  approvalsEnabled: boolean;
};

const Ctx = createContext<Capabilities>({ role: "admin", canWriteConfig: true, approvalsEnabled: false });

export function CapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const [caps, setCaps] = useState<Capabilities>({ role: "admin", canWriteConfig: true, approvalsEnabled: false });

  useEffect(() => {
    apiGet("/api/capabilities")
      .then((d: any) => setCaps(d))
      .catch(() => setCaps({ role: "admin", canWriteConfig: true, approvalsEnabled: false }));
  }, []);

  const value = useMemo(() => caps, [caps]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCapabilities() {
  return useContext(Ctx);
}
