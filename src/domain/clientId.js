// src/domain/clientId.js
const KEY = "tinkeroneo_client_id_v1";

export function getClientId() {
  let id = localStorage.getItem(KEY);
  if (id) return id;

  id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(KEY, id);
  return id;
}
