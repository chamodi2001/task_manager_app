import React, { useState } from 'react';

const STATUS_COLORS = {
  todo: { bg: '#FFF0E6', text: '#A0522D', dot: '#C4622D', label: 'To Do' },
  in_progress: { bg: '#FFF3E0', text: '#7B4A1E', dot: '#E07B30', label: 'In Progress' },
  done: { bg: '#EFF7EC', text: '#3A6B2E', dot: '#5C8A4A', label: 'Done' },
};

export default function TaskCard({ task, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sc = STATUS_COLORS[task.status] || STATUS_COLORS.todo;

  const dateStr = new Date(task.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <span style={{ ...styles.badge, background: sc.bg, color: sc.text }}>
          <span style={{ ...styles.dot, background: sc.dot }} />
          {sc.label}
        </span>
        <span style={styles.date}>{dateStr}</span>
      </div>

      <h3 style={styles.title}>{task.title}</h3>

      {task.description && (
        <p style={styles.desc}>{task.description}</p>
      )}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noreferrer" style={styles.attachment}>
          <span>📎</span> View Attachment
        </a>
      )}

      <div style={styles.footer}>
        <button style={styles.editBtn} onClick={() => onEdit(task)}>
          ✏️ Edit
        </button>
        {confirmDelete ? (
          <div style={styles.confirmRow}>
            <span style={styles.confirmText}>Sure?</span>
            <button style={styles.confirmYes} onClick={() => onDelete(task.id)}>Yes</button>
            <button style={styles.confirmNo} onClick={() => setConfirmDelete(false)}>No</button>
          </div>
        ) : (
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#FFFCF7', borderRadius: '14px',
    border: '1.5px solid #E8C9A0', padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(100,50,20,0.07)',
    display: 'flex', flexDirection: 'column', gap: '10px',
    transition: 'box-shadow 0.2s, transform 0.2s',
    cursor: 'default',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '4px 11px', borderRadius: '20px',
    fontFamily: "'Lora', serif", fontSize: '12px', fontWeight: 500,
  },
  dot: { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' },
  date: { fontFamily: "'Lora', serif", fontSize: '12px', color: '#B88A68', flexShrink: 0 },
  title: {
    margin: 0, fontFamily: "'Playfair Display', serif",
    fontSize: '18px', fontWeight: 700, color: '#2D1505', lineHeight: 1.3,
  },
  desc: {
    margin: 0, fontFamily: "'Lora', serif", fontSize: '14px',
    color: '#6B4A30', lineHeight: 1.6,
    display: '-webkit-box', WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  attachment: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontFamily: "'Lora', serif", fontSize: '13px', color: '#C4622D',
    textDecoration: 'none', padding: '4px 0',
  },
  footer: { display: 'flex', gap: '8px', marginTop: '6px', paddingTop: '14px', borderTop: '1px solid #F0DCC4' },
  editBtn: {
    flex: 1, padding: '8px', borderRadius: '8px',
    border: '1.5px solid #DEB88C', background: '#FFF8F0',
    cursor: 'pointer', fontFamily: "'Lora', serif", fontSize: '13px',
    color: '#6B3F22', transition: 'all 0.2s',
  },
  deleteBtn: {
    flex: 1, padding: '8px', borderRadius: '8px',
    border: '1.5px solid #F0C4C4', background: '#FFF8F8',
    cursor: 'pointer', fontFamily: "'Lora', serif", fontSize: '13px',
    color: '#A04040', transition: 'all 0.2s',
  },
  confirmRow: { flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' },
  confirmText: { fontFamily: "'Lora', serif", fontSize: '13px', color: '#6B3F22' },
  confirmYes: { padding: '6px 12px', borderRadius: '7px', border: 'none', background: '#C04040', color: '#fff', cursor: 'pointer', fontFamily: "'Lora', serif", fontSize: '12px' },
  confirmNo: { padding: '6px 12px', borderRadius: '7px', border: '1px solid #DEB88C', background: '#FFF8F0', color: '#6B3F22', cursor: 'pointer', fontFamily: "'Lora', serif", fontSize: '12px' },
};
