"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_ROOM_DIMENSIONS_MM } from "@woodcraft/shared";
import { apiClient } from "@/lib/api";

interface Client { id: string; name: string; email: string | null }
interface Project { id: string; name: string; status: string; client: Client | null; _count: { rooms: number; quotes: number }; updatedAt: string }

interface Props {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

const inputCls =
  "w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500";

function reason(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Unknown error";
}

export function NewProjectModal({ onClose, onCreated }: Props) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [clientsError, setClientsError] = useState(false);
  const [clientId, setClientId] = useState("");
  // Inline client creation when the org has no clients yet — no detour
  // through the Clients page. `createdClient` is reused on retry so a
  // failed project/room step never creates a duplicate client.
  const [newClientName, setNewClientName] = useState("");
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orphanProjectId, setOrphanProjectId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ data: Client[] }>("/clients?pageSize=100")
      .then((r) => {
        setClients(r.data);
        if (r.data[0]) setClientId(r.data[0].id);
      })
      .catch(() => setClientsError(true))
      .finally(() => setClientsLoaded(true));
  }, []);

  const needsNewClient = clientsLoaded && clients.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientsLoaded) return;
    if (needsNewClient && !createdClient && !newClientName.trim()) { setError("Client name is required"); return; }
    if (!needsNewClient && !clientId) { setError("Select a client"); return; }
    if (!name.trim()) { setError("Project name is required"); return; }

    setLoading(true);
    setError("");
    setOrphanProjectId(null);

    // 1. Client (only when the org has none yet)
    let resolvedClientId = clientId;
    if (needsNewClient) {
      let client = createdClient;
      if (!client) {
        try {
          client = await apiClient.post<Client>("/clients", { name: newClientName.trim() });
          setCreatedClient(client);
        } catch (err: unknown) {
          setError(`Couldn't create the client: ${reason(err)}`);
          setLoading(false);
          return;
        }
      }
      resolvedClientId = client.id;
    }

    // 2. Project
    let project: Project;
    try {
      project = await apiClient.post<Project>("/projects", {
        clientId: resolvedClientId,
        name: name.trim(),
        description,
      });
    } catch (err: unknown) {
      setError(`Couldn't create the project: ${reason(err)}`);
      setLoading(false);
      return;
    }

    // 3. Default room so the editor has somewhere to put cabinets
    try {
      await apiClient.post(`/projects/${project.id}/rooms`, {
        name: "Main Room",
        ...DEFAULT_ROOM_DIMENSIONS_MM,
      });
    } catch (err: unknown) {
      onCreated(project);
      setOrphanProjectId(project.id);
      setError(`Project created, but its first room couldn't be added: ${reason(err)}`);
      setLoading(false);
      return;
    }

    onCreated(project);
    // A brand-new workspace (no clients before) gets the first-run editor guide.
    router.push(`/projects/${project.id}/editor${needsNewClient ? "?onboarding=1" : ""}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-white font-semibold text-lg mb-5">New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="np-client" className="block text-xs text-gray-400 mb-1">
              {needsNewClient ? "Client name" : "Client"}
            </label>
            {!clientsLoaded ? (
              <div className="h-8 rounded-md bg-surface-100 animate-pulse" aria-busy="true" />
            ) : needsNewClient ? (
              <>
                <input
                  id="np-client"
                  value={createdClient ? createdClient.name : newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  disabled={createdClient !== null}
                  placeholder="e.g. Johnson Residence"
                  className={`${inputCls} disabled:opacity-60`}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {clientsError
                    ? "Couldn't load your clients — a new one will be created."
                    : "Your first client is created along with the project."}
                </p>
              </>
            ) : (
              <select
                id="np-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputCls}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="np-name" className="block text-xs text-gray-400 mb-1">Project name</label>
            <input
              id="np-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kitchen Remodel — Johnson"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="np-desc" className="block text-xs text-gray-400 mb-1">Description (optional)</label>
            <textarea
              id="np-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p role="alert" className="text-red-400 text-xs">
              {error}
              {orphanProjectId && (
                <>
                  {" "}
                  <Link href={`/projects/${orphanProjectId}`} className="underline text-red-300">
                    Open the project to add a room
                  </Link>
                  .
                </>
              )}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm text-gray-400 hover:text-white py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !clientsLoaded || orphanProjectId !== null}
              className="flex-1 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white py-2 rounded-md transition-colors"
            >
              {loading ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
