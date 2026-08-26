import { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = { title: "Rooms — CabinetFlow AI" };

// RoomsWorkspace subsumes the previous <EditorHeader> + <CabinetEditor>
// pairing. It carries its own header, canvas, inspector, and summary.
// Loaded client-side because the entire tree depends on Three.js /
// React-Three-Fiber which cannot render on the server.
const RoomsWorkspace = dynamic(
  () => import("@/components/workspace/RoomsWorkspace"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-surface text-gray-500 text-sm">
        Loading workspace…
      </div>
    ),
  },
);

export default function EditorPage({ params }: { params: { id: string } }) {
  return <RoomsWorkspace projectId={params.id} />;
}
