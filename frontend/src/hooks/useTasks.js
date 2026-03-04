import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../api/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await taskApi.list();
      setTasks(res.data.results || res.data);
    } catch (err) {
      setError('Failed to load tasks. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async (data) => {
    const res = await taskApi.createWithFile(data);
    setTasks(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateTask = async (id, data) => {
    const res = await taskApi.updateWithFile(id, data);
    setTasks(prev => prev.map(t => t.id === id ? res.data : t));
    return res.data;
  };

  const deleteTask = async (id) => {
    await taskApi.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return { tasks, loading, error, refetch: fetchTasks, createTask, updateTask, deleteTask };
}
