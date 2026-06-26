const express = require('express');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/projects/:projectId/room-progress
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req;

    // 1. Fetch all unique room names across measurements, activities, and tasks
    const roomsUnionQuery = `
      SELECT DISTINCT room_name FROM (
        SELECT room_name FROM project_measurements WHERE project_id = $1 AND tenant_id = $2
        UNION
        SELECT room_name FROM project_work_activities WHERE project_id = $1 AND tenant_id = $2
        UNION
        SELECT room_name FROM tasks WHERE project_id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND room_name IS NOT NULL
      ) AS combined_rooms
      ORDER BY room_name ASC
    `;
    const { rows: roomRows } = await pool.query(roomsUnionQuery, [projectId, tenantId]);
    const roomNames = roomRows.map(r => r.room_name);

    // 2. Fetch measurements for this project
    const measurementsQuery = `
      SELECT room_name, area, length, width, height, unit, notes
      FROM project_measurements
      WHERE project_id = $1 AND tenant_id = $2
    `;
    const { rows: measurementRows } = await pool.query(measurementsQuery, [projectId, tenantId]);
    const measurementsMap = {};
    measurementRows.forEach(m => {
      measurementsMap[m.room_name] = {
        area: Number(m.area),
        length: Number(m.length),
        width: Number(m.width),
        height: Number(m.height),
        unit: m.unit,
        notes: m.notes
      };
    });

    // 3. Fetch all tasks for this project that are tagged with a room
    const tasksQuery = `
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.room_name, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL AND t.room_name IS NOT NULL
      ORDER BY t.created_at ASC
    `;
    const { rows: taskRows } = await pool.query(tasksQuery, [projectId, tenantId]);
    const tasksMap = {};
    taskRows.forEach(t => {
      if (!tasksMap[t.room_name]) tasksMap[t.room_name] = [];
      tasksMap[t.room_name].push({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        priority: t.priority,
        assigneeName: t.assignee_name || 'Unassigned'
      });
    });

    // 4. Fetch all work activities for this project
    const activitiesQuery = `
      SELECT a.id, a.activity_name, a.trade, a.status, a.due_date, a.room_name, u.name as assignee_name
      FROM project_work_activities a
      LEFT JOIN users u ON a.assignee_id = u.id
      WHERE a.project_id = $1 AND a.tenant_id = $2
      ORDER BY a.created_at ASC
    `;
    const { rows: activityRows } = await pool.query(activitiesQuery, [projectId, tenantId]);
    const activitiesMap = {};
    activityRows.forEach(a => {
      if (!activitiesMap[a.room_name]) activitiesMap[a.room_name] = [];
      activitiesMap[a.room_name].push({
        id: a.id,
        activityName: a.activity_name,
        trade: a.trade,
        status: a.status,
        dueDate: a.due_date,
        assigneeName: a.assignee_name || 'Unassigned'
      });
    });

    // 5. Build response details for each room
    const roomProgressList = roomNames.map(roomName => {
      const roomMeasurements = measurementsMap[roomName] || null;
      const roomTasks = tasksMap[roomName] || [];
      const roomActivities = activitiesMap[roomName] || [];

      // Calculate totals and completions
      const totalTasks = roomTasks.length;
      const completedTasks = roomTasks.filter(t => t.status === 'done').length;

      const totalActivities = roomActivities.length;
      const completedActivities = roomActivities.filter(a => a.status === 'completed').length;

      const totalItems = totalTasks + totalActivities;
      const completedItems = completedTasks + completedActivities;

      const progressPercentage = totalItems > 0
        ? Math.round((completedItems * 100.0 / totalItems) * 100) / 100
        : 0;

      return {
        roomName,
        measurements: roomMeasurements,
        totalTasks,
        completedTasks,
        totalActivities,
        completedActivities,
        progressPercentage,
        tasks: roomTasks,
        activities: roomActivities
      };
    });

    return success(res, roomProgressList);
  } catch (err) {
    console.error('[RoomProgress Router] Error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve room-wise progress.', 500);
  }
});

module.exports = router;
