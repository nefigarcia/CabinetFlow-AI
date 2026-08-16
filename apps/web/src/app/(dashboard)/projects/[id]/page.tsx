"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";

interface Room { id: string; name: string; width: number; height: number; depth: number; _count: { cabinets: number }; createdAt: string }
interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  client: { id: string; name: string; email: string | null };
  rooms: Room[];
  _count: { quotes: number; revisions: number; productionRuns: number };
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_review: "In Review", approved: "Approved",
  in_production: "In Production", complete: "Complete",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", width: 4800, height: 2400, depth: 5400 });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [roomDeleteError, setRoomDeleteError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Project>(`/projects/${id}`)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function deleteProject() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/projects/${id}`);
      router.push("/projects");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete project");
      setDeleting(false);
    }
  }

  async function deleteRoom() {
    if (!roomToDelete) return;
    setDeletingRoom(true);
    setRoomDeleteError(null);
    try {
      await apiClient.delete(`/projects/${id}/rooms/${roomToDelete.id}`);
      setProject((p) => p ? { ...p, rooms: p.rooms.filter((r) => r.id !== roomToDelete.id) } : p);
      setRoomToDelete(null);
    } catch (err) {
      setRoomDeleteError(err instanceof Error ? err.message : "Failed to delete room");
    } finally {
      setDeletingRoom(false);
    }
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    try {
      const room = await apiClient.post<Room>(`/projects/${id}/rooms`, newRoom);
      setProject((p) => p ? { ...p, rooms: [...p.rooms, room] } : p);
      setAddingRoom(false);
      setNewRoom({ name: "", width: 4800, height: 2400, depth: 5400 });
    } catch (err) { console.error(err); }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (!project) return <div className="p-8 text-red-400 text-sm">Project not found.</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/projects" className="text-gray-500 hover:text-gray-300 text-sm">← Projects</Link>
          </div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {project.client.name} · {STATUS_LABELS[project.status] ?? project.status}
          </p>
          {project.description && <p className="text-gray-500 text-sm mt-2">{project.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Link href={`/projects/${id}/cutlist`} className="bg-surface-100 hover:bg-surface-200 text-gray-200 text-sm px-3 py-2 rounded-lg transition-colors">
            Cut List
          </Link>
          <Link href={`/projects/${id}/quotes`} className="bg-surface-100 hover:bg-surface-200 text-gray-200 text-sm px-3 py-2 rounded-lg transition-colors">
            Quotes {project._count.quotes > 0 && `(${project._count.quotes})`}
          </Link>
          <Link href={`/projects/${id}/production`} className="bg-surface-100 hover:bg-surface-200 text-gray-200 text-sm px-3 py-2 rounded-lg transition-colors">
            Production
          </Link>
          <Link href={`/projects/${id}/feedback`} className="bg-surface-100 hover:bg-surface-200 text-gray-200 text-sm px-3 py-2 rounded-lg transition-colors">
            Field Feedback
          </Link>
          <Link href={`/projects/${id}/editor`} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Open Editor →
          </Link>
        </div>
      </div>

      {/* Rooms */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Rooms</h2>
          <button
            onClick={() => setAddingRoom(!addingRoom)}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            + Add Room
          </button>
        </div>

        {addingRoom && (
          <form onSubmit={addRoom} className="bg-surface-50 border border-surface-200 rounded-xl p-4 mb-3 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Room name</label>
                <input
                  required
                  value={newRoom.name}
                  onChange={(e) => setNewRoom((r) => ({ ...r, name: e.target.value }))}
                  placeholder="Kitchen"
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {(["width", "height", "depth"] as const).map((f) => (
                <div key={f} className="flex-1">
                  <label className="block text-gray-400 mb-1 capitalize">{f} (mm)</label>
                  <input
                    type="number"
                    value={newRoom[f]}
                    onChange={(e) => setNewRoom((r) => ({ ...r, [f]: Number(e.target.value) }))}
                    className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddingRoom(false)} className="text-sm text-gray-400 px-3 py-1">Cancel</button>
              <button type="submit" className="text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1 rounded-md transition-colors">Add Room</button>
            </div>
          </form>
        )}

        {project.rooms.length === 0 ? (
          <p className="text-gray-500 text-sm">No rooms yet.</p>
        ) : (
          <div className="space-y-2">
            {project.rooms.map((room) => (
              <div key={room.id} className="bg-surface-50 border border-surface-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{room.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {Number(room.width).toFixed(0)} × {Number(room.height).toFixed(0)} × {Number(room.depth).toFixed(0)} mm · {room._count.cabinets} cabinet{room._count.cabinets !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/projects/${id}/editor`}
                    className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Edit →
                  </Link>
                  <button
                    onClick={() => setRoomToDelete(room)}
                    title="Delete room"
                    aria-label={`Delete ${room.name}`}
                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-surface-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-10 pt-6 border-t border-surface-200">
        <h2 className="text-sm font-semibold text-red-400 mb-2">Danger zone</h2>
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Delete this project</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Removes all rooms, cabinets, cutlists, and quotes. Cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-sm bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-md transition-colors"
          >
            Delete project
          </button>
        </div>
      </div>

      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-50 border border-surface-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-white font-semibold text-lg mb-2">Delete room?</h2>
            <p className="text-gray-400 text-sm">
              This will permanently delete <span className="text-white font-medium">{roomToDelete.name}</span>
              {roomToDelete._count.cabinets > 0 && (
                <> and its {roomToDelete._count.cabinets} cabinet{roomToDelete._count.cabinets !== 1 ? "s" : ""}</>
              )}. This cannot be undone.
            </p>
            {roomDeleteError && <p className="mt-3 text-red-400 text-sm">{roomDeleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setRoomToDelete(null); setRoomDeleteError(null); }}
                disabled={deletingRoom}
                className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteRoom}
                disabled={deletingRoom}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                {deletingRoom ? "Deleting…" : "Delete room"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-50 border border-surface-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-white font-semibold text-lg mb-2">Delete project?</h2>
            <p className="text-gray-400 text-sm">
              This will permanently delete <span className="text-white font-medium">{project.name}</span>{" "}
              and all of its rooms, cabinets, cutlists, and quotes. This cannot be undone.
            </p>
            {deleteError && <p className="mt-3 text-red-400 text-sm">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setConfirmingDelete(false); setDeleteError(null); }}
                disabled={deleting}
                className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                {deleting ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
