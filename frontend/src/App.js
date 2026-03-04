import React, { useState } from 'react';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import { useTasks } from './hooks/useTasks';

const FILTERS = ['all', 'todo', 'in_progress', 'done'];
const FILTER_LABELS = { all: 'All', todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

export default function App() {
  const { tasks, loading, error, createTask, updateTask, deleteTask } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const openCreate = () => { setEditingTask(null); setModalOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingTask(null); };

  const handleSave = async (formData) => {
    if (editingTask) {
      await updateTask(editingTask.id, formData);
    } else {
      await createTask(formData);
    }
  };

  const filtered = tasks.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = { all: tasks.length, todo: tasks.filter(t => t.status === 'todo').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, done: tasks.filter(t => t.status === 'done').length };

  return (
    <div style={styles.root}>
      {/* Decorative background */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>✦</div>
            <div>
              <h1 style={styles.logoText}>Task Manager</h1>
              <p style={styles.logoSub}>Your warm productivity companion</p>
            </div>
          </div>
          <button style={styles.newBtn} onClick={openCreate}>
            + New Task
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {/* Stats bar */}
        <div style={styles.statsBar}>
          {[
            { label: 'Total', value: counts.all, color: '#A0522D' },
            { label: 'To Do', value: counts.todo, color: '#C4622D' },
            { label: 'In Progress', value: counts.in_progress, color: '#D4793A' },
            { label: 'Done', value: counts.done, color: '#5C8A4A' },
          ].map(stat => (
            <div key={stat.label} style={styles.statCard}>
              <span style={{ ...styles.statNum, color: stat.color }}>{stat.value}</span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              style={styles.searchInput}
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={styles.filters}>
            {FILTERS.map(f => (
              <button
                key={f}
                style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABELS[f]}
                <span style={{ ...styles.filterCount, ...(filter === f ? styles.filterCountActive : {}) }}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Task grid */}
        {loading && (
          <div style={styles.centerMsg}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading tasks…</p>
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <strong style={{ fontFamily: "'Playfair Display', serif", color: '#5A1A1A' }}>Connection Error</strong>
              <p style={{ margin: '4px 0 0', fontFamily: "'Lora', serif", fontSize: '14px', color: '#8B4040' }}>{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <h3 style={styles.emptyTitle}>{search || filter !== 'all' ? 'No matching tasks' : 'No tasks yet'}</h3>
            <p style={styles.emptyDesc}>
              {search || filter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first task to get started.'}
            </p>
            {!search && filter === 'all' && (
              <button style={styles.emptyBtn} onClick={openCreate}>Create a Task</button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={styles.grid}>
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={openEdit}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #FFF5E8 0%, #FAF0DC 50%, #FFF8F0 100%)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Lora', serif",
  },
  bgOrb1: {
    position: 'fixed', top: '-120px', right: '-80px',
    width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(196,98,45,0.12) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '-100px', left: '-60px',
    width: '350px', height: '350px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(160,82,45,0.09) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(255,248,240,0.92)', backdropFilter: 'blur(12px)',
    borderBottom: '1.5px solid rgba(222,184,140,0.5)',
    boxShadow: '0 2px 16px rgba(100,50,20,0.06)',
  },
  headerInner: {
    maxWidth: '1200px', margin: '0 auto', padding: '18px 32px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logoArea: { display: 'flex', alignItems: 'center', gap: '14px' },
  logoIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #C4622D 0%, #8B3A1A 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#FFF8F0', fontSize: '22px', boxShadow: '0 4px 12px rgba(196,98,45,0.3)',
  },
  logoText: {
    margin: 0, fontFamily: "'Playfair Display', serif",
    fontSize: '26px', fontWeight: 700, color: '#2D1505', lineHeight: 1.2,
  },
  logoSub: { margin: 0, fontSize: '12px', color: '#A07050', fontStyle: 'italic' },
  newBtn: {
    padding: '11px 24px', borderRadius: '12px', border: 'none',
    background: 'linear-gradient(135deg, #C4622D 0%, #A0522D 100%)',
    color: '#FFF8F0', cursor: 'pointer',
    fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 600,
    boxShadow: '0 4px 16px rgba(196,98,45,0.35)', transition: 'all 0.2s',
    letterSpacing: '0.02em',
  },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '32px 32px 64px', position: 'relative', zIndex: 1 },
  statsBar: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    background: 'rgba(255,252,247,0.9)', borderRadius: '14px',
    border: '1.5px solid #E8C9A0', padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: '4px',
    boxShadow: '0 2px 8px rgba(100,50,20,0.05)',
  },
  statNum: { fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: '12px', color: '#9B7050', textTransform: 'uppercase', letterSpacing: '0.06em' },
  toolbar: {
    display: 'flex', gap: '16px', marginBottom: '24px',
    flexWrap: 'wrap', alignItems: 'center',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#FFFAF4', border: '1.5px solid #E0C090',
    borderRadius: '12px', padding: '10px 16px', flex: '1', minWidth: '200px',
  },
  searchIcon: { fontSize: '16px', opacity: 0.7 },
  searchInput: {
    border: 'none', background: 'none', outline: 'none',
    fontFamily: "'Lora', serif", fontSize: '14px', color: '#2D1505',
    width: '100%',
  },
  filters: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  filterBtn: {
    padding: '8px 16px', borderRadius: '10px',
    border: '1.5px solid #E0C090', background: '#FFFAF4',
    cursor: 'pointer', fontFamily: "'Lora', serif", fontSize: '13px',
    color: '#6B3F22', display: 'flex', alignItems: 'center', gap: '6px',
    transition: 'all 0.18s',
  },
  filterActive: {
    background: 'linear-gradient(135deg, #C4622D 0%, #A0522D 100%)',
    color: '#FFF8F0', borderColor: '#C4622D',
    boxShadow: '0 3px 10px rgba(196,98,45,0.3)',
  },
  filterCount: {
    background: 'rgba(0,0,0,0.08)', borderRadius: '10px',
    padding: '1px 7px', fontSize: '11px',
  },
  filterCountActive: { background: 'rgba(255,255,255,0.25)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  centerMsg: { textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  spinner: {
    width: '40px', height: '40px', borderRadius: '50%',
    border: '3px solid #E8C9A0', borderTopColor: '#C4622D',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontFamily: "'Lora', serif", fontSize: '15px', color: '#8B5A3C', margin: 0, fontStyle: 'italic' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '16px',
    background: '#FFF5F0', border: '1.5px solid #F0C4A0', borderRadius: '14px',
    padding: '20px 24px', marginBottom: '16px',
  },
  emptyState: {
    textAlign: 'center', padding: '80px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
  emptyIcon: { fontSize: '48px', opacity: 0.5 },
  emptyTitle: { margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '22px', color: '#6B3F22' },
  emptyDesc: { margin: 0, fontFamily: "'Lora', serif", fontSize: '14px', color: '#9B7050', maxWidth: '300px', lineHeight: 1.6 },
  emptyBtn: {
    marginTop: '8px', padding: '12px 28px', borderRadius: '12px', border: 'none',
    background: 'linear-gradient(135deg, #C4622D 0%, #A0522D 100%)',
    color: '#FFF8F0', cursor: 'pointer',
    fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 600,
    boxShadow: '0 4px 16px rgba(196,98,45,0.3)',
  },
};

// Inject keyframe
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);
