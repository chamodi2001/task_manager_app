import React, { useState, useEffect } from 'react';

const STATUS_OPTS = [
  { value: 'todo', label: 'To Do', color: '#A0522D' },
  { value: 'in_progress', label: 'In Progress', color: '#C4622D' },
  { value: 'done', label: 'Done', color: '#5C8A4A' },
];

export default function TaskModal({ task, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('status', status);
      if (file) fd.append('attachment', file);
      await onSave(fd);
      onClose();
    } catch (err) {
      setError(err.response?.data?.title?.[0] || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{task ? 'Edit Task' : 'New Task'}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Title <span style={styles.req}>*</span></label>
            <input
              style={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={255}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add some details..."
              rows={4}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Status</label>
            <div style={styles.statusGroup}>
              {STATUS_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  style={{
                    ...styles.statusBtn,
                    ...(status === opt.value ? { background: opt.color, color: '#FFF8F0', borderColor: opt.color } : {}),
                  }}
                  onClick={() => setStatus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Attachment</label>
            <label style={styles.fileLabel}>
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0])}
              />
              <span style={styles.fileIcon}>📎</span>
              {file ? file.name : (task?.attachment_url ? '📄 Replace existing file' : 'Choose a file...')}
            </label>
            {task?.attachment_url && !file && (
              <a href={task.attachment_url} target="_blank" rel="noreferrer" style={styles.existingFile}>
                View current attachment ↗
              </a>
            )}
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : (task ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(60,30,10,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(3px)', padding: '16px',
  },
  modal: {
    background: '#FFF8F0', borderRadius: '16px', width: '100%', maxWidth: '520px',
    boxShadow: '0 20px 60px rgba(60,30,10,0.25)', border: '1px solid #E8C9A0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 28px 20px', borderBottom: '1px solid #F0D9BE',
    background: 'linear-gradient(135deg, #FAF0E4 0%, #FFF8F0 100%)',
  },
  title: { margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '22px', color: '#3D1E0A', fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer',
    color: '#8B5A3C', padding: '4px 8px', borderRadius: '6px',
    transition: 'background 0.2s',
  },
  form: { padding: '24px 28px' },
  field: { marginBottom: '20px' },
  label: { display: 'block', fontFamily: "'Lora', serif", fontSize: '13px', fontWeight: 500, color: '#6B3F22', marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' },
  req: { color: '#C4622D' },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid #DEB88C', background: '#FFFAF4',
    fontFamily: "'Lora', serif", fontSize: '15px', color: '#2D1505',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  textarea: { resize: 'vertical', minHeight: '96px' },
  statusGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  statusBtn: {
    padding: '7px 16px', borderRadius: '20px', cursor: 'pointer',
    border: '1.5px solid #DEB88C', background: '#FFF8F0',
    fontFamily: "'Lora', serif", fontSize: '13px', color: '#6B3F22',
    transition: 'all 0.2s',
  },
  fileLabel: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 14px', borderRadius: '10px', cursor: 'pointer',
    border: '1.5px dashed #DEB88C', background: '#FFFAF4',
    fontFamily: "'Lora', serif", fontSize: '14px', color: '#8B5A3C',
  },
  fileIcon: { fontSize: '18px' },
  existingFile: { display: 'block', marginTop: '6px', fontSize: '12px', color: '#C4622D', fontFamily: "'Lora', serif" },
  error: { color: '#B84040', fontFamily: "'Lora', serif", fontSize: '13px', marginBottom: '12px', padding: '10px 14px', background: '#FFF0F0', borderRadius: '8px', border: '1px solid #F0BABA' },
  actions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' },
  cancelBtn: {
    padding: '10px 22px', borderRadius: '10px', border: '1.5px solid #DEB88C',
    background: 'none', cursor: 'pointer', fontFamily: "'Lora', serif",
    fontSize: '14px', color: '#6B3F22', transition: 'all 0.2s',
  },
  saveBtn: {
    padding: '10px 26px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #C4622D 0%, #A0522D 100%)',
    cursor: 'pointer', fontFamily: "'Playfair Display', serif",
    fontSize: '15px', color: '#FFF8F0', fontWeight: 600,
    boxShadow: '0 4px 12px rgba(196,98,45,0.35)', transition: 'all 0.2s',
  },
};
