import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
} from "@carbon/react";
import { api } from "../api/client";

export default function Shell() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState<{ email: string } | null>(null);

  useEffect(() => {
    api.me()
      .then((u) => setMe({ email: u.email }))
      .catch(() => nav("/login"));
  }, []);

  return (
    <>
      <Header aria-label="MAS MCP Server">
        <HeaderName prefix="MAS">MCP Server</HeaderName>
        <HeaderNavigation aria-label="MAS MCP">
          <HeaderMenuItem href="#">{me ? me.email : ""}</HeaderMenuItem>
        </HeaderNavigation>
      </Header>

      <SideNav aria-label="Side navigation" expanded>
        <SideNavItems>
          <SideNavLink as={Link} to="/dashboard" isActive={loc.pathname.includes("/dashboard")}>Dashboard</SideNavLink>
          <SideNavLink as={Link} to="/tenants" isActive={loc.pathname.includes("/tenants")}>Tenants</SideNavLink>
          <SideNavLink as={Link} to="/messages" isActive={loc.pathname.includes("/messages")}>Messages</SideNavLink>
          <SideNavLink as={Link} to="/concepts" isActive={loc.pathname.includes("/concepts")}>Concepts</SideNavLink>
          <SideNavLink as={Link} to="/trace" isActive={loc.pathname.includes("/trace")}>Trace log</SideNavLink>
          <SideNavLink as={Link} to="/settings" isActive={loc.pathname.includes("/settings")}>Settings</SideNavLink>
        </SideNavItems>
      </SideNav>

      <Content>
        <Outlet />
      </Content>
    </>
  );
}
