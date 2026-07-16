import React, { useState } from "react";

export function NotesWindow() {
  const [notes, setNotes] = useState([
    { id: 1, title: "Project Ideas", content: "- Desktop OS features\n- Real-time collaboration\n- AI integration" },
    { id: 2, title: "Shopping List", content: "- Coffee\n- Groceries\n- Office supplies" },
  ]);
  const [selectedNote, setSelectedNote] = useState(notes[0]);
  const [editContent, setEditContent] = useState(selectedNote.content);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", gap: "12px", padding: "12px" }}>
      <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "8px", borderRight: "1px solid rgba(0, 200, 255, 0.2)", paddingRight: "12px" }}>
        <button
          style={{
            padding: "8px 12px",
            backgroundColor: "rgba(0, 150, 200, 0.3)",
            border: "1px solid rgba(0, 200, 255, 0.3)",
            borderRadius: "4px",
            color: "#00ccee",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          + New Note
        </button>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => {
                setSelectedNote(note);
                setEditContent(note.content);
              }}
              style={{
                padding: "8px 12px",
                backgroundColor: selectedNote.id === note.id ? "rgba(0, 200, 255, 0.2)" : "rgba(0, 100, 150, 0.1)",
                border: "1px solid rgba(0, 200, 255, 0.2)",
                borderRadius: "4px",
                color: "#00ccee",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {note.title}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          value={selectedNote.title}
          placeholder="Note title..."
          style={{
            padding: "8px 12px",
            backgroundColor: "rgba(0, 50, 100, 0.3)",
            border: "1px solid rgba(0, 200, 255, 0.2)",
            borderRadius: "4px",
            color: "#00ccee",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="Start typing..."
          style={{
            flex: 1,
            padding: "12px",
            backgroundColor: "rgba(0, 50, 100, 0.3)",
            border: "1px solid rgba(0, 200, 255, 0.2)",
            borderRadius: "4px",
            color: "#00ccee",
            fontSize: "12px",
            fontFamily: "monospace",
            resize: "none",
          }}
        />
      </div>
    </div>
  );
}
