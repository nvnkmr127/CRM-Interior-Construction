import { create } from 'zustand';

export const useTimeTrackerStore = create((set, get) => ({
  activeTimer: null,
  elapsedSecs: 0,
  intervalRef: null,

  init: () => {
    const saved = localStorage.getItem('myTasksActiveTimer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        set({ activeTimer: parsed });
        if (parsed.startTime) {
          const diff = Math.floor((Date.now() - parsed.startTime) / 1000);
          set({ elapsedSecs: (parsed.accumulatedSecs || 0) + diff });
          get().startInterval(parsed.startTime, parsed.accumulatedSecs || 0);
        } else {
          set({ elapsedSecs: parsed.accumulatedSecs || 0 });
        }
      } catch (e) {
        console.error('Failed to parse active timer', e);
      }
    }
  },

  startInterval: (startTs, baseSecs) => {
    const currentInterval = get().intervalRef;
    if (currentInterval) clearInterval(currentInterval);
    
    const intervalRef = setInterval(() => {
      const diff = Math.floor((Date.now() - startTs) / 1000);
      set({ elapsedSecs: baseSecs + diff });
    }, 1000);
    
    set({ intervalRef });
  },

  persist: (data) => {
    if (!data) {
      localStorage.removeItem('myTasksActiveTimer');
      set({ activeTimer: null });
    } else {
      localStorage.setItem('myTasksActiveTimer', JSON.stringify(data));
      set({ activeTimer: data });
    }
  },

  startTimer: (taskId, projectId, title) => {
    const { activeTimer } = get();
    // Assuming useToast is used by the caller to show the warning if needed
    if (activeTimer && activeTimer.taskId !== taskId) {
      return false; // Indicating failure to start
    }
    const ts = Date.now();
    const accumulated = activeTimer ? activeTimer.accumulatedSecs : 0;
    const newData = { taskId, projectId, title, startTime: ts, accumulatedSecs: accumulated };
    get().persist(newData);
    get().startInterval(ts, accumulated);
    return true;
  },

  pauseTimer: () => {
    const { intervalRef, activeTimer, elapsedSecs } = get();
    if (intervalRef) clearInterval(intervalRef);
    if (!activeTimer) return;
    const newData = { ...activeTimer, startTime: null, accumulatedSecs: elapsedSecs };
    get().persist(newData);
  },

  stopTimer: async () => {
    const { intervalRef, activeTimer, elapsedSecs } = get();
    if (intervalRef) clearInterval(intervalRef);
    if (!activeTimer) return 0;
    const finalSecs = elapsedSecs;
    get().persist(null);
    set({ elapsedSecs: 0 });
    return finalSecs;
  },

  discardTimer: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    get().persist(null);
    set({ elapsedSecs: 0 });
  }
}));

// Initialize on load
useTimeTrackerStore.getState().init();

export const useTimeTracker = () => {
  const store = useTimeTrackerStore();
  return {
    activeTimer: store.activeTimer,
    elapsedSecs: store.elapsedSecs,
    startTimer: store.startTimer,
    pauseTimer: store.pauseTimer,
    stopTimer: store.stopTimer,
    discardTimer: store.discardTimer
  };
};
