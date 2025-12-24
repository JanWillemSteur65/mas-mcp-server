import React, { useEffect, useMemo, useState } from "react";
import { Content, Header, HeaderName, SideNav, SideNavItems, SideNavLink, Theme } from "@carbon/react";
import { Dashboard, Settings, User, Code, Catalog, Table, Task } from "@carbon/icons-react";
import DashboardPage from "../pages/DashboardPage";
import TenantsPage from "../pages/TenantsPage";
import ToolsPage from "../pages/ToolsPage";
import AgentPage from "../pages/AgentPage";
import ProvidersPage from "../pages/ProvidersPage";
import ObjectStructuresPage from "../pages/ObjectStructuresPage";
import ApprovalsPage from "../pages/ApprovalsPage";
import "./app.css";

type Page = "dashboard" | "tenants" | "tools" | "objectStructures" | "agent" | "providers" | "approvals";

function readTheme(): "white" | "g100" {
  try {
    const v = (localStorage.getItem("maximoMcpTheme") || "").toLowerCase();
    return v === "g100" || v === "dark" ? "g100" : "white";
  } catch {
    return "white";
  }
}

function AppInner() {
  const [page, setPage] = useState<Page>(() => {
    const h = (window.location.hash || "").replace(/^#/, "");
    if (h === "tenants" || h === "tools" || h === "objectStructures" || h === "agent" || h === "providers" || h === "approvals") return h;
    return "dashboard";
  });

  const [theme, setTheme] = useState<"white" | "g100">(readTheme());

  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || "").replace(/^#/, "") as Page;
      if (h) setPage(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // If theme changed in another tab, refresh
    const onStorage = (e: StorageEvent) => {
      if (e.key === "maximoMcpTheme") setTheme(readTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const body = useMemo(() => {
    switch (page) {
      case "tenants": return <TenantsPage />;
      case "tools": return <ToolsPage />;
      case "objectStructures": return <ObjectStructuresPage />;
      case "agent": return <AgentPage />;
      case "providers": return <ProvidersPage />;
      case "approvals": return <ApprovalsPage />;
      default: return <DashboardPage />;
    }
  }, [page]);

  function setPageAndHash(p: Page) {
    window.location.hash = p;
    setPage(p);
  }

  return (
    <Theme theme={theme}>
      <Header aria-label="Maximo MCP">
        <HeaderName href="#" prefix="Maximo">MCP Server</HeaderName>
      </Header>

      <SideNav expanded isPersistent>
        <SideNavItems>
          <SideNavLink onClick={() => setPageAndHash("dashboard")} renderIcon={Dashboard}>Dashboard</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("tenants")} renderIcon={User}>Tenants</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("objectStructures")} renderIcon={Table}>Object Structures</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("tools")} renderIcon={Catalog}>Tools</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("agent")} renderIcon={Code}>AI Assistant</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("providers")} renderIcon={Settings}>Settings</SideNavLink>
          <SideNavLink onClick={() => setPageAndHash("approvals")} renderIcon={Task}>Approvals</SideNavLink>
        </SideNavItems>
      </SideNav>

      <Content style={{ marginLeft: 256, paddingTop: 48 }}>
        {body}
      </Content>
    </Theme>
  );
}

export default function App() {
  return <AppInner />;
}
