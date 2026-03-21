import Sidebar from "@/components/Sidebar";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
