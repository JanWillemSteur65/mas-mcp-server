export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: any;
};

export function parseJsonRpc(body: any): JsonRpcRequest | null {
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string" || !("id" in body)) return null;
  return body as JsonRpcRequest;
}

export function rpcOk(id: JsonRpcId, result: any) {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: any) {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}
