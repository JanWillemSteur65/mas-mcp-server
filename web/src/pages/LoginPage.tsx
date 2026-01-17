import React, { useState } from "react";
import { Button, Form, Stack, TextInput } from "@carbon/react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="loginShell">
      <div className="loginLeft">
        <h1>IBM Maximo Application Suite</h1>
        <p>Sign in to MAS MCP Server</p>
        <img src="/login-hero.png" alt="Login hero" />
      </div>
      <div className="loginRight">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            api
              .login(email, password)
              .then((r) => { setToken(r.access_token); nav("/dashboard"); })
              .catch((e) => setError(e.message));
          }}
        >
          <Stack gap={5}>
            <TextInput id="email" labelText="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextInput
              id="password"
              labelText="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <div style={{ color: "#da1e28" }}>{error}</div> : null}
            <Button type="submit">Log in</Button>
          </Stack>
        </Form>
      </div>
    </div>
  );
}
