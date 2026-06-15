import React, { useState, useEffect } from 'react';
import {
  DndContext, DragOverlay, closestCorners,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTasks, createTask, updateTask } from '../../api/projects';

const TaskCard = ({ task, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityColors = {
    low: 'bg-slate-700 text-slate-300',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-orange-500/20 text-orange-400',
    urgent: 'bg-red-500/20 text-red-400'
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3 cursor-grab hover:border-slate-500 hover:shadow-lg transition-all shadow-sm group"
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <h4 className="text-sm font-bold text-white leading-snug group-hover:text-blue-400 transition-colors">{task.title}</h4>
        {task.priority && (
          <span className={`px-2 py-0.5 text-[9px] uppercase font-black tracking-wider rounded ${priorityColors[task.priority] || priorityColors.low}`}>
            {task.priority}
          </span>
        )}
      </div>
      
      {task.milestone_name && (
        <div className="mb-4 inline-block">
          <span className="text-[10px] font-bold tracking-wide px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 shadow-inner">
            {task.milestone_name}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          {task.assignee_name ? (
            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white shadow-inner" title={task.assignee_name}>
              {task.assignee_name.charAt(0)}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-700/50 border border-slate-600 border-dashed flex items-center justify-center text-slate-500 text-xs shadow-inner" title="Unassigned">
              ?
            </div>
          )}
          {(task.subtask_count > 0 || task.completed_subtask_count > 0) && (
            <span className="text-[10px] text-slate-400 font-bold bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700">
              {task.completed_subtask_count || 0}/{task.subtask_count || 0}
            </span>
          )}
        </div>
        {task.due_date && (
          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isOverdue ? 'text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded' : 'text-slate-500'}`}>
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
};

const TaskColumn = ({ id, title, tasks, onTaskClick, onAddTask }) => {
  const { setNodeRef } = useSortable({
    id: id,
    data: { type: 'Column', columnId: id }
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(id, newTaskTitle);
    setNewTaskTitle('');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col bg-slate-800/30 rounded-2xl border border-slate-700/50 w-[300px] min-w-[300px] max-h-full shadow-xl shadow-black/20">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 rounded-t-2xl backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${id === 'todo' ? 'bg-slate-400' : id === 'in_progress' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : id === 'blocked' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`}></div>
          <h3 className="font-extrabold text-white text-[11px] uppercase tracking-widest">{title}</h3>
        </div>
        <span className="bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md shadow-inner">{tasks.length}</span>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto hide-scrollbar flex flex-col gap-1" ref={setNodeRef}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>
        
        {isAdding ? (
          <form onSubmit={handleAdd} className="mt-2 animate-in slide-in-from-top-2 duration-200">
            <input
              autoFocus
              type="text"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onBlur={() => setIsAdding(false)}
              placeholder="Enter task title..."
              className="w-full bg-slate-900 border-2 border-blue-500/50 text-white text-sm font-bold rounded-lg p-3 focus:outline-none focus:border-blue-500 shadow-inner"
            />
          </form>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="mt-1 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-[11px] uppercase tracking-widest font-extrabold p-3 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 transition-all"
          >
            + Add Task
          </button>
        )}
      </div>
    </div>
  );
};

const TaskDetailDrawer = ({ task, onClose }) => {
  if (!task) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 p-8 animate-in slide-in-from-right-8 duration-300 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-black text-white tracking-tight">Task Details</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-700">&times;</button>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Task Title</label>
          <p className="text-white text-base font-bold bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">{task.title}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
            <span className="inline-block px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-[10px] font-black uppercase tracking-wider text-blue-400 shadow-inner">{task.status.replace('_', ' ')}</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority</label>
            <span className="inline-block px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-[10px] font-black uppercase tracking-wider text-slate-300 shadow-inner">{task.priority || 'Normal'}</span>
          </div>
        </div>
        <div className="pt-6 border-t border-slate-800 mt-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
            <span className="text-3xl mb-2 block">🏗️</span>
            <p className="text-sm font-bold text-blue-400 mb-1">Deep Editing Pending</p>
            <p className="text-xs text-slate-500">Subtask logic, assignment, and comment threading will be available in the dedicated Task UI.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskKanban = ({ projectId, milestoneId = null }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const columns = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'blocked', title: 'Blocked' },
    { id: 'done', title: 'Done' }
  ];

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = { limit: 150 }; // Fetch a generous pool for the board buffer
      if (milestoneId) params.milestoneId = milestoneId;
      const res = await getTasks(projectId, params);
      setTasks(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, milestoneId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    // Optimistic visual list swapping
    if (isActiveTask && isOverTask) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        const overIndex = prev.findIndex((t) => t.id === overId);
        if (prev[activeIndex].status !== prev[overIndex].status) {
          const newTasks = [...prev];
          newTasks[activeIndex] = { ...newTasks[activeIndex], status: prev[overIndex].status };
          return arrayMove(newTasks, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    if (isActiveTask && isOverColumn) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        if (prev[activeIndex].status !== overId) {
          const newTasks = [...prev];
          newTasks[activeIndex] = { ...newTasks[activeIndex], status: overId };
          return arrayMove(newTasks, activeIndex, activeIndex);
        }
        return prev;
      });
    }
  };

  const handleDragEnd = async (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id;
    const currentLocalTask = tasks.find((t) => t.id === activeTaskId);
    if (!currentLocalTask) return;

    const newStatus = currentLocalTask.status;

    try {
      // Background flush API trigger
      await updateTask(projectId, activeTaskId, { status: newStatus });
    } catch (e) {
      console.error(e);
      // Native SUBTASKS_INCOMPLETE backend guardrail catch
      if (e.response?.data?.code === 'SUBTASKS_INCOMPLETE') {
        alert(`Blocker: Cannot move to Done. ${e.response.data.details} subtasks are still pending validation.`);
      } else {
        alert('Failed to update task status in the database.');
      }
      fetchTasks(); // Force hard sync reversal
    }
  };

  const handleAddTask = async (status, title) => {
    try {
      const data = { title, milestoneId };
      const res = await createTask(projectId, data);
      let newTask = res.data.data;
      
      // If user spawned task in non-todo column, patch immediately
      if (status !== 'todo') {
        const updateRes = await updateTask(projectId, newTask.id, { status });
        newTask = updateRes.data.data;
      }
      setTasks(prev => [newTask, ...prev]);
    } catch (e) {
      console.error(e);
      alert('Failed to instantiate new task.');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-[500px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="relative h-[700px] w-full">
      <div className="flex h-full w-full overflow-x-auto gap-6 pb-6 pt-2 px-1 hide-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {columns.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            return (
              <TaskColumn
                key={col.id}
                id={col.id}
                title={col.title}
                tasks={columnTasks}
                onTaskClick={setSelectedTask}
                onAddTask={handleAddTask}
              />
            );
          })}
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedTask && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
        </>
      )}
    </div>
  );
};

export default TaskKanban;
