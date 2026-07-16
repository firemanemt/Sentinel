import React, { useState } from "react";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: string;
  modified?: string;
}

export function FilesWindow() {
  const [currentPath, setCurrentPath] = useState("/");
  const [files] = useState<FileItem[]>([
    { id: "1", name: "Documents", type: "folder" },
    { id: "2", name: "Downloads", type: "folder" },
    { id: "3", name: "Desktop", type: "folder" },
    { id: "4", name: "project.pdf", type: "file", size: "2.4 MB", modified: "2 days ago" },
    { id: "5", name: "notes.txt", type: "file", size: "12 KB", modified: "1 hour ago" },
  ]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px", borderBottom: "1px solid rgba(0, 200, 255, 0.2)", display: "flex", gap: "8px", alignItems: "center" }}>
        <button style={{ padding: "4px 8px", backgroundColor: "rgba(0, 150, 200, 0.3)", border: "1px solid rgba(0, 200, 255, 0.3)", borderRadius: "3px", color: "#00ccee", cursor: "pointer", fontSize: "12px" }}>
          ← Back
        </button>
        <div style={{ flex: 1, color: "rgba(0, 200, 255, 0.6)", fontSize: "12px" }}>
          {currentPath}
        </div>
        <button style={{ padding: "4px 8px", backgroundColor: "rgba(0, 150, 200, 0.3)", border: "1px solid rgba(0, 200, 255, 0.3)", borderRadius: "3px", color: "#00ccee", cursor: "pointer", fontSize: "12px" }}>
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                backgroundColor: "rgba(0, 100, 150, 0.1)",
                border: "1px solid rgba(0, 200, 255, 0.1)",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0, 100, 150, 0.2)";
                e.currentTarget.style.borderColor = "rgba(0, 200, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0, 100, 150, 0.1)";
                e.currentTarget.style.borderColor = "rgba(0, 200, 255, 0.1)";
              }}
            >
              <div style={{ fontSize: "16px" }}>
                {file.type === "folder" ? "📁" : "📄"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#00ccee", fontSize: "12px", fontWeight: "500" }}>
                  {file.name}
                </div>
                {file.size && (
                  <div style={{ color: "rgba(0, 200, 255, 0.4)", fontSize: "10px" }}>
                    {file.size} • {file.modified}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
