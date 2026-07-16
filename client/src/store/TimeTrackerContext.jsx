/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, no-empty, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from './toastContext';

const TimeTrackerContext = createContext(null);

export function TimeTrackerProvider({ children }) {
  const [activeTimer, setActiveTimer] = useState(null); // { taskId, projectId, title, startTime, accumulatedSecs }
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const intervalRef = useRef(null);
  const toast = useToast();

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('myTasksActiveTimer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveTimer(parsed);
        if (parsed.startTime) {
          const diff = Math.floor((Date.now() - parsed.startTime) / 1000);
          setElapsedSecs((parsed.accumulatedSecs || 0) + diff);
          startInterval(parsed.startTime, parsed.accumulatedSecs || 0);
        } else {
          setElapsedSecs(parsed.accumulatedSecs || 0);
        }
      } catch (e) {}
    }
  }, []);

  function startInterval(startTs, baseSecs) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTs) / 1000);
      setElapsedSecs(baseSecs + diff);
    }, 1000);
  };

  const persist = (data) => {
    if (!data) {
      localStorage.removeItem('myTasksActiveTimer');
      setActiveTimer(null);
    } else {
      localStorage.setItem('myTasksActiveTimer', JSON.stringify(data));
      setActiveTimer(data);
    }
  };

  const startTimer = (taskId, projectId, title) => {
    if (activeTimer && activeTimer.taskId !== taskId) {
      toast.warning('Please stop the current timer first.');
      return;
    }
    const ts = Date.now();
    const accumulated = activeTimer ? activeTimer.accumulatedSecs : 0;
    const newData = { taskId, projectId, title, startTime: ts, accumulatedSecs: accumulated };
    persist(newData);
    startInterval(ts, accumulated);
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeTimer) return;
    const newData = { ...activeTimer, startTime: null, accumulatedSecs: elapsedSecs };
    persist(newData);
  };

  const stopTimer = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeTimer) return 0;
    const finalSecs = elapsedSecs;
    persist(null);
    setElapsedSecs(0);
    return finalSecs;
  };

  const discardTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    persist(null);
    setElapsedSecs(0);
  };

  return (
    <TimeTrackerContext.Provider value={{
      activeTimer,
      elapsedSecs,
      startTimer,
      pauseTimer,
      stopTimer,
      discardTimer
    }}>
      {children}
    </TimeTrackerContext.Provider>
  );
}

export const useTimeTracker = () => useContext(TimeTrackerContext);
